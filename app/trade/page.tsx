'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, RefreshCw, Settings, Inbox, Star, ArrowLeftRight, X, CheckCircle, AlertCircle, XCircle, Heart } from 'lucide-react';
import { supabase } from '../supabase';
// ★ Firebase から必要な関数と初期化済みの db インスタンスをインポート
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

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
  subtype?: string;
}

interface CollectionRecord {
  card_id: string;
  p_uid?: string;
  quantity: number;
}

// Firebaseから取得する追加属性を含んだアカウント状態の型定義
interface AccountStatus {
  p_uid: string;
  name: string;
  total: number;
  tradeable: number;
  isOwner: boolean;
  isMainGroup: boolean; // ★ Firebase上のグループメインフラグ
  favCardId: string;    // ★ Firebase上の推しカードID
  favCharacter: string; // ★ Firebase上の推しキャラ名
  offeredCards: { id: string; name: string; pack?: string }[];
}

export default function TradePage() {
  const { user } = useAuth(); // Firebase Auth などのユーザー情報（uid）を想定
  const [loading, setLoading] = useState(true);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [alert, setAlert] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'info' | 'error' | 'success' });
  
  //設定専用モーダル
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // 既存のプロフィール情報
  const [profiles, setProfiles] = useState<any[]>([]);
  const dbProfiles = useMemo(() => getDbBackedProfiles(profiles), [profiles]);
  
  // ★ Firebaseから取得した「推し・本垢」の追加メタデータを管理するState
  const [firebaseExtMap, setFirebaseExtMap] = useState<Map<string, { is_main_group: boolean, fav_card_id: string, fav_character: string }>>(new Map());

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // ★ Firebaseのデータをロード、または未存在なら初期ドキュメントを自動作成する関数
  const loadFirebaseMetaData = useCallback(async (profileList: any[]) => {
    const extMap = new Map<string, { is_main_group: boolean, fav_card_id: string, fav_character: string }>();
    
    for (const prof of profileList) {
      const docRef = doc(db, "profiles", prof.id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        extMap.set(prof.id, {
          is_main_group: data.is_main_group ?? false,
          fav_card_id: data.fav_card_id ?? "",
          fav_character: data.fav_character ?? ""
        });
      } else {
        // ドキュメントがまだ存在しない場合は、デフォルト値をFirestoreに自動作成
        const defaultData = {
          id: prof.id,
          display_name: prof.display_name || 'User',
          user_id: user?.uid || "",
          is_main_group: false,
          fav_card_id: "",
          fav_character: ""
        };
        await setDoc(docRef, defaultData);
        extMap.set(prof.id, { is_main_group: false, fav_card_id: "", fav_character: "" });
      }
    }
    setFirebaseExtMap(extMap);
  }, [user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const isOnline = getOnlineStatus();
      let masterData = (getCachedMasterData() || []) as Card[];
      setAllCards(masterData);

      const profData = getCachedProfiles() || [];
      setProfiles(profData);

      // プロフィール一覧が確定した後に Firebase の設定データを紐付けロード
      const backedProfs = getDbBackedProfiles(profData);
      await loadFirebaseMetaData(backedProfs);

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, loadFirebaseMetaData]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // ★ Firebaseに「グループメイン」を設定する関数（他をリセットする一括バッチ処理付き）
  const handleRegisterMainGroup = async (profileId: string, currentStatus: boolean) => {
    if (!user?.uid) return;
    try {
      // 1. 本垢にする場合、自分（親UID）が持つ他の全プロフィールのフラグを一括で false にする
      if (!currentStatus) {
        const q = query(collection(db, 'profiles'), where('user_id', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        querySnapshot.forEach((d) => {
          batch.update(doc(db, 'profiles', d.id), { is_main_group: false });
        });
        await batch.commit();
      }

      // 2. 選択されたプロフィールを更新
      const targetRef = doc(db, 'profiles', profileId);
      await updateDoc(targetRef, { is_main_group: !currentStatus });

      setAlert({ isOpen: true, title: '成功', message: 'グループメイン設定を保存しました', type: 'success' });
      await loadData(); // リロードして画面に反映
    } catch (err) {
      setAlert({ isOpen: true, title: 'エラー', message: '保存に失敗しました', type: 'error' });
    }
  };

  // ★ Firebaseに「推しカード」を登録する関数
  const handleRegisterFavorite = async (profileId: string, cardId: string, charName: string) => {
    try {
      const targetRef = doc(db, 'profiles', profileId);
      await updateDoc(targetRef, {
        fav_card_id: cardId,
        fav_character: charName
      });
      setAlert({ isOpen: true, title: '推し登録', message: `推しカードを【${charName}】に設定しました`, type: 'success' });
      await loadData();
    } catch (err) {
      setAlert({ isOpen: true, title: 'エラー', message: '推し登録に失敗しました', type: 'error' });
    }
  };


  // カード全体の統計（Firebaseのグループメイン属性を参照して計算）
  const cardStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; tradeable: number }>();
    
    collectionRecords.forEach((r) => {
      const cId = String(r.card_id);
      const qty = r.quantity || 0;
      if (!map.has(cId)) map.set(cId, { total: 0, tradeable: 0 });
      const entry = map.get(cId)!;
      entry.total += qty;

      // Firebaseから読み込んだ各アカウントのメタデータを取得
      const meta = firebaseExtMap.get(r.p_uid || "");
      const isMainGroup = meta?.is_main_group ?? false;

      // ★ グループメイン（本垢）なら1枚残す、未登録アカウントなら1枚目から全て放出可能
      if (isMainGroup) {
        entry.tradeable += Math.max(0, qty - 1);
      } else {
        entry.tradeable += qty;
      }
    });
    
    return map;
  }, [collectionRecords, firebaseExtMap]);

  // モーダル用の個別内訳解析
  const accountBreakdown = useMemo(() => {
    if (!selectedCard) return [];

    const targetRecords = collectionRecords.filter(r => String(r.card_id) === String(selectedCard.id));
    const accountMap = new Map<string, AccountStatus>();

    dbProfiles.forEach(prof => {
      const record = targetRecords.find(r => r.p_uid === prof.id);
      const total = record?.quantity || 0;
      
      // Firebaseから拡張データを取得
      const meta = firebaseExtMap.get(prof.id) || { is_main_group: false, fav_card_id: "", fav_character: "" };

      // 同じランクの交換候補カードを抽出
      const offeredCards = allCards
        .filter(c => c.rank !== undefined && c.rank === selectedCard.rank && String(c.id) !== String(selectedCard.id))
        .filter(c => {
          const r = collectionRecords.find(rec => rec.p_uid === prof.id && String(rec.card_id) === String(c.id));
          const qty = r?.quantity || 0;
          // グループメインなら2枚以上所持、未登録なら1枚以上所持で交換カードリストに出せる
          return meta.is_main_group ? qty > 1 : qty > 0;
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
        tradeable: meta.is_main_group ? Math.max(0, total - 1) : total,
        isOwner: user?.uid === prof.id,
        isMainGroup: meta.is_main_group,
        favCardId: meta.fav_card_id,
        favCharacter: meta.fav_character,
        offeredCards
      });
    });

    return Array.from(accountMap.values())
      .filter(acc => acc.tradeable > 0 || (acc.total === 0 && acc.offeredCards.length > 0))
      .sort((a, b) => {
        if (a.tradeable > 0 && b.tradeable === 0) return -1;
        if (a.tradeable === 0 && b.tradeable > 0) return 1;
        return 0;
      });
  }, [selectedCard, collectionRecords, user, dbProfiles, allCards, firebaseExtMap]);

  // 表示自動ソート
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
    }).map((card) => {
      const cardRecords = collectionRecords.filter(r => String(r.card_id) === String(card.id));
      let holdersCount = 0;
      let missingCount = 0;
      let isMyMissing = true;
      let isMyHolding = false;

      dbProfiles.forEach(prof => {
        const record = cardRecords.find(r => r.p_uid === prof.id);
        const total = record?.quantity || 0;
        const isMe = user?.uid === prof.id;

        if (total > 0) {
          holdersCount++;
          if (isMe) { isMyMissing = false; isMyHolding = true; }
        } else {
          missingCount++;
        }
      });

      let personalScore = 0;
      if (isMyMissing && holdersCount > 0) personalScore = 3000;
      else if (isMyHolding && missingCount > 0) personalScore = 2000;

      const matchScore = holdersCount * missingCount;
      const rankScore = (card.rank || 0) * 10;

      return { ...card, totalScore: personalScore + matchScore + rankScore };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }, [allCards, cardStatsMap, searchQuery, collectionRecords, user, dbProfiles]);

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
          <div>
            <h1 className="text-2xl font-extrabold italic text-slate-900 uppercase tracking-tight">Trade List</h1>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">交換可能なカード</p>
          </div>
        </div>
        <div className='flex item-center gap-3'>
          <RefreshCw size={20} className="text-slate-300 cursor-pointer" onClick={() => loadData()} />
          <button onClick={() => setIsSettingsOpen(true)} className="text-slate-800 cursor-pointer">
            <Settings size={20}/>
          </button>
        </div>
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
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 gap-3 pb-32">
          {tradeableCards.map((card) => {
            const display = resolveCardDisplay(card);
            
            // アカウントサマリー表示の構築
            const cardRecords = collectionRecords.filter(r => String(r.card_id) === String(card.id));
            const accountSummary = dbProfiles
              .map(prof => {
                const record = cardRecords.find(r => r.p_uid === prof.id);
                const total = record?.quantity || 0;
                const meta = firebaseExtMap.get(prof.id);
                return {
                  name: prof.display_name || 'User',
                  tradeable: meta?.is_main_group ? Math.max(0, total - 1) : total,
                  total,
                  isFav: meta?.fav_card_id === String(card.id) // 推しカード判定
                };
              })
              .filter(acc => acc.total > 0);

            return (
              <button
                key={card.id}
                onClick={() => setSelectedCard(card)} 
                className="bg-white text-left focus:outline-none w-full rounded-[2rem] border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1 justify-between">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: card.rank || 0 }).map((_, i) => (
                        <Star key={i} size={10} className="text-amber-400" fill="currentColor" strokeWidth={0} />
                      ))}
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight uppercase tracking-tight truncate flex items-center gap-1">
                    {display.name}
                  </h3>
                  <span className="text-[9px] font-bold text-slate-400 block">{card.pack}</span>
                </div>

                {/* 所持アカウントのミニリスト表示（推し登録されているアカウントにはハートが付く） */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {accountSummary.map((acc, idx) => (
                    <div key={idx} className={`text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 border ${acc.tradeable > 0 ? 'bg-blue-50 text-blue-600 border-blue-100':'bg-slate-50 text-slate-400'}`}>
                      <span>{acc.name}</span>
                      {acc.isFav && <Heart size={8} className="text-rose-500" fill="currentColor" />}
                    </div>
                  ))}
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 詳細 ＆ 各種登録モーダル */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedCard(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-4 flex flex-col max-h-[85vh] border border-slate-100 animate-in fade-in zoom-in-95">
            
            <div className="flex justify-between items-start mb-4 px-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 uppercase">{resolveCardDisplay(selectedCard).name}</h2>
                <p className="text-[10px] font-bold text-blue-500 uppercase">アカウント別設定 ＆ 所持内訳</p>
              </div>
              <button onClick={() => setSelectedCard(null)} className="p-2 bg-slate-100 text-slate-400 rounded-full"><X size={16} /></button>
            </div>

            <div className="space-y-3 overflow-y-auto pb-6 flex-1 pr-1 custom-scrollbar">
              {accountBreakdown.map((acc) => {
                const isMissing = acc.total === 0;
                const hasTradeable = acc.tradeable > 0;
                const potentialReceivers = accountBreakdown.filter(a => a.total === 0);
                const isThisCardFav = acc.favCardId === String(selectedCard.id);

                return (
                  <div key={acc.p_uid} className={`p-3 rounded-2xl border flex flex-col gap-2 relative ${hasTradeable ? 'bg-blue-50/60 border-blue-100':'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-slate-700">{acc.name}</span>
                      
                      {/* ★ Firebase 側のグループメイン状態を表示 */}
                      {acc.isMainGroup ? (
                        <span className="text-[8px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded-md">メイン(本垢)</span>
                      ) : (
                        <span className="text-[8px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-md">未登録サブ</span>
                      )}

                      {/* ★ 推しカードであるかどうかのバッジ */}
                      {isThisCardFav && (
                        <span className="text-[8px] bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                          <Heart size={8} fill="currentColor" /> 推し
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-xs text-slate-500 font-semibold">所持数: <span className="text-slate-800 font-bold">{acc.total}</span></p>
                      
                      {/* ★ 推し登録ボタン（全アカウントで、このカードを推しにする操作） */}
                      <button
                        onClick={() => handleRegisterFavorite(acc.p_uid, String(selectedCard.id), resolveCardDisplay(selectedCard).name || "")}
                        className={`text-[10px] font-bold flex items-center gap-0.5 ${isThisCardFav ? 'text-rose-500':'text-slate-400 hover:text-rose-400'}`}
                      >
                        <Heart size={10} fill={isThisCardFav ? "currentColor" : "none"} />
                        {isThisCardFav ? "推し設定済" : "推しにする"}
                      </button>

                      {/* ★ グループメイン切り替えボタン（自分の所有しているアカウントのみ操作可能） */}
                      <button 
                        onClick={() => handleRegisterMainGroup(acc.p_uid, acc.isMainGroup)}
                        className="text-[10px] text-blue-500 hover:underline font-bold"
                      >
                        {acc.isMainGroup ? "メイン解除" : "メインに設定"}
                      </button>
                    </div>

                    {/* トレード元の場合：送り先候補の表示 */}
                    {hasTradeable && potentialReceivers.length > 0 && (
                      <div className="mt-1 pl-2 border-l-2 border-blue-200 space-y-1">
                        {potentialReceivers.map((receiver) => (
                          <div key={receiver.p_uid} className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400">To: {receiver.name}</p>
                            {receiver.offeredCards.slice(0, 2).map((offered, i) => (
                              <Link 
                                key={i}
                                href={`/trade/complete?cardId=${selectedCard.id}&fromProfileId=${acc.p_uid}&toProfileId=${receiver.p_uid}&receivedCardId=${offered.id}`}
                                className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-xl border border-emerald-100 font-bold hover:bg-emerald-100 transition-all flex items-center justify-between"
                              >
                                <span className="truncate">→ {offered.name}</span>
                                <ChevronLeft size={10} className="rotate-180" />
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setSelectedCard(null)} className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm uppercase">完了</button>
          </div>
        </div>
      )}
      {/* ★ 新設：設定専用モーダル */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-5 flex flex-col max-h-[80vh] border border-slate-100 animate-in fade-in zoom-in-95">
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 uppercase">アカウント設定</h2>
                <p className="text-[10px] font-bold text-blue-500 uppercase">メイングループ・プロフィールの管理</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-slate-100 text-slate-400 rounded-full">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pb-4 flex-1 pr-1 custom-scrollbar">
              {dbProfiles.map((prof) => {
                const meta = firebaseExtMap.get(prof.id) || { is_main_group: false, fav_character: "" };
                const isMe = user?.uid === prof.id;

                return (
                  <div key={prof.id} className={`p-4 rounded-2xl border flex flex-col gap-2 ${meta.is_main_group ? 'bg-blue-50/60 border-blue-100':'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{prof.display_name || 'User'}</span>
                        {isMe && (
                          <span className="text-[8px] bg-slate-900 text-white font-bold px-1 py-0.5 rounded">YOU</span>
                        )}
                      </div>
                      
                      {/* メインアカウント切り替えスイッチ風ボタン */}
                      <button 
                        onClick={() => handleRegisterMainGroup(prof.id, meta.is_main_group)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition-all ${
                          meta.is_main_group 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200' 
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {meta.is_main_group ? "★ メイン(本垢)" : "サブ垢として運用"}
                      </button>
                    </div>

                    {/* 現在の推しキャラのステータス表示 */}
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                      <Heart size={10} className={meta.fav_character ? "text-rose-500" : "text-slate-300"} fill={meta.fav_character ? "currentColor" : "none"} />
                      <span>現在の推しカード: <strong className="text-slate-600">{meta.fav_character || "未設定（カード詳細から登録）"}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              onClick={() => setIsSettingsOpen(false)} 
              className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-slate-200 active:scale-[0.98] transition-all"
            >
              設定を閉じる
            </button>
          </div>
        </div>
      )}

      <CustomAlert isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title={alert.title} message={alert.message} type={alert.type} />
    </div>
  );
}