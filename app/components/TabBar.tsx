'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Layers, ArrowLeftRight, Calendar, Settings } from 'lucide-react';
import { isPublicPath } from './AuthGate';

export function TabBar() {
  const pathname = usePathname();
  
  // 公開ページでは何も表示しない
  if (isPublicPath(pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-xl border-t border-slate-100 px-6 py-4 pb-8 flex justify-between items-center z-50 rounded-t-[2rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
      <Link href="/trade" className={`flex flex-col items-center gap-1.5 px-2 group transition-all ${pathname === '/trade' ? 'text-blue-600' : 'text-slate-400'}`}>
        <ArrowLeftRight size={22} className={pathname === '/trade' ? 'text-blue-600' : 'group-hover:text-slate-600'} />
        <span className="text-[9px] font-black uppercase tracking-widest">Trade</span>
      </Link>
      <Link href="/collection" className={`flex flex-col items-center gap-1.5 px-2 group transition-all ${pathname === '/collection' ? 'text-blue-600' : 'text-slate-400'}`}>
        <Layers size={22} className={pathname === '/collection' ? 'text-blue-600' : 'group-hover:text-slate-600'} />
        <span className="text-[9px] font-black uppercase tracking-widest">Binder</span>
      </Link>

      <Link href="/home" className="flex flex-col items-center -mt-10 group">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl border-4 border-white transition-all group-active:scale-90 
          ${pathname === '/home' ? 'bg-blue-600 shadow-blue-200' : 'bg-slate-900 shadow-slate-200'}`}>
          <Home size={24} strokeWidth={2.5} />
        </div>
        <span className={`mt-2 text-[9px] font-black uppercase tracking-widest ${pathname === '/home' ? 'text-blue-600' : 'text-slate-400'}`}>
          Home
        </span>
      </Link>

      <Link href="/event" className={`flex flex-col items-center gap-1.5 px-2 group transition-all ${pathname === '/event' ? 'text-blue-600' : 'text-slate-400'}`}>
        <Calendar size={22} className={pathname === '/event' ? 'text-blue-600' : 'group-hover:text-slate-600'} />
        <span className="text-[9px] font-black uppercase tracking-widest">Event</span>
      </Link>

      <Link href="/settings" className={`flex flex-col items-center gap-1.5 px-2 group transition-all ${pathname?.startsWith('/settings') ? 'text-blue-600' : 'text-slate-400'}`}>
        <Settings size={22} className={pathname?.startsWith('/settings') ? 'text-blue-600' : 'group-hover:text-slate-600'} />
        <span className="text-[9px] font-black uppercase tracking-widest">Setting</span>
      </Link>
    </nav>
  );
}
