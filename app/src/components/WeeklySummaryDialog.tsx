// 每周总结弹窗组件 — 数据清晰度随认知等级(0-3)提升

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { fuzzWeeklySummaryValue, formatMoney } from '@/lib/fuzzUtils';
import { WIN_STREAK } from '@/lib/gameEngine';
import type { WeeklySummary, CognitionLevel } from '@/types/game';
import { INTERACTIVE_EVENTS } from '@/data/interactiveEvents';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Sparkles,
  Target,
  DollarSign,
  Package,
  AlertTriangle,
  Calendar,
  Clock,
  Flame,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from 'lucide-react';
import type { HealthAlert } from '@/types/game';

interface WeeklySummaryDialogProps {
  summary: WeeklySummary;
  cognitionLevel: CognitionLevel;
  onClose: () => void;
  onOpenCyberYongGe?: () => void;
}

export function WeeklySummaryDialog({ summary, cognitionLevel, onClose, onOpenCyberYongGe }: WeeklySummaryDialogProps) {
  // 模糊化辅助函数
  const fuzzMoney = (value: number) => fuzzWeeklySummaryValue(value, cognitionLevel, 'money');
  const fuzzCount = (value: number) => fuzzWeeklySummaryValue(value, cognitionLevel, 'count');
  const fuzzPercent = (value: number) => fuzzWeeklySummaryValue(value, cognitionLevel, 'percent');

  const isProfitable = summary.profit > 0;

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="bg-[#151d2b] border-[#1e293b] max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Calendar className="w-5 h-5 text-orange-500" />
            第 {summary.week} 周总结
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* 本周概览 */}
          <div className={`p-4 border ${isProfitable ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center gap-2 mb-1">
              {isProfitable
                ? <TrendingUp className="w-5 h-5 text-emerald-400" />
                : <TrendingDown className="w-5 h-5 text-red-400" />}
              <span className={`text-lg font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                {cognitionLevel === 0
                  ? (isProfitable ? '本周赚钱了！' : '本周亏钱了...')
                  : `本周${isProfitable ? '盈利' : '亏损'} ${fuzzMoney(Math.abs(summary.profit)).display}`}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              连续盈利 {summary.consecutiveProfits}/{WIN_STREAK} 周
            </p>
          </div>

          {/* 财务数据 */}
          <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              财务数据
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-500">收入</span>
                <div className="font-mono text-emerald-400">
                  {fuzzMoney(summary.revenue).display}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500">变动成本</span>
                <div className="font-mono text-red-400">
                  {fuzzMoney(summary.variableCost).display}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500">固定成本</span>
                <div className="font-mono text-orange-400">
                  {fuzzMoney(summary.fixedCost).display}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500">剩余现金</span>
                <div className={`font-mono ${summary.cashRemaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fuzzMoney(summary.cashRemaining).display}
                </div>
              </div>
            </div>
          </div>

          {/* 供需数据（1级以上显示） */}
          {cognitionLevel >= 1 && (
            <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                供需概况
              </h4>
              <div className="grid grid-cols-3 gap-3 text-sm text-center">
                <div>
                  <span className="text-xs text-slate-500">需求</span>
                  <div className="font-mono text-blue-400">
                    {fuzzCount(summary.totalDemand).display}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500">供给</span>
                  <div className="font-mono text-purple-400">
                    {fuzzCount(summary.totalSupply).display}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500">满足率</span>
                  <div className={`font-mono ${summary.fulfillmentRate >= 0.8 ? 'text-emerald-400' : summary.fulfillmentRate >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {fuzzPercent(summary.fulfillmentRate * 100).display}
                  </div>
                </div>
              </div>
              {summary.fulfillmentRate < 0.8 && (
                <div className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  供给不足，部分顾客空手而归
                </div>
              )}
            </div>
          )}

          {/* 选品销量（2级以上显示） */}
          {cognitionLevel >= 2 && summary.productSales.length > 0 && (
            <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
              <h4 className="text-sm font-bold text-white mb-3">选品销量</h4>
              <div className="space-y-2">
                {summary.productSales.map(sale => (
                  <div key={sale.productId} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{sale.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">
                        {fuzzCount(sale.sales).display} 份
                      </span>
                      <span className="font-mono text-emerald-400">
                        {fuzzMoney(sale.revenue).display}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 人员状态 */}
          <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              人员状态
            </h4>
            <div className="text-sm text-slate-300">
              当前员工 <span className="text-orange-400 font-mono">{summary.staffCount}</span> 人
              {cognitionLevel >= 3 && (
                <span className="ml-3 text-xs text-slate-400">
                  平均士气 {summary.avgMorale.toFixed(0)} · 平均疲劳 {summary.avgFatigue.toFixed(0)}
                </span>
              )}
            </div>
            {/* 整洁度变化 */}
            {cognitionLevel >= 1 && summary.cleanlinessChange !== undefined && (
              <div className="mt-2 text-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span className="text-slate-400">整洁度变化:</span>
                <span className={summary.cleanlinessChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {summary.cleanlinessChange >= 0 ? '+' : ''}{summary.cleanlinessChange.toFixed(1)}
                </span>
              </div>
            )}
            {summary.quitStaffNames.length > 0 && (
              <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                本周离职: {summary.quitStaffNames.join('、')}
              </div>
            )}

            {/* 员工忙碌度统计（1级以上显示） */}
            {cognitionLevel >= 1 && summary.staffWorkStats && summary.staffWorkStats.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#1e293b] space-y-2">
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                  <Clock className="w-3 h-3" />
                  <span>员工工时概况</span>
                </div>
                {summary.staffWorkStats.map(stat => {
                  const busyPercent = Math.round(stat.busyRate * 100);
                  // 认知1级：只显示模糊描述
                  // 认知2级：显示大致百分比
                  // 认知3级+：显示精确数据
                  let busyDisplay: string;
                  let hoursDisplay: string;
                  if (cognitionLevel >= 3) {
                    busyDisplay = `${busyPercent}%`;
                    hoursDisplay = `${stat.busyHours}/${stat.totalHours}h`;
                  } else if (cognitionLevel >= 2) {
                    const roughPercent = Math.round(busyPercent / 10) * 10;
                    busyDisplay = `~${roughPercent}%`;
                    hoursDisplay = `约${Math.round(stat.totalHours)}h`;
                  } else {
                    busyDisplay = busyPercent >= 80 ? '很忙' : busyPercent >= 50 ? '一般' : '较闲';
                    hoursDisplay = '';
                  }
                  const barColor = busyPercent >= 80
                    ? 'bg-red-500' : busyPercent >= 50
                    ? 'bg-amber-500' : 'bg-emerald-500';

                  return (
                    <div key={stat.staffId} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 w-14 truncate" title={stat.name}>{stat.name}</span>
                      <span className="text-slate-600 w-10 text-center">{stat.taskName}</span>
                      <div className="flex-1 h-1.5 bg-[#1a2332] rounded overflow-hidden">
                        <div className={`h-full ${barColor} rounded`} style={{ width: `${busyPercent}%` }} />
                      </div>
                      <span className={`w-12 text-right font-mono ${
                        busyPercent >= 80 ? 'text-red-400' : busyPercent >= 50 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {busyDisplay}
                      </span>
                      {hoursDisplay && (
                        <span className="text-slate-600 w-16 text-right">{hoursDisplay}</span>
                      )}
                      {stat.isOnboarding && (
                        <span className="text-blue-400 text-[10px]">适应中</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 认知成长 */}
          <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              认知成长
            </h4>
            <p className="text-xs text-slate-400 mb-2">
              本周获得 <span className="text-amber-400 font-mono">+{summary.expGained}</span> 经验
              <span className="ml-2 text-slate-500">（当前 Lv.{summary.cognitionLevel}）</span>
            </p>
            {/* 经验来源明细 */}
            {summary.expSources && summary.expSources.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-[#1e293b]">
                {summary.expSources.map((source, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{source.label}</span>
                    <span className="text-amber-400/80 font-mono">+{source.exp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 回本进度 */}
          <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              回本进度
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>累计利润 / 总投资</span>
                <span className={summary.returnOnInvestmentProgress >= 100 ? 'text-emerald-400' : 'text-blue-400'}>
                  {cognitionLevel >= 1
                    ? `${formatMoney(summary.cumulativeProfit)} / ${formatMoney(summary.totalInvestment)}`
                    : (summary.returnOnInvestmentProgress >= 100 ? '已回本！' : '还没回本')}
                </span>
              </div>
              <Progress
                value={Math.min(100, Math.max(0, summary.returnOnInvestmentProgress))}
                className="h-2"
              />
              <div className="text-xs text-right text-slate-500">
                {Math.min(100, Math.round(summary.returnOnInvestmentProgress))}%
              </div>
            </div>
          </div>

          {/* 随机事件 */}
          {summary.event && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4">
              <h4 className="text-sm font-bold text-amber-400 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                本周事件
              </h4>
              <p className="text-xs text-slate-300">{summary.event.title}</p>
              <p className="text-xs text-slate-400 mt-1">{summary.event.description}</p>
            </div>
          )}

          {/* 交互事件响应回顾（v2.9） */}
          {summary.interactiveEventResponse && (() => {
            const resp = summary.interactiveEventResponse!;
            const eventDef = INTERACTIVE_EVENTS.find(e => e.id === resp.eventId);
            const optionDef = eventDef?.options.find(o => o.id === resp.optionId);
            if (!eventDef || !optionDef) return null;
            return (
              <div className="bg-orange-500/10 border border-orange-500/30 p-4">
                <h4 className="text-sm font-bold text-orange-400 mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  事件回顾：{eventDef.name}
                </h4>
                <p className="text-xs text-slate-300">你的选择：{optionDef.text}</p>
                <p className="text-xs text-slate-400 mt-1 italic">{optionDef.yonggeQuote}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {resp.effects.cash && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${resp.effects.cash < 0 ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                      {resp.effects.cash > 0 ? '+' : ''}{resp.effects.cash.toLocaleString()}元
                    </span>
                  )}
                  {resp.effects.reputation && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${resp.effects.reputation < 0 ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                      口碑 {resp.effects.reputation > 0 ? '+' : ''}{resp.effects.reputation}
                    </span>
                  )}
                  {resp.effects.cognitionExp && resp.effects.cognitionExp > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded text-amber-400 bg-amber-500/10">
                      经验 +{resp.effects.cognitionExp}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 勇哥提醒（健康告警） */}
          {summary.healthAlerts && summary.healthAlerts.length > 0 && (
            <HealthAlertSection alerts={summary.healthAlerts} />
          )}

          {/* 关闭按钮 */}
          <div className="flex justify-center gap-3 pt-2">
            {onOpenCyberYongGe && (
              <button
                className={`flex items-center gap-2 text-sm px-6 py-2 border transition-colors rounded-md ${
                  summary.healthAlerts && summary.healthAlerts.length > 0
                    ? 'bg-orange-500/30 border-orange-500/60 text-orange-300 hover:bg-orange-500/40 animate-pulse'
                    : 'bg-orange-500/20 border-orange-500/40 text-orange-400 hover:bg-orange-500/30'
                }`}
                onClick={() => { onClose(); onOpenCyberYongGe(); }}
              >
                <Flame className="w-4 h-4" />
                让勇哥看看
              </button>
            )}
            <button
              className="ark-button ark-button-primary px-8 py-2"
              onClick={onClose}
            >
              继续经营
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ 健康告警子组件 ============

// 案例库数据（与 YongGeTeaching 中的案例ID对应）
const CASE_SNIPPETS: Record<string, { title: string; quote: string; lesson: string }> = {
  'milktea-tower': {
    title: '奶茶大厦哥',
    quote: '日营业额800元，人工就要900元，还没算租金水电。',
    lesson: '快招公司套路：你想加盟A品牌，网上搜到"官方电话"，对方说A品牌饱和了，推荐"子品牌"。',
  },
  'oyster-bro': {
    title: '生蚝哥',
    quote: '周围没人卖生蚝就是商机？那是没人买！',
    lesson: '没有需求的地方就没有市场，便宜和好产品不能创造需求。',
  },
  'fourth-burger': {
    title: '第四代汉堡哥',
    quote: '金角银边草肚皮，你直接选了个地下室！',
    lesson: '不要和头部品牌正面竞争，"第四代XX"基本都是快招套路。',
  },
  'foot-basin': {
    title: '脚盆果汁店',
    quote: '我连线3年，从来没见人做餐饮做成这个样子。',
    lesson: '卫生是餐饮的底线，用塑料洗脚盆装果汁，蜜雪冰城正对面，日营业额50元。',
  },
  'village-bar': {
    title: '村里开酒吧',
    quote: '父母贷款18万，10天亏光，大师说风水好的地方根本没人。',
    lesson: '已经亏的钱是沉没成本，不要为了"不甘心"继续往里砸钱。及时止损才是正确选择。',
  },
  'naza-drink': {
    title: '哪吒仙饮',
    quote: '总部只有样板间，没有一家直营店，废弃商场里一天卖几十块。',
    lesson: '快招品牌的"扶持期"一过，供货涨价、刷单停止，真实经营数据才会暴露出来。',
  },
};

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    title: 'text-red-400',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    title: 'text-amber-400',
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    title: 'text-blue-400',
  },
};

function HealthAlertSection({ alerts }: { alerts: HealthAlert[] }) {
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  const hasCritical = alerts.some(a => a.severity === 'critical');

  return (
    <div className={`p-4 border ${hasCritical ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
      <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${hasCritical ? 'text-red-400' : 'text-amber-400'}`}>
        <ShieldAlert className="w-4 h-4" />
        勇哥提醒（{alerts.length}条）
      </h4>
      <div className="space-y-3">
        {alerts.map(alert => {
          const style = SEVERITY_STYLES[alert.severity];
          const caseData = alert.relatedCaseId ? CASE_SNIPPETS[alert.relatedCaseId] : null;
          const isExpanded = expandedCase === alert.id;

          return (
            <div key={alert.id} className={`p-3 border rounded ${style.bg} ${style.border}`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${style.icon}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${style.title}`}>{alert.title}</p>
                  <p className="text-xs text-slate-300 mt-1">{alert.message}</p>
                  <p className="text-xs text-slate-400 mt-1">💡 {alert.suggestion}</p>
                  {caseData && (
                    <button
                      className="flex items-center gap-1 text-[10px] text-orange-400 mt-2 hover:text-orange-300"
                      onClick={() => setExpandedCase(isExpanded ? null : alert.id)}
                    >
                      <BookOpen className="w-3 h-3" />
                      查看案例：{caseData.title}
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                  {isExpanded && caseData && (
                    <div className="mt-2 p-2 bg-[#0a0e17] border border-[#1e293b] rounded text-xs space-y-1">
                      <p className="text-orange-400 italic">「{caseData.quote}」</p>
                      <p className="text-slate-400">📌 {caseData.lesson}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeeklySummaryDialog;
