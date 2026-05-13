'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
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
  Edit3,
} from 'lucide-react';

import {
  getCachedMasterData,
  getCachedRawCollection,
  getCachedProfiles,
  normalizeProfileId,
  upsertCachedCollection,
} from '../offline';

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
  profile_id?: string;
  quantity: number;
}

// =========================
// Helper
// =========================

const resolveCardDisplay = (card: Card) => ({
  name: card.name || 'Unknown Card',
  hasImage: !!card.image_url,
  imageUrl: card.image_url || '',
});

// =========================
// Page
// =========================

export default function CollectionPage() {
  const [loading, setLoading] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  const [allCards, setAllCards] = useState<Card[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ownedCardIds, setOwnedCardIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPack, setFilterPack] = useState<string>('');
  const [filterRanks, setFilterRanks] = useState<number[]>([]);
  const [filterProfiles, setFilterProfiles] = useState<string[]>([]);
  const [filterOwnership, setFilterOwnership] = useState<'all' | 'owned' | 'unowned'>('all');

  // Modal
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [editingQuantities, setEditingQuantities] = useState<{
    [profileId: string]: number;
  }>({});

  // =========================
  // Load Data
  // =========================

  const loadData = useCallback(() => {
    setLoading(true);

    const masterData = (getCachedMasterData() || []) as Card[];

    const collData =
      (getCachedRawCollection() || []) as CollectionRecord[];

    const profData =
      (getCachedProfiles() || []) as Profile[];

    setAllCards(masterData);
    setCollectionRecords(collData);

    setProfiles(
      profData.filter((p) => p.id !== null)
    );

    const owned = new Set(
      collData
        .filter((r) => (r.quantity || 0) > 0)
        .map((r) => String(r.card_id))
    );

    setOwnedCardIds(owned);

    setLoading(false);
  }, []);

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
    return [filterPack, filterRanks.length > 0, filterProfiles.length > 0, filterOwnership !== 'all'].filter(Boolean).length;
  }, [filterPack, filterRanks, filterProfiles, filterOwnership]);

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

      const pId = normalizeProfileId(
        r.profile_id || ''
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
    return allCards.filter((card) => {
      const stats = cardStatsMap.get(String(card.id));
      const total = stats?.total || 0;

      // 名前検索
      const display = resolveCardDisplay(card);
      if (searchQuery && !display.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

      // 所有状況
      if (filterOwnership === 'owned' && total === 0) return false;
      if (filterOwnership === 'unowned' && total > 0) return false;

      // ランク
      if (filterRanks.length > 0 && !filterRanks.includes(card.rank ?? 0)) return false;

      // パック
      if (filterPack && card.pack !== filterPack) return false;

      // プロファイル（アカウント）
      if (filterProfiles.length > 0) {
        const isOwnedBySelected = filterProfiles.some(pId => (stats?.profileQuantities[normalizeProfileId(pId)] || 0) > 0);
        if (!isOwnedBySelected) return false;
      }

      return true;
    });
  }, [allCards, searchQuery, filterOwnership, filterRanks, filterPack, filterProfiles, cardStatsMap]);

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
          normalizeProfileId(prof.id)
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
  // Save
  // =========================

  const handleSave = async () => {
    if (!selectedCard) return;

    for (const profileId of Object.keys(
      editingQuantities
    )) {
      upsertCachedCollection({
        card_id: String(selectedCard.id),
        profile_id: profileId,
        quantity: editingQuantities[profileId],
      });
    }

    alert('所持数を更新しました！');

    setSelectedCard(null);

    loadData();
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
    <div className="min-h-screen bg-slate-100/60 font-sans flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-20 p-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Link
            href="/settings"
            className="p-2 -ml-2 text-slate-400"
          >
            <ChevronLeft size={24} />
          </Link>

          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">
            コレクション
          </h1>
          
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

      {/* Active Filter Chips */}
      <div className="max-w-2xl mx-auto w-full px-4 overflow-x-auto no-scrollbar flex gap-2 pt-2">
        {filterPack && <FilterChip label={filterPack} onClear={() => setFilterPack('')} />}
        {filterRanks.map(r => (
          <FilterChip key={`r-${r}`} label={`Rank ${r}`} onClear={() => setFilterRanks(prev => prev.filter(x => x !== r))} />
        ))}
        {filterProfiles.map(pId => {
          const name = profiles.find(p => p.id === pId)?.display_name || 'User';
          return (
            <FilterChip 
              key={`p-${pId}`} 
              label={name} 
              onClear={() => setFilterProfiles(prev => prev.filter(x => x !== pId))} 
            />
          );
        })}
      </div>

      {/* Content */}
      <div className="px-3 py-4 max-w-2xl mx-auto w-full space-y-4">

        {/* Search */}
        <div className="relative px-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
            size={18}
          />

          <input
            type="text"
            placeholder="カード名で検索..."
            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl text-sm shadow-sm focus:outline-none placeholder:text-slate-300 border border-slate-100"
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(e.target.value)
            }
          />
        </div>

        {/* Pro Filter Panel */}
        {isFilterOpen && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-6 space-y-6 animate-in slide-in-from-top-4 duration-300">
            {/* Ownership Tabs */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Filter size={12} /> 所有状況
              </p>
              <div className="flex bg-slate-50 p-1 rounded-2xl">
                {[
                  { id: 'all', label: 'すべて' },
                  { id: 'owned', label: '所持' },
                  { id: 'unowned', label: '未所持' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterOwnership(tab.id as any)}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                      filterOwnership === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pack Selector */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Package size={12} /> パック
              </p>
              <select
                value={filterPack}
                onChange={(e) => setFilterPack(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none"
              >
                <option value="">すべてのパック</option>
                {allPacks.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
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

            <button
              onClick={() => {
                setFilterPack('');
                setFilterRanks([]);
                setFilterProfiles([]);
                setFilterOwnership('all');
                setSearchQuery('');
              }}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <XCircle size={14} /> フィルターを解除
            </button>
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-3 gap-3 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">

          {filteredCards.length === 0 ? (
            <div className="col-span-3 py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
              <Inbox
                className="mx-auto mb-3 text-slate-200"
                size={34}
              />

              <p className="text-xs font-black text-slate-300 uppercase tracking-widest">
                カードが見つかりません
              </p>
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
                  onClick={() =>
                    openCardDetail(card)
                  }
                  className={`relative overflow-hidden rounded-[1.5rem] border p-2.5 pt-4 text-left transition-all duration-500 active:scale-95 flex flex-col justify-between h-full animate-in fade-in slide-in-from-bottom-2 ${
                    totalQuantity > 0
                      ? 'bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-md shadow-blue-100/40'
                      : 'bg-white border-slate-100 shadow-sm'
                  }`}
                >
                  {/* Quantity Badge - Top Right Absolute */}
                  <div
                    className={`absolute top-2 right-2 min-w-[20px] h-[20px] px-1 rounded-lg flex items-center justify-center text-[9px] font-black leading-none ${
                      totalQuantity > 0
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {totalQuantity}
                  </div>

                  <div className="flex-1">
                    <h2 className="text-[11px] font-black text-slate-900 leading-[1.2] break-words mb-2 pr-4">
                      {display.name}
                    </h2>
                  </div>

                  <div className="mt-auto space-y-1">
                    <div className="flex items-center gap-0.5 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                      <Award size={8} className="text-amber-400" />
                      <span>Rank {card.rank || 0}</span>
                    </div>

                    {card.pack && (
                      <p className="text-[7px] uppercase tracking-tighter text-slate-300 truncate w-full">
                        {card.pack}
                      </p>
                    )}
                  </div>

                  {totalQuantity > 0 && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

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
                  {profiles.map((prof) => {
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
                <button
                  onClick={handleSave}
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