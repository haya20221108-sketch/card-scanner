'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/app/supabase';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { UserPlus, ChevronLeft, Trash2, Plus, Zap, Check } from 'lucide-react';
import Link from 'next/link';

export default function ProfilesManagementPage() {
  const [user, setUser] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [customAlert, setCustomAlert] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        fetchProfiles(user.id);
      }
    };
    getUser();
    setActiveProfileId(localStorage.getItem('active_profile_id'));
  }, []);

  const fetchProfiles = async (uid: string) => {
    const q = query(collection(db, "profiles"), where("uuid", "==", uid), orderBy("created_at", "asc"));
    const querySnapshot = await getDocs(q);
    const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setProfiles(list);
    if (!localStorage.getItem('active_profile_id') && list.length > 0) {
      handleSelectProfile(list[0].id);
    }
  };

  const handleSelectProfile = (id: string) => {
    setActiveProfileId(id);
    localStorage.setItem('active_profile_id', id);
    setCustomAlert("Account Switched");
  };

  const handleAddProfile = async () => {
    if (!newProfileName || !user) return;
    setIsUpdating(true);
    try {
      const docRef = await addDoc(collection(db, "profiles"), {
        uuid: user.id,
        display_name: newProfileName,
        created_at: serverTimestamp()
      });
      setNewProfileName('');
      fetchProfiles(user.id);
      if (profiles.length === 0) handleSelectProfile(docRef.id);
      setCustomAlert("Account Created");
    } catch (e) {
      setCustomAlert("Error Occurred");
    }
    setIsUpdating(false);
  };

  const handleRemoveProfile = async (id: string) => {
    if (profiles.length <= 1) return setCustomAlert("Minimum 1 account required");
    if (!confirm("Delete this account? Cards will remain in DB but this profile association will be lost.")) return;
    await deleteDoc(doc(db, "profiles", id));
    
    // もし削除したのがアクティブなプロファイルなら、切り替える
    if (id === activeProfileId) {
      const nextProfile = profiles.find(p => p.id !== id);
      if (nextProfile) handleSelectProfile(nextProfile.id);
    }
    
    await fetchProfiles(user!.id);
    setCustomAlert("Account Removed");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans max-w-md mx-auto text-slate-900">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400"><ChevronLeft /></Link>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">Profiles</h1>
      </header>

      <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 space-y-6">
        <div className="space-y-3">
          {profiles.map(p => (
            <div 
              key={p.id} 
              onClick={() => handleSelectProfile(p.id)}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${activeProfileId === p.id ? 'bg-slate-900 border-slate-900 shadow-xl' : 'bg-slate-50 border-slate-100 opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${activeProfileId === p.id ? 'bg-blue-400 animate-pulse' : 'bg-slate-300'}`} />
                <span className={`text-xs font-black uppercase tracking-tight ${activeProfileId === p.id ? 'text-white' : 'text-slate-700'}`}>{p.display_name}</span>
              </div>
              <div className="flex items-center gap-2">
                {activeProfileId === p.id && <Check size={16} className="text-blue-400" />}
                <button onClick={(e) => { e.stopPropagation(); handleRemoveProfile(p.id); }} className={`p-2 transition-colors ${activeProfileId === p.id ? 'text-slate-500 hover:text-red-400' : 'text-slate-300 hover:text-red-500'}`}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 flex gap-2">
          <input 
            type="text" 
            placeholder="NEW NAME"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-[10px] font-black outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button onClick={handleAddProfile} disabled={isUpdating} className="bg-slate-900 text-white p-4 rounded-2xl active:scale-95 transition-all"><Plus size={20} /></button>
        </div>
      </div>

      {customAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-xs bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Zap size={16} className="text-blue-400" />
          <p className="text-[9px] font-black uppercase tracking-widest flex-1">{customAlert}</p>
        </div>
      )}
    </div>
  );
}