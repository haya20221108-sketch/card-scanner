'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { analyzeCard } from './utils';
import Image from 'next/image';
import { resolveCardDisplay } from '../components/utils';
import { supabase } from '../supabase';
import { listProfiles } from '../profileStore';
import {
  addCustomMasterCards,
  getActiveProfileId,
  getCachedMasterData,
  getCachedProfiles,
  getCachedRawCollection,
  getCachedUserId,
  getOnlineStatus,
  normalizeProfileId,
  queueCollectionChange,
  rememberUserId,
  setCachedMasterData,
  setCachedProfiles,
  upsertCachedCollection,
} from '../offline';
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
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
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

  const activeProfileName = useMemo(() => {
    if (!activeProfileId) return 'Default';
    return profiles.find((profile) => String(profile.id) === String(activeProfileId))?.display_name || 'Active';
  }, [activeProfileId, profiles]);

  useEffect(() => {
    setHasMounted(true);
    const cached = getCachedMasterData();
    setMasterData(cached);
    setProfiles(getCachedProfiles());
    setActiveProfileIdState(getActiveProfileId());
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
          const profileList = await listProfiles(userId);
          setCachedProfiles(profileList);
          setProfiles(profileList);
          if (!getActiveProfileId() && profileList[0]?.id) {
            setActiveProfileIdState(profileList[0].id);
          }
        }

        const res = await fetch(CONFIG.gasUrl);
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
        pack: 'その他',
        stars: 0,
        quantity: 1,
        croppedImg: '',
        date: Date.now(),
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
    if (!isOnline) {
      showAlert('Offline Mode', 'オフライン中は手動追加を使えます。AI解析はオンライン復帰後に実行できます。', 'info');
      return;
    }
    if (masterData.length === 0) {
      showAlert('Master Data Missing', 'マスタデータがありません。先にオンラインで同期してください。', 'error');
      return;
    }

    setLoading(true);
    setProgress(0);
    setIsAllSaved(false);
    let allResults: any[] = [];

    // Promise.all を使用して並行処理
    const analysisPromises = images.map((img, i) => {
      setStatus(`${i + 1}枚目を解析中...`); // ステータスは更新するが、個別のsetStatusはanalyzeCardから削除
      return analyzeCard(img, masterData);
    });
    const resultsPerImage = await Promise.all(analysisPromises);
    allResults = resultsPerImage.flat().map((item: any) => ({ ...item, quantity: 1 }));

    setResults((prev) => {
      const consolidatedResults = new Map<string, any>();
      // 既存の結果をマップにロード
      prev.forEach(res => consolidatedResults.set(res.id, { ...res }));

      // 新しい結果を処理し、既存のカードの枚数を増やすか、新しいカードを追加
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
    setLoading(false);
    setStatus('完了');
    
    if (allResults.length === 0) {
      showAlert('Result', 'カードを検出できませんでした。角度を変えて撮り直すか、手動追加してください。', 'info');
    } else {
      setCustomAlert(`${allResults.length}件を解析しました。`);
    }

    window.scrollTo({ top: 320, behavior: 'smooth' });
  };

  const openEditDetailsModal = (index: number) => {
    setEditingResultData(results[index]);
    setSelectedResultIndex(index);
    setIsEditDetailsModalOpen(true); // Ensure modal opens
  };

  const saveAllCards = async () => {
    // カード名未入力、またはIDがmanual-（DB未一致）のカードをチェック
    const invalidCards = results.filter(r => !r.name || String(r.id).startsWith('manual-'));
    if (invalidCards.length > 0) {
      showAlert('保存できません', `データベースに一致しないカードが${invalidCards.length}件あります。正しい候補を選択するか削除してください。`, 'error');
      return;
    }
    if (results.length === 0) {
      showAlert('カードなし', '保存するカードがありません。', 'info');
      return;
    }
    showAlert('保存の確認', `${results.length}件のカードをバインダーに保存しますか？`, 'info', executeSaveConfirmed, closeAlert);
  };

  const executeSaveConfirmed = async () => {
    closeAlert();
    // 保存前に再度バリデーション（DB未一致が混入していないか）
    if (results.some(r => !r.name || String(r.id).startsWith('manual-'))) return;
    if (results.length === 0) return;

    setLoading(true);
    const sessionUserId = user?.uid || null;
    rememberUserId(sessionUserId);
    const userId = sessionUserId || getCachedUserId() || 'offline-user';
    let queued = 0;
    let saved = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      // DB一致のみ保存
      if (!result.name || String(result.id).startsWith('manual-')) continue;

      let cardId = String(result.id || '');
      const profileId = normalizeProfileId(result.profile_id || activeProfileId);

      const cachedRecord = getCachedRawCollection().find((item) => (
        String(item.card_id) === cardId
        && normalizeProfileId(item.profile_id) === profileId
        && (!item.user_id || String(item.user_id) === userId)
      ));
      const quantity = (Number(cachedRecord?.quantity) || 0) + Math.max(1, Number(result.quantity) || 1);

      upsertCachedCollection({
        user_id: userId,
        profile_id: profileId,
        card_id: cardId,
        quantity,
      });
      saved += 1;

      if (isOnline && sessionUserId) {
        try {
          const { error } = await supabase.from('collections').upsert({
            user_id: sessionUserId,
            profile_id: profileId,
            card_id: cardId,
            quantity,
          }, { onConflict: 'user_id,profile_id,card_id' });
          if (error) throw error;
        } catch {
          queued = queueCollectionChange('upsert', { user_id: userId, profile_id: profileId, card_id: cardId, quantity });
        }
      } else {
        queued = queueCollectionChange('upsert', { user_id: userId, profile_id: profileId, card_id: cardId, quantity });
      }
    }

    setLoading(false);
    setIsAllSaved(true);
    setImages([]);
    setResults([]);
    showAlert('保存完了', '全てのカードをBinderに保存しました。', 'success', () => router.push('/home'));
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
              disabled={images.length === 0 || loading}
              className="py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 flex items-center justify-center gap-2 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              <Sparkles size={16} /> AI解析
            </button>
            <button
              type="button"
              onClick={addManualCard}
              className="py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-100 flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus size={16} /> 手動追加
            </button>
          </div>

          {loading && (
            <div className="mt-4">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{status}</p>
            </div>
          )}
        </section>

        {results.length > 0 ? (
          <section className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">候補 ({results.length})</h2>
              <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <Layers size={12} /> {masterData.length}
              </div> {/* This div is for masterData.length, not for saving */}
            </div>

            <div className="flex flex-col gap-2">
              {results.map((result, index) => (
                <ResultEditCard
                  key={`${result.id}-${result.date}-${index}`}
                  data={result}
                  onRemove={() => removeResult(index)}
                  onClick={() => openEditDetailsModal(index)}
                  profiles={profiles}
                  activeProfileId={activeProfileId} // Pass active profile for default selection
                  onProfileChange={(newProfileId) => updateResult(index, 'profile_id', newProfileId)} // Callback for profile change
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
    if (rankValue <= 1) {
      return 'その他';
    }
    return '★'.repeat(rankValue);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-4 transition-all duration-300 active:scale-[0.98] cursor-pointer shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-2
        ${isIdManual
          ? 'bg-red-50/50 border-red-200'
          : 'bg-white border-slate-100'
        }
      `}
    >
      {/* メイン情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`text-xs font-black uppercase leading-tight truncate ${display.isUnknown ? 'text-red-600' : 'text-slate-900'}`}>
            {isIdManual ? (data.name || 'Unknown Card') : display.name}
          </h3>
          <div className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg flex-shrink-0">
            x{data.quantity || 1}
          </div>
          {isIdManual && (
            <div className="bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <AlertCircle size={8} /> UNMATCHED
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Award size={10} className="text-amber-400" />
          <span className="text-[10px] font-bold text-amber-500 tracking-widest">
            {getRankDisplay(data.stars ?? data.rank ?? 0)}
          </span>
        </div>
      </div>

      {/* アクション/アカウント選択 */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {profiles.length > 1 && ( // プロフィールが複数ある場合のみ切り替えボタンを表示
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const currentProfileIndex = profiles.findIndex(p => String(p.id) === String(data.profile_id || activeProfileId));
              const nextProfileIndex = (currentProfileIndex + 1) % profiles.length;
              onProfileChange(profiles[nextProfileIndex].id);
            }}
            className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors"
            title="次のアカウントに切り替え"
          >
            <User size={16} />
          </button>
        )}
        <select
          value={data.profile_id || activeProfileId || ''}
          onChange={(e) => {
            e.stopPropagation();
            onProfileChange(e.target.value);
          }}
          className="bg-white text-slate-500 text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border-none focus:ring-0 appearance-none text-center cursor-pointer hover:bg-slate-100"
        >
          {profiles.map(p => (
            <option key={p.id} value={p.id} className="!bg-white !text-slate-900">{p.display_name}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
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
  cardData: any;
  masterData: any[];
  profiles: any[];
  onSave: (updatedData: any) => void;
  loading: boolean; // Add loading to props interface
}

function EditCardDetailsModal({ isOpen, onClose, cardData, masterData, profiles, onSave, loading }: EditCardDetailsModalProps) {
  const [editingData, setEditingData] = useState(cardData);
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

      const tripletMatch = masterData.find(m => 
        String(m.name).toLowerCase() === nextName.toLowerCase() &&
        (m.pack || 'その他') === (nextPack || 'その他') &&
        Number(m.rank ?? 0) === Number(prev.stars ?? 0)
      );

      return {
        ...prev,
        name: nextName,
        pack: nextPack,
        id: tripletMatch ? tripletMatch.id : `manual-${Date.now()}`,
        stars: tripletMatch ? (tripletMatch.rank ?? 0) : prev.stars
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

      const tripletMatch = masterData.find(m => 
        String(m.name).toLowerCase() === (nextName || '').toLowerCase() &&
        (m.pack || 'その他') === nextPack &&
        Number(m.rank ?? 0) === Number(prev.stars ?? 0)
      );

      return {
        ...prev,
        name: nextName,
        pack: nextPack,
        id: tripletMatch ? tripletMatch.id : `manual-${Date.now()}`,
        stars: tripletMatch ? (tripletMatch.rank ?? 0) : prev.stars
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

  const saveButtonDisabled = isNameEmpty; // Card name must always be present to save

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
              value={editingData.name || ''}
              disabled={loading}
              onChange={(e) => handleNameChange(e.target.value)}
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
          </div> {/* End of card name input */}
          {isIdManual && (
            <p className="text-[9px] font-black text-red-500 uppercase tracking-widest px-1 flex items-center gap-1">
              <AlertCircle size={10} /> {isNameEmpty ? 'カード名を入力してください' : 'データベースに登録されていません'}
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
                  const match = masterData.find(m => 
                    String(m.name).toLowerCase() === String(editingData.name || '').toLowerCase() &&
                    String(m.pack || 'その他').toLowerCase() === String(editingData.pack || 'その他').toLowerCase() &&
                    Number(m.rank ?? 0) === newStars
                  );
                  if (match) {
                    setEditingData(prev => ({
                      ...prev,
                      stars: newStars,
                      id: match.id
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
            className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-100 active:scale-95 transition-all"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
