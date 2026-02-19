import type { GameState, CognitionLevel } from '@/types/game';
import { TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon, BarChart3, AlertCircle, Lock, Eye, Target, Flame } from 'lucide-react';
import { INFO_FUZZ_CONFIG } from '@/data/cognitionData';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine,
  LineChart, Line, PieChart, Pie,
  AreaChart, Area,
} from 'recharts';
import { WIN_STREAK } from '@/lib/gameEngine';

// 信息模糊化工具函数
type FuzzResult = {
  display: string;
  isHidden: boolean;
  isFuzzy: boolean;
};

function applyFuzz(
  infoType: string,
  value: number,
  cognitionLevel: CognitionLevel,
  formatFn: (v: number) => string
): FuzzResult {
  const config = INFO_FUZZ_CONFIG.find(c => c.infoType === infoType);
  if (!config) {
    return { display: formatFn(value), isHidden: false, isFuzzy: false };
  }

  const fuzzLevel = config.fuzzLevels.find(f => f.level === cognitionLevel);
  if (!fuzzLevel) {
    return { display: formatFn(value), isHidden: false, isFuzzy: false };
  }

  switch (fuzzLevel.type) {
    case 'hidden':
      return { display: '???', isHidden: true, isFuzzy: false };
    case 'fuzzy':
      {
        const words = fuzzLevel.fuzzyWords || ['未知'];
        let wordIndex = 0;
        if (value > 0) wordIndex = 0;
        else if (value < 0) wordIndex = Math.min(2, words.length - 1);
        else wordIndex = Math.min(1, words.length - 1);
        return { display: words[wordIndex], isHidden: false, isFuzzy: true };
      }
    case 'range':
      {
        const minRatio = fuzzLevel.minRatio || 0.8;
        const maxRatio = fuzzLevel.maxRatio || 1.2;
        const minVal = value * minRatio;
        const maxVal = value * maxRatio;
        return {
          display: `${formatFn(minVal)} ~ ${formatFn(maxVal)}`,
          isHidden: false,
          isFuzzy: true
        };
      }
    case 'exact':
    default:
      return { display: formatFn(value), isHidden: false, isFuzzy: false };
  }
}

interface FixedCostBreakdown {
  rent: number;
  salary: number;
  utilities: number;
  marketing: number;
  depreciation: number;
  promotion: number;
  total: number;
}

interface FinanceDashboardProps {
  gameState: GameState;
  currentStats: {
    revenue: number;
    variableCost: number;
    fixedCost: number;
    fixedCostBreakdown: FixedCostBreakdown;
    profit: number;
    margin: number;
    breakEvenPoint: number;
  };
}

// Recharts 通用样式
const TOOLTIP_STYLE = { background: '#0a0e17', border: '1px solid #1e293b', borderRadius: 0, fontSize: 12 };
const AXIS_TICK = { fill: '#64748b', fontSize: 11 };
const AXIS_LINE = { stroke: '#1e293b' };

const formatMoney = (amount: number) => {
  if (amount >= 10000 || amount <= -10000) {
    return `¥${(amount / 10000).toFixed(1)}万`;
  }
  return `¥${Math.round(amount).toLocaleString()}`;
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

// 饼图颜色
const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6'];

export function FinanceDashboard({ gameState, currentStats }: FinanceDashboardProps) {
  const cognitionLevel = (gameState.cognition?.level || 0) as CognitionLevel;

  // 应用模糊化到各项数据
  const revenueFuzz = applyFuzz('weeklyRevenue', currentStats.revenue, cognitionLevel, formatMoney);
  const profitFuzz = applyFuzz('netProfit', currentStats.profit, cognitionLevel, formatMoney);
  const marginFuzz = applyFuzz('grossMargin', currentStats.margin, cognitionLevel, formatPercent);
  const breakEvenFuzz = applyFuzz('breakEvenPoint', currentStats.breakEvenPoint, cognitionLevel, formatMoney);
  const variableCostFuzz = applyFuzz('variableCost', currentStats.variableCost, cognitionLevel, formatMoney);
  const fixedCostFuzz = applyFuzz('fixedCost', currentStats.fixedCost, cognitionLevel, formatMoney);

  // 计算各项占比
  const variableCostRatio = currentStats.revenue > 0 ? (currentStats.variableCost / currentStats.revenue) * 100 : 0;
  const fixedCostRatio = currentStats.revenue > 0 ? (currentStats.fixedCost / currentStats.revenue) * 100 : 0;
  const profitRatio = currentStats.revenue > 0 ? (currentStats.profit / currentStats.revenue) * 100 : 0;

  // 盈亏平衡：检测 Infinity / NaN
  const isBreakEvenInvalid = !isFinite(currentStats.breakEvenPoint) || currentStats.margin <= 0;
  const breakEvenDays = (!isBreakEvenInvalid && currentStats.revenue > 0)
    ? (currentStats.breakEvenPoint / currentStats.revenue) * 30
    : Infinity;

  // 回本进度
  const returnProgress = gameState.totalInvestment > 0
    ? Math.min(100, Math.max(0, (gameState.cumulativeProfit / gameState.totalInvestment) * 100))
    : 0;

  // 历史数据（Recharts 格式）
  const profitChartData = gameState.profitHistory.map((profit, i) => ({ week: `${i + 1}`, profit }));

  const trendChartData = (gameState.revenueHistory || []).map((rev, i) => ({
    week: `${i + 1}`,
    revenue: rev,
    cost: rev - (gameState.profitHistory[i] ?? 0),
    profit: gameState.profitHistory[i] ?? 0,
  }));

  const cashChartData = (gameState.cashHistory || []).map((cash, i) => ({
    week: `${i + 1}`,
    cash,
  }));

  // 成本结构饼图数据
  const costPieData = [
    { name: '变动成本', value: currentStats.variableCost },
    { name: '租金', value: currentStats.fixedCostBreakdown.rent },
    { name: '人工', value: currentStats.fixedCostBreakdown.salary },
    { name: '水电杂费', value: currentStats.fixedCostBreakdown.utilities + currentStats.fixedCostBreakdown.marketing },
    { name: '设备折旧', value: currentStats.fixedCostBreakdown.depreciation },
    { name: '外卖推广', value: currentStats.fixedCostBreakdown.promotion },
  ].filter(d => d.value > 0);
  const totalCost = costPieData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="ark-title">财务看板</h2>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="ark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-slate-400">周收入</span>
            {revenueFuzz.isFuzzy && <Eye className="w-3 h-3 text-amber-500" />}
            {revenueFuzz.isHidden && <Lock className="w-3 h-3 text-slate-500" />}
          </div>
          <p className={`text-2xl font-mono font-bold ${revenueFuzz.isHidden ? 'text-slate-500' : 'text-emerald-400'}`}>
            {revenueFuzz.display}
          </p>
        </div>

        <div className="ark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-400">变动成本</span>
            {variableCostFuzz.isFuzzy && <Eye className="w-3 h-3 text-amber-500" />}
            {variableCostFuzz.isHidden && <Lock className="w-3 h-3 text-slate-500" />}
          </div>
          <p className={`text-2xl font-mono font-bold ${variableCostFuzz.isHidden ? 'text-slate-500' : 'text-red-400'}`}>
            {variableCostFuzz.display}
          </p>
          {!variableCostFuzz.isHidden && (
            <p className="text-xs text-slate-500">{variableCostRatio.toFixed(1)}% of 收入</p>
          )}
        </div>

        <div className="ark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <PieChartIcon className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-slate-400">固定成本</span>
            {fixedCostFuzz.isFuzzy && <Eye className="w-3 h-3 text-amber-500" />}
            {fixedCostFuzz.isHidden && <Lock className="w-3 h-3 text-slate-500" />}
          </div>
          <p className={`text-2xl font-mono font-bold ${fixedCostFuzz.isHidden ? 'text-slate-500' : 'text-orange-400'}`}>
            {fixedCostFuzz.display}
          </p>
          {!fixedCostFuzz.isHidden && (
            <p className="text-xs text-slate-500">{fixedCostRatio.toFixed(1)}% of 收入</p>
          )}
        </div>

        <div className="ark-card p-4">
          <div className="flex items-center gap-2 mb-2">
            {currentStats.profit >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs text-slate-400">周利润</span>
            {profitFuzz.isFuzzy && <Eye className="w-3 h-3 text-amber-500" />}
            {profitFuzz.isHidden && <Lock className="w-3 h-3 text-slate-500" />}
          </div>
          <p className={`text-2xl font-mono font-bold ${
            profitFuzz.isHidden ? 'text-slate-500' :
            currentStats.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {profitFuzz.display}
          </p>
          {!profitFuzz.isHidden && (
            <p className={`text-xs ${currentStats.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {profitRatio.toFixed(1)}% 利润率
            </p>
          )}
        </div>
      </div>

      {/* 回本进度 & 连续盈利 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="ark-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-bold text-white">回本进度</span>
            <span className="ml-auto text-sm font-mono text-blue-400">{returnProgress.toFixed(0)}%</span>
          </div>
          <div className="h-3 bg-[#0a0e17] border border-[#1e293b] overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${returnProgress}%`,
                background: returnProgress >= 100
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : returnProgress >= 50
                    ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                    : 'linear-gradient(90deg, #f97316, #fb923c)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-slate-500">
            <span>累计利润 {formatMoney(gameState.cumulativeProfit)}</span>
            <span>总投资 {formatMoney(gameState.totalInvestment)}</span>
          </div>
        </div>

        <div className="ark-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-bold text-white">连续盈利</span>
            <span className="ml-auto text-sm font-mono text-orange-400">
              {gameState.consecutiveProfits || 0} / {WIN_STREAK} 周
            </span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: WIN_STREAK }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-3 border ${
                  i < (gameState.consecutiveProfits || 0)
                    ? 'bg-emerald-500/70 border-emerald-500/50'
                    : 'bg-[#0a0e17] border-[#1e293b]'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {(gameState.consecutiveProfits || 0) >= WIN_STREAK
              ? '已达标 ✓'
              : `还需连续盈利 ${WIN_STREAK - (gameState.consecutiveProfits || 0)} 周`}
          </p>
        </div>
      </div>

      {/* 成本结构饼图 & 盈亏平衡分析 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 成本结构饼图 */}
        <div className="ark-card p-5">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-orange-500" />
            成本结构分析
          </h3>
          {totalCost > 0 && !fixedCostFuzz.isHidden ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={costPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={65}
                    dataKey="value"
                    stroke="#0a0e17"
                    strokeWidth={2}
                  >
                    {costPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.75} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [formatMoney(value), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {costPieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5" style={{ background: PIE_COLORS[i % PIE_COLORS.length], opacity: 0.75 }} />
                      <span className="text-slate-400">{d.name}</span>
                    </div>
                    <span className="font-mono text-slate-300">
                      {formatMoney(d.value)}
                      <span className="text-slate-500 ml-1">({(d.value / totalCost * 100).toFixed(0)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">暂无成本数据</p>
          )}
        </div>

        {/* 盈亏平衡分析 */}
        <div className="ark-card p-5">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            盈亏平衡分析
          </h3>
          <div className="space-y-4">
            <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-slate-400">毛利率</p>
                {marginFuzz.isFuzzy && <Eye className="w-3 h-3 text-amber-500" />}
                {marginFuzz.isHidden && <Lock className="w-3 h-3 text-slate-500" />}
              </div>
              <p className={`text-3xl font-mono font-bold ${marginFuzz.isHidden ? 'text-slate-500' : 'text-orange-400'}`}>
                {marginFuzz.display}
              </p>
              {!marginFuzz.isHidden && (
                <p className="text-xs text-slate-500">
                  每卖100元，毛利{currentStats.margin.toFixed(0)}元
                </p>
              )}
            </div>

            <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-slate-400">盈亏平衡收入</p>
                {breakEvenFuzz.isFuzzy && <Eye className="w-3 h-3 text-amber-500" />}
                {breakEvenFuzz.isHidden && <Lock className="w-3 h-3 text-slate-500" />}
              </div>
              {isBreakEvenInvalid && !breakEvenFuzz.isHidden ? (
                <>
                  <p className="text-2xl font-bold text-red-400">无法保本</p>
                  <p className="text-xs text-red-400/70">
                    当前毛利率{currentStats.margin <= 0 ? '为负' : '过低'}，无法覆盖固定成本
                  </p>
                </>
              ) : (
                <>
                  <p className={`text-3xl font-mono font-bold ${breakEvenFuzz.isHidden ? 'text-slate-500' : 'text-blue-400'}`}>
                    {breakEvenFuzz.display}
                  </p>
                  {!breakEvenFuzz.isHidden && (
                    <p className="text-xs text-slate-500">每周需达到此收入才能保本</p>
                  )}
                </>
              )}
            </div>

            <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
              <p className="text-xs text-slate-400 mb-1">盈亏平衡天数</p>
              {isBreakEvenInvalid ? (
                <>
                  <p className="text-3xl font-mono font-bold text-red-400">∞</p>
                  <p className="text-xs text-red-400/70">需先提升毛利率至正值</p>
                </>
              ) : (
                <>
                  <p className={`text-3xl font-mono font-bold ${breakEvenDays <= 20 ? 'text-emerald-400' : breakEvenDays <= 25 ? 'text-amber-400' : 'text-red-400'}`}>
                    {breakEvenDays.toFixed(1)}天
                  </p>
                  <p className="text-xs text-slate-500">
                    每月需{breakEvenDays.toFixed(0)}天达到盈亏平衡
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 历史利润柱状图 (Recharts) */}
      {profitChartData.length > 0 && (
        <div className="ark-card p-5">
          <h3 className="font-bold text-white mb-4">历史利润</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={profitChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis dataKey="week" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis
                tick={AXIS_TICK} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => v >= 10000 || v <= -10000 ? `${(v / 10000).toFixed(1)}万` : `${v}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(label: string) => `第${label}周`}
                formatter={(value: number) => [formatMoney(value), '利润']}
              />
              <ReferenceLine y={0} stroke="#1e293b" />
              <Bar dataKey="profit" radius={[2, 2, 0, 0]}>
                {gameState.profitHistory.map((profit, i) => (
                  <Cell key={i} fill={profit >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 收入 / 成本 / 利润趋势 */}
      {trendChartData.length > 1 && (
        <div className="ark-card p-5">
          <h3 className="font-bold text-white mb-4">收入 · 成本 · 利润趋势</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis
                tick={AXIS_TICK} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => v >= 10000 || v <= -10000 ? `${(v / 10000).toFixed(1)}万` : `${v}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(label: string) => `第${label}周`}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = { revenue: '收入', cost: '总成本', profit: '利润' };
                  return [formatMoney(value), labels[name] || name];
                }}
              />
              <ReferenceLine y={0} stroke="#1e293b" />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#gradRevenue)" strokeWidth={2} />
              <Area type="monotone" dataKey="cost" stroke="#ef4444" fill="url(#gradCost)" strokeWidth={1.5} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block" /> 收入</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block opacity-70" style={{ borderTop: '1px dashed #ef4444' }} /> 总成本</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> 利润</span>
          </div>
        </div>
      )}

      {/* 现金余额趋势 */}
      {cashChartData.length > 1 && (
        <div className="ark-card p-5">
          <h3 className="font-bold text-white mb-4">现金余额趋势</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={cashChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis dataKey="week" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis
                tick={AXIS_TICK} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => v >= 10000 || v <= -10000 ? `${(v / 10000).toFixed(1)}万` : `${v}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(label: string) => `第${label}周末`}
                formatter={(value: number) => [formatMoney(value), '现金余额']}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line type="monotone" dataKey="cash" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 财务健康度评估 */}
      <div className="ark-card p-5">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          财务健康度评估
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-[#0a0e17] border border-[#1e293b]">
            <p className="text-xs text-slate-400 mb-1">毛利率</p>
            <p className={`text-lg font-mono font-bold ${currentStats.margin >= 50 ? 'text-emerald-400' : currentStats.margin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
              {currentStats.margin >= 50 ? '健康' : currentStats.margin >= 30 ? '一般' : '危险'}
            </p>
            <p className="text-xs text-slate-500">{currentStats.margin.toFixed(0)}%</p>
          </div>
          <div className="text-center p-3 bg-[#0a0e17] border border-[#1e293b]">
            <p className="text-xs text-slate-400 mb-1">人工占比</p>
            {currentStats.revenue > 0 ? (
              <p className={`text-lg font-mono font-bold ${
                (currentStats.fixedCostBreakdown.salary / currentStats.revenue) <= 0.2 ? 'text-emerald-400' :
                (currentStats.fixedCostBreakdown.salary / currentStats.revenue) <= 0.3 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {(currentStats.fixedCostBreakdown.salary / currentStats.revenue) <= 0.2 ? '健康' :
                 (currentStats.fixedCostBreakdown.salary / currentStats.revenue) <= 0.3 ? '一般' : '危险'}
              </p>
            ) : (
              <p className="text-lg font-mono font-bold text-slate-500">-</p>
            )}
            <p className="text-xs text-slate-500">
              {currentStats.revenue > 0 ? ((currentStats.fixedCostBreakdown.salary / currentStats.revenue) * 100).toFixed(0) : 0}%
            </p>
          </div>
          <div className="text-center p-3 bg-[#0a0e17] border border-[#1e293b]">
            <p className="text-xs text-slate-400 mb-1">租金占比</p>
            {currentStats.revenue > 0 ? (
              <p className={`text-lg font-mono font-bold ${
                (currentStats.fixedCostBreakdown.rent / currentStats.revenue) <= 0.1 ? 'text-emerald-400' :
                (currentStats.fixedCostBreakdown.rent / currentStats.revenue) <= 0.2 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {(currentStats.fixedCostBreakdown.rent / currentStats.revenue) <= 0.1 ? '健康' :
                 (currentStats.fixedCostBreakdown.rent / currentStats.revenue) <= 0.2 ? '一般' : '危险'}
              </p>
            ) : (
              <p className="text-lg font-mono font-bold text-slate-500">-</p>
            )}
            <p className="text-xs text-slate-500">
              {currentStats.revenue > 0 ? ((currentStats.fixedCostBreakdown.rent / currentStats.revenue) * 100).toFixed(0) : 0}%
            </p>
          </div>
          <div className="text-center p-3 bg-[#0a0e17] border border-[#1e293b]">
            <p className="text-xs text-slate-400 mb-1">整体盈利</p>
            <p className={`text-lg font-mono font-bold ${currentStats.profit > 0 ? 'text-emerald-400' : currentStats.profit === 0 ? 'text-amber-400' : 'text-red-400'}`}>
              {currentStats.profit > 0 ? '盈利' : currentStats.profit === 0 ? '持平' : '亏损'}
            </p>
            <p className="text-xs text-slate-500">{formatMoney(currentStats.profit)}</p>
          </div>
        </div>
      </div>

      {/* 认知等级提示 */}
      {cognitionLevel < 3 && (
        <div className="ark-card p-4 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <Eye className="w-4 h-4" />
            <span className="font-bold">财务数据模糊</span>
          </div>
          <p className="text-xs text-amber-300/80 mt-1">
            当前认知等级 Lv.{cognitionLevel}，部分财务数据显示不精确。
            提升认知等级可解锁更精确的财务信息。
          </p>
        </div>
      )}
    </div>
  );
}
