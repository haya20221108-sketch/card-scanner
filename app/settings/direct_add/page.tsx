'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { inputAI } from './utils';
import Image from 'next/image';
import { supabase } from '../../supabase';
import { ensureProfiles } from '../../profileStore';
import {
  getCachedMasterData,
  getCachedProfiles,
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
  Box,
  Camera,
  Layers,
  Plus,
  Trash2,
  X,
  Sparkles,
  ChevronLeft,
  Edit3,
  FolderOpen,
  ArrowRight,
  FolderClosed,
  CheckCircle2,
  Zap
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
  quantity: number;
  croppedImg: string;
  date: number;
  p_uid: string | null;
  x?: number;
  y?: number;
  sourceImageIdx: number; 
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

  // ウィンドウ・モーダル管理ステート
  const [isAllImagesOpen, setIsAllImagesOpen] = useState(false);
  const [selectedImageIdxForCards, setSelectedImageIdxForCards] = useState<number | null>(null);
  const [isBinderSelectionOpen, setIsBinderSelectionOpen] = useState(false);
  
  const [editingUiKey, setEditingUiKey] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<ScannedCardResult | null>(null);

  const [alertConfig, setAlertConfig] = useState<AlertConfigState>({ isOpen: false, title: '', message: '', type: 'info' });
  const [customAlert, setCustomAlert] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const hasProfiles = profiles.length > 0;
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
        const res = await fetch(CONFIG.gasUrl);
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

  const handleBatchScan = async () => {
    if (images.length === 0 || loading) return;
    if (!hasProfiles) return showAlert('プロファイルが必要です', '設定でプロファイルを作成してください。', 'error');
    if (!canUseAiScan) return showAlert('API設定不足', 'Roboflow APIキーが設定されていません。', 'info');
    if (!isOnline) return showAlert('オフライン', 'ネットワーク接続が必要です。', 'info');
    if (masterData.length === 0) return showAlert('データ同期中', 'マスタデータが読み込まれていません。', 'error');

    setLoading(true);
    setStatus('AI解析エンジン初期化中...');
    setProgress(0);
    
    let allStructuredCards: ScannedCardResult[] = [];
    
    try {
      for (let i = 0; i < images.length; i++) {
        setStatus(`${i + 1}/${images.length} 枚目をスキャン中...`);
        const parsedBoxList = await inputAI(images[i], masterData) as any[];
        
        parsedBoxList.sort((a, b) => {
          const yDiff = (a.y || 0) - (b.y || 0);
          if (Math.abs(yDiff) > 40) return yDiff;
          return (a.x || 0) - (b.x || 0);
        });

        const historicalList: ScannedCardResult[] = parsedBoxList.map(newCard => {
          return {
            id: newCard.id || `manual-${Date.now()}`,
            _uiKey: `ui-box-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`, 
            name: newCard.name,
            group: newCard.group || '',
            pack: newCard.pack || 'その他',
            stars: newCard.stars || 0,
            subtype: '', 
            quantity: newCard.quantity || 1,
            croppedImg: newCard.croppedImg || '',
            date: Date.now() + Math.random(),
            p_uid: null,
            sourceImageIdx: i 
          };
        });

        allStructuredCards.push(...historicalList);
        setProgress(Math.round(((i + 1) / images.length) * 100));
      }

      if (allStructuredCards.length > 0) {
        setResults(prev => [...prev, ...allStructuredCards]);
        setViewMode('review');
        setCustomAlert(`スキャン完了: ${allStructuredCards.length}枚のカードを検出。`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        showAlert('スキャン結果', 'カードを検出できませんでした。', 'info');
      }
    } catch (error) {
      console.error(error);
      showAlert('エラー', '画像解析セッションの実行に失敗しました。', 'error');
    } finally {
      setLoading(false);
      setStatus('待機中');
    }
  };

  const updateQuantity = (uiKey: string, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setResults(prev =>
      prev.map(item => {
        if (item._uiKey === uiKey) {
          return { ...item, quantity: Math.max(1, item.quantity + delta) };
        }
        return item;
      })
    );
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
        subtype: '', 
        quantity: 1,
        croppedImg: '',
        date: Date.now(),
        p_uid: null,
        sourceImageIdx: -1
      },
    ]);
  };

  const removeResult = (uiKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setResults(prev => prev.filter(r => r._uiKey !== uiKey));
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

  // 💡 属性未選択状態（DBにsubtypeがあり未入力）のカードに対して一括でsubtypeを割り当てる関数
  const bulkApplySubtype = (typeValue: '新' | '旧') => {
    let updateCount = 0;
    setResults(prev => prev.map(r => {
      const dbHasSubtype = masterData.some(m => m.id === r.id && m.subtype && m.subtype.trim() !== '');
      const isEmpty = !r.subtype || r.subtype.trim() === '';
      if (dbHasSubtype && isEmpty) {
        updateCount++;
        return { ...r, subtype: typeValue };
      }
      return r;
    }));
    if (updateCount > 0) {
      setCustomAlert(`${updateCount}件のカードにタイプ「${typeValue}」を一括適用しました`);
    } else {
      setCustomAlert('一括適用の対象となるカード（要選択状態）がありません');
    }
  };

  // バインダー検証 ＆ ポップアップオープン
  const handleOpenBinderSelection = () => {
    const invalidCards = results.filter(r => !r.name || !r.pack);
    if (invalidCards.length > 0) {
      return showAlert('入力未完了', `名前またはパック名が空欄の箇所が ${invalidCards.length} 件あります。`, 'error');
    }
    if (results.length === 0) return showAlert('データなし', 'バインダーへ登録するカードがありません。', 'info');

    const hasUnresolvedSubtype = results.some(r => {
      const dbHasSubtype = masterData.some(m => m.id === r.id && m.subtype && m.subtype.trim() !== '');
      return dbHasSubtype && (!r.subtype || r.subtype.trim() === '');
    });

    if (hasUnresolvedSubtype) {
      return showAlert('属性未選択', 'マスタ上、新旧等のタイプ選択が必要なカードが残っています。リストの警告表示、または「一括属性入力」機能を利用して完了させてください。', 'error');
    }

    setIsBinderSelectionOpen(true);
  };

  const executeRegisterToSelectedBinder = async (selectedProfileId: string, selectedProfileName: string) => {
    setIsBinderSelectionOpen(false);
    setLoading(true);
    setStatus(`[${selectedProfileName}] へ登録中...`);
    
    try {
      const userId = user?.uid;
      if (!userId) throw new Error("認証が必要です");
      rememberUserId(userId);
      
      const pUid = normalizePUid(selectedProfileId);

      for (const result of results) {
        if (!result.name || !result.id) continue;

        let currentCount = 0;
        if (isOnline && userId) {
          const { data } = await supabase.from('inventory').select('count').eq('p_uid', pUid).eq('card_id', result.id).maybeSingle();
          currentCount = data?.count || 0;
        }

        const totalQuantity = currentCount + result.quantity; 
        upsertCachedCollection({ user_id: userId, p_uid: pUid, card_id: result.id, quantity: totalQuantity });

        if (isOnline && userId) {
          await supabase.from('inventory').upsert({ p_uid: pUid, card_id: result.id, count: totalQuantity }, { onConflict: 'p_uid,card_id' });
        } else {
          queueCollectionChange('upsert', { user_id: userId, p_uid: pUid, card_id: result.id, quantity: totalQuantity });
        }
      }

      setImages([]);
      setResults([]);
      showAlert('登録完了', `バインダー [${selectedProfileName}] へ正常に登録されました。`, 'success', () => router.push('/home'));
    } catch (e) {
      console.error(e);
      showAlert('エラー', 'バインダー登録中にエラーが発生しました。', 'error');
    } finally {
      setLoading(false);
      setStatus('待機中');
    }
  };

  if (!hasMounted) return <div className="min-h-screen bg-white" />;

  // 💡 「要選択」の条件を満たすカードの総数をカウント（一括バーの表示制御用）
  const pendingSubtypeCount = results.filter(r => {
    const dbHasSubtype = masterData.some(m => m.id === r.id && m.subtype && m.subtype.trim() !== '');
    return dbHasSubtype && (!r.subtype || r.subtype.trim() === '');
  }).length;

  return (
    <div className="flex flex-col max-w-md mx-auto min-h-screen bg-white text-slate-900 pb-44 font-sans antialiased">
      
      {/* Light Clean Header */}
      <div className="bg-white/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <Link href="/settings" className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-md font-black tracking-widest text-slate-900 uppercase">
            Card Scanner
          </h1>
        </div>
        <div className="w-8" />
      </div>

      {/* Progress */}
      {loading && (
        <div className="px-4 pt-3">
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-900 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] font-bold text-slate-600 text-center mt-1.5 animate-pulse">{status} ({progress}%)</p>
        </div>
      )}

      <div className="space-y-4 px-4 pt-4">
        
        {/* Navigation Tabs */}
        <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200 shadow-sm">
          <button onClick={() => setViewMode('capture')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${viewMode === 'capture' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-400 hover:text-slate-600'}`}>
            <Camera size={13} /> スキャンソース
          </button>
          <button onClick={() => setViewMode('review')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${viewMode === 'review' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-400 hover:text-slate-600'}`}>
            <Layers size={13} /> 検出結果 ({results.length})
          </button>
        </div>

        {/* --- SOURCE VIEW --- */}
        {viewMode === 'capture' && (
          <section className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-2xl p-8 text-center">
              <label className="flex flex-col items-center cursor-pointer">
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center shadow-md mb-4 hover:scale-105 active:scale-95 transition-transform">
                  <Plus size={24} className="text-white" />
                </div>
                <h3 className="text-xs font-black text-slate-800">画像・ファイルを追加</h3>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[220px]">
                  タップしてカメラ起動、またはアルバムから複数選択可能
                </p>
              </label>
              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-center">
                <button onClick={() => folderInputRef.current?.click()} className="flex items-center gap-1 text-[10px] font-black text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <FolderOpen size={12} /> フォルダ一括アップロード
                </button>
              </div>
              <input ref={folderInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
                    <Image src={img} fill unoptimized className="object-cover" alt="Source Grid" />
                    <button onClick={() => setImages(p => p.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-slate-900/80 text-white p-1 rounded-md">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* --- REVIEW VIEW (DYNAMIC LIST & CAROUSEL) --- */}
        {viewMode === 'review' && (
          <section className="space-y-4">
            
            {/* カルーセル画像スライダー */}
            {images.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">送信画像（タップして個別枠を配置表示）</p>
                <div className="flex gap-2.5 overflow-x-auto pb-2 px-1 snap-x scrollbar-none">
                  {images.map((img, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedImageIdxForCards(idx)}
                      className="snap-center shrink-0 w-28 aspect-[3/4] relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm cursor-pointer active:scale-95 transition-transform"
                    >
                      <Image src={img} fill unoptimized className="object-cover" alt={`Slider ${idx}`} />
                      <div className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[8px] font-mono px-1 rounded">
                        #{idx + 1}
                      </div>
                    </div>
                  ))}
                  
                  <div 
                    onClick={() => setIsAllImagesOpen(true)}
                    className="snap-center shrink-0 w-28 aspect-[3/4] rounded-xl border border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-3 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <FolderOpen size={18} className="text-slate-500 mb-1" />
                    <span className="text-[9px] font-black text-slate-700">全画像一覧</span>
                    <span className="text-[7px] text-slate-400 mt-0.5 flex items-center gap-0.5">Windowへ <ArrowRight size={8} /></span>
                  </div>
                </div>
              </div>
            )}

            {/* 💡 追加入荷：一括subtype属性入力バー */}
            {pendingSubtypeCount > 0 && (
              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl space-y-2 shadow-sm animate-fade-in">
                <div className="flex items-center gap-1.5">
                  <Zap size={12} className="text-slate-700" />
                  <p className="text-[10px] font-black text-slate-700">
                    属性の未入力が <span className="text-rose-600 font-mono text-xs">{pendingSubtypeCount}</span> 件あります
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => bulkApplySubtype('新')}
                    className="py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-black text-[10px] rounded-xl shadow-inner transition-all flex items-center justify-center gap-1"
                  >
                    未選択をすべて「新」に指定
                  </button>
                  <button 
                    onClick={() => bulkApplySubtype('旧')}
                    className="py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-black text-[10px] rounded-xl shadow-inner transition-all flex items-center justify-center gap-1"
                  >
                    未選択をすべて「旧」に指定
                  </button>
                </div>
              </div>
            )}

            {/* インベントリログヘッダー */}
            <div className="flex items-center justify-between px-1">
              <p className="text-[9px] font-black tracking-wider text-slate-400 uppercase">検出インベントリログ ({results.length})</p>
              {results.length > 0 && (
                <button onClick={() => showAlert('リストクリア', '検出データをすべて消去しますか？', 'info', () => { setResults([]); setViewMode('capture'); closeAlert(); }, closeAlert)} className="text-[9px] font-black text-red-500 hover:underline">
                  すべて消去
                </button>
              )}
            </div>

            {/* 刷新された高視認性カードリスト */}
            <div className="space-y-3">
              {results.length > 0 ? (
                results.map((result) => {
                  const masterHasSubtype = masterData.some(
                    m => m.id === result.id && m.subtype && m.subtype.trim() !== ''
                  );
                  const isSubtypeRequiredButEmpty = masterHasSubtype && (!result.subtype || result.subtype.trim() === '');

                  return (
                    <div 
                      key={result._uiKey} 
                      onClick={() => openEditModal(result._uiKey)} 
                      className="group bg-white border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between gap-4 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:border-slate-300 transition-all duration-200"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {/* きれいな抜き出し全体画像 */}
                        <div className="relative w-14 h-18 bg-slate-50 rounded-xl overflow-hidden border border-slate-200/80 shadow-inner flex-shrink-0 group-hover:scale-[1.02] transition-transform duration-200">
                          {result.croppedImg ? (
                            <Image src={result.croppedImg} fill unoptimized className="object-cover" alt="card preview" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50"><Box size={16} /></div>
                          )}
                        </div>

                        {/* テキストメタエリア */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {result.group && (
                              <span className="text-[7.5px] font-black tracking-wider text-slate-400 uppercase bg-slate-100 px-1 py-0.5 rounded">{result.group}</span>
                            )}
                            {result.sourceImageIdx !== -1 && (
                              <span className="text-[7.5px] font-mono font-medium text-slate-400 bg-slate-50 border border-slate-200/60 px-1 rounded">IMG #{result.sourceImageIdx + 1}</span>
                            )}
                          </div>
                          <h4 className="text-xs font-black text-slate-900 truncate leading-tight group-hover:text-slate-950">
                            {result.name || <span className="text-slate-300 italic font-normal">名前未指定のカード</span>}
                          </h4>
                          <p className="text-[9.5px] text-slate-400 truncate font-medium">{result.pack || 'パック情報なし'}</p>

                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-[8.5px] font-mono font-black bg-slate-900 text-white px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">★ {result.stars}</span>
                            {/* 属性要選択バッジの条件表示切り替え */}
                            {isSubtypeRequiredButEmpty ? (
                              <span className="text-[8.5px] font-black px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-md flex items-center gap-1 animate-pulse">
                                <span className="w-1 h-1 rounded-full bg-rose-500" /> 属性 要選択
                              </span>
                            ) : result.subtype ? (
                              <span className="text-[8.5px] font-black px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md">タイプ: {result.subtype}</span>
                            ) : (
                              <span className="text-[8.5px] font-medium px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-200/60 border-dashed rounded-md">通常型</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* カウンター */}
                      <div className="flex items-center gap-2.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-xl p-0.5 shadow-inner">
                          <button onClick={(e) => updateQuantity(result._uiKey, -1, e)} className="w-5 h-5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 active:scale-90 font-black text-xs flex items-center justify-center transition-all">-</button>
                          <span className="w-6 text-center text-xs font-mono font-black text-slate-800">{result.quantity}</span>
                          <button onClick={(e) => updateQuantity(result._uiKey, 1, e)} className="w-5 h-5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 active:scale-90 font-black text-xs flex items-center justify-center transition-all">+</button>
                        </div>
                        <button onClick={(e) => removeResult(result._uiKey, e)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-slate-400 text-[10px] font-bold">検出データまたは追加カードがありません。</div>
              )}
            </div>
            <div className="h-32" />
          </section>
        )}
      </div>

      {/* --- FOOTER ACTION HUB --- */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
        <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-2 flex gap-2">
          {viewMode === 'capture' && images.length > 0 ? (
            <button onClick={handleBatchScan} disabled={loading} className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow transition-all">
              <Sparkles size={14} /> AI一括スキャンを開始
            </button>
          ) : (
            <>
              <button onClick={addManualCard} className={`h-12 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center gap-1 transition-all ${results.length === 0 ? 'flex-1' : ''}`}>
                <Edit3 size={13} /> 手動追加
              </button>
              {results.length > 0 && (
                <button onClick={handleOpenBinderSelection} disabled={loading} className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow transition-all">
                  <FolderClosed size={13} /> バインダーを選択
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* WINDOW 1: 送信画像アルバム一覧 */}
      {isAllImagesOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-100">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">送信画像アルバム一覧</h3>
              <button onClick={() => setIsAllImagesOpen(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-3 gap-2.5">
              {images.map((img, idx) => (
                <div key={idx} onClick={() => { setSelectedImageIdxForCards(idx); setIsAllImagesOpen(false); }} className="relative aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:border-slate-400 transition-colors">
                  <Image src={img} fill unoptimized className="object-cover" alt="" />
                  <div className="absolute top-1 left-1 bg-slate-900/70 text-white text-[8px] px-1 font-mono rounded">#{idx + 1}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* WINDOW 2: 画像個別抽出モーダル */}
      {selectedImageIdxForCards !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900">画像 #{selectedImageIdxForCards + 1} の配置配列結果</h3>
                <p className="text-[8px] text-slate-400 mt-0.5">左上から右下へかけて配置順に表示しています</p>
              </div>
              <button onClick={() => setSelectedImageIdxForCards(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 bg-slate-50/50">
              {results.filter(r => r.sourceImageIdx === selectedImageIdxForCards).length > 0 ? (
                results.filter(r => r.sourceImageIdx === selectedImageIdxForCards).map((card, gridIdx) => (
                  <div key={card._uiKey} className="bg-white border border-slate-200 p-2.5 rounded-xl flex items-center gap-3">
                    <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-mono font-black text-slate-400 border border-slate-200 shrink-0">{gridIdx + 1}</div>
                    <div className="relative w-9 h-12 bg-slate-50 border rounded overflow-hidden shrink-0">
                      {card.croppedImg ? <Image src={card.croppedImg} fill unoptimized className="object-cover" alt="" /> : <Box size={12} className="m-auto text-slate-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-slate-900 truncate">{card.name || '未指定'}</p>
                      <p className="text-[8px] text-slate-400 truncate">{card.pack}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-mono font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">x{card.quantity}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-10 text-[10px] font-bold text-slate-400">対象のデータがありません。</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WINDOW 3: バインダー（プロファイル）選択ウィンドウ */}
      {isBinderSelectionOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl max-h-[80vh] flex flex-col shadow-2xl animate-fade-in">
            <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">登録先バインダーの指定</h3>
                <p className="text-[8px] text-slate-400 mt-0.5">インベントリを同期させる格納先を選んでください</p>
              </div>
              <button onClick={() => setIsBinderSelectionOpen(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 flex-1 bg-slate-50/50">
              {profiles.length > 0 ? (
                profiles.map((p) => (
                  <div 
                    key={p.id} 
                    onClick={() => executeRegisterToSelectedBinder(p.id, p.display_name)}
                    className="w-full p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-900 hover:shadow-sm active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700"><FolderClosed size={16} /></div>
                      <span className="text-xs font-black text-slate-800">{p.display_name}</span>
                    </div>
                    <CheckCircle2 size={14} className="text-slate-300 group-hover:text-slate-900" />
                  </div>
                ))
              ) : (
                <p className="text-center text-[10px] py-8 text-slate-400">有効なバインダーがありません。</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL EDIT MODAL */}
      {editingUiKey && editFormData && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-black text-xs text-slate-900 uppercase">カード情報の編集</h4>
              <button onClick={() => { setEditingUiKey(null); setEditFormData(null); }} className="text-slate-400 p-1"><X size={15} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase tracking-wider">カード名</label>
                <input type="text" value={editFormData.name} onChange={(e) => setEditFormData(p => p ? { ...p, name: e.target.value } : null)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-slate-900" />
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase tracking-wider">収録パック</label>
                <input type="text" value={editFormData.pack} onChange={(e) => setEditFormData(p => p ? { ...p, pack: e.target.value } : null)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-slate-900" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase tracking-wider">星 (★)</label>
                  <input type="number" min={0} max={5} value={editFormData.stars} onChange={(e) => setEditFormData(p => p ? { ...p, stars: Number(e.target.value) } : null)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-800" />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase tracking-wider">新旧属性</label>
                  <select value={editFormData.subtype} onChange={(e) => setEditFormData(p => p ? { ...p, subtype: e.target.value } : null)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-2 text-xs font-bold text-slate-800">
                    <option value="">未選択</option>
                    <option value="新">新</option>
                    <option value="旧">旧</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase tracking-wider">数量</label>
                  <input type="number" min={1} value={editFormData.quantity} onChange={(e) => setEditFormData(p => p ? { ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) } : null)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-mono font-bold text-slate-800" />
                </div>
              </div>
            </div>
            <button onClick={saveManualEdit} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-[10px] shadow-sm">変更を確定する</button>
          </div>
        </div>
      )}

      <CustomAlert isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onConfirm={alertConfig.onConfirm} onCancel={alertConfig.onCancel} onClose={closeAlert} />
      {customAlert && <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-[10px] font-black px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">{customAlert}</div>}
    </div>
  );
}