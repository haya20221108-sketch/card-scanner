'use client';

import React from 'react';
import { ChevronLeft, Zap, Github } from 'lucide-react';
import Link from 'next/link';

const APP_VERSION = "1.0.5"; // Define the app version here

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">About Nexus</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Info</p>
        </div>
      </header>

      <div className="flex flex-col items-center text-center space-y-8 mt-10">
        <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl">
          <Zap size={48} fill="white" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-black italic text-slate-900 uppercase tracking-tighter">Nexus Intelligence</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Version {APP_VERSION} Premium</p>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 w-full space-y-4 text-left">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Developer</span>
            <span className="text-xs font-black text-slate-900">HAYA-INTELLIGENCE</span>
          </div>
          <div className="h-px bg-slate-50" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Engine</span>
            <span className="text-xs font-black text-slate-900 italic">NEXT.JS 14 / SUPABASE</span>
          </div>
        </div>

        <button className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-900 transition-colors">
          <Github size={14} /> Documentation
        </button>
      </div>
    </div>
  );
}