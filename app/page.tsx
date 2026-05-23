'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // next/navigation からインポート
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../AuthContext';
import { Mail, Lock, LogIn, Zap, X, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 既にセッションがある場合はホームへ
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/home');
    }
  }, [user, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/home');
    } catch (authError: any) {
      setError(authError.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="inline-flex p-4 bg-blue-600 rounded-[2rem] text-white shadow-xl shadow-blue-200 mb-6">
            <Zap size={32} fill="white" />
          </div>
          <h1 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter">Nexus Login</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Authorized Access Only</p>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border border-slate-50 py-4 pl-14 pr-6 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Access Key</label>
              <div className="relative">
                <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-50 py-4 pl-14 pr-6 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:bg-slate-300"
            >
              {loading ? 'Authenticating...' : <><LogIn size={18} /> Initiate Session</>}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
            <X size={16} className="text-red-500" />
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-relaxed flex-1">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
