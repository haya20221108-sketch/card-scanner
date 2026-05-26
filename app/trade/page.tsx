'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, RefreshCw, Inbox, Star, ArrowLeftRight, Package } from 'lucide-react';
import { supabase } from '../supabase';
import { getCachedMasterData, getCachedRawCollection, getOnlineStatus, normalizePUid, getCachedUserId, rememberUserId } from '../offline';
import { resolveCardDisplay } from '../components/utils';
import { CustomAlert } from '../components/CustomAlert';
import { useAuth } from '../../AuthContext';

interface Card {
  id: string;
  name?: string;
  image_url?: string;
  rank?: number;
  pack?: string;
}

interface CollectionRecord {
  card_id: string;
  p_uid?: string;
  quantity: number;
}

export default function TradePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [alert, setAlert] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'info' | 'error' | 'success' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const isOnline = getOnlineStatus();
      let masterData = (getCachedMasterData() || []) as Card[];
      setAllCards(masterData);

      let collData: CollectionRecord[] = [];
      if (isOnline && user?.uid) {
        rememberUserId(user.uid);
        const { data, error } = await supabase
          .from('inventory')
          .select('card_id, p_uid, count');
        
        if (!error && data) {
          collData = data.map((r: any) => ({
            card_id: r.card_id,
            p_uid: r.p_uid,
            quantity: r.count
          }));
        }
      }
      
      if (collData.length === 0) {
        collData = (getCachedRawCollection() || []) as CollectionRecord[];
      }
      setCollectionRecords(collData);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cardStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; tradeable: number }>();
    collectionRecords.forEach((r) => {
      const cId = String(r.card_id);
      const qty = r.quantity || 0;
      if (!map.has(cId)) map.set(cId, { total: 0, tradeable: 0 });
      const entry = map.get(cId)!;
      entry.total += qty;
      // トレード可能な数は「全アカウントの合計 - 1」
    });
    
    // 2枚目以降をトレード可能数とする
    map.forEach(val => {
      val.tradeable = Math.max(0, val.total - 1);
    });
    return map;
  }, [collectionRecords]);

  const tradeableCards = useMemo(() => {
    return allCards.filter((card) => {
      const stats = cardStatsMap.get(String(card.id));
      if (!stats || stats.tradeable <= 0) return false;

      if (searchQuery) {
        const display = resolveCardDisplay(card);
        if (!display.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => (b.rank || 0) - (a.rank || 0));
  }, [allCards, cardStatsMap, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <RefreshCw size={24} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="px-6 py-4 pt-8 bg-slate-50/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href="/home" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Trade List</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">交換可能なカード（余剰分）</p>
          </div>
        </div>
      </header>

      <div className="px-6 py-4 space-y-6 flex-1">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input
            type="text"
            placeholder="トレード対象を検索..."
            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl text-sm shadow-sm focus:outline-none placeholder:text-slate-300 border border-slate-100"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Stats Summary */}
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-slate-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Tradeable Items</p>
            <ArrowLeftRight size={16} className="text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black italic tracking-tighter">
              {tradeableCards.reduce((acc, c) => acc + (cardStatsMap.get(String(c.id))?.tradeable || 0), 0)}
            </span>
            <span className="text-xs font-bold opacity-60 uppercase">Duplicates Found</span>
          </div>
        </div>

        {/* List Section Title */}
        <div className="flex items-center justify-between px-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {tradeableCards.length} <span className="text-slate-300">Unique Cards</span>
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 gap-4 pb-32">
          {tradeableCards.length === 0 ? (
            <div className="col-span-2 py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
              <Inbox className="mx-auto mb-3 text-slate-200" size={34} />
              <p className="text-xs font-black text-slate-300 uppercase tracking-widest">トレード可能なカードはありません</p>
            </div>
          ) : (
            tradeableCards.map((card) => {
              const display = resolveCardDisplay(card);
              const stats = cardStatsMap.get(String(card.id));
              
              return (
                <div
                  key={card.id}
                  className="bg-white rounded-[2rem] border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 relative overflow-hidden"
                >
                  {/* Trade Count Badge */}
                  <div className="absolute top-4 right-4 bg-blue-600 text-white px-2 py-1 rounded-lg text-[10px] font-black">
                    +{stats?.tradeable}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: card.rank || 0 }).map((_, i) => (
                        <Star key={i} size={8} className="text-amber-400" fill="currentColor" strokeWidth={0} />
                      ))}
                    </div>
                    <h3 className="text-xs font-black text-slate-900 leading-tight uppercase tracking-tight pr-6">
                      {display.name}
                    </h3>
                  </div>

                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-1.5 opacity-40">
                      <Package size={10} />
                      <span className="text-[8px] font-black uppercase tracking-widest truncate max-w-[60px]">
                        {card.pack}
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400">
                      Total: {stats?.total}
                    </div>
                  </div>

                  {/* Accent Line */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
                </div>
              );
            })
          )}
        </div>
      </div>

      <CustomAlert 
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title={alert.title}
        message={alert.message}
        type={alert.type}
      />
    </div>
  );
}
