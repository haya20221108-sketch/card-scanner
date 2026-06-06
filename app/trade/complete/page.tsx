'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, Star, RefreshCw, ArrowRightLeft, Search, Check, AlertCircle, SlidersHorizontal, XCircle, CheckCircle2, Copy } from 'lucide-react';
import { getCachedMasterData, getCachedProfiles, getDbBackedProfiles, getCachedRawCollection, getOnlineStatus, rememberUserId, normalizePUid } from '../../offline';
import { upsertInventoryItem } from '../../profileStore';
import { supabase } from '../../supabase';
import { resolveCardDisplay } from '../../components/utils';
import { useAuth } from '@/AuthContext';

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

export default function TradeCompletePage() {
  const { user } = useAuth(); // user情報を取得
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = searchParams.get('cardId');
  
  const [loading, setLoading] = useState(true);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  
  // トレード設定用のステータス
  const [profiles, setProfiles] = useState<any[]>([]);
  const dbProfiles = useMemo(() => getDbBackedProfiles(profiles), [profiles]);
  const [fromProfileId, setFromProfileId] = useState('');
  const [toProfileId, setToProfileId] = useState('');
  const [receivedCard, setReceivedCard] = useState<Card | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPack, setSelectedPack] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<'missing' | 'owned' | 'duplicate'>('missing');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tradeType, setTradeType] = useState<'immediate' | 'reserve'>('reserve');

  // コレクションデータをロードする関数をuseCallbackでラップ
  const loadCollectionData = useCallback(async () => {
    try {
      const isOnline = getOnlineStatus();
      let collData: CollectionRecord[] = [];

      if (isOnline && user?.uid) {
        rememberUserId(user.uid);
        const { data, error } = await supabase
          .from('inventory')
          .select('card_id, p_uid, count');
        
        if (!error && data) {
          collData = data.map((r: any) => ({
            card_id: r.card_id,
            p_uid: r.p_uid, // 生のIDを保持（find時に正規化して照合する）
            quantity: r.count
          }));
        } else if (error) {
          console.error("Supabase collection fetch error:", error);
        }
      }
      
      if (collData.length === 0) {
        collData = (getCachedRawCollection() || []) as CollectionRecord[];
      }
      setCollectionRecords(collData);
    } catch (e) {
      console.error("Online collection fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const masterData = getCachedMasterData() as Card[];
    setAllCards(masterData);
    
    if (cardId) {
      const foundCard = masterData.find(c => String(c.id) === cardId);
      setCard(foundCard || null);
    }
    
    const profs = getCachedProfiles() || [];
    setProfiles(profs);
    
    // クエリパラメータから送り元を特定して初期値に設定
    const fromParam = searchParams.get('fromProfileId');
    if (fromParam) {
      setFromProfileId(fromParam);
    }

    const toParam = searchParams.get('toProfileId');
    if (toParam) {
      setToProfileId(toParam);
    }

    // URLから受け取りカードが指定されている場合の処理
    const receivedCardParam = searchParams.get('receivedCardId');
    if (receivedCardParam) {
      const found = masterData.find(c => String(c.id) === receivedCardParam);
      if (found) setReceivedCard(found);
    }

    setLoading(true);
    loadCollectionData();
  }, [cardId, loadCollectionData, searchParams]);

  const getCardQuantityForProfile = useCallback((profileId: string | null, targetCardId: string): number => {
    if (!profileId || !targetCardId) return 0;
    
    const targetProfileIdNorm = normalizePUid(profileId);
    const targetCardIdStr = String(targetCardId);

    const record = collectionRecords.find(r => 
      (r.p_uid === profileId || normalizePUid(r.p_uid) === targetProfileIdNorm) && 
      String(r.card_id) === targetCardIdStr
    );
    return record?.quantity || 0;
  }, [collectionRecords]);

  // 送り先（toProfileId）が持っている余剰カード（候補）を抽出
  const suggestedCards = useMemo(() => {
    if (!card || !toProfileId || toProfileId === 'external') return [];
    
    return allCards.filter(c => {
      // 同じランクであること
      if (c.rank !== card.rank || String(c.id) === String(card.id)) return false;
      
      // 送り先アカウントが2枚以上持っている（余剰がある）こと
      const qty = getCardQuantityForProfile(toProfileId, c.id);
      return qty > 1;
    }).slice(0, 4); // 最大4件表示
  }, [allCards, card, toProfileId, getCardQuantityForProfile]);

  // 現在のランクに含まれるパック一覧を取得
  const packsForRank = useMemo(() => {
    if (!card) return [];
    const rank = card.rank;
    const packs = new Set<string>();
    allCards.forEach(c => {
      if (c.rank === rank && c.pack) packs.add(c.pack);
    });
    return Array.from(packs).sort();
  }, [allCards, card]);

  const filteredCards = useMemo(() => {
    if (!card) return []; // 送るカードが選択されていない場合はフィルタしない

    const sendingCardRank = card.rank;

    return allCards.filter(c => {
      // ランクが同じカードのみを対象とする
      if (sendingCardRank !== undefined && c.rank !== sendingCardRank) {
        return false;
      }
      // パックでフィルタ
      if (selectedPack && c.pack !== selectedPack) {
        return false;
      }
      // 所有状況フィルター
      const myQty = getCardQuantityForProfile(fromProfileId, c.id);
      if (ownershipFilter === 'missing') {
        if (myQty > 0) return false;
      } else if (ownershipFilter === 'owned') {
        if (myQty === 1) return false;
      } else if (ownershipFilter === 'duplicate') {
        if (myQty < 2) return false;
      }

      // 検索クエリがある場合のみフィルタし、ない場合は同ランク全てを表示
      if (searchQuery && !c.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [allCards, searchQuery, card, selectedPack, ownershipFilter, fromProfileId, getCardQuantityForProfile]);

  const handleExecuteTrade = async () => {
    if (!card || !receivedCard || !fromProfileId || !toProfileId) return;
    
    setIsSubmitting(true);
    try {
      if (tradeType === 'immediate') {
        // トレード処理の実行（即時: 在庫を更新）
        const fromQty = getCardQuantityForProfile(fromProfileId, card.id);
        const toQty = toProfileId === 'external' ? 0 : getCardQuantityForProfile(toProfileId, card.id);

        // 送り元のカードを1枚減らす
        await upsertInventoryItem(fromProfileId, card.id, Math.max(0, fromQty - 1));
        
        // 送り先がアプリ内アカウントなら、そのカードを1枚増やす
        if (toProfileId !== 'external') {
          await upsertInventoryItem(toProfileId, card.id, toQty + 1);
        }
        alert('トレードを即時完了し、在庫を更新しました！');
      } else {
        // 予約処理の実行（現状は在庫を動かさず成功通知のみ）
        alert('トレードを予約しました。在庫の変更は行われていません。');
      }
      
      router.push('/trade');
    } catch (e) {
      console.error(e);
      alert('保存中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <RefreshCw size={24} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
        <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter mb-4">
          カードが見つかりません
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          指定されたカードIDのデータが見つかりませんでした。
        </p>
        <Link href="/trade" className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg active:scale-95 transition-all">
          トレードリストに戻る
        </Link>
      </div>
    );
  }

  const display = resolveCardDisplay(card);
  const fromQty = getCardQuantityForProfile(fromProfileId, card.id);
  const toQty = getCardQuantityForProfile(toProfileId, card.id);
  const fromProfile = dbProfiles.find(p => p.id === fromProfileId);
  const toProfile = dbProfiles.find(p => p.id === toProfileId);

  // ステップ進度を計算
  const completedSteps = [fromProfileId, toProfileId, receivedCard, tradeType].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <header className="px-4 py-2.5 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-2.5">
          <Link href="/trade" className="p-1.5 -ml-1 text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold italic text-slate-900 uppercase tracking-tighter">Trade Setup</h1>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">トレードの詳細設定</p>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div 
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(completedSteps / 4) * 100}%` }}
          />
        </div>
      </header>

      <div className="px-4 py-5 space-y-6 flex-1">
        {/* Step 1: Sending Card */}
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">1</div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
              {fromProfile?.display_name || '選択済み'} が送るカード
            </p>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-[2rem] shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 uppercase leading-tight mb-1">{display.name}</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: card.rank || 0 }).map((_, i) => (
                      <Star key={i} size={12} className="text-amber-400" fill="currentColor" strokeWidth={0} />
                    ))}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">{card.pack}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  ×{fromQty}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">所持数</p>
              </div>
            </div>
          </div>

          {/* 他アカウントの所持状況サマリー */}
          <div className="flex flex-wrap gap-2 px-1">
            {dbProfiles
              .filter(p => p.id !== fromProfileId)
              .sort((a, b) => getCardQuantityForProfile(b.id, card.id) - getCardQuantityForProfile(a.id, card.id))
              .map(p => (
              <div key={p.id} className="bg-white/60 px-2.5 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate max-w-[60px]">{p.display_name}</span>
                <span className={`text-xs font-bold ${getCardQuantityForProfile(p.id, card.id) > 0 ? 'text-blue-500' : 'text-slate-300'}`}>
                  ×{getCardQuantityForProfile(p.id, card.id)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Step 2: Accounts Selection */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-slate-200 text-white text-[10px] font-bold flex items-center justify-center">2</div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">送り先を選択</p>
          </div>

          {/* To Account */}
          <div className="space-y-2">
            <div className="flex overflow-x-auto no-scrollbar gap-2.5 pb-2">
              {dbProfiles
                .filter(p => p.id !== fromProfileId)
                .sort((a, b) => getCardQuantityForProfile(b.id, card.id) - getCardQuantityForProfile(a.id, card.id))
                .map(p => (
                <button
                  key={p.id}
                  onClick={() => setToProfileId(p.id)}
                  className={`flex-shrink-0 w-24 p-2 rounded-2xl border-2 transition-all font-bold text-sm uppercase tracking-tight ${
                    toProfileId === p.id
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                      : 'bg-white text-slate-600 border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="truncate">{p.display_name}</div>
                  <div className={`text-[10px] mt-0.5 ${toProfileId === p.id ? 'text-emerald-100' : 'text-slate-400'}`}>
                    ×{getCardQuantityForProfile(p.id, card.id)}
                  </div>
                </button>
              ))}
              <button
                onClick={() => setToProfileId('external')}
                className={`flex-shrink-0 w-24 p-2 rounded-2xl border-2 transition-all font-bold text-sm uppercase tracking-tight ${
                  toProfileId === 'external'
                    ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                    : 'bg-white text-slate-600 border-slate-100 hover:border-slate-200'
                }`}
              >
                <div>外部</div>
                <div className={`text-[10px] mt-0.5 ${toProfileId === 'external' ? 'text-slate-300' : 'text-slate-400'}`}>
                  未追跡
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Step 3: Receiving Card */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
              fromProfileId && toProfileId ? 'bg-green-600' : 'bg-slate-300'
            }`}>3</div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">もらうカード<span className="text-rose-500 ml-1">(必須)</span></p>
          </div>

          {receivedCard ? (
            <div className="bg-white border border-emerald-200 p-4 rounded-[2rem] shadow-sm flex items-start justify-between relative overflow-hidden transition-all">
              <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-emerald-200/20 rounded-full" />
              <div className="relative z-10">
                <h3 className="text-lg font-bold text-slate-900 uppercase mb-1">{receivedCard.name}</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: receivedCard.rank || 0 }).map((_, i) => (
                      <Star key={i} size={12} className="text-amber-400" fill="currentColor" strokeWidth={0} />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{receivedCard.pack}</span>
                </div>
                <div className="mt-2.5 text-xs font-bold text-emerald-500 inline-flex items-center gap-1">✓ 選択済み</div>
              </div>
              <button 
                onClick={() => {
                  setReceivedCard(null);
                  setSearchQuery('');
                }}
                className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100/50 rounded-full transition-all relative z-10"
              >
                変更
              </button>
            </div>
          ) : (
            <div className="space-y-4 bg-white border border-dashed border-slate-200 p-4 rounded-[2.5rem]">
              {/* Search & Action Filters */}
              <div className="flex gap-1.5 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                  <input
                    type="text"
                    placeholder="カード検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 bg-slate-50 rounded-xl text-[11px] focus:outline-none border border-transparent focus:border-blue-100 transition-all font-semibold"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300">
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
                
                {/* Ownership Filter Button */}
                <button
                  onClick={() => setOwnershipFilter(prev => {
                    if (prev === 'missing') return 'owned';
                    if (prev === 'owned') return 'duplicate';
                    return 'missing';
                  })}
                  className={`h-9 px-3 rounded-xl border transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                    ownershipFilter === 'missing' ? 'bg-blue-500 text-white border-blue-500 shadow-sm' : 
                    ownershipFilter === 'owned' ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' :
                    'bg-amber-500 text-white border-amber-500 shadow-sm'
                  }`}
                >
                  {ownershipFilter === 'missing' && <Star size={14} fill="white" />}
                  {ownershipFilter === 'owned' && <CheckCircle2 size={14} />}
                  {ownershipFilter === 'duplicate' && <Copy size={14} />}
                  <span className="text-[10px] font-bold uppercase tracking-tight">
                    {ownershipFilter === 'missing' ? '未所持' : ownershipFilter === 'owned' ? '1枚以上' : '2枚以上'}
                  </span>
                </button>
              </div>

              {/* Pack Filters (Always Visible) */}
              <div className="flex overflow-x-auto no-scrollbar gap-1.5 pb-0.5 px-0.5">
                <button
                  onClick={() => setSelectedPack('')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${selectedPack === '' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-400 border-slate-100'}`}
                >
                  All Packs
                </button>
                {packsForRank.map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPack(p)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${selectedPack === p ? 'bg-blue-500 text-white border-blue-500 shadow-sm' : 'bg-white text-slate-400 border-slate-100'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              
              {/* Suggested Cards from target account */}
              {!searchQuery && suggestedCards.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest px-1">相手の余剰カード（おすすめ候補）</p>
                  <div className="grid grid-cols-2 gap-2">
                    {suggestedCards.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setReceivedCard(c)}
                        className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-2.5 text-left flex items-center justify-between gap-2 active:scale-95 transition-all overflow-hidden"
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-1">
                          <span className="text-emerald-400 font-black shrink-0">→</span>
                          <div className="truncate">
                            <span className="text-[11px] font-bold text-emerald-800 uppercase">{resolveCardDisplay(c).name}</span>
                            <span className="text-[9px] font-bold text-emerald-400/60 ml-1 uppercase">/ {c.pack}</span>
                          </div>
                        </div>
                        <div className="shrink-0 bg-emerald-500 text-white rounded-full p-1">
                          <Check size={10} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchQuery && filteredCards.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">No Cards Found</p>
                </div>
              )}

              {filteredCards.length > 0 && (
                <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-300">
                  {filteredCards.map(c => {
                    const targetDisplay = resolveCardDisplay(c);
                    const fromAccountQty = getCardQuantityForProfile(fromProfileId, c.id);
                    const toAccountQty = getCardQuantityForProfile(toProfileId, c.id);
                    
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setReceivedCard(c);
                          setSearchQuery('');
                        }}
                        className="bg-white rounded-2xl border border-slate-100 hover:border-blue-400 p-2.5 text-left flex items-center justify-between gap-2 active:scale-95 transition-all overflow-hidden group shadow-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[11px] font-bold text-slate-800 leading-tight uppercase truncate">
                            {targetDisplay.name}
                          </h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">
                            {c.pack}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 pl-2 border-l border-slate-100">
                          <div className="flex flex-col items-center">
                            <span className="text-[6px] font-bold text-slate-400 leading-none mb-0.5">F</span>
                            <span className="text-[10px] font-bold text-blue-500">×{fromAccountQty}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[6px] font-bold text-slate-400 leading-none mb-0.5">T</span>
                            <span className={`text-[10px] font-bold ${toAccountQty > 0 ? 'text-emerald-500' : 'text-slate-200'}`}>
                              ×{toAccountQty}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Step 4: Trade Type Selection */}
        <section className="space-y-3 pb-8">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${receivedCard ? 'bg-indigo-600' : 'bg-slate-300'}`}>4</div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">実行タイミング</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTradeType('immediate')}
              className={`py-3.5 rounded-2xl border-2 font-bold text-[11px] uppercase tracking-wider transition-all flex flex-col items-center gap-1 ${
                tradeType === 'immediate'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white text-slate-400 border-slate-100'
              }`}
            >
              <span>即時トレード</span>
              <span className="text-[7px] opacity-70">在庫を今すぐ更新</span>
            </button>
            <button
              onClick={() => setTradeType('reserve')}
              className={`py-3.5 rounded-2xl border-2 font-bold text-[11px] uppercase tracking-wider transition-all flex flex-col items-center gap-1 ${
                tradeType === 'reserve'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                  : 'bg-white text-slate-400 border-slate-100'
              }`}
            >
              <span>トレード予約</span>
              <span className="text-[7px] opacity-70">あとで反映 (メモのみ)</span>
            </button>
          </div>
        </section>

        {/* Final Action Button - Moved from fixed to end of scroll content */}
        <div className="pt-4 pb-16">
          <button
            disabled={!fromProfileId || !toProfileId || !receivedCard || isSubmitting}
            onClick={handleExecuteTrade}
            className={`w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${
              (!fromProfileId || !toProfileId || !receivedCard || isSubmitting) 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : tradeType === 'immediate'
                ? 'bg-slate-900 text-white active:scale-[0.98] shadow-slate-200'
                : 'bg-indigo-600 text-white active:scale-[0.98] shadow-indigo-100'
            }`}
          >
            {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />} 
            {isSubmitting ? '処理中...' : tradeType === 'immediate' ? 'トレードを完了する (即時)' : 'トレードを完了する (予約)'}
          </button>

          {(!fromProfileId || !toProfileId || !receivedCard) && (
            <p className="text-[10px] text-slate-400 text-center mt-3 font-bold uppercase tracking-tighter">
              すべてのステップを完了してください
            </p>
          )}
        </div>
      </div>
    </div>
  );
}