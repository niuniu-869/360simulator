// 等轴测剖面视图 - 玩家店铺主组件
// v2.8 重构：修复人物堆叠，重做店内外动效与经营态势 HUD
import { useMemo } from 'react';
import type { GameState, SupplyDemandResult } from '@/types/game';
import { getStoreSizeByArea, getDoorPosition } from './store/storePaths';
import { getDecorationVisual } from '@/data/streetviewData';
import { StoreBuilding } from './store/StoreBuilding';
import { StoreInterior } from './store/StoreInterior';
import { StoreAmbiance } from './store/StoreAmbiance';
import { StoreExterior } from './store/StoreExterior';
import { StoreIndicators } from './store/StoreIndicators';
import './streetview.css';

interface PlayerStoreViewProps {
  gameState: GameState;
  supplyDemandResult: SupplyDemandResult;
}

// 人行道额外高度（建筑前沿最低点在 size.height+10 处，需要额外空间放置人行道）
const SIDEWALK_HEIGHT = 40;

export function PlayerStoreView({ gameState, supplyDemandResult }: PlayerStoreViewProps) {
  const area = gameState.selectedAddress?.area || gameState.storeArea || 30;
  const size = getStoreSizeByArea(area);
  const deco = getDecorationVisual(gameState.selectedDecoration?.id);
  const brandName = gameState.selectedBrand?.name || '我的店';
  const totalHeight = size.height + SIDEWALK_HEIGHT;

  // 从 gameState 提取经营指标
  const { exposure, reputation, cleanliness, staff, deliveryState } = gameState;

  // 从 supplyDemandResult 计算满足率
  const fulfillmentRate = useMemo(() => {
    const totalDemand = supplyDemandResult.demand?.totalDemand ?? 0;
    const totalSales = supplyDemandResult.totalSales ?? 0;
    return totalDemand > 0 ? Math.min(1, totalSales / totalDemand) : 0;
  }, [supplyDemandResult]);

  // 计算员工统计
  const chefCount = staff.filter(s => s.assignedTask === 'chef').length;
  const waiterCount = staff.filter(s => s.assignedTask === 'waiter' || s.assignedTask === 'cashier').length;
  const cleanerCount = staff.filter(s => s.assignedTask === 'cleaner').length;

  // 计算员工平均士气和效率
  const { avgMorale, avgEfficiency } = useMemo(() => {
    if (staff.length === 0) return { avgMorale: 50, avgEfficiency: 50 };
    const totalMorale = staff.reduce((sum, s) => sum + (s.morale ?? 70), 0);
    const totalEfficiency = staff.reduce((sum, s) => sum + (s.efficiency ?? 80), 0);
    return {
      avgMorale: totalMorale / staff.length,
      avgEfficiency: totalEfficiency / staff.length,
    };
  }, [staff]);

  // 计算堂食上座率
  const occupancyRate = useMemo(() => {
    const totalDineInDemand = supplyDemandResult.productSales.reduce(
      (sum, ps) => sum + ps.actualSales,
      0
    ) - (supplyDemandResult.deliverySales ?? 0);
    const dineInSales = Math.max(0, totalDineInDemand);
    const maxSeats = size.maxSeats;
    const rate = maxSeats > 0 ? dineInSales / (maxSeats * 7) : 0;
    const jitter = ((dineInSales * 7) % 100) / 1000 - 0.05;
    return Math.min(1, Math.max(0, rate + jitter));
  }, [supplyDemandResult, size.maxSeats]);

  // 外卖平台统计
  const deliveryPlatformCount = deliveryState.platforms.length;
  const avgPlatformRating = deliveryState.platformRating ?? 4.5;
  const deliveryOrderRate = useMemo(() => {
    const deliverySales = supplyDemandResult.deliverySales ?? 0;
    const totalSales = supplyDemandResult.totalSales ?? 0;
    return totalSales > 0 ? deliverySales / totalSales : 0;
  }, [supplyDemandResult]);

  // 是否有活跃营销活动
  const hasActiveMarketing = gameState.activeMarketingActivities.length > 0;

  // 装修是否有发光效果
  const hasGlowEffect = deco.glowEffect;

  // 门口坐标（供 StoreExterior 使用）
  const doorPos = useMemo(() => getDoorPosition(size), [size]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size.width, height: totalHeight }}
    >
      <svg
        width={size.width}
        height={totalHeight}
        viewBox={`0 0 ${size.width} ${totalHeight}`}
        className="overflow-visible"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
      >
        {/* 氛围效果层（最底层） */}
        <StoreAmbiance
          area={area}
          chefCount={chefCount}
          fulfillmentRate={fulfillmentRate}
          cleanliness={cleanliness}
          reputation={reputation}
          exposure={exposure}
        />

        {/* 建筑主体 */}
        <StoreBuilding
          area={area}
          decorationId={gameState.selectedDecoration?.id}
          brandName={brandName}
          exposure={exposure}
          reputation={reputation}
          hasGlowEffect={hasGlowEffect}
        />

        {/* 内部元素（厨房/用餐区） */}
        <StoreInterior
          area={area}
          chefCount={chefCount}
          waiterCount={waiterCount}
          cleanerCount={cleanerCount}
          occupancyRate={occupancyRate}
          avgEfficiency={avgEfficiency}
          avgMorale={avgMorale}
        />

        {/* 店外动效层（行人/骑手） */}
        <StoreExterior
          area={area}
          exposure={exposure}
          occupancyRate={occupancyRate}
          deliveryPlatformCount={deliveryPlatformCount}
          deliveryOrderRate={deliveryOrderRate}
          currentWeek={gameState.currentWeek}
          doorX={doorPos.x}
          doorY={doorPos.y}
        />
      </svg>

      {/* HTML overlay 指示器（SVG 外部，避免坐标冲突） */}
      <StoreIndicators
        width={size.width}
        height={totalHeight}
        chefCount={chefCount}
        maxChefs={size.maxChefs}
        waiterCount={waiterCount}
        cleanerCount={cleanerCount}
        deliveryPlatformCount={deliveryPlatformCount}
        avgPlatformRating={avgPlatformRating}
        deliveryOrderRate={deliveryOrderRate}
        hasActiveMarketing={hasActiveMarketing}
        cleanliness={cleanliness}
        exposure={exposure}
        occupancyRate={occupancyRate}
      />
    </div>
  );
}
