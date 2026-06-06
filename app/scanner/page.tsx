'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { analyzeCard } from './utils';
import Image from 'next/image';
import { resolveCardDisplay } from '../components/utils';
import { supabase } from '../supabase';
import { ensureProfiles } from '../profileStore';
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
} from '../offline';

const fetchWithTimeout = async (input: RequestInfo, init: RequestInit = {}, timeoutMs = 20000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};
import { CustomAlert } from '../components/CustomAlert';
import { useAuth } from '../../AuthContext';
import {
  AlertCircle,
  Box,
  Camera,
  Award,
  Check,
  ChevronLeft,
  Cloud,
  CloudOff,
  Edit3,
  Layers,
  Plus,
  Save,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
} from 'lucide-react';

// --- Start of new interfaces ---
interface Profile {
  id: string;
  display_name: string;
  // Add other profile properties if they exist
}

interface MasterCard {
  id: string;
  name: string;
  pack?: string;
  rank?: number; // Assuming 'stars' in results maps to 'rank' in masterData
  subtype?: string;
  group?: string;
  image?: string; // For croppedImg
  image_url?: string; // For croppedImg
  // Add other master card properties
}

interface ScannedCardResult {
  id: string;
  name: string;
  group: string;
  pack: string;
  stars: number; // Or rank
  subtype: string;
  quantity: number;
  croppedImg: string;
  sourceImage?: string; // ユーザーが入力した元画像
  date: number; // Timestamp
  p_uid: string | null; // Profile User ID
  // Add other properties that might be in the result
}

interface AlertConfigState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'info' | 'error' | 'success';
  onConfirm?: () => void;
  onCancel?: () => void;
}
// --- End of new interfaces ---

const CONFIG = {
  gasUrl: 'https://script.google.com/macros/s/AKfycbzE912QE7aAjrxboaW8jLnjJ-tTW7JzePfkREe3vpnTYMsghP4eRMWd_cEK3ffLQn3w4Q/exec',
  ranks: [0, 2, 3, 4, 5],
};

export default function ScannerPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [images, setImages] = useState<string[]>([]);
  const [results, setResults] = useState<ScannedCardResult[]>([]); // Use ScannedCardResult[]
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('待機中');
  const [masterData, setMasterData] = useState<MasterCard[]>([]); // Use MasterCard[]
  const [isAllSaved, setIsAllSaved] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]); // Use Profile[]
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null); // 候補選択用
  const [isEditDetailsModalOpen, setIsEditDetailsModalOpen] = useState(false); // 詳細編集モーダル
  const [isSubtypeSelectionScreenOpen, setIsSubtypeSelectionScreenOpen] = useState(false); // サブタイプ選択画面
  const [editingResultData, setEditingResultData] = useState<ScannedCardResult | null>(null); // Use ScannedCardResult | null

  const [alertConfig, setAlertConfig] = useState<AlertConfigState>({ // Use AlertConfigState
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
  const canUseAiScan = Boolean(
    process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY &&
    process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_CARD &&
    process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_STAR
  );

  useEffect(() => {
    setHasMounted(true);
    const cached = getCachedMasterData() as MasterCard[]; // Cast to MasterCard[]
    setMasterData(cached);
    setProfiles(getCachedProfiles() as Profile[]); // Cast to Profile[]
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
          try { // Explicitly type profileList
            const profileList = await ensureProfiles(userId) as Profile[]; // Cast to Profile[]
            setCachedProfiles(profileList);
            setProfiles(profileList);
          } catch (error) {
            console.error('Profile sync failed:', error);
          }
        }

        const res = await fetchWithTimeout(CONFIG.gasUrl);
        const data = await res.json(); // Data from GAS is likely MasterCard[]
        const filtered = data.filter((card: MasterCard) => card.name && !['名前', 'name'].includes(card.name.toLowerCase())); // Use MasterCard
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

  // customAlertを自動で消すためのuseEffect
  useEffect(() => {
    if (customAlert) {
      const timer = setTimeout(() => {
        setCustomAlert(null);
      }, 3000); // 3秒後に自動で消える
      return () => clearTimeout(timer); // クリーンアップ
    }
  }, [customAlert]);

  // Results changed: check if any card has multiple subtypes and force selection
  useEffect(() => {
    // Only check if we're not currently in edit mode and not loading
    if (loading || isSubtypeSelectionScreenOpen) return;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      
      // Only check cards that don't have a subtype selected yet
      if (result.subtype) continue;

      const matchingEntries = masterData.filter(m => 
        String(m.name).toLowerCase() === String(result.name).toLowerCase() &&
        (result.pack ? String(m.pack || 'その他').toLowerCase() === String(result.pack).toLowerCase() : true) &&
        Number(m.rank ?? 0) === Number(result.stars ?? 0)
      );

      const availableSubtypesForCard = Array.from(new Set(
        matchingEntries.map((m: MasterCard) => m.subtype)
      )).filter(Boolean);

      // 同一のカード名・パック・ランクで複数のサブタイプ候補が存在する場合のみ、選択画面を表示
      if (availableSubtypesForCard.length > 1) {
        setEditingResultData(result);
        setSelectedResultIndex(i);
        setIsSubtypeSelectionScreenOpen(true);
        break; // Only open screen for first card with multiple subtypes
      }
    }
  }, [results, masterData, loading, isSubtypeSelectionScreenOpen]);

  const syncMasterData = async () => {
    if (!getOnlineStatus()) {
      showAlert('Offline Mode', 'オンライン時にカードデータを同期してください。', 'info');
      return;
    }

    setLoading(true);
    setStatus('カードデータ同期中...');
    try {
      const res = await fetchWithTimeout(CONFIG.gasUrl);
      const data = await res.json();
      const filtered = data.filter((card: MasterCard) => card.name && !['名前', 'name'].includes(String(card.name).toLowerCase())); // Use MasterCard
      setCachedMasterData(filtered);
      setMasterData(getCachedMasterData());
      showAlert('同期完了', 'カードデータを同期しました。', 'success');
    } catch (error) {
      console.error('Master sync failed:', error);
      showAlert('Sync Error', 'カードデータの同期に失敗しました。' + (error instanceof Error ? error.message : ''), 'error'); // More specific error
    } finally {
      setLoading(false);
      setStatus('待機中');
    }
  };

  const updateResult = (index: number, field: string, value: any, closeEditModal: boolean = false) => {
    const next: ScannedCardResult[] = [...results]; // Use ScannedCardResult[]
    if (field === 'all' && value !== undefined && value !== null) { // Ensure value is not null/undefined when updating all
      next[index] = { ...next[index], ...value };
      // If updating all, also update the editingResultData if the modal is open
      if (isEditDetailsModalOpen && editingResultData && editingResultData.date === next[index].date) {
        setEditingResultData(next[index]);
      }
    } else {
      next[index] = { ...next[index], [field]: value };
    }

    // 名前、パック、ランクのいずれかが変更された場合、3要素の完全一致を確認
    if (['name', 'pack', 'stars', 'subtype', 'all'].includes(field)) { // Typo: editingData -> editingResultData
      const current = next[index]; // Typo: editingData -> editingResultData
      const match = masterData.find((m: MasterCard) => // Use MasterCard
        String(m.name).toLowerCase() === String(current.name || '').toLowerCase() &&
        String(m.pack || 'その他').toLowerCase() === String(current.pack || 'その他').toLowerCase() &&
        Number(m.rank ?? 0) === Number(current.stars ?? 0) &&
        (!current.subtype || String(m.subtype || '').toLowerCase() === String(current.subtype).toLowerCase())
      );

      if (match) {
        next[index] = {
          ...next[index],
          name: match.name,
          id: match.id, // Ensure id is string
          group: match.group || '', // Ensure group is string
          pack: match.pack || 'その他',
          stars: match.rank ?? 0,
          subtype: match.subtype || '',
          croppedImg: match.image_url || match.image || next[index].croppedImg
        };
      } else if (field === 'name' && current.name) {
        const nameMatch = masterData.find((m: MasterCard) => String(m.name).toLowerCase() === String(current.name).toLowerCase());// Use MasterCard
        if (nameMatch) {
          next[index] = {
            ...next[index],
            name: nameMatch.name,
            id: nameMatch.id, // Ensure id is string
            group: nameMatch.group || '', // Ensure group is string
            pack: nameMatch.pack || 'その他',
            stars: nameMatch.rank ?? 0,
            subtype: nameMatch.subtype || '',
            croppedImg: nameMatch.image_url || nameMatch.image || next[index].croppedImg
          };
        } else {
          next[index].id = `manual-${Date.now()}`;
        }
      } else if (field !== 'all') { // Typo: editingData -> editingResultData
        if (!String(next[index].id).startsWith('manual-')) {
          next[index].id = `manual-${Date.now()}`;
        }
      }
    }

    setResults(next);
    if (closeEditModal) { // Close modal if requested, regardless of current state
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
      showAlert('AI解析は設定不足', 'Roboflow の環境変数が未設定です。手動追加を使用してください。', 'info');
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
        const parsed = await analyzeCard(images[i], masterData) as ScannedCardResult[]; // Cast to ScannedCardResult[]
        
        if (parsed.length > 0) {
          totalFoundCount += parsed.length;
          setViewMode('review'); // 最初の1枚が見つかった時点で結果画面へ切り替え
          setResults((prev) => {
            const consolidatedResults = new Map<string, ScannedCardResult>();
            prev.forEach(res => consolidatedResults.set(res.id, { ...res }));
            
            parsed.forEach(newCard => {
              const addQty = 1; // 各検出を1枚として扱う
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
        setCustomAlert(`${totalFoundCount}件を解析しました。`);
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
    setIsEditDetailsModalOpen(true); // Ensure modal opens
  };

  const saveAllCards = async () => {
    const invalidCards = results.filter(r => !r.name || !r.pack);
    if (invalidCards.length > 0) {
      showAlert('保存できません', `カード名またはパック名が未入力のカードが${invalidCards.length}件あります。`, 'error');
      return;
    }

    // Check for cards with multiple subtypes but no subtype selected
    const cardsNeedingSubtypeSelection: ScannedCardResult[] = [];
    for (const result of results) {
      if (result.subtype) continue; // Skip if subtype is already selected
      
      const matchingEntries = masterData.filter(m => 
        String(m.name).toLowerCase() === String(result.name).toLowerCase() &&
        (result.pack ? String(m.pack || 'その他').toLowerCase() === String(result.pack).toLowerCase() : true) &&
        Number(m.rank ?? 0) === Number(result.stars ?? 0)
      );

      const availableSubtypes = Array.from(new Set(
        matchingEntries.map((m: MasterCard) => m.subtype)
      )).filter(Boolean);

      // 保存前に、サブタイプの選択が必須なカード（同一条件で複数候補があるもの）をチェック
      if (availableSubtypes.length > 1) {
        cardsNeedingSubtypeSelection.push(result);
      }
    }

    // If there are cards needing subtype selection, show error and open selection screen for first one
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
      // Removed unused 'saved' variable
      const customCards: MasterCard[] = results // Use MasterCard[]
        .filter((result) => String(result.id || '').startsWith('manual-'))
        .map((result) => ({
          id: `custom-${String(result.id).replace(/^manual-/, '')}`,
          name: result.name,
          pack: result.pack || 'カスタム',
          rank: Number(result.stars ?? 0), // Ensure rank is number
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

        // 必須データの欠落チェック
        if (!cardId || !pUid) {
          console.error('Missing cardId or pUid for result:', result);
          continue;
        }

        // オンラインなら最新の数値をDBから取得して加算、オフラインならキャッシュから計算
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
            console.error('Supabase save failed:', (error as Error).message || error); // Explicitly type error
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

  const currentStep = results.length > 0 ? 3 : images.length > 0 ? 2 : 1;

  return (
    <div className="flex flex-col max-w-md mx-auto min-h-screen">
        {/* Header */}
        <div className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20 px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/settings"
              className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100"
            >
              <ChevronLeft size={20} />
            </Link>
            <div className="flex-1 ml-4">
              <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">
                カード自動追加
              </h1>
            </div>
          </div>
        </div>

        {loading && progress > 0 && (
          <div className="mt-4 space-y-2 px-1">
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest text-center animate-pulse">{status} {progress}%</p>
          </div>
        )}

        {/* Main content starts here */}
        <div className="space-y-4 pt-4">

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
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-200/50 mb-5 group-active:scale-95 transition-transform">
                  <Camera size={32} className="text-white" strokeWidth={2} />
                </div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">写真を追加</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">タップして選択 · 複数枚OK</p>
              </label>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  {images.map((img, idx) => ( // Image previews
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
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
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
                    // 新旧選択が必要かどうかを親で判断して表示フラグを計算
                    const isIdManual = String(result.id || '').startsWith('manual-');
                    const matchingEntries = masterData.filter(m => 
                      String(m.name).toLowerCase() === String(result.name).toLowerCase() &&
                      (result.pack ? String(m.pack || 'その他').toLowerCase() === String(result.pack).toLowerCase() : true) &&
                      Number(m.rank ?? 0) === Number(result.stars ?? 0)
                    );
                    const availableSubtypes = isIdManual ? [] : Array.from(new Set(
                      matchingEntries.map((m: MasterCard) => m.subtype)
                    )).filter(Boolean);
                    
                    // リスト上でも、名・パック・ランクが一致した上で候補が複数ある場合のみ「要選択」を表示
                    const isSubtypeMissing = !result.subtype && availableSubtypes.length > 1;

                    return (
                      <ResultEditCard
                        key={`${result.id}-${result.date}-${index}`}
                        data={result}
                        onRemove={() => removeResult(index)}
                        onClick={() => openEditDetailsModal(index)}
                        profiles={profiles}
                        activeProfileId={dbProfiles[0]?.id || null}
                        onProfileChange={(newProfileId) => updateResult(index, 'p_uid', newProfileId)}
                        isSubtypeMissing={isSubtypeMissing}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-20 text-center space-y-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-2">
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
        </div> {/* End of main content div */}

      {/* Bottom Action Dock */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40 animate-in slide-in-from-bottom-8 duration-500">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-[2rem] p-2 flex gap-2">
          {viewMode === 'review' ? (
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
                    isAllSaved ? 'bg-emerald-500 text-white shadow-emerald-200' : 
                    results.some(r => !r.name || !r.pack) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                    'bg-slate-900 text-white shadow-lg shadow-slate-200'
                  }`}
                >
                  {isAllSaved ? <><Check size={18} /> 保存完了</> : <><Save size={18} /> {results.length}件を保存</>}
                </button>
              )}
            </>
          ) : (
              <button
                type="button"
                onClick={handleBatchScan}
                disabled={images.length === 0 || loading || !canUseAiScan}
                className="flex-1 h-14 rounded-[1.5rem] bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-200/50 active:scale-[0.98] disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all"
              >
                <Sparkles size={18} className={loading ? 'animate-pulse' : ''} />
                {images.length > 0 ? `${images.length}枚をAI解析` : 'AI解析'}
              </button>
          )}
        </div>
      </div>

      {customAlert && (
        <div className="fixed top-24 left-4 right-4 max-w-md mx-auto z-[100] bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between animate-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-blue-400" />
            <p className="text-[10px] font-black uppercase tracking-widest">{customAlert}</p>
          </div>
          <button type="button" onClick={() => setCustomAlert(null)} className="text-white/40 p-1"><X size={16} /></button>
        </div>
      )}

      <CustomAlert 
        isOpen={alertConfig.isOpen}
        onClose={closeAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
      />

      {/* 詳細編集モーダル */}
      {isEditDetailsModalOpen && selectedResultIndex !== null && editingResultData && (
        <EditCardDetailsModal
          isOpen={isEditDetailsModalOpen}
          onClose={() => setIsEditDetailsModalOpen(false)}
          cardData={editingResultData}
          masterData={masterData}
          profiles={profiles}
          onSave={(updated) => updateResult(selectedResultIndex, 'all', updated, true)}
          loading={loading}
        />
      )}

      {/* サブタイプ選択画面 */}
      {isSubtypeSelectionScreenOpen && selectedResultIndex !== null && editingResultData && (
        <SubtypeSelectionScreen
          isOpen={isSubtypeSelectionScreenOpen}
          onClose={() => {
            setIsSubtypeSelectionScreenOpen(false);
            setEditingResultData(null);
            setSelectedResultIndex(null);
          }}
          cardData={editingResultData}
          masterData={masterData}
          onSelect={(subtype) => {
            updateResult(selectedResultIndex, 'subtype', subtype);
            setIsSubtypeSelectionScreenOpen(false);
            setEditingResultData(null);
            setSelectedResultIndex(null);
          }}
        />
      )}
    </div>
  );
}

interface ResultEditCardProps { // Simplified for list view
  data: ScannedCardResult; // Use ScannedCardResult
  // masterData, onUpdate are not needed for display-only version
  profiles: Profile[]; // Use Profile[]
  activeProfileId: string | null; // For default profile selection
  onProfileChange: (newProfileId: string) => void; // Callback for profile change
  onRemove: () => void;
  onClick: () => void;
  isSubtypeMissing?: boolean;
}

function ResultEditCard({ data, onRemove, onClick, profiles, activeProfileId, onProfileChange, isSubtypeMissing }: ResultEditCardProps) {
  const display = resolveCardDisplay(data);
  const isIdManual = String(data.id || '').startsWith('manual-');
  const thumbSrc = data.sourceImage || data.croppedImg;
  const dbProfiles = profiles.filter((p) => !String(p.id).startsWith('local-profile-'));
  const selectedProfileId = dbProfiles.some((p) => p.id === String(data.p_uid || activeProfileId))
    ? String(data.p_uid || activeProfileId)
    : dbProfiles[0]?.id || '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={`group relative flex items-stretch gap-3 rounded-2xl border overflow-hidden transition-all active:scale-[0.98] cursor-pointer shadow-sm hover:shadow-md 
        ${isIdManual ? 'bg-rose-50/30 border-rose-100' : 'bg-white border-slate-100'}
        ${isSubtypeMissing || !data.name || !data.pack ? 'border-amber-300 ring-1 ring-amber-100' : ''}
      `}
    >
      {/* Left accent line */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
        isIdManual ? 'bg-rose-400/60' : 'bg-blue-500/60'
      }`} />

      {/* サムネイル */}
      <div className="w-[72px] flex-shrink-0 bg-slate-100 relative ml-1.5">
        {thumbSrc ? (
          <Image src={thumbSrc} fill unoptimized className="object-cover rounded-l-lg" alt={data.name} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-200">
            <Layers size={20} />
          </div>
        )}
        {isSubtypeMissing && (
          <span className="absolute top-1 left-1 bg-amber-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
            要選択
          </span>
        )}
      </div>

      {/* 情報 */}
      <div className="flex-1 min-w-0 py-3 pr-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-[13px] font-black uppercase tracking-tight leading-tight truncate ${display.isUnknown || isIdManual || !data.name || !data.pack ? 'text-rose-600' : 'text-slate-900'}`}>
            {!data.name ? 'カード名未入力' : !data.pack ? 'パック未入力' : (
              <>
                {isIdManual ? data.name : display.name}
                {data.subtype && <span className="ml-1.5 text-blue-500/70 font-bold">({data.subtype})</span>}
              </>
            )}
          </h3>
          <span className="flex-shrink-0 text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
            x{data.quantity || 1}
          </span>
        </div>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate mt-0.5">{data.pack || 'その他'}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {data.stars > 0 && (
            <div className="flex items-center gap-0.5 text-amber-400">
              {Array.from({ length: Math.min(5, data.stars) }).map((_, i) => ( // Star rating
                <Star key={i} size={11} fill="currentColor" strokeWidth={0} />
              ))}
            </div>
          )}
          {data.subtype && (
            <span className="text-[7px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider">{data.subtype}</span>
          )}
          {isIdManual && (
            <span className="text-[8px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">未照合</span>
          )}
        </div>
      </div>

      {/* アクション */}
      <div className="flex flex-col justify-between py-2 pr-2" onClick={(e) => e.stopPropagation()}>
        {dbProfiles.length > 1 ? (
          <select
            value={selectedProfileId}
            onChange={(e) => onProfileChange(e.target.value)}
            className="bg-slate-50 text-slate-500 text-[8px] font-black uppercase tracking-wider px-2 py-1.5 rounded-xl border border-slate-100 max-w-[72px] truncate"
          >
            {dbProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        ) : (
          <div className="h-6" /> // 1つしかない場合は何も表示しない（またはラベルにする）
        )}
        <button
          type="button"
          onClick={onRemove}
          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl self-end transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

interface EditCardDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardData: ScannedCardResult; // Use ScannedCardResult
  masterData: MasterCard[]; // Use MasterCard[]
  profiles: Profile[]; // Use Profile[]
  onSave: (updatedData: ScannedCardResult) => void; // Use ScannedCardResult
  loading: boolean; // Add loading to props interface
}

function EditCardDetailsModal({ isOpen, onClose, cardData, masterData, profiles, onSave, loading }: EditCardDetailsModalProps) {
  const [editingData, setEditingData] = useState<ScannedCardResult>(cardData); // Use ScannedCardResult

  const findCardMatch = (name?: string, pack?: string, rank?: number) => {
    const normalizedName = String(name || '').toLowerCase();
    const normalizedPack = String(pack || '').toLowerCase();
    const exact = masterData.find(m =>
      String(m.name || '').toLowerCase() === normalizedName &&
      (!pack || String(m.pack || 'その他').toLowerCase() === normalizedPack) &&
      (rank === undefined || Number(m.rank ?? 0) === Number(rank))
    );
    if (exact) return exact;

    return masterData.find(m =>
      String(m.name || '').toLowerCase() === normalizedName &&
      (!pack || String(m.pack || 'その他').toLowerCase() === normalizedPack)
    ) || null;
  };

  const filteredNames = useMemo(() => {
    let data = masterData;
    if (editingData.pack) {
      data = data.filter(m => (m.pack || 'その他') === editingData.pack);
    }
    return Array.from(new Set(data.map((card: MasterCard) => card.name).filter(Boolean))).sort(); // Use MasterCard
  }, [editingData.pack, masterData]);

  const filteredPacks = useMemo(() => {
    let data = masterData;
    if (editingData.name) {
      data = data.filter(m => String(m.name).toLowerCase() === String(editingData.name).toLowerCase());
    }
    return Array.from(new Set(data.map((card: MasterCard) => card.pack || 'その他'))).sort(); // Use MasterCard
  }, [editingData.name, masterData]);

  const availableRanks = useMemo(() => {
    if (!editingData.name || !editingData.pack) return [];
    return Array.from(new Set(
      masterData
        .filter(m => 
          String(m.name).toLowerCase() === String(editingData.name).toLowerCase() && // Use MasterCard
          String(m.pack || 'その他').toLowerCase() === String(editingData.pack).toLowerCase() // Use MasterCard
        )
        .map((m: MasterCard) => Number(m.rank ?? 0)) // Use MasterCard
    )).sort((a, b) => a - b);
  }, [editingData.name, editingData.pack, masterData]);

  const availableSubtypes = useMemo(() => {
    if (!editingData.name || editingData.stars === undefined) return [];
    return Array.from(new Set(
      masterData
        .filter(m => 
          String(m.name).toLowerCase() === String(editingData.name).toLowerCase() && // Use MasterCard
          (editingData.pack ? String(m.pack || 'その他').toLowerCase() === String(editingData.pack).toLowerCase() : true) &&
          Number(m.rank ?? 0) === Number(editingData.stars ?? 0)
        )
        .map((m: MasterCard) => m.subtype) // Use MasterCard
    )).filter(Boolean).sort() as string[];
  }, [editingData.name, editingData.pack, editingData.stars, masterData]);

  useEffect(() => {
    setEditingData(cardData); // Update if cardData changes from parent (e.g., candidate selection)
  }, [cardData]);

  if (!isOpen) return null;

  const display = resolveCardDisplay(editingData);
  const isNameEmpty = !editingData.name || editingData.name.trim() === '';
  const isIdManual = String(editingData.id).startsWith('manual-');

  const handleNameChange = (name: string) => {
    setEditingData(prev => {
      const nextName = name;
      const matches = nextName ? masterData.filter((m: MasterCard) => String(m.name).toLowerCase() === nextName.toLowerCase()) : []; // Use MasterCard

      let nextPack = prev.pack;
      // 現在のパックが新しい名前に対して有効でない場合はリセット
      if (nextName && nextPack && !matches.some(m => (m.pack || 'その他') === nextPack)) {
        nextPack = '';
      }

      // その名前が1つのパックにしか存在しない場合は自動選択
      if (nextName && !nextPack) {
        const uniquePacks = Array.from(new Set(matches.map(m => m.pack || 'その他')));
        if (uniquePacks.length === 1) nextPack = uniquePacks[0] as string;
      }

      const tripletMatch = findCardMatch(nextName, nextPack || undefined, Number(prev.stars ?? 0));

      return {
        ...prev,
        name: nextName,
        pack: tripletMatch ? (tripletMatch.pack || 'その他') : nextPack || '', // Ensure pack is string
        id: tripletMatch ? tripletMatch.id : `manual-${Date.now()}`,
        stars: tripletMatch ? (tripletMatch.rank ?? 0) : prev.stars,
        subtype: tripletMatch ? (tripletMatch.subtype || '') : '',
        group: tripletMatch ? (tripletMatch.group || '') : prev.group, // Ensure group is string
        croppedImg: tripletMatch ? (tripletMatch.image_url || tripletMatch.image || prev.croppedImg) : prev.croppedImg,
      };
    });
  };

  const handlePackChange = (pack: string) => {
    setEditingData(prev => {
      const nextPack = pack;
      const matches = nextPack ? masterData.filter((m: MasterCard) => (m.pack || 'その他') === nextPack) : []; // Use MasterCard
      let nextName = prev.name;
      // 現在の名前が新しいパックに含まれない場合はリセット
      if (nextPack && nextName && !matches.some(m => String(m.name).toLowerCase() === nextName.toLowerCase())) {
        nextName = '';
      }

      // パック内に1種類のカード名しかない場合は自動選択
      if (nextPack && !nextName) {
        const uniqueNamesInPack = Array.from(new Set(matches.map(m => m.name)));
        if (uniqueNamesInPack.length === 1) nextName = uniqueNamesInPack[0];
      }

      const tripletMatch = findCardMatch(nextName, nextPack, Number(prev.stars ?? 0));

      return {
        ...prev,
        name: nextName,
        pack: nextPack, // Ensure name is string
        id: tripletMatch ? tripletMatch.id : `manual-${Date.now()}`,
        stars: tripletMatch ? (tripletMatch.rank ?? 0) : prev.stars,
        subtype: tripletMatch ? (tripletMatch.subtype || '') : '',
        group: tripletMatch ? (tripletMatch.group || '') : prev.group, // Ensure group is string
        croppedImg: tripletMatch ? (tripletMatch.image_url || tripletMatch.image || prev.croppedImg) : prev.croppedImg,
      };
    });
  };

  const handleSubtypeChange = (subtype: string) => {
    const match = masterData.find((m: MasterCard) => // Use MasterCard
      String(m.name).toLowerCase() === String(editingData.name).toLowerCase() &&
      String(m.pack || 'その他').toLowerCase() === String(editingData.pack || 'その他').toLowerCase() &&
      Number(m.rank ?? 0) === Number(editingData.stars ?? 0) &&
      String(m.subtype || '').toLowerCase() === String(subtype).toLowerCase()
    );

    setEditingData(prev => ({
      ...prev,
      subtype: subtype, // Set the selected subtype
      ...(match ? {
        id: match.id,
        name: match.name,
        pack: match.pack || 'その他',
        stars: match.rank ?? 0,
        group: match.group || '', // Ensure group is string
        croppedImg: match.image_url || match.image || prev.croppedImg, // Update image if available
      } : {})
    }));
  };

  const handleReset = () => {
    setEditingData(prev => ({
      ...prev,
      name: '',
      pack: '',
      subtype: '',
      stars: 0,
      id: `manual-${Date.now()}`
    }));
  };

  const saveButtonDisabled = isNameEmpty;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-7 space-y-7 animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-400">
        <div className="flex justify-between items-center">
          <h3 className="text-[15px] font-black italic text-slate-900 uppercase tracking-tighter flex items-center gap-2"><Edit3 size={18} className="text-blue-500"/> Card Editor</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleReset}
              className="p-2.5 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors active:scale-95"
              title="選択をリセット"
            >
              <RotateCcw size={18} />
            </button>
            <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-colors active:scale-95">
              <X size={18} strokeWidth={3}/>
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 ml-1">
              <Search size={12} className="text-blue-500" /> カード名
            </label>
            <select
              value={masterData.length > 0 ? (editingData.name || '') : ''}
              disabled={loading}
              onChange={(e) => handleNameChange(e.target.value)}
              hidden={masterData.length === 0}
              className={`w-full bg-slate-50 border-2 rounded-2xl px-5 py-4 text-[13px] font-black outline-none transition-all appearance-none
                ${isIdManual 
                  ? 'border-rose-100 text-rose-600 focus:border-rose-300'
                  : 'border-transparent text-slate-900 focus:border-blue-300 focus:bg-white'
                }`}
            >
              <option value="" className="!bg-white !text-slate-900 font-bold">選択してください</option>
              {filteredNames.map(name => (
                <option key={name} value={name} className="!bg-white !text-slate-900">{name}</option>
              ))}
            </select>
          </div> {/* End of card name input */}
          {isIdManual && (
            <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.1em] px-2 flex items-center gap-2 opacity-80">
              <AlertCircle size={11} strokeWidth={3} /> {isNameEmpty ? 'カード名を入力してください' : '一致データがありません'}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 ml-1">
                <Box size={12} className="text-purple-500" /> パック
              </label>
              <select
                value={editingData.pack || ''}
                disabled={loading}
                onChange={(e) => handlePackChange(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-[11px] font-black text-slate-700 outline-none appearance-none focus:border-purple-300 focus:bg-white transition-all"
              >
                <option value="" className="!bg-slate-100 !text-slate-900">pack</option>
                {filteredPacks.map(pack => (
                  <option key={pack} value={pack} className="!bg-slate-100 !text-slate-900">{pack}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2.5"> {/* Rank selection */}
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 ml-1">
                <Star size={12} className="text-amber-500" /> ランク
              </label>
              <select
                value={editingData.stars ?? 0}
                disabled={loading || availableRanks.length <= 1}
                onChange={(event) => {
                  const newStars = parseInt(event.target.value, 10);
                  const match = findCardMatch(editingData.name, editingData.pack || undefined, newStars);
                  if (match) {
                    setEditingData(prev => ({
                      ...prev,
                      stars: newStars,
                      id: match.id,
                      name: match.name,
                      pack: match.pack || 'その他', // Ensure pack is string
                      group: match.group || '', // Ensure group is string
                      croppedImg: match.image_url || match.image || prev.croppedImg,
                    }));
                  }
                }}
                className="w-full bg-amber-50/50 border-2 border-amber-100 rounded-2xl px-4 py-3.5 text-[11px] font-black text-amber-700 outline-none appearance-none text-center disabled:opacity-50 focus:border-amber-300 focus:bg-white transition-all"
              >
                {availableRanks.length === 0 ? (
                  <option value="0" className="!bg-white !text-slate-900">---</option>
                ) : (
                  availableRanks.map((rank) => (
                    <option key={rank} value={rank} className="!bg-white !text-slate-900">{rank === 0 ? 'その他' : '★'.repeat(rank)}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          {availableSubtypes.length > 0 && (
            <div className="space-y-2.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 ml-1">
                <Award size={12} className="text-emerald-500" /> サブタイプ (新/旧など)
              </label>
              <select
                value={editingData.subtype || ''}
                disabled={loading}
                onChange={(e) => handleSubtypeChange(e.target.value)}
                className="w-full bg-emerald-50/50 border-2 border-emerald-100 rounded-2xl px-5 py-3.5 text-[11px] font-black text-emerald-700 outline-none appearance-none focus:border-emerald-300 focus:bg-white transition-all"
              >
                <option value="" className="!bg-white !text-slate-900">Subtype</option>
                {availableSubtypes.map(st => (
                  <option key={st} value={st} className="!bg-white !text-slate-900">{st}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-center pt-4">
            <div className="flex items-center bg-slate-100/80 rounded-[1.5rem] p-1.5 border border-slate-200/50 shadow-inner" >
              <button type="button" onClick={() => setEditingData(prev => ({ ...prev, quantity: Math.max(1, (prev.quantity || 1) - 1) }))} className="w-12 h-12 text-slate-400 hover:text-slate-900 font-black transition-colors" disabled={loading}>-</button>
              <div className="px-5 text-center">
                <span className="block text-[14px] font-black text-slate-900 leading-none">{editingData.quantity || 1}</span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">QTY</span>
              </div>
              <button type="button" onClick={() => setEditingData(prev => ({ ...prev, quantity: (prev.quantity || 1) + 1 }))} className="w-12 h-12 text-blue-500 hover:text-blue-600 font-black transition-colors" disabled={loading}>+</button>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button // Cancel button
            onClick={onClose}
            className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.25em] active:scale-95 transition-all hover:bg-slate-200"
          >
            Cancel
          </button>
          <button // Apply button
            onClick={() => onSave(editingData)}
            disabled={saveButtonDisabled}
            className="flex-1 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.25em] shadow-xl shadow-slate-200/70 active:scale-95 transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

interface SubtypeSelectionScreenProps {
  isOpen: boolean;
  onClose: () => void;
  cardData: ScannedCardResult;
  masterData: MasterCard[];
  onSelect: (subtype: string) => void;
}

function SubtypeSelectionScreen({ isOpen, onClose, cardData, masterData, onSelect }: SubtypeSelectionScreenProps) {
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);

  if (!isOpen || !cardData) return null;

  // デバッグ: cardData の確認
  // console.log('[SubtypeSelectionScreen] cardData:', {
  //   name: cardData.name,
  //   croppedImg: cardData.croppedImg ? `${cardData.croppedImg.substring(0, 50)}...` : 'undefined',
  //   pack: cardData.pack,
  //   stars: cardData.stars
  // });
  const availableSubtypes = Array.from(new Set(
    masterData
      .filter(m => 
        String(m.name).toLowerCase() === String(cardData.name).toLowerCase() &&
        (cardData.pack ? String(m.pack || 'その他').toLowerCase() === String(cardData.pack).toLowerCase() : true) &&
        Number(m.rank ?? 0) === Number(cardData.stars ?? 0)
      )
      .map((m: MasterCard) => m.subtype)
  )).filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-lg animate-in fade-in duration-300 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-slate-100 p-4 sm:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-400 bg-white my-4 sm:my-8">
        <div className="flex gap-4 sm:gap-6 items-start"> {/* Align items to start */}
          {/* ユーザーが入力した元画像 — 新旧比較用に常時表示 */}
          <aside className="w-24 sm:w-32 lg:w-40 flex-shrink-0 sticky top-0 self-start">
            <p className="text-[8px] sm:text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2 text-center">
              入力した写真
            </p>
            {cardData.sourceImage ? (
              <div className="rounded-[1.25rem] sm:rounded-[1.5rem] overflow-hidden border-2 border-blue-200 shadow-lg bg-slate-100">
                <Image
                  src={cardData.sourceImage}
                  alt="入力した写真"
                  width={160}
                  height={224}
                  unoptimized
                  priority
                  className="w-full h-auto object-cover"
                />
              </div>
            ) : (
              <div className="rounded-[1.25rem] sm:rounded-[1.5rem] border-2 border-dashed border-slate-300 p-4 bg-slate-50 text-center">
                <Camera size={24} className="mx-auto text-slate-300 mb-2" /> {/* Larger icon */}
                <p className="text-[8px] font-bold text-slate-400 leading-tight">写真なし</p>
              </div>
            )}
            <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 text-center mt-2 leading-tight">
              入力した写真と照合して選択
            </p>
          </aside>

          <div className="flex-1 min-w-0 space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-2xl font-black text-slate-900 mb-1">Select Subtype</h2>
                  <p className="text-[11px] sm:text-[13px] font-bold text-slate-500">Compare with your input image and choose the correct version.</p>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-colors flex-shrink-0">
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              {/* Card Info */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-5 border border-blue-100">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">検出されたカード</p>
                <h3 className="text-base sm:text-[18px] font-black text-slate-900 mb-2 truncate">{cardData.name}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 border border-blue-200">
                    <Box size={12} className="text-purple-500" />
                    <span className="text-[10px] font-bold text-slate-600">{cardData.pack || 'その他'}</span>
                  </div>
                  {cardData.stars > 0 && (
                    <div className="inline-flex items-center gap-1 bg-white rounded-full px-3 py-1.5 border border-amber-200">
                      {Array.from({ length: Math.max(0, Math.min(5, cardData.stars || 0)) }).map((_, i) => (
                        <Star key={i} size={11} fill="currentColor" className="text-amber-400" strokeWidth={0} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Subtype Selection Grid */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Compare Master Images</p>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {availableSubtypes.map((subtype, idx) => {
              // Find the card image for this subtype
              const subtypeCardMatch = masterData.find(m =>
                String(m.name).toLowerCase() === String(cardData.name).toLowerCase() &&
                (cardData.pack ? String(m.pack || 'その他').toLowerCase() === String(cardData.pack).toLowerCase() : true) &&
                Number(m.rank ?? 0) === Number(cardData.stars ?? 0) &&
                String(m.subtype || '').toLowerCase() === String(subtype).toLowerCase()
              );
              const subtypeImage = subtypeCardMatch?.image_url || subtypeCardMatch?.image;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedSubtype(subtype)}
                  className={`relative group overflow-hidden rounded-[2rem] border-2 transition-all active:scale-95 flex flex-col h-full ${
                    selectedSubtype === subtype
                      ? 'border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-200/70'
                      : 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-100'
                  }`}
                >
                  {/* Image Container */}
                  {subtypeImage ? (
                    <div className="relative w-full flex-1 bg-slate-100 overflow-hidden rounded-t-[1.5rem]">
                      <Image 
                        src={subtypeImage} 
                        alt={`${cardData.name} - ${subtype}`}
                        width={180}
                        height={252}
                        unoptimized
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  ) : (
                    <div className="w-full flex-1 bg-slate-100 rounded-t-[1.5rem] flex items-center justify-center">
                      <Layers size={24} className="text-slate-300/70" />
                    </div> // Placeholder for no image
                  )}

                  {/* Text Content */}
                  <div className="relative z-10 space-y-1.5 p-3">
                    <p className="text-[13px] font-black text-slate-900 leading-tight">{subtype}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">タップして選択</p>
                  </div>

                  {/* Hover glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none" />
                </button>
              );
            })}
              </div>
            </div>

            {/* Footer */}
            <div className="space-y-3">
              {selectedSubtype && (
                <div className="bg-emerald-50 rounded-[1.5rem] p-3 border border-emerald-100 text-center">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                    選択中: {selectedSubtype}
                  </p>
                </div>
              )}

              {selectedSubtype && (
                <button
                  onClick={() => onSelect(selectedSubtype)}
                  className="w-full py-4 sm:py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-[1.5rem] sm:rounded-[2rem] font-black text-[10px] sm:text-[11px] uppercase tracking-[0.25em] shadow-lg shadow-emerald-200/70 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={16} strokeWidth={3} /> 確定して進む
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
