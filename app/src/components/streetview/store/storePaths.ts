// 等轴测店铺 SVG 路径数据
// 30度等轴测角度，展示店铺内部结构

export interface StoreSize {
  label: string;
  width: number;
  height: number;
  // 等轴测尺寸
  isoWidth: number;   // 等轴测宽度
  isoDepth: number;   // 等轴测深度
  isoHeight: number;  // 等轴测高度（墙高）
  // 内部布局
  kitchenWidth: number;  // 厨房区宽度比例 (0-1)
  diningRows: number;    // 用餐区行数
  maxChefs: number;
  maxSeats: number;
}

// 人物尺寸常量（像素画人物严格控制在此范围内）
export const FIGURE_SIZES = {
  chef:     { w: 8, h: 12 },
  customer: { w: 6, h: 10 },
  waiter:   { w: 7, h: 11 },
  cleaner:  { w: 7, h: 11 },
  pedestrian: { w: 5, h: 8 },
  rider:    { w: 14, h: 10 },
  table:    { w: 10, h: 6 },
  stove:    { w: 12, h: 8 },
} as const;

// 6种店铺尺寸配置（v2.7 放大约40%，解决 emoji 重叠问题）
export const STORE_SIZES: Record<string, StoreSize> = {
  stall: {
    label: '档口',
    width: 224,
    height: 168,
    isoWidth: 112,
    isoDepth: 70,
    isoHeight: 56,
    kitchenWidth: 0.5,
    diningRows: 1,
    maxChefs: 1,
    maxSeats: 3,
  },
  small: {
    label: '小店',
    width: 252,
    height: 189,
    isoWidth: 126,
    isoDepth: 84,
    isoHeight: 63,
    kitchenWidth: 0.4,
    diningRows: 2,
    maxChefs: 2,
    maxSeats: 6,
  },
  standard: {
    label: '标准店',
    width: 280,
    height: 210,
    isoWidth: 140,
    isoDepth: 98,
    isoHeight: 70,
    kitchenWidth: 0.35,
    diningRows: 2,
    maxChefs: 3,
    maxSeats: 9,
  },
  medium: {
    label: '中型店',
    width: 308,
    height: 231,
    isoWidth: 154,
    isoDepth: 112,
    isoHeight: 77,
    kitchenWidth: 0.3,
    diningRows: 3,
    maxChefs: 4,
    maxSeats: 12,
  },
  large: {
    label: '大店',
    width: 336,
    height: 252,
    isoWidth: 168,
    isoDepth: 126,
    isoHeight: 84,
    kitchenWidth: 0.28,
    diningRows: 3,
    maxChefs: 5,
    maxSeats: 16,
  },
  flagship: {
    label: '旗舰店',
    width: 364,
    height: 273,
    isoWidth: 182,
    isoDepth: 140,
    isoHeight: 91,
    kitchenWidth: 0.25,
    diningRows: 4,
    maxChefs: 6,
    maxSeats: 20,
  },
};

// 根据面积获取店铺尺寸
export function getStoreSizeByArea(area: number): StoreSize {
  if (area >= 66) return STORE_SIZES.flagship;
  if (area >= 51) return STORE_SIZES.large;
  if (area >= 36) return STORE_SIZES.medium;
  if (area >= 26) return STORE_SIZES.standard;
  if (area >= 16) return STORE_SIZES.small;
  return STORE_SIZES.stall;
}

// 等轴测坐标转换（30度角）
// 等轴测中：x轴向右下倾斜30度，y轴向左下倾斜30度，z轴垂直向上
const ISO_ANGLE = Math.PI / 6; // 30度
const COS_30 = Math.cos(ISO_ANGLE);
const SIN_30 = Math.sin(ISO_ANGLE);

export function isoToScreen(x: number, y: number, z: number): { x: number; y: number } {
  return {
    x: (x - y) * COS_30,
    y: (x + y) * SIN_30 - z,
  };
}

// 生成等轴测建筑路径
export function generateBuildingPath(size: StoreSize, centerX: number, centerY: number): string {
  const { isoWidth: w, isoDepth: d, isoHeight: h } = size;

  // 地面四个角点（等轴测坐标）
  const floorPoints = [
    isoToScreen(0, 0, 0),      // 前角
    isoToScreen(w, 0, 0),      // 右角
    isoToScreen(w, d, 0),      // 后角
    isoToScreen(0, d, 0),      // 左角
  ];

  // 屋顶四个角点
  const roofPoints = [
    isoToScreen(0, 0, h),
    isoToScreen(w, 0, h),
    isoToScreen(w, d, h),
    isoToScreen(0, d, h),
  ];

  // 偏移到中心
  const offset = (p: { x: number; y: number }) => ({
    x: p.x + centerX,
    y: p.y + centerY + h / 2,
  });

  const f = floorPoints.map(offset);
  const r = roofPoints.map(offset);

  // 生成路径：地面 + 左墙 + 右墙 + 屋顶
  return {
    floor: `M ${f[0].x} ${f[0].y} L ${f[1].x} ${f[1].y} L ${f[2].x} ${f[2].y} L ${f[3].x} ${f[3].y} Z`,
    leftWall: `M ${f[0].x} ${f[0].y} L ${f[3].x} ${f[3].y} L ${r[3].x} ${r[3].y} L ${r[0].x} ${r[0].y} Z`,
    rightWall: `M ${f[0].x} ${f[0].y} L ${f[1].x} ${f[1].y} L ${r[1].x} ${r[1].y} L ${r[0].x} ${r[0].y} Z`,
    roof: `M ${r[0].x} ${r[0].y} L ${r[1].x} ${r[1].y} L ${r[2].x} ${r[2].y} L ${r[3].x} ${r[3].y} Z`,
    // 返回关键坐标用于内部元素定位
    coords: { f, r, centerX, centerY, w, d, h },
  } as unknown as string;
}

// 装修风格颜色映射
export interface DecorationColors {
  floorFill: string;
  leftWallFill: string;
  rightWallFill: string;
  roofFill: string;
  signBg: string;
  signText: string;
  accentColor: string;
  glowColor: string;
}

export const DECORATION_COLORS: Record<string, DecorationColors> = {
  simple: {
    floorFill: '#3f3f46',
    leftWallFill: '#52525b',
    rightWallFill: '#71717a',
    roofFill: '#27272a',
    signBg: '#334155',
    signText: '#cbd5e1',
    accentColor: '#94a3b8',
    glowColor: 'rgba(148, 163, 184, 0.3)',
  },
  modern: {
    floorFill: '#334155',
    leftWallFill: '#475569',
    rightWallFill: '#64748b',
    roofFill: '#1e293b',
    signBg: '#0f172a',
    signText: '#67e8f9',
    accentColor: '#22d3ee',
    glowColor: 'rgba(34, 211, 238, 0.4)',
  },
  cozy: {
    floorFill: '#78350f',
    leftWallFill: '#92400e',
    rightWallFill: '#b45309',
    roofFill: '#451a03',
    signBg: '#78350f',
    signText: '#fde68a',
    accentColor: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.3)',
  },
  industrial: {
    floorFill: '#3f3f46',
    leftWallFill: '#52525b',
    rightWallFill: '#71717a',
    roofFill: '#18181b',
    signBg: '#27272a',
    signText: '#fdba74',
    accentColor: '#fb923c',
    glowColor: 'rgba(251, 146, 60, 0.4)',
  },
  premium: {
    floorFill: '#312e81',
    leftWallFill: '#3730a3',
    rightWallFill: '#4338ca',
    roofFill: '#1e1b4b',
    signBg: '#1e1b4b',
    signText: '#fef08a',
    accentColor: '#facc15',
    glowColor: 'rgba(250, 204, 21, 0.5)',
  },
  luxury: {
    floorFill: '#713f12',
    leftWallFill: '#854d0e',
    rightWallFill: '#a16207',
    roofFill: '#422006',
    signBg: 'linear-gradient(135deg, #78350f, #92400e)',
    signText: '#fcd34d',
    accentColor: '#fcd34d',
    glowColor: 'rgba(252, 211, 77, 0.6)',
  },
};

export function getDecorationColors(decoId: string | undefined): DecorationColors {
  return DECORATION_COLORS[decoId || 'simple'] || DECORATION_COLORS.simple;
}

// 计算门口屏幕坐标（供 StoreExterior 定位行人/骑手）
export function getDoorPosition(size: StoreSize): { x: number; y: number } {
  const { isoWidth: w, isoHeight: h } = size;
  const centerX = size.width / 2;
  const centerY = size.height / 2 + 10;
  const f0 = isoToScreen(0, 0, 0);
  const f1 = isoToScreen(w, 0, 0);
  return {
    x: (f0.x + f1.x) / 2 + centerX,
    y: (f0.y + f1.y) / 2 + centerY + h / 2,
  };
}

// 获取建筑前沿两端点屏幕坐标（等轴测地面前边 f[0]→f[1]）
export function getFrontEdge(size: StoreSize): { f0: { x: number; y: number }; f1: { x: number; y: number } } {
  const { isoWidth: w, isoHeight: h } = size;
  const centerX = size.width / 2;
  const centerY = size.height / 2 + 10;
  const raw0 = isoToScreen(0, 0, 0);
  const raw1 = isoToScreen(w, 0, 0);
  return {
    f0: { x: raw0.x + centerX, y: raw0.y + centerY + h / 2 },
    f1: { x: raw1.x + centerX, y: raw1.y + centerY + h / 2 },
  };
}

// 等轴测前沿方向常量（30°角）
export const ISO_FRONT_DIR = { dx: COS_30, dy: SIN_30 };       // 沿前沿方向（右下）
export const ISO_PERP_DIR  = { dx: SIN_30, dy: -COS_30 };      // 垂直前沿向店外（右上）

// 确定性伪随机数生成器（基于种子，避免 Math.random）
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// 力导向间距保证函数：确保所有位置之间的最小间距
export function ensureMinSpacing(
  positions: { x: number; y: number }[],
  minDist: number,
  iterations = 8,
): { x: number; y: number }[] {
  if (positions.length <= 1) return positions;
  const result = positions.map(p => ({ ...p }));
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dx = result[j].x - result[i].x;
        const dy = result[j].y - result[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist && dist > 0.01) {
          const overlap = (minDist - dist) / 2;
          const nx = (dx / dist) * overlap;
          const ny = (dy / dist) * overlap;
          result[i].x -= nx;
          result[i].y -= ny;
          result[j].x += nx;
          result[j].y += ny;
        }
      }
    }
  }
  return result;
}
