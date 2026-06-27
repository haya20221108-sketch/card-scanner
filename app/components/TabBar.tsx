'use client';

import React, { useRef, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Layers, ArrowLeftRight, Calendar, Settings, Move } from 'lucide-react';
import { isPublicPath } from './AuthGate';
import { useLayoutEditMode, useUiPlacement } from './useUiPlacement';

export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { placement, setPlacement } = useUiPlacement('tabBar');
  const { enabled: editMode } = useLayoutEditMode();
  const dragRef = useRef<{ offsetX: number } | null>(null);
  const navRef = useRef<HTMLElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [navDragX, setNavDragX] = useState<number | null>(null);
  const [isNavDragging, setIsNavDragging] = useState(false);
  const [isFading, setIsFading] = useState(false);

  // 1. 公開パスは非表示
  if (isPublicPath(pathname)) return null;

  // 2. レイアウト編集モード(editMode)の時は最優先で非表示（完全に隠す）
  if (editMode) return null;

  // 3. 通常時（/collectionページ等を含む）はそのまま下のナビゲーションを表示する

  const paths = ['/trade', '/collection', '/home', '/event', '/settings'];

  const getActiveIndex = () => {
    if (pathname === '/trade') return 0;
    if (pathname === '/collection') return 1;
    if (pathname === '/home') return 2;
    if (pathname === '/event') return 3;
    if (pathname?.startsWith('/settings')) return 4;
    return 0;
  };

  const activeIndex = getActiveIndex();
  const displayIndex = navDragX !== null ? navDragX : activeIndex;

  useEffect(() => {
    setNavDragX(null); 
    setIsFading(true);
    const timer = setTimeout(() => setIsFading(false), 500);
    return () => clearTimeout(timer);
  }, [pathname]);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const frame = event.currentTarget.closest('[data-placement-target]') as HTMLDivElement | null;
    if (!frame) return;

    event.preventDefault();
    setIsDragging(true); 
    
    const rect = frame.getBoundingClientRect();
    dragRef.current = {
      offsetX: event.clientX - (rect.left + rect.width / 2),
    };

    const handleMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return;
      const centerX = moveEvent.clientX - dragRef.current.offsetX;
      setPlacement({
        ...placement,
        x: (centerX / window.innerWidth) * 100,
      });
    };

    const stopDrag = () => {
      dragRef.current = null;
      setIsDragging(false); 
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
  };

  const startNavDrag = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button:not(.edit-handle)')) return;
    if ((event.target as HTMLElement).closest('.edit-handle')) return;

    const navElement = navRef.current;
    if (!navElement) return;

    event.preventDefault();
    setIsNavDragging(true);

    const rect = navElement.getBoundingClientRect();
    const padLeft = 6; 
    const availableWidth = rect.width - 12;
    const itemWidth = availableWidth / 5;

    const updatePosition = (clientX: number) => {
      const relativeX = clientX - rect.left - padLeft;
      const idx = (relativeX - itemWidth / 2) / itemWidth;
      setNavDragX(Math.max(0, Math.min(4, idx)));
    };

    updatePosition(event.clientX);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updatePosition(moveEvent.clientX);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      setIsNavDragging(false);
      const relativeX = upEvent.clientX - rect.left - padLeft;
      const idx = (relativeX - itemWidth / 2) / itemWidth;
      const clampedIndex = Math.max(0, Math.min(4, Math.round(idx)));

      setNavDragX(clampedIndex);
      router.push(paths[clampedIndex]);

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return (
    <div
      id="global-tabbar"
      data-placement-target
      style={{ 
        left: `${placement.x}%`, 
        bottom: `${placement.bottom}px`,
        transition: isDragging 
          ? 'left 0.08s ease-out, transform 0.2s ease-out' 
          : 'left 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s ease'
      }}
      className={`fixed -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-50 transition-all ${
        isFading ? 'animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out' : ''
      } ${editMode ? 'ring-2 ring-blue-500/30 rounded-[2.5rem] z-[80]' : ''} ${
        isDragging ? 'scale-x-[1.03] scale-y-[0.98]' : 'scale-100'
      }`}
    >
      {editMode && (
        <button
          type="button"
          onPointerDown={startDrag}
          className="edit-handle absolute -top-5 left-1/2 -translate-x-1/2 pointer-events-auto touch-none cursor-grab active:cursor-grabbing w-9 h-9 rounded-full bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 flex items-center justify-center border-4 border-white transition-transform active:scale-90 z-30"
          aria-label="TabBarを左右にスライド"
        >
          <Move size={14} />
        </button>
      )}

      {/* ✨ クリアガラス仕様のコンテナ */}
      <nav 
        ref={navRef}
        onPointerDown={startNavDrag}
        style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.35)', 
          borderColor: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(1px) saturate(140%)',
          boxShadow: `
            0 16px 32px -10px rgba(0, 15, 40, 0.08),
            inset 0 1px 4px rgba(255, 255, 255, 0.5)
          `
        }}
        className="relative border p-1.5 flex items-center rounded-[2.5rem] select-none overflow-hidden touch-none text-slate-700"
      >
        {/* 背面のインジケーター層 */}
        <div className="absolute inset-1.5 pointer-events-none z-0">
          <div 
            style={{
              width: '20%',
              height: '100%',
              transform: `translateX(${displayIndex * 100}%)`,
              transition: isNavDragging 
                ? 'none' 
                : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              backgroundImage: `
                linear-gradient(135deg, rgba(224, 242, 254, 0.9) 0%, rgba(186, 230, 253, 0.85) 50%, rgba(125, 211, 252, 0.9) 100%),
                radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 1) 0%, transparent 50%)
              `,
              border: '1px solid rgba(255, 255, 255, 0.85)'
            }}
            className="rounded-2xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),0_4px_10px_rgba(14,165,233,0.12)] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-cyan-300/10 mix-blend-overlay" />
          </div>
        </div>

        {/* 各メニュー */}
        <button
          type="button"
          onClick={() => router.push(paths[0])}
          className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-2xl transition-all duration-300 z-10 focus:outline-none cursor-pointer ${
            activeIndex === 0 ? 'text-blue-950 font-black scale-105' : 'opacity-80 hover:opacity-100'
          }`}
        >
          <ArrowLeftRight size={20} className={`transition-transform duration-300 ${activeIndex === 0 ? 'scale-110' : ''}`} />
          <span className="text-[8px] font-black uppercase tracking-wider">Trade</span>
        </button>

        <button
          type="button"
          onClick={() => router.push(paths[1])}
          className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-2xl transition-all duration-300 z-10 focus:outline-none cursor-pointer ${
            activeIndex === 1 ? 'text-blue-950 font-black scale-105' : 'opacity-80 hover:opacity-100'
          }`}
        >
          <Layers size={20} className={`transition-transform duration-300 ${activeIndex === 1 ? 'scale-110' : ''}`} />
          <span className="text-[8px] font-black uppercase tracking-wider">Binder</span>
        </button>

        <button
          type="button"
          onClick={() => router.push(paths[2])}
          className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-2xl transition-all duration-300 z-10 focus:outline-none cursor-pointer ${
            activeIndex === 2 ? 'text-blue-950 font-black scale-105' : 'opacity-80 hover:opacity-100'
          }`}
        >
          <Home size={20} className={`transition-transform duration-300 ${activeIndex === 2 ? 'scale-110' : ''}`} />
          <span className="text-[8px] font-black uppercase tracking-wider">Home</span>
        </button>

        <button
          type="button"
          onClick={() => router.push(paths[3])}
          className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-2xl transition-all duration-300 z-10 focus:outline-none cursor-pointer ${
            activeIndex === 3 ? 'text-blue-950 font-black scale-105' : 'opacity-80 hover:opacity-100'
          }`}
        >
          <Calendar size={20} className={`transition-transform duration-300 ${activeIndex === 3 ? 'scale-110' : ''}`} />
          <span className="text-[8px] font-black uppercase tracking-wider">Event</span>
        </button>

        <button
          type="button"
          onClick={() => router.push(paths[4])}
          className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-2xl transition-all duration-300 z-10 focus:outline-none cursor-pointer ${
            activeIndex === 4 ? 'text-blue-950 font-black scale-105' : 'opacity-80 hover:opacity-100'
          }`}
        >
          <Settings size={20} className={`transition-transform duration-300 ${activeIndex === 4 ? 'scale-110' : ''}`} />
          <span className="text-[8px] font-black uppercase tracking-wider">Setting</span>
        </button>
      </nav>
    </div>
  );
}