/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../supabase';
import { 
  PieChart, 
  Layers, 
  Zap, 
  PlusCircle, 
  ChevronRight, 
  Award, 
  History, 
  CloudOff, 
  Cloud 
} from 'lucide-react';
import { resolveCardDisplay } from '../components/utils';
import {
  getCachedMasterData,
  getCachedProfiles,
  getCachedRawCollection,
  getCachedUserId,
  getOnlineStatus,
  normalizeProfileId,
  rememberUserId,
  setCachedProfiles,
} from '../offline';

export default function SettingsPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [stats, setStats] = useState({ total: 0, byRank: [0, 0, 0, 0, 0, 0] });
  const [recentCards, setRecentCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [masterMap, setMasterMap] = useState<Map<string, any>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // 1. マウント管理と認証チェック
  useEffect(() => {
    setHasMounted(true);
    setIsOnline(getOnlineStatus());

    const init = async () => {
      // セッション確認
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        window.location.href = '/login'; // 未ログインならログインページへ
        return;
      }

      setIsAuthorized(true);
      const user = session.user;
      rememberUserId(user.id);
      setUserId(user.id);

      // マスタデータの取得
      const masterData = getCachedMasterData();
      setMasterMap(new Map(masterData.map((m: any) => [String(m.id), m])));

      // プロフィールの取得
      let profileList = getCachedProfiles();
      if (getOnlineStatus()) {
        try {
          const { data: profilesData } = await supabase.from('profiles').select('*').eq('uuid', user.id);
          if (profilesData) {
            profileList = profilesData;
            setCachedProfiles(profileList);
          }
        } catch (e) { console.error(e); }
      }
      setProfiles(profileList);

      const savedId = localStorage.getItem('active_profile_id');
      setActiveProfileId(savedId || (profileList.length > 0 ? profileList[0].id : null));
    };

    init();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. 統計データの取得
  useEffect(() => {
    if (!userId || !isAuthorized) return;

    const fetchStats = async () => {
      setLoading(true);
      let data = getCachedRawCollection().filter((item: any) => 
        normalizeProfileId(item.profile_id) === normalizeProfileId(activeProfileId)
      );

      const rankCounts = [0, 0, 0, 0, 0, 0];
      data.forEach(item => {
        const card = masterMap.get(String(item.card_id));
        const rank = card?.rank ?? 0;
        if (rank >= 0 && rank <= 5) rankCounts[rank] += item.quantity;
      });

      setStats({ total: data.reduce((acc, curr) => acc + curr.quantity, 0), byRank: rankCounts });
      setRecentCards(data.slice(0, 3));
      setLoading(false);
    };
    fetchStats();
  }, [userId, activeProfileId, masterMap, isAuthorized]);

  // ハイドレーションエラー防止
  if (!hasMounted || !isAuthorized) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans max-w-md mx-auto">
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
            <button 
              key={p.id} 
              onClick={() => { setActiveProfileId(p.id); localStorage.setItem('active_profile_id', p.id); }} 
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeProfileId === p.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
            >
              {p.display_name || 'Unnamed'}
            </button>
          ))}
          <Link href="/settings" className="flex-shrink-0 w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400"><PlusCircle size={18} /></Link>
        </div>
      </header>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">Total Collection</p>
          <div className="text-3xl font-black italic">{loading ? '...' : stats.total.toLocaleString()}</div>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Live Sync</span>
          </div>
        </div>
        <Link href="/scanner" className="bg-blue-600 rounded-[2rem] p-6 text-white shadow-xl active:scale-95 transition-all">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">New Scan</p>
          <div className="text-xl font-black leading-tight">ADD NEW<br/>CARDS</div>
          <div className="mt-4 flex items-center gap-1.5">
            <Zap size={10} className="fill-white" />
            <span className="text-[8px] font-black uppercase tracking-widest">AI Power</span>
          </div>
        </Link>
      </div>

      {/* Rarity Distribution */}
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
            const display = cardInfo ? resolveCardDisplay(cardInfo) : { hasImage: false, imageUrl: null, name: 'Unknown' };

            return (
              <div key={i} className="bg-white rounded-[1.5rem] p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100">
                    {display.hasImage ? (
                      <img src={display.imageUrl!} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="text-slate-300 font-black text-[8px]">NO IMG</div>
                    )}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-black text-slate-800 truncate max-w-[150px]">{display.name || 'Unknown'}</p>
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
    </div>
  );
}
