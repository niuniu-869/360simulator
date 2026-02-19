/**
 * 供需分析面板组件
 * 展示需求侧、供给侧明细和瓶颈分析
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Filter,
  Truck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { SupplyDemandResult, GameState, CognitionLevel } from '@/types/game';
import { getExposureCoefficient, getReputationCoefficient } from '@/lib/supplyDemand';
import {
  getDeliveryPlatform,
  getDeliveryPricing,
  getDiscountTier,
  getPackagingTier,
  getPromotionTier,
} from '@/data/deliveryData';

interface SupplyDemandPanelProps {
  result: SupplyDemandResult | null;
  cognitionLevel: CognitionLevel;
  gameState?: GameState;
}

const formatMoney = (v: number) => `¥${Math.round(v).toLocaleString()}`;

export function SupplyDemandPanel({ result, cognitionLevel: _cognitionLevel, gameState }: SupplyDemandPanelProps) {
  void _cognitionLevel; // 由 App.tsx 控制面板可见性，预留后续模糊化扩展
  if (!result) {
    return (
      <Card className="ark-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            供需分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">开店后可查看供需分析数据</p>
        </CardContent>
      </Card>
    );
  }

  const { demand, supply, productSales, overallBottleneck } = result;
  const hasDeliveryPlatforms = gameState?.deliveryState?.platforms && gameState.deliveryState.platforms.length > 0;

  return (
    <div className="space-y-4">
      {/* 1. 整体瓶颈分析 */}
      <BottleneckCard bottleneck={overallBottleneck} />

      {/* 2. 堂食/外卖收入概览（增强：+满减补贴） */}
      <RevenueOverviewCard result={result} />

      {/* 3. 需求漏斗（全新） */}
      <DemandFunnelCard result={result} gameState={gameState} />

      {/* 4. 需求侧分析（增强：+2个修正因子） */}
      <DemandCard demand={demand} />

      {/* 5. 供给侧分析（增强：+出餐优先级+产品瓶颈） */}
      <SupplyCard supply={supply} result={result} />

      {/* 6. 外卖平台详情（全新，条件渲染） */}
      {hasDeliveryPlatforms && gameState && (
        <DeliveryDetailCard gameState={gameState} />
      )}

      {/* 7. 产品销售明细（大幅增强：堂食/外卖拆分表格） */}
      <ProductSalesCard productSales={productSales} />
    </div>
  );
}

// 瓶颈分析卡片
function BottleneckCard({ bottleneck }: { bottleneck: SupplyDemandResult['overallBottleneck'] }) {
  const getBottleneckStyle = () => {
    switch (bottleneck.type) {
      case 'demand':
        return { icon: TrendingDown, color: 'text-orange-500', bg: 'bg-orange-50' };
      case 'supply':
        return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' };
      case 'balanced':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' };
    }
  };

  const style = getBottleneckStyle();
  const Icon = style.icon;

  return (
    <Card className={`ark-card ${style.bg}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-5 w-5 ${style.color}`} />
          瓶颈分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-medium">{bottleneck.description}</p>
        <p className="text-sm text-muted-foreground mt-1">
          💡 {bottleneck.suggestion}
        </p>
      </CardContent>
    </Card>
  );
}

// 堂食/外卖收入概览卡片（增强：+满减补贴）
function RevenueOverviewCard({ result }: { result: SupplyDemandResult }) {
  const hasDelivery = result.deliveryRevenue > 0;
  const dineInPct = result.totalRevenue > 0
    ? Math.round((result.dineInRevenue / result.totalRevenue) * 100)
    : 100;
  const deliveryNetRevenue = result.deliveryRevenue - result.deliveryCommission - result.deliveryPackageCost - result.deliveryDiscountCost;

  return (
    <Card className="ark-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          收入构成
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 堂食收入 */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">堂食收入</span>
          <span className="font-mono font-medium text-emerald-400">
            {formatMoney(result.dineInRevenue)}
          </span>
        </div>
        <Progress value={dineInPct} className="h-2" />

        {/* 外卖收入 */}
        {hasDelivery && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">外卖收入(扣佣前)</span>
              <span className="font-mono font-medium text-orange-400">
                {formatMoney(result.deliveryRevenue)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex justify-between text-red-400">
                <span>平台佣金</span>
                <span>-{formatMoney(result.deliveryCommission)}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>包装成本</span>
                <span>-{formatMoney(result.deliveryPackageCost)}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>满减补贴</span>
                <span>-{formatMoney(result.deliveryDiscountCost)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[#1e293b]">
              <span className="text-sm font-medium">外卖净收入</span>
              <span className={`font-mono font-medium ${deliveryNetRevenue >= 0 ? 'text-orange-300' : 'text-red-400'}`}>
                {formatMoney(deliveryNetRevenue)}
              </span>
            </div>
          </>
        )}

        {/* 总计 */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1e293b]">
          <span className="text-sm font-bold">总收入</span>
          <span className="font-mono font-bold text-white">
            {formatMoney(result.totalRevenue)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// 需求漏斗卡片（全新）
function DemandFunnelCard({ result, gameState }: { result: SupplyDemandResult; gameState?: GameState }) {
  if (!gameState) return null;

  // 吸引力分数子项（组件内用相同公式计算，无需修改引擎）
  const decoLevel = gameState.selectedDecoration?.level || 1;
  const decorationScore = (decoLevel / 5) * 35;
  const weekBonus = Math.min(25, gameState.currentWeek * 0.8);
  const reputationScore = (gameState.reputation / 100) * 20;
  const exposureScore = (gameState.exposure / 100) * 20;

  const attractionItems = [
    { label: '装修贡献', value: decorationScore, max: 35, color: 'text-amber-400' },
    { label: '经营时长', value: weekBonus, max: 25, color: 'text-blue-400' },
    { label: '口碑贡献', value: reputationScore, max: 20, color: 'text-pink-400' },
    { label: '曝光贡献', value: exposureScore, max: 20, color: 'text-cyan-400' },
  ];

  const ringLabels: Record<string, string> = {
    ring0: '门前300m',
    ring1: '步行1km',
    ring2: '骑行3km',
    ring3: '外卖5km',
  };

  const exposureCoeff = getExposureCoefficient(gameState.exposure);
  const reputationCoeff = getReputationCoefficient(gameState.reputation);

  return (
    <Card className="ark-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-5 w-5 text-indigo-500" />
          需求漏斗
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 吸引力分数 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">吸引力分数</span>
            <span className="font-mono font-bold text-indigo-400">
              {result.attractionScore.toFixed(1)} / 100
            </span>
          </div>
          <Progress value={result.attractionScore} className="h-2" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {attractionItems.map(item => (
              <div key={item.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={item.color}>
                  +{item.value.toFixed(1)}/{item.max}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 距离环覆盖率 */}
        <div className="space-y-2 pt-2 border-t border-[#1e293b]">
          <span className="text-sm text-muted-foreground">距离环覆盖率</span>
          {Object.entries(result.ringCoverage).map(([ringId, coverage]) => {
            const isRing3 = ringId === 'ring3';
            return (
              <div key={ringId} className="flex items-center gap-2">
                <span className="text-xs w-20 text-muted-foreground">
                  {ringLabels[ringId] || ringId}
                </span>
                <Progress
                  value={coverage * 100}
                  className={`flex-1 h-1.5 ${isRing3 ? 'opacity-30' : ''}`}
                />
                <span className={`text-xs font-mono w-12 text-right ${isRing3 ? 'text-slate-600' : 'text-slate-300'}`}>
                  {isRing3 ? '仅外卖' : `${(coverage * 100).toFixed(0)}%`}
                </span>
              </div>
            );
          })}
        </div>

        {/* 漏斗系数 */}
        <div className="space-y-1 pt-2 border-t border-[#1e293b]">
          <span className="text-sm text-muted-foreground">漏斗系数</span>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div className="text-center">
              <div className="text-lg font-mono font-bold text-cyan-500">
                ×{exposureCoeff.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">曝光度系数</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-mono font-bold text-pink-500">
                ×{reputationCoeff.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">口碑转化</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-mono font-bold text-yellow-500">
                ×{result.trafficReachMultiplier.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">交通触达</div>
            </div>
          </div>
        </div>

        {/* 新店爬坡因子 */}
        <div className="space-y-1 pt-2 border-t border-[#1e293b]">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">新店爬坡因子</span>
            <span className="font-mono font-medium text-emerald-400">
              {(result.awarenessFactor * 100).toFixed(0)}%
            </span>
          </div>
          <Progress value={result.awarenessFactor * 100} className="h-2" />
          {result.awarenessFactor < 1 && (
            <p className="text-xs text-muted-foreground">
              新店知名度尚未满载，持续经营和营销可加速爬坡
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// 需求侧分析卡片（增强：+2个修正因子）
function DemandCard({ demand }: { demand: SupplyDemandResult['demand'] }) {
  const modifierLabels: Record<string, string> = {
    season: '季节',
    marketing: '营销',
    serviceQuality: '服务质量',
    cleanliness: '整洁度',
    inactivity: '经营热度衰减',
  };

  return (
    <Card className="ark-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-blue-500" />
          需求侧分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">基础客流</span>
          <span className="font-medium">{Math.round(demand.totalBaseTraffic)} 人/天 <span className="text-xs text-slate-500">(≈{Math.round(demand.totalBaseTraffic * 7)}/周)</span></span>
        </div>

        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">需求修正因子</span>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {Object.entries(demand.modifiers).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span>{modifierLabels[key] || key}</span>
                <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {value >= 0 ? '+' : ''}{(value * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t flex justify-between items-center">
          <span className="font-medium">总需求</span>
          <span className="text-lg font-bold text-blue-600">
            {demand.totalDemand.toLocaleString()} 人次/周
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// 供给侧分析卡片（增强：+出餐优先级+产品瓶颈）
function SupplyCard({ supply, result }: { supply: SupplyDemandResult['supply']; result: SupplyDemandResult }) {
  const [showBottlenecks, setShowBottlenecks] = useState(false);

  const priorityLabels: Record<string, { label: string; color: string }> = {
    dine_in_first: { label: '堂食优先', color: 'text-emerald-400' },
    delivery_first: { label: '外卖优先', color: 'text-orange-400' },
    proportional: { label: '按需分配', color: 'text-blue-400' },
  };

  const priorityInfo = priorityLabels[result.supplyPriority] || priorityLabels.dine_in_first;

  return (
    <Card className="ark-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-5 w-5 text-purple-500" />
          供给侧分析
          <Badge variant="outline" className={`ml-auto text-xs ${priorityInfo.color}`}>
            {priorityInfo.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-2xl font-bold">{supply.staffCount}</div>
            <div className="text-xs text-muted-foreground">在岗员工</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{supply.totalWorkHours}</div>
            <div className="text-xs text-muted-foreground">工时/周</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{supply.avgEfficiency.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">平均效率</div>
          </div>
        </div>

        <div className="pt-2 border-t flex justify-between items-center">
          <span className="font-medium">总供给</span>
          <span className="text-lg font-bold text-purple-600">
            {supply.totalSupply.toLocaleString()} 人次/周
          </span>
        </div>

        {/* 可折叠的产品供给瓶颈区域 */}
        {supply.productSupplies.length > 0 && (
          <div className="pt-2 border-t border-[#1e293b]">
            <button
              onClick={() => setShowBottlenecks(!showBottlenecks)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-slate-300 transition-colors w-full"
            >
              {showBottlenecks ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              各产品供给瓶颈
            </button>
            {showBottlenecks && (
              <div className="mt-2 space-y-2">
                {supply.productSupplies.map(ps => {
                  const maxVal = Math.max(ps.inventoryQuantity, ps.productionCapacity, 1);
                  const inventoryPct = (ps.inventoryQuantity / maxVal) * 100;
                  const capacityPct = (ps.productionCapacity / maxVal) * 100;
                  const isInventoryBottleneck = ps.bottleneck === 'inventory';
                  return (
                    <div key={ps.productId} className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span>{ps.productName}</span>
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${isInventoryBottleneck ? 'text-red-400 border-red-400' : 'text-yellow-400 border-yellow-400'}`}>
                          {isInventoryBottleneck ? '库存瓶颈' : '产能瓶颈'}
                        </Badge>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="w-8 text-muted-foreground">库存</span>
                        <div className="flex-1 bg-slate-800 rounded h-1.5">
                          <div className={`h-full rounded ${isInventoryBottleneck ? 'bg-red-500' : 'bg-slate-500'}`} style={{ width: `${inventoryPct}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono">{ps.inventoryQuantity}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="w-8 text-muted-foreground">产能</span>
                        <div className="flex-1 bg-slate-800 rounded h-1.5">
                          <div className={`h-full rounded ${!isInventoryBottleneck ? 'bg-yellow-500' : 'bg-slate-500'}`} style={{ width: `${capacityPct}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono">{ps.productionCapacity}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 外卖平台详情卡片（全新）
function DeliveryDetailCard({ gameState }: { gameState: GameState }) {
  const platforms = gameState.deliveryState.platforms;

  return (
    <Card className="ark-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-5 w-5 text-orange-500" />
          外卖平台详情
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {platforms.map(ap => {
          const platform = getDeliveryPlatform(ap.platformId);
          const pricing = getDeliveryPricing(ap.deliveryPricingId);
          const discount = getDiscountTier(ap.discountTierId);
          const packaging = getPackagingTier(ap.packagingTierId);
          const promotion = getPromotionTier(ap.promotionTierId);
          if (!platform) return null;

          const weightTotal = ap.platformExposure;
          const weightItems = [
            { label: '基础分', value: ap.lastWeightBase ?? 0, color: 'bg-blue-500' },
            { label: '销量分', value: ap.lastWeightSales ?? 0, color: 'bg-emerald-500' },
            { label: '评分分', value: ap.lastWeightRating ?? 0, color: 'bg-yellow-500' },
            { label: '推广分', value: ap.lastWeightPromotion ?? 0, color: 'bg-purple-500' },
            { label: '满减分', value: ap.lastWeightDiscount ?? 0, color: 'bg-pink-500' },
          ];

          return (
            <div key={ap.platformId} className="border border-[#1e293b] rounded-lg p-3 space-y-3">
              {/* 平台名称 + 权重分 */}
              <div className="flex items-center justify-between">
                <span className="font-medium">{platform.name}</span>
                <span className="font-mono font-bold text-orange-400">
                  {weightTotal.toFixed(0)} / 90
                </span>
              </div>
              <Progress value={(weightTotal / 90) * 100} className="h-2" />

              {/* 权重分构成 */}
              <div className="grid grid-cols-5 gap-1 text-xs text-center">
                {weightItems.map(item => (
                  <div key={item.label}>
                    <div className={`h-1 rounded mb-1 ${item.color}`} style={{ opacity: item.value > 0 ? 1 : 0.2 }} />
                    <div className="font-mono">{item.value > 0 ? `+${item.value.toFixed(0)}` : '0'}</div>
                    <div className="text-muted-foreground text-[10px]">{item.label}</div>
                  </div>
                ))}
              </div>

              {/* 配置摘要 */}
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary" className="text-[10px]">
                  佣金 {(platform.commissionRate * 100).toFixed(0)}%
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  定价 ×{pricing?.multiplier.toFixed(2) ?? '?'}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {discount?.name ?? '无满减'}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {packaging?.name ?? '基础包装'}
                </Badge>
                {promotion && promotion.id !== 'none' && (
                  <Badge variant="secondary" className="text-[10px]">
                    {promotion.name}
                  </Badge>
                )}
              </div>

              {/* 底部汇总 */}
              <div className="flex justify-between text-xs pt-2 border-t border-[#1e293b]">
                <span className="text-muted-foreground">
                  平台评分: <span className="text-yellow-400 font-mono">{gameState.deliveryState.platformRating.toFixed(1)}</span>
                </span>
                <span className="text-muted-foreground">
                  运营 {ap.activeWeeks} 周
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// 产品销售明细卡片（大幅增强：堂食/外卖拆分表格）
function ProductSalesCard({ productSales }: { productSales: SupplyDemandResult['productSales'] }) {
  const getBottleneckBadge = (bottleneck: string) => {
    switch (bottleneck) {
      case 'demand':
        return <Badge variant="outline" className="text-orange-500 border-orange-500">需求不足</Badge>;
      case 'supply_inventory':
        return <Badge variant="outline" className="text-red-500 border-red-500">库存不足</Badge>;
      case 'supply_capacity':
        return <Badge variant="outline" className="text-red-500 border-red-500">产能不足</Badge>;
      default:
        return <Badge variant="outline" className="text-green-500 border-green-500">平衡</Badge>;
    }
  };

  return (
    <Card className="ark-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowRight className="h-5 w-5 text-gray-500" />
          产品销售明细
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {productSales.map(sale => {
            const hasDelivery = sale.deliveryDemand > 0 || sale.deliverySales > 0;
            return (
              <div key={sale.productId} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">
                    {sale.icon} {sale.productName}
                  </span>
                  {getBottleneckBadge(sale.bottleneck)}
                </div>

                {/* 双通道表格 */}
                <div className="text-xs">
                  {/* 表头 */}
                  <div className="grid grid-cols-5 gap-1 text-muted-foreground mb-1 text-center">
                    <div className="text-left">通道</div>
                    <div>需求</div>
                    <div>供给</div>
                    <div>销量</div>
                    <div>收入</div>
                  </div>

                  {/* 堂食行 */}
                  <div className="grid grid-cols-5 gap-1 text-center py-0.5">
                    <div className="text-left text-emerald-400">堂食</div>
                    <div className="font-mono">{sale.dineInDemand}</div>
                    <div className="text-slate-600">-</div>
                    <div className="font-mono">{sale.dineInSales}</div>
                    <div className="font-mono">{formatMoney(sale.dineInRevenue)}</div>
                  </div>

                  {/* 外卖行 */}
                  {hasDelivery && (
                    <div className="grid grid-cols-5 gap-1 text-center py-0.5">
                      <div className="text-left text-orange-400">外卖</div>
                      <div className="font-mono">{sale.deliveryDemand}</div>
                      <div className="text-slate-600">-</div>
                      <div className="font-mono">{sale.deliverySales}</div>
                      <div className="font-mono">{formatMoney(sale.deliveryRevenue)}</div>
                    </div>
                  )}

                  {/* 合计行 */}
                  <div className="grid grid-cols-5 gap-1 text-center py-0.5 border-t border-[#1e293b] font-medium">
                    <div className="text-left">合计</div>
                    <div className="font-mono text-blue-400">{sale.demand}</div>
                    <div className="font-mono text-purple-400">{sale.supply}</div>
                    <div className="font-mono text-green-400">{sale.actualSales}</div>
                    <div className="font-mono text-white">{formatMoney(sale.revenue)}</div>
                  </div>
                </div>

                {/* 满足率进度条 */}
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={sale.fulfillmentRate * 100} className="flex-1 h-2" />
                  <span className="text-xs text-muted-foreground">
                    {(sale.fulfillmentRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
