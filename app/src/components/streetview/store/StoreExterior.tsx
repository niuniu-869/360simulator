// 店外动效层 — 等轴测人行道、行人流、门口顾客、进店动画、外卖骑手
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { getStoreSizeByArea, getFrontEdge, ISO_FRONT_DIR, ISO_PERP_DIR, seededRandom } from './storePaths';
import { PedestrianFigure, DeliveryRider } from './figures';

interface StoreExteriorProps {
  area: number;
  exposure: number;          // 0-100，影响行人数量
  occupancyRate: number;     // 0-1，影响进店频率
  deliveryPlatformCount: number;
  deliveryOrderRate: number; // 外卖订单率 0-1
  currentWeek: number;       // 用于确定性随机种子
  doorX: number;             // 门口 x 坐标
  doorY: number;             // 门口 y 坐标
}

// 人行道距建筑前沿的垂直偏移（沿 ISO_PERP_DIR 方向，指向店外）
const NEAR_LANE_OFFSET = 12;
const FAR_LANE_OFFSET = 24;
const ENTRANCE_DEPTH = NEAR_LANE_OFFSET;

export function StoreExterior({
  area,
  exposure,
  occupancyRate,
  deliveryPlatformCount,
  deliveryOrderRate,
  currentWeek,
  doorX,
  doorY,
}: StoreExteriorProps) {
  const size = getStoreSizeByArea(area);

  const { f0x, f0y, f1x, f1y, edgeLen } = useMemo(() => {
    const { f0, f1 } = getFrontEdge(size);
    return {
      f0x: f0.x,
      f0y: f0.y,
      f1x: f1.x,
      f1y: f1.y,
      edgeLen: Math.sqrt((f1.x - f0.x) ** 2 + (f1.y - f0.y) ** 2),
    };
  }, [size]);

  const { dx: fdx, dy: fdy } = ISO_FRONT_DIR;  // 沿前沿方向
  const { dx: pdx, dy: pdy } = ISO_PERP_DIR;   // 门前外法线方向（指向店外）

  const nearLane = {
    x1: f0x + pdx * NEAR_LANE_OFFSET,
    y1: f0y + pdy * NEAR_LANE_OFFSET,
    x2: f1x + pdx * NEAR_LANE_OFFSET,
    y2: f1y + pdy * NEAR_LANE_OFFSET,
  };
  const farLane = {
    x1: f0x + pdx * FAR_LANE_OFFSET,
    y1: f0y + pdy * FAR_LANE_OFFSET,
    x2: f1x + pdx * FAR_LANE_OFFSET,
    y2: f1y + pdy * FAR_LANE_OFFSET,
  };

  const entranceEnd = {
    x: doorX + pdx * ENTRANCE_DEPTH,
    y: doorY + pdy * ENTRANCE_DEPTH,
  };

  const pedestrianCount = Math.max(2, Math.min(8, Math.round(exposure / 18) + 1));

  const pedestrians = useMemo(() => {
    const result: {
      direction: 'left' | 'right';
      laneOffset: number;
      duration: number;
      delay: number;
      seed: number;
      entering: boolean;
      startT: number;
      enterDx: number;
      enterDy: number;
      enterMidDx: number;
      enterMidDy: number;
      enterDuration: number;
    }[] = [];

    for (let i = 0; i < pedestrianCount; i++) {
      const seed = currentWeek * 100 + i;
      const direction = seededRandom(seed) > 0.5 ? 'right' : 'left';
      const laneOffset = seededRandom(seed + 1) > 0.45 ? NEAR_LANE_OFFSET : FAR_LANE_OFFSET;
      const duration = Math.max(6.2, 11.5 - exposure * 0.04 + seededRandom(seed + 2) * 2.4);
      const delay = seededRandom(seed + 3) * 8;
      const enteringChance = Math.min(0.58, occupancyRate * (0.34 + exposure / 170));
      const entering = seededRandom(seed + 4) < enteringChance;

      let startT = 0;
      let enterDx = 0;
      let enterDy = 0;
      let enterMidDx = 0;
      let enterMidDy = 0;
      let enterDuration = 1.6;

      if (entering) {
        const fromLeft = seededRandom(seed + 5) > 0.5;
        startT = fromLeft
          ? 0.06 + seededRandom(seed + 6) * 0.24
          : 0.70 + seededRandom(seed + 6) * 0.24;

        const startOnLane = {
          x: f0x + pdx * laneOffset + (f1x - f0x) * startT,
          y: f0y + pdy * laneOffset + (f1y - f0y) * startT,
        };
        enterDx = doorX - startOnLane.x;
        enterDy = (doorY + 4) - startOnLane.y;

        const sideSign = fromLeft ? 1 : -1;
        enterMidDx = enterDx * 0.56 + fdx * sideSign * 14 + pdx * 4;
        enterMidDy = enterDy * 0.56 + fdy * sideSign * 14 + pdy * 4;
        enterDuration = 1.35 + seededRandom(seed + 7) * 0.9;
      }

      result.push({
        direction,
        laneOffset,
        duration,
        delay,
        seed,
        entering,
        startT,
        enterDx,
        enterDy,
        enterMidDx,
        enterMidDy,
        enterDuration,
      });
    }

    return result;
  }, [pedestrianCount, currentWeek, f0x, f0y, f1x, f1y, doorX, doorY, exposure, occupancyRate, fdx, fdy, pdx, pdy]);

  const riderCount = deliveryOrderRate > 0.03
    ? Math.min(4, Math.max(1, Math.round(deliveryPlatformCount * (0.5 + deliveryOrderRate))))
    : 0;

  const outboundRiders = useMemo(() => {
    const result: {
      delay: number;
      seed: number;
      yOffset: number;
      duration: number;
      direction: 'left' | 'right';
    }[] = [];
    for (let i = 0; i < riderCount; i++) {
      const seed = currentWeek * 200 + i * 31;
      result.push({
        delay: i * 2.8 + seededRandom(seed) * 1.8,
        seed,
        yOffset: (seededRandom(seed + 1) - 0.5) * 4,
        duration: Math.max(3.1, 5.2 - deliveryOrderRate * 2.2 + seededRandom(seed + 2) * 0.9),
        direction: seededRandom(seed + 3) > 0.5 ? 'right' : 'left',
      });
    }
    return result;
  }, [riderCount, currentWeek, deliveryOrderRate]);

  const inboundRiders = useMemo(() => {
    const count = riderCount > 0 ? Math.min(3, riderCount + 1) : 0;
    const result: {
      seed: number;
      side: 'left' | 'right';
      startX: number;
      startY: number;
      turnDx: number;
      turnDy: number;
      turnMidDx: number;
      turnMidDy: number;
      delay: number;
      duration: number;
    }[] = [];

    for (let i = 0; i < count; i++) {
      const seed = currentWeek * 260 + i * 37;
      const side = i % 2 === 0 ? 'left' : 'right';
      const sideSign = side === 'left' ? -1 : 1;
      const spread = 34 + seededRandom(seed + 1) * 18;

      const startX = entranceEnd.x + fdx * spread * sideSign + pdx * (2 + seededRandom(seed + 2) * 5);
      const startY = entranceEnd.y + fdy * spread * sideSign + pdy * (2 + seededRandom(seed + 2) * 5);

      const turnDx = doorX - startX;
      const turnDy = (doorY + 3) - startY;
      const turnMidDx = turnDx * 0.58 - fdx * sideSign * 14 + pdx * 4;
      const turnMidDy = turnDy * 0.58 - fdy * sideSign * 14 + pdy * 4;

      result.push({
        seed,
        side,
        startX,
        startY,
        turnDx,
        turnDy,
        turnMidDx,
        turnMidDy,
        delay: 1 + i * 2.2 + seededRandom(seed + 3) * 1.4,
        duration: Math.max(2.2, 3.9 - deliveryOrderRate * 1.2 + seededRandom(seed + 4) * 0.7),
      });
    }

    return result;
  }, [riderCount, currentWeek, deliveryOrderRate, entranceEnd.x, entranceEnd.y, doorX, doorY, fdx, fdy, pdx, pdy]);

  const doorCustomers = useMemo(() => {
    const count = occupancyRate > 0.15 ? Math.min(3, Math.round(occupancyRate * 4)) : 0;
    const result: { x: number; y: number; seed: number; direction: 'left' | 'right' }[] = [];
    for (let i = 0; i < count; i++) {
      const seed = currentWeek * 300 + i;
      const depthT = 0.28 + seededRandom(seed) * 0.52;
      const spreadT = (i - (count - 1) / 2) * 0.15;
      result.push({
        x: doorX + pdx * ENTRANCE_DEPTH * depthT + fdx * spreadT * edgeLen * 0.15,
        y: doorY + pdy * ENTRANCE_DEPTH * depthT + fdy * spreadT * edgeLen * 0.15,
        seed,
        direction: i % 2 === 0 ? 'left' : 'right',
      });
    }
    return result;
  }, [occupancyRate, currentWeek, doorX, doorY, edgeLen, fdx, fdy, pdx, pdy]);

  const riderLineStart = {
    x: entranceEnd.x + fdx * 8 + pdx * 3,
    y: entranceEnd.y + fdy * 8 + pdy * 3,
  };
  const riderLineEnd = {
    x: nearLane.x2 + fdx * 26,
    y: nearLane.y2 + fdy * 26,
  };

  const walkStartX = -fdx * 46;
  const walkStartY = -fdy * 46;
  const walkEndX = fdx * (edgeLen + 168);
  const walkEndY = fdy * (edgeLen + 168);

  const sidewalkPath = `M ${nearLane.x1} ${nearLane.y1} L ${nearLane.x2} ${nearLane.y2} L ${farLane.x2} ${farLane.y2} L ${farLane.x1} ${farLane.y1} Z`;
  const entranceHalfW = 12;
  const entrancePath =
    `M ${doorX - fdx * entranceHalfW} ${doorY - fdy * entranceHalfW} ` +
    `L ${doorX + fdx * entranceHalfW} ${doorY + fdy * entranceHalfW} ` +
    `L ${entranceEnd.x + fdx * entranceHalfW} ${entranceEnd.y + fdy * entranceHalfW} ` +
    `L ${entranceEnd.x - fdx * entranceHalfW} ${entranceEnd.y - fdy * entranceHalfW} Z`;

  return (
    <g className="store-exterior">
      <path d={sidewalkPath} fill="rgba(255,255,255,0.03)" />
      <path d={entrancePath} fill="rgba(255,255,255,0.07)" />

      <line
        x1={doorX}
        y1={doorY + 2}
        x2={entranceEnd.x}
        y2={entranceEnd.y}
        stroke="rgba(251,191,36,0.2)"
        strokeWidth={1.5}
        strokeDasharray="3 2"
      />

      <line
        x1={nearLane.x1}
        y1={nearLane.y1}
        x2={nearLane.x2}
        y2={nearLane.y2}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />
      <line
        x1={farLane.x1}
        y1={farLane.y1}
        x2={farLane.x2}
        y2={farLane.y2}
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />

      <path
        d={`M ${entranceEnd.x - fdx * 42} ${entranceEnd.y - fdy * 42} Q ${entranceEnd.x - fdx * 18} ${entranceEnd.y - fdy * 18 - 4} ${doorX - 1} ${doorY + 4}`}
        fill="none"
        stroke="rgba(251,191,36,0.16)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <path
        d={`M ${entranceEnd.x + fdx * 42} ${entranceEnd.y + fdy * 42} Q ${entranceEnd.x + fdx * 18} ${entranceEnd.y + fdy * 18 - 4} ${doorX + 1} ${doorY + 4}`}
        fill="none"
        stroke="rgba(251,191,36,0.16)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />

      {occupancyRate > 0.08 && (
        <>
          <circle cx={doorX - 2} cy={doorY + 3} r={1.2} fill="rgba(251,191,36,0.75)" />
          <circle cx={doorX + 2} cy={doorY + 3} r={1.2} fill="rgba(251,191,36,0.75)" />
        </>
      )}

      {doorCustomers.map((c, i) => (
        <g key={`door-${i}`} className="sv-door-idle">
          <PedestrianFigure x={c.x} y={c.y} seed={c.seed} direction={c.direction} />
        </g>
      ))}

      {pedestrians.map((p, i) => {
        const laneStart = {
          x: f0x + pdx * p.laneOffset,
          y: f0y + pdy * p.laneOffset,
        };

        if (p.entering) {
          const startOnLane = {
            x: laneStart.x + (f1x - f0x) * p.startT,
            y: laneStart.y + (f1y - f0y) * p.startT,
          };
          return (
            <g key={`ped-${i}`} transform={`translate(${startOnLane.x}, ${startOnLane.y})`}>
              <g
                className="sv-entering-figure"
                style={{
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.enterDuration + 0.6}s`,
                  ['--enter-dx' as string]: `${p.enterDx}px`,
                  ['--enter-dy' as string]: `${p.enterDy}px`,
                  ['--enter-mid-dx' as string]: `${p.enterMidDx}px`,
                  ['--enter-mid-dy' as string]: `${p.enterMidDy}px`,
                } as CSSProperties}
              >
                <PedestrianFigure x={0} y={0} seed={p.seed} direction={p.direction} />
              </g>
            </g>
          );
        }

        return (
          <g key={`ped-${i}`} transform={`translate(${laneStart.x}, ${laneStart.y})`}>
            <g
              className={p.direction === 'right' ? 'sv-pedestrian-iso-right' : 'sv-pedestrian-iso-left'}
              style={{
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                ['--walk-start-x' as string]: `${walkStartX}px`,
                ['--walk-start-y' as string]: `${walkStartY}px`,
                ['--walk-end-x' as string]: `${walkEndX}px`,
                ['--walk-end-y' as string]: `${walkEndY}px`,
              } as CSSProperties}
            >
              <PedestrianFigure x={0} y={0} seed={p.seed} direction={p.direction} />
            </g>
          </g>
        );
      })}

      {riderCount > 0 && (
        <line
          x1={riderLineStart.x}
          y1={riderLineStart.y}
          x2={riderLineEnd.x}
          y2={riderLineEnd.y}
          stroke="rgba(34,211,238,0.2)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}

      {inboundRiders.map((r, i) => (
        <g key={`rider-in-${i}`} transform={`translate(${r.startX}, ${r.startY})`}>
          <g
            className="sv-rider-turn-in"
            style={{
              animationDelay: `${r.delay}s`,
              animationDuration: `${r.duration}s`,
              ['--turn-dx' as string]: `${r.turnDx}px`,
              ['--turn-dy' as string]: `${r.turnDy}px`,
              ['--turn-mid-dx' as string]: `${r.turnMidDx}px`,
              ['--turn-mid-dy' as string]: `${r.turnMidDy}px`,
            } as CSSProperties}
          >
            <g transform={r.side === 'right' ? 'scale(-1,1)' : undefined}>
              <DeliveryRider x={0} y={0} seed={r.seed} animated={false} />
            </g>
          </g>
        </g>
      ))}

      {outboundRiders.map((r, i) => {
        const sideSign = r.direction === 'right' ? 1 : -1;
        return (
          <g key={`rider-out-${i}`} transform={`translate(${doorX + fdx * 10}, ${doorY + fdy * 10 + r.yOffset})`}>
            <g
              className="sv-delivery-rider-iso"
              style={{
                animationDelay: `${r.delay}s`,
                animationDuration: `${r.duration}s`,
                ['--rider-out-x' as string]: `${fdx * (edgeLen + 56) * sideSign}px`,
                ['--rider-out-y' as string]: `${fdy * (edgeLen + 56) * sideSign}px`,
              } as CSSProperties}
            >
              <g transform={r.direction === 'left' ? 'scale(-1,1)' : undefined}>
                <DeliveryRider x={0} y={0} seed={r.seed} animated={false} />
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
}
