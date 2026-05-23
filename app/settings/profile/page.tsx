'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, User as UserIcon, Save, Mail, Lock, LogOut, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { auth } from '../../../firebase';
import { updateProfile, updatePassword, signOut } from 'firebase/auth';
import { useAuth } from '../../../AuthContext';
import { CustomAlert } from '../../components/CustomAlert';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'info' | 'success' | 'error' });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    } else if (user) {
      setEmail(user.email || '');
      setDisplayName(user.displayName || '');
    }
  }, [user, authLoading, router]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user, { displayName });
      setAlert({ isOpen: true, title: 'Success', message: 'Display name updated.', type: 'success' });
    } catch (error: any) {
      setAlert({ isOpen: true, title: 'Update Failed', message: error.message, type: 'error' });
    }
    setLoading(false);
  };

  const handleUpdatePassword = async () => {
    if (!user) return;
    if (password.length < 6) {
      return setAlert({ isOpen: true, title: 'Weak Password', message: 'At least 6 characters required.', type: 'error' });
    }
    setLoading(true);
    try {
      await updatePassword(user, password);
      setAlert({ isOpen: true, title: 'Success', message: 'Password updated successfully.', type: 'success' });
      setPassword('');
    } catch (error: any) {
      setAlert({ isOpen: true, title: 'Update Failed', message: error.message, type: 'error' });
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-20 font-sans max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-8 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Account</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Settings & Security</p>
        </div>
      </header>

      <div className="space-y-6">
        {/* Profile Info Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Profile Info</p>
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative opacity-60">
                <Mail size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input type="text" value={email} readOnly className="w-full bg-slate-50 border-none py-4 pl-12 pr-6 rounded-2xl text-xs font-bold outline-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
              <div className="relative">
                <UserIcon size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-50 py-4 pl-12 pr-6 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
                />
              </div>
            </div>
            <button 
              onClick={handleUpdateProfile}
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={14} /> Update Name
            </button>
          </div>
        </section>

        {/* Security Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Security</p>
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-50 py-4 pl-12 pr-12 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button 
              onClick={handleUpdatePassword}
              disabled={loading || !password}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30"
            >
              Change Password
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <div className="pt-4">
          <div className="space-y-2">
            <button 
              onClick={() => setAlert({ isOpen: true, title: 'Logout', message: 'Do you want to exit your session?', type: 'info' })}
              className="w-full py-5 bg-white text-red-500 border border-red-50 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={16} /> Terminate Session
            </button>
          </div>
        </div>
      </div>

      <CustomAlert 
        isOpen={alert.isOpen} 
        onClose={() => setAlert({ ...alert, isOpen: false })} 
        title={alert.title} 
        message={alert.message} 
        type={alert.type} 
        onConfirm={alert.title === 'Logout' ? handleLogout : undefined}
        onCancel={alert.title === 'Logout' ? () => setAlert({ ...alert, isOpen: false }) : undefined}
      />
    </div>
  );
}