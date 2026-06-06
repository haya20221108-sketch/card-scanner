'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, RefreshCw, Inbox, Star, ArrowLeftRight, X, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { getCachedMasterData, getCachedRawCollection, getCachedProfiles, getDbBackedProfiles, getOnlineStatus, rememberUserId } from '../offline';
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
  p_uid?: string; // アカウント識別子
  quantity: number;
}

// アカウントごとの状態を定義する型
interface AccountStatus {
  p_uid: string;
  total: number;
  tradeable: number;
  isOwner: boolean;
  offeredCards: { id: string; name: string; pack?: string }[];
}

export default function TradePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [alert, setAlert] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'info' | 'error' | 'success' });
  const [profiles, setProfiles] = useState<any[]>([]);
  const dbProfiles = useMemo(() => getDbBackedProfiles(profiles), [profiles]);
  
  // ★詳細を確認するために選択されたカードのState
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const isOnline = getOnlineStatus();
      let masterData = (getCachedMasterData() || []) as Card[];
      setAllCards(masterData);

      // プロフィール一覧をロード
      const profData = getCachedProfiles() || [];
      setProfiles(profData);

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

  // カード全体の統計（グリッド表示用）
  const cardStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; tradeable: number }>();
    collectionRecords.forEach((r) => {
      const cId = String(r.card_id);
      const qty = r.quantity || 0;
      if (!map.has(cId)) map.set(cId, { total: 0, tradeable: 0 });
      const entry = map.get(cId)!;
      entry.total += qty;
    });
    
    map.forEach(val => {
      val.tradeable = Math.max(0, val.total - 1);
    });
    return map;
  }, [collectionRecords]);

  // ★選択されたカードに対する「アカウント個別」の所持状況と交換候補を詳しく解析
  const accountBreakdown = useMemo(() => {
    if (!selectedCard) return [];

    // 全インベントリから、今選択しているカードのデータだけを抽出
    const targetRecords = collectionRecords.filter(r => String(r.card_id) === String(selectedCard.id));
    
    // プロフィール情報をベースに、アカウントごとの所持状況をマッピング
    const accountMap = new Map<string, AccountStatus & { name: string }>();

    dbProfiles.forEach(prof => {
      const record = targetRecords.find(r => r.p_uid === prof.id);
      const total = record?.quantity || 0;
      
      // 同じランクの余剰カード（交換に出せるカード）を抽出
      const offeredCards = allCards
        .filter(c => 
          c.rank !== undefined &&
          c.rank === selectedCard.rank &&
          String(c.id) !== String(selectedCard.id)
        )
        .filter(c => {
          const r = collectionRecords.find(rec => rec.p_uid === prof.id && String(rec.card_id) === String(c.id));
          return (r?.quantity || 0) > 1;
        })
        .map(c => ({
          id: c.id,
          name: resolveCardDisplay(c).name,
          pack: c.pack
        }));

      accountMap.set(prof.id, {
        p_uid: prof.id,
        name: prof.display_name || 'User',
        total: total,
        tradeable: Math.max(0, total - 1),
        isOwner: user?.uid === prof.id,
        offeredCards
      } as any);
    });

    return Array.from(accountMap.values())
      .filter(acc => {
        // 候補があるアカウントのみを表示
        // 1. 余剰を持っている（出し手）
        // 2. 未所持かつ、代わりに交換に出せるカードがある（受け手）
        return acc.tradeable > 0 || (acc.total === 0 && acc.offeredCards.length > 0);
      })
      .sort((a, b) => {
        // 1. 余剰あり（トレードの出し手）を最優先
        if (a.tradeable > 0 && b.tradeable === 0) return -1;
        if (a.tradeable === 0 && b.tradeable > 0) return 1;
        // 2. 未所持（トレードの受け手候補）を次に優先
        if (a.total === 0 && b.total > 0) return -1;
        if (a.total > 0 && b.total === 0) return 1;
        return 0;
      });
  }, [selectedCard, collectionRecords, user, dbProfiles, allCards]);

  const tradeableCards = useMemo(() => {
    return allCards.filter((card) => {
      const rank = card.rank || 0;
      if (rank < 2 || rank > 4) return false;

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
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <header className="px-4 py-3 bg-slate-50/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Link href="/home" className="p-1.5 -ml-1 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold italic text-slate-900 uppercase tracking-tight">Trade List</h1>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">交換可能なカード（余剰分）</p>
          </div>
        </div>
        <RefreshCw size={20} className="text-slate-300 cursor-pointer" onClick={() => loadData()} />
      </header>

      <div className="px-4 py-3 space-y-4 flex-1">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input
            type="text"
            placeholder="トレード対象を検索..."
            className="w-full pl-12 pr-12 py-3 bg-white rounded-2xl text-sm shadow-sm focus:outline-none border border-slate-100 placeholder:text-slate-300 font-bold"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

        {/* Stats Summary */}
        <div className="bg-slate-900 rounded-[2rem] p-5 text-white shadow-xl shadow-slate-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-60">Tradeable Items</p>
            <ArrowLeftRight size={16} className="text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold italic tracking-tighter">
              {tradeableCards.reduce((acc, c) => acc + (cardStatsMap.get(String(c.id))?.tradeable || 0), 0)}
            </span>
            <span className="text-sm font-semibold opacity-60 uppercase">Duplicates Found</span>
          </div>
        </div>

        {/* List Section Title */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {tradeableCards.length} <span className="text-slate-300">Unique Cards</span>
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 gap-3 pb-32">
          {tradeableCards.length === 0 ? (
            <div className="col-span-2 py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
              <Inbox className="mx-auto mb-3 text-slate-200" size={34} />
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">トレード可能なカードはありません</p>
            </div>
          ) : (
            tradeableCards.map((card) => {
              const display = resolveCardDisplay(card);
              const stats = cardStatsMap.get(String(card.id));
              
              // カードごとの各アカウントの所持状況サマリーを計算
              const cardRecords = collectionRecords.filter(r => String(r.card_id) === String(card.id));
              const accountSummary = dbProfiles
                .map(prof => {
                  const record = cardRecords.find(r => r.p_uid === prof.id);
                  const total = record?.quantity || 0;
                  return {
                    name: prof.display_name || 'User',
                    tradeable: Math.max(0, total - 1),
                    isMissing: total === 0,
                    total
                  };
                })
                .filter(acc => acc.total > 0) // 所持しているアカウントのみ表示
                .sort((a, b) => b.total - a.total);
              
              return (
                <button
                  key={card.id}
                  onClick={() => setSelectedCard(card)} // ★クリックで詳細モーダル展開
                  className="bg-white text-left focus:outline-none w-full rounded-[2rem] border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
                >
                  <div className="flex justify-between items-start gap-2">
                    {/* 左側: カード情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: card.rank || 0 }).map((_, i) => (
                            <Star key={i} size={10} className="text-amber-400" fill="currentColor" strokeWidth={0} />
                          ))}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight uppercase tracking-tight truncate">
                          {display.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 mt-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest">
                          {card.pack}
                        </span>
                      </div>
                    </div>

                    {/* 右側: アカウント状況サマリー (2列 & スクロール) */}
                    <div className="grid grid-cols-2 gap-1 max-h-20 overflow-y-auto shrink-0 w-[74px] no-scrollbar content-start">
                      {accountSummary.map((acc, idx) => (
                        <div 
                          key={idx}
                          className={`text-[8px] font-bold px-1 py-0.5 rounded-lg flex items-center justify-center gap-0.5 transition-colors border whitespace-nowrap ${
                            acc.tradeable > 0 
                              ? 'bg-blue-50 text-blue-600 border-blue-100' 
                              : 'bg-slate-50 text-slate-300 border-slate-100'
                          }`}
                        >
                          <span className="truncate max-w-[22px]">{acc.name}</span>
                          {acc.tradeable > 0 && <span className="opacity-70">+{acc.tradeable}</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ★ アカウントごとの余剰・未所持を可視化するモーダル UI */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedCard(null)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-4 flex flex-col max-h-[85vh] border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
            
            {/* モーダルヘッダー */}
            <div className="flex justify-between items-center mb-4 px-2">
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  {Array.from({ length: selectedCard.rank || 0 }).map((_, i) => (
                    <Star key={i} size={12} className="text-amber-400" fill="currentColor" strokeWidth={0} />
                  ))}
                </div>
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
                  {resolveCardDisplay(selectedCard).name}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedCard.pack}</span>
                </div>
                <p className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-tighter">アカウント別の所持状況内訳</p>
              </div>
              <button 
                onClick={() => setSelectedCard(null)} 
                className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* アカウントリスト一覧 */}
            <div className="space-y-3 overflow-y-auto pb-10 flex-1 pr-1 -mr-1 custom-scrollbar">
              {accountBreakdown.map((acc) => {
                // ステータス判定
                const isMissing = acc.total === 0;
                const hasTradeable = acc.tradeable > 0;
                
                // トレード成立のためのペア相手を探す
                const senderAccount = accountBreakdown.find(a => a.tradeable > 0);
                const potentialReceivers = accountBreakdown.filter(a => a.total === 0);
                const receiverAccount = accountBreakdown.find(a => a.total === 0);

                return (
                  <div 
                    key={acc.p_uid}
                    className={`p-3 rounded-2xl border flex items-start justify-between transition-all relative ${
                      hasTradeable 
                        ? 'bg-blue-50/60 border-blue-100' // 余剰あり（青）
                        : isMissing 
                        ? 'bg-rose-50/40 border-rose-100' // 未所持（赤）
                        : 'bg-slate-50 border-slate-100'  // 1枚のみ（グレー）
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1 pr-16">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-700 truncate block max-w-[150px]">
                          {acc.name}
                        </span>
                        {acc.isOwner && (
                          <span className="text-[9px] bg-slate-900 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-widest">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-400">
                        所持数: <span className="text-slate-700 font-bold">{acc.total}</span>
                      </p>

                      {/* トレード元（出し手）の場合：送り先候補とセットで表示 */}
                      {hasTradeable && potentialReceivers.length > 0 && (
                        <div className="mt-2">
                          <div className="space-y-3">
                            {potentialReceivers.map((receiver) => (
                              <div key={receiver.p_uid} className="pl-2 border-l-2 border-blue-100">
                                <p className="text-[9px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">To: {receiver.name}</p>
                                <div className="grid grid-cols-1 gap-1">
                                  {receiver.offeredCards.slice(0, 3).map((offered, i) => (
                                    <Link 
                                      key={i}
                                      href={`/trade/complete?cardId=${selectedCard.id}&fromProfileId=${acc.p_uid}&toProfileId=${receiver.p_uid}&receivedCardId=${offered.id}`}
                                      className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-xl border border-emerald-100 font-bold hover:bg-emerald-100 transition-all flex items-center justify-between group"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-emerald-400 font-black shrink-0">→</span>
                                        <span className="truncate max-w-[120px]">{offered.name}</span>
                                        {offered.pack && <span className="text-[8px] opacity-40 font-medium shrink-0">/ {offered.pack}</span>}
                                      </div>
                                      <ChevronLeft size={10} className="rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                  ))}
                                  {receiver.offeredCards.length > 3 && (
                                    <p className="text-[7px] text-slate-400 font-bold pl-1 italic">他 {receiver.offeredCards.length - 3} 枚の候補</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* ステータスバッジの出し分け */}
                    <div className="flex items-center gap-2 absolute top-3 right-3">
                      {hasTradeable ? (
                        <Link
                            href={`/trade/complete?cardId=${selectedCard.id}&fromProfileId=${acc.p_uid}`}
                            className="flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded-lg text-[9px] font-bold shadow-sm active:scale-95 transition-all shrink-0"
                          >
                            <ArrowLeftRight size={10} />
                            <span>トレード</span>
                          </Link>
                      ) : isMissing ? (
                        <div className="flex items-center gap-1 bg-rose-500 text-white px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-sm">
                          <AlertCircle size={10} />
                          <span>未所持</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-slate-300 text-slate-600 px-2.5 py-1 rounded-xl text-[10px] font-bold">
                          <CheckCircle size={10} />
                          <span>1枚キープ</span>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

            {/* モーダルフッター: 完了ボタンを固定配置 */}
            <div className="mt-2 pt-2 border-t border-slate-100">
              <button 
                onClick={() => setSelectedCard(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                完了
              </button>
            </div>
        </div>
        </div>
      )}

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