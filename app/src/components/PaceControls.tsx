/**
 * PaceControls.tsx — 节奏控制面板（Phase 1）
 *
 * 包括：
 *   - 倍速切换 1× / 2× / 4×
 *   - 自动推进按钮 +1 / +3 / +5 / +13
 *   - 中断按钮
 */

import type { PlaySpeed } from '@/hooks/usePlaySpeed';
import { Zap, FastForward, Square } from 'lucide-react';

interface PaceControlsProps {
  speed: PlaySpeed;
  setSpeed: (s: PlaySpeed) => void;
  onAutoAdvance: (weeks: number) => void;
  onCancelAutoAdvance: () => void;
  isAutoAdvancing: boolean;
  disabled?: boolean;
}

const SPEEDS: PlaySpeed[] = [1, 2, 4];
const STEPS = [1, 3, 5, 13];

export function PaceControls({
  speed,
  setSpeed,
  onAutoAdvance,
  onCancelAutoAdvance,
  isAutoAdvancing,
  disabled = false,
}: PaceControlsProps) {
  return (
    <div className="ark-card p-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 text-xs text-slate-400">
        <Zap className="w-3.5 h-3.5 text-amber-500" />
        <span>倍速</span>
      </div>
      <div className="flex gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            disabled={disabled}
            className={`px-2.5 py-1 text-xs font-mono border transition-colors ${
              speed === s
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-[#0a0e17] border-[#1e293b] text-slate-400 hover:border-amber-500/40'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-[#1e293b]" />

      <div className="flex items-center gap-1 text-xs text-slate-400">
        <FastForward className="w-3.5 h-3.5 text-orange-400" />
        <span>自动推进</span>
      </div>
      <div className="flex gap-1">
        {STEPS.map((n) => (
          <button
            key={n}
            onClick={() => onAutoAdvance(n)}
            disabled={disabled || isAutoAdvancing}
            className={`px-2.5 py-1 text-xs font-mono border transition-colors bg-[#0a0e17] border-[#1e293b] text-slate-300 hover:border-orange-500/50 hover:text-orange-300 ${
              disabled || isAutoAdvancing ? 'opacity-40 cursor-not-allowed hover:border-[#1e293b]' : ''
            }`}
            title={`自动连推 ${n} 周（遇到事件/结束自动暂停）`}
          >
            +{n}
          </button>
        ))}
      </div>

      {isAutoAdvancing && (
        <button
          onClick={onCancelAutoAdvance}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Square className="w-3 h-3" />
          中断
        </button>
      )}
    </div>
  );
}
