'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Plus, Trash2, UserPlus, Check, Edit2, Save, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { getCachedProfiles, getOnlineStatus, rememberUserId, setActiveProfileId as persistActiveProfileId, setCachedProfiles } from '../../offline';
import { CustomAlert } from '../../components/CustomAlert';
import { useAuth } from '../../../AuthContext';

export default function ProfilesPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [alert, setAlert] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'info' | 'error' | 'success', onConfirm: undefined as any });

  useEffect(() => {
    const load = async () => {
      const cached = getCachedProfiles();
      setProfiles(cached);
      setActiveId(localStorage.getItem('active_profile_id') || (cached[0]?.id || null));
      
      if (getOnlineStatus()) {
        const userId = user?.uid;
        rememberUserId(userId);
        if (userId) {
          const { data } = await supabase.from('profiles').select('*').eq('uuid', userId).order('created_at', { ascending: true });
          if (data) {
            setProfiles(data);
            setCachedProfiles(data);
            const savedId = localStorage.getItem('active_profile_id');
            const nextActiveId = savedId && data.some((p) => p.id === savedId) ? savedId : (data[0]?.id || null);
            setActiveId(nextActiveId);
            persistActiveProfileId(nextActiveId);
          }
        }
      }
    };
    load();
  }, [user]);

  const switchProfile = (id: string | null) => {
    setActiveId(id);
    persistActiveProfileId(id);
  };

  const handleAdd = async () => {
    if (!newProfileName.trim()) return;
    setLoading(true);
    const userId = user?.uid;
    if (!userId) {
      setAlert({ isOpen: true, title: 'Login Required', message: 'ログイン中のFirebaseアカウントが見つかりません。', type: 'error', onConfirm: undefined });
      setLoading(false);
      return;
    }
    rememberUserId(userId);
    const { data, error } = await supabase.from('profiles').insert([{ display_name: newProfileName, uuid: userId }]).select();
    
    if (!error && data) {
      const updated = [...profiles, data[0]];
      setProfiles(updated);
      setCachedProfiles(updated);
      if (!activeId) switchProfile(data[0].id);
      setNewProfileName('');
    }
    setLoading(false);
  };

  const handleUpdateName = async (id: string) => {
    if (!editingName.trim()) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: editingName })
      .eq('id', id);

    if (!error) {
      const updated = profiles.map(p => p.id === id ? { ...p, display_name: editingName } : p);
      setProfiles(updated);
      setCachedProfiles(updated);
      setEditingId(null);
    } else {
      setAlert({ isOpen: true, title: 'Error', message: 'Failed to update name.', type: 'error', onConfirm: undefined });
    }
    setLoading(false);
  };

  const confirmDelete = (id: string, name: string) => {
    setAlert({
      isOpen: true,
      title: 'Delete Profile',
      message: `Are you sure you want to delete "${name}"? This will remove all associated card data.`,
      type: 'error',
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (!error) {
      const updated = profiles.filter(p => p.id !== id);
      setProfiles(updated);
      setCachedProfiles(updated);
      if (activeId === id) switchProfile(updated[0]?.id || null);
    }
    setAlert({ ...alert, isOpen: false });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Profiles</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Multi-Inventory</p>
        </div>
      </header>

      <div className="space-y-6">
        {/* New Profile Input */}
        <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 flex gap-2">
          <input 
            type="text" 
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="New profile name..."
            className="flex-1 bg-slate-50 border-none px-4 rounded-xl text-xs font-bold outline-none"
          />
          <button 
            onClick={handleAdd}
            disabled={loading || !newProfileName.trim()}
            className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center active:scale-90 transition-all disabled:opacity-30"
          >
            <Plus size={20} />
          </button>
        </div>
        
        {/* Profile List */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Your Accounts</p>
          {profiles.map(p => (
            <div key={p.id} className={`bg-white rounded-[1.5rem] p-4 border flex items-center justify-between transition-all ${activeId === p.id ? 'border-blue-500 shadow-lg shadow-blue-50' : 'border-slate-100 shadow-sm'}`}>
              {editingId === p.id ? (
                <div className="flex-1 flex items-center gap-2 pr-2">
                  <input 
                    value={editingName} 
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 bg-slate-50 border-none px-3 py-1 rounded-lg text-xs font-black uppercase outline-none"
                    autoFocus
                  />
                  <button onClick={() => handleUpdateName(p.id)} className="text-blue-500"><Save size={16} /></button>
                  <button onClick={() => setEditingId(null)} className="text-slate-300"><X size={16} /></button>
                </div>
              ) : (
                <button onClick={() => switchProfile(p.id)} className="flex-1 text-left flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeId === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {activeId === p.id ? <Check size={16} /> : <UserPlus size={16} />}
                  </div>
                  <span className={`text-xs font-black uppercase tracking-tight ${activeId === p.id ? 'text-slate-900' : 'text-slate-500'}`}>
                    {p.display_name}
                  </span>
                </button>
              )}
              
              <div className="flex items-center gap-1">
                {!editingId && (
                  <button 
                    onClick={() => { setEditingId(p.id); setEditingName(p.display_name); }}
                    className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                <button 
                  onClick={() => confirmDelete(p.id, p.display_name)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CustomAlert 
        isOpen={alert.isOpen} 
        onClose={() => setAlert({ ...alert, isOpen: false })} 
        title={alert.title} 
        message={alert.message} 
        type={alert.type} 
        onConfirm={alert.onConfirm}
        onCancel={() => setAlert({ ...alert, isOpen: false })}
      />
    </div>
  );
}
