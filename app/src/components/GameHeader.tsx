import type { GameState, CognitionLevel } from '@/types/game';
import { fuzzOperatingRevenue, fuzzOperatingProfit } from '@/lib/fuzzUtils';
import { WIN_STREAK } from '@/lib/gameEngine';
import { Wallet, TrendingUp, TrendingDown, Users, Star, Flame } from 'lucide-react';

interface GameHeaderProps {
  gameState: GameState;
  cognitionLevel: CognitionLevel;
  currentStats: {
    revenue: number;
    variableCost: number;
    fixedCost: number;
    profit: number;
    margin: number;
    breakEvenPoint: number;
  };
  onOpenCyberYongGe?: () => void;
}

export function GameHeader({ gameState, cognitionLevel, currentStats, onOpenCyberYongGe }: GameHeaderProps) {
  const formatMoney = (amount: number) => {
    if (amount >= 10000) {
      return `¥${(amount / 10000).toFixed(1)}万`;
    }
    return `¥${Math.round(amount).toLocaleString()}`;
  };

  const runwayWeeks = currentStats.fixedCost > 0 ? gameState.cash / currentStats.fixedCost : Infinity;
  const runwayLabel = Number.isFinite(runwayWeeks) ? runwayWeeks : null;
  const runwayText = runwayLabel == null
    ? '—'
    : runwayLabel >= 20 ? '20+周'
      : `${Math.max(0, Math.floor(runwayLabel))}周`;

  return (
    <header className="sticky top-0 z-50 bg-[#0a0e17]/95 backdrop-blur-sm border-b border-[#1e293b]">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* 左侧：游戏标题和阶段 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">360°</span>
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-wider">转一圈模拟器</h1>
                <p className="text-xs text-slate-400">
                  {gameState.gamePhase === 'setup' && '筹备阶段'}
                  {gameState.gamePhase === 'operating' && `第 ${gameState.currentWeek}/${gameState.totalWeeks} 周 · 连续盈利 ${gameState.consecutiveProfits || 0}/${WIN_STREAK} 周 · 回本 ${gameState.totalInvestment > 0 ? Math.min(999, Math.round(((gameState.cumulativeProfit || 0) / gameState.totalInvestment) * 100)) : 0}%`}
                  {gameState.gamePhase === 'ended' && (gameState.gameOverReason === 'win' ? '达标：挑战成功' : gameState.gameOverReason === 'bankrupt' ? '破产' : '时间截止：未达标')}
                </p>
              </div>
            </div>
          </div>

          {/* 中间：核心财务数据 */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-orange-500" />
              <div>
                <p className="text-xs text-slate-400">现金</p>
                <p className={`text-sm font-mono font-bold ${gameState.cash >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatMoney(gameState.cash)}
                </p>
              </div>
            </div>
            
            {gameState.gamePhase === 'operating' && (
              <>
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-400">现金跑道</p>
                    <p className={`text-sm font-mono font-bold ${
                      runwayLabel != null && runwayLabel < 3 ? 'text-red-400'
                        : runwayLabel != null && runwayLabel < 6 ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}>
                      {runwayText}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <div>
                    <p className="text-xs text-slate-400">周收入</p>
                    <p className="text-sm font-mono font-bold text-emerald-400">
                      {fuzzOperatingRevenue(currentStats.revenue, cognitionLevel).display}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentStats.profit >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <div>
                    <p className="text-xs text-slate-400">周利润</p>
                    <p className={`text-sm font-mono font-bold ${currentStats.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fuzzOperatingProfit(currentStats.profit, cognitionLevel).display}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-xs text-slate-400">口碑</p>
                    <p className="text-sm font-mono font-bold text-amber-400">
                      {cognitionLevel === 0
                        ? '—'
                        : cognitionLevel === 1
                          ? (gameState.reputation >= 70 ? '不错' : gameState.reputation >= 40 ? '还行' : '很差')
                          : Math.round(gameState.reputation)}
                    </p>
                  </div>
                </div>
              </>
            )}
            
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-xs text-slate-400">员工</p>
                <p className="text-sm font-mono font-bold text-blue-400">
                  {gameState.staff.length}人
                </p>
              </div>
            </div>
          </div>

          {/* 右侧：咨询勇哥（唯一入口） */}
          <div className="flex items-center gap-2">
            {gameState.gamePhase === 'operating' && onOpenCyberYongGe && (
              <button
                className="flex items-center gap-2 text-sm px-4 py-2 bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30 transition-colors rounded-md font-medium"
                onClick={onOpenCyberYongGe}
              >
                <Flame className="w-4 h-4" />
                咨询勇哥
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
