'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';

import {
  ChevronLeft,
  Search,
  Award,
  Inbox,
  SlidersHorizontal,
  Filter,
  XCircle,
  X,
  Save,
  Package,
  Plus,
  Minus,
  User,
  Camera,
  Edit3,
  RefreshCw,
  Zap,
  Star,
  Settings2,
  ArrowLeftRight,
} from 'lucide-react';

import { supabase } from '../supabase';
import { ensureProfiles, upsertInventoryItem } from '../profileStore';
import {
  getCachedMasterData,
  getCachedRawCollection,
  getCachedProfiles,
  getCachedUserId,
  getDbBackedProfiles,
  getOnlineStatus,
  rememberUserId,
  normalizePUid,
  setCachedProfiles,
  setCachedRawCollection,
  upsertCachedCollection,
  setCachedMasterData,
  queueCollectionChange,
} from '../offline';
import { resolveCardDisplay } from '../components/utils';
import { CustomAlert } from '../components/CustomAlert';
import { useAuth } from '../../AuthContext';

// =========================
// 型定義
// =========================

interface Card {
  id: string;
  name?: string;
  image_url?: string;
  rank?: number;
  pack?: string;
}

interface Profile {
  id: string;
  display_name?: string;
}

interface CollectionRecord {
  card_id: string;
  p_uid?: string;
  quantity: number;
}

const MASTER_DATA_URL = 'https://script.google.com/macros/s/AKfycbzE912QE7aAjrxboaW8jLnjJ-tTW7JzePfkREe3vpnTYMsghP4eRMWd_cEK3ffLQn3w4Q/exec';

async function requestWithTimeout<T>(promise: PromiseLike<T>, timeoutMs = 20000): Promise<T> {
  return await Promise.race([
    promise as Promise<T>,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeoutMs)),
  ]);
}

// =========================
// Page
// =========================

export default function CollectionPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  const [allCards, setAllCards] = useState<Card[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const dbProfiles = useMemo(() => getDbBackedProfiles(profiles), [profiles]);
  const [ownedCardIds, setOwnedCardIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPack, setFilterPack] = useState<string>('');
  const [filterRanks, setFilterRanks] = useState<number[]>([]);
  const [filterProfiles, setFilterProfiles] = useState<string[]>([]);
  const [filterOwnership, setFilterOwnership] = useState<'all' | 'owned' | 'unowned' | 'trade'>('all');

  // Sorting
  const [sortBy, setSortBy] = useState<'rank-desc' | 'rank-asc' | 'name-asc' | 'pack-asc'>('rank-desc');

  // Modal
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('binder_prefs');
    if (saved) {
      try {
        const { sortBy: s, filterOwnership: o } = JSON.parse(saved);
        if (s) setSortBy(s);
        if (o) setFilterOwnership(o);
      } catch (e) {
        console.error('Failed to load prefs:', e);
      }
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    if (!hasMounted) return;
    localStorage.setItem('binder_prefs', JSON.stringify({ sortBy, filterOwnership }));
  }, [sortBy, filterOwnership, hasMounted]);

  // Custom Alert State
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
    setAlertConfig((prev) => ({ ...prev, isOpen: false, onConfirm: undefined, onCancel: undefined }));
  };

  // Batch Mode
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchPUid, setBatchPUid] = useState<string | null>(null);

  const [editingQuantities, setEditingQuantities] = useState<{
    [profileId: string]: number;
  }>({});

  // =========================
  // Load Data
  // =========================

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const isOnline = getOnlineStatus();

      let masterData = (getCachedMasterData() || []) as Card[];
      if (masterData.length === 0 && isOnline) {
        try {
          const res = await requestWithTimeout(fetch(MASTER_DATA_URL), 25000);
          const data = await res.json();
          const filtered = data.filter((card: any) => card.name && !['名前', 'name'].includes(String(card.name).toLowerCase()));
          setCachedMasterData(filtered);
          masterData = getCachedMasterData() as Card[];
        } catch (error) {
          console.error('Master sync failed:', error);
        }
      }
      setAllCards(masterData);
      
      const profData =
        (getCachedProfiles() || []) as Profile[];
      setProfiles(profData.filter((p) => p.id !== null));

      if (profData.length > 0 && !batchPUid) {
        setBatchPUid(profData[0].id);
      }

      let collData: CollectionRecord[] = [];

      if (isOnline) {
        const userId = user?.uid || getCachedUserId();
        rememberUserId(userId);
        if (userId) {
          let freshProfiles: Profile[] = profData;
          try {
            freshProfiles = (await ensureProfiles(userId)) as Profile[];
            setProfiles(freshProfiles);
            setCachedProfiles(freshProfiles);
            if (freshProfiles.length > 0 && !batchPUid) {
              setBatchPUid(freshProfiles[0].id);
            }
          } catch (error) {
            console.error('Profile sync failed:', error);
          }

          try {
            const response = await Promise.race([
              supabase
                .from('inventory')
                .select('card_id, p_uid, count')
                .in('p_uid', freshProfiles.map(p => p.id)),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase request timed out')), 25000)),
            ]);

            const res = response as any;
            if (res && typeof res === 'object' && 'data' in res && !res.error && Array.isArray(res.data)) {
              collData = res.data.map((r: any) => ({
                card_id: r.card_id,
                p_uid: r.p_uid,
                quantity: r.count
              })) as CollectionRecord[];
              // キャッシュ保存時はUI側の期待に合わせて user_id を付与（オプション）
              setCachedRawCollection(collData.map((record) => ({ ...record, user_id: userId })));
            } else if (res && typeof res === 'object' && 'error' in res && res.error) {
              console.error('Supabase collection fetch error:', res.error, JSON.stringify(res.error));
            } else {
              console.warn('Supabase collection fetch unexpected response:', response);
            }
          } catch (error) {
            console.error('Supabase collection fetch failed:', error);
          }
        }
      }

      // オンラインで取得できなかった場合、またはオフラインの場合はキャッシュを使用
      if (collData.length === 0) {
        collData = (getCachedRawCollection() || []) as CollectionRecord[];
      }

      setCollectionRecords(collData);

      const owned = new Set(
        collData
          .filter((r) => (r.quantity || 0) > 0)
          .map((r) => String(r.card_id))
      );

      setOwnedCardIds(owned);
    } finally {
      setLoading(false);
    }
  }, [batchPUid, user]);

  useEffect(() => {
    setHasMounted(true);
    loadData();
  }, [loadData]);

  // =========================
  // Data Helpers
  // =========================
  const allPacks = useMemo(() => {
    return Array.from(new Set(allCards.map(c => c.pack).filter(Boolean))).sort();
  }, [allCards]);

  const allRanks = useMemo(() => {
    return Array.from(new Set(allCards.map(c => c.rank ?? 0))).sort((a, b) => a - b);
  }, [allCards]);

  const activeFilterCount = useMemo(() => {
    return [
      filterPack, 
      filterRanks.length > 0, 
      filterProfiles.length > 0, 
      filterOwnership !== 'all',
      sortBy !== 'rank-desc'
    ].filter(Boolean).length;
  }, [filterPack, filterRanks, filterProfiles, filterOwnership, sortBy]);

  // =========================
  // Stats Map
  // =========================

  const cardStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        profileQuantities: Record<string, number>;
      }
    >();

    collectionRecords.forEach((r) => {
      const cId = String(r.card_id);

      const pId = normalizePUid(
        r.p_uid || ''
      );

      const qty = r.quantity || 0;

      if (!map.has(cId)) {
        map.set(cId, {
          total: 0,
          profileQuantities: {},
        });
      }

      const entry = map.get(cId)!;

      entry.total += qty;
      entry.profileQuantities[pId] = qty;
    });

    return map;
  }, [collectionRecords]);

  // =========================
  // Filtered Cards
  // =========================

  const filteredCards = useMemo(() => {
    const result = allCards.filter((card) => {
      const stats = cardStatsMap.get(String(card.id));
      const total = stats?.total || 0;

      // 名前検索
      const display = resolveCardDisplay(card);
      if (searchQuery && !display.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

      // Ownership
      if (filterOwnership === 'owned' && total === 0) return false;
      if (filterOwnership === 'unowned' && total > 0) return false;
      if (filterOwnership === 'trade' && total <= 1) return false;

      // ランク
      if (filterRanks.length > 0 && !filterRanks.includes(card.rank ?? 0)) return false;

      // パック
      if (filterPack && card.pack !== filterPack) return false;

      // プロファイル（アカウント）
      if (filterProfiles.length > 0) {
        const isOwnedBySelected = filterProfiles.some(pId => (stats?.profileQuantities[normalizePUid(pId)] || 0) > 0);
        if (!isOwnedBySelected) return false;
      }

      return true;
    });

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'rank-desc': return (b.rank || 0) - (a.rank || 0);
        case 'rank-asc': return (a.rank || 0) - (b.rank || 0);
        case 'name-asc': return resolveCardDisplay(a).name.localeCompare(resolveCardDisplay(b).name);
        case 'pack-asc': return (a.pack || '').localeCompare(b.pack || '');
        default: return 0;
      }
    });
  }, [allCards, searchQuery, filterOwnership, filterRanks, filterPack, filterProfiles, cardStatsMap, sortBy]);

  // =========================
  // Completion Stats
  // =========================
  const collectionProgress = useMemo(() => {
    const targetCards = filterPack 
      ? allCards.filter(c => c.pack === filterPack)
      : allCards;
    
    if (targetCards.length === 0) return null;
    
    const ownedCount = targetCards.filter(c => (cardStatsMap.get(String(c.id))?.total || 0) > 0).length;
    const total = targetCards.length;
    const percent = Math.round((ownedCount / total) * 100);
    return { ownedCount, total, percent };
  }, [allCards, filterPack, cardStatsMap]);

  // =========================
  // Open Detail
  // =========================

  const openCardDetail = (card: Card) => {
    const initialQuantities: {
      [profileId: string]: number;
    } = {};

    profiles.forEach((prof) => {
      const stats = cardStatsMap.get(
        String(card.id)
      );

      initialQuantities[prof.id] =
        stats?.profileQuantities[
          normalizePUid(prof.id)
        ] || 0;
    });

    setEditingQuantities(initialQuantities);

    setSelectedCard(card);

    setIsEditing(false);
  };

  // =========================
  // Update Qty
  // =========================

  const updateQuantity = (
    profileId: string,
    delta: number
  ) => {
    setEditingQuantities((prev) => ({
      ...prev,
      [profileId]: Math.max(
        0,
        (prev[profileId] || 0) + delta
      ),
    }));
  };

  // =========================
  // Trigger Save Confirmation
  // =========================
  const triggerSaveConfirmation = () => {
    showAlert(
      '変更を保存',
      '所持数の変更をデータベースに保存しますか？',
      'info', // 確認ダイアログなのでinfoタイプを使用
      async () => {
        await handleSave();
        closeAlert();
      },
      closeAlert // キャンセルされたらアラートを閉じる
    );
  };

  // =========================
  // Save (Card Detail Modal)
  // =========================

  const handleSave = async () => {
    if (!selectedCard) return;

    const userId = user?.uid || getCachedUserId();
    rememberUserId(userId);
    if (!userId) {
      showAlert('Auth Required', 'ユーザーIDが見つかりません。再ログインしてください。', 'error');
      return;
    }

    setLoading(true);
    const isOnline = getOnlineStatus();
    let queuedCount = 0;

    try {
      if (profiles.length === 0) {
        showAlert('アカウントがありません', '設定 > Profiles でアプリ内アカウントを作成してください。', 'error');
        return;
      }

      // 各プロフィールごとの更新処理
      for (const profileId of Object.keys(editingQuantities)) {
        const count = editingQuantities[profileId];
        const cardId = String(selectedCard.id);

        // 1. ローカルキャッシュを即座に更新（UI反映）
        upsertCachedCollection({
          user_id: userId,
          p_uid: profileId, // profileId は p_uid (string)
          card_id: cardId,
          quantity: count,
        });

        // 2. オンラインならDBへ、オフラインならキューへ
        if (isOnline) {
          try {
            await upsertInventoryItem(profileId, cardId, count);
          } catch (e) {
            console.warn('Sync failed, queuing instead:', e);
            queueCollectionChange('upsert', { user_id: userId, p_uid: profileId, card_id: cardId, quantity: count });
            queuedCount++;
          }
        } else {
          queueCollectionChange('upsert', { user_id: userId, p_uid: profileId, card_id: cardId, quantity: count });
          queuedCount++;
        }
      }

      const message = queuedCount > 0 
        ? `${queuedCount}件の変更を保存しました（オフライン）。後で同期されます。`
        : '変更をデータベースに保存しました。';
      
      showAlert('保存完了', message, 'success');
      setSelectedCard(null);
      loadData(); 
    } catch (e: any) {
      console.error('Detail Save Error:', e);
      showAlert('System Error', '保存中にエラーが発生しました。', 'error');
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // Actions
  // =========================

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    setIsFilterOpen(false); // パネルを閉じて操作しやすくする
  };

  // =========================
  // Trigger Batch Save Confirmation
  // =========================
  const triggerBatchSaveConfirmation = () => {
    showAlert(
      '一括保存',
      '全ての変更をデータベースに同期しますか？',
      'info',
      async () => {
        await handleBatchSave();
        closeAlert();
      },
      closeAlert
    );
  };

  const handleBatchSave = async () => {
    const isOnline = getOnlineStatus();
    if (!isOnline) {
      showAlert('Offline Mode', '変更をDBに保存できません。接続を確認してください。', 'error');
      return;
    }

    const userId = user?.uid || getCachedUserId();
    rememberUserId(userId);
    if (!userId) {
      showAlert('Auth Error', 'セッションが切れました。ログインしてください。', 'error');
      return;
    }

    setLoading(true);
    try {
      // 現在のメモリ上のコレクションデータをSupabase形式に整形
      const upsertData = collectionRecords
        .filter(r => r.p_uid) // 安全のためp_uidがあるもののみ
        .map(r => ({
          card_id: String(r.card_id),
          p_uid: r.p_uid,
          count: r.quantity
        }));

      if (upsertData.length === 0) {
        showAlert('No Changes', '保存する変更がありません。', 'info');
        setIsBatchMode(false);
        return;
      }

      const { error } = await requestWithTimeout<{ error: any }>(
        supabase
          .from('inventory')
          .upsert(upsertData, { onConflict: 'p_uid,card_id' }),
        20000
      );

      if (error) throw error;

      // データベース保存成功後にローカルキャッシュも一括更新
      upsertData.forEach(data => upsertCachedCollection({
        card_id: data.card_id,
        p_uid: data.p_uid,
        quantity: data.count,
        user_id: userId
      }));

      setIsBatchMode(false);
    } catch (e) {
      console.error('Batch Save Error:', e);
      showAlert('Save Failed', '一括保存中にエラーが発生しました。', 'error');
    } finally {
      setLoading(false);
    }
  }; 

  const handleSyncMaster = async () => {
    const isOnline = getOnlineStatus();
    if (!isOnline) {
      showAlert('Connect Required', 'オフラインです。オンライン時に実行してください。', 'info');
      return;
    }
    try {
      const res = await fetch(MASTER_DATA_URL);
      const data = await res.json();
      const filtered = data.filter((card: any) => card.name && !['名前', 'name'].includes(String(card.name).toLowerCase()));
      setCachedMasterData(filtered);
      setAllCards(getCachedMasterData() as Card[]);
      showAlert('Sync Complete', 'カードデータを同期しました。', 'success');
    } catch (e) {
      showAlert('Sync Error', 'マスタデータの同期に失敗しました。', 'error');
    }
  };

  const handleBatchAdd = (cardId: string) => {
    if (!profiles.length) {
      showAlert('アカウントがありません', '設定 > Profiles でアプリ内アカウントを作成してください。', 'error');
      return;
    }
    if (!batchPUid) {
      showAlert('アカウントを選択', '追加先のアカウントを選択してください', 'info');
      return;
    }
    
    const targetPId = normalizePUid(batchPUid);
    const stats = cardStatsMap.get(cardId);
    const currentQty = stats?.profileQuantities[targetPId] || 0;
    const nextQty = currentQty + 1;

    // UIに即時反映
    setCollectionRecords((prev) => {
      const idx = prev.findIndex((r: CollectionRecord) => 
        String(r.card_id) === cardId && normalizePUid(r.p_uid || '') === targetPId
      );
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: nextQty } as CollectionRecord;
        return next;
      } else {
        return [...prev, { card_id: cardId, p_uid: batchPUid || '', quantity: nextQty }];
      }
    });

    if (nextQty > 0) {
      setOwnedCardIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.add(cardId);
        return nextSet;
      });
    }
  };

  // =========================
  // SSR Guard
  // =========================

  if (!hasMounted) return null;

  // =========================
  // Loading
  // =========================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
        <p className="text-sm text-slate-400">
          Loading collection...
        </p>
      </div>
    );
  }

  // =========================
  // UI
  // =========================

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20 px-6 py-4 pt-8">
        <div className="flex items-center justify-between">
          <Link
            href="/settings"
            className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="flex-1 ml-4">
            <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">My Binder</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">コレクションの管理</p>
          </div>
          
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-2 -mr-2 rounded-xl transition-all relative ${
              isFilterOpen || activeFilterCount > 0 ? 'bg-blue-50 text-blue-600' : 'text-slate-400'
            }`}
          >
            <SlidersHorizontal size={22} />
            {activeFilterCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-blue-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Batch Mode Banner */}
      {isBatchMode && (
        <div className="bg-blue-600 text-white p-3 sticky top-[73px] z-10 shadow-lg flex flex-col gap-2 animate-in slide-in-from-top-full duration-300">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Zap size={14} fill="white" className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">一括追加モード有効</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={triggerBatchSaveConfirmation}
                className="px-3 py-1.5 bg-white text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                保存して終了
              </button>
              <button 
                onClick={() => showAlert(
                  '変更を破棄しますか？',
                  '保存されていない変更は失われます。',
                  'info',
                  () => { // Confirm
                    setIsBatchMode(false);
                    loadData();
                    closeAlert();
                  },
                  () => closeAlert() // Cancel
                )} 
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-1">
            {dbProfiles.map(p => (
              <button
                key={p.id}
                onClick={() => setBatchPUid(p.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${
                  batchPUid === p.id ? 'bg-white text-blue-600 shadow-md' : 'bg-blue-700 text-blue-200'
                }`}
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Filter Chips */}
      <div className="w-full px-6 overflow-x-auto no-scrollbar flex gap-2 pt-2">
        {filterPack && <FilterChip label={filterPack} onClear={() => setFilterPack('')} />}
        {filterRanks.map(r => (
          <FilterChip key={`r-${r}`} label={`Rank ${r}`} onClear={() => setFilterRanks(prev => prev.filter(x => x !== r))} />
        ))}
        {filterProfiles.map(pId => {
          const name = dbProfiles.find(p => p.id === pId)?.display_name || 'User';
          return (
            <FilterChip 
              key={`p-${pId}`} 
              label={`User: ${name}`} 
              onClear={() => setFilterProfiles(prev => prev.filter(x => x !== pId))} 
            />
          );
        })}
        {sortBy !== 'rank-desc' && (
          <FilterChip 
            label={`Sort: ${sortBy === 'name-asc' ? 'Name' : sortBy === 'pack-asc' ? 'Pack' : 'Rank Asc'}`} 
            onClear={() => setSortBy('rank-desc')} 
          />
        )}
      </div>

      {/* Content */}
      <div className="px-6 py-4 w-full space-y-6">
        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
            size={18}
          />

          <input
            type="text"
            placeholder="カード名で検索..."
            className="w-full pl-12 pr-12 py-4 bg-white rounded-2xl text-sm shadow-sm focus:outline-none placeholder:text-slate-300 border border-slate-100"
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(e.target.value)
            }
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
            >
              <XCircle size={18} />
            </button>
          )}
        </div>

        {/* Quick Ownership Switcher */}
        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
        {[
          { id: 'all', label: 'すべて' },
          { id: 'owned', label: '所持' },
          { id: 'unowned', label: '未所持' },
          { id: 'trade', label: 'トレード' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterOwnership(tab.id as any)}
            className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
              filterOwnership === tab.id ? 'bg-white text-blue-600 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
        </div>

        {/* Collection Progress Header */}
        {collectionProgress && (
          <div className="px-1 py-2 space-y-2.5 animate-in fade-in slide-in-from-left-4 duration-700">
            <div className="flex justify-between items-end">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                {filterPack ? `${filterPack} Completion` : 'Total Collection'}
              </p>
              <p className="text-[10px] font-black text-blue-600 uppercase tabular-nums">
                {collectionProgress.ownedCount} / {collectionProgress.total} <span className="ml-1 text-slate-400">({collectionProgress.percent}%)</span>
              </p>
            </div>
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner border border-slate-100">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 via-blue-600 to-indigo-600 transition-all duration-1000 ease-out rounded-full shadow-[0_0_12px_rgba(37,99,235,0.4)]" 
                style={{ width: `${collectionProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Pro Filter Panel */}
        {isFilterOpen && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-6 space-y-6 animate-in slide-in-from-top-4 duration-300">
            {/* Quick Actions */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Settings2 size={12} /> クイックアクション
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleSyncMaster}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-700 transition-all active:scale-95"
                >
                  <RefreshCw size={14} className="text-blue-500" />
                  同期
                </button>
                <button
                  onClick={toggleBatchMode}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-[10px] font-black uppercase transition-all active:scale-95 ${
                    isBatchMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Zap size={14} className={isBatchMode ? 'text-white' : 'text-blue-500'} />
                  一括追加
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-50 mx-2" />

            {/* Sort Order */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <SlidersHorizontal size={12} /> 並び替え
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'rank-desc', label: 'ランク高い順' },
                  { id: 'rank-asc', label: 'ランク低い順' },
                  { id: 'name-asc', label: '名前順' },
                  { id: 'pack-asc', label: 'パック順' }
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSortBy(option.id as any)}
                    className={`py-2.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                      sortBy === option.id 
                        ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' 
                        : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pack Selector */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Package size={12} /> パック
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterPack('')}
                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all border ${
                    filterPack === '' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 border-slate-50 text-slate-400'
                  }`}
                >
                  すべて
                </button>
                {allPacks.map(p => (
                  <button
                    key={p}
                    onClick={() => setFilterPack(p)}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all border ${
                      filterPack === p ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 border-slate-50 text-slate-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Rank Multi-Selector */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Award size={12} /> ランク（複数選択）
              </p>
              <div className="flex flex-wrap gap-2">
                {allRanks.map(r => (
                  <button
                    key={r}
                    onClick={() => setFilterRanks(prev => 
                      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
                    )}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${
                      filterRanks.includes(r) 
                        ? 'bg-amber-100 border-amber-200 text-amber-700' 
                        : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    Rank {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Account Multi-Selector */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <User size={12} /> アカウント（複数選択）
              </p>
              <div className="grid grid-cols-2 gap-2">
                {profiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setFilterProfiles(prev => 
                      prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                    )}
                    className={`px-3 py-3 rounded-2xl text-[10px] font-black text-left border transition-all truncate ${
                      filterProfiles.includes(p.id)
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                        : 'bg-slate-50 border-slate-50 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${filterProfiles.includes(p.id) ? 'bg-white' : 'bg-slate-300'}`} />
                      {p.display_name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                  {filteredCards.length} Cards Match
                </p>
                <button
                  onClick={() => {
                    setFilterPack('');
                    setFilterRanks([]);
                    setFilterProfiles([]);
                    setFilterOwnership('all');
                    setSearchQuery('');
                    setSortBy('rank-desc');
                  }}
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                >
                  リセット
                </button>
              </div>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                結果を表示する
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {filteredCards.length} <span className="text-slate-300">Cards Displayed</span>
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-3 gap-3 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">

          {filteredCards.length === 0 ? (
            <div className="col-span-3 py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
              <Inbox
                className="mx-auto mb-3 text-slate-200"
                size={34}
              />

              <p className="text-xs font-black text-slate-300 uppercase tracking-widest">
                {allCards.length === 0 ? 'カードデータ未同期' : 'カードが見つかりません'}
              </p>
              {allCards.length === 0 && (
                <button
                  onClick={handleSyncMaster}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100"
                >
                  <RefreshCw size={14} /> カードデータ同期
                </button>
              )}
            </div>
          ) : (
            filteredCards.map((card) => {
              const display =
                resolveCardDisplay(card);

              const stats =
                cardStatsMap.get(
                  String(card.id)
                );

              const totalQuantity =
                stats?.total || 0;

              return (
                <button
                  key={String(card.id)}
                  onClick={() => isBatchMode ? handleBatchAdd(String(card.id)) : openCardDetail(card)}
                  className={`group relative overflow-hidden rounded-[1.5rem] border p-3 text-left transition-all duration-500 active:scale-95 flex flex-col justify-between h-full animate-in fade-in slide-in-from-bottom-2 ${
                    totalQuantity > 0
                      ? 'bg-white border-blue-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.1)]'
                      : 'bg-slate-50 border-slate-300 opacity-60'
                  }`}
                >
                  {/* Accent line for owned cards */}
                  {totalQuantity > 0 && (
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 to-indigo-600" />
                  )}

                  {/* Quantity Badge */}
                  <div
                    className={`absolute top-2 right-2 min-w-[20px] h-[18px] px-1.5 rounded-lg flex items-center justify-center text-[9px] font-black leading-none gap-1 shadow-sm ${
                      totalQuantity > 0
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {totalQuantity > 1 && filterOwnership !== 'trade' && (
                      <ArrowLeftRight size={8} className="text-blue-200 animate-pulse" />
                    )}
                    {isBatchMode && batchPUid && (
                      <>
                        <span className={totalQuantity > 0 ? 'text-blue-100' : 'text-slate-500'}>
                          {stats?.profileQuantities[normalizePUid(batchPUid)] || 0}
                        </span>
                        <span className="opacity-40">/</span>
                      </>
                    )}
                    {totalQuantity}
                  </div>

                  <div className="flex-1">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate pr-6">
                      {card.pack || 'No Pack'}
                    </p>
                    <h2 className="text-[10px] font-black text-slate-900 leading-tight break-words mb-2 pr-4">
                      {display.name}
                    </h2>
                  </div>

                  <div className="mt-auto space-y-1">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: Math.max(0, Math.min(5, card.rank || 0)) }).map((_, i) => (
                        <Star key={i} size={8} className="text-amber-400" fill="currentColor" strokeWidth={0} />
                      ))}
                      {(card.rank || 0) === 0 && <span className="text-[9px] font-black text-slate-300 uppercase">その他</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Scanner Button - 最も使いやすい位置に配置 */}
      <Link
        href="/scanner"
        className="fixed bottom-28 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-30 active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-8 duration-500 delay-300"
      >
        <Camera size={28} />
        <div className="absolute -top-1 -right-1 flex items-center justify-center">
          <div className="w-5 h-5 bg-amber-400 rounded-full border-2 border-white animate-pulse" />
          <Plus size={10} className="absolute text-amber-900 font-black" />
        </div>
      </Link>

      {/* Modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() =>
              setSelectedCard(null)
            }
          />

          <div className="relative max-w-sm w-full bg-white rounded-[3rem] shadow-2xl border border-slate-100 flex flex-col items-center max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-300 ease-out">
            {/* Close Button */}
            <button
              onClick={() => setSelectedCard(null)}
              className="absolute top-6 right-6 z-10 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Info Section */}
            <div className="w-full p-8 space-y-6 overflow-y-auto no-scrollbar flex-1">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">
                  {selectedCard.name}
                </h2>
                <div className="flex items-center justify-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-100">
                    Rank {selectedCard.rank || 0}
                  </span>
                  {selectedCard.pack && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200">
                      {selectedCard.pack}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">所持数内訳</p>
                <div className="space-y-2">
                  {dbProfiles.length === 0 ? (
                    <Link href="/settings/profiles" className="block p-4 rounded-2xl border border-amber-100 bg-amber-50 text-amber-700">
                      <span className="text-xs font-black uppercase tracking-tight">アプリ内アカウントを作成してください</span>
                    </Link>
                  ) : dbProfiles.map((prof) => {
                    const qty = editingQuantities[prof.id] || 0;
                    return (
                      <div
                        key={prof.id}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                          qty > 0 || isEditing
                            ? 'bg-blue-50/50 border-blue-100 shadow-sm'
                            : 'bg-slate-50 border-slate-100 opacity-60'
                        }`}
                      >
                        <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                          {prof.display_name}
                        </span>

                        {isEditing ? (
                          <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-blue-100 shadow-inner">
                            <button
                              onClick={() => updateQuantity(prof.id, -1)}
                              className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center active:scale-90 transition-transform"
                            >
                              <Minus size={14} strokeWidth={3} />
                            </button>
                            <span className="text-sm font-black text-blue-600 w-4 text-center">
                              {qty}
                            </span>
                            <button
                              onClick={() => updateQuantity(prof.id, 1)}
                              className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-blue-200"
                            >
                              <Plus size={14} strokeWidth={3} />
                            </button>
                          </div>
                        ) : (
                          <span className={`text-sm font-black ${qty > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                            ×{qty}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="w-full p-6 bg-white border-t border-slate-50">
              {isEditing ? (
                <button // 保存ボタンのonClickを修正
                  onClick={triggerSaveConfirmation}
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <Save size={16} /> 変更を保存
                </button>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <Edit3 size={16} /> 所持数を更新
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Component */}
      <CustomAlert 
        isOpen={alertConfig.isOpen}
        onClose={closeAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
      />
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="flex-shrink-0 bg-blue-600 text-white px-3 py-1.5 rounded-full flex items-center gap-2 animate-in zoom-in-90">
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      <button onClick={onClear} className="hover:bg-white/20 rounded-full p-0.5"><X size={12} /></button>
    </div>
  );
}
