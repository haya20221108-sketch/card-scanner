'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ArrowLeftRight, CheckCircle2, AlertTriangle, RefreshCw, Star, Heart } from 'lucide-react';
import { supabase } from '../../supabase';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

import { getCachedMasterData, getCachedProfiles, getOnlineStatus } from '../../offline';
import { resolveCardDisplay } from '../../components/utils';
import { CustomAlert } from '../../components/CustomAlert';

interface Card {
  id: string;
  name?: string;
  image_url?: string;
  rank?: number;
  pack?: string;
}

interface ProfileExt {
  name: string;
  isMainGroup: boolean;
  favCardId: string;
}

export default function TradeCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // trade/page.tsx から渡されるクエリパラメータを解析
  const cardId = searchParams.get('cardId');               // 欲しいメインカード
  const fromProfileId = searchParams.get('fromProfileId'); // 差し出す側のアカウント（サブ垢など）
  const toProfileId = searchParams.get('toProfileId');     // 受け取る側のアカウント（本垢など）
  const receivedCardId = searchParams.get('receivedCardId'); // 等価交換として見返りに渡すカード

  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [alert, setAlert] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'info' | 'error' | 'success' });

  const [giveCard, setGiveCard] = useState<Card | null>(null);
  const [takeCard, setTakeCard] = useState<Card | null>(null);
  const [fromProfile, setFromProfile] = useState<ProfileExt | null>(null);
  const [toProfile, setToProfile] = useState<ProfileExt | null>(null);

  // データの初期ロード処理
  const loadTradeDetails = useCallback(async () => {
    if (!cardId || !fromProfileId || !toProfileId || !receivedCardId) {
      setAlert({ isOpen: true, title: 'エラー', message: 'トレードパラメータが不足しています', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      // 1. マスターデータからカード情報を取得
      const masterCards = (getCachedMasterData() || []) as Card[];
      const cGive = masterCards.find(c => String(c.id) === String(cardId));
      const cTake = masterCards.find(c => String(c.id) === String(receivedCardId));
      setGiveCard(cGive || { id: cardId, name: 'Unknown Card' });
      setTakeCard(cTake || { id: receivedCardId, name: 'Unknown Card' });

      // 2. ローカルキャッシュから基本プロフィールを取得
      const cachedProfs = getCachedProfiles() || [];
      const pFromBase = cachedProfs.find((p: any) => p.id === fromProfileId);
      const pToBase = cachedProfs.find((p: any) => p.id === toProfileId);

      // 3. Firebase (Firestore) から拡張設定（本垢・推し情報）を引っ張る
      const fromDoc = await getDoc(doc(db, 'profiles', fromProfileId));
      const toDoc = await getDoc(doc(db, 'profiles', toProfileId));

      const fromData = fromDoc.exists() ? fromDoc.data() : {};
      const toData = toDoc.exists() ? toDoc.data() : {};

      setFromProfile({
        name: pFromBase?.display_name || fromData?.display_name || 'User A',
        isMainGroup: fromData?.is_main_group ?? false,
        favCardId: fromData?.fav_card_id ?? ''
      });

      setToProfile({
        name: pToBase?.display_name || toData?.display_name || 'User B',
        isMainGroup: toData?.is_main_group ?? false,
        favCardId: toData?.fav_card_id ?? ''
      });

    } catch (err) {
      console.error(err);
      setAlert({ isOpen: true, title: '読み込みエラー', message: 'データの同期に失敗しました', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [cardId, fromProfileId, toProfileId, receivedCardId]);

  useEffect(() => {
    loadTradeDetails();
  }, [loadTradeDetails]);

  // ★ トレード確定ボタンを押した時のインベントリ書き換え処理
  const handleConfirmTrade = async () => {
    if (!getOnlineStatus()) {
      setAlert({ isOpen: true, title: 'オフライン', message: 'ネットワーク接続が必要です', type: 'error' });
      return;
    }

    setExecuting(true);
    try {
      // ーーー 等価交換のロジック実行（Supabase側の inventory を増減） ーーー
      
      // 1. 出す側 (fromProfileId) の処理
      // メインカードを 1 減らす
      await supabase.rpc('increment_inventory', { p_card_id: cardId, p_profile_id: fromProfileId, p_amount: -1 });
      // 見返りカードを 1 増やす
      await supabase.rpc('increment_inventory', { p_card_id: receivedCardId, p_profile_id: fromProfileId, p_amount: 1 });

      // 2. 受け取る側 (toProfileId) の処理
      // メインカードを 1 増やす
      await supabase.rpc('increment_inventory', { p_card_id: cardId, p_profile_id: toProfileId, p_amount: 1 });
      // 見返りカードを 1 減らす
      await supabase.rpc('increment_inventory', { p_card_id: receivedCardId, p_profile_id: toProfileId, p_amount: -1 });

      setAlert({ isOpen: true, title: 'トレード成立', message: 'インベントリの等価交換が完了しました！', type: 'success' });

      setTimeout(() => {
        router.push('/trade');
      }, 2000);

    } catch (err) {
      console.error("Trade Error:", err);
      setAlert({ isOpen: true, title: 'トレード失敗', message: 'DBの更新処理中にエラーが起きました', type: 'error' });
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw size={24} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  const giveCardDisplay = giveCard ? resolveCardDisplay(giveCard) : { name: 'Unknown' };
  const takeCardDisplay = takeCard ? resolveCardDisplay(takeCard) : { name: 'Unknown' };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col max-w-md mx-auto relative pb-12">
      {/* Header */}
      <header className="px-4 py-4 bg-white border-b border-slate-100 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <Link href="/trade" className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-xl transition-all">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Confirm Trade</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">トレード内容の最終確認</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4 space-y-6 flex-1">
        
        {/* トレード構造の視覚化コンテナ */}
        <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm space-y-4 relative overflow-hidden">
          
          {/* 取引元 (From) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-md">From (差し出し元)</span>
              {fromProfile?.isMainGroup && <span className="text-[8px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">メイン</span>}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-slate-800">{fromProfile?.name}</p>
              <div className="text-right">
                <p className="text-sm font-black text-rose-600">-1枚 放出</p>
                <p className="text-[11px] font-bold text-slate-700 truncate max-w-[180px] flex items-center gap-0.5 justify-end">
                  {giveCardDisplay.name}
                  {fromProfile?.favCardId === String(cardId) && <Heart size={10} className="text-rose-500" fill="currentColor" />}
                </p>
              </div>
            </div>
          </div>

          {/* 中央の境界線 */}
          <div className="relative flex justify-center my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-slate-200"></div></div>
            <div className="relative p-2 bg-slate-50 border border-slate-100 text-slate-400 rounded-full shadow-sm z-10">
              <ArrowLeftRight size={16} className="rotate-90" />
            </div>
          </div>

          {/* 取引先 (To) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-500 uppercase bg-blue-50 px-2 py-0.5 rounded-md">To (受け取り先)</span>
              {toProfile?.isMainGroup && <span className="text-[8px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">メイン</span>}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-slate-800">{toProfile?.name}</p>
              <div className="text-right">
                <p className="text-sm font-black text-emerald-600">+1枚 獲得</p>
                <p className="text-[11px] font-bold text-slate-700 truncate max-w-[180px] flex items-center gap-0.5 justify-end">
                  {giveCardDisplay.name}
                  {toProfile?.favCardId === String(cardId) && <Heart size={10} className="text-rose-500" fill="currentColor" />}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 見返りカードの表示セクション */}
        <div className="bg-slate-100/70 border border-slate-200/50 rounded-2xl p-4 space-y-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <ArrowLeftRight size={12} /> 等価交換用の引き換えカード（見返り）
          </h3>
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400">{takeCard?.pack || "EX Pack"}</p>
              <p className="text-sm font-bold text-slate-800 flex items-center gap-1">
                {takeCardDisplay.name}
                {fromProfile?.favCardId === String(receivedCardId) && <Heart size={10} className="text-rose-500" fill="currentColor" />}
              </p>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: takeCard?.rank || 0 }).map((_, i) => (
                  <Star key={i} size={8} className="text-amber-400" fill="currentColor" strokeWidth={0} />
                ))}
              </div>
            </div>
            <div className="text-right text-xs font-bold">
              <p className="text-emerald-600">{fromProfile?.name} へ (+1)</p>
              <p className="text-rose-600">{toProfile?.name} から (-1)</p>
            </div>
          </div>
        </div>

        {/* 注意事項 */}
        <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl flex items-start gap-2.5">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
          <div className="text-[11px] text-amber-700 font-medium leading-normal">
            確定ボタンを押すと両アカウントのインベントリ数が即時更新されます。この操作は取り消せません。
          </div>
        </div>

      </div>

      {/* Action Footer */}
      <div className="px-4 sticky bottom-4">
        <button
          onClick={handleConfirmTrade}
          disabled={executing}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-wider uppercase shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {executing ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>トレード処理中...</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={16} />
              <span>トレードを確定する</span>
            </>
          )}
        </button>
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