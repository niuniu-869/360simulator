// 认知等级提升庆祝弹窗 — 华丽粒子动效

import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { COGNITION_LEVELS, PANEL_UNLOCK_CONFIG } from '@/data/cognitionData';
import type { CognitionLevel, PanelId } from '@/types/game';

interface CognitionLevelUpDialogProps {
  fromLevel: CognitionLevel;
  toLevel: CognitionLevel;
  onClose: () => void;
}

// 面板中文名映射
const PANEL_NAMES: Record<PanelId, string> = {
  operating: '经营面板',
  staff: '人员面板',
  inventory: '库存管理',
  marketing: '营销活动',
  finance: '财务看板',
  supplydemand: '供需分析',
};

// 每个等级解锁的信息可见性描述
const INFO_UNLOCKS: Record<number, string[]> = {
  1: ['日现金余额', '竞争对手数量（模糊）', '员工工时概况'],
  2: ['选品销量明细', '变动成本数据', '区位评分', '盈亏平衡点（模糊）'],
  3: ['周收入/月收入精确值', '毛利率/净利润', '员工士气与疲劳', '固定成本'],
  4: ['财务数据高精度（±10%）', '供需分析面板', '深度数据洞察'],
  5: ['所有数据精确显示', '认知减免率35%', '快招识别率95%'],
};

// 生成随机粒子配置
function generateParticles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 2,
    duration: 1.5 + Math.random() * 2,
    color: ['#f59e0b', '#fbbf24', '#fcd34d', '#ef4444', '#8b5cf6', '#06b6d4'][
      Math.floor(Math.random() * 6)
    ],
  }));
}

export function CognitionLevelUpDialog({
  fromLevel,
  toLevel,
  onClose,
}: CognitionLevelUpDialogProps) {
  const [phase, setPhase] = useState<'enter' | 'reveal' | 'details'>('enter');
  const toLevelConfig = COGNITION_LEVELS.find(l => l.level === toLevel);
  const fromLevelConfig = COGNITION_LEVELS.find(l => l.level === fromLevel);
  const particles = useMemo(() => generateParticles(30), []);

  // 收集本次升级解锁的面板
  const unlockedPanels = useMemo(() => {
    const panels: string[] = [];
    for (let lv = fromLevel + 1; lv <= toLevel; lv++) {
      (Object.entries(PANEL_UNLOCK_CONFIG) as [PanelId, number][])
        .filter(([, unlockLv]) => unlockLv === lv)
        .forEach(([id]) => panels.push(PANEL_NAMES[id]));
    }
    return panels;
  }, [fromLevel, toLevel]);

  // 收集本次升级解锁的信息可见性
  const unlockedInfo = useMemo(() => {
    const info: string[] = [];
    for (let lv = fromLevel + 1; lv <= toLevel; lv++) {
      if (INFO_UNLOCKS[lv]) info.push(...INFO_UNLOCKS[lv]);
    }
    return info;
  }, [fromLevel, toLevel]);

  // 动画阶段推进
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('reveal'), 600);
    const t2 = setTimeout(() => setPhase('details'), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!toLevelConfig || !fromLevelConfig) return null;

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent
        className="bg-transparent border-none shadow-none max-w-md p-0 overflow-visible"
        // 阻止点击遮罩关闭（让用户看完动画）
        onPointerDownOutside={e => e.preventDefault()}
      >
        {/* 全屏粒子层 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          {particles.map(p => (
            <span
              key={p.id}
              className="absolute rounded-full animate-levelup-particle"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
        </div>

        {/* 主卡片 */}
        <div className="relative bg-[#0d1321]/95 border border-amber-500/30 rounded-xl overflow-hidden backdrop-blur-sm">
          {/* 顶部光晕 */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-30 animate-levelup-glow"
            style={{
              background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
            }}
            aria-hidden
          />

          <div className="relative px-8 pt-10 pb-8 text-center">
            {/* 等级图标 */}
            <div className="relative inline-block mb-4">
              {/* 光环 */}
              <div
                className="absolute inset-0 -m-4 rounded-full animate-levelup-ring"
                style={{
                  background: 'conic-gradient(from 0deg, #f59e0b, #ef4444, #8b5cf6, #06b6d4, #f59e0b)',
                  opacity: phase !== 'enter' ? 0.6 : 0,
                  transition: 'opacity 0.5s',
                }}
                aria-hidden
              />
              <div
                className={`
                  relative text-7xl transition-all duration-700 ease-out
                  ${phase === 'enter' ? 'scale-50 opacity-0' : 'scale-100 opacity-100'}
                  ${phase === 'details' ? 'animate-levelup-bounce' : ''}
                `}
              >
                {toLevelConfig.icon}
              </div>
            </div>

            {/* 升级标题 */}
            <div
              className={`
                transition-all duration-500 delay-300
                ${phase === 'enter' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
              `}
            >
              <p className="text-amber-500/80 text-xs tracking-widest uppercase mb-1">
                Cognition Level Up
              </p>
              <h2 className="text-2xl font-bold text-white mb-1">
                认知觉醒！
              </h2>
              <div className="flex items-center justify-center gap-3 text-lg">
                <span className="text-slate-500">
                  {fromLevelConfig.icon} Lv.{fromLevel}
                </span>
                <span className="text-amber-400 animate-pulse">→</span>
                <span className="text-amber-400 font-bold">
                  {toLevelConfig.icon} Lv.{toLevel}
                </span>
              </div>
            </div>

            {/* 新等级信息 */}
            <div
              className={`
                mt-5 transition-all duration-500 delay-500
                ${phase !== 'details' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
              `}
            >
              <div className="inline-block px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                <p className="text-amber-400 font-bold text-lg">
                  「{toLevelConfig.title}」{toLevelConfig.name}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  {toLevelConfig.description}
                </p>
              </div>

              {/* 解锁内容 */}
              {(unlockedPanels.length > 0 || unlockedInfo.length > 0) && (
                <div className="text-left space-y-3 mt-4">
                  {unlockedPanels.length > 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                      <p className="text-emerald-400 text-xs font-bold mb-2 flex items-center gap-1">
                        <span>🔓</span> 新面板解锁
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {unlockedPanels.map(name => (
                          <span
                            key={name}
                            className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {unlockedInfo.length > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <p className="text-blue-400 text-xs font-bold mb-2 flex items-center gap-1">
                        <span>👁</span> 信息视野提升
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {unlockedInfo.map(info => (
                          <span
                            key={info}
                            className="text-[11px] px-1.5 py-0.5 bg-blue-500/15 text-blue-300 rounded"
                          >
                            {info}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 关闭按钮 */}
            <button
              className={`
                mt-6 px-10 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600
                hover:from-amber-500 hover:to-orange-500
                text-white font-bold rounded-lg transition-all duration-300
                ${phase !== 'details' ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}
              `}
              onClick={onClose}
            >
              继续前进
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CognitionLevelUpDialog;
