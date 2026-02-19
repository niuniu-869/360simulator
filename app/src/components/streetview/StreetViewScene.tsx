// 街景场景 - 重构为双面板布局
// 左侧：放大的店铺等轴测视图
// 右侧：商圈竞争态势列表
import { useMemo } from 'react';
import type { GameState, SupplyDemandResult } from '@/types/game';
import { getCurrentSolarTerm } from '@/data/streetviewData';
import { SkyLayer } from './SkyLayer';
import { PlayerStoreView } from './PlayerStoreView';
import { CompetitorPanel } from './CompetitorPanel';

interface StreetViewSceneProps {
  gameState: GameState;
  supplyDemandResult: SupplyDemandResult;
}

export function StreetViewScene({ gameState, supplyDemandResult }: StreetViewSceneProps) {
  const area = gameState.selectedAddress?.area || gameState.storeArea || 30;
  const solarTerm = useMemo(
    () => getCurrentSolarTerm(gameState.startMonth, gameState.currentWeek),
    [gameState.startMonth, gameState.currentWeek]
  );
  const storeScale = useMemo(() => {
    if (area >= 66) return 0.92;
    if (area >= 51) return 0.98;
    if (area >= 36) return 1.08;
    if (area >= 26) return 1.2;
    if (area >= 16) return 1.32;
    return 1.44;
  }, [area]);
  const storeYOffset = useMemo(() => {
    if (area >= 66) return -8;
    if (area >= 51) return -10;
    if (area >= 36) return -14;
    if (area >= 26) return -18;
    if (area >= 16) return -22;
    return -24;
  }, [area]);

  return (
    <div className="ark-card overflow-hidden" style={{ height: 420 }}>
      {/* 天空层 - 确保粒子可见 */}
      <SkyLayer
        solarTerm={solarTerm}
        currentWeek={gameState.currentWeek}
        totalWeeks={gameState.totalWeeks}
      />

      {/* 双面板布局 */}
      <div
        className="relative flex gap-4 p-4"
        style={{
          height: 340,
          background: 'linear-gradient(180deg, rgba(12,18,32,0.95) 0%, rgba(10,14,23,0.98) 100%)',
        }}
      >
        {/* 左侧：店铺视图（放大） */}
        <div className="flex-1 flex items-center justify-center relative">
          {/* 店铺背景光晕 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.08) 0%, transparent 70%)',
            }}
          />
          <div
            className="relative z-10"
            style={{
              transform: `translateY(${storeYOffset}px) scale(${storeScale})`,
              transformOrigin: 'center center',
            }}
          >
            <PlayerStoreView
              gameState={gameState}
              supplyDemandResult={supplyDemandResult}
            />
          </div>
        </div>

        {/* 右侧：商圈竞争态势 */}
        <div className="w-72 shrink-0">
          <CompetitorPanel
            nearbyShops={gameState.nearbyShops || []}
            playerExposure={gameState.exposure}
            playerReputation={gameState.reputation}
          />
        </div>
      </div>
    </div>
  );
}
