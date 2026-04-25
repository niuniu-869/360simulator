/**
 * useGlobalShortcuts.ts — 全局键盘快捷键（Phase 1）
 *
 * 默认绑定：
 *   - Esc      → 关闭顶层弹窗
 *   - Space    → 推进下一周
 *   - 1/2/3/4  → 切换主面板 Tab
 *   - ?        → 弹出帮助（toast）
 *
 * 设计：所有 handler 通过 props 注入，hook 只负责事件分发，方便单测。
 */

import { useEffect } from 'react';

export interface ShortcutHandlers {
  onEscape?: () => void;
  onSpace?: () => void;
  onTab1?: () => void;
  onTab2?: () => void;
  onTab3?: () => void;
  onTab4?: () => void;
  onTab5?: () => void;
  onTab6?: () => void;
  onHelp?: () => void;
  /** 全局禁用（如表单输入时） */
  disabled?: boolean;
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
}

export function useGlobalShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    if (handlers.disabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      const key = e.key;
      switch (key) {
        case 'Escape':
          if (handlers.onEscape) {
            e.preventDefault();
            handlers.onEscape();
          }
          break;
        case ' ':
        case 'Spacebar':
          if (handlers.onSpace) {
            e.preventDefault();
            handlers.onSpace();
          }
          break;
        case '1':
          if (handlers.onTab1) { e.preventDefault(); handlers.onTab1(); }
          break;
        case '2':
          if (handlers.onTab2) { e.preventDefault(); handlers.onTab2(); }
          break;
        case '3':
          if (handlers.onTab3) { e.preventDefault(); handlers.onTab3(); }
          break;
        case '4':
          if (handlers.onTab4) { e.preventDefault(); handlers.onTab4(); }
          break;
        case '5':
          if (handlers.onTab5) { e.preventDefault(); handlers.onTab5(); }
          break;
        case '6':
          if (handlers.onTab6) { e.preventDefault(); handlers.onTab6(); }
          break;
        case '?':
          if (handlers.onHelp) { e.preventDefault(); handlers.onHelp(); }
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
