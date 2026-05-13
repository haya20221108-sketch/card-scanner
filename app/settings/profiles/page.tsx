'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { Check, ChevronLeft, Cloud, CloudOff, Plus, Trash2, UserPlus, Zap } from 'lucide-react';
import { db } from '@/app/firebase';
import { supabase } from '@/app/supabase';
import {
  getActiveProfileId,
  getCachedProfiles,
  getOnlineStatus,
  readJson,
  rememberUserId,
  setActiveProfileId,
  setCachedProfiles,
  writeJson,
} from '@/app/offline';

const PENDING_PROFILE_CHANGES_KEY = 'pending_profile_changes';

function queueProfileChange(type: 'add' | 'delete', data: any) {
  const pending = readJson<any[]>(PENDING_PROFILE_CHANGES_KEY, []);
  pending.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type, data, created_at: new Date().toISOString() });
  writeJson(PENDING_PROFILE_CHANGES_KEY, pending);
  return pending.length;
}

export default function ProfilesPage() {
  const [user, setUser] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(getOnlineStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [customAlert, setCustomAlert] = useState<string | null>(null);

  useEffect(() => {
    setProfiles(getCachedProfiles());
    setActiveProfileIdState(getActiveProfileId());

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const loadProfiles = async () => {
      if (!getOnlineStatus()) return;
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) return;
        setUser(currentUser);
        rememberUserId(currentUser.id);
        const q = query(collection(db, 'profiles'), where('uuid', '==', currentUser.id), orderBy('created_at', 'asc'));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        setProfiles(list);
        setCachedProfiles(list);
        if (!getActiveProfileId() && list.length > 0) handleSelectProfile(list[0].id);
      } catch {
        setCustomAlert('Cached profiles loaded.');
      }
    };

    loadProfiles();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSelectProfile = (id: string) => {
    setActiveProfileIdState(id);
    setActiveProfileId(id);
    setCustomAlert('Account Switched');
  };

  const handleAddProfile = async () => {
    const displayName = newProfileName.trim();
    if (!displayName) return;

    setIsUpdating(true);
    const localProfile = { id: `local-profile-${Date.now()}`, display_name: displayName, created_at: new Date().toISOString() };
    const nextProfiles = [...profiles, localProfile];
    const shouldActivate = profiles.length === 0;
    setProfiles(nextProfiles);
    setCachedProfiles(nextProfiles);
    setNewProfileName('');

    if (shouldActivate) handleSelectProfile(localProfile.id);

    if (isOnline && user) {
      try {
        const docRef = await addDoc(collection(db, 'profiles'), {
          uuid: user.id,
          display_name: displayName,
          created_at: serverTimestamp(),
        });
        const synced = nextProfiles.map((profile) => profile.id === localProfile.id ? { ...profile, id: docRef.id } : profile);
        setProfiles(synced);
        setCachedProfiles(synced);
        if (shouldActivate || activeProfileId === localProfile.id) handleSelectProfile(docRef.id);
        setCustomAlert('Account Created');
      } catch {
        const count = queueProfileChange('add', { display_name: displayName });
        setCustomAlert(`${count} profile change pending`);
      }
    } else {
      const count = queueProfileChange('add', { display_name: displayName });
      setCustomAlert(`${count} profile change pending`);
    }

    setIsUpdating(false);
  };

  const handleRemoveProfile = async (id: string) => {
    if (profiles.length <= 1) {
      setCustomAlert('Minimum 1 account required');
      return;
    }
    if (!confirm('Delete this account?')) return;

    const next = profiles.filter((profile) => profile.id !== id);
    setProfiles(next);
    setCachedProfiles(next);
    if (id === activeProfileId) handleSelectProfile(next[0].id);

    if (isOnline && user && !id.startsWith('local-profile-')) {
      try {
        await deleteDoc(doc(db, 'profiles', id));
        setCustomAlert('Account Removed');
      } catch {
        const count = queueProfileChange('delete', { id });
        setCustomAlert(`${count} profile change pending`);
      }
    } else {
      const count = queueProfileChange('delete', { id });
      setCustomAlert(`${count} profile change pending`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans max-w-md mx-auto text-slate-900">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400"><ChevronLeft /></Link>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">Profiles</h1>
        <div className="ml-auto">{isOnline ? <Cloud size={18} className="text-emerald-500" /> : <CloudOff size={18} className="text-amber-500" />}</div>
      </header>

      <section className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500">
            <UserPlus size={24} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase">Accounts</h2>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Offline editable</p>
          </div>
        </div>

        <div className="space-y-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectProfile(profile.id)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleSelectProfile(profile.id); }}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                activeProfileId === profile.id ? 'bg-slate-900 border-slate-900 shadow-lg text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
              }`}
            >
              <span className="text-xs font-black uppercase tracking-tight">{profile.display_name || 'Unnamed'}</span>
              <span className="flex items-center gap-2">
                {activeProfileId === profile.id && <Check size={16} className="text-blue-400" />}
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); handleRemoveProfile(profile.id); }}
                  className={activeProfileId === profile.id ? 'text-slate-500 hover:text-red-400' : 'text-slate-300 hover:text-red-500'}
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="NEW NAME"
            value={newProfileName}
            onChange={(event) => setNewProfileName(event.target.value)}
            className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-[10px] font-black outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button type="button" onClick={handleAddProfile} disabled={isUpdating} className="bg-slate-900 text-white p-4 rounded-2xl active:scale-95 disabled:opacity-50">
            <Plus size={20} />
          </button>
        </div>
      </section>

      {customAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-xs bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3">
          <Zap size={16} className="text-blue-400" />
          <p className="text-[9px] font-black uppercase tracking-widest flex-1">{customAlert}</p>
        </div>
      )}
    </div>
  );
}
