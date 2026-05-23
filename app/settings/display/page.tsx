'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Moon, Sun, Monitor } from 'lucide-react';

export default function DisplayPage() {
  return (
    <div className="min-h-screen bg-white p-6 font-sans max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Display</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">実装予定</p>
        </div>
      </header>

      <div className="space-y-8">
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200 mb-2">Coming Soon</p>
          <h2 className="text-lg font-black italic uppercase">表示設定は実装予定です</h2>
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-3 leading-relaxed">
            テーマ切替は全画面対応が完了してから有効化します。
          </p>
        </div>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Color Theme</h3>
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <ThemeOption 
              active
              icon={<Sun size={18}/>} 
              title="Light Mode" 
              subtitle="現在の固定表示" 
            />
            <ThemeOption 
              active={false}
              icon={<Moon size={18}/>} 
              title="Dark Mode" 
              subtitle="実装予定" 
            />
            <ThemeOption 
              active={false}
              icon={<Monitor size={18}/>} 
              title="System Default" 
              subtitle="実装予定" 
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ThemeOption({ active, icon, title, subtitle }: { active: boolean; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className={`w-full flex items-center justify-between p-6 ${active ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}>
          {icon}
        </div>
        <div className="text-left">
          <p className={`text-xs font-black uppercase ${active ? 'text-slate-900' : 'text-slate-400'}`}>{title}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{subtitle}</p>
        </div>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'border-blue-600' : 'border-slate-100'}`}>
        {active && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />}
      </div>
    </div>
  );
}
