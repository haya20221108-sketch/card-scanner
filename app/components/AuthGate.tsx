'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../AuthContext';

const PUBLIC_PATHS = new Set(['/', '/welcome']);

export function isPublicPath(pathname: string | null) {
  return !pathname || PUBLIC_PATHS.has(pathname);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || user || isPublicPath(pathname)) return;

    const currentPath = `${pathname}${window.location.search}`;
    router.replace(`/welcome?redirect=${encodeURIComponent(currentPath)}`);
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user && !isPublicPath(pathname)) {
    return null;
  }

  return <>{children}</>;
}
