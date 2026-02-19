import type { Decoration } from '@/types/game';
import { decorations } from '@/data/gameData';
import { Paintbrush, Check, Star, Info, X, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface DecorationSelectionProps {
  selectedDecoration: Decoration | null;
  storeArea: number;
  cash: number;
  onSelect: (decoration: Decoration | null) => void;
  isLocked?: boolean;
  isQuickFranchise?: boolean;
  costMarkup?: number;
}

export function DecorationSelection({
  selectedDecoration,
  storeArea,
  cash,
  onSelect,
  isLocked = false,
  isQuickFranchise = false,
  costMarkup = 1.0
}: DecorationSelectionProps) {
  const formatMoney = (amount: number) => {
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(1)}万`;
    }
    return amount.toLocaleString();
  };

  // 处理选择/取消选择
  const handleToggle = (decoration: Decoration, e: React.MouseEvent) => {
    e.stopPropagation();
    // 如果已锁定，不允许修改
    if (isLocked) return;
    if (selectedDecoration?.id === decoration.id) {
      onSelect(null);
    } else {
      onSelect(decoration);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="ark-title">装修风格</h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Paintbrush className="w-4 h-4 text-orange-500" />
          <span>店铺面积: {storeArea}㎡</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {decorations.map((decoration) => {
          const isSelected = selectedDecoration?.id === decoration.id;
          const totalCost = decoration.costPerSqm * storeArea * (isSelected ? costMarkup : 1);
          const canAfford = cash >= totalCost;

          return (
            <div key={decoration.id}>
              <Dialog>
                <DialogTrigger asChild>
                  <div
                    className={`
                      ark-card ark-corner-border p-5 transition-all duration-300
                      ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                      ${isSelected ? 'ark-selected' : ''}
                      ${!canAfford && !isSelected && !isLocked ? 'opacity-50' : ''}
                      ${!isLocked && canAfford ? 'hover:border-orange-500/50' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`
                          w-8 h-8 flex items-center justify-center
                          ${decoration.level <= 2 ? 'bg-slate-700' : decoration.level <= 3 ? 'bg-blue-900' : decoration.level <= 4 ? 'bg-purple-900' : 'bg-amber-900'}
                        `}>
                          <Star className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white">{decoration.name}</h3>
                          <div className="flex gap-1">
                            {Array.from({ length: decoration.level }).map((_, i) => (
                              <div key={i} className="w-2 h-2 bg-orange-500" />
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* 选择按钮 */}
                      <button
                        className={`
                          w-6 h-6 flex items-center justify-center border transition-all
                          ${isSelected
                            ? 'bg-orange-500 border-orange-500'
                            : canAfford && !isLocked
                              ? 'border-slate-600 hover:border-orange-500'
                              : 'border-slate-700 bg-slate-800 cursor-not-allowed'
                          }
                        `}
                        onClick={(e) => canAfford && !isLocked && handleToggle(decoration, e)}
                        disabled={!canAfford || isLocked}
                      >
                        {isSelected && (
                          isLocked ? <Lock className="w-3 h-3 text-white" /> : <Check className="w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">每平米</span>
                        <span className="font-mono text-white">¥{decoration.costPerSqm}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">总费用</span>
                        <span className={`font-mono font-bold ${canAfford || isSelected ? 'text-orange-400' : 'text-red-400'}`}>
                          ¥{formatMoney(totalCost)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 mt-2">{decoration.description}</p>

                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-slate-600">点击查看详情</span>
                      <Info className="w-4 h-4 text-slate-600" />
                    </div>
                  </div>
                </DialogTrigger>
                
                <DialogContent className="bg-[#151d2b] border-[#1e293b] max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                      <div className={`
                        w-8 h-8 flex items-center justify-center
                        ${decoration.level <= 2 ? 'bg-slate-700' : decoration.level <= 3 ? 'bg-blue-900' : decoration.level <= 4 ? 'bg-purple-900' : 'bg-amber-900'}
                      `}>
                        <Star className="w-4 h-4 text-white" />
                      </div>
                      {decoration.name}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#0a0e17] p-3 border border-[#1e293b]">
                        <p className="text-xs text-slate-400">每平米费用</p>
                        <p className="text-lg font-mono font-bold text-white">¥{decoration.costPerSqm}</p>
                      </div>
                      <div className="bg-[#0a0e17] p-3 border border-[#1e293b]">
                        <p className="text-xs text-slate-400">总装修费用</p>
                        <p className="text-lg font-mono font-bold text-orange-400">¥{formatMoney(totalCost)}</p>
                      </div>
                    </div>
                    
                    {/* 筹备阶段认知为0，隐藏客群吸引力和品类加成等市场洞察信息 */}
                    <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
                      <p className="text-xs text-slate-500 text-center">
                        🔒 客群吸引力加成、品类加成等市场数据需要经营经验才能了解
                      </p>
                    </div>
                    
                    <p className="text-sm text-slate-300">{decoration.description}</p>
                    
                    {!canAfford && (
                      <div className="bg-red-500/10 border border-red-500/50 p-3">
                        <p className="text-sm text-red-400">资金不足，还差 ¥{formatMoney(totalCost - cash)}</p>
                      </div>
                    )}
                    
                    <button
                      className="ark-button ark-button-primary w-full"
                      onClick={() => {
                        if (canAfford) {
                          onSelect(isSelected ? null : decoration);
                        }
                      }}
                      disabled={!canAfford}
                    >
                      {isSelected ? '取消选择' : canAfford ? '选择此风格' : '资金不足'}
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          );
        })}
      </div>

      {selectedDecoration && (
        <div className={`border p-4 rounded-lg ${isLocked && isQuickFranchise ? 'bg-red-500/10 border-red-500/50' : 'bg-emerald-500/10 border-emerald-500/50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLocked && isQuickFranchise ? (
                <>
                  <Lock className="w-4 h-4 text-red-500" />
                  <span className="font-bold text-red-400">总部指定装修: {selectedDecoration.name}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold text-emerald-500">已选择: {selectedDecoration.name}</span>
                </>
              )}
            </div>
            {!isLocked && (
              <button
                className="text-slate-400 hover:text-red-400 transition-colors"
                onClick={() => onSelect(null)}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-sm text-slate-300 mt-2">
            装修费用 ¥{formatMoney(selectedDecoration.costPerSqm * storeArea * costMarkup)} 已扣除
            {isLocked && isQuickFranchise && costMarkup > 1 && (
              <span className="text-red-400 ml-2">
                (含总部指定装修公司溢价 {((costMarkup - 1) * 100).toFixed(0)}%)
              </span>
            )}
          </p>
          {isLocked && isQuickFranchise && (
            <p className="text-xs text-red-400 mt-2">
              ⚠️ 总部要求使用指定装修公司，无法更改
            </p>
          )}
        </div>
      )}
    </div>
  );
}
