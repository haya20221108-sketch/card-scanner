'use client';

import { useCallback, useEffect, useState } from 'react';

export type PlacementTarget = 'tabBar' | 'scannerFab';

export type UiPlacement = {
  x: number;
  bottom: number;
  opacity?: number;
};

const PLACEMENT_EVENT = 'nexus-ui-placement-change';
const EDIT_MODE_KEY = 'nexus_layout_edit_mode';
const PLACEMENT_KEYS: Record<PlacementTarget, string> = {
  tabBar: 'nexus_tab_bar_placement',
  scannerFab: 'nexus_scanner_fab_placement',
};

export const DEFAULT_PLACEMENTS: Record<PlacementTarget, UiPlacement> = {
  tabBar: { x: 50, bottom: 24, opacity: 1 },
  scannerFab: { x: 82, bottom: 112,  opacity: 1 },
};

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampPlacement(placement: UiPlacement): UiPlacement {
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  return {
    x: clamp(Number(placement.x) || 50, 6, 94),
    bottom: clamp(Number(placement.bottom) || 24, 8, Math.max(8, viewportHeight - 96)),
    opacity: clamp(Number(placement.opacity) || 1, 0, 1),
  };
}

export function readPlacement(target: PlacementTarget): UiPlacement {
  if (!canUseStorage()) return DEFAULT_PLACEMENTS[target];

  try {
    const raw = localStorage.getItem(PLACEMENT_KEYS[target]);
    if (!raw) return DEFAULT_PLACEMENTS[target];
    return clampPlacement({ ...DEFAULT_PLACEMENTS[target], ...JSON.parse(raw) });
  } catch {
    return DEFAULT_PLACEMENTS[target];
  }
}

export function writePlacement(target: PlacementTarget, placement: UiPlacement) {
  if (!canUseStorage()) return;
  localStorage.setItem(PLACEMENT_KEYS[target], JSON.stringify(clampPlacement(placement)));
  window.dispatchEvent(new Event(PLACEMENT_EVENT));
}

export function resetPlacement(target: PlacementTarget) {
  if (!canUseStorage()) return;
  localStorage.removeItem(PLACEMENT_KEYS[target]);
  window.dispatchEvent(new Event(PLACEMENT_EVENT));
}

export function readLayoutEditMode() {
  if (!canUseStorage()) return false;
  return localStorage.getItem(EDIT_MODE_KEY) === 'true';
}

export function writeLayoutEditMode(enabled: boolean) {
  if (!canUseStorage()) return;
  localStorage.setItem(EDIT_MODE_KEY, String(enabled));
  window.dispatchEvent(new Event(PLACEMENT_EVENT));
}

export function useUiPlacement(target: PlacementTarget) {
  const [placement, setPlacementState] = useState(DEFAULT_PLACEMENTS[target]);

  useEffect(() => {
    const sync = () => setPlacementState(readPlacement(target));
    sync();
    window.addEventListener(PLACEMENT_EVENT, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('resize', sync);

    return () => {
      window.removeEventListener(PLACEMENT_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('resize', sync);
    };
  }, [target]);

  const setPlacement = useCallback((next: UiPlacement) => {
    const clamped = clampPlacement(next);
    setPlacementState(clamped);
    writePlacement(target, clamped);
  }, [target]);

  const reset = useCallback(() => {
    resetPlacement(target);
    setPlacementState(DEFAULT_PLACEMENTS[target]);
  }, [target]);

  return { placement, setPlacement, reset };
}

export function useLayoutEditMode() {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    const sync = () => setEnabledState(readLayoutEditMode());
    sync();
    window.addEventListener(PLACEMENT_EVENT, sync);
    window.addEventListener('storage', sync);

    return () => {
      window.removeEventListener(PLACEMENT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    writeLayoutEditMode(next);
  }, []);

  return { enabled, setEnabled };
}
