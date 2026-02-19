import { useState } from 'react';
import type { Staff, Location } from '@/types/game';
import { staffTypes } from '@/data/gameData';
import { TASK_DEFINITIONS } from '@/data/staffData';
import { Users, Plus, Minus, DollarSign, AlertCircle, Check, Briefcase } from 'lucide-react';

interface StaffManagementProps {
  staff: Staff[];
  selectedLocation: Location | null;
  onAddStaff: (staffTypeId: string, assignedTask?: string) => void;
  onRemoveStaff: (staffId: string) => void;
}

export function StaffManagement({ staff, selectedLocation, onAddStaff, onRemoveStaff }: StaffManagementProps) {
  // 各员工类型的预选岗位
  const [selectedTasks, setSelectedTasks] = useState<Record<string, string>>({});

  const monthlySalary = staff.reduce((sum, s) => sum + s.salary, 0);

  // 统计各类型员工数量
  const staffCountByType = staff.reduce((acc, s) => {
    acc[s.typeId] = (acc[s.typeId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="ark-title">人员配置</h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Users className="w-4 h-4 text-orange-500" />
            <span>员工: <span className="text-orange-500 font-mono">{staff.length}人</span></span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <DollarSign className="w-4 h-4 text-red-500" />
            <span>月人工: <span className="font-mono text-red-500">¥{monthlySalary.toLocaleString()}</span></span>
          </div>
        </div>
      </div>

      {/* 员工类型选择 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {staffTypes.map((staffType) => {
          const wageLevel = selectedLocation?.wageLevel || 1;
          const isHourly = staffType.payType === 'hourly' && staffType.hourlyRate;
          const actualSalary = isHourly
            ? Math.round(staffType.hourlyRate! * 6 * 8 * 4 * wageLevel)
            : Math.round(staffType.baseSalary * wageLevel);
          const count = staffCountByType[staffType.id] || 0;

          return (
            <div
              key={staffType.id}
              className="ark-card ark-corner-border p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white">{staffType.name}</h3>
                <span className="text-lg font-mono text-orange-500">{count}</span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{isHourly ? '时薪' : '月薪'}</span>
                  <span className="font-mono text-white">
                    {isHourly
                      ? `¥${staffType.hourlyRate}/时 · 月约¥${actualSalary.toLocaleString()}`
                      : `¥${actualSalary.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">效率</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 ark-progress">
                      <div 
                        className="ark-progress-bar" 
                        style={{ width: `${staffType.efficiency * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-emerald-400">{(staffType.efficiency * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">服务质量</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 ark-progress">
                      <div 
                        className="ark-progress-bar" 
                        style={{ width: `${staffType.serviceQuality * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-blue-400">{(staffType.serviceQuality * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* 可处理品类 */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1">可处理</p>
                <div className="flex flex-wrap gap-1">
                  {staffType.canHandleProducts.map(product => (
                    <span key={product} className="text-xs bg-[#1a2332] text-slate-400 px-2 py-0.5">
                      {product === 'drink' ? '🧋' : product === 'food' ? '🍜' : product === 'snack' ? '🍰' : '🍱'}
                      {product === 'drink' ? '饮品' : product === 'food' ? '食品' : product === 'snack' ? '小吃' : '正餐'}
                    </span>
                  ))}
                </div>
              </div>

              {/* 岗位预选 */}
              {staffType.availableTasks.length > 1 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />初始岗位
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {staffType.availableTasks.map(taskId => {
                      const taskDef = TASK_DEFINITIONS.find(t => t.id === taskId);
                      if (!taskDef) return null;
                      const currentSelected = selectedTasks[staffType.id] || (staffType.availableTasks.includes('chef') && !staffType.availableTasks.includes('waiter') ? 'chef' : staffType.availableTasks[0]);
                      return (
                        <button
                          key={taskId}
                          className={`px-2 py-0.5 text-[10px] transition-all ${
                            currentSelected === taskId
                              ? 'bg-orange-500 text-white'
                              : 'bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f]'
                          }`}
                          onClick={() => setSelectedTasks(prev => ({ ...prev, [staffType.id]: taskId }))}
                        >
                          {taskDef.icon} {taskDef.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 增减按钮 */}
              <div className="flex gap-2">
                <button
                  className="flex-1 ark-button py-2 flex items-center justify-center gap-1"
                  onClick={() => onRemoveStaff(staff.find(s => s.typeId === staffType.id)?.id || '')}
                  disabled={count === 0}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  className="flex-1 ark-button ark-button-primary py-2 flex items-center justify-center gap-1"
                  onClick={() => {
                    const task = selectedTasks[staffType.id] || (staffType.availableTasks.includes('chef') && !staffType.availableTasks.includes('waiter') ? 'chef' : staffType.availableTasks[0]);
                    onAddStaff(staffType.id, task);
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 当前员工确认区域 */}
      {staff.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-emerald-500">已配置员工 ({staff.length}人)</span>
            </div>
            <div className="text-sm text-slate-400">
              月人工: <span className="font-mono text-orange-400">¥{monthlySalary.toLocaleString()}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {staff.map((s, index) => {
              const staffType = staffTypes.find(t => t.id === s.typeId);
              const taskDef = TASK_DEFINITIONS.find(t => t.id === s.assignedTask);
              return (
                <div key={s.id} className="bg-[#0a0e17] p-2 border border-[#1e293b] flex items-center justify-between rounded">
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-300">{staffType?.name} #{index + 1}</span>
                    <span className="text-[10px] text-slate-500">{taskDef?.icon} {taskDef?.name || s.assignedTask}</span>
                  </div>
                  <button
                    className="text-red-400 hover:text-red-300"
                    onClick={() => onRemoveStaff(s.id)}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 人工成本分析 */}
      {staff.length > 0 && (
        <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            人工成本分析
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500">月人工总成本</p>
              <p className="text-xl font-mono text-red-400">¥{monthlySalary.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">人均月薪</p>
              <p className="text-xl font-mono text-orange-400">¥{Math.round(monthlySalary / staff.length).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">建议配置</p>
              <p className="text-sm text-slate-300">
                每30㎡配1-2人
              </p>
            </div>
          </div>
          
          {staff.length > 8 && (
            <div className="mt-3 bg-red-500/10 border border-red-500/50 p-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="font-bold">勇哥警告</span>
              </div>
              <p className="text-xs text-red-300 mt-1">
                "人工比营业额还高？你在做慈善吗？赶紧裁员！"
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
