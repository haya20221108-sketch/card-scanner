'use client';

import React from 'react';
import Link from 'next/link';
import { Camera, ChevronLeft, Monitor, Moon, Move, Navigation, RotateCcw, Sun } from 'lucide-react';
import { UiPlacement, useLayoutEditMode, useUiPlacement } from '../../components/useUiPlacement';

export default function DisplayPage() {
  const { enabled: editMode, setEnabled: setEditMode } = useLayoutEditMode();
  const tabBar = useUiPlacement('tabBar');
  const scannerFab = useUiPlacement('scannerFab');

  const resetAll = () => {
    tabBar.reset();
    scannerFab.reset();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 font-sans max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-10 pt-4">
        <Link href="/settings" className="p-2 -ml-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Display</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Layout Controls</p>
        </div>
      </header>

      <div className="space-y-8">
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200 mb-2">Live Layout</p>
              <h2 className="text-lg font-black italic uppercase">配置編集</h2>
            </div>
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              aria-pressed={editMode}
              className={`w-16 h-9 rounded-full p-1 flex items-center transition-colors ${editMode ? 'bg-blue-600' : 'bg-white/15'}`}
            >
              <span className={`w-7 h-7 rounded-full bg-white shadow-sm transition-transform ${editMode ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={resetAll}
              className="flex-1 py-3 rounded-2xl bg-white/10 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <RotateCcw size={14} /> Reset
            </button>
            <div className="flex-1 py-3 rounded-2xl bg-white/10 text-white/70 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
              <Move size={14} /> {editMode ? 'Editing' : 'Locked'}
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Navigation Position & Opacity</h3>
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <PlacementControl
              icon={<Navigation size={18} />}
              title="Tab Bar"
              placement={tabBar.placement}
              onChange={tabBar.setPlacement}
              onReset={tabBar.reset}
              showOpacity={true}
            />
            <PlacementControl
              icon={<Camera size={18} />}
              title="Scanner Button"
              placement={scannerFab.placement}
              onChange={scannerFab.setPlacement}
              onReset={scannerFab.reset}
              showOpacity={false}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Color Theme</h3>
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <ThemeOption active={true} icon={<Sun size={18} />} title="Light Glass" subtitle="Default UI Style" />
            <ThemeOption active={false} icon={<Moon size={18} />} title="Dark Island" subtitle="Coming soon" />
          </div>
        </section>
      </div>
    </div>
  );
}

function PlacementControl({
  icon,
  title,
  placement,
  onChange,
  onReset,
  showOpacity,
}: {
  icon: React.ReactNode;
  title: string;
  placement: UiPlacement;
  onChange: (next: UiPlacement) => void;
  onReset: () => void;
  showOpacity?: boolean;
}) {
  // 画面表示用のパーセント（例: 0.4 -> 40）
  const displayOpacity = Math.round((placement.opacity ?? 0.4) * 100);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            {icon}
          </div>
          <div>
            <p className="text-xs font-black uppercase text-slate-900">{title}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
              X {Math.round(placement.x)} / B {Math.round(placement.bottom)}
              {showOpacity && ` / O ${displayOpacity}%`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center active:scale-95 transition-transform"
          aria-label={`${title}を初期位置に戻す`}
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <SliderRow
        label="X"
        value={placement.x}
        min={6}
        max={94}
        onChange={(value) => onChange({ ...placement, x: value })}
      />
      <SliderRow
        label="Bottom"
        value={placement.bottom}
        min={8}
        max={600}
        onChange={(value) => onChange({ ...placement, bottom: value })}
      />

      {showOpacity && (
        <SliderRow
          label="Opacity"
          value={displayOpacity}
          min={10}
          max={100}
          onChange={(value) => onChange({ ...placement, opacity: value / 100 })}
        />
      )}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[4rem_1fr_3rem] items-center gap-3">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-blue-600"
      />
      <span className="text-right text-[10px] font-black text-slate-500 tabular-nums">{Math.round(value)}</span>
    </label>
  );
}

function ThemeOption({ active, icon, title, subtitle }: { active: boolean; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className={`w-full flex items-center justify-between p-6 ${active ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}>
          {icon}
        </div>
        <div className="text-left">
          <p className={`text-xs font-black uppercase ${active ? 'text-slate-900' : 'text-slate-400'}`}>{title}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{subtitle}</p>
        </div>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'border-blue-600' : 'border-slate-100'}`}>
        {active && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />}
      </div>
    </div>
  );
}