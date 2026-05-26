'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  User, 
  RefreshCw, 
  Info, 
  ChevronRight,
  AlertTriangle,
  Users,
  Monitor,
  Bell,
  Sliders
} from 'lucide-react';
import { 
  getCachedUserId,
  getOnlineStatus,
  setCachedMasterData,
  setCachedProfiles
} from '../offline';
import { useAuth } from '../../AuthContext';
import { listProfiles } from '../profileStore';

const CONFIG = {
  gasUrl: 'https://script.google.com/macros/s/AKfycbzE912QE7aAjrxboaW8jLnjJ-tTW7JzePfkREe3vpnTYMsghP4eRMWd_cEK3ffLQn3w4Q/exec',
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => { // No dependencies, runs once on mount
    setUserId(user?.uid || getCachedUserId());
    setIsOnline(getOnlineStatus());
  }, [user]);

  const clearLocalCache = () => {
    if (confirm("ローカルキャッシュを全てクリアしますか？(マスタデータやオフラインデータが削除されます)")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const syncMasterData = async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    try {
      const res = await fetch(CONFIG.gasUrl);
      const data = await res.json();
      const filtered = data.filter((card: any) => card.name && !['名前', 'name'].includes(card.name.toLowerCase()));
      setCachedMasterData(filtered);
      
      // クラウドからプロフィールの再同期も行う
      const effectiveUserId = user?.uid || userId || getCachedUserId();
      if (effectiveUserId) {
        const profileList = await listProfiles(effectiveUserId);
        const mappedProfiles = (profileList || []).map(p => ({
          ...p,
          id: p.id.toString()
        }));
        setCachedProfiles(mappedProfiles);
      }
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/home" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Settings</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuration Hub</p>
        </div>
      </header>

      <div className="space-y-8">
        {/* User Status Card */}
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <User size={80} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">Active Session</p>
          <h2 className="text-lg font-black truncate">{user?.email || 'Guest User'}</h2>
          <div className="mt-4 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400">{isOnline ? 'Nexus Online' : 'Offline Mode'}</span>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-5">Core Management</h3>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <SettingsLink 
              href="/settings/profiles" 
              icon={<User size={18} className="text-blue-500" />} 
              title="Account & Binders" 
              subtitle="User details and inventory profiles" 
            />
            <SettingsAction 
              onClick={syncMasterData} 
              icon={<RefreshCw size={18} className={`text-emerald-500 ${isSyncing ? 'animate-spin' : ''}`} />} 
              title="Sync Database" 
              subtitle="Refresh master card data" 
              disabled={isSyncing || !isOnline} 
            />
            <SettingsAction 
              onClick={clearLocalCache} 
              icon={<AlertTriangle size={18} className="text-red-500" />} 
              title="Clear Cache" 
              subtitle="Wipe all local data" 
              variant="danger" 
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-5">App Preferences</h3>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <SettingsLink 
              href="/settings/display" 
              icon={<Monitor size={18} className="text-indigo-500" />} 
              title="Display" 
              subtitle="実装予定" 
            />
            <SettingsLink 
              href="/settings/notifications" 
              icon={<Bell size={18} className="text-pink-500" />} 
              title="Notifications" 
              subtitle="実装予定" 
            />
            <SettingsPlanned
              icon={<Sliders size={18} className="text-purple-500" />} 
              title="Event Settings" 
              subtitle="実装予定" 
            />
            <SettingsLink 
              href="/settings/about" 
              icon={<Info size={18} className="text-slate-400" />} 
              title="About" 
              subtitle="System information and engine" 
              isLast 
            />
          </div>
        </div>

      </div>
    </div>
  );
}

function SettingsPlanned({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="w-full flex items-center justify-between p-4 text-left opacity-60">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-slate-100 text-slate-500 rounded-xl">
          {icon}
        </div>
        <div>
          <p className="text-xs font-black text-slate-900 uppercase">{title}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{subtitle}</p>
        </div>
      </div>
      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Soon</span>
    </div>
  );
}

function SettingsLink({ href, icon, title, subtitle, isLast }: { href: string; icon: React.ReactNode; title: string; subtitle: string; isLast?: boolean }) {
  return (
    <Link href={href} className="w-full flex items-center justify-between p-4 group active:bg-slate-50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-slate-100 text-slate-500 rounded-xl group-active:scale-90 transition-all">
          {icon}
        </div>
        <div>
          <p className="text-xs font-black text-slate-900 uppercase">{title}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{subtitle}</p>
        </div>
      </div>
      <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
    </Link>
  );
}

function SettingsAction({ onClick, icon, title, subtitle, variant = 'default', disabled = false }: { onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; variant?: 'default' | 'danger'; disabled?: boolean }) {
  const iconBg = variant === 'danger' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500';
  const titleColor = variant === 'danger' ? 'text-red-600' : 'text-slate-900';

  return (
    <button onClick={onClick} disabled={disabled} className="w-full flex items-center justify-between p-4 text-left group active:bg-slate-50 transition-colors disabled:opacity-50">
      <div className="flex items-center gap-4">
        <div className={`p-2 ${iconBg} rounded-xl group-active:scale-90 transition-all`}>
          {icon}
        </div>
        <div>
          <p className={`text-xs font-black ${titleColor} uppercase`}>{title}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{subtitle}</p>
        </div>
      </div>
      <ChevronRight size={14} className="text-slate-300" />
    </button>
  );
}
