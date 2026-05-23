'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Bell, Sparkles, Database, ShieldCheck } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans max-w-md mx-auto pb-20">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Notifications</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">実装予定</p>
        </div>
      </header>

      <div className="space-y-6">
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200 mb-2">Coming Soon</p>
          <h2 className="text-lg font-black italic uppercase">通知設定は実装予定です</h2>
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-3 leading-relaxed">
            Push 通知とアプリ内通知の配信処理を実装後に有効化します。
          </p>
        </div>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">App Activities</h3>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <NotificationToggle 
              icon={<Sparkles size={18} className="text-blue-500" />} 
              title="Scan Completion" 
              subtitle="実装予定" 
            />
            <NotificationToggle 
              icon={<Database size={18} className="text-red-500" />} 
              title="Sync Status" 
              subtitle="実装予定" 
            />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Account & System</h3>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <NotificationToggle 
              icon={<ShieldCheck size={18} className="text-emerald-500" />} 
              title="Security Alerts" 
              subtitle="実装予定" 
            />
            <NotificationToggle 
              icon={<Bell size={18} className="text-slate-400" />} 
              title="News & Updates" 
              subtitle="実装予定" 
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function NotificationToggle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="w-full flex items-center justify-between p-6 text-left opacity-50">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-slate-50 rounded-2xl">{icon}</div>
        <div>
          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{title}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{subtitle}</p>
        </div>
      </div>
      <div className="w-12 h-6 rounded-full transition-all relative bg-slate-200">
        <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all" />
      </div>
    </div>
  );
}
