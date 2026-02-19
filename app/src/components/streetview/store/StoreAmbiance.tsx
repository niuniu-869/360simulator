// 店铺氛围效果组件 - 蒸汽、灯光、灰尘等动态效果
import { useMemo } from 'react';
import { getStoreSizeByArea, isoToScreen } from './storePaths';

interface StoreAmbianceProps {
  area: number;
  chefCount: number;
  fulfillmentRate: number;  // 0-1，满足率 → 蒸汽量
  cleanliness: number;      // 0-100，整洁度 → 灰尘密度
  reputation: number;       // 0-100，口碑 → 整体氛围
  exposure: number;         // 0-100，曝光度 → 灯光亮度
}

export function StoreAmbiance({
  area,
  chefCount,
  fulfillmentRate,
  cleanliness,
  reputation,
  exposure,
}: StoreAmbianceProps) {
  const size = getStoreSizeByArea(area);

  // 计算蒸汽位置（厨房上方）
  const steamPositions = useMemo(() => {
    const { isoWidth: w, isoDepth: d, isoHeight: h } = size;
    const centerX = size.width / 2;
    const centerY = size.height / 2 + 10;
    const baseY = centerY + h / 2;

    const kitchenStartX = w * (1 - size.kitchenWidth);
    const positions: { x: number; y: number }[] = [];

    // 每个厨师位置上方生成蒸汽
    for (let i = 0; i < chefCount; i++) {
      const kx = kitchenStartX + (w * size.kitchenWidth) * ((i + 0.5) / Math.max(1, size.maxChefs));
      const ky = d * 0.7;
      const screen = isoToScreen(kx, ky, h * 0.3);
      positions.push({
        x: screen.x + centerX,
        y: screen.y + baseY - 15,
      });
    }
    return positions;
  }, [size, chefCount]);

  // 蒸汽数量基于满足率
  const steamCount = Math.round(fulfillmentRate * 3 * chefCount);

  // 灰尘粒子数量基于整洁度（整洁度越低，灰尘越多）
  const dustCount = cleanliness < 50 ? Math.round((50 - cleanliness) / 10) : 0;

  // 灰尘位置（确定性分布在地面，基于索引生成伪随机）
  const dustPositions = useMemo(() => {
    const positions: { x: number; y: number; delay: number; size: number }[] = [];
    for (let i = 0; i < dustCount; i++) {
      // 使用确定性伪随机（基于索引和整洁度）
      const seed = (i * 137 + cleanliness * 17) % 100;
      const seed2 = (i * 89 + cleanliness * 23) % 100;
      positions.push({
        x: 20 + (seed / 100) * (size.width - 40),
        y: size.height * 0.5 + (seed2 / 100) * (size.height * 0.3),
        delay: (i * 1.2) % 5,
        size: 2 + (seed % 30) / 10,
      });
    }
    return positions;
  }, [dustCount, size, cleanliness]);

  // 环境光效果
  const ambientLightOpacity = 0.05 + (exposure / 100) * 0.15;
  const warmGlow = reputation > 60;

  return (
    <g className="store-ambiance">
      {/* 环境光晕 */}
      <defs>
        <radialGradient id="ambient-glow" cx="50%" cy="40%" r="60%">
          <stop
            offset="0%"
            stopColor={warmGlow ? '#fef3c7' : '#e0f2fe'}
            stopOpacity={ambientLightOpacity}
          />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        {/* 蒸汽渐变 */}
        <linearGradient id="steam-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 环境光 */}
      <rect
        x={0}
        y={0}
        width={size.width}
        height={size.height}
        fill="url(#ambient-glow)"
        pointerEvents="none"
      />

      {/* 蒸汽效果 */}
      {steamPositions.map((pos, i) =>
        Array.from({ length: Math.ceil(steamCount / Math.max(1, steamPositions.length)) }).map((_, j) => (
          <g
            key={`steam-${i}-${j}`}
            className="sv-steam"
            style={{
              animationDelay: `${(i * 0.5 + j * 0.8) % 3}s`,
              animationDuration: `${2 + ((i * 7 + j * 13) % 10) / 10}s`,
            }}
          >
            <ellipse
              cx={pos.x + (j - 1) * 6}
              cy={pos.y}
              rx={4 + j * 2}
              ry={6 + j * 3}
              fill="url(#steam-gradient)"
              opacity={0.3 + fulfillmentRate * 0.3}
            />
          </g>
        ))
      )}

      {/* 厨房火焰效果（有厨师时） */}
      {chefCount > 0 && (
        <g className="sv-kitchen-glow">
          {steamPositions.map((pos, i) => (
            <circle
              key={`flame-glow-${i}`}
              cx={pos.x}
              cy={pos.y + 20}
              r={8}
              fill="#ff6b35"
              opacity={0.15}
              className="sv-flame-glow"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </g>
      )}

      {/* 灰尘粒子（整洁度低时） */}
      {dustPositions.map((dust, i) => (
        <circle
          key={`dust-${i}`}
          cx={dust.x}
          cy={dust.y}
          r={dust.size}
          fill="#8b7355"
          opacity={0.3}
          className="sv-dust"
          style={{
            animationDelay: `${dust.delay}s`,
            animationDuration: `${4 + ((i * 17) % 20) / 10}s`,
          }}
        />
      ))}

      {/* 整洁度低时的脏污覆盖层 */}
      {cleanliness < 40 && (
        <rect
          x={0}
          y={size.height * 0.4}
          width={size.width}
          height={size.height * 0.6}
          fill="#5c4a3a"
          opacity={(40 - cleanliness) / 200}
          pointerEvents="none"
        />
      )}

      {/* 口碑好时的温馨光效 */}
      {reputation > 70 && (
        <g className="sv-warm-ambiance">
          <circle
            cx={size.width / 2}
            cy={size.height * 0.4}
            r={size.width * 0.3}
            fill="#fef3c7"
            opacity={0.08}
          />
        </g>
      )}
    </g>
  );
}
