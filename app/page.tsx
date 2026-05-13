'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from './supabase';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Layers, PlusCircle, ChevronRight, Award, History, CloudOff, Cloud, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { resolveCardDisplay } from './components/utils';
import {
  getCachedMasterData,
  getCachedProfiles,
  getCachedRawCollection,
  getCachedUserId,
  getOnlineStatus,
  normalizeProfileId,
  rememberUserId,
  setCachedProfiles,
} from './offline';

export default function HomePage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [stats, setStats] = useState({ total: 0, byRank: [0, 0, 0, 0, 0, 0] });
  const [recentCards, setRecentCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [masterMap, setMasterMap] = useState<Map<string, any>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [allCards, setAllCards] = useState<any[]>([]); 
  const [ownedCardIds, setOwnedCardIds] = useState<Set<string>>(new Set());
  const [collectionRecords, setCollectionRecords] = useState<any[]>([]);
  const [displayFilter, setDisplayFilter] = useState<'all' | 'owned' | 'unowned'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isOnline, setIsOnline] = useState(true);
  const [customAlert, setCustomAlert] = useState<string | null>(null);

  // 1. 初期化ロジック (ページ遷移時のエラー防止策を追加)
  useEffect(() => {
    let isMounted = true;
    setHasMounted(true);

    const initializeData = async (isCurrentlyOnline: boolean) => {
      if (!isMounted) return;
      setIsOnline(isCurrentlyOnline);
      
      if (!isCurrentlyOnline) {
        setCustomAlert("現在オフラインです。キャッシュから読み込んでいます。");
      }

      let user: any = null;
      if (isCurrentlyOnline) {
        try {
          const { data: { user: onlineUser } } = await supabase.auth.getUser();
          user = onlineUser;
          if (user?.id) rememberUserId(user.id);
        } catch (e) { 
          console.error("User fetch error:", e); 
        }
      }

      if (!isMounted) return;

      const effectiveUserId = user?.id || getCachedUserId() || 'offline-user';
      setUserId(effectiveUserId);

      const masterData = getCachedMasterData();
      setMasterMap(new Map(masterData.map((m: any) => [String(m.id), m])));
      setAllCards(masterData);

      let profileList = getCachedProfiles();
      if (isCurrentlyOnline) {
        try {
          const qp = query(collection(db, "profiles"), where("uuid", "==", effectiveUserId));
          const qs = await getDocs(qp);
          profileList = qs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCachedProfiles(profileList);
        } catch (e) { console.error(e); }
      }

      if (!isMounted) return;
      setProfiles(profileList);

      const savedId = localStorage.getItem('active_profile_id');
      if (savedId && profileList.some(p => p.id === savedId)) {
        setActiveProfileId(savedId);
      } else if (profileList.length > 0) {
        setActiveProfileId(profileList[0].id);
      }
    };

    initializeData(getOnlineStatus());
    const handleOnline = () => initializeData(true);
    const handleOffline = () => initializeData(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false; // クリーンアップ時にフラグを倒す
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. 統計取得 (ページ遷移時のエラー防止策を追加)
  useEffect(() => {
    if (!userId || !hasMounted) return;
    let isMounted = true;

    const fetchStats = async () => {
      if (!isMounted) return;
      setLoading(true);
      let data: any[] = [];
      
      try {
        if (isOnline) {
          let request = supabase.from('collections').select('quantity, card_id, updated_at').eq('user_id', userId).order('updated_at', { ascending: false });
          request = activeProfileId ? request.eq('profile_id', activeProfileId) : request.is('profile_id', null);
          const { data: onlineData, error } = await request;
          if (error) throw error;
          data = onlineData || [];
        } else {
          data = getCachedRawCollection().filter((item: any) => 
            normalizeProfileId(item.profile_id) === normalizeProfileId(activeProfileId));
        }
      } catch (e) {
        data = getCachedRawCollection().filter((item: any) =>
          normalizeProfileId(item.profile_id) === normalizeProfileId(activeProfileId)
        );
      }

      if (!isMounted) return;

      setCollectionRecords(data);
      const rankCounts = [0, 0, 0, 0, 0, 0];
      const currentOwnedCardIds = new Set<string>();
      
      data.forEach(item => {
        const card = masterMap.get(String(item.card_id));
        const rank = card?.rank ?? 0;
        if (rank >= 0 && rank <= 5) rankCounts[rank] += item.quantity;
        currentOwnedCardIds.add(String(item.card_id));
      });

      setStats({ total: data.reduce((acc, curr) => acc + curr.quantity, 0), byRank: rankCounts });
      setRecentCards(data.slice(0, 3));
      setOwnedCardIds(currentOwnedCardIds);
      setLoading(false);
    }; 

    fetchStats();
    return () => { isMounted = false; };
  }, [userId, activeProfileId, masterMap, isOnline, hasMounted]);

  // 3. フィルタリングロジック
  const filteredCards = useMemo(() => {
    return allCards.filter((card) => {
      const isOwned = ownedCardIds.has(String(card.id));
      const matchesSearch = (card.name || "").toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (displayFilter === 'owned') return isOwned;
      if (displayFilter === 'unowned') return !isOwned;
      return true;
    });
  }, [allCards, ownedCardIds, searchQuery, displayFilter]);

  if (!hasMounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans max-w-md mx-auto">
      {/* Alert */}
      {customAlert && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-white border border-slate-100 p-4 rounded-2xl shadow-xl flex items-center justify-between">
          <p className="text-[10px] font-black uppercase text-slate-900">{customAlert}</p>
          <button onClick={() => setCustomAlert(null)} className="text-slate-400"><X size={16} /></button>
        </div>
      )}

      {/* Header */}
      <header className="space-y-6 mb-10 pt-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black italic text-slate-900 uppercase tracking-tighter">Dashboard</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory Intelligence</p>
          </div>
          <div className="w-10 h-10 bg-white rounded-2xl border border-slate-100 flex items-center justify-center shadow-sm relative">
            <Award size={20} className="text-amber-500" />
            {isOnline ? <Cloud size={14} className="text-emerald-400 absolute -top-1 -right-1" /> : <CloudOff size={14} className="text-red-400 absolute -top-1 -right-1" />}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {profiles.map(p => (
            <button key={p.id} onClick={() => { setActiveProfileId(p.id); localStorage.setItem('active_profile_id', p.id); }} className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeProfileId === p.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
              {p.display_name || 'Unnamed'}
            </button>
          ))}
          <Link href="/settings" className="flex-shrink-0 w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400"><PlusCircle size={18} /></Link>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">Total Collection</p>
          <div className="text-3xl font-black italic">{loading ? '...' : stats.total.toLocaleString()}</div>
        </div>
        <Link href="/scanner" className="bg-blue-600 rounded-[2rem] p-6 text-white shadow-xl active:scale-95 transition-all">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">New Scan</p>
          <div className="text-xl font-black leading-tight">ADD NEW<br/>CARDS</div>
        </Link>
      </div>

      {/* Distribution */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Rarity Distribution</h3>
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-4">
          {[5, 4, 3, 2, 1, 0].map((rank) => (
            <div key={rank} className="space-y-1.5">
              <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter">
                <span className="text-slate-500">Rank {rank}</span>
                <span className="text-slate-900">{stats.total > 0 ? Math.round((stats.byRank[rank] / stats.total) * 100) : 0}%</span>
              </div>
              <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${stats.total > 0 ? (stats.byRank[rank] / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><History size={12} /> Recent Activity</h3>
          <Link href="/collection" className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center">View All <ChevronRight size={12} /></Link>
        </div>
        <div className="space-y-3">
          {recentCards.map((card, i) => {
            const cardInfo = masterMap.get(String(card.card_id));
            const display = cardInfo ? resolveCardDisplay(cardInfo) : { hasImage: false, imageUrl: null, name: 'Unknown Card' };
            return (
              <div key={i} className="bg-white rounded-[1.5rem] p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100">
                    {display.hasImage ? <img src={display.imageUrl!} className="w-full h-full object-cover" alt="" /> : <div className="text-slate-300 font-black text-[8px]">NO IMG</div>}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 truncate max-w-[150px]">{display.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{card.updated_at ? new Date(card.updated_at).toLocaleDateString() : 'Local'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">x{card.quantity}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Card Catalog */}
      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Layers size={12} /> Card Catalog</h3>
        </div>

        <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 space-y-4">
          <input
            type="text"
            placeholder="Search cards..."
            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex justify-around gap-2 text-[10px] font-black uppercase tracking-widest">
            {['all', 'owned', 'unowned'].map((f) => (
              <button
                key={f}
                onClick={() => setDisplayFilter(f as any)}
                className={`flex-1 px-3 py-2 rounded-lg transition-colors ${displayFilter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredCards.length === 0 && <p className="text-center text-sm text-slate-500 py-4">No cards found.</p>}
          {filteredCards.map((card) => {
            const display = resolveCardDisplay(card);
            const isOwned = ownedCardIds.has(String(card.id));
            const ownedQuantity = collectionRecords.find(item => String(item.card_id) === String(card.id))?.quantity || 0;

            return (
              <div key={card.id} className="bg-white rounded-[1.5rem] p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100">
                    {display.hasImage ? (
                      /* ★ 修正：未所持でも grayscale / opacity を適用しない ★ */
                      <Image 
                        src={display.imageUrl!} 
                        alt={display.name || ''} 
                        width={40} 
                        height={40} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="text-slate-300 font-black text-[8px]">NO IMG</div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 truncate max-w-[150px]">{display.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Rank {card.rank}</p>
                  </div>
                </div>
                <div className="text-right">
                  {isOwned ? (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">x{ownedQuantity}</span>
                  ) : (
                    <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg">Not Owned</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}