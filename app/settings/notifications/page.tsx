'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Bell, Sparkles, Database, ShieldCheck } from 'lucide-react';

export default function NotificationsPage() {
  const [settings, setSettings] = useState({
    scanComplete: true,
    syncErrors: true,
    securityAlerts: true,
    news: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('notification-settings');
    if (saved) setSettings(JSON.parse(saved));
  }, []);

  const toggle = (key: keyof typeof settings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    localStorage.setItem('notification-settings', JSON.stringify(next));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans max-w-md mx-auto pb-20">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Notifications</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alerts & Messaging</p>
        </div>
      </header>

      <div className="space-y-6">
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">App Activities</h3>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <NotificationToggle 
              active={settings.scanComplete} 
              onClick={() => toggle('scanComplete')} 
              icon={<Sparkles size={18} className="text-blue-500" />} 
              title="Scan Completion" 
              subtitle="Toast alerts when AI finishes processing" 
            />
            <NotificationToggle 
              active={settings.syncErrors} 
              onClick={() => toggle('syncErrors')} 
              icon={<Database size={18} className="text-red-500" />} 
              title="Sync Status" 
              subtitle="Notify when cloud synchronization fails" 
            />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Account & System</h3>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <NotificationToggle 
              active={settings.securityAlerts} 
              onClick={() => toggle('securityAlerts')} 
              icon={<ShieldCheck size={18} className="text-emerald-500" />} 
              title="Security Alerts" 
              subtitle="Login and password change updates" 
            />
            <NotificationToggle 
              active={settings.news} 
              onClick={() => toggle('news')} 
              icon={<Bell size={18} className="text-slate-400" />} 
              title="News & Updates" 
              subtitle="Occasional updates about new features" 
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function NotificationToggle({ active, onClick, icon, title, subtitle }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-6 transition-all active:bg-slate-50 text-left">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-slate-50 rounded-2xl">{icon}</div>
        <div>
          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{title}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{subtitle}</p>
        </div>
      </div>
      <div className={`w-12 h-6 rounded-full transition-all relative ${active ? 'bg-blue-600 shadow-inner' : 'bg-slate-200'}`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${active ? 'left-7' : 'left-1'}`} />
      </div>
    </button>
  );
}