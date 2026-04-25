/**
 * usePlaySpeed.ts — 全局倍速控制（1×/2×/4×）
 *
 * 影响：
 *   - 弹窗自动关闭延迟（3000ms / speed）
 *   - 自动推进的连续 dispatch 间隔（300ms / speed）
 *
 * 持久化到 localStorage（key: '360sim:playSpeed'）。
 */

import { useEffect, useState, useCallback } from 'react';

export type PlaySpeed = 1 | 2 | 4;
const STORAGE_KEY = '360sim:playSpeed';

function readInitial(): PlaySpeed {
  if (typeof window === 'undefined') return 1;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    const n = Number(v);
    if (n === 1 || n === 2 || n === 4) return n;
  } catch {
    // ignore
  }
  return 1;
}

export function usePlaySpeed() {
  const [speed, setSpeedState] = useState<PlaySpeed>(readInitial);

  const setSpeed = useCallback((s: PlaySpeed) => {
    setSpeedState(s);
    try { window.localStorage.setItem(STORAGE_KEY, String(s)); } catch { /* ignore */ }
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeedState((cur) => {
      const next = (cur === 1 ? 2 : cur === 2 ? 4 : 1) as PlaySpeed;
      try { window.localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // 同窗口跨标签同步
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const n = Number(e.newValue);
      if (n === 1 || n === 2 || n === 4) setSpeedState(n);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return {
    speed,
    setSpeed,
    cycleSpeed,
    /** 自动推进时连续 dispatch 间的间隔（ms） */
    autoAdvanceTickMs: Math.round(300 / speed),
    /** 弹窗自动关闭基础延迟（ms） */
    popupAutoCloseMs: Math.round(2400 / speed),
  };
}
