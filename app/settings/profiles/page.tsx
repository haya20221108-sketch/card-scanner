'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, Plus, UserCircle, LogOut, Mail, Lock, Eye, EyeOff, Edit2, X } from 'lucide-react';
import Link from 'next/link';
import { getCachedProfiles, getOnlineStatus, rememberUserId, setCachedProfiles } from '../../offline';
import { CustomAlert } from '../../components/CustomAlert';
import { useAuth } from '../../../AuthContext';
import { createProfile, ensureProfiles, renameProfile } from '../../profileStore';
import { auth } from '../../../firebase';
import { signOut, sendPasswordResetEmail, updatePassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';

interface ProfileUI {
  id: string;
  display_name: string;
}

export default function ProfilesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileUI[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProfileUI | null>(null);
  const [editName, setEditName] = useState('');
  const [alert, setAlert] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'info' | 'error' | 'success' });

  useEffect(() => {
    const load = async () => {
      // 1. まずキャッシュから読み込む (オフライン時でもリストが表示されるようにする)
      const cached = getCachedProfiles();
      if (cached.length > 0) {
        const mapped = cached.map(p => ({
          id: p.id,
          display_name: p.display_name || 'Unnamed'
        }));
        setProfiles(mapped);
      }

      if (getOnlineStatus() && user?.uid) {
        try {
          rememberUserId(user.uid);
          const data = await ensureProfiles(user.uid);
          setProfiles(data);
          setCachedProfiles(data);
        } catch (authError) {
          console.error('Auth check failed:', authError);
        }
      }
    };
    load();
  }, [user]);

  const handleCreateProfile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newProfileName.trim() || !user?.uid) return;
    setLoading(true);
    try {
      const newProfile = await createProfile(user.uid, newProfileName.trim());
      const mapped = { id: newProfile.p_uid, display_name: newProfile.name };
      setProfiles(prev => {
        const next = [...prev, mapped];
        setCachedProfiles(next);
        return next;
      });
      setNewProfileName('');
      setAlert({ isOpen: true, title: '成功', message: 'アカウントを作成しました', type: 'success' });
    } catch (err: any) {
      // エラーオブジェクトを詳細に出力（{} と表示されるのを防ぐ）
      console.error('Profile creation error:', JSON.stringify(err, null, 2));
      if (err.code) console.error('Error Code:', err.code);
      if (err.details) console.error('Error Details:', err.details);

      // 詳細なエラー情報を表示
      const errorMsg = err.message || '不明なエラー';
      const isRlsError = err.code === '42501';
      setAlert({ 
        isOpen: true, 
        title: 'アカウント作成失敗', 
        message: isRlsError 
          ? `権限エラー (42501): SupabaseのSQL EditorでRLSポリシーを設定してください。詳細はREADME.mdを確認してください。` 
          : `${errorMsg} (Code: ${err.code})\n※テーブル設定を確認してください。`,
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!editingProfile || !editName.trim()) return;
    setLoading(true);
    try {
      await renameProfile(editingProfile.id, editName.trim());
      
      const updatedProfiles = profiles.map(p => 
        p.id === editingProfile.id ? { ...p, display_name: editName.trim() } : p
      );
      
      setProfiles(updatedProfiles);
      setCachedProfiles(updatedProfiles);
      setEditingProfile(null);
      setAlert({ isOpen: true, title: '成功', message: 'アカウント名を変更しました', type: 'success' });
    } catch (err: any) {
      console.error('Rename error:', err);
      setAlert({ 
        isOpen: true, 
        title: 'エラー', 
        message: '名前の変更に失敗しました。',
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      await signOut(auth);
      router.push('/');
    }
  };

  const handlePasswordReset = async () => {
    if (user?.email) {
      try {
        await sendPasswordResetEmail(auth, user.email);
        setAlert({ isOpen: true, title: '送信完了', message: 'パスワード再設定メールを送信しました。', type: 'success' });
      } catch (error) {
        setAlert({ isOpen: true, title: 'エラー', message: '送信に失敗しました。', type: 'error' });
      }
    }
  };

  const handleUpdatePasswordDirectly = async () => {
    if (!newPassword || newPassword.length < 6) {
      setAlert({ isOpen: true, title: '入力エラー', message: 'パスワードは6文字以上で入力してください。', type: 'error' });
      return;
    }
    if (!user) return;

    setIsUpdatingPassword(true);
    try {
      await updatePassword(user, newPassword);
      setAlert({ isOpen: true, title: '成功', message: 'パスワードを更新しました。', type: 'success' });
      setNewPassword('');
    } catch (error: any) {
      console.error(error);
      const message = error.code === 'auth/requires-recent-login'
        ? 'セキュリティのため、再ログインしてからもう一度お試しください。'
        : 'パスワードの更新に失敗しました。';
      setAlert({ isOpen: true, title: 'エラー', message, type: 'error' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Account & Binders</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">アカウントとバインダーの管理</p>
        </div>
      </header>

      <div className="space-y-8 pb-20">
        {/* アカウント・セキュリティ */}
        <section className="space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">アカウント情報</p>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <div className="flex items-center gap-4 p-4">
              <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl">
                <Mail size={20} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">メールアドレス</p>
                <p className="text-sm font-bold text-slate-900">{user?.email}</p>
              </div>
            </div>

            {/* サイト内パスワード変更フォーム */}
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
                  <Lock size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-900 uppercase">パスワードを直接変更</p>
                  <div className="mt-2 relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="新しいパスワード"
                      className="w-full bg-slate-50 border-none px-4 py-2 rounded-xl text-xs font-bold outline-none pr-10"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleUpdatePasswordDirectly}
                  disabled={isUpdatingPassword || !newPassword}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 disabled:opacity-30"
                >
                  {isUpdatingPassword ? '更新中...' : 'パスワードを更新'}
                </button>
              </div>
            </div>

            {/* メール送信（バックアップ手段として残す） */}
            <button 
              onClick={handlePasswordReset}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left group opacity-60"
            >
              <div className="flex items-center gap-4 pl-2">
                <div className="p-2 bg-slate-100 text-slate-400 rounded-xl">
                  <Mail size={16} />
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase">メールで再設定リンクを送る</p>
              </div>
              <ChevronLeft size={16} className="rotate-180 text-slate-300" />
            </button>
          </div>
        </section>

        {/* アカウント新規作成 */}
        <section className="space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">新規Binder Account作成</p>
          <form onSubmit={handleCreateProfile} className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 flex gap-3">
            <input 
              type="text" 
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Binder Name"
              className="flex-1 bg-slate-50 border-none px-4 py-2 rounded-2xl text-xs font-bold outline-none"
            />
            <button 
              type="submit"
              disabled={loading || !newProfileName.trim()}
              className="w-14 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-30"
            >
              <Plus size={24} />
            </button>
          </form>
        </section>

        {/* アカウント一覧 & 選択 */}
        <section className="space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Binder Accounts</p>
          {/* リスト部分 */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            {profiles.map(p => {
              return (
                <div 
                  key={p.id}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-400">
                      <UserCircle size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{p.display_name}</p>
                    </div>
                  </div>
                  {/* 編集ボタン */}
                  <button 
                    onClick={() => {
                      setEditingProfile(p);
                      setEditName(p.display_name);
                    }}
                    className="p-2 text-slate-400 hover:text-blue-500 transition-colors active:scale-90"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Actions */}
        <div className="pt-6">
          <button 
            onClick={handleLogout}
            className="w-full py-5 bg-white text-red-500 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all border border-slate-100 shadow-sm"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>

      {/* 編集モーダル */}
      {editingProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setEditingProfile(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black italic text-slate-900 uppercase tracking-tighter">Binder名を編集</h3>
              <button onClick={() => setEditingProfile(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={18} /></button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">New Binder Name</label>
              <input 
                type="text" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-slate-50 border-none px-5 py-3 rounded-2xl text-xs font-bold outline-none"
                autoFocus
              />
            </div>
            <button 
              onClick={handleRename}
              disabled={loading || !editName.trim() || editName === editingProfile.display_name}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all disabled:opacity-30"
            >
              {loading ? '更新中...' : '名前を更新'}
            </button>
          </div>
        </div>
      )}

      <CustomAlert 
        isOpen={alert.isOpen} 
        onClose={() => setAlert({ ...alert, isOpen: false })} 
        title={alert.title} 
        message={alert.message} 
        type={alert.type} 
        onCancel={() => setAlert({ ...alert, isOpen: false })}
      />
    </div>
  );
}