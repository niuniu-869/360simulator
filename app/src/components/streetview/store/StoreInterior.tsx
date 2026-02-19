// 店铺内部元素组件 - SVG 像素画人物替代 emoji
import { useMemo } from 'react';
import { getStoreSizeByArea, isoToScreen, ensureMinSpacing, seededRandom } from './storePaths';
import { ChefFigure, CustomerFigure, WaiterFigure, CleanerFigure, DiningTable, Stove } from './figures';

interface StoreInteriorProps {
  area: number;
  chefCount: number;
  waiterCount: number;
  cleanerCount: number;
  occupancyRate: number;  // 0-1，上座率
  avgEfficiency: number;  // 0-100，员工效率
  avgMorale: number;      // 0-100，员工士气
}

function keepAwayFromPoints(
  point: { x: number; y: number },
  blockers: { x: number; y: number }[],
  minDist: number,
): { x: number; y: number } {
  const adjusted = { ...point };
  for (const blocker of blockers) {
    const dx = adjusted.x - blocker.x;
    const dy = adjusted.y - blocker.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist && dist > 0.1) {
      const push = minDist - dist;
      adjusted.x += (dx / dist) * push;
      adjusted.y += (dy / dist) * push;
    }
  }
  return adjusted;
}

export function StoreInterior({
  area,
  chefCount,
  waiterCount,
  cleanerCount,
  occupancyRate,
  avgEfficiency,
  avgMorale,
}: StoreInteriorProps) {
  const size = getStoreSizeByArea(area);

  // 计算内部元素位置（放大后空间充裕，间距保证不重叠）
  const interior = useMemo(() => {
    const { isoWidth: w, isoDepth: d, isoHeight: h } = size;
    const centerX = size.width / 2;
    const centerY = size.height / 2 + 10;
    const baseY = centerY + h / 2;

    // 厨房区域（后方）— 灶台 + 厨师位置
    const kitchenStartX = w * (1 - size.kitchenWidth);
    const rawKitchenPositions: { x: number; y: number }[] = [];
    for (let i = 0; i < size.maxChefs; i++) {
      const kx = kitchenStartX + (w * size.kitchenWidth) * ((i + 0.5) / size.maxChefs);
      const ky = d * 0.72;
      const screen = isoToScreen(kx, ky, 0);
      rawKitchenPositions.push({
        x: screen.x + centerX,
        y: screen.y + baseY,
      });
    }
    const kitchenPositions = ensureMinSpacing(rawKitchenPositions, 16);

    // 用餐区域（前方）— 餐桌 + 顾客位置
    const seatsPerRow = Math.ceil(size.maxSeats / size.diningRows);
    const rawDiningPositions: { x: number; y: number; row: number; col: number }[] = [];
    const diningStartX = w * 0.08;
    const diningEndX = kitchenStartX - w * 0.08;
    const diningUsableWidth = Math.max(w * 0.24, diningEndX - diningStartX);
    const diningStartY = d * 0.18;
    const diningUsableDepth = d * 0.58;
    for (let row = 0; row < size.diningRows; row++) {
      for (let col = 0; col < seatsPerRow; col++) {
        const seatIndex = row * seatsPerRow + col;
        if (seatIndex >= size.maxSeats) break;
        const dx = diningStartX + ((col + 0.5) / seatsPerRow) * diningUsableWidth;
        const dy = diningStartY + ((row + 0.5) / size.diningRows) * diningUsableDepth;
        const screen = isoToScreen(dx, dy, 0);
        rawDiningPositions.push({
          x: screen.x + centerX,
          y: screen.y + baseY,
          row,
          col,
        });
      }
    }
    const spacedDining = ensureMinSpacing(
      rawDiningPositions.map(p => ({ x: p.x, y: p.y })),
      14,
    );
    const diningPositions = rawDiningPositions.map((p, i) => ({
      ...p,
      x: spacedDining[i].x,
      y: spacedDining[i].y,
    }));
    const diningXs = diningPositions.map(p => p.x);
    const diningYs = diningPositions.map(p => p.y);
    const diningBounds = {
      minX: Math.min(...diningXs),
      maxX: Math.max(...diningXs),
      minY: Math.min(...diningYs),
      maxY: Math.max(...diningYs),
    };

    // 收银台位置（门口附近）
    const cashierScreen = isoToScreen(w * 0.15, d * 0.15, 0);
    const cashierPos = {
      x: cashierScreen.x + centerX,
      y: cashierScreen.y + baseY,
    };

    // 厨房分隔线
    const dividerStart = isoToScreen(kitchenStartX, 0, 0);
    const dividerEnd = isoToScreen(kitchenStartX, d, 0);

    return {
      kitchenPositions,
      diningPositions,
      diningBounds,
      seatsPerRow,
      cashierPos,
      dividerLine: {
        x1: dividerStart.x + centerX,
        y1: dividerStart.y + baseY,
        x2: dividerEnd.x + centerX,
        y2: dividerEnd.y + baseY,
      },
      serviceNodes: [
        { x: diningBounds.minX + 8, y: diningBounds.minY - 10 },
        { x: diningBounds.maxX - 6, y: diningBounds.minY - 5 },
        { x: diningBounds.maxX - 8, y: diningBounds.maxY + 5 },
        { x: diningBounds.minX + 5, y: diningBounds.maxY + 9 },
      ],
    };
  }, [size]);

  // 计算实际显示的顾客数量
  const occupiedSeats = Math.round(interior.diningPositions.length * occupancyRate);
  const occupiedSeatSet = useMemo(() => {
    const total = interior.diningPositions.length;
    if (total === 0 || occupiedSeats <= 0) return new Set<number>();
    const bySpread = Array.from({ length: total }, (_, i) => i)
      .sort((a, b) => {
        const aRank = (a * 37 + interior.seatsPerRow * 3) % total;
        const bRank = (b * 37 + interior.seatsPerRow * 3) % total;
        return aRank - bRank;
      });
    return new Set(bySpread.slice(0, Math.min(occupiedSeats, total)));
  }, [interior.diningPositions.length, interior.seatsPerRow, occupiedSeats]);

  // 服务员巡回位置（在用餐区内）
  const waiterPositions = useMemo(() => {
    const positions: { x: number; y: number }[] = [];
    const { serviceNodes, diningPositions } = interior;
    for (let i = 0; i < waiterCount && i < 4; i++) {
      const node = serviceNodes[i % serviceNodes.length];
      const jittered = {
        x: node.x + (seededRandom(i * 53 + 11) - 0.5) * 6,
        y: node.y + (seededRandom(i * 71 + 19) - 0.5) * 5,
      };
      positions.push(keepAwayFromPoints(jittered, diningPositions, 13));
    }
    return ensureMinSpacing(positions, 14);
  }, [interior, waiterCount]);

  // 清洁工位置
  const cleanerPositions = useMemo(() => {
    const positions: { x: number; y: number }[] = [];
    const { serviceNodes, diningPositions, diningBounds } = interior;
    for (let i = 0; i < cleanerCount && i < 2; i++) {
      const baseNode = serviceNodes[(i + 2) % serviceNodes.length];
      const patrolShift = i === 0 ? -6 : 6;
      const jittered = {
        x: baseNode.x + patrolShift + (seededRandom(i * 113 + 31) - 0.5) * 5,
        y: Math.max(diningBounds.maxY + 3, baseNode.y + (seededRandom(i * 127 + 37) - 0.5) * 5),
      };
      positions.push(keepAwayFromPoints(jittered, diningPositions, 13));
    }
    return ensureMinSpacing(positions, 14);
  }, [interior, cleanerCount]);

  return (
    <g className="store-interior">
      {/* 厨房分隔线 */}
      <line
        x1={interior.dividerLine.x1}
        y1={interior.dividerLine.y1}
        x2={interior.dividerLine.x2}
        y2={interior.dividerLine.y2}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
        strokeDasharray="3,2"
      />

      {/* 厨房：灶台 + 厨师 */}
      {interior.kitchenPositions.map((pos, i) => (
        <g key={`kitchen-${i}`}>
          <Stove x={pos.x} y={pos.y} active={i < chefCount} />
          {i < chefCount && (
            <ChefFigure
              x={pos.x}
              y={pos.y - 10}
              efficiency={avgEfficiency}
              morale={avgMorale}
              seed={i * 17 + 3}
            />
          )}
        </g>
      ))}

      {/* 用餐区：餐桌 + 顾客 */}
      {interior.diningPositions.map((pos, i) => {
        const isOccupied = occupiedSeatSet.has(i);
        return (
          <g key={`seat-${i}`}>
            <DiningTable x={pos.x} y={pos.y} occupied={isOccupied} />
            {isOccupied && (
              <CustomerFigure
                x={pos.x}
                y={pos.y - 8}
                seed={i * 23 + 7}
                eating={true}
              />
            )}
          </g>
        );
      })}

      {/* 收银台 */}
      <g>
        <path
          d={`M ${interior.cashierPos.x - 5} ${interior.cashierPos.y - 2}
              L ${interior.cashierPos.x + 5} ${interior.cashierPos.y - 2}
              L ${interior.cashierPos.x + 5} ${interior.cashierPos.y + 3}
              L ${interior.cashierPos.x - 5} ${interior.cashierPos.y + 3} Z`}
          fill="#3d5a3d"
          stroke="#2d4a2d"
          strokeWidth={0.5}
        />
        {/* 收银机 */}
        <rect
          x={interior.cashierPos.x - 2}
          y={interior.cashierPos.y - 4}
          width={4}
          height={3}
          rx={0.5}
          fill="#555"
        />
      </g>

      {/* 服务员（巡回） */}
      {waiterPositions.map((pos, i) => (
        <WaiterFigure key={`waiter-${i}`} x={pos.x} y={pos.y} seed={i * 41 + 11} patrolIndex={i} />
      ))}

      {/* 清洁工 */}
      {cleanerPositions.map((pos, i) => (
        <CleanerFigure key={`cleaner-${i}`} x={pos.x} y={pos.y} seed={i * 59 + 19} />
      ))}
    </g>
  );
}
