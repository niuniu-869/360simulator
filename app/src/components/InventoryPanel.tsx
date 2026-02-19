// 库存管理面板组件（v2.2 合并重写）

import { Badge } from '@/components/ui/badge';
import {
  STOCKOUT_EFFECTS,
  RESTOCK_STRATEGIES,
  getWasteRate,
} from '@/data/inventoryData';
import type { InventoryItem, InventoryState, RestockStrategy, CognitionLevel } from '@/types/game';
import { Package, TrendingDown, RefreshCw, AlertTriangle, Info } from 'lucide-react';

interface InventoryPanelProps {
  inventoryState: InventoryState;
  lastWeekFulfillment?: number;
  cognitionLevel: CognitionLevel;
  onChangeStrategy?: (productId: string, strategy: RestockStrategy) => void;
  onSetQuantity?: (productId: string, quantity: number) => void;
}

// 补货策略简称（已移除手动模式）
const STRATEGY_LABELS: Record<Exclude<RestockStrategy, 'manual'>, string> = {
  auto_conservative: '保守',
  auto_standard: '标准',
  auto_aggressive: '激进',
};

export function InventoryPanel({
  inventoryState,
  lastWeekFulfillment = 1,
  cognitionLevel: _cognitionLevel,
  onChangeStrategy,
  onSetQuantity: _onSetQuantity,
}: InventoryPanelProps) {
  void _onSetQuantity; // 预留手动设置库存量接口
  void _cognitionLevel; // 由 App.tsx 控制面板可见性，预留后续扩展
  const { items, totalValue, weeklyHoldingCost, weeklyWasteCost, weeklyRestockCost } = inventoryState;

  // 满足率状态
  const fulfillmentPercent = Math.round(lastWeekFulfillment * 100);
  const fulfillmentColor = fulfillmentPercent >= 80 ? 'text-emerald-400'
    : fulfillmentPercent >= 50 ? 'text-yellow-400' : 'text-red-400';

  // 获取补货策略的目标库存参考值
  const getStrategyTarget = (strategy: RestockStrategy, lastWeekSales: number): string => {
    const config = RESTOCK_STRATEGIES.find(s => s.id === strategy);
    if (!config || strategy === 'manual') return '—';
    const sales = lastWeekSales > 0 ? lastWeekSales : 50;
    const target = Math.ceil(sales * config.targetStockWeeks);
    return `${target} 份`;
  };

  // 渲染单个库存项
  const renderInventoryItem = (item: InventoryItem) => {
    const wasteRate = getWasteRate(item.storageType);
    const storageLabel = item.storageType === 'frozen' ? '冷冻' :
      item.storageType === 'refrigerated' ? '冷藏' : '常温';

    // 库存够不够卖：对比上周销量
    const salesRef = item.lastWeekSales > 0 ? item.lastWeekSales : 50;
    const stockRatio = salesRef > 0 ? item.quantity / salesRef : 1;
    const stockStatus = stockRatio >= 1.2 ? 'text-emerald-400'
      : stockRatio >= 0.8 ? 'text-yellow-400' : 'text-red-400';
    const stockLabel = stockRatio >= 1.2 ? '充足'
      : stockRatio >= 0.8 ? '偏紧' : '不足';

    return (
      <div key={item.productId} className="p-4 bg-[#0a0e17] border border-[#1e293b]">
        {/* 标题行 */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{item.name}</span>
            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600">
              {storageLabel}
            </Badge>
          </div>
          <div className="text-right">
            <span className={`text-sm font-mono font-bold ${stockStatus}`}>
              {item.quantity} 份
            </span>
            <span className={`text-[10px] ml-1 ${stockStatus}`}>({stockLabel})</span>
          </div>
        </div>

        {/* 上周数据 */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          <div className="text-center p-1.5 bg-[#1a2332] rounded">
            <div className="text-slate-500">上周销量</div>
            <div className="text-emerald-400 font-mono">{item.lastWeekSales}</div>
          </div>
          <div className="text-center p-1.5 bg-[#1a2332] rounded">
            <div className="text-slate-500">上周损耗</div>
            <div className="text-red-400 font-mono">{item.lastWeekWaste}</div>
          </div>
          <div className="text-center p-1.5 bg-[#1a2332] rounded">
            <div className="text-slate-500">上周补货</div>
            <div className="text-blue-400 font-mono">{item.lastRestockQuantity}</div>
          </div>
        </div>

        {/* 损耗率和价值 */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-3">
          <div>损耗率: <span className="text-red-400">{(wasteRate * 100).toFixed(0)}%/周</span></div>
          <div>库存价值: <span className="text-orange-400">¥{(item.quantity * item.unitCost).toFixed(0)}</span></div>
        </div>

        {/* 补货策略选择 */}
        <div className="mb-2">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-xs text-slate-500 mr-1">补货模式:</span>
            {(Object.keys(STRATEGY_LABELS) as Array<keyof typeof STRATEGY_LABELS>).map(strategy => (
              <button
                key={strategy}
                className={`px-2 py-1 text-[10px] transition-all ${
                  item.restockStrategy === strategy
                    ? 'bg-orange-500 text-white'
                    : 'bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:bg-[#252f3f]'
                }`}
                onClick={() => onChangeStrategy?.(item.productId, strategy)}
              >
                {STRATEGY_LABELS[strategy]}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <Info className="w-3 h-3 shrink-0" />
            <span>
              当前目标: 补到 <span className="text-blue-400">{getStrategyTarget(item.restockStrategy, item.lastWeekSales)}</span>
              （上周卖 {item.lastWeekSales > 0 ? item.lastWeekSales : '—'} 份 ×{' '}
              {RESTOCK_STRATEGIES.find(s => s.id === item.restockStrategy)?.targetStockWeeks ?? '?'} 周）
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="ark-title flex items-center gap-2">
          <Package className="w-5 h-5 text-orange-500" />
          库存管理
        </h2>
        <div className={`text-sm font-mono ${fulfillmentColor}`}>
          满足率 {fulfillmentPercent}%
        </div>
      </div>

      {/* 库存概览 */}
      <div className="ark-card p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="p-2 bg-[#1a2332] rounded">
            <div className="text-xs text-slate-500">库存价值</div>
            <div className="font-mono text-orange-400">¥{totalValue.toFixed(0)}</div>
          </div>
          <div className="p-2 bg-[#1a2332] rounded">
            <div className="text-xs text-slate-500">持有成本/周</div>
            <div className="font-mono text-slate-300">¥{weeklyHoldingCost.toFixed(0)}</div>
          </div>
          <div className="p-2 bg-[#1a2332] rounded">
            <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <TrendingDown className="w-3 h-3" />损耗/周
            </div>
            <div className="font-mono text-red-400">¥{weeklyWasteCost.toFixed(0)}</div>
          </div>
          <div className="p-2 bg-[#1a2332] rounded">
            <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <RefreshCw className="w-3 h-3" />补货/周
            </div>
            <div className="font-mono text-blue-400">¥{weeklyRestockCost.toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* 缺货警告 */}
      {lastWeekFulfillment < 0.8 && (
        <div className="ark-card p-4 border-red-500/30">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-red-400 font-bold">
                上周只满足了 {fulfillmentPercent}% 的顾客需求
              </span>
              <p className="text-xs text-slate-400 mt-1">
                {fulfillmentPercent < 20
                  ? '店里基本没货，来的顾客全白跑，口碑严重受损'
                  : fulfillmentPercent < 50
                  ? '大量顾客来了买不到东西，回头客在减少'
                  : '部分顾客因缺货空手而归，影响口碑'}
                ——有一份存货才能出一份餐，备货不足就是白白丢单。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 库存明细 */}
      <div className="ark-card p-5">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-orange-500 rounded-full" />
          库存明细
        </h3>
        {items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map(renderInventoryItem)}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            暂无库存数据
          </div>
        )}
      </div>

      {/* 底部参考信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 缺货影响 */}
        <div className="ark-card p-4">
          <div className="text-xs text-slate-500 mb-2 font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            缺货影响（有货才能出餐，没货就丢单）
          </div>
          <div className="space-y-1 text-xs">
            {STOCKOUT_EFFECTS.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  e.reputationImpact === 0 ? 'bg-emerald-500' :
                  e.reputationImpact >= -5 ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="text-slate-400">{e.description}</span>
                {e.reputationImpact < 0 && (
                  <span className="text-red-400 font-mono ml-auto">
                    口碑 {e.reputationImpact}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 补货策略参考 */}
        <div className="ark-card p-4">
          <div className="text-xs text-slate-500 mb-2 font-bold flex items-center gap-1">
            <Info className="w-3 h-3" />
            补货策略参考
          </div>
          <div className="space-y-1 text-xs">
            {RESTOCK_STRATEGIES.filter(s => s.id !== 'manual').map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="text-orange-400 font-bold w-8">{STRATEGY_LABELS[s.id as keyof typeof STRATEGY_LABELS]}</span>
                <span className="text-slate-400 flex-1">{s.description}</span>
                {s.targetStockWeeks > 0 && (
                  <span className="text-blue-400 font-mono shrink-0">
                    ×{s.targetStockWeeks}周
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InventoryPanel;
