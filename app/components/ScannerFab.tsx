'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera } from 'lucide-react';

export function ScannerFab() {
  const pathname = usePathname();

  if (!pathname || pathname === '/' || pathname.startsWith('/scanner')) return null;

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-full max-w-md px-5 flex justify-end z-40 pointer-events-none">
      <Link
        href="/scanner"
        className="pointer-events-auto w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95 transition-transform"
        aria-label="スキャンする"
      >
        <Camera size={22} strokeWidth={2.5} />
      </Link>
    </div>
  );
}
