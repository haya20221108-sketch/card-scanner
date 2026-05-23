'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Download, FileJson, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { getCachedRawCollection, getCachedMasterData, getCachedProfiles } from '../../offline';

export default function ExportPage() {
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleExportCSV = () => {
    setExporting(true);
    const collection = getCachedRawCollection();
    const master = getCachedMasterData();
    const profiles = getCachedProfiles();
    
    const masterMap = new Map(master.map((m: any) => [String(m.id), m]));
    const profileMap = new Map(profiles.map((p: any) => [String(p.id), p.display_name]));

    // ヘッダー
    let csvContent = "\uFEFFAccount,Card Name,Pack,Rank,Quantity\n";

    // データ行の作成
    collection.forEach((item: any) => {
      const card = masterMap.get(String(item.card_id));
      const profileName = profileMap.get(String(item.profile_id)) || 'Unknown';
      
      const row = [
        `"${profileName}"`,
        `"${card?.name || 'Unknown'}"`,
        `"${card?.pack || 'Manual'}"`,
        card?.rank || 0,
        item.quantity
      ].join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nexus_collection_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      setExporting(false);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-white p-6 font-sans max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Export Data</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Backup & External Tools</p>
        </div>
      </header>

      <div className="space-y-6">
        <div className="bg-slate-900 rounded-[2rem] p-8 text-white text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Download size={32} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black italic uppercase">Ready to Export</h2>
            <p className="text-[10px] opacity-60 uppercase font-bold tracking-widest">Generate file from local cache</p>
          </div>
        </div>

        <div className="space-y-3">
          <button 
            onClick={handleExportCSV}
            disabled={exporting}
            className="w-full bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm flex items-center justify-between group active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <FileSpreadsheet size={24} />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-slate-900 uppercase">Export as CSV</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Open in Excel or Google Sheets</p>
              </div>
            </div>
            {done ? <CheckCircle2 className="text-emerald-500" size={20} /> : <Download size={18} className="text-slate-200" />}
          </button>

          <div className="p-6 rounded-[2rem] bg-slate-50 border border-dashed border-slate-200">
            <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed text-center">
              エクスポートには現在ブラウザにキャッシュされているすべてのプロフィールのデータが含まれます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}