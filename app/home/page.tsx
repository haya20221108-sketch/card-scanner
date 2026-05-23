'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, PlusCircle, ChevronRight, Award, History, CloudOff, Cloud, X } from 'lucide-react'; // lucide-reactは相対パスではないので変更なし
import Link from 'next/link';
import Image from 'next/image';
import { resolveCardDisplay } from '../components/utils';
import { supabase } from '../supabase';
import {
  getCachedMasterData,
  getCachedProfiles,
  getCachedRawCollection,
  getCachedUserId,
  getOnlineStatus,
  rememberUserId,
  normalizeProfileId,
  setCachedProfiles,
  setCachedRawCollection,
} from '../offline';
import { useAuth } from '../../AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [hasMounted, setHasMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, byRank: [0, 0, 0, 0, 0, 0] });
  const [recentCards, setRecentCards] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>('all');
  const [masterMap, setMasterMap] = useState<Map<string, any>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
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

      const effectiveUserId = user?.uid || getCachedUserId() || 'offline-user';
      rememberUserId(user?.uid);
      setUserId(effectiveUserId);

      const masterData = getCachedMasterData();
      setMasterMap(new Map(masterData.map((m: any) => [String(m.id), m])));

      let profileList = getCachedProfiles();
      if (isCurrentlyOnline && user?.uid) {
        const { data: freshProfiles } = await supabase
          .from('profiles')
          .select('*')
          .eq('uuid', user.uid)
          .order('created_at', { ascending: true });
        if (freshProfiles) {
          profileList = freshProfiles;
          setCachedProfiles(freshProfiles);
        }

        const { data: freshCollection } = await supabase
          .from('collections')
          .select('card_id, profile_id, quantity')
          .eq('user_id', user.uid);
        if (freshCollection) {
          setCachedRawCollection(freshCollection.map((record: any) => ({ ...record, user_id: user.uid })));
        }
      }
      
      if (!isMounted) return;
      setProfiles(profileList);

      const savedId = localStorage.getItem('active_profile_id');
      if (savedId && profileList.some(p => p.id === savedId)) {
        setActiveProfileId(savedId);
      } else if (profileList.length > 0) {
        setActiveProfileId('all');
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
  }, [user]);

  // 2. 統計取得 (ページ遷移時のエラー防止策を追加)
  useEffect(() => {
    if (!userId || !hasMounted) return;
    let isMounted = true;

    const fetchStats = () => { // Made synchronous as it only uses local cache
      if (!isMounted) return;
      let data: any[] = [];
      
      data = getCachedRawCollection().filter((item: any) => {
        const sameUser = String(item.user_id || userId) === userId;
        const matchesProfile = activeProfileId === 'all' || normalizeProfileId(item.profile_id) === normalizeProfileId(activeProfileId);
        return sameUser && matchesProfile;
      });

      if (!isMounted) return;

      const rankCounts = [0, 0, 0, 0, 0, 0];
      
      data.forEach(item => {
        const card = masterMap.get(String(item.card_id));
        const rank = card?.rank ?? 0;
        if (rank >= 0 && rank <= 5) rankCounts[rank] += item.quantity;
      });

      setStats({ total: data.reduce((acc, curr) => acc + curr.quantity, 0), byRank: rankCounts });
    }; 

    fetchStats();
    return () => { isMounted = false; };
  }, [userId, activeProfileId, masterMap, isOnline, hasMounted]);

  if (!hasMounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans max-w-md mx-auto">
      {/* Alert */}
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
          <button onClick={() => { setActiveProfileId('all'); localStorage.removeItem('active_profile_id'); }} className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeProfileId === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
            All Binder
          </button>
          {profiles.map(p => (
            <button key={p.id} onClick={() => { setActiveProfileId(p.id); localStorage.setItem('active_profile_id', p.id); }} className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeProfileId === p.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
              {p.display_name || 'Unnamed'}
            </button>
          ))}
          <Link href="/settings" className="flex-shrink-0 w-9 h-9 bg-white rounded-xl flex items-center justify-center text-slate-400"><PlusCircle size={18} /></Link>
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
    </div>
  );
}
