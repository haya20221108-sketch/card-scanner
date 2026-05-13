'use client';

import React, { useState } from 'react';
import { supabase } from '@/app/supabase';
import { Shield, ChevronLeft, Key, Zap, X } from 'lucide-react';
import Link from 'next/link';

export default function SecuritySettingsPage() {
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [customAlert, setCustomAlert] = useState<string | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    setIsUpdating(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setCustomAlert(error ? `Error: ${error.message}` : "Access key has been reset.");
    if (!error) setNewPassword('');
    setIsUpdating(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400"><ChevronLeft /></Link>
        <h1 className="text-2xl font-black italic text-slate-900 uppercase tracking-tighter">Security</h1>
      </header>

      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
        <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
          <Shield size={28} />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2 uppercase">Update Access Key</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8 leading-loose">
          Ensure your data remains encrypted with a complex password string.
        </p>

        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="relative">
            <Key size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input 
              type="password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border border-slate-100 py-4 pl-14 pr-6 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
              required
            />
          </div>
          <button type="submit" disabled={isUpdating} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
            {isUpdating ? 'PROCESSING...' : 'RESET PASSWORD'}
          </button>
        </form>
      </div>

      {customAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-xs animate-in slide-in-from-top-4">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10">
            <Zap size={16} className="text-blue-400" />
            <p className="text-[9px] font-black uppercase tracking-widest flex-1 mx-3">{customAlert}</p>
          </div>
        </div>
      )}
    </div>
  );
}
