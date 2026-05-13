'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { analyzeCard } from './utils';
import { resolveCardDisplay } from '../components/utils';
import { supabase } from '../supabase';
import {
  addCustomMasterCards,
  getActiveProfileId,
  getCachedMasterData,
  getCachedProfiles,
  getCachedRawCollection,
  getCachedUserId,
  getOnlineStatus,
  normalizeProfileId,
  queueCollectionChange,
  rememberUserId,
  setCachedMasterData,
  upsertCachedCollection,
} from '../offline';
import {
  Box,
  Camera,
  Check,
  ChevronLeft,
  Cloud,
  CloudOff,
  Edit3,
  Layers,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';

const CONFIG = {
  gasUrl: 'https://script.google.com/macros/s/AKfycbzE912QE7aAjrxboaW8jLnjJ-tTW7JzePfkREe3vpnTYMsghP4eRMWd_cEK3ffLQn3w4Q/exec',
  ranks: [0, 1, 2, 3, 4, 5],
};

export default function ScannerPage() {
  const [images, setImages] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('待機中');
  const [masterData, setMasterData] = useState<any[]>([]);
  const [isAllSaved, setIsAllSaved] = useState(false);
  const [isOnline, setIsOnline] = useState(getOnlineStatus);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [customAlert, setCustomAlert] = useState<string | null>(null);

  const activeProfileName = useMemo(() => {
    if (!activeProfileId) return 'Default';
    return profiles.find((profile) => String(profile.id) === String(activeProfileId))?.display_name || 'Active';
  }, [activeProfileId, profiles]);

  useEffect(() => {
    const cached = getCachedMasterData();
    setMasterData(cached);
    setProfiles(getCachedProfiles());
    setActiveProfileIdState(getActiveProfileId());

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const initOnlineData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        rememberUserId(session?.user?.id);
      } catch {
        // Cached user id is enough for offline work.
      }

      if (!getOnlineStatus()) return;
      try {
        const res = await fetch(CONFIG.gasUrl);
        const data = await res.json();
        const filtered = data.filter((card: any) => card.name && !['名前', 'name', 'idnamegrouppackrankimage'].includes(card.name));
        setCachedMasterData(filtered);
        setMasterData(getCachedMasterData());
      } catch {
        if (cached.length === 0) setCustomAlert('マスタデータ未取得。オンライン時に一度開くとオフライン検索できます。');
      }
    };

    initOnlineData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateResult = (index: number, field: string, value: any) => {
    const next = [...results];
    next[index] = { ...next[index], [field]: value };

    if (field === 'name') {
      const match = masterData.find((card) => String(card.name) === String(value));
      if (match) {
        next[index] = {
          ...next[index],
          id: match.id,
          group: match.group,
          pack: match.pack,
          stars: match.rank ?? next[index].stars,
          croppedImg: match.image || next[index].croppedImg,
        };
      }
    }

    setResults(next);
    setIsAllSaved(false);
  };

  const removeResult = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
    setIsAllSaved(false);
  };

  const addManualCard = () => {
    setResults((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        name: '',
        group: '',
        pack: 'Manual',
        stars: 0,
        quantity: 1,
        croppedImg: '',
        date: Date.now(),
      },
    ]);
    setIsAllSaved(false);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result;
        if (typeof dataUrl === 'string') setImages((prev) => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleBatchScan = async () => {
    if (images.length === 0 || loading) return;
    if (!isOnline) {
      setCustomAlert('オフライン中は手動追加を使えます。AI解析はオンライン復帰後に実行できます。');
      return;
    }
    if (masterData.length === 0) {
      setCustomAlert('マスタデータがありません。先にオンラインで同期してください。');
      return;
    }

    setLoading(true);
    setProgress(0);
    setIsAllSaved(false);
    let allResults: any[] = [];

    for (let i = 0; i < images.length; i++) {
      setStatus(`${i + 1}枚目を解析中...`);
      const data = await analyzeCard(images[i], masterData, setStatus);
      allResults = [...allResults, ...data.map((item: any) => ({ ...item, quantity: 1 }))];
      setProgress(Math.round(((i + 1) / images.length) * 100));
    }

    setResults((prev) => [...prev, ...allResults]);
    setImages([]);
    setLoading(false);
    setStatus('完了');
    setCustomAlert(allResults.length > 0 ? `${allResults.length}件を解析しました。` : '検出できませんでした。手動追加できます。');
    window.scrollTo({ top: 320, behavior: 'smooth' });
  };

  const saveAllCards = async () => {
    if (results.length === 0) return;

    setLoading(true);
    let sessionUserId: string | null = null;
    if (isOnline) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUserId = session?.user?.id || null;
        rememberUserId(sessionUserId);
      } catch {
        sessionUserId = null;
      }
    }

    const userId = sessionUserId || getCachedUserId() || 'offline-user';
    const profileId = normalizeProfileId(activeProfileId);
    const customCards: any[] = [];
    let queued = 0;
    let saved = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result.name) continue;

      let cardId = String(result.id || '');
      const isCustom = !cardId || cardId.startsWith('manual-');
      if (isCustom) {
        cardId = `local-${Date.now()}-${i}`;
        customCards.push({
          id: cardId,
          name: result.name || 'Custom Card',
          group: result.group || '',
          pack: result.pack || 'Manual',
          rank: result.stars ?? result.rank ?? 0,
          image: result.croppedImg || '',
        });
      }

      const cachedRecord = getCachedRawCollection().find((item) => (
        String(item.card_id) === cardId
        && normalizeProfileId(item.profile_id) === profileId
        && (!item.user_id || String(item.user_id) === userId)
      ));
      const quantity = (Number(cachedRecord?.quantity) || 0) + Math.max(1, Number(result.quantity) || 1);

      upsertCachedCollection({
        user_id: userId,
        profile_id: profileId,
        card_id: cardId,
        quantity,
      });
      saved += 1;

      if (isOnline && sessionUserId) {
        try {
          const { error } = await supabase.from('collections').upsert({
            user_id: sessionUserId,
            profile_id: profileId,
            card_id: cardId,
            quantity,
          }, { onConflict: 'user_id,profile_id,card_id' });
          if (error) throw error;
        } catch {
          queued = queueCollectionChange('upsert', { user_id: userId, profile_id: profileId, card_id: cardId, quantity });
        }
      } else {
        queued = queueCollectionChange('upsert', { user_id: userId, profile_id: profileId, card_id: cardId, quantity });
      }
    }

    if (customCards.length > 0) {
      addCustomMasterCards(customCards);
      setMasterData(getCachedMasterData());
    }

    setLoading(false);
    setIsAllSaved(true);
    setImages([]);
    setResults([]);
    setCustomAlert(queued > 0 ? `${saved}件を保存。${queued}件はオンライン復帰時に同期します。` : `${saved}件を保存しました。`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-40 font-sans">
      <header className="max-w-md mx-auto bg-white/90 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40 px-4 h-16 flex items-center justify-between shadow-sm">
        <Link href="/" className="p-2 hover:bg-slate-100 rounded-full transition-all active:scale-90">
          <ChevronLeft size={24} className="text-slate-600" />
        </Link>
        <div className="text-center">
          <h1 className="text-sm font-black italic text-slate-800 tracking-tighter uppercase">Scanner</h1>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{activeProfileName}</p>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          {isOnline ? <Cloud size={18} className="text-emerald-500" /> : <CloudOff size={18} className="text-amber-500" />}
          {loading && <span className="text-[10px] font-black text-blue-600">{progress}%</span>}
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        <section className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            <label className="flex-shrink-0 w-32 h-40 rounded-2xl border-2 border-dashed border-blue-200 bg-slate-50 flex flex-col items-center justify-center text-blue-600 hover:bg-blue-50 cursor-pointer transition-all active:scale-95">
              <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => handleFiles(event.target.files)} />
              <Camera size={28} className="mb-2" />
              <span className="text-xs font-black uppercase">写真を追加</span>
              <span className="text-[9px] font-bold text-blue-500/70 mt-1">複数選択OK</span>
            </label>
            {images.map((img, idx) => (
              <div key={idx} className="relative flex-shrink-0 w-32 h-40">
                <img src={img} className="w-full h-full object-cover rounded-2xl border border-slate-200 shadow-sm" alt="scan preview" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-lg active:scale-90"
                >
                  <X size={14} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleBatchScan}
              disabled={images.length === 0 || loading}
              className="py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 flex items-center justify-center gap-2 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              <Sparkles size={16} /> AI解析
            </button>
            <button
              type="button"
              onClick={addManualCard}
              className="py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-100 flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus size={16} /> 手動追加
            </button>
          </div>

          {loading && (
            <div className="mt-4">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{status}</p>
            </div>
          )}
        </section>

        {results.length > 0 ? (
          <section className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">候補 ({results.length})</h2>
              <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <Layers size={12} /> {masterData.length}
              </div>
            </div>

            {results.map((result, index) => (
              <ResultEditCard
                key={`${result.id}-${result.date}-${index}`}
                data={result}
                masterData={masterData}
                onUpdate={(field: string, value: any) => updateResult(index, field, value)}
                onRemove={() => removeResult(index)}
              />
            ))}
          </section>
        ) : (
          <section className="py-16 text-center space-y-4">
            <div className="inline-flex p-6 bg-slate-100 rounded-[2rem] text-slate-300">
              <Camera size={32} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {isOnline ? '写真解析または手動追加で登録' : 'Offline: 手動追加と保存が使えます'}
            </p>
          </section>
        )}
      </main>

      {results.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
          <button
            type="button"
            onClick={saveAllCards}
            disabled={loading || isAllSaved}
            className={`w-full py-5 rounded-2xl font-black text-xs flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95 ${
              isAllSaved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            {isAllSaved ? <><Check size={20} /> Saved</> : <><Save size={20} /> Binderに保存</>}
          </button>
        </div>
      )}

      {customAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-xs bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3">
          <Sparkles size={16} className="text-blue-400" />
          <p className="text-[9px] font-black uppercase tracking-widest leading-relaxed flex-1">{customAlert}</p>
          <button type="button" onClick={() => setCustomAlert(null)} className="text-slate-500"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}

function ResultEditCard({ data, masterData, onUpdate, onRemove }: any) {
  const display = resolveCardDisplay(data);
  const uniqueNames = useMemo(() => Array.from(new Set(masterData.map((card: any) => card.name).filter(Boolean))).sort(), [masterData]);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm relative">
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-4 right-4 z-10 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
      >
        <Trash2 size={16} />
      </button>

      <div className="flex p-5 gap-5">
        <div className="w-24 flex-shrink-0">
          <div className="aspect-[3/4] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center">
            {display.hasImage ? (
              <img src={display.imageUrl!} className="w-full h-full object-cover" alt={display.name} />
            ) : (
              <div className="text-slate-300 flex flex-col items-center p-4">
                <Edit3 size={20} className="mb-2" />
                <span className="text-[8px] font-black uppercase tracking-tighter">No Image</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-3 pt-1 min-w-0">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Search size={12} className="text-blue-500" /> Card
            </label>
            <input
              list="card-master-names"
              value={data.name || ''}
              onChange={(event) => onUpdate('name', event.target.value)}
              placeholder="カード名"
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <datalist id="card-master-names">
              {uniqueNames.map((name: any) => <option key={name} value={name} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Box size={12} className="text-purple-500" /> Pack
              </label>
              <input
                value={data.pack || ''}
                onChange={(event) => onUpdate('pack', event.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-700 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Rank
              </label>
              <select
                value={data.stars ?? 0}
                onChange={(event) => onUpdate('stars', parseInt(event.target.value, 10))}
                className="w-full bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 text-[10px] font-black text-yellow-700 outline-none appearance-none text-center"
              >
                {CONFIG.ranks.map((rank) => <option key={rank} value={rank}>Level {rank}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <User size={12} className="text-emerald-500" /> Group
              </label>
              <input
                value={data.group || ''}
                onChange={(event) => onUpdate('group', event.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-700 outline-none"
              />
            </div>

            <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
              <button type="button" onClick={() => onUpdate('quantity', Math.max(1, Number(data.quantity || 1) - 1))} className="w-8 h-8 text-slate-400 font-black">-</button>
              <span className="w-7 text-center text-sm font-black text-slate-900">{data.quantity || 1}</span>
              <button type="button" onClick={() => onUpdate('quantity', Number(data.quantity || 1) + 1)} className="w-8 h-8 text-blue-500 font-black">+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
