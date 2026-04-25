/**
 * useToast.ts — 全局轻量 Toast 系统（Phase 2 即时反馈）
 *
 * 设计：
 *   - 模块级单例 store，无需 Provider；
 *   - useSyncExternalStore 订阅，保证 React 18 一致性；
 *   - 默认 3000ms 自动消失，可点击关闭；
 *   - severity: info | success | warning | danger
 */

import { useSyncExternalStore } from 'react';

export type ToastSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface ToastItem {
  id: string;
  message: string;
  detail?: string;
  severity: ToastSeverity;
  createdAt: number;
  durationMs: number;
}

type Listener = () => void;

let _items: ToastItem[] = [];
const _listeners: Set<Listener> = new Set();
let _idCounter = 0;

function emit() {
  for (const l of _listeners) l();
}

function snapshot(): readonly ToastItem[] {
  return _items;
}

export function pushToast(input: {
  message: string;
  detail?: string;
  severity?: ToastSeverity;
  durationMs?: number;
}): string {
  _idCounter += 1;
  const id = `toast_${Date.now()}_${_idCounter}`;
  const item: ToastItem = {
    id,
    message: input.message,
    detail: input.detail,
    severity: input.severity ?? 'info',
    createdAt: Date.now(),
    durationMs: input.durationMs ?? 3000,
  };
  _items = [..._items, item];
  emit();
  // 自动过期
  if (item.durationMs > 0) {
    setTimeout(() => dismissToast(id), item.durationMs);
  }
  return id;
}

export function dismissToast(id: string): void {
  const before = _items.length;
  _items = _items.filter((t) => t.id !== id);
  if (_items.length !== before) emit();
}

export function clearToasts(): void {
  if (_items.length === 0) return;
  _items = [];
  emit();
}

export function useToasts(): readonly ToastItem[] {
  return useSyncExternalStore(
    (cb) => {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    },
    snapshot,
    snapshot,
  );
}
