"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Save, Plus, Minus, Edit3, Star, Layers, CloudOff, Inbox, Menu, X, Users, Filter } from "lucide-react";

// インポートパスを /app/settings/direct_add/ 階層に合わせて修正
import { supabase } from "../../supabase";
import { ensureProfiles, upsertInventoryItem } from "../../profileStore";
import * as offlineModule from "../../offline";
import { CustomAlert } from "../../components/CustomAlert";
import { useAuth } from "../../../AuthContext";

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
  const [editBuffer, setEditBuffer] = useState<Map<string, { normal: number; kira: number }>>(new Map());

  const [alertConfig, setAlertConfig] = useState({ 
    isOpen: false, title: "", message: "", type: "info" as "info" | "success" | "error" 
  });

  const showAlert = useCallback((title: string, message: string, type: "info" | "success" | "error") => {
    setAlertConfig({ isOpen: true, title, message, type });
  }, []);

  // データ同期・ロード処理
  useEffect(() => {
    let isMounted = true;
    
    async function loadData() {
      try {
        let master = typeof (offlineModule as any).getCachedMasterData === "function" 
          ? await (offlineModule as any).getCachedMasterData() : null;
        if (!master || master.length === 0) {
          const { data } = await supabase.from("cards").select("id, name, rank, pack, group");
          master = data || [];
        }
        if (!isMounted) return;
        setAllCards(master);

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

        let query = supabase.from("user_cards").select("card_id, p_uid, normal_count, kira_count");
        if (targetPUid) {
          query = query.eq("p_uid", targetPUid);
        }
        
        const { data } = await query;
        if (!isMounted) return;
        setCollection((data || []).map((d: any) => ({
          card_id: d.card_id, p_uid: d.p_uid, normal_count: d.normal_count ?? 0, kira_count: d.kira_count ?? 0,
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
    const m = new Map<string, { normal: number; kira: number }>();
    collection.forEach((item) => {
      if (!item?.card_id) return;
      
      const current = m.get(item.card_id) || { normal: 0, kira: 0 };
      m.set(item.card_id, {
        normal: current.normal + (item.normal_count ?? 0),
        kira: current.kira + (item.kira_count ?? 0),
      });
    });
    return m;
  }, [collection]);

  useEffect(() => {
    if (isEditing) {
      const buffer = new Map<string, { normal: number; kira: number }>();
      allCards.forEach(card => {
        const stats = cardStatsMap.get(String(card.id)) || { normal: 0, kira: 0 };
        buffer.set(String(card.id), stats);
      });
      setEditBuffer(buffer);
    }
  }, [isEditing, allCards, cardStatsMap]);

  const handleCountChange = (cardId: string, type: "normal" | "kira", delta: number) => {
    setEditBuffer(prev => {
      const next = new Map(prev);
      const current = next.get(cardId) || { normal: 0, kira: 0 };
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
        updates.push({ card_id: cardId, p_uid: currentPUid, normal_count: val.normal, kira_count: val.kira });
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
      const isOwned = ((stats?.normal ?? 0) + (stats?.kira ?? 0)) > 0;
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

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans max-w-md mx-auto relative">
      
      {/* 固定ヘッダーエリア（ヘッダーとアカウント選択バナーをSticky化） */}
      <div className="sticky top-0 bg-slate-50/90 backdrop-blur-md z-40 -mx-6 px-6 pt-4 pb-2 border-b border-slate-200/60">
        <header className="flex justify-between items-center mb-3">
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

        {/* 横スクロール式バインダーアカウントセレクター */}
        <div className="overflow-x-auto flex gap-1.5 no-scrollbar py-1">
          {profiles.map(p => {
            const isSelected = targetPUid === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleTargetToggle(p.id)}
                className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all truncate max-w-[140px] shrink-0 ${
                  isSelected 
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs" 
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 shadow-3xs"
                }`}
              >
                {p.display_name}
              </button>
            );
          })}
        </div>
      </div>

      {/* フィルター用サイドバー */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-150">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-3xs" onClick={() => setIsSidebarOpen(false)} />
          
          <div className="relative w-72 max-w-[85vw] h-full bg-white shadow-2xl p-5 flex flex-col justify-between animate-in slide-in-from-right duration-200 border-l border-slate-200 z-50">
            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Menu Panel
                </span>
                <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-900 transition-colors">
                  <X size={16} className="stroke-[2.5]" />
                </button>
              </div>

              <div className="mb-4 border-b border-slate-100 pb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Filter size={12} className="stroke-[2.5]" /> Filter Options
                </span>
              </div>

              <div className="space-y-1.5">
                {(["all", "owned", "missing"] as FilterMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setFilterMode(mode); setIsEditing(false); setIsSidebarOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-all ${
                      filterMode === mode ? "bg-blue-600 text-white border-blue-600 shadow-2xs" : "bg-white text-slate-900 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {mode === "all" ? "すべて表示" : mode === "owned" ? "所持カードのみ" : "未所持カードのみ"}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center text-[8px] font-black text-slate-300 border-t border-slate-100 pt-3 uppercase tracking-widest shrink-0">
              Kawaii Lab. Collection
            </div>
          </div>
        </div>
      )}

      {/* 編集バナー（ヘッダー追従エリアとの被り防止用マージン） */}
      {isEditing && (
        <div className="mt-4 mb-3 bg-white border border-amber-500 rounded-lg p-2 flex items-center justify-between gap-2 text-slate-900 shadow-3xs">
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

      {/* 2列カードグリッド */}
      <div className={`grid grid-cols-2 gap-2 ${!isEditing ? "mt-4" : ""}`}>
        {filteredCards.length > 0 ? filteredCards.map(card => {
          const cardIdStr = String(card.id);
          const stats = cardStatsMap.get(cardIdStr);
          const normalCount = isEditing ? (editBuffer.get(cardIdStr)?.normal ?? 0) : (stats?.normal ?? 0);
          const kiraCount = isEditing ? (editBuffer.get(cardIdStr)?.kira ?? 0) : (stats?.kira ?? 0);
          const totalCount = normalCount + kiraCount;
          const isOwned = (normalCount + kiraCount) > 0;

          return (
            <div 
              key={cardIdStr} 
              className={`bg-white p-2.5 rounded-xl border transition-all flex flex-col justify-between shadow-3xs ${
                isOwned ? "border-slate-300" : "border-slate-200"
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
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[8px] font-black text-indigo-600 uppercase tracking-wide truncate mt-0.5">
                    {card.group || "OTHER"}
                  </p>
                  {isOwned && (
                   <span className="text-[8px] font-mono font-black text-slate-500 shrink-0 bg-slate-100 px-1 rounded">
                   計{totalCount}枚
                   </span>
                  ) 
                  }
                </div>
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-100">
                {!isEditing ? (
                  <div className="flex gap-1 min-h-[14px]">
                    {normalCount > 0 && (
                      <span className="text-[9px] font-mono font-black bg-white border border-slate-300 text-slate-900 px-1 py-0.2 rounded flex items-center gap-0.5 shadow-3xs">
                        <Layers size={7} className="text-slate-900 stroke-[2.5]" />{normalCount}
                      </span>
                    )}
                    {kiraCount > 0 && (
                      <span className="text-[9px] font-mono font-black bg-amber-600 text-white px-1 py-0.2 rounded flex items-center gap-0.5 shadow-3xs">
                        <Star size={7} className="fill-white stroke-none" />{kiraCount}
                      </span>
                    )}
                    {!isOwned && (
                      <span className="text-[8px] font-bold text-slate-400 tracking-wide uppercase px-0.5">未所持</span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[8px] font-black text-slate-900">
                      <span>NORM</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleCountChange(cardIdStr, "normal", -1)} className="p-0.5 hover:bg-slate-100 border border-slate-200 rounded text-slate-900"><Minus size={6} className="stroke-[2.5]" /></button>
                        <span className="text-[9px] font-mono font-black w-3 text-center text-slate-900">{normalCount}</span>
                        <button onClick={() => handleCountChange(cardIdStr, "normal", 1)} className="p-0.5 hover:bg-slate-100 border border-slate-200 rounded text-slate-900"><Plus size={6} className="stroke-[2.5]" /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[8px] font-black text-amber-700">
                      <span className="flex items-center gap-0.5"><Star size={6} className="fill-amber-500 stroke-none" />KIRA</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleCountChange(cardIdStr, "kira", -1)} className="p-0.5 hover:bg-slate-100 border border-slate-200 rounded text-slate-900"><Minus size={6} className="stroke-[2.5]" /></button>
                        <span className="text-[9px] font-mono font-black w-3 text-center text-amber-700">{kiraCount}</span>
                        <button onClick={() => handleCountChange(cardIdStr, "kira", 1)} className="p-0.5 hover:bg-slate-100 border border-slate-200 rounded text-slate-900"><Plus size={6} className="stroke-[2.5]" /></button>
                      </div>
                    </div>
                  </div>
                )}
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

      {/* フローティング下部メニュー (個別アカウント選択時のみ表示) */}
      {isMyBinder && !isEditing && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-xs z-30 bg-slate-900 text-white p-2.5 rounded-xl shadow-xl flex items-center justify-between border border-slate-800">
          <div className="pl-1">
            <span className="text-xs font-black text-white block">
              Owned: <span className="text-blue-400 font-mono font-black">{collection.filter(c => c && ((c.normal_count || 0) + (c.kira_count || 0)) > 0).length}</span> 種
            </span>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="bg-white text-slate-900 font-black text-[9px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-0.5 shadow-sm"
          >
            <Edit3 size={10} className="stroke-[2.5]" /> Edit
          </button>
        </div>
      )}

      <CustomAlert 
        isOpen={alertConfig.isOpen} onClose={() => setAlertConfig(p => ({ ...p, isOpen: false }))} 
        title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} 
      />
    </div>
  );
}