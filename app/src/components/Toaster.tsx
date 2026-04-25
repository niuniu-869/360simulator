/**
 * Toaster.tsx — 全局 Toast 渲染器（Phase 2 即时反馈）
 *
 * 渲染右上角堆叠的 toast，自动消失，可点击关闭。
 */

import { useToasts, dismissToast, type ToastSeverity } from '@/hooks/useToast';
import { CheckCircle, AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';

const SEVERITY_STYLE: Record<ToastSeverity, { bg: string; border: string; text: string; Icon: typeof Info }> = {
  info: {
    bg: 'bg-[#0a0e17]',
    border: 'border-blue-500/40',
    text: 'text-blue-300',
    Icon: Info,
  },
  success: {
    bg: 'bg-[#0a0e17]',
    border: 'border-emerald-500/40',
    text: 'text-emerald-300',
    Icon: CheckCircle,
  },
  warning: {
    bg: 'bg-[#0a0e17]',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    Icon: AlertTriangle,
  },
  danger: {
    bg: 'bg-[#0a0e17]',
    border: 'border-red-500/40',
    text: 'text-red-300',
    Icon: AlertOctagon,
  },
};

export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[320px] max-w-[90vw] pointer-events-none">
      {toasts.map((t) => {
        const s = SEVERITY_STYLE[t.severity];
        const Icon = s.Icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto ${s.bg} ${s.border} border shadow-lg p-3 flex items-start gap-2 animate-[fadeIn_120ms_ease-out]`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.text}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${s.text} truncate`}>{t.message}</div>
              {t.detail && (
                <div className="text-xs text-slate-400 mt-0.5">{t.detail}</div>
              )}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-slate-500 hover:text-slate-200 transition-colors p-0.5"
              aria-label="关闭"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
