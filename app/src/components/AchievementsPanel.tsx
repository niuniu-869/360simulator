/**
 * AchievementsPanel.tsx — 成就总览（Phase 4）
 *
 * 用法：
 *   - 通关页"本局解锁"：传 currentRunUnlocked
 *   - 总览页"全成就"：不传 currentRunUnlocked，从 localStorage 拉所有解锁
 */

import { useMemo } from 'react';
import { ACHIEVEMENTS, getAllPersistedUnlocked, type Achievement } from '@/lib/achievements';
import { Lock, CheckCircle2, Trophy } from 'lucide-react';

interface AchievementsPanelProps {
  /** 本局解锁的 id 列表（可选，传了就高亮 + 仅显示已解锁） */
  currentRunUnlocked?: string[];
  /** 是否仅显示已解锁（默认 false：全部展示） */
  unlockedOnly?: boolean;
}

const CATEGORY_LABEL: Record<Achievement['category'], string> = {
  finance: '财务',
  operation: '经营',
  cognition: '认知',
  event: '事件',
  catastrophe: '灾难',
  brand: '品牌',
  scenario: '剧本',
};

export function AchievementsPanel({ currentRunUnlocked, unlockedOnly = false }: AchievementsPanelProps) {
  const persisted = useMemo(() => getAllPersistedUnlocked(), []);
  const currentSet = useMemo(() => new Set(currentRunUnlocked ?? []), [currentRunUnlocked]);

  const groups = useMemo(() => {
    const map = new Map<Achievement['category'], Achievement[]>();
    for (const a of ACHIEVEMENTS) {
      const arr = map.get(a.category) ?? [];
      arr.push(a);
      map.set(a.category, arr);
    }
    return Array.from(map.entries());
  }, []);

  const unlockedCount = ACHIEVEMENTS.filter((a) => persisted[a.id] || currentSet.has(a.id)).length;
  const totalCount = ACHIEVEMENTS.length;

  return (
    <div className="space-y-4">
      <div className="ark-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white">成就</h3>
        </div>
        <div className="text-sm font-mono">
          <span className="text-amber-400">{unlockedCount}</span>
          <span className="text-slate-500"> / {totalCount}</span>
        </div>
      </div>

      {groups.map(([cat, items]) => {
        const filtered = unlockedOnly
          ? items.filter((a) => persisted[a.id] || currentSet.has(a.id))
          : items;
        if (filtered.length === 0) return null;
        return (
          <div key={cat} className="ark-card p-4">
            <h4 className="text-sm font-bold text-slate-300 mb-3">{CATEGORY_LABEL[cat]}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filtered.map((a) => {
                const inThisRun = currentSet.has(a.id);
                const everUnlocked = !!persisted[a.id] || inThisRun;
                const hidden = a.hidden && !everUnlocked;
                return (
                  <div
                    key={a.id}
                    className={`p-3 border ${
                      inThisRun
                        ? 'border-amber-500/60 bg-amber-500/10'
                        : everUnlocked
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-[#1e293b] bg-[#0a0e17]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {everUnlocked ? (
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 ${inThisRun ? 'text-amber-400' : 'text-emerald-400'}`} />
                      ) : (
                        <Lock className="w-4 h-4 mt-0.5 text-slate-600" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold ${everUnlocked ? 'text-white' : 'text-slate-500'}`}>
                          {hidden ? '???' : a.name}
                        </div>
                        <div className={`text-xs mt-0.5 ${everUnlocked ? 'text-slate-400' : 'text-slate-600'}`}>
                          {hidden ? '（隐藏成就：达成条件后揭示）' : a.description}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
