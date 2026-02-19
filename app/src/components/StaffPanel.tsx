// 员工管理面板组件（v2.7 升级 — 薪资调整/士气管理/绩效看板/离职挽留/转岗过渡）

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  RECRUITMENT_CHANNELS,
  TASK_DEFINITIONS,
  getMoraleEffect,
  getStaffFatigueEffect,
  getSkillUpgradeRequirement,
  calculateFireMoraleImpact,
  WORK_HOURS_CONFIG,
  SALARY_CONFIG,
  MORALE_ACTION_CONFIG,
} from '@/data/staffData';
import { staffTypes, AREA_PER_KITCHEN_STATION } from '@/data/gameData';
import type { Staff, CognitionLevel, WeeklySummary, Product } from '@/types/game';
import {
  Users, UserPlus, TrendingUp, Heart, Zap,
  AlertTriangle, Briefcase, Clock, ChevronUp, ChevronDown,
  Sparkles, DollarSign, Coffee, Gift, Palmtree,
  ShieldAlert, BarChart3, ArrowRightLeft, Target,
} from 'lucide-react';

type StaffWorkStat = NonNullable<WeeklySummary['staffWorkStats']>[number];

interface StaffPanelProps {
  staff: Staff[];
  cash: number;
  currentWeek?: number;
  cognitionLevel: CognitionLevel;
  storeArea?: number;
  wageLevel?: number;
  staffWorkStats?: StaffWorkStat[];
  lastTeamMealWeek?: number;
  onRecruit?: (channelId: string, staffTypeId: string, assignedTask?: string) => void;
  onFire?: (staffId: string) => void;
  onAssignTask?: (staffId: string, taskType: string) => void;
  onSetWorkHours?: (staffId: string, days: number, hours: number) => void;
  onSetSalary?: (staffId: string, newSalary: number) => void;
  onMoraleAction?: (actionType: 'bonus' | 'team_meal' | 'day_off', targetStaffId?: string, bonusAmount?: number) => void;
  onRetainStaff?: (staffId: string, method: 'raise' | 'reduce_hours' | 'bonus') => void;
  selectedProducts?: Product[];
  onSetFocusProduct?: (staffId: string, productId: string | null) => void;
}

export function StaffPanel({
  staff,
  cash,
  currentWeek = 0,
  cognitionLevel,
  storeArea = 30,
  wageLevel = 1,
  staffWorkStats,
  lastTeamMealWeek,
  onRecruit,
  onFire,
  onAssignTask,
  onSetWorkHours,
  onSetSalary,
  onMoraleAction,
  onRetainStaff,
  selectedProducts = [],
  onSetFocusProduct,
}: StaffPanelProps) {
  const [selectedStaffType, setSelectedStaffType] = useState<string>('fulltime');
  // 解雇确认弹窗状态
  const [fireConfirm, setFireConfirm] = useState<{ open: boolean; staff: Staff | null }>({
    open: false, staff: null,
  });
  // 招聘确认弹窗状态
  const [recruitConfirm, setRecruitConfirm] = useState<{
    open: boolean; channelId: string; staffTypeId: string; channelName: string; channelCost: number; salary: number; assignedTask: string;
  }>({
    open: false, channelId: '', staffTypeId: '', channelName: '', channelCost: 0, salary: 0, assignedTask: '',
  });
  // v2.7: 薪资编辑状态
  const [editingSalary, setEditingSalary] = useState<{ staffId: string; value: number } | null>(null);
  // v2.7: 挽留弹窗状态
  const [retainDialog, setRetainDialog] = useState<{ open: boolean; staff: Staff | null }>({
    open: false, staff: null,
  });

  // 渲染单个员工卡片
  const renderStaffCard = (member: Staff) => {
    const moraleEffect = getMoraleEffect(member.morale);
    const fatigueEffect = getStaffFatigueEffect(member.fatigue);
    const staffType = staffTypes.find(st => st.id === member.typeId);
    const currentTask = TASK_DEFINITIONS.find(t => t.id === member.assignedTask);
    const availableTasks = staffType?.availableTasks || [];
    const expRequired = getSkillUpgradeRequirement(member.skillLevel);
    const expProgress = expRequired === Infinity ? 100 : Math.min(100, (member.taskExp / expRequired) * 100);
    // v2.7: 绩效数据
    const workStat = staffWorkStats?.find(s => s.staffId === member.id);
    // v2.7: 薪资范围
    const baseSalary = Math.round((staffType?.baseSalary || 3000) * wageLevel);
    const minSalary = Math.round(baseSalary * SALARY_CONFIG.minRatio);
    const maxSalary = Math.round(baseSalary * SALARY_CONFIG.maxRatio);

    return (
      <div key={member.id} className="p-4 bg-[#0a0e17] border border-[#1e293b]">
        {/* 头部：名字 + 状态 */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="font-bold text-white flex items-center gap-2">
              {member.name}
              <span className="text-[10px] text-slate-500">
                ({staffType?.name || member.typeId})
              </span>
              {member.isOnboarding && (
                <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/50">
                  🆕 适应中
                </Badge>
              )}
              {member.isTransitioning && !member.isOnboarding && (
                <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/50">
                  <ArrowRightLeft className="w-2.5 h-2.5 mr-0.5" />转岗中
                </Badge>
              )}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
              <Zap className="w-3 h-3 text-yellow-500" />
              技能 Lv.{member.skillLevel}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {member.wantsToQuit && (
              <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/50 animate-pulse">
                <ShieldAlert className="w-3 h-3 mr-0.5" />想辞职
              </Badge>
            )}
            {cognitionLevel >= 3 && (
              <Badge variant="outline" className={
                moraleEffect.status === '优秀' ? 'text-emerald-400 border-emerald-500/50' :
                moraleEffect.status === '正常' ? 'text-blue-400 border-blue-500/50' :
                'text-red-400 border-red-500/50'
              }>
                {moraleEffect.icon} {moraleEffect.status}
              </Badge>
            )}
            {cognitionLevel >= 3 && fatigueEffect.quitRisk > 0 && (
              <span className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                离职风险 {(fatigueEffect.quitRisk * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {/* 士气 + 疲劳进度条（3级解锁） */}
        {cognitionLevel >= 3 && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3 text-pink-500" />士气
                </span>
                <span>{member.morale}/100</span>
              </div>
              <Progress value={member.morale} className="h-1.5" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{fatigueEffect.icon} 疲劳</span>
                <span>{member.fatigue}/100</span>
              </div>
              <Progress value={member.fatigue} className="h-1.5" />
            </div>
          </div>
        )}

        {/* 岗位经验进度条（3级解锁） */}
        {cognitionLevel >= 3 && (
          <div className="mb-3 space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />岗位经验
              </span>
              <span>
                {expRequired === Infinity
                  ? '已满级'
                  : `${member.taskExp}/${expRequired}`}
              </span>
            </div>
            <Progress value={expProgress} className="h-1.5" />
          </div>
        )}

        {/* 实际效率和服务质量 + 薪资 */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="text-emerald-400">
              效率 {(member.efficiency * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-blue-400">
            服务 {(member.serviceQuality * 100).toFixed(0)}%
          </div>
          <div className="text-orange-400">
            {(() => {
              const st = staffTypes.find(t => t.id === member.typeId);
              if (st?.payType === 'hourly' && st.hourlyRate) {
                return `⏱ ¥${st.hourlyRate}/时 · 月约¥${Math.round(member.salary)}`;
              }
              return `薪资 ¥${Math.round(member.salary)}/月`;
            })()}
          </div>
          <div className="text-slate-400">
            入职第 {currentWeek - member.hiredWeek + 1} 周
          </div>
        </div>

        {/* v2.7: 绩效指标（认知Lv3+） */}
        {cognitionLevel >= 3 && workStat && (
          <div className="mb-3 p-2 bg-[#111827] border border-[#1e293b]">
            <div className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />绩效数据
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div>
                <span className="text-slate-500">忙碌率</span>
                <div className={`font-mono font-bold ${
                  workStat.busyRate > 0.8 ? 'text-red-400' :
                  workStat.busyRate > 0.5 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {(workStat.busyRate * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <span className="text-slate-500">周贡献</span>
                <div className="font-mono font-bold text-cyan-400">
                  {workStat.weeklyContribution.toFixed(1)}
                </div>
              </div>
              <div>
                <span className="text-slate-500">性价比</span>
                <div className={`font-mono font-bold ${
                  workStat.costEfficiency > 50 ? 'text-emerald-400' :
                  workStat.costEfficiency > 20 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {workStat.costEfficiency.toFixed(0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* v2.7: 薪资调整（认知Lv2+，时薪制员工不可手动调薪） */}
        {cognitionLevel >= 2 && (() => {
          const st = staffTypes.find(t => t.id === member.typeId);
          const isHourly = st?.payType === 'hourly';
          if (isHourly) {
            return (
              <div className="mb-3 p-2 bg-[#111827] border border-[#1e293b]">
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />时薪制
                </div>
                <div className="text-xs text-slate-400">
                  ⏱ ¥{st.hourlyRate}/时 × {member.workDaysPerWeek}天 × {member.workHoursPerDay}时 × 4周 = <span className="text-orange-400 font-mono">¥{Math.round(member.salary)}/月</span>
                </div>
                <div className="text-[10px] text-slate-600 mt-1">调整工时即可控制成本</div>
              </div>
            );
          }
          return (
          <div className="mb-3 p-2 bg-[#111827] border border-[#1e293b]">
            <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />薪资调整
              <span className="ml-auto text-slate-600 text-[10px]">
                范围 ¥{minSalary}~¥{maxSalary}
              </span>
            </div>
            {editingSalary?.staffId === member.id ? (
              <div className="space-y-2">
                <input
                  type="range"
                  min={minSalary}
                  max={maxSalary}
                  step={100}
                  value={editingSalary.value}
                  onChange={e => setEditingSalary({ staffId: member.id, value: Number(e.target.value) })}
                  className="w-full h-1.5 accent-orange-500"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-white">
                    ¥{editingSalary.value}/月
                    {editingSalary.value > member.salary && member.salary > 0 && (
                      <span className="text-emerald-400 ml-1">
                        (+{Math.round((editingSalary.value - member.salary) / member.salary * 100)}%)
                      </span>
                    )}
                    {editingSalary.value < member.salary && member.salary > 0 && (
                      <span className="text-red-400 ml-1">
                        ({Math.round((editingSalary.value - member.salary) / member.salary * 100)}%)
                      </span>
                    )}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="px-2 py-0.5 text-[10px] bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f]"
                      onClick={() => setEditingSalary(null)}
                    >取消</button>
                    <button
                      className="px-2 py-0.5 text-[10px] bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-30"
                      disabled={editingSalary.value === member.salary}
                      onClick={() => {
                        onSetSalary?.(member.id, editingSalary.value);
                        setEditingSalary(null);
                      }}
                    >确认</button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                className="w-full py-1 text-xs bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f]"
                onClick={() => setEditingSalary({ staffId: member.id, value: member.salary })}
              >
                当前 ¥{Math.round(member.salary)}/月 · 点击调整
              </button>
            )}
          </div>
        );
        })()}

        {/* 工时调节 */}
        <div className="mb-3 p-2 bg-[#111827] border border-[#1e293b]">
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />工时设置
            <span className="ml-auto text-slate-400">
              周 {member.workDaysPerWeek * member.workHoursPerDay}h
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* 天数 */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 w-6">天数</span>
              <button
                className="w-5 h-5 flex items-center justify-center bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f] disabled:opacity-30"
                disabled={member.workDaysPerWeek <= WORK_HOURS_CONFIG.minDays}
                onClick={() => onSetWorkHours?.(member.id, member.workDaysPerWeek - 1, member.workHoursPerDay)}
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              <span className="text-xs text-white font-mono w-4 text-center">{member.workDaysPerWeek}</span>
              <button
                className="w-5 h-5 flex items-center justify-center bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f] disabled:opacity-30"
                disabled={member.workDaysPerWeek >= WORK_HOURS_CONFIG.maxDays}
                onClick={() => onSetWorkHours?.(member.id, member.workDaysPerWeek + 1, member.workHoursPerDay)}
              >
                <ChevronUp className="w-3 h-3" />
              </button>
            </div>
            {/* 小时 */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 w-6">时/天</span>
              <button
                className="w-5 h-5 flex items-center justify-center bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f] disabled:opacity-30"
                disabled={member.workHoursPerDay <= WORK_HOURS_CONFIG.minHours}
                onClick={() => onSetWorkHours?.(member.id, member.workDaysPerWeek, member.workHoursPerDay - 1)}
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              <span className="text-xs text-white font-mono w-4 text-center">{member.workHoursPerDay}</span>
              <button
                className="w-5 h-5 flex items-center justify-center bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f] disabled:opacity-30"
                disabled={member.workHoursPerDay >= WORK_HOURS_CONFIG.maxHours}
                onClick={() => onSetWorkHours?.(member.id, member.workDaysPerWeek, member.workHoursPerDay + 1)}
              >
                <ChevronUp className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 岗位分配 */}
        {!member.isOnboarding && (
          <div className="mb-3">
            <div className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
              <Briefcase className="w-3 h-3" />当前岗位: {currentTask?.icon} {currentTask?.name}
            </div>
            <div className="flex gap-1 flex-wrap">
              {availableTasks.map(taskId => {
                const taskDef = TASK_DEFINITIONS.find(t => t.id === taskId);
                if (!taskDef) return null;
                // 营销员需认知2级解锁
                const isLocked = taskId === 'marketer' && cognitionLevel < 2;
                return (
                  <button
                    key={taskId}
                    className={`px-2 py-1 text-[10px] transition-all ${
                      isLocked
                        ? 'bg-[#1a2332] text-slate-600 border border-[#1e293b] cursor-not-allowed opacity-50'
                        : member.assignedTask === taskId
                          ? 'bg-orange-500 text-white'
                          : 'bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f]'
                    }`}
                    onClick={() => !isLocked && onAssignTask?.(member.id, taskId)}
                    title={isLocked ? '需认知2级解锁' : taskDef.description}
                    disabled={isLocked}
                  >
                    {taskDef.icon} {taskDef.name}{isLocked ? ' 🔒' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* v2.8: 产品专注度（有产能岗位 + 非入职期 + 认知Lv2+） */}
        {cognitionLevel >= 2 && !member.isOnboarding && currentTask && currentTask.productionMultiplier > 0 && selectedProducts.length > 0 && (() => {
          const st = staffTypes.find(t => t.id === member.typeId);
          const canHandle = st?.canHandleProducts || [];
          const eligibleProducts = selectedProducts.filter(p =>
            canHandle.includes(p.category as 'drink' | 'food' | 'snack' | 'meal')
          );
          if (eligibleProducts.length === 0) return null;
          const proficiency = member.productProficiency || {};
          const focusId = member.focusProductId;
          return (
            <div className="mb-3 p-2 bg-[#111827] border border-[#1e293b]">
              <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                <Target className="w-3 h-3" />产品专注
                {focusId && (
                  <span className="ml-auto text-[10px] text-purple-400">
                    熟练度 {proficiency[focusId] || 0}/100
                  </span>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                <button
                  className={`px-2 py-1 text-[10px] transition-all ${
                    !focusId
                      ? 'bg-purple-500 text-white'
                      : 'bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f]'
                  }`}
                  onClick={() => onSetFocusProduct?.(member.id, null)}
                >
                  均衡
                </button>
                {eligibleProducts.map(p => {
                  const prof = proficiency[p.id] || 0;
                  return (
                    <button
                      key={p.id}
                      className={`px-2 py-1 text-[10px] transition-all ${
                        focusId === p.id
                          ? 'bg-purple-500 text-white'
                          : 'bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f]'
                      }`}
                      onClick={() => onSetFocusProduct?.(member.id, p.id)}
                      title={`熟练度: ${prof}/100 · 效率加成: +${(prof * 0.3).toFixed(0)}%`}
                    >
                      {p.name}{prof > 0 ? ` (${prof})` : ''}
                    </button>
                  );
                })}
              </div>
              {focusId && (
                <Progress value={proficiency[focusId] || 0} className="h-1 mt-2" />
              )}
            </div>
          );
        })()}

        {/* 入职适应期提示 */}
        {member.isOnboarding && (
          <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
            入职适应中，还需 {Math.max(0, member.onboardingEndsWeek - currentWeek)} 周完成，期间不贡献产能
          </div>
        )}

        {/* v2.7: 转岗过渡期提示 */}
        {member.isTransitioning && !member.isOnboarding && (
          <div className="mb-3 p-2 bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-400">
            <ArrowRightLeft className="w-3 h-3 inline mr-1" />
            转岗适应中，效率降至50%，还需 {Math.max(0, (member.transitionEndsWeek || 0) - currentWeek)} 周
          </div>
        )}

        {/* 岗位效果展示 */}
        {currentTask && (
          <div className="mb-3 p-2 bg-[#111827] border border-[#1e293b] text-xs">
            <div className="text-slate-500 mb-1">岗位效果</div>
            <div className="flex gap-4">
              <span className="text-emerald-400">
                产能系数 ×{currentTask.productionMultiplier.toFixed(1)}
              </span>
              <span className="text-blue-400">
                服务系数 ×{currentTask.serviceMultiplier.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* v2.7: 个人士气操作（认知Lv1+） */}
        {cognitionLevel >= 1 && !member.isOnboarding && (
          <div className="mb-3 flex gap-1">
            <button
              className="flex-1 py-1.5 text-[10px] bg-[#1a2332] text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              disabled={
                cash < MORALE_ACTION_CONFIG.bonus.amounts[0] ||
                (member.lastBonusWeek !== undefined && (currentWeek - member.lastBonusWeek) < MORALE_ACTION_CONFIG.bonus.cooldownWeeks)
              }
              title={
                member.lastBonusWeek !== undefined && (currentWeek - member.lastBonusWeek) < MORALE_ACTION_CONFIG.bonus.cooldownWeeks
                  ? `冷却中(${MORALE_ACTION_CONFIG.bonus.cooldownWeeks - (currentWeek - member.lastBonusWeek)}周)`
                  : '发放奖金提升士气'
              }
              onClick={() => onMoraleAction?.('bonus', member.id, MORALE_ACTION_CONFIG.bonus.amounts[0])}
            >
              <Gift className="w-3 h-3" />奖金¥500
            </button>
            <button
              className="flex-1 py-1.5 text-[10px] bg-[#1a2332] text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              disabled={
                member.lastDayOffWeek !== undefined && (currentWeek - member.lastDayOffWeek) < MORALE_ACTION_CONFIG.day_off.cooldownWeeks
              }
              title={
                member.lastDayOffWeek !== undefined && (currentWeek - member.lastDayOffWeek) < MORALE_ACTION_CONFIG.day_off.cooldownWeeks
                  ? `冷却中(${MORALE_ACTION_CONFIG.day_off.cooldownWeeks - (currentWeek - member.lastDayOffWeek)}周)`
                  : '放假一天，降低疲劳'
              }
              onClick={() => onMoraleAction?.('day_off', member.id)}
            >
              <Palmtree className="w-3 h-3" />放假1天
            </button>
          </div>
        )}

        {/* v2.7: 离职挽留（认知Lv2+，仅对想辞职的员工） */}
        {cognitionLevel >= 2 && member.wantsToQuit && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30">
            <div className="text-xs text-red-400 font-bold mb-2 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              {member.name}想辞职了！
            </div>
            <div className="flex gap-1">
              <button
                className="flex-1 py-1.5 text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
                onClick={() => setRetainDialog({ open: true, staff: member })}
              >
                挽留
              </button>
            </div>
          </div>
        )}

        {/* 解雇按钮 */}
        <button
          className="w-full py-2 text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-all"
          onClick={() => setFireConfirm({ open: true, staff: member })}
        >
          解雇
        </button>
      </div>
    );
  };

  // 渲染招聘渠道
  const renderRecruitChannel = (channel: typeof RECRUITMENT_CHANNELS[number]) => {
    const canAfford = cash >= channel.cost;
    const staffType = staffTypes.find(st => st.id === selectedStaffType);
    const estimatedSalary = staffType ? Math.round(staffType.baseSalary) : 0;

    return (
      <div key={channel.id} className="p-4 bg-[#0a0e17] border border-[#1e293b]">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-white">{channel.name}</span>
          <span className="text-xs text-orange-400">
            {channel.cost > 0 ? `¥${channel.cost}` : '免费'}
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-3">{channel.description}</p>
        <button
          className={`w-full py-2 text-sm font-bold transition-all ${
            canAfford
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-[#1a2332] text-slate-500 border border-[#1e293b] cursor-not-allowed'
          }`}
          disabled={!canAfford}
          onClick={() => {
            const st = staffTypes.find(t => t.id === selectedStaffType);
            const defaultTask = st?.availableTasks.includes('chef') && !st?.availableTasks.includes('waiter') ? 'chef' : st?.availableTasks[0] || 'waiter';
            setRecruitConfirm({
              open: true,
              channelId: channel.id,
              staffTypeId: selectedStaffType,
              channelName: channel.name,
              channelCost: channel.cost,
              salary: estimatedSalary,
              assignedTask: defaultTask,
            });
          }}
        >
          {canAfford ? '招聘' : '资金不足'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="ark-title flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-500" />
          员工管理
        </h2>
        <div className="text-sm text-slate-400">
          当前员工 <span className="text-orange-500 font-mono">{staff.length}</span> 人
        </div>
      </div>

      {/* 厨房工位信息 */}
      {staff.length > 0 && (() => {
        const kitchenStations = Math.max(1, Math.floor(storeArea / AREA_PER_KITCHEN_STATION));
        const productionStaff = staff.filter(s => {
          if (s.isOnboarding) return false;
          const st = staffTypes.find(t => t.id === s.typeId);
          if (!st) return false;
          const taskDef = TASK_DEFINITIONS.find(t => t.id === s.assignedTask);
          return (taskDef?.productionMultiplier || 0) > 0;
        });
        const isCrowded = productionStaff.length > kitchenStations;
        return (
          <div className={`ark-card p-4 flex items-center justify-between ${
            isCrowded ? 'border-amber-500/50' : ''
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">🍳</span>
              <div>
                <div className="text-sm text-white">
                  厨房工位 <span className={`font-mono font-bold ${isCrowded ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {productionStaff.length}/{kitchenStations}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  店铺 {storeArea}㎡ · 每 {AREA_PER_KITCHEN_STATION}㎡ 一个工位
                </div>
              </div>
            </div>
            {isCrowded && (
              <div className="flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                厨房拥挤，人均效率下降
              </div>
            )}
          </div>
        );
      })()}

      {/* 当前员工列表 */}
      <div className="ark-card p-5">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
          当前员工
        </h3>
        {staff.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staff.map(renderStaffCard)}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            暂无员工，请先招聘
          </div>
        )}
      </div>

      {/* v2.7: 团队士气管理（认知Lv1+） */}
      {cognitionLevel >= 1 && staff.length > 0 && (
        <div className="ark-card p-5">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-500" />
            团队管理
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 团队概况 */}
            <div className="p-3 bg-[#0a0e17] border border-[#1e293b]">
              <div className="text-xs text-slate-500 mb-2">团队状态</div>
              {(() => {
                const avgMorale = staff.length > 0
                  ? Math.round(staff.reduce((s, m) => s + m.morale, 0) / staff.length) : 0;
                const avgFatigue = staff.length > 0
                  ? Math.round(staff.reduce((s, m) => s + m.fatigue, 0) / staff.length) : 0;
                return (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">平均士气</span>
                  <div className={`font-mono font-bold ${
                    avgMorale >= 60 ? 'text-emerald-400' :
                    avgMorale >= 40 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {avgMorale}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">平均疲劳</span>
                  <div className={`font-mono font-bold ${
                    avgFatigue <= 40 ? 'text-emerald-400' :
                    avgFatigue <= 60 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {avgFatigue}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">想辞职</span>
                  <div className={`font-mono font-bold ${
                    staff.filter(s => s.wantsToQuit).length > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {staff.filter(s => s.wantsToQuit).length}人
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">月薪总计</span>
                  <div className="font-mono font-bold text-orange-400">
                    ¥{Math.round(staff.reduce((s, m) => s + m.salary, 0))}
                  </div>
                </div>
              </div>
                );
              })()}
            </div>
            <div className="p-3 bg-[#0a0e17] border border-[#1e293b]">
              <div className="text-xs text-slate-500 mb-2">团建聚餐</div>
              <div className="text-xs text-slate-400 mb-2">
                费用 ¥{MORALE_ACTION_CONFIG.team_meal.costPerPerson * staff.length}
                （¥{MORALE_ACTION_CONFIG.team_meal.costPerPerson}/人 × {staff.length}人）
              </div>
              <div className="text-[10px] text-slate-500 mb-2">
                全员士气+{MORALE_ACTION_CONFIG.team_meal.moraleBoost}，疲劳-{MORALE_ACTION_CONFIG.team_meal.fatigueReduction}
              </div>
              <button
                className="w-full py-2 text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                disabled={
                  cash < MORALE_ACTION_CONFIG.team_meal.costPerPerson * staff.length ||
                  (lastTeamMealWeek !== undefined && (currentWeek - lastTeamMealWeek) < MORALE_ACTION_CONFIG.team_meal.cooldownWeeks)
                }
                onClick={() => onMoraleAction?.('team_meal')}
              >
                <Coffee className="w-3.5 h-3.5" />
                {lastTeamMealWeek !== undefined && (currentWeek - lastTeamMealWeek) < MORALE_ACTION_CONFIG.team_meal.cooldownWeeks
                  ? `冷却中（${MORALE_ACTION_CONFIG.team_meal.cooldownWeeks - (currentWeek - lastTeamMealWeek)}周）`
                  : '组织团建聚餐'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 招聘渠道 */}
      <div className="ark-card p-5">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-orange-500" />
          招聘渠道
        </h3>

        {/* 员工类型选择 */}
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2">选择要招聘的员工类型</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {staffTypes.map(type => (
              <button
                key={type.id}
                className={`p-2 text-xs transition-all ${
                  selectedStaffType === type.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f]'
                }`}
                onClick={() => setSelectedStaffType(type.id)}
              >
                <div className="font-bold">{type.name}</div>
                <div className="text-[10px] opacity-75">¥{Math.round(type.baseSalary)}/月</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RECRUITMENT_CHANNELS.map(renderRecruitChannel)}
        </div>
      </div>

      {/* 解雇确认弹窗 */}
      <AlertDialog open={fireConfirm.open} onOpenChange={(open) => setFireConfirm({ open, staff: open ? fireConfirm.staff : null })}>
        <AlertDialogContent className="bg-[#0f1724] border-[#1e293b]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">确认解雇员工</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-slate-300">
                {fireConfirm.staff && (
                  <>
                    <div className="p-3 bg-[#0a0e17] border border-[#1e293b] rounded">
                      <div className="font-bold text-white mb-1">{fireConfirm.staff.name}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span>类型: {staffTypes.find(st => st.id === fireConfirm.staff!.typeId)?.name}</span>
                        <span>技能: Lv.{fireConfirm.staff.skillLevel}</span>
                        <span>薪资: ¥{Math.round(fireConfirm.staff.salary)}/月</span>
                        <span>在职: {currentWeek - fireConfirm.staff.hiredWeek + 1} 周</span>
                      </div>
                    </div>
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm">
                      <div className="flex items-center gap-2 text-red-400 font-bold mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        士气影响预估
                      </div>
                      <p className="text-red-300">
                        解雇后，其他员工士气将下降约 <span className="font-mono font-bold">
                          {Math.abs(calculateFireMoraleImpact(fireConfirm.staff, currentWeek))}
                        </span> 点
                      </p>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a2332] text-slate-300 border-[#1e293b] hover:bg-[#252f3f]">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={() => {
                if (fireConfirm.staff) {
                  onFire?.(fireConfirm.staff.id);
                }
                setFireConfirm({ open: false, staff: null });
              }}
            >
              确认解雇
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 招聘确认弹窗 */}
      <AlertDialog open={recruitConfirm.open} onOpenChange={(open) => {
        if (!open) setRecruitConfirm(prev => ({ ...prev, open: false }));
      }}>
        <AlertDialogContent className="bg-[#0f1724] border-[#1e293b]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-400">确认招聘</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-slate-300">
                <div className="p-3 bg-[#0a0e17] border border-[#1e293b] rounded">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-slate-400">招聘渠道</span>
                    <span className="text-white">{recruitConfirm.channelName}</span>
                    <span className="text-slate-400">渠道费用</span>
                    <span className="text-orange-400">
                      {recruitConfirm.channelCost > 0 ? `¥${recruitConfirm.channelCost}` : '免费'}
                    </span>
                    <span className="text-slate-400">员工类型</span>
                    <span className="text-white">
                      {staffTypes.find(st => st.id === recruitConfirm.staffTypeId)?.name}
                    </span>
                    <span className="text-slate-400">预估月薪</span>
                    <span className="text-orange-400">¥{recruitConfirm.salary}/月</span>
                  </div>
                </div>
                {/* 岗位选择 */}
                {(() => {
                  const st = staffTypes.find(t => t.id === recruitConfirm.staffTypeId);
                  const tasks = st?.availableTasks || [];
                  return tasks.length > 1 ? (
                    <div className="p-3 bg-[#0a0e17] border border-[#1e293b] rounded">
                      <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />初始岗位
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {tasks.map(taskId => {
                          const taskDef = TASK_DEFINITIONS.find(t => t.id === taskId);
                          if (!taskDef) return null;
                          const isLocked = taskId === 'marketer' && cognitionLevel < 2;
                          return (
                            <button
                              key={taskId}
                              className={`px-3 py-1.5 text-xs transition-all rounded ${
                                isLocked
                                  ? 'bg-[#1a2332] text-slate-600 border border-[#1e293b] cursor-not-allowed opacity-50'
                                  : recruitConfirm.assignedTask === taskId
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f]'
                              }`}
                              onClick={() => !isLocked && setRecruitConfirm(prev => ({ ...prev, assignedTask: taskId }))}
                              disabled={isLocked}
                            >
                              {taskDef.icon} {taskDef.name}{isLocked ? ' 🔒' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-sm text-amber-300">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    注意
                  </div>
                  <p>新员工入职后有 <span className="font-bold">1周适应期</span>，期间不贡献产能但正常计薪。</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a2332] text-slate-300 border-[#1e293b] hover:bg-[#252f3f]">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 text-white hover:bg-orange-600"
              onClick={() => {
                onRecruit?.(recruitConfirm.channelId, recruitConfirm.staffTypeId, recruitConfirm.assignedTask);
                setRecruitConfirm(prev => ({ ...prev, open: false }));
              }}
            >
              确认招聘
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* v2.7: 挽留确认弹窗 */}
      <AlertDialog open={retainDialog.open} onOpenChange={(open) => setRetainDialog({ open, staff: open ? retainDialog.staff : null })}>
        <AlertDialogContent className="bg-[#0f1724] border-[#1e293b]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-400">挽留员工</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-slate-300">
                {retainDialog.staff && (
                  <>
                    <div className="p-3 bg-[#0a0e17] border border-[#1e293b] rounded">
                      <div className="font-bold text-white mb-1">{retainDialog.staff.name}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span>技能: Lv.{retainDialog.staff.skillLevel}</span>
                        <span>士气: {Math.round(retainDialog.staff.morale)}</span>
                        <span>薪资: ¥{Math.round(retainDialog.staff.salary)}/月</span>
                        <span>疲劳: {Math.round(retainDialog.staff.fatigue)}</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 mb-1">选择挽留方式（有概率失败）：</div>
                    <div className="space-y-2">
                      <button
                        className="w-full p-3 text-left bg-[#0a0e17] border border-emerald-500/30 hover:bg-emerald-500/10 rounded"
                        onClick={() => {
                          onRetainStaff?.(retainDialog.staff!.id, 'raise');
                          setRetainDialog({ open: false, staff: null });
                        }}
                      >
                        <div className="text-xs font-bold text-emerald-400">加薪挽留（成功率80%）</div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          薪资上调20%，士气+15。即使失败薪资也会生效。
                        </div>
                      </button>
                      <button
                        className="w-full p-3 text-left bg-[#0a0e17] border border-cyan-500/30 hover:bg-cyan-500/10 rounded"
                        onClick={() => {
                          onRetainStaff?.(retainDialog.staff!.id, 'reduce_hours');
                          setRetainDialog({ open: false, staff: null });
                        }}
                      >
                        <div className="text-xs font-bold text-cyan-400">减少工时（成功率60%）</div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          调整为5天×8小时，疲劳-20。免费但产能会下降。
                        </div>
                      </button>
                      <button
                        className={`w-full p-3 text-left bg-[#0a0e17] border border-amber-500/30 hover:bg-amber-500/10 rounded ${
                          cash < Math.round(retainDialog.staff.salary * 0.5) ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                        disabled={cash < Math.round(retainDialog.staff.salary * 0.5)}
                        onClick={() => {
                          onRetainStaff?.(retainDialog.staff!.id, 'bonus');
                          setRetainDialog({ open: false, staff: null });
                        }}
                      >
                        <div className="text-xs font-bold text-amber-400">一次性奖金（成功率70%）</div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          支付 ¥{Math.round(retainDialog.staff.salary * 0.5)}（半月薪资），士气+20。失败则钱白花。
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a2332] text-slate-300 border-[#1e293b] hover:bg-[#252f3f]">
              算了不留了
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default StaffPanel;
