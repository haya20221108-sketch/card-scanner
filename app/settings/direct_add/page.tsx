'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { inputAI } from './utils'; // 💡 空間結合版の inputAI を読み込み
import Image from 'next/image';
import { supabase } from '../../supabase';
import { ensureProfiles } from '../../profileStore';
import {
  addCustomMasterCards,
  getCachedMasterData,
  getCachedProfiles,
  getCachedRawCollection,
  getCachedUserId,
  getOnlineStatus,
  normalizePUid,
  queueCollectionChange,
  rememberUserId,
  setCachedMasterData,
  setCachedProfiles,
  upsertCachedCollection,
} from '../../offline';

const fetchWithTimeout = async (input: RequestInfo, init: RequestInit = {}, timeoutMs = 20000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};
import { CustomAlert } from '../../components/CustomAlert';
import { useAuth } from '../../../AuthContext';
import {
  AlertCircle,
  Box,
  Camera,
  Award,
  Check,
  ChevronLeft,
  Edit3,
  Layers,
  Plus,
  Save,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react';

// --- Interfaces ---
interface Profile {
  id: string;
  display_name: string;
}

interface MasterCard {
  id: string;
  name: string;
  pack?: string;
  rank?: number;
  subtype?: string;
  group?: string;
  image?: string;
  image_url?: string;
}

interface ScannedCardResult {
  id: string;
  name: string;
  group: string;
  pack: string;
  stars: number;
  subtype: string;
  quantity: number;
  croppedImg: string;
  sourceImage?: string;
  date: number;
  p_uid: string | null;
}

interface AlertConfigState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'info' | 'error' | 'success';
  onConfirm?: () => void;
  onCancel?: () => void;
}

const CONFIG = {
  gasUrl: 'https://script.google.com/macros/s/AKfycbzE912QE7aAjrxboaW8jLnjJ-tTW7JzePfkREe3vpnTYMsghP4eRMWd_cEK3ffLQn3w4Q/exec',
  ranks: [0, 2, 3, 4, 5],
};

export default function ScannerPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [images, setImages] = useState<string[]>([]);
  const [results, setResults] = useState<ScannedCardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('待機中');
  const [masterData, setMasterData] = useState<MasterCard[]>([]);
  const [isAllSaved, setIsAllSaved] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);
  const [isEditDetailsModalOpen, setIsEditDetailsModalOpen] = useState(false);
  const [isSubtypeSelectionScreenOpen, setIsSubtypeSelectionScreenOpen] = useState(false);
  const [editingResultData, setEditingResultData] = useState<ScannedCardResult | null>(null);

  const [alertConfig, setAlertConfig] = useState<AlertConfigState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (title: string, message: string, type: 'info' | 'error' | 'success' = 'info', onConfirm?: () => void, onCancel?: () => void) => {
    setAlertConfig({ isOpen: true, title, message, type, onConfirm, onCancel });
  };

  const closeAlert = () => {
    setAlertConfig(prev => ({ ...prev, isOpen: false, onConfirm: undefined, onCancel: undefined }));
  };

  const [customAlert, setCustomAlert] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'capture' | 'review'>('capture');
  const hasProfiles = profiles.length > 0;
  const dbProfiles = useMemo(
    () => profiles.filter((p) => !String(p.id).startsWith('local-profile-')),
    [profiles]
  );
  const totalResultQty = useMemo(
    () => results.reduce((sum, r) => sum + (r.quantity || 1), 0),
    [results]
  );
  const canUseAiScan = Boolean(process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY);

  useEffect(() => {
    setHasMounted(true);
    const cached = getCachedMasterData() as MasterCard[];
    setMasterData(cached);
    setProfiles(getCachedProfiles() as Profile[]);
    setIsOnline(getOnlineStatus());

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const initOnlineData = async () => {
      const userId = user?.uid;
      rememberUserId(userId);

      if (!getOnlineStatus()) return;
      try {
        if (userId) {
          try {
            const profileList = await ensureProfiles(userId) as Profile[];
            setCachedProfiles(profileList);
            setProfiles(profileList);
          } catch (error) {
            console.error('Profile sync failed:', error);
          }
        }

        const res = await fetchWithTimeout(CONFIG.gasUrl);
        const data = await res.json();
        const filtered = data.filter((card: MasterCard) => card.name && !['名前', 'name'].includes(card.name.toLowerCase()));
        setCachedMasterData(filtered);
        setMasterData(getCachedMasterData());
      } catch {
        if (cached.length === 0) showAlert('Sync Error', 'マスタデータ未取得。オンライン時に一度開くとオフライン検索できます。', 'error');
      }
    };

    initOnlineData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  useEffect(() => {
    if (customAlert) {
      const timer = setTimeout(() => {
        setCustomAlert(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [customAlert]);

  useEffect(() => {
    if (loading || isSubtypeSelectionScreenOpen) return;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.subtype) continue;

      const matchingEntries = masterData.filter(m => 
        String(m.name).toLowerCase() === String(result.name).toLowerCase() &&
        (result.pack ? String(m.pack || 'その他').toLowerCase() === String(result.pack).toLowerCase() : true) &&
        Number(m.rank ?? 0) === Number(result.stars ?? 0)
      );

      const availableSubtypesForCard = Array.from(new Set(
        matchingEntries.map((m: MasterCard) => m.subtype)
      )).filter(Boolean);

      if (availableSubtypesForCard.length > 1) {
        setEditingResultData(result);
        setSelectedResultIndex(i);
        setIsSubtypeSelectionScreenOpen(true);
        break;
      }
    }
  }, [results, masterData, loading, isSubtypeSelectionScreenOpen]);

  const updateResult = (index: number, field: string, value: any, closeEditModal: boolean = false) => {
    const next: ScannedCardResult[] = [...results];
    if (field === 'all' && value !== undefined && value !== null) {
      next[index] = { ...next[index], ...value };
      if (isEditDetailsModalOpen && editingResultData && editingResultData.date === next[index].date) {
        setEditingResultData(next[index]);
      }
    } else {
      next[index] = { ...next[index], [field]: value };
    }

    if (['name', 'pack', 'stars', 'subtype', 'all'].includes(field)) {
      const current = next[index];
      const match = masterData.find((m: MasterCard) => 
        String(m.name).toLowerCase() === String(current.name || '').toLowerCase() &&
        String(m.pack || 'その他').toLowerCase() === String(current.pack || 'その他').toLowerCase() &&
        Number(m.rank ?? 0) === Number(current.stars ?? 0) &&
        (!current.subtype || String(m.subtype || '').toLowerCase() === String(current.subtype).toLowerCase())
      );

      if (match) {
        next[index] = {
          ...next[index],
          name: match.name,
          id: match.id,
          group: match.group || '',
          pack: match.pack || 'その他',
          stars: match.rank ?? 0,
          subtype: match.subtype || '',
          croppedImg: match.image_url || match.image || next[index].croppedImg
        };
      } else if (field === 'name' && current.name) {
        const nameMatch = masterData.find((m: MasterCard) => String(m.name).toLowerCase() === String(current.name).toLowerCase());
        if (nameMatch) {
          next[index] = {
            ...next[index],
            name: nameMatch.name,
            id: nameMatch.id,
            group: nameMatch.group || '',
            pack: nameMatch.pack || 'その他',
            stars: nameMatch.rank ?? 0,
            subtype: nameMatch.subtype || '',
            croppedImg: nameMatch.image_url || nameMatch.image || next[index].croppedImg
          };
        } else {
          next[index].id = `manual-${Date.now()}`;
        }
      } else if (field !== 'all') {
        if (!String(next[index].id).startsWith('manual-')) {
          next[index].id = `manual-${Date.now()}`;
        }
      }
    }

    setResults(next);
    if (closeEditModal) {
      setIsEditDetailsModalOpen(false);
      setEditingResultData(null);
    }
    setIsAllSaved(false);
  };

  const removeResult = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
    setIsAllSaved(false);
  };

  const addManualCard = () => {
    setResults((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        name: '',
        group: '',
        pack: '',
        stars: 0,
        subtype: '',
        quantity: 1,
        croppedImg: '',
        date: Date.now(),
        p_uid: profiles[0]?.id || null,
      },
    ]);
    setIsAllSaved(false);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result;
        if (typeof dataUrl === 'string') setImages((prev) => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleBatchScan = async () => {
    if (images.length === 0 || loading) return;
    if (!hasProfiles) {
      showAlert('アカウントがありません', '設定 > Profiles でアプリ内アカウントを作成してください。', 'error');
      return;
    }
    if (!canUseAiScan) {
      showAlert('AI解析は設定不足', 'Roboflow APIキーが未設定です。NEXT_PUBLIC_ROBOFLOW_API_KEY を設定してください。', 'info');
      return;
    }
    if (!isOnline) {
      showAlert('Offline Mode', 'オフライン中は手動追加を使えます。AI解析はオンライン復帰後に実行できます。', 'info');
      return;
    }
    if (masterData.length === 0) {
      showAlert('Master Data Missing', 'マスタデータがありません。先にオンラインで同期してください。', 'error');
      return;
    }

    setLoading(true);
    setStatus('カード解析中...');
    setProgress(0);
    setIsAllSaved(false);
    let totalFoundCount = 0;

    try {
      for (let i = 0; i < images.length; i += 1) {
        setStatus(`${i + 1}/${images.length}枚目を解析中...`);
        
        // 💡 空間結合・部分OCR版の新しい `inputAI` を実行（配列で複数カードが返ってくる）
        const parsed = (await inputAI(images[i], masterData) as ScannedCardResult[])
          .map((card) => ({
            ...card,
            p_uid: card.p_uid || dbProfiles[0]?.id || profiles[0]?.id || null,
          }));
        
        console.log(`[Scanner AI] Analysis Result for image ${i + 1}:`, parsed);
        
        if (parsed.length > 0) {
          totalFoundCount += parsed.length;
          setViewMode('review');
          
          setResults((prev) => {
            const consolidatedResults = new Map<string, ScannedCardResult>();
            // 既存の結果をマップに退避
            prev.forEach(res => consolidatedResults.set(res.id, { ...res }));
            
            // 新しく検出されたカードたちを同一IDごとに数量マージ
            parsed.forEach(newCard => {
              const addQty = newCard.quantity || 1; 
              if (consolidatedResults.has(newCard.id)) {
                consolidatedResults.get(newCard.id)!.quantity += addQty;
              } else {
                consolidatedResults.set(newCard.id, { ...newCard, quantity: addQty });
              }
            });
            return Array.from(consolidatedResults.values());
          });
        }
        
        setProgress(Math.round(((i + 1) / images.length) * 100));
      }
      setImages([]);

      if (totalFoundCount === 0) {
        showAlert('Result', 'カードを検出できませんでした。角度を変えて撮り直すか、手動追加してください。', 'info');
      } else {
        setCustomAlert(`${totalFoundCount}件のカード情報を統合解析しました。`);
      }

      window.scrollTo({ top: 320, behavior: 'smooth' });
    } catch (error) {
      console.error('Batch scan failed:', error);
      showAlert('解析エラー', '写真解析に失敗しました。再度お試しください。', 'error');
    } finally {
      setLoading(false);
      setStatus('待機中');
    }
  };

  const openEditDetailsModal = (index: number) => {
    setEditingResultData(results[index]);
    setSelectedResultIndex(index);
    setIsEditDetailsModalOpen(true);
  };

  const saveAllCards = async () => {
    const invalidCards = results.filter(r => !r.name || !r.pack);
    if (invalidCards.length > 0) {
      showAlert('保存できません', `カード名またはパック名が未入力のカードが${invalidCards.length}件あります。`, 'error');
      return;
    }

    const cardsNeedingSubtypeSelection: ScannedCardResult[] = [];
    for (const result of results) {
      if (result.subtype) continue;
      
      const matchingEntries = masterData.filter(m => 
        String(m.name).toLowerCase() === String(result.name).toLowerCase() &&
        (result.pack ? String(m.pack || 'その他').toLowerCase() === String(result.pack).toLowerCase() : true) &&
        Number(m.rank ?? 0) === Number(result.stars ?? 0)
      );

      const availableSubtypes = Array.from(new Set(
        matchingEntries.map((m: MasterCard) => m.subtype)
      )).filter(Boolean);

      if (availableSubtypes.length > 1) {
        cardsNeedingSubtypeSelection.push(result);
      }
    }

    if (cardsNeedingSubtypeSelection.length > 0) {
      const firstCard = cardsNeedingSubtypeSelection[0];
      const cardIndex = results.indexOf(firstCard);
      showAlert('新旧を選択してください', `「${firstCard.name}」など${cardsNeedingSubtypeSelection.length}件のカードで新旧（サブタイプ）を選択してください。`, 'error', () => {
        setEditingResultData(firstCard);
        setSelectedResultIndex(cardIndex);
        setIsSubtypeSelectionScreenOpen(true);
      });
      return;
    }

    if (results.length === 0) {
      showAlert('カードなし', '保存するカードがありません。', 'info');
      return;
    }
    if (!hasProfiles) {
      showAlert('アカウントを選択', '保存先のアプリ内アカウントを選択してください。', 'error');
      return;
    }
    showAlert('保存の確認', `${results.length}件のカードをバインダーに保存しますか？`, 'info', executeSaveConfirmed, closeAlert);
  };

  const executeSaveConfirmed = async () => {
    closeAlert();
    if (results.some(r => !r.name || !r.pack)) return;
    if (results.length === 0) return;

    setLoading(true);
    setStatus('保存中...');
    try {
      const sessionUserId = user?.uid || null;
      rememberUserId(sessionUserId);
      const userId = sessionUserId || getCachedUserId() || 'offline-user';
      let queuedCount = 0;
      
      const customCards: MasterCard[] = results
        .filter((result) => String(result.id || '').startsWith('manual-'))
        .map((result) => ({
          id: `custom-${String(result.id).replace(/^manual-/, '')}`,
          name: result.name,
          pack: result.pack || 'カスタム',
          rank: Number(result.stars ?? 0),
          subtype: result.subtype || '',
          group: result.group || 'custom',
        }));

      if (customCards.length > 0) {
        addCustomMasterCards(customCards);
        setMasterData(getCachedMasterData());
      }

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (!result.name) continue;

        const customCard = customCards.find((card) => card.name === result.name && card.pack === (result.pack || 'カスタム'));
        let cardId = String(customCard?.id || result.id || '');
        const pUid = normalizePUid(result.p_uid || profiles[0]?.id);
        const addQuantity = Math.max(1, Number(result.quantity) || 1);

        if (!cardId || !pUid) continue;

        let currentCount = 0;
        if (isOnline && sessionUserId) {
          const { data: existing } = await supabase
            .from('inventory')
            .select('count')
            .eq('p_uid', pUid)
            .eq('card_id', cardId)
            .maybeSingle();
          currentCount = existing?.count || 0;
        } else {
          const cached = getCachedRawCollection().find(item => String(item.card_id) === cardId && normalizePUid(item.p_uid) === pUid);
          currentCount = Number(cached?.quantity) || 0;
        }

        const totalQuantity = currentCount + addQuantity;

        upsertCachedCollection({
          user_id: userId,
          p_uid: pUid,
          card_id: cardId,
          quantity: totalQuantity,
        });

        if (isOnline && sessionUserId) {
          try {
            const { error } = await supabase.from('inventory').upsert({
              p_uid: pUid,
              card_id: cardId,
              count: totalQuantity,
            }, { onConflict: 'p_uid,card_id' });
            if (error) throw error;
          } catch (error) {
            console.error('Supabase save failed:', (error as Error).message || error);
            queueCollectionChange('upsert', { user_id: userId, p_uid: pUid, card_id: cardId, quantity: totalQuantity });
            queuedCount++;
          }
        } else {
          queueCollectionChange('upsert', { user_id: userId, p_uid: pUid, card_id: cardId, quantity: totalQuantity });
          queuedCount++;
        }
      }

      setIsAllSaved(true);
      setImages([]);
      setResults([]);

      const message = queuedCount > 0
        ? `${queuedCount}件をオフライン保存しました。オンライン復帰時に同期されます。`
        : '全てのカードをBinderに保存しました。';
      
      showAlert('保存完了', message, 'success', () => router.push('/home'));
    } catch (error) {
      console.error('Save confirmed failed:', error);
      showAlert('保存エラー', 'カードの保存中に問題が発生しました。', 'error');
    } finally {
      setLoading(false);
      setStatus('待機中');
    }
  };

  if (!hasMounted) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <div className="flex flex-col max-w-md mx-auto min-h-screen bg-slate-50 pb-36">
        {/* Header */}
        <div className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20 px-6 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <Link
              href="/settings"
              className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100"
            >
              <ChevronLeft size={20} />
            </Link>
            <div className="flex-1 ml-4">
              <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">
                direct add
              </h1>
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-4 space-y-2 px-4">
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest text-center animate-pulse">
              {status} {progress > 0 ? `${progress}%` : ''}
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-4 px-4 pt-4">
          {!hasProfiles && (
            <Link
              href="/settings/profiles"
              className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 shadow-sm active:scale-[0.98] transition-transform"
            >
              <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <AlertCircle size={14} /> アカウント未設定
              </p>
              <p className="text-[10px] font-bold mt-1 opacity-80">保存先のプロファイルを作成してください</p>
            </Link>
          )}

          {/* View Tabs */}
          <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode('capture')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'capture' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'
              }`}
            >
              <Camera size={14} className="inline mr-1.5 -mt-0.5" />
              写真 {images.length > 0 && `(${images.length})`}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('review')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'review' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'
              }`}
            >
              <Layers size={14} className="inline mr-1.5 -mt-0.5" />
              結果 ({results.length})
            </button>
          </div>

          {/* Capture View */}
          {viewMode === 'capture' && ( 
            <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
              {images.length === 0 ? (
                <label className="flex flex-col items-center justify-center py-16 px-6 cursor-pointer group">
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                  <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-200/50 mb-5 group-active:scale-95 transition-transform">
                    <Camera size={32} className="text-white" strokeWidth={2} />
                  </div>
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">写真を追加</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">タップして選択 · 複数枚OK</p>
                </label>
              ) : (
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative aspect-[3/4] rounded-2xl overflow-hidden group">
                        <Image src={img} fill unoptimized className="object-cover" alt={`写真 ${idx + 1}`} />
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 bg-slate-900/80 text-white p-1.5 rounded-full active:scale-90"
                        >
                          <X size={12} strokeWidth={2.5} />
                        </button>
                        <span className="absolute bottom-2 left-2 bg-black/50 text-white text-[8px] font-black px-2 py-0.5 rounded-full">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                    <label className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-colors active:scale-95">
                      <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                      <Plus size={28} />
                      <span className="text-[9px] font-black uppercase tracking-widest mt-2">追加</span>
                    </label>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Review View */}
          {viewMode === 'review' && ( 
            <section className="space-y-3">
              {results.length > 0 ? (
                <>
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-900 text-white rounded-xl px-4 py-3">
                        <p className="text-[8px] font-black uppercase tracking-widest text-white/50">検出</p>
                        <p className="text-xl font-black italic leading-none">{results.length}<span className="text-[10px] font-bold text-white/50 ml-1">種</span></p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">合計枚数</p>
                        <p className="text-xl font-black italic text-blue-600 leading-none">{totalResultQty}<span className="text-[10px] font-bold text-slate-400 ml-1">枚</span></p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => showAlert('確認', '全ての解析結果を削除しますか？', 'info', () => { setResults([]); setViewMode('capture'); closeAlert(); }, closeAlert)}
                      className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {results.map((result, index) => {
                      const isIdManual = String(result.id || '').startsWith('manual-');
                      const matchingEntries = masterData.filter(m => 
                        String(m.name).toLowerCase() === String(result.name).toLowerCase() &&
                        (result.pack ? String(m.pack || 'その他').toLowerCase() === String(result.pack).toLowerCase() : true) &&
                        Number(m.rank ?? 0) === Number(result.stars ?? 0)
                      );
                      const availableSubtypes = isIdManual ? [] : Array.from(new Set(
                        matchingEntries.map((m: MasterCard) => m.subtype)
                      )).filter(Boolean);
                      
                      const isSubtypeMissing = !result.subtype && availableSubtypes.length > 1;

                      return (
                        <ResultEditCard
                          key={`${result.id}-${result.date}-${index}`}
                          data={result}
                          onRemove={() => removeResult(index)}
                          onClick={() => openEditDetailsModal(index)}
                          profiles={profiles}
                          activeProfileId={result.p_uid || dbProfiles[0]?.id || profiles[0]?.id || null}
                          onProfileChange={(newProfileId) => updateResult(index, 'p_uid', newProfileId)}
                          isSubtypeMissing={isSubtypeMissing}
                        />
                      );
                    })}
                  </div>

                  {/* 下部固定バーとの被りを防ぐための底上げ用スペーサー */}
                  <div className="h-28" />
                </>
              ) : (
                <div className="py-20 text-center space-y-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                  <div className="inline-flex p-6 bg-slate-50 rounded-[2rem] text-slate-300">
                    <Layers size={32} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    解析結果がありません
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Bottom Action Dock */}
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
          <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-[2rem] p-2 flex gap-2">
            {viewMode === 'capture' && images.length > 0 ? (
              <button
                type="button"
                onClick={handleBatchScan}
                disabled={loading}
                className="flex-1 h-14 rounded-2xl bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-blue-200"
              >
                <Sparkles size={16} /> AIスキャン開始 ({images.length}枚)
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={addManualCard}
                  disabled={!hasProfiles}
                  className={`h-14 px-6 rounded-[1.5rem] bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-40 transition-all ${results.length === 0 ? 'flex-1' : ''}`}
                >
                  <Edit3 size={16} /> 手動追加
                </button>
                {results.length > 0 && (
                  <button
                    type="button"
                    onClick={saveAllCards}
                    disabled={loading || isAllSaved || results.some(r => !r.name || !r.pack)}
                    className={`flex-1 h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                      isAllSaved ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    }`}
                  >
                    <Save size={16} /> {isAllSaved ? '保存完了' : 'Binderに一括保存'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 1. 詳細編集用モーダル */}
        {isEditDetailsModalOpen && editingResultData && selectedResultIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Edit3 size={16} className="text-blue-500" /> カード情報の編集
                </h3>
                <button type="button" onClick={() => { setIsEditDetailsModalOpen(false); setEditingResultData(null); }} className="text-slate-400 hover:text-slate-600 p-1">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">カード名</label>
                  <input
                    type="text"
                    value={editingResultData.name}
                    onChange={(e) => setEditingResultData({ ...editingResultData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="カード名を入力"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">パック名・シリーズ名</label>
                  <input
                    type="text"
                    value={editingResultData.pack}
                    onChange={(e) => setEditingResultData({ ...editingResultData, pack: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="パック名を入力"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">点数 (星の数)</label>
                    <select
                      value={editingResultData.stars}
                      onChange={(e) => setEditingResultData({ ...editingResultData, stars: Number(e.target.value) })}
                      className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      {CONFIG.ranks.map(r => <option key={r} value={r}>{r}点</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">数量 (枚数)</label>
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                      <button type="button" onClick={() => setEditingResultData({ ...editingResultData, quantity: Math.max(1, editingResultData.quantity - 1) })} className="px-3 py-3 text-slate-500 font-bold hover:bg-slate-100 active:scale-95">-</button>
                      <span className="flex-1 text-center text-xs font-black text-slate-900">{editingResultData.quantity}</span>
                      <button type="button" onClick={() => setEditingResultData({ ...editingResultData, quantity: editingResultData.quantity + 1 })} className="px-3 py-3 text-slate-500 font-bold hover:bg-slate-100 active:scale-95">+</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => updateResult(selectedResultIndex, 'all', editingResultData, true)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-md transition-colors"
                >
                  反映する
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. 新旧（サブタイプ）選択用画面モーダル */}
        {isSubtypeSelectionScreenOpen && editingResultData && selectedResultIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="p-6 text-center border-b border-slate-100">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Award size={24} />
                </div>
                <h3 className="text-sm font-black text-slate-900">新旧（サブタイプ）の選択</h3>
                <p className="text-[11px] font-medium text-slate-400 mt-1">「{editingResultData.name}」には複数のバージョンがあります。どちらのカードか選択してください。</p>
              </div>
              <div className="p-4 max-h-60 overflow-y-auto space-y-2 bg-slate-50/50">
                {Array.from(new Set(
                  masterData
                    .filter(m => String(m.name).toLowerCase() === String(editingResultData.name).toLowerCase() && Number(m.rank ?? 0) === Number(editingResultData.stars ?? 0))
                    .map(m => m.subtype)
                )).filter(Boolean).map((subtype) => (
                  <button
                    key={subtype}
                    type="button"
                    onClick={() => {
                      updateResult(selectedResultIndex, 'subtype', subtype);
                      setIsSubtypeSelectionScreenOpen(false);
                      setEditingResultData(null);
                    }}
                    className="w-full p-4 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-left text-xs font-black text-slate-800 shadow-sm flex items-center justify-between group active:scale-[0.99] transition-all"
                  >
                    <span>{subtype}</span>
                    <Check size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    updateResult(selectedResultIndex, 'subtype', 'その他');
                    setIsSubtypeSelectionScreenOpen(false);
                    setEditingResultData(null);
                  }}
                  className="w-full py-2.5 bg-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-slate-300 transition-colors"
                >
                  スキップ（その他にする）
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Alerts */}
        {alertConfig.isOpen && (
          <CustomAlert
            isOpen={alertConfig.isOpen}
            title={alertConfig.title}
            message={alertConfig.message}
            type={alertConfig.type}
            onConfirm={alertConfig.onConfirm}
            onCancel={alertConfig.onCancel}
            onClose={closeAlert}
          />
        )}
        {customAlert && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
            {customAlert}
          </div>
        )}
    </div>
  );
}

function ResultEditCard({ data, onRemove, onClick, profiles, activeProfileId, onProfileChange, isSubtypeMissing }: any) {
  return (
    <div className={`p-4 bg-white border rounded-2xl flex items-center justify-between shadow-sm ${isSubtypeMissing ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200/60'}`}>
      <div onClick={onClick} className="cursor-pointer flex items-center gap-3 flex-1 min-w-0">
        <div className="relative w-12 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
          {data.croppedImg ? (
            <Image src={data.croppedImg} fill unoptimized className="object-cover" alt={data.name} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300"><Box size={16} /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-slate-900 truncate">{data.name || '未入力のカード'}</p>
          <p className="text-[10px] font-bold text-slate-400 truncate">{data.pack || 'パック未指定'}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">点数: {data.stars}</span>
            {isSubtypeMissing && (
              <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-500 text-white rounded animate-pulse">要新旧選択</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 ml-2">
        {profiles.length > 1 && (
          <select
            value={activeProfileId || ''}
            onChange={(e) => onProfileChange(e.target.value)}
            className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-600 focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {profiles.map((p: any) => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black px-2 py-1 bg-slate-100 rounded-lg">x{data.quantity}</span>
          <button 
            type="button" 
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }} 
            className="p-2 text-slate-300 hover:text-red-500 rounded-xl"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}