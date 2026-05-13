'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, ChevronLeft, CloudOff, Layers, RefreshCw } from 'lucide-react';
import {
  getCachedMasterData,
  getCachedRawCollection,
  getPendingCollectionChanges,
  normalizeProfileId,
} from '@/app/offline';

export default function EventPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [masterMap, setMasterMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    setRecords(getCachedRawCollection());
    setPending(getPendingCollectionChanges());
    setMasterMap(new Map(getCachedMasterData().map((card: any) => [String(card.id), card])));
  }, []);

  const activity = useMemo(() => {
    return records
      .map((record) => ({
        ...record,
        card: masterMap.get(String(record.card_id)),
        time: record.updated_at || '',
      }))
      .sort((a, b) => String(b.time).localeCompare(String(a.time)))
      .slice(0, 30);
  }, [records, masterMap]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans max-w-md mx-auto text-slate-900">
      <header className="flex items-center gap-4 mb-8 pt-4">
        <Link href="/" className="p-2 -ml-2 text-slate-400"><ChevronLeft /></Link>
        <div>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">Activity</h1>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Local Timeline</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg shadow-slate-100">
          <Layers size={18} className="text-blue-400 mb-3" />
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cached Cards</p>
          <p className="text-2xl font-black italic">{records.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <RefreshCw size={18} className="text-amber-500 mb-3" />
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pending Sync</p>
          <p className="text-2xl font-black italic">{pending.length}</p>
        </div>
      </section>

      {pending.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3 text-amber-700">
          <CloudOff size={18} />
          <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">オンライン復帰時に同期されます。</p>
        </div>
      )}

      <section className="space-y-3">
        {activity.length > 0 ? activity.map((item, index) => (
          <div key={`${item.card_id}-${item.profile_id}-${index}`} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-800 truncate">{item.card?.name || `ID: ${item.card_id}`}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {normalizeProfileId(item.profile_id) || 'Default'} / {item.time ? new Date(item.time).toLocaleString() : 'Local'}
              </p>
            </div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">x{item.quantity}</span>
          </div>
        )) : (
          <div className="bg-white rounded-[2rem] p-10 border border-slate-100 text-center">
            <Calendar size={32} className="mx-auto text-slate-300 mb-4" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No local activity yet</p>
          </div>
        )}
      </section>
    </div>
  );
}
