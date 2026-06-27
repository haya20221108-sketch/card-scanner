"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Save, Plus, Minus, Edit3, Layers, CloudOff, Inbox, Menu, X, Users, Filter } from "lucide-react";

import { supabase } from "../supabase";
import { ensureProfiles, upsertInventoryItem } from "../profileStore";
import * as offlineModule from "../offline";
import { CustomAlert } from "../components/CustomAlert";
import { useAuth } from "../../AuthContext";

interface ProfileUI {
  id: string;
  display_name: string;
}

interface Card {
  id: string;
  name?: string;
  rank?: number;
  pack?: string;
  group?: string;
}

type FilterMode = "all" | "owned" | "missing";

export default function BinderPage() {
  const { user: rawUser, loading: authLoading } = useAuth();
  const user = rawUser as any;

  // コアステート
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [profiles, setProfiles] = useState<ProfileUI[]>([]);
  const [collection, setCollection] = useState<any[]>([]);
  const [targetPUid, setTargetPUid] = useState<string>(""); // "" のときが未選択（ALL）状態
  
  // フィルター・サイドバー制御
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState<Map<string, { normal: number }>>(new Map());

  const [alertConfig, setAlertConfig] = useState({ 
    isOpen: false, title: "", message: "", type: "info" as "info" | "success" | "error" 
  });

  const showAlert = useCallback((title: string, message: string, type: "info" | "success" | "error") => {
    setAlertConfig({ isOpen: true, title, message, type });
  }, []);

  // 選択中のカードと編集データを維持する
  const [editingCard, setEditingCard] = useState<any | null>(null);
  const [modalBuffer, setModalBuffer] = useState<Map<string, { normal: number }>>(new Map());

  // 💡 【追加】インライン編集(isEditing)かモーダル(editingCard)が開いている時はTabBarを隠す
  useEffect(() => {
    const tabbar = document.getElementById("global-tabbar");
    if (!tabbar) return;

    if (isEditing || editingCard) {
      tabbar.style.display = "none";
    } else {
      tabbar.style.display = "block";
    }

    return () => {
      if (tabbar) tabbar.style.display = "block";
    };
  }, [isEditing, editingCard]);

  // データ同期・ロード処理
  useEffect(() => {
    let isMounted = true;
    
    async function loadData() {
      try {
        // 1. マスタデータの読み込み
        let master = typeof (offlineModule as any).getCachedMasterData === "function" 
          ? await (offlineModule as any).getCachedMasterData() : null;
        if (!master || master.length === 0) {
          const { data } = await supabase.from("cards").select("id, name, rank, pack, group");
          master = data || [];
        }
        if (!isMounted) return;
        setAllCards(master);

        // 2. バインダーアカウント（Profiles）の取得
        let loadedProfiles: ProfileUI[] = [];
        
        if (typeof (offlineModule as any).getCachedProfiles === "function") {
          const cached = (offlineModule as any).getCachedProfiles() || [];
          if (cached.length > 0) {
            loadedProfiles = cached.map((p: any) => ({
              id: p.id,
              display_name: p.display_name || 'Unnamed'
            }));
            setProfiles(loadedProfiles);
          }
        }

        const uid = user?.uid || user?.id || user?.p_uid;
        const isOnline = typeof (offlineModule as any).getOnlineStatus === "function" 
          ? (offlineModule as any).getOnlineStatus() : true;

        if (isOnline && uid) {
          if (typeof (offlineModule as any).rememberUserId === "function") {
            (offlineModule as any).rememberUserId(uid);
          }
          
          const data = await ensureProfiles(uid);
          if (data && data.length > 0) {
            loadedProfiles = data.map((p: any) => ({
              id: p.id || p.p_uid,
              display_name: p.display_name || p.name || 'Unnamed'
            }));
          }

          if (typeof (offlineModule as any).setCachedProfiles === "function") {
            (offlineModule as any).setCachedProfiles(loadedProfiles);
          }
        }

        if (loadedProfiles.length === 0) {
          const { data: dbProfs } = await supabase.from("profiles").select("id, display_name");
          if (dbProfs) {
            loadedProfiles = dbProfs.map((p: any) => ({
              id: p.id,
              display_name: p.display_name || 'Unnamed'
            }));
          }
        }

        if (!isMounted) return;
        setProfiles(loadedProfiles);

        // 3. カードコレクションの取得
        let query = supabase.from("inventory").select("card_id, p_uid, count");
        if (targetPUid) {
          query = query.eq("p_uid", targetPUid);
        }
        
        const { data } = await query;
        if (!isMounted) return;
        setCollection((data || []).map((d: any) => ({
          card_id: d.card_id, 
          p_uid: d.p_uid, 
          normal_count: d.count ?? 0
        })));
      } catch (err) {
        console.error("Binderデータロードエラー:", err);
      }
    }
    
    if (!authLoading) loadData();
    return () => { isMounted = false; };
  }, [user, authLoading, targetPUid]);

  const handleTargetToggle = (uid: string) => {
    if (targetPUid === uid) {
      setTargetPUid("");
    } else {
      setTargetPUid(uid);
    }
    setIsEditing(false);
  };

  const cardStatsMap = useMemo(() => {
    const m = new Map<string, { normal: number }>();
    collection.forEach((item) => {
      if (!item?.card_id) return;
      
      const current = m.get(item.card_id) || { normal: 0 };
      m.set(item.card_id, {
        normal: current.normal + (item.normal_count ?? 0)
      });
    });
    return m;
  }, [collection]);

  useEffect(() => {
    if (isEditing) {
      const buffer = new Map<string, { normal: number }>();
      allCards.forEach(card => {
        const stats = cardStatsMap.get(String(card.id)) || { normal: 0 };
        buffer.set(String(card.id), stats);
      });
      setEditBuffer(buffer);
    }
  }, [isEditing, allCards, cardStatsMap]);

  const handleCountChange = (cardId: string, type: "normal", delta: number) => {
    setEditBuffer(prev => {
      const next = new Map(prev);
      const current = next.get(cardId) || { normal: 0 };
      next.set(cardId, { ...current, [type]: Math.max(0, current[type] + delta) });
      return next;
    });
  };

  const handleSaveChanges = async () => {
    if (!user || !targetPUid) return; 
    const currentPUid = targetPUid;
    showAlert("Saving", "変更を保存しています...", "info");
    try {
      const updates: any[] = [];
      editBuffer.forEach((val, cardId) => {
        updates.push({ card_id: cardId, p_uid: currentPUid, normal_count: val.normal });
      });
      await ensureProfiles(user.id || user.uid || user.p_uid);
      for (const item of updates) {
        await upsertInventoryItem(currentPUid, item.card_id, item.normal_count);
      }
      setCollection(updates);
      setIsEditing(false);
      showAlert("Success", "保存が完了しました", "success");
    } catch {
      showAlert("Error", "保存に失敗しました", "error");
    }
  };

  const filteredCards = useMemo(() => {
    return allCards.filter(card => {
      const cardIdStr = String(card.id);
      const stats = cardStatsMap.get(cardIdStr);
      const isOwned = (stats?.normal ?? 0) > 0;
      if (filterMode === "owned") return isOwned;
      if (filterMode === "missing") return !isOwned;
      return true;
    });
  }, [allCards, cardStatsMap, filterMode]);

  const currentProfileName = useMemo(() => {
    if (!targetPUid) return "ALL BINDERS";
    return profiles.find(p => p.id === targetPUid)?.display_name || "Binder";
  }, [profiles, targetPUid]);

  const isMyBinder = user && targetPUid !== "";

  const handleCardClick = (card: any) => {
    setEditingCard(card);
    const buffer = new Map<string, { normal: number }>();

    profiles.forEach(p => {
      const item = collection.find(c => String(c.card_id) === String(card.id) && c.p_uid === p.id);
      buffer.set(p.id, {
        normal: item?.normal_count ?? 0
      });
    });
    setModalBuffer(buffer);
  };

  const handleModalCountChange = (profileId: string, type: "normal", delta: number) => {
    setModalBuffer(prev => {
      const next = new Map(prev);
      const current = next.get(profileId) || { normal: 0 };
      next.set(profileId, {
        ...current,
        [type]: Math.max(0, current[type] + delta)
      });
      return next;
    });
  };

  const handleModalSave = async () => {
    if (!editingCard) return;
    showAlert("Saving", "バインダーデータを一括保存中...", "info");
    
    try {
      const nextCollection = [...collection];
      const targetCardId = String(editingCard.id);

      for (const [profileId, counts] of modalBuffer.entries()) {
        await upsertInventoryItem(profileId, targetCardId, counts.normal);

        const itemIdx = nextCollection.findIndex(
          c => String(c.card_id) === targetCardId && c.p_uid === profileId
        );

        if (itemIdx >= 0) {
          nextCollection[itemIdx] = {
            ...nextCollection[itemIdx],
            normal_count: counts.normal
          };
        } else {
          nextCollection.push({
            card_id: targetCardId,
            p_uid: profileId,
            normal_count: counts.normal
          });
        }
      }

      setCollection(nextCollection);
      setEditingCard(null);
      showAlert("SUCCESS", `${editingCard.name || "カード"} の枚数を更新しました`, "success");
    } catch (error) {
      console.error("モーダル個別一括保存エラー:", error);
      showAlert("ERROR", "保存に失敗しました", "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-6 font-sans max-w-md mx-auto relative flex flex-col h-screen overflow-hidden">
      
      {/* ヘッダー */}
      <div className="shrink-0">
        <header className="flex justify-between items-center mb-4 pt-4">
          <div>
            <h1 className="text-2xl font-black italic text-slate-900 uppercase tracking-tighter">Dashboard</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              {targetPUid === "" ? "ALL BINDERS" : currentProfileName}
            </p>
          </div>
          
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center active:scale-95 transition-all shadow-xs relative shrink-0"
          >
            <Menu size={14} className="stroke-[2.5]" />
            {filterMode !== "all" && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-600 rounded-full border border-white" />
            )}
          </button>
        </header>

        <div className="mb-4 -mx-6 px-6 overflow-x-auto flex gap-1.5 no-scrollbar py-1">
          {profiles.map(p => {
            const isSelected = targetPUid === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleTargetToggle(p.id)}
                className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all truncate max-w-[140px] shrink-0 ${
                  isSelected 
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs" 
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {p.display_name}
              </button>
            );
          })}
        </div>

        {isEditing && (
          <div className="mb-3 bg-white border border-amber-500 rounded-lg p-2 flex items-center justify-between gap-2 text-slate-900 shadow-3xs">
            <div className="flex items-center gap-1">
              <CloudOff size={13} className="text-amber-600 stroke-[2.5]" />
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-600">Editing ({currentProfileName})</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setIsEditing(false)} className="px-1.5 py-0.5 bg-white border border-slate-300 text-slate-900 rounded text-[8px] font-black uppercase">Cancel</button>
              <button onClick={handleSaveChanges} className="px-1.5 py-0.5 bg-amber-600 text-white rounded text-[8px] font-black uppercase flex items-center gap-0.5"><Save size={8} />Save</button>
            </div>
          </div>
        )}
      </div>

      {/* メイングリッド */}
      <div className="flex-1 min-h-0 mb-4 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 no-scrollbar pr-0.5 content-start">
          {filteredCards.length > 0 ? filteredCards.map(card => {
            const cardIdStr = String(card.id);
            
            const stats = cardStatsMap.get(cardIdStr);
            const allNormalCount = stats?.normal ?? 0;

            const currentItem = collection.find(c => String(c.card_id) === cardIdStr && c.p_uid === targetPUid);
            const selectedNormalCount = isEditing ? (editBuffer.get(cardIdStr)?.normal ?? 0) : (currentItem?.normal_count ?? 0);

            const isOwnedAtAll = allNormalCount > 0;
            const isOwnedSelected = selectedNormalCount > 0;
            const hasSelectedAccount = targetPUid !== "";

            return (
              <div 
                key={cardIdStr} 
                onClick={() => !isEditing && handleCardClick(card)}
                className={`bg-white p-2.5 rounded-xl border transition-all flex flex-col justify-between shadow-3xs cursor-pointer hover:border-slate-400 active:scale-[0.98] ${
                  isOwnedAtAll ? "border-slate-300" : "border-slate-200"
                }`}
              >
                <div className="relative">
                  {card.rank !== undefined && (
                    <span className={`absolute top-0 right-0 text-[8px] font-black px-1 rounded border ${
                      card.rank === 0 ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-900 border-slate-200"
                    }`}>
                      {card.rank === 0 ? "PR" : `★${card.rank}`}
                    </span>
                  )}
                  <h4 className="font-black text-[11px] text-slate-900 truncate pr-7 leading-tight tracking-tight">
                    {card.name || "Unknown"}
                  </h4>
                  <div className="flex justify-between items-center gap-1 mt-0.5 min-w-0">
                    <p className="text-[8px] font-black text-indigo-600 uppercase tracking-wide truncate shrink-0">
                      {card.group || "OTHER"}
                    </p>
                    {card.pack && (
                      <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-normal truncate text-right">
                        {card.pack}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-100 flex justify-between items-end gap-1">
                  {/* 左側：選択中バインダーの枚数 */}
                  <div className="flex-1 min-w-0">
                    {!hasSelectedAccount ? (
                      <div className="min-h-[14px] flex items-center">
                        <span className="text-[7.5px] font-bold text-slate-400 tracking-wide uppercase px-0.5 bg-slate-100 rounded-sm">
                          未選択
                        </span>
                      </div>
                    ) : !isEditing ? (
                      <div className="flex flex-wrap gap-0.5 min-h-[14px]">
                        {selectedNormalCount > 0 ? (
                          <span className="text-[8.5px] font-mono font-black bg-white border border-slate-300 text-slate-700 px-1 py-0.2 rounded flex items-center gap-0.5 shadow-3xs">
                            <Layers size={6} className="text-slate-500 stroke-[2.5]" />{selectedNormalCount}
                          </span>
                        ) : (
                          <span className="text-[7.5px] font-bold text-slate-400/80 tracking-wide uppercase px-0.5">未所持</span>
                        )}
                      </div>
                    ) : (
                      /* インライン編集 */
                      <div className="space-y-1 w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between text-[7.5px] font-black text-slate-900">
                          <span>QTY</span>
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => handleCountChange(cardIdStr, "normal", -1)} className="p-0.5 hover:bg-slate-100 border border-slate-200 rounded text-slate-900"><Minus size={5} /></button>
                            <span className="text-[8.5px] font-mono font-black w-2.5 text-center">{selectedNormalCount}</span>
                            <button onClick={() => handleCountChange(cardIdStr, "normal", 1)} className="p-0.5 hover:bg-slate-100 border border-slate-200 rounded text-slate-900"><Plus size={5} /></button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 右側：全バインダーの合計枚数 */}
                  <div className="flex flex-wrap gap-0.5 justify-end shrink-0 pl-1 border-l border-slate-100 min-h-[14px]">
                    {allNormalCount > 0 ? (
                      <span className="text-[8.5px] font-mono font-black bg-slate-900 text-white px-1 py-0.2 rounded flex items-center gap-0.5">
                        <Layers size={6} className="text-slate-300 stroke-[2]" />{allNormalCount}
                      </span>
                    ) : (
                      <span className="text-[7.5px] font-bold text-slate-300 tracking-wide uppercase px-0.5">ALL:0</span>
                    )}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="col-span-2 bg-white rounded-xl p-8 border border-slate-200 text-center">
              <Inbox size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">カードがありません</p>
            </div>
          )}
        </div>
      </div>

      {/* サイドバー */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-150">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-3xs" onClick={() => setIsSidebarOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full bg-white shadow-2xl p-5 flex flex-col justify-between border-l border-slate-200 z-10">
            <div>
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">メニューパネル</span>
                <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-900">
                  <X size={16} className="stroke-[2.5]" />
                </button>
              </div>

              {/* フィルターセクション */}
              <div className="mb-4 border-b border-slate-100 pb-2">
                <span className="text-[10px] font-black text-slate-900 flex items-center gap-1.5">
                  <Filter size={12} className="stroke-[2.5]" /> 表示フィルター
                </span>
              </div>
              <div className="space-y-1.5 mb-6">
                {(["all", "owned", "missing"] as FilterMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setFilterMode(mode); setIsSidebarOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-black border transition-all ${
                      filterMode === mode ? "bg-blue-600 text-white border-blue-600 shadow-2xs" : "bg-white text-slate-900 border-slate-200"
                    }`}
                  >
                    {mode === "all" ? "すべて表示" : mode === "owned" ? "所持カードのみ" : "未所持カードのみ"}
                  </button>
                ))}
              </div>

              {/* レイアウト編集セクション */}
              <div className="mb-4 border-b border-slate-100 pb-2">
                <span className="text-[10px] font-black text-slate-900 flex items-center gap-1.5">
                  ⚙️ レイアウト操作
                </span>
              </div>
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    setIsEditing(true);      // インライン編集モードをONにする
                    setIsSidebarOpen(false); // サイドバーを閉じる
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-black bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-2xs transition-all"
                >
                  配置変更（Edit Init）
                </button>
              </div>
            </div>
            
            <div className="text-center text-[8px] font-black text-slate-300 border-t border-slate-100 pt-3 uppercase tracking-widest">
              Kawaii Lab. Collection
            </div>
          </div>
        </div>
      )}

      {/* モーダルウィンドウ */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 animate-in fade-in duration-150">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-3xs" onClick={() => setEditingCard(null)} />
          
          <div className="relative w-full max-w-sm bg-white rounded-t-2xl rounded-b-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom duration-200 border border-slate-200 z-10">
            <div className="p-4 bg-slate-900 text-white shrink-0">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-[8px] font-black bg-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {editingCard.group || "OTHER"} {editingCard.pack ? `| ${editingCard.pack}` : ""}
                  </span>
                  <h3 className="text-sm font-black mt-1 leading-tight tracking-tight">{editingCard.name}</h3>
                </div>
                <button onClick={() => setEditingCard(null)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={18} className="stroke-[2.5]" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 no-scrollbar bg-slate-50">
              {profiles.map(p => {
                const counts = modalBuffer.get(p.id) || { normal: 0 };
                const isSelectedBinder = targetPUid === p.id;

                return (
                  <div 
                    key={p.id} 
                    className={`bg-white p-3 rounded-xl border flex flex-col gap-2.5 transition-all shadow-3xs ${
                      isSelectedBinder ? "border-amber-400 ring-1 ring-amber-400/30" : "border-slate-200"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-wide truncate max-w-[180px]">
                        {p.display_name}
                      </span>
                      {isSelectedBinder && (
                        <span className="text-[7px] font-black bg-amber-500 text-white px-1 py-0.2 rounded uppercase tracking-widest">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-2">
                      <div className="flex items-center justify-between bg-slate-50/50 px-3 py-1.5 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1">
                          <Layers size={10} /> QUANTITY
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleModalCountChange(p.id, "normal", -1)} className="w-6 h-6 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-900 font-bold shadow-3xs"><Minus size={10} className="stroke-[2.5]" /></button>
                          <span className="text-sm font-mono font-black w-6 text-center text-slate-900">{counts.normal}</span>
                          <button onClick={() => handleModalCountChange(p.id, "normal", 1)} className="w-6 h-6 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-900 font-bold shadow-3xs"><Plus size={10} className="stroke-[2.5]" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-white border-t border-slate-200 flex gap-2 shrink-0">
              <button 
                onClick={() => setEditingCard(null)} 
                className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleModalSave} 
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-xs"
              >
                <Save size={12} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomAlert 
        isOpen={alertConfig.isOpen} onClose={() => setAlertConfig(p => ({ ...p, isOpen: false }))} 
        title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} 
      />
    </div>
  );
}