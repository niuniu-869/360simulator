/**
 * CommandPalette.tsx — Cmd+K 全局搜索（Phase 5）
 *
 * 使用 cmdk 实现，支持搜：
 *   - Tabs（经营/人员/库存/营销/财务/供需）
 *   - 快捷动作（推下一周 / 自动推 +5 / +13）
 *   - 员工列表（按名字）
 *   - 产品列表（按名字）
 */

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import type { GameState } from '@/types/game';
import { Search, ArrowRight, Play, FastForward, Users, Package, Megaphone, Calculator, TrendingUp } from 'lucide-react';

interface CommandPaletteProps {
  gameState: GameState;
  onJumpTab: (tabId: string) => void;
  onNextWeek: () => void;
  onAutoAdvance?: (weeks: number) => void;
}

const TAB_ITEMS = [
  { id: 'operating', label: '经营', icon: Play, keys: ['operating', '经营', 'op'] },
  { id: 'staff', label: '人员', icon: Users, keys: ['staff', '人员', 'team'] },
  { id: 'inventory', label: '库存', icon: Package, keys: ['inventory', '库存', 'stock'] },
  { id: 'marketing', label: '营销', icon: Megaphone, keys: ['marketing', '营销', '推广'] },
  { id: 'finance', label: '财务', icon: Calculator, keys: ['finance', '财务', '钱'] },
  { id: 'supplydemand', label: '供需', icon: TrendingUp, keys: ['supply', '供需', 'demand'] },
];

export function CommandPalette({ gameState, onJumpTab, onNextWeek, onAutoAdvance }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);

  const runJump = (tabId: string) => { onJumpTab(tabId); close(); };
  const runNextWeek = () => { onNextWeek(); close(); };
  const runAutoAdvance = (n: number) => { onAutoAdvance?.(n); close(); };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
      onClick={close}
    >
      <div
        className="bg-[#0a0e17] border border-[#1e293b] w-[640px] max-w-[90vw] max-h-[60vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e293b]">
            <Search className="w-4 h-4 text-slate-500" />
            <Command.Input
              placeholder="搜索 Tab / 动作 / 员工 / 产品…"
              className="flex-1 bg-transparent outline-none text-sm text-slate-200 placeholder:text-slate-600"
            />
            <span className="text-[10px] text-slate-600 font-mono">Esc 关闭</span>
          </div>
          <Command.List className="overflow-y-auto p-2 max-h-[50vh]">
            <Command.Empty className="text-center text-xs text-slate-500 py-6">无匹配结果</Command.Empty>

            <Command.Group heading="切换 Tab" className="text-[10px] text-slate-500 px-1 py-1">
              {TAB_ITEMS.map((it) => {
                const Icon = it.icon;
                return (
                  <Command.Item
                    key={it.id}
                    value={`${it.label} ${it.keys.join(' ')}`}
                    onSelect={() => runJump(it.id)}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-200 cursor-pointer rounded data-[selected=true]:bg-amber-500/15 data-[selected=true]:text-amber-200"
                  >
                    <Icon className="w-4 h-4 text-amber-400" />
                    <span>切到 {it.label}</span>
                    <ArrowRight className="w-3 h-3 ml-auto text-slate-500" />
                  </Command.Item>
                );
              })}
            </Command.Group>

            {gameState.gamePhase === 'operating' && (
              <Command.Group heading="动作" className="text-[10px] text-slate-500 px-1 py-1 mt-2">
                <Command.Item
                  value="next week 下一周 推周 space"
                  onSelect={runNextWeek}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-200 cursor-pointer rounded data-[selected=true]:bg-amber-500/15"
                >
                  <Play className="w-4 h-4 text-emerald-400" />
                  <span>推进下一周</span>
                  <span className="ml-auto text-[10px] text-slate-500 font-mono">Space</span>
                </Command.Item>
                {onAutoAdvance && (
                  <>
                    <Command.Item
                      value="auto 自动 +5 五周"
                      onSelect={() => runAutoAdvance(5)}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-200 cursor-pointer rounded data-[selected=true]:bg-amber-500/15"
                    >
                      <FastForward className="w-4 h-4 text-orange-400" />
                      <span>自动推进 +5 周</span>
                    </Command.Item>
                    <Command.Item
                      value="auto 自动 +13 季度 quarter"
                      onSelect={() => runAutoAdvance(13)}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-200 cursor-pointer rounded data-[selected=true]:bg-amber-500/15"
                    >
                      <FastForward className="w-4 h-4 text-orange-400" />
                      <span>自动推进 +13 周（一季度）</span>
                    </Command.Item>
                  </>
                )}
              </Command.Group>
            )}

            {gameState.staff.length > 0 && (
              <Command.Group heading="员工" className="text-[10px] text-slate-500 px-1 py-1 mt-2">
                {gameState.staff.map((s) => (
                  <Command.Item
                    key={s.id}
                    value={`员工 ${s.name} ${s.assignedTask} ${s.typeId}`}
                    onSelect={() => runJump('staff')}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-200 cursor-pointer rounded data-[selected=true]:bg-amber-500/15"
                  >
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>{s.name}</span>
                    <span className="text-[10px] text-slate-500 ml-1">{s.assignedTask}</span>
                    <ArrowRight className="w-3 h-3 ml-auto text-slate-500" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {gameState.selectedProducts.length > 0 && (
              <Command.Group heading="产品" className="text-[10px] text-slate-500 px-1 py-1 mt-2">
                {gameState.selectedProducts.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`产品 ${p.name} ${p.id}`}
                    onSelect={() => runJump('operating')}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-200 cursor-pointer rounded data-[selected=true]:bg-amber-500/15"
                  >
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span>{p.name}</span>
                    <span className="text-[10px] text-slate-500 ml-1 font-mono">¥{gameState.productPrices[p.id] ?? p.basePrice}</span>
                    <ArrowRight className="w-3 h-3 ml-auto text-slate-500" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
