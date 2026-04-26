/**
 * TodaysTaskBar.tsx — 今日待办栏（Phase 5）
 *
 * 在 GameHeader 下方常驻，列出本周必须处理的事项，每条带"立即处理"跳转。
 *
 * 紧急事项类别：
 *   - pending_event   交互事件待响应
 *   - cash_alert      现金告警
 *   - low_inventory   库存告警（任何商品 stockoutEffect 命中）
 *   - staff_quit      有员工想离职
 *   - marketing_expiry 一次性活动到期
 *   - bankruptcy_warn 破产警告
 */

import { useMemo } from 'react';
import type { GameState } from '@/types/game';
import { AlertTriangle, BellRing, Package, Users, Megaphone, Skull, Target } from 'lucide-react';

interface TaskItem {
  id: string;
  severity: 'info' | 'warn' | 'crit';
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  detail?: string;
  onJump?: () => void;
  jumpLabel?: string;
}

interface TodaysTaskBarProps {
  gameState: GameState;
  onJumpTab?: (tabId: string) => void;
}

export function TodaysTaskBar({ gameState, onJumpTab }: TodaysTaskBarProps) {
  const tasks = useMemo<TaskItem[]>(() => {
    const list: TaskItem[] = [];
    if (gameState.gamePhase !== 'operating') return list;

    if (gameState.monthlyObjective) {
      const obj = gameState.monthlyObjective;
      const progress = obj.unit === 'money'
        ? `¥${Math.round(obj.currentValue).toLocaleString()} / ¥${Math.round(obj.targetValue).toLocaleString()}`
        : obj.unit === 'percent'
          ? `${Math.round(obj.currentValue * 100)}% / ${Math.round(obj.targetValue * 100)}%`
          : `${Math.round(obj.currentValue)} / ${Math.round(obj.targetValue)}`;
      list.push({
        id: 'monthly_objective',
        severity: 'info',
        icon: Target,
        text: `月目标：${obj.title}`,
        detail: `${progress}，第 ${obj.startWeek}-${obj.endWeek} 周`,
      });
    }

    if (gameState.pendingInteractiveEvent) {
      list.push({
        id: 'pending_event',
        severity: 'crit',
        icon: BellRing,
        text: `事件待响应：${gameState.pendingInteractiveEvent.name}`,
        detail: '点击下方"事件"弹窗做出选择',
      });
    }

    const fixed = gameState.weeklyFixedCost || 1;
    const runway = gameState.cash / fixed;
    if (gameState.crisisMode === 'bankruptcy_warning') {
      list.push({
        id: 'bankruptcy_warn',
        severity: 'crit',
        icon: Skull,
        text: '破产警告：连亏过多 + 现金不足',
        detail: `runway ≈ ${runway.toFixed(1)} 周`,
      });
    } else if (runway < 3) {
      list.push({
        id: 'cash_alert',
        severity: 'warn',
        icon: AlertTriangle,
        text: '现金告急',
        detail: `runway ≈ ${runway.toFixed(1)} 周（< 3）`,
      });
    }

    const wantQuit = gameState.staff.filter((s) => s.wantsToQuit);
    if (wantQuit.length > 0) {
      list.push({
        id: 'staff_quit',
        severity: 'warn',
        icon: Users,
        text: `${wantQuit.length} 名员工想离职`,
        detail: wantQuit.map((s) => s.name).join('、'),
        onJump: () => onJumpTab?.('staff'),
        jumpLabel: '处理',
      });
    }

    const lowInv = (gameState.inventoryState?.items || []).filter(
      (i) => i.quantity <= 0 || (i.lastWeekSales > 0 && i.quantity / Math.max(1, i.lastWeekSales) < 1),
    );
    if (lowInv.length > 0) {
      list.push({
        id: 'low_inventory',
        severity: 'warn',
        icon: Package,
        text: `${lowInv.length} 项库存告警`,
        detail: lowInv.map((i) => i.name).join('、'),
        onJump: () => onJumpTab?.('inventory'),
        jumpLabel: '查看',
      });
    }

    const expiringMkt = (gameState.activeMarketingActivities || []).filter(
      (a) => a.activeWeeks >= 6,
    );
    if (expiringMkt.length > 0) {
      list.push({
        id: 'marketing_expiry',
        severity: 'info',
        icon: Megaphone,
        text: `${expiringMkt.length} 个营销活动运行已久`,
        detail: '考虑停止或更换以避免效果衰减',
        onJump: () => onJumpTab?.('marketing'),
        jumpLabel: '管理',
      });
    }

    return list;
  }, [gameState, onJumpTab]);

  if (tasks.length === 0) return null;

  return (
    <div className="sticky top-[64px] z-40 bg-[#0a0e17]/95 backdrop-blur-sm border-b border-[#1e293b]">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap gap-2">
        {tasks.map((t) => {
          const Icon = t.icon;
          const sevClass =
            t.severity === 'crit'
              ? 'border-red-500/50 text-red-300 bg-red-500/10'
              : t.severity === 'warn'
                ? 'border-amber-500/50 text-amber-300 bg-amber-500/10'
                : 'border-blue-500/40 text-blue-300 bg-blue-500/10';
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-3 py-1.5 border text-xs ${sevClass}`}
              title={t.detail}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium">{t.text}</span>
              {t.detail && (
                <span className="text-slate-400 text-[10px] hidden md:inline">— {t.detail}</span>
              )}
              {t.onJump && (
                <button
                  className="ml-1 px-2 py-0.5 border border-current/40 text-[10px] hover:bg-current/10 transition-colors"
                  onClick={t.onJump}
                >
                  {t.jumpLabel || '处理'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
