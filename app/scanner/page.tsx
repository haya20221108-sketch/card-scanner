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
  getActivePUid,
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

const CONFIG = {
  gasUrl: 'https://script.google.com/macros/s/AKfycbzE912QE7aAjrxboaW8jLnjJ-tTW7JzePfkREe3vpnTYMsghP4eRMWd_cEK3ffLQn3w4Q/exec',
  ranks: [0, 2, 3, 4, 5],
};

export default function ScannerPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [images, setImages] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('待機中');
  const [masterData, setMasterData] = useState<any[]>([]);
  const [isAllSaved, setIsAllSaved] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [activePUid, setActivePUidState] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null); // 候補選択用
  const [isEditDetailsModalOpen, setIsEditDetailsModalOpen] = useState(false); // 詳細編集モーダル
  const [editingResultData, setEditingResultData] = useState<any | null>(null); // 編集中のカードデータ

  // Alert State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'success';
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
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
  const hasProfiles = profiles.length > 0;
  const canUseAiScan = Boolean(
    process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY &&
    process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_CARD &&
    process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_STAR
  );

  const activeProfileName = useMemo(() => {
    if (!activePUid) return 'Default';
    return profiles.find((profile) => String(profile.id) === String(activePUid))?.display_name || 'Active';
  }, [activePUid, profiles]);

  useEffect(() => {
    setHasMounted(true);
    const cached = getCachedMasterData();
    setMasterData(cached);
    setProfiles(getCachedProfiles());
    setActivePUidState(getActivePUid());
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
            const profileList = await ensureProfiles(userId);
            setCachedProfiles(profileList);
            setProfiles(profileList);
            const savedUid = getActivePUid();
            const nextProfileId = savedUid && profileList.some((profile) => profile.id === savedUid)
              ? savedUid
              : profileList[0]?.id;
            if (nextProfileId) {
              setActivePUidState(nextProfileId);
            }
          } catch (error) {
            console.error('Profile sync failed:', error);
          }
        }

        const res = await fetchWithTimeout(CONFIG.gasUrl);
        const data = await res.json();
        const filtered = data.filter((card: any) => card.name && !['名前', 'name'].includes(card.name.toLowerCase()));
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
      const filtered = data.filter((card: any) => card.name && !['名前', 'name'].includes(String(card.name).toLowerCase()));
      setCachedMasterData(filtered);
      setMasterData(getCachedMasterData());
      showAlert('同期完了', 'カードデータを同期しました。', 'success');
    } catch (error) {
      console.error('Master sync failed:', error);
      showAlert('Sync Error', 'カードデータの同期に失敗しました。', 'error');
    } finally {
      setLoading(false);
      setStatus('待機中');
    }
  };

  const updateResult = (index: number, field: string, value: any, closeEditModal: boolean = false) => {
    const next = [...results];
    if (field === 'all' && value !== undefined && value !== null) { // Ensure value is not null/undefined when updating all
      next[index] = { ...next[index], ...value };
      // If updating all, also update the editingResultData if the modal is open
      if (isEditDetailsModalOpen && editingResultData && editingResultData.date === next[index].date) { // Typo: editingData -> editingResultData
        setEditingResultData(next[index]);
      }
    } else {
      next[index] = { ...next[index], [field]: value };
    }

    // 名前、パック、ランクのいずれかが変更された場合、3要素の完全一致を確認
    if (['name', 'pack', 'stars', 'all'].includes(field)) {
      const current = next[index];
      const match = masterData.find((m) => 
        String(m.name).toLowerCase() === String(current.name || '').toLowerCase() &&
        String(m.pack || 'その他').toLowerCase() === String(current.pack || 'その他').toLowerCase() &&
        Number(m.rank ?? 0) === Number(current.stars ?? 0)
      );

      if (match) {
        next[index] = {
          ...next[index],
          name: match.name,
          id: match.id,
          group: match.group,
          pack: match.pack || 'その他',
          stars: match.rank ?? 0,
          croppedImg: match.image || next[index].croppedImg
        };
      } else if (field === 'name' && current.name) {
        // 名前のみが入力・変更された場合は、利便性のためにDBから最初の候補を補完して一致させる
        const nameMatch = masterData.find(m => String(m.name).toLowerCase() === String(current.name).toLowerCase());
        if (nameMatch) {
          next[index] = {
            ...next[index],
            name: nameMatch.name,
            id: nameMatch.id,
            group: nameMatch.group,
            pack: nameMatch.pack || 'その他',
            stars: nameMatch.rank ?? 0,
            croppedImg: nameMatch.image || next[index].croppedImg
          };
        } else {
          next[index].id = `manual-${Date.now()}`;
        }
      } else if (field !== 'all') {
        // 3要素が揃っておらず、かつ名前補完もできない場合は手動ID（Unmatched）にする
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
        quantity: 1,
        croppedImg: '',
        date: Date.now(),
        p_uid: activePUid || profiles[0]?.id || null,
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
    let allResults: any[] = [];

    try {
      const resultsPerImage: any[][] = [];
      for (let i = 0; i < images.length; i += 1) {
        setStatus(`${i + 1}/${images.length}枚目を解析中...`);
        const parsed = await analyzeCard(images[i], masterData);
        resultsPerImage.push(parsed);
        setProgress(Math.round(((i + 1) / images.length) * 100));
      }
      allResults = resultsPerImage.flat().map((item: any) => ({ ...item, quantity: 1 }));

      setResults((prev) => {
        const consolidatedResults = new Map<string, any>();
        prev.forEach(res => consolidatedResults.set(res.id, { ...res }));
        allResults.forEach(newCard => {
          if (consolidatedResults.has(newCard.id)) {
            consolidatedResults.get(newCard.id).quantity += newCard.quantity;
          } else {
            consolidatedResults.set(newCard.id, { ...newCard });
          }
        });
        return Array.from(consolidatedResults.values());
      });
      setImages([]);

      if (allResults.length === 0) {
        showAlert('Result', 'カードを検出できませんでした。角度を変えて撮り直すか、手動追加してください。', 'info');
      } else {
        setCustomAlert(`${allResults.length}件を解析しました。`);
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
    const invalidCards = results.filter(r => !r.name);
    if (invalidCards.length > 0) {
      showAlert('保存できません', `カード名が未入力のカードが${invalidCards.length}件あります。`, 'error');
      return;
    }
    if (results.length === 0) {
      showAlert('カードなし', '保存するカードがありません。', 'info');
      return;
    }
    if (!hasProfiles || results.some((r) => !normalizePUid(r.p_uid || activePUid))) {
      showAlert('アカウントを選択', '保存先のアプリ内アカウントを選択してください。', 'error');
      return;
    }
    showAlert('保存の確認', `${results.length}件のカードをバインダーに保存しますか？`, 'info', executeSaveConfirmed, closeAlert);
  };

  const executeSaveConfirmed = async () => {
    closeAlert();
    if (results.some(r => !r.name)) return;
    if (results.length === 0) return;

    setLoading(true);
    setStatus('保存中...');
    try {
      const sessionUserId = user?.uid || null;
      rememberUserId(sessionUserId);
      const userId = sessionUserId || getCachedUserId() || 'offline-user';
      let queued = 0;
      let saved = 0;
      const customCards = results
        .filter((result) => String(result.id || '').startsWith('manual-'))
        .map((result) => ({
          id: `custom-${String(result.id).replace(/^manual-/, '')}`,
          name: result.name,
          pack: result.pack || 'カスタム',
          rank: Number(result.stars ?? result.rank ?? 0),
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
        const pUid = normalizePUid(result.p_uid || activePUid);
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
        saved += 1;

        if (isOnline && sessionUserId) {
          try {
            const { error } = await supabase.from('inventory').upsert({
              p_uid: pUid,
              card_id: cardId,
              count: totalQuantity,
            }, { onConflict: 'p_uid,card_id' });
            if (error) throw error;
          } catch (error) {
            console.error('Supabase save failed:', error.message || error);
            showAlert('保存エラー', `カード「${result.name}」の保存に失敗しました。RLS設定を確認してください。`, 'error');
            queued = queueCollectionChange('upsert', { user_id: userId, p_uid: pUid, card_id: cardId, quantity: totalQuantity });
          }
        } else {
          queued = queueCollectionChange('upsert', { user_id: userId, p_uid: pUid, card_id: cardId, quantity: totalQuantity });
        }
      }

      setIsAllSaved(true);
      setImages([]);
      setResults([]);
      showAlert('保存完了', '全てのカードをBinderに保存しました。', 'success', () => router.push('/home'));
    } catch (error) {
      console.error('Save confirmed failed:', error);
      showAlert('保存エラー', 'カードの保存中に問題が発生しました。', 'error');
    } finally {
      setLoading(false);
      setStatus('待機中');
    }
  };

  if (!hasMounted) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-40 font-sans">
      <header className="max-w-md mx-auto bg-white/90 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40 px-4 h-16 flex items-center justify-between shadow-sm">
        <Link href="/home" className="p-2 hover:bg-slate-100 rounded-full transition-all active:scale-90">
          <ChevronLeft size={24} className="text-slate-600" />
        </Link>
        <div className="text-center">
          <h1 className="text-sm font-black italic text-slate-800 tracking-tighter uppercase">Scanner</h1>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{activeProfileName}</p>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          {isOnline ? <Cloud size={18} className="text-emerald-500" /> : <CloudOff size={18} className="text-amber-500" />}
          {loading && <span className="text-[10px] font-black text-blue-600">{progress}%</span>}
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {!hasProfiles && (
          <Link href="/settings/profiles" className="block bg-amber-50 border border-amber-100 rounded-2xl p-4 text-amber-700">
            <p className="text-[10px] font-black uppercase tracking-widest">アカウント未設定</p>
            <p className="text-[10px] font-bold uppercase tracking-tight mt-1">保存先のアプリ内アカウントを作成してください。</p>
          </Link>
        )}

        <section className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            <label className="flex-shrink-0 w-32 h-40 rounded-2xl border-2 border-dashed border-blue-200 bg-slate-50 flex flex-col items-center justify-center text-blue-600 hover:bg-blue-50 cursor-pointer transition-all active:scale-95">
              <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => handleFiles(event.target.files)} />
              <Camera size={28} className="mb-2" />
              <span className="text-xs font-black uppercase">写真を追加</span>
              <span className="text-[9px] font-bold text-blue-500/70 mt-1">複数選択OK</span>
            </label>
            {images.map((img, idx) => (
              <div key={idx} className="relative flex-shrink-0 w-32 h-40">
                <Image src={img} width={128} height={160} unoptimized className="w-full h-full object-cover rounded-2xl border border-slate-100 shadow-sm" alt="scan preview" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-lg active:scale-90"
                >
                  <X size={14} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={handleBatchScan}
              disabled={images.length === 0 || loading || !canUseAiScan}
              className="py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 flex items-center justify-center gap-2 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              <Sparkles size={16} /> AI解析
            </button>
            <button
              type="button"
              onClick={addManualCard}
              disabled={!hasProfiles}
              className="py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-100 flex items-center justify-center gap-2 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              <Plus size={16} /> 手動追加
            </button>
          </div>

          {masterData.length === 0 && (
            <button
              type="button"
              onClick={syncMasterData}
              disabled={loading || !isOnline}
              className="mt-3 w-full py-3 bg-blue-50 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Layers size={14} /> カードデータ同期
            </button>
          )}

          {loading && (
            <div className="mt-4">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{status}</p>
            </div>
          )}
        </section>

        {results.length > 0 ? (
          <section className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between px-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">解析結果</h2>
                <span className="text-[9px] font-bold text-slate-400">{results.length} 件</span>
              </div>
              <button 
                onClick={() => showAlert('確認', '全ての解析結果を削除しますか？', 'info', () => setResults([]), closeAlert)}
                className="flex items-center gap-1 text-[9px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
              >
                <Trash2 size={12} /> 全て削除
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {results.map((result, index) => (
                <ResultEditCard
                  key={`${result.id}-${result.date}-${index}`}
                  data={result}
                  onRemove={() => removeResult(index)}
                  onClick={() => openEditDetailsModal(index)}
                  profiles={profiles}
                  activeProfileId={activePUid} // Pass active profile for default selection
                  onProfileChange={(newProfileId) => updateResult(index, 'p_uid', newProfileId)} // Callback for profile change
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="py-16 text-center space-y-4">
            <div className="inline-flex p-6 bg-slate-100 rounded-[2rem] text-slate-300">
              <Camera size={32} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {isOnline ? '写真解析または手動追加で登録' : 'Offline: 手動追加と保存が使えます'}
            </p>
          </section>
        )}
      </main>

      {results.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
          <button
            type="button"
            onClick={saveAllCards}
            disabled={loading || isAllSaved}
            className={`w-full py-5 rounded-2xl font-black text-xs flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95 ${
              isAllSaved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            {isAllSaved ? <><Check size={20} /> Saved</> : <><Save size={20} /> Binderに保存</>}
          </button>
        </div>
      )}

      {/* Toast feedback */}
      {customAlert && (
        <div className="fixed top-20 left-4 right-4 z-[100] bg-white border border-slate-100 p-4 rounded-2xl shadow-2xl flex items-center justify-between animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <Sparkles size={16} className="text-blue-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">{customAlert}</p>
          </div>
          <button type="button" onClick={() => setCustomAlert(null)} className="text-slate-400 p-1"><X size={16} /></button>
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
    </div>
  );
}

interface ResultEditCardProps { // Simplified for list view
  data: any;
  // masterData, onUpdate are not needed for display-only version
  profiles: any[]; // For profile selection
  activeProfileId: string | null; // For default profile selection
  onProfileChange: (newProfileId: string) => void; // Callback for profile change
  onRemove: () => void;
  onClick: () => void;
}

function ResultEditCard({ data, onRemove, onClick, profiles, activeProfileId, onProfileChange }: ResultEditCardProps) {
  const display = resolveCardDisplay(data);
  const isIdManual = String(data.id || '').startsWith('manual-');

  const getRankDisplay = (rankValue: number) => {
    return rankValue <= 0 ? 'その他' : rankValue;
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 transition-all duration-300 active:scale-[0.98] cursor-pointer shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-2
        ${isIdManual
          ? 'bg-red-50/30 border-red-200'
          : 'bg-white border-blue-300'
        }
      `}
    >
      {/* Left accent line */}
      {!isIdManual && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-blue-600" />
      )}

      {/* メイン情報 */}
      <div className="flex-1 min-w-0 py-1 pl-1">
        <div className="flex items-center gap-1.5 mb-1">
          <h3 className={`text-[11px] font-black uppercase leading-tight truncate ${display.isUnknown ? 'text-red-600' : 'text-slate-900'}`}>
            {isIdManual ? (data.name || 'Unknown Card') : display.name}
          </h3>
          <div className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-lg flex-shrink-0 shadow-sm">
            x{data.quantity || 1}
          </div>
        </div>
        
        <div className="flex flex-col gap-0.5">
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest truncate">
            {data.pack || 'その他'}
          </p>
          <div className="flex items-center gap-0.5 text-amber-400">
            {data.stars > 0 ? (
              Array.from({ length: Math.max(0, Math.min(5, data.stars || 0)) }).map((_, i) => (
                <Star key={i} size={8} fill="currentColor" strokeWidth={0} />
              ))
            ) : (
              <span className="text-[8px] font-black text-slate-400 uppercase">その他</span>
            )}
          </div>
        </div>
        
        {isIdManual && (
          <div className="mt-1.5 inline-flex bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
            <AlertCircle size={8} /> UNMATCHED
          </div>
        )}
      </div>

      {/* アクション */}
      <div className="flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-slate-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={16} />
        </button>

        {profiles.filter((p) => !String(p.id).startsWith('local-profile-')).length > 1 && ( // DBバックのプロファイルのみ表示
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const dbProfiles = profiles.filter((p) => !String(p.id).startsWith('local-profile-'));
              const currentProfileIndex = dbProfiles.findIndex(p => String(p.id) === String(data.p_uid || activeProfileId));
              const nextProfileIndex = currentProfileIndex >= 0 ? (currentProfileIndex + 1) % dbProfiles.length : 0;
              onProfileChange(dbProfiles[nextProfileIndex]?.id || String(activeProfileId || ''));
            }}
            className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
            title="次のアカウントに切り替え"
          >
            <User size={16} />
          </button>
        )}
        <select
          value={profiles.filter((p) => !String(p.id).startsWith('local-profile-')).some(p => p.id === String(data.p_uid || activeProfileId)) ? String(data.p_uid || activeProfileId) : profiles.filter((p) => !String(p.id).startsWith('local-profile-'))[0]?.id || ''}
          onChange={(e) => {
            e.stopPropagation();
            onProfileChange(e.target.value);
          }}
          className="bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-widest px-3 py-2 rounded-lg border-none focus:ring-0 appearance-none text-center cursor-pointer hover:bg-slate-100 shadow-inner max-w-[80px] truncate"
        >
          {profiles.filter((p) => !String(p.id).startsWith('local-profile-')).map(p => (
            <option key={p.id} value={p.id} className="!bg-white !text-slate-900">{p.display_name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

interface EditCardDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardData: any;
  masterData: any[];
  profiles: any[];
  onSave: (updatedData: any) => void;
  loading: boolean; // Add loading to props interface
}

function EditCardDetailsModal({ isOpen, onClose, cardData, masterData, profiles, onSave, loading }: EditCardDetailsModalProps) {
  const [editingData, setEditingData] = useState(cardData);

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
    return Array.from(new Set(data.map((card: any) => card.name).filter(Boolean))).sort();
  }, [editingData.pack, masterData]);

  const filteredPacks = useMemo(() => {
    let data = masterData;
    if (editingData.name) {
      data = data.filter(m => String(m.name).toLowerCase() === String(editingData.name).toLowerCase());
    }
    return Array.from(new Set(data.map((card: any) => card.pack || 'その他'))).sort();
  }, [editingData.name, masterData]);

  const availableRanks = useMemo(() => {
    if (!editingData.name || !editingData.pack) return [];
    return Array.from(new Set(
      masterData
        .filter(m => 
          String(m.name).toLowerCase() === String(editingData.name).toLowerCase() &&
          String(m.pack || 'その他').toLowerCase() === String(editingData.pack).toLowerCase()
        )
        .map(m => Number(m.rank ?? 0))
    )).sort((a, b) => a - b);
  }, [editingData.name, editingData.pack, masterData]);

  useEffect(() => {
    setEditingData(cardData); // Update if cardData changes from parent (e.g., candidate selection)
  }, [cardData]);

  if (!isOpen) return null;

  const display = resolveCardDisplay(editingData);
  const isNameEmpty = !editingData.name || editingData.name.trim() === '';
  const isIdManual = String(editingData.id).startsWith('manual-');

  const getRankDisplay = (rankValue: number) => {
    if (rankValue <= 1) {
      return 'その他';
    }
    return '★'.repeat(rankValue);
  };

  const handleNameChange = (name: string) => {
    setEditingData(prev => {
      const nextName = name;
      const matches = nextName ? masterData.filter(m => String(m.name).toLowerCase() === nextName.toLowerCase()) : [];
      
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
        pack: tripletMatch ? (tripletMatch.pack || 'その他') : nextPack,
        id: tripletMatch ? tripletMatch.id : `manual-${Date.now()}`,
        stars: tripletMatch ? (tripletMatch.rank ?? 0) : prev.stars,
        group: tripletMatch ? tripletMatch.group : prev.group,
        croppedImg: tripletMatch ? (tripletMatch.image_url || tripletMatch.image || prev.croppedImg) : prev.croppedImg,
      };
    });
  };

  const handlePackChange = (pack: string) => {
    setEditingData(prev => {
      const nextPack = pack;
      const matches = nextPack ? masterData.filter(m => (m.pack || 'その他') === nextPack) : [];
      
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
        pack: nextPack,
        id: tripletMatch ? tripletMatch.id : `manual-${Date.now()}`,
        stars: tripletMatch ? (tripletMatch.rank ?? 0) : prev.stars,
        group: tripletMatch ? tripletMatch.group : prev.group,
        croppedImg: tripletMatch ? (tripletMatch.image_url || tripletMatch.image || prev.croppedImg) : prev.croppedImg,
      };
    });
  };

  const handleReset = () => {
    setEditingData(prev => ({
      ...prev,
      name: '',
      pack: '',
      stars: 0,
      id: `manual-${Date.now()}`
    }));
  };

  const saveButtonDisabled = isNameEmpty;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">カード詳細編集</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleReset}
              className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors"
              title="選択をリセット"
            >
              <RotateCcw size={18} />
            </button>
            <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={18} /></button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Search size={12} className="text-blue-500" /> カード名
            </label>
            <select
              value={masterData.length > 0 ? (editingData.name || '') : ''}
              disabled={loading}
              onChange={(e) => handleNameChange(e.target.value)}
              hidden={masterData.length === 0}
              className={`w-full bg-white border rounded-xl px-3 py-2.5 text-xs font-bold outline-none transition-all appearance-none
                ${isIdManual 
                  ? 'border-red-200 focus:ring-red-500/20 text-red-600'
                  : 'border-slate-200 focus:ring-blue-500/20 text-slate-800'
                }`}
            >
              <option value="" className="!bg-white !text-slate-900">カードを選択 (すべて表示)</option>
              {filteredNames.map(name => (
                <option key={name} value={name} className="!bg-white !text-slate-900">{name}</option>
              ))}
            </select>
            {masterData.length === 0 && (
              <input
                value={editingData.name || ''}
                disabled={loading}
                onChange={(event) => setEditingData((prev) => ({
                  ...prev,
                  name: event.target.value,
                  id: String(prev.id || '').startsWith('manual-') ? prev.id : `manual-${Date.now()}`,
                  pack: prev.pack || 'カスタム',
                }))}
                placeholder="カード名を入力"
                className="w-full bg-white border border-red-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none text-red-600"
              />
            )}
          </div> {/* End of card name input */}
          {isIdManual && (
            <p className="text-[9px] font-black text-red-500 uppercase tracking-widest px-1 flex items-center gap-1">
              <AlertCircle size={10} /> {isNameEmpty ? 'カード名を入力してください' : 'カスタムカードとして保存されます'}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Box size={12} className="text-purple-500" /> パック
              </label>
              <select
                value={editingData.pack || ''}
                disabled={loading}
                onChange={(e) => handlePackChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-700 outline-none appearance-none"
              >
                <option value="" className="!bg-slate-100 !text-slate-900">パックを選択</option>
                {filteredPacks.map(pack => (
                  <option key={pack} value={pack} className="!bg-slate-100 !text-slate-900">{pack}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                ランク
              </label>
              <select
                value={editingData.stars ?? editingData.rank ?? 0}
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
                      pack: match.pack || 'その他',
                      group: match.group,
                      croppedImg: match.image_url || match.image || prev.croppedImg,
                    }));
                  }
                }}
                className="w-full bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 text-[10px] font-black text-yellow-700 outline-none appearance-none text-center disabled:opacity-50"
              >
                {availableRanks.length === 0 ? (
                  <option value="0" className="!bg-white !text-slate-900">その他</option>
                ) : (
                  availableRanks.map((rank) => (
                    <option key={rank} value={rank} className="!bg-white !text-slate-900">{getRankDisplay(rank)}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-center pt-2">
            <div className="flex items-center bg-slate-50 rounded-2xl p-1.5 border border-slate-100" > {/* Quantity controls */}
              <button type="button" onClick={() => setEditingData(prev => ({ ...prev, quantity: Math.max(1, (prev.quantity || 1) - 1) }))} className="w-8 h-8 text-slate-400 font-black" disabled={loading}>-</button>
              <span className="w-7 text-center text-sm font-black text-slate-900">{editingData.quantity || 1}</span> {/* Display quantity */}
              <button type="button" onClick={() => setEditingData(prev => ({ ...prev, quantity: (prev.quantity || 1) + 1 }))} className="w-8 h-8 text-blue-500 font-black" disabled={loading}>+</button>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-sm active:scale-95 transition-all"
          >
            キャンセル
          </button>
          <button
            onClick={() => onSave(editingData)} // Pass the updated data to parent
            disabled={saveButtonDisabled}
            className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-100 active:scale-95 transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
