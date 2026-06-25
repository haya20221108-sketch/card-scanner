'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { inputAI } from './utils';
import Image from 'next/image';
import { supabase } from '../../supabase';
import { ensureProfiles } from '../../profileStore';
import {
  addCustomMasterCards,
  getCachedMasterData,
  getCachedProfiles,
  getCachedRawCollection,
  getOnlineStatus,
  normalizePUid,
  queueCollectionChange,
  rememberUserId,
  setCachedMasterData,
  setCachedProfiles,
  upsertCachedCollection,
} from '../../offline';
import { CustomAlert } from '../../components/CustomAlert';
import { useAuth } from '../../../AuthContext';
import {
  AlertCircle,
  Box,
  Camera,
  Layers,
  Plus,
  Save,
  Trash2,
  X,
  Sparkles,
  ChevronLeft,
  Edit3,
} from 'lucide-react';

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
  _uiKey: string;
  name: string;
  group: string;
  pack: string;
  stars: number;
  subtype: string;
  quantity: number; // 枠単位なので常に1
  croppedImg: string;
  sourceImage?: string;
  date: number;
  p_uid: string | null;
  // 座標ソート用（utilsからの戻り値想定、なければ0）
  x?: number;
  y?: number;
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
};

const fetchWithTimeout = async (input: RequestInfo, init: RequestInit = {}, timeoutMs = 20000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export default function ScannerPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [images, setImages] = useState<string[]>([]);
  const [results, setResults] = useState<ScannedCardResult[]>([]);
  const [masterData, setMasterData] = useState<MasterCard[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('待機中');
  
  const [isOnline, setIsOnline] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'capture' | 'review'>('capture');

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageSrc, setPreviewImageSrc] = useState<string>('');
  
  const [editingUiKey, setEditingUiKey] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<ScannedCardResult | null>(null);

  const [alertConfig, setAlertConfig] = useState<AlertConfigState>({ isOpen: false, title: '', message: '', type: 'info' });
  const [customAlert, setCustomAlert] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const hasProfiles = profiles.length > 0;
  const dbProfiles = useMemo(() => profiles.filter((p) => !String(p.id).startsWith('local-profile-')), [profiles]);
  const canUseAiScan = Boolean(process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY);

  useEffect(() => {
    if (folderInputRef.current) {
      (folderInputRef.current as any).webkitdirectory = true;
      (folderInputRef.current as any).directory = true;
    }
    setHasMounted(true);
    
    setMasterData(getCachedMasterData() as MasterCard[]);
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
          const profileList = await ensureProfiles(userId) as Profile[];
          setCachedProfiles(profileList);
          setProfiles(profileList);
        }
        const res = await fetchWithTimeout(CONFIG.gasUrl);
        const data = await res.json();
        const filtered = data.filter((card: MasterCard) => card.name && !['名前', 'name'].includes(card.name.toLowerCase()));
        setCachedMasterData(filtered);
        setMasterData(getCachedMasterData());
      } catch (e) {
        console.error("Master Sync Error", e);
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
      const timer = setTimeout(() => setCustomAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [customAlert]);

  const showAlert = (title: string, message: string, type: 'info' | 'error' | 'success' = 'info', onConfirm?: () => void, onCancel?: () => void) => {
    setAlertConfig({ isOpen: true, title, message, type, onConfirm, onCancel });
  };
  const closeAlert = () => setAlertConfig(prev => ({ ...prev, isOpen: false }));

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

  // 🎯 改善されたAIスキャン＋新旧自動判定ロジック
  const handleBatchScan = async () => {
    if (images.length === 0 || loading) return;
    if (!hasProfiles) return showAlert('アカウントがありません', '設定でプロファイルを作成してください。', 'error');
    if (!canUseAiScan) return showAlert('設定不足', 'Roboflow APIキーが未設定です。', 'info');
    if (!isOnline) return showAlert('オフライン', 'オフライン中は手動追加をご利用ください。', 'info');
    if (masterData.length === 0) return showAlert('データなし', 'マスタデータがありません。', 'error');

    setLoading(true);
    setStatus('カード解析中...');
    setProgress(0);
    
    let rawParsedList: any[] = [];
    
    try {
      // 1. 全画像の枠データを一括で取得
      for (let i = 0; i < images.length; i++) {
        setStatus(`${i + 1}/${images.length}枚目を解析中...`);
        const parsedBoxList = await inputAI(images[i], masterData) as any[];
        rawParsedList.push(...parsedBoxList);
        setProgress(Math.round(((i + 1) / images.length) * 100));
      }

      if (rawParsedList.length > 0) {
        // 2. 🎯 【位置ソート】 左上(y小 ➔ x小) から 右下(y大 ➔ x大) へ並び替え
        // ※ yのわずかなズレで左右が逆転しないよう、少し広めのマージン(例: 枠高の半分程度、ここでは簡易的に y/50 などのブロック化も可能ですが、基本はy優先、次いでxで並べます)
        rawParsedList.sort((a, b) => {
          const yDiff = (a.y || 0) - (b.y || 0);
          if (Math.abs(yDiff) > 40) return yDiff; // 上下の位置に明らかな差があればy優先
          return (a.x || 0) - (b.x || 0); // 近い高さなら左にあるものを優先
        });

        // 3. 🎯 【新旧の自動判定マッピング】
        // 同一カード（名前＋星）がこの全体セッションで何枚存在するかを予め集計
        const totalCountsMap: Record<string, number> = {};
        rawParsedList.forEach(c => {
          const key = `${c.name}-${c.stars}`;
          totalCountsMap[key] = (totalCountsMap[key] || 0) + 1;
        });

        const currentAppearanceMap: Record<string, number> = {};
        const finalStructuredCards: ScannedCardResult[] = rawParsedList.map(newCard => {
          const key = `${newCard.name}-${newCard.stars}`;
          currentAppearanceMap[key] = (currentAppearanceMap[key] || 0) + 1;

          const totalQty = totalCountsMap[key];
          const currentIdx = currentAppearanceMap[key];

          // ルール: 1枚だけなら「旧」、2枚以上ある場合は1枚目が「新」、それ以降は「旧」
          let calculatedSubtype = '旧';
          if (totalQty >= 2 && currentIdx === 1) {
            calculatedSubtype = '新';
          }

          return {
            id: newCard.id || `manual-${Date.now()}`,
            _uiKey: `ui-box-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`, 
            name: newCard.name,
            group: newCard.group || '',
            pack: newCard.pack || 'その他',
            stars: newCard.stars || 0,
            subtype: calculatedSubtype, // 自動適用
            quantity: 1, 
            croppedImg: newCard.croppedImg || '',
            date: Date.now() + Math.random(),
            p_uid: newCard.p_uid || dbProfiles[0]?.id || profiles[0]?.id || null,
          };
        });

        setResults(prev => [...prev, ...finalStructuredCards]);
        setViewMode('review');
        setCustomAlert(`${finalStructuredCards.length}枚のカードを左上から順に自動判定しました。`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        showAlert('結果', 'カードを検出できませんでした。', 'info');
      }
    } catch (error) {
      console.error(error);
      showAlert('エラー', '写真解析に失敗しました。', 'error');
    } finally {
      setLoading(false);
      setStatus('待機中');
    }
  };

  const addManualCard = () => {
    setResults((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        _uiKey: `ui-manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: '',
        group: '',
        pack: '',
        stars: 0,
        subtype: '旧', // 手動もデフォルトは旧
        quantity: 1,
        croppedImg: '',
        date: Date.now(),
        p_uid: profiles[0]?.id || null,
      },
    ]);
  };

  const removeResult = (uiKey: string) => {
    setResults(prev => prev.filter(r => r._uiKey !== uiKey));
  };

  const updateSingleField = (uiKey: string, field: keyof ScannedCardResult, value: any) => {
    setResults(prev => prev.map(r => r._uiKey === uiKey ? { ...r, [field]: value } : r));
  };

  const openEditModal = (uiKey: string) => {
    const target = results.find(r => r._uiKey === uiKey);
    if (target) {
      setEditingUiKey(uiKey);
      setEditFormData({ ...target });
    }
  };

  const saveManualEdit = () => {
    if (!editingUiKey || !editFormData) return;
    
    let finalId = editFormData.id;
    if (!String(finalId).startsWith('manual-')) {
      const match = masterData.find(m => 
        String(m.name).replace(/\s+/g, '').toLowerCase() === String(editFormData.name).replace(/\s+/g, '').toLowerCase() &&
        Number(m.rank ?? 0) === Number(editFormData.stars ?? 0)
      );
      if (match) finalId = match.id;
      else finalId = `manual-${Date.now()}`;
    }

    setResults(prev => prev.map(r => r._uiKey === editingUiKey ? { ...editFormData, id: finalId } : r));
    setEditingUiKey(null);
    setEditFormData(null);
  };

  const saveAllCards = async () => {
    const invalidCards = results.filter(r => !r.name || !r.pack);
    if (invalidCards.length > 0) {
      return showAlert('エラー', `名前かパックが未入力のカードが${invalidCards.length}件あります。`, 'error');
    }
    if (results.length === 0) return showAlert('空です', '保存するカードがありません。', 'info');
    showAlert('保存確認', `${results.length}件をバインダーに保存しますか？`, 'info', executeSaveConfirmed, closeAlert);
  };

  const executeSaveConfirmed = async () => {
    closeAlert();
    setLoading(true);
    setStatus('保存中...');
    try {
      const userId = user?.uid;
      if (!userId) throw new Error("Auth Required");
      rememberUserId(userId);
      let queuedCount = 0;
      
      const customCards = results
        .filter(r => String(r.id).startsWith('manual-'))
        .map(r => ({
          id: `custom-${String(r.id).replace(/^manual-/, '')}`,
          name: r.name,
          pack: r.pack || 'カスタム',
          rank: Number(r.stars ?? 0),
          subtype: r.subtype || '',
          group: r.group || 'custom',
        }));

      if (customCards.length > 0) {
        addCustomMasterCards(customCards);
        setMasterData(getCachedMasterData());
      }

      for (const result of results) {
        if (!result.name) continue;
        const customCard = customCards.find(c => c.name === result.name && c.pack === (result.pack || 'カスタム'));
        
        const cardId = customCard?.id || result.id;
        const pUid = normalizePUid(result.p_uid || profiles[0]?.id);
        
        if (!cardId || !pUid) continue;

        let currentCount = 0;
        if (isOnline && userId) {
          const { data } = await supabase.from('inventory').select('count').eq('p_uid', pUid).eq('card_id', cardId).maybeSingle();
          currentCount = data?.count || 0;
        } else {
          const cached = getCachedRawCollection().find(item => item.card_id === cardId && normalizePUid(item.p_uid) === pUid);
          currentCount = Number(cached?.quantity) || 0;
        }

        const totalQuantity = currentCount + 1; 
        upsertCachedCollection({ user_id: userId, p_uid: pUid, card_id: cardId, quantity: totalQuantity });

        if (isOnline && userId) {
          try {
            const { error } = await supabase.from('inventory').upsert({ p_uid: pUid, card_id: cardId, count: totalQuantity }, { onConflict: 'p_uid,card_id' });
            if (error) throw error;
          } catch (e) {
            queueCollectionChange('upsert', { user_id: userId, p_uid: pUid, card_id: cardId, quantity: totalQuantity });
            queuedCount++;
          }
        } else {
          queueCollectionChange('upsert', { user_id: userId, p_uid: pUid, card_id: cardId, quantity: totalQuantity });
          queuedCount++;
        }
      }

      setImages([]);
      setResults([]);
      const msg = queuedCount > 0 ? `${queuedCount}件オフライン保存しました` : '保存完了しました';
      showAlert('完了', msg, 'success', () => router.push('/home'));
    } catch (e) {
      console.error(e);
      showAlert('エラー', '保存に失敗しました。', 'error');
    } finally { // ⭕️ タイポ修正完了
      setLoading(false);
      setStatus('待機中');
    }
  };

  if (!hasMounted) return <div className="min-h-screen bg-slate-950" />;

  return (
    <div className="flex flex-col max-w-md mx-auto min-h-screen bg-slate-50 pb-36">
      {/* Header */}
      <div className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20 px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex-1 ml-4">
            <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">direct add</h1>
          </div>
          {images.length > 0 && (
            <button onClick={() => { setPreviewImageSrc(images[0]); setIsPreviewOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white font-black text-[10px] rounded-lg shadow-sm">
              <Camera size={12} /> 確認
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="mt-4 px-4">
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] font-black text-blue-500 uppercase text-center mt-2 animate-pulse">{status}</p>
        </div>
      )}

      <div className="space-y-4 px-4 pt-4">
        <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-slate-200/60">
          <button onClick={() => setViewMode('capture')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'capture' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
            <Camera size={14} className="inline mr-1.5 -mt-0.5" /> 写真 {images.length > 0 && `(${images.length})`}
          </button>
          <button onClick={() => setViewMode('review')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'review' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
            <Layers size={14} className="inline mr-1.5 -mt-0.5" /> 結果 ({results.length})
          </button>
        </div>

        {viewMode === 'capture' && ( 
          <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
                <label className="flex flex-col items-center justify-center cursor-pointer group">
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                  <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl mb-5 active:scale-95 transition-transform">
                    <Camera size={32} className="text-white" strokeWidth={2} />
                  </div>
                  <p className="text-sm font-black text-slate-900">写真を追加</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">タップして選択 · 複数枚OK</p>
                </label>
                <button onClick={() => folderInputRef.current?.click()} className="text-[10px] font-black text-blue-600">フォルダを選択</button>
                <input ref={folderInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </div>
            ) : (
              <div className="p-4 grid grid-cols-2 gap-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer" onClick={() => { setPreviewImageSrc(img); setIsPreviewOpen(true); }}>
                    <Image src={img} fill unoptimized className="object-cover" alt="写真" />
                    <button onClick={(e) => { e.stopPropagation(); setImages(p => p.filter((_, i) => i !== idx)); }} className="absolute top-2 right-2 bg-slate-900/80 text-white p-1.5 rounded-full z-10"><X size={12} /></button>
                  </div>
                ))}
                <label className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30">
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                  <Plus size={28} />
                </label>
              </div>
            )}
          </section>
        )}

        {viewMode === 'review' && ( 
          <section className="space-y-3">
            {results.length > 0 ? (
              <>
                <div className="flex items-center justify-between px-1">
                  <div className="bg-slate-900 text-white rounded-xl px-4 py-3">
                    <p className="text-[8px] font-black uppercase text-white/50">検出枠数</p>
                    <p className="text-xl font-black italic">{results.length}<span className="text-[10px] ml-1">枠</span></p>
                  </div>
                  <button onClick={() => showAlert('確認', '結果を全て消去しますか？', 'info', () => { setResults([]); setViewMode('capture'); closeAlert(); }, closeAlert)} className="p-3 text-slate-400 hover:text-red-500 bg-white rounded-2xl">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="space-y-3">
                  {results.map((result) => {
                    return (
                      <div key={result._uiKey} onClick={() => openEditModal(result._uiKey)} className="bg-white border p-3 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer group active:scale-[0.99] border-slate-200/70">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative w-12 h-16 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                            {result.croppedImg ? <Image src={result.croppedImg} fill unoptimized className="object-cover" alt={result.name} /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Box size={16} /></div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black text-slate-900 truncate">{result.name || '未入力'}</h4>
                            <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">{result.pack || '未指定'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">★ {result.stars}</span>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${result.subtype === '新' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>{result.subtype}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {profiles.length > 1 && (
                            <select value={result.p_uid || ''} onChange={(e) => updateSingleField(result._uiKey, 'p_uid', e.target.value)} onClick={e => e.stopPropagation()} className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-600 focus:outline-none">
                              {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                            </select>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black px-2 py-1 bg-slate-100 text-slate-800 rounded-lg">x{result.quantity}</span>
                            <button onClick={(e) => { e.stopPropagation(); removeResult(result._uiKey); }} className="p-2 text-slate-300 hover:text-red-500 rounded-xl transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="h-28" />
              </>
            ) : (
              <div className="py-20 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm"><Layers size={32} className="mx-auto text-slate-300 mb-4" /><p className="text-[10px] font-black text-slate-400">結果がありません</p></div>
            )}
          </section>
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-[2rem] p-2 flex gap-2">
          {viewMode === 'capture' && images.length > 0 ? (
            <button onClick={handleBatchScan} disabled={loading} className="flex-1 h-14 rounded-2xl bg-blue-600 text-white font-black text-[11px] flex items-center justify-center gap-2 shadow-lg"><Sparkles size={16} /> AIスキャン</button>
          ) : (
            <>
              <button onClick={addManualCard} className={`h-14 px-6 rounded-[1.5rem] bg-slate-100 text-slate-600 font-black text-[10px] flex items-center justify-center gap-1.5 ${results.length === 0 ? 'flex-1' : ''}`}><Edit3 size={16} /> 手動追加</button>
              {results.length > 0 && <button onClick={saveAllCards} disabled={loading} className="flex-1 h-14 rounded-[1.5rem] bg-slate-900 text-white font-black text-[11px] flex items-center justify-center gap-2 shadow-lg"><Save size={16} /> バインダーに保存</button>}
            </>
          )}
        </div>
      </div>

      {/* 手動編集用モーダル */}
      {editingUiKey && editFormData && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-[2rem] p-5 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-black text-xs text-slate-900 uppercase">カード情報の編集</h4>
              <button onClick={() => { setEditingUiKey(null); setEditFormData(null); }} className="text-slate-400 p-1"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-[8px] font-black text-slate-400 block mb-1">カード名</label>
                <input type="text" value={editFormData.name} onChange={(e) => setEditFormData(p => p ? { ...p, name: e.target.value } : null)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500" />
              </div>
              <div><label className="text-[8px] font-black text-slate-400 block mb-1">パック名</label>
                <input type="text" value={editFormData.pack} onChange={(e) => setEditFormData(p => p ? { ...p, pack: e.target.value } : null)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[8px] font-black text-slate-400 block mb-1">星数 (0〜5)</label>
                  <input type="number" min={0} max={5} value={editFormData.stars} onChange={(e) => setEditFormData(p => p ? { ...p, stars: Number(e.target.value) } : null)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none" />
                </div>
                <div><label className="text-[8px] font-black text-slate-400 block mb-1">新旧</label>
                  <input type="text" value={editFormData.subtype} onChange={(e) => setEditFormData(p => p ? { ...p, subtype: e.target.value } : null)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none" />
                </div>
              </div>
            </div>
            <button onClick={saveManualEdit} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] active:scale-95 shadow-md">変更を確定</button>
          </div>
        </div>
      )}

      {/* プレビューモーダル */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4" onClick={() => setIsPreviewOpen(false)}>
          <button className="absolute top-6 right-6 text-white/70 bg-white/10 hover:bg-white/20 p-3 rounded-full"><X size={24} /></button>
          <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl">
            <Image src={previewImageSrc} fill unoptimized className="object-contain" alt="プレビュー" />
          </div>
        </div>
      )}

      <CustomAlert isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onConfirm={alertConfig.onConfirm} onCancel={alertConfig.onCancel} onClose={closeAlert} />
      {customAlert && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-[10px] font-black px-4 py-3 rounded-full shadow-lg backdrop-blur-sm">{customAlert}</div>}
    </div>
  );
}