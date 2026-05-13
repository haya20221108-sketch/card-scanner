'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronLeft, Database } from 'lucide-react';
import Link from 'next/link';
import { syncAllData } from '../../offline/syncData';
import { STORAGE_KEYS } from '../../offline';

export default function PreferencesPage() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // 初期表示時に最後に同期した時間をキャッシュから取得
  useEffect(() => {
    const time = localStorage.getItem(STORAGE_KEYS.masterDataTime);
    if (time) {
      setLastSync(new Date(parseInt(time)).toLocaleString('ja-JP'));
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncAllData();
    setSyncing(false);

    if (result.success) {
      // 同期成功時に表示日時を更新
      const time = localStorage.getItem(STORAGE_KEYS.masterDataTime);
      if (time) setLastSync(new Date(parseInt(time)).toLocaleString('ja-JP'));
      alert('データの同期が完了しました！');
    } else {
      alert('同期に失敗しました: ' + result.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-md mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/settings" className="p-2 -ml-2 text-slate-400 active:text-slate-600">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Preferences</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Data Sync Section */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
            <Database size={32} />
          </div>
          
          <h2 className="text-lg font-black text-slate-900 mb-2">Cloud Data Sync</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-8 px-4">
            クラウド上の最新カードリスト(GAS)と、あなたの所持記録(Supabase/Firebase)を一括同期し、アプリをオフラインで利用できるようにします。
          </p>

          <div className="w-full space-y-4">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-slate-200"
            >
              <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync All Data Now"}
            </button>

            {lastSync && (
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">
                Last Synced: {lastSync}
              </p>
            )}
          </div>
        </div>

        <div className="px-6">
          <p className="text-[10px] text-slate-400 leading-relaxed italic">
            * 同期が完了すると、バインダー（Collection）画面の表示が非常に高速になります。
          </p>
        </div>
      </div>
    </div>
  );
}