// 等轴测店铺建筑主体 SVG 组件
import { useMemo } from 'react';
import { getStoreSizeByArea, getDecorationColors, isoToScreen } from './storePaths';

interface StoreBuildingProps {
  area: number;
  decorationId?: string;
  brandName: string;
  exposure: number;      // 0-100，影响招牌亮度
  reputation: number;    // 0-100，影响整体色调
  hasGlowEffect: boolean;
}

export function StoreBuilding({
  area,
  decorationId,
  brandName,
  exposure,
  reputation,
  hasGlowEffect,
}: StoreBuildingProps) {
  const size = getStoreSizeByArea(area);
  const colors = getDecorationColors(decorationId);

  // 计算建筑路径和坐标
  const building = useMemo(() => {
    const { isoWidth: w, isoDepth: d, isoHeight: h } = size;
    const centerX = size.width / 2;
    const centerY = size.height / 2 + 10; // 留出招牌空间

    // 地面四个角点
    const f = [
      isoToScreen(0, 0, 0),
      isoToScreen(w, 0, 0),
      isoToScreen(w, d, 0),
      isoToScreen(0, d, 0),
    ].map(p => ({ x: p.x + centerX, y: p.y + centerY + h / 2 }));

    // 屋顶四个角点
    const r = [
      isoToScreen(0, 0, h),
      isoToScreen(w, 0, h),
      isoToScreen(w, d, h),
      isoToScreen(0, d, h),
    ].map(p => ({ x: p.x + centerX, y: p.y + centerY + h / 2 }));

    return {
      floor: `M ${f[0].x} ${f[0].y} L ${f[1].x} ${f[1].y} L ${f[2].x} ${f[2].y} L ${f[3].x} ${f[3].y} Z`,
      leftWall: `M ${f[0].x} ${f[0].y} L ${f[3].x} ${f[3].y} L ${r[3].x} ${r[3].y} L ${r[0].x} ${r[0].y} Z`,
      rightWall: `M ${f[0].x} ${f[0].y} L ${f[1].x} ${f[1].y} L ${r[1].x} ${r[1].y} L ${r[0].x} ${r[0].y} Z`,
      roof: `M ${r[0].x} ${r[0].y} L ${r[1].x} ${r[1].y} L ${r[2].x} ${r[2].y} L ${r[3].x} ${r[3].y} Z`,
      // 招牌位置（屋顶前沿上方）
      signPos: { x: (r[0].x + r[1].x) / 2, y: r[0].y - 8 },
      // 门的位置（右墙底部中间）
      doorPos: { x: (f[0].x + f[1].x) / 2, y: (f[0].y + f[1].y) / 2 },
      // 窗户位置
      windowPos: { x: (f[0].x + f[3].x) / 2, y: (f[0].y + r[0].y) / 2 },
      coords: { f, r, w, d, h },
    };
  }, [size]);

  // 根据口碑调整色调（暖色=好口碑，冷色=差口碑）
  const warmthFilter = useMemo(() => {
    const warmth = (reputation - 50) / 100; // -0.5 到 0.5
    if (warmth > 0.1) return 'sepia(0.15) saturate(1.1)';
    if (warmth < -0.1) return 'saturate(0.85) hue-rotate(-5deg)';
    return 'none';
  }, [reputation]);

  // 招牌亮度基于曝光度
  const signOpacity = 0.6 + (exposure / 100) * 0.4;
  const glowIntensity = hasGlowEffect ? 0.3 + (exposure / 100) * 0.5 : 0;

  return (
    <g className="store-building" style={{ filter: warmthFilter }}>
      {/* 地面阴影 */}
      <ellipse
        cx={size.width / 2}
        cy={size.height - 15}
        rx={size.isoWidth * 0.7}
        ry={size.isoDepth * 0.25}
        fill="rgba(0,0,0,0.3)"
        className="sv-shadow"
      />

      {/* 地板 */}
      <path d={building.floor} fill={colors.floorFill} stroke="#1a1a1a" strokeWidth="0.5" />

      {/* 左墙（背面） */}
      <path d={building.leftWall} fill={colors.leftWallFill} stroke="#1a1a1a" strokeWidth="0.5" />

      {/* 左墙窗户 */}
      <Window
        x={building.windowPos.x - 8}
        y={building.windowPos.y - 5}
        width={16}
        height={12}
        lit={exposure > 30}
        accentColor={colors.accentColor}
      />

      {/* 右墙（正面） */}
      <path d={building.rightWall} fill={colors.rightWallFill} stroke="#1a1a1a" strokeWidth="0.5" />

      {/* 等轴测门（平行四边形，沿前沿方向） */}
      <IsoDoor
        cx={building.doorPos.x}
        cy={building.doorPos.y}
        halfWidth={7}
        height={20}
        accentColor={colors.accentColor}
      />

      {/* 右墙窗户 */}
      <Window
        x={building.doorPos.x + 12}
        y={building.doorPos.y - 12}
        width={14}
        height={10}
        lit={exposure > 20}
        accentColor={colors.accentColor}
      />

      {/* 屋顶 */}
      <path d={building.roof} fill={colors.roofFill} stroke="#1a1a1a" strokeWidth="0.5" />

      {/* 招牌 */}
      <g className={hasGlowEffect ? 'sv-sign-glow-svg' : ''}>
        {/* 招牌背景 */}
        <rect
          x={building.signPos.x - 35}
          y={building.signPos.y - 10}
          width={70}
          height={16}
          rx={2}
          fill={colors.signBg}
          opacity={signOpacity}
          stroke={colors.accentColor}
          strokeWidth="0.5"
        />
        {/* 招牌文字 */}
        <text
          x={building.signPos.x}
          y={building.signPos.y + 2}
          textAnchor="middle"
          fill={colors.signText}
          fontSize="9"
          fontWeight="bold"
          style={{ letterSpacing: '0.5px' }}
        >
          {brandName.length > 6 ? brandName.slice(0, 6) + '…' : brandName}
        </text>
        {/* 招牌发光效果 */}
        {hasGlowEffect && glowIntensity > 0 && (
          <rect
            x={building.signPos.x - 35}
            y={building.signPos.y - 10}
            width={70}
            height={16}
            rx={2}
            fill="none"
            stroke={colors.glowColor}
            strokeWidth="2"
            opacity={glowIntensity}
            className="sv-sign-glow-rect"
          />
        )}
      </g>
    </g>
  );
}

// 窗户子组件
function Window({
  x,
  y,
  width,
  height,
  lit,
  accentColor,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  lit: boolean;
  accentColor: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={lit ? 'rgba(255, 247, 200, 0.6)' : 'rgba(30, 30, 40, 0.8)'}
        stroke="#1a1a1a"
        strokeWidth="0.5"
        rx={1}
      />
      {/* 窗框 */}
      <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke="#1a1a1a" strokeWidth="0.5" />
      <line x1={x} y1={y + height / 2} x2={x + width} y2={y + height / 2} stroke="#1a1a1a" strokeWidth="0.5" />
      {/* 灯光效果 */}
      {lit && (
        <rect
          x={x + 1}
          y={y + 1}
          width={width - 2}
          height={height - 2}
          fill={accentColor}
          opacity={0.15}
          className="sv-window-glow"
        />
      )}
    </g>
  );
}

// 等轴测门子组件（平行四边形，沿前沿30°角）
function IsoDoor({
  cx,
  cy,
  halfWidth,
  height,
  accentColor,
}: {
  cx: number;
  cy: number;
  halfWidth: number;
  height: number;
  accentColor: string;
}) {
  const cos30 = 0.866;
  const sin30 = 0.5;

  // 底边两端（沿前沿方向）
  const bl = { x: cx - halfWidth * cos30, y: cy - halfWidth * sin30 };
  const br = { x: cx + halfWidth * cos30, y: cy + halfWidth * sin30 };
  // 顶边两端（垂直向上）
  const tl = { x: bl.x, y: bl.y - height };
  const tr = { x: br.x, y: br.y - height };

  const doorPath = `M ${bl.x} ${bl.y} L ${br.x} ${br.y} L ${tr.x} ${tr.y} L ${tl.x} ${tl.y} Z`;

  // 门板（门框内缩 4%，纯路径计算避免 SVG/CSS transform 混用）
  const inset = 0.04;
  const pbl = { x: bl.x + (cx - bl.x) * inset + 0.5, y: bl.y + (cy - bl.y) * inset + 0.5 };
  const pbr = { x: br.x + (cx - br.x) * inset + 0.5, y: br.y + (cy - br.y) * inset + 0.5 };
  const ptl = { x: tl.x + (cx - tl.x) * inset + 0.5, y: tl.y + ((cy - height) - tl.y) * inset + 0.5 };
  const ptr = { x: tr.x + (cx - tr.x) * inset + 0.5, y: tr.y + ((cy - height) - tr.y) * inset + 0.5 };
  const panelPath = `M ${pbl.x} ${pbl.y} L ${pbr.x} ${pbr.y} L ${ptr.x} ${ptr.y} L ${ptl.x} ${ptl.y} Z`;

  // 玻璃区域（上部 40%）
  const glassTop = 3;
  const glassH = height * 0.38;
  const gbl = { x: bl.x + 1, y: bl.y - height + glassTop + glassH };
  const gbr = { x: br.x + 1, y: br.y - height + glassTop + glassH };
  const gtl = { x: bl.x + 1, y: bl.y - height + glassTop };
  const gtr = { x: br.x + 1, y: br.y - height + glassTop };
  const glassPath = `M ${gbl.x} ${gbl.y} L ${gbr.x} ${gbr.y} L ${gtr.x} ${gtr.y} L ${gtl.x} ${gtl.y} Z`;

  // 门前台阶（门底边向外延伸的小平行四边形）
  const stepDepth = 4;
  const perpX = sin30;
  const perpY = -cos30;
  const sbl = { x: bl.x + perpX * stepDepth, y: bl.y + perpY * stepDepth };
  const sbr = { x: br.x + perpX * stepDepth, y: br.y + perpY * stepDepth };
  const stepPath = `M ${bl.x} ${bl.y} L ${br.x} ${br.y} L ${sbr.x} ${sbr.y} L ${sbl.x} ${sbl.y} Z`;

  // 门把手位置（右侧偏下）
  const handleX = cx + halfWidth * cos30 * 0.5;
  const handleY = cy + halfWidth * sin30 * 0.5 - height * 0.45;

  return (
    <g>
      {/* 门前台阶 */}
      <path d={stepPath} fill="rgba(255,255,255,0.08)" stroke="#1a1a1a" strokeWidth="0.3" />
      {/* 门框 */}
      <path d={doorPath} fill="#1a1a1a" stroke="#0a0a0a" strokeWidth="0.5" />
      {/* 门板 */}
      <path d={panelPath} fill="#2a2a2a" />
      {/* 门上玻璃 */}
      <path d={glassPath} fill="rgba(255, 247, 200, 0.3)" />
      {/* 门把手 */}
      <circle cx={handleX} cy={handleY} r={1.5} fill={accentColor} />
    </g>
  );
}
