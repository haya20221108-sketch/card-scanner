'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../AuthContext';
import { Zap, Sparkles, ArrowRight, LogIn, Camera, Layers, Users } from 'lucide-react';

function getSafeRedirect() {
  if (typeof window === 'undefined') return '/home';
  const redirect = new URLSearchParams(window.location.search).get('redirect');
  return redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : '/home';
}

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [redirectTo, setRedirectTo] = useState('/home');
  const loginHref = `/?redirect=${encodeURIComponent(redirectTo)}`;

  useEffect(() => {
    setRedirectTo(getSafeRedirect());
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.push(getSafeRedirect());
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex flex-col">
      {/* Header */}
      <div className="pt-8 px-6 pb-12 text-center">
        <div className="inline-flex p-4 bg-blue-600 rounded-[2rem] text-white shadow-xl shadow-blue-200 mb-6">
          <Zap size={40} fill="white" />
        </div>
        <h1 className="text-4xl font-black italic text-slate-900 uppercase tracking-tighter mb-2">Nexus</h1>
        <p className="text-slate-500 font-bold">AI Card Scanner & Collection Management</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 max-w-2xl mx-auto w-full flex flex-col justify-between pb-12">
        {/* Features */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 text-blue-600 rounded-xl p-3 flex-shrink-0">
                <Camera size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 mb-1">AI カード認識</h3>
                <p className="text-sm text-slate-500">写真を撮るだけで自動検出・分類</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="bg-purple-100 text-purple-600 rounded-xl p-3 flex-shrink-0">
                <Layers size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 mb-1">コレクション管理</h3>
                <p className="text-sm text-slate-500">複数のプロファイル、所有枚数の追跡</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="bg-amber-100 text-amber-600 rounded-xl p-3 flex-shrink-0">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 mb-1">トレード機能</h3>
                <p className="text-sm text-slate-500">ユーザー間での交換、イベント管理</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="bg-green-100 text-green-600 rounded-xl p-3 flex-shrink-0">
                <Users size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 mb-1">オフライン対応</h3>
                <p className="text-sm text-slate-500">インターネットなしでも利用可能</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href={loginHref}
          className="mt-8 w-full py-6 bg-slate-900 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-slate-800"
        >
          <LogIn size={20} /> ログインして開始
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
