'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Moon, Sun, Monitor } from 'lucide-react';

export default function DisplayPage() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const saved = localStorage.getItem('app-theme') || 'light';
    setTheme(saved);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6 font-sans max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Display</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interface Appearance</p>
        </div>
      </header>

      <div className="space-y-8">
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Color Theme</h3>
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <ThemeOption 
              active={theme === 'light'} 
              onClick={() => handleThemeChange('light')} 
              icon={<Sun size={18}/>} 
              title="Light Mode" 
              subtitle="Clean and bright interface" 
            />
            <ThemeOption 
              active={theme === 'dark'} 
              onClick={() => handleThemeChange('dark')} 
              icon={<Moon size={18}/>} 
              title="Dark Mode" 
              subtitle="Easy on the eyes in the dark" 
            />
            <ThemeOption 
              active={theme === 'system'} 
              onClick={() => handleThemeChange('system')} 
              icon={<Monitor size={18}/>} 
              title="System Default" 
              subtitle="Follow device settings" 
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ThemeOption({ active, onClick, icon, title, subtitle }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-6 transition-all active:bg-slate-50">
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
    </button>
  );
}