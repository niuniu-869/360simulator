// 街景视角数据配置 - 二十四节气 + 店铺视觉映射

import type { ShopCategory } from '@/types/game';

// ============ 粒子类型 ============

export type ParticleType = 'rain' | 'snow' | 'petals' | 'leaves' | 'fireflies' | 'mist' | 'heat' | 'frost' | 'none';

// ============ 节气配置 ============

export interface SolarTerm {
  name: string;
  month: number;
  skyGradient: string;        // CSS linear-gradient
  particleType: ParticleType;
  particleIntensity: number;  // 1-5，粒子密度
  ambientEmoji: string;
  description: string;
}

// 24节气完整配置
export const SOLAR_TERMS: SolarTerm[] = [
  // 1月
  { name: '小寒', month: 1, skyGradient: 'linear-gradient(180deg, #0a0e17 0%, #111d2e 50%, #1a2a3a 100%)', particleType: 'snow', particleIntensity: 2, ambientEmoji: '❄️', description: '寒气渐盛' },
  { name: '大寒', month: 1, skyGradient: 'linear-gradient(180deg, #080c14 0%, #0f1a28 50%, #162230 100%)', particleType: 'snow', particleIntensity: 4, ambientEmoji: '🌨️', description: '天寒地冻' },
  // 2月
  { name: '立春', month: 2, skyGradient: 'linear-gradient(180deg, #0c1018 0%, #152030 50%, #1e2d3e 100%)', particleType: 'mist', particleIntensity: 2, ambientEmoji: '🌱', description: '春回大地' },
  { name: '雨水', month: 2, skyGradient: 'linear-gradient(180deg, #0d1119 0%, #162234 50%, #1f3040 100%)', particleType: 'rain', particleIntensity: 3, ambientEmoji: '🌧️', description: '春雨绵绵' },
  // 3月
  { name: '惊蛰', month: 3, skyGradient: 'linear-gradient(180deg, #0e1320 0%, #182638 50%, #22354a 100%)', particleType: 'mist', particleIntensity: 1, ambientEmoji: '⚡', description: '春雷始鸣' },
  { name: '春分', month: 3, skyGradient: 'linear-gradient(180deg, #10152a 0%, #1c2d42 50%, #283a50 100%)', particleType: 'petals', particleIntensity: 2, ambientEmoji: '🌸', description: '昼夜等长' },
  // 4月
  { name: '清明', month: 4, skyGradient: 'linear-gradient(180deg, #111830 0%, #1e3048 50%, #2a3e55 100%)', particleType: 'petals', particleIntensity: 3, ambientEmoji: '🌺', description: '万物清明' },
  { name: '谷雨', month: 4, skyGradient: 'linear-gradient(180deg, #0f1528 0%, #1a2a40 50%, #24364c 100%)', particleType: 'rain', particleIntensity: 4, ambientEmoji: '🌾', description: '雨生百谷' },
  // 5月
  { name: '立夏', month: 5, skyGradient: 'linear-gradient(180deg, #121a35 0%, #1f3350 50%, #2c4260 100%)', particleType: 'none', particleIntensity: 0, ambientEmoji: '☀️', description: '夏日初临' },
  { name: '小满', month: 5, skyGradient: 'linear-gradient(180deg, #141c38 0%, #213555 50%, #2e4565 100%)', particleType: 'fireflies', particleIntensity: 1, ambientEmoji: '🌿', description: '小得盈满' },
  // 6月
  { name: '芒种', month: 6, skyGradient: 'linear-gradient(180deg, #161e3a 0%, #243858 50%, #304868 100%)', particleType: 'heat', particleIntensity: 2, ambientEmoji: '🌾', description: '忙种忙收' },
  { name: '夏至', month: 6, skyGradient: 'linear-gradient(180deg, #18203c 0%, #263a5c 50%, #334a6c 100%)', particleType: 'heat', particleIntensity: 3, ambientEmoji: '🔥', description: '日长之至' },
  // 7月
  { name: '小暑', month: 7, skyGradient: 'linear-gradient(180deg, #1a223e 0%, #283c5e 50%, #354c6e 100%)', particleType: 'heat', particleIntensity: 4, ambientEmoji: '🌡️', description: '暑气蒸腾' },
  { name: '大暑', month: 7, skyGradient: 'linear-gradient(180deg, #1c2440 0%, #2a3e60 50%, #384e70 100%)', particleType: 'heat', particleIntensity: 5, ambientEmoji: '☀️', description: '酷暑难耐' },
  // 8月
  { name: '立秋', month: 8, skyGradient: 'linear-gradient(180deg, #181e38 0%, #253658 50%, #324668 100%)', particleType: 'none', particleIntensity: 0, ambientEmoji: '🍃', description: '秋风送爽' },
  { name: '处暑', month: 8, skyGradient: 'linear-gradient(180deg, #161c35 0%, #223452 50%, #2e4462 100%)', particleType: 'fireflies', particleIntensity: 2, ambientEmoji: '🌙', description: '暑气渐消' },
  // 9月
  { name: '白露', month: 9, skyGradient: 'linear-gradient(180deg, #141a32 0%, #1f3050 50%, #2b4060 100%)', particleType: 'mist', particleIntensity: 2, ambientEmoji: '💧', description: '露凝而白' },
  { name: '秋分', month: 9, skyGradient: 'linear-gradient(180deg, #12182e 0%, #1c2c48 50%, #283c58 100%)', particleType: 'leaves', particleIntensity: 2, ambientEmoji: '🍂', description: '秋色平分' },
  // 10月
  { name: '寒露', month: 10, skyGradient: 'linear-gradient(180deg, #10162a 0%, #1a2842 50%, #243852 100%)', particleType: 'leaves', particleIntensity: 3, ambientEmoji: '🍁', description: '露寒欲凝' },
  { name: '霜降', month: 10, skyGradient: 'linear-gradient(180deg, #0e1426 0%, #18243c 50%, #22344c 100%)', particleType: 'frost', particleIntensity: 2, ambientEmoji: '🥶', description: '霜叶红于花' },
  // 11月
  { name: '立冬', month: 11, skyGradient: 'linear-gradient(180deg, #0c1222 0%, #162036 50%, #1e2e44 100%)', particleType: 'mist', particleIntensity: 1, ambientEmoji: '🌫️', description: '冬之始也' },
  { name: '小雪', month: 11, skyGradient: 'linear-gradient(180deg, #0b1020 0%, #141e32 50%, #1c2a3e 100%)', particleType: 'snow', particleIntensity: 2, ambientEmoji: '🌨️', description: '初雪飘零' },
  // 12月
  { name: '大雪', month: 12, skyGradient: 'linear-gradient(180deg, #090e1a 0%, #121c2c 50%, #1a2838 100%)', particleType: 'snow', particleIntensity: 4, ambientEmoji: '☃️', description: '瑞雪兆丰年' },
  { name: '冬至', month: 12, skyGradient: 'linear-gradient(180deg, #080c18 0%, #101a2a 50%, #182636 100%)', particleType: 'snow', particleIntensity: 3, ambientEmoji: '🧊', description: '日短之至' },
];

/**
 * 根据开店月份和已过周数计算当前节气
 * 52周 / 24节气 ≈ 2.167周/节气
 */
export function getCurrentSolarTerm(startMonth: number, weeksPassed: number): SolarTerm {
  const startTermIndex = ((startMonth - 1) * 2) % 24;
  const weeksPerTerm = 52 / 24;
  const termOffset = Math.floor(weeksPassed / weeksPerTerm);
  return SOLAR_TERMS[(startTermIndex + termOffset) % 24];
}

// ============ 店铺布局映射 ============

export interface StoreLayout {
  label: string;
  gridCols: number;
  gridRows: number;
  width: number;    // 容器宽度 px
  height: number;   // 容器高度 px
  kitchenSlots: number;
  diningSeats: number;
}

export const STORE_LAYOUTS: { minArea: number; layout: StoreLayout }[] = [
  { minArea: 0,  layout: { label: '档口', gridCols: 3, gridRows: 2, width: 140, height: 100, kitchenSlots: 1, diningSeats: 3 } },
  { minArea: 16, layout: { label: '小店', gridCols: 4, gridRows: 3, width: 180, height: 130, kitchenSlots: 2, diningSeats: 7 } },
  { minArea: 26, layout: { label: '标准店', gridCols: 5, gridRows: 3, width: 220, height: 140, kitchenSlots: 3, diningSeats: 9 } },
  { minArea: 36, layout: { label: '中型店', gridCols: 6, gridRows: 4, width: 260, height: 180, kitchenSlots: 4, diningSeats: 15 } },
  { minArea: 51, layout: { label: '大店', gridCols: 7, gridRows: 4, width: 300, height: 190, kitchenSlots: 6, diningSeats: 17 } },
  { minArea: 66, layout: { label: '旗舰店', gridCols: 8, gridRows: 5, width: 340, height: 230, kitchenSlots: 8, diningSeats: 24 } },
];

export function getStoreLayout(area: number): StoreLayout {
  let result = STORE_LAYOUTS[0].layout;
  for (const entry of STORE_LAYOUTS) {
    if (area >= entry.minArea) result = entry.layout;
  }
  return result;
}

// ============ 装修风格视觉映射 ============

export interface DecorationVisual {
  floorColor: string;       // 地板色 (Tailwind bg class)
  wallColor: string;        // 墙壁色
  furnitureEmoji: string;   // 空座位家具 emoji
  signboardStyle: string;   // 招牌 CSS class
  glowEffect: boolean;      // 是否有呼吸灯
  accentColor: string;      // 强调色 (hex)
}

export const DECORATION_VISUALS: Record<string, DecorationVisual> = {
  simple: {
    floorColor: 'bg-stone-800',
    wallColor: 'bg-stone-700',
    furnitureEmoji: '🪑',
    signboardStyle: 'text-slate-300 bg-slate-700',
    glowEffect: false,
    accentColor: '#94a3b8',
  },
  modern: {
    floorColor: 'bg-slate-700',
    wallColor: 'bg-slate-600',
    furnitureEmoji: '💺',
    signboardStyle: 'text-cyan-300 bg-slate-800',
    glowEffect: false,
    accentColor: '#67e8f9',
  },
  cozy: {
    floorColor: 'bg-amber-900/60',
    wallColor: 'bg-amber-800/50',
    furnitureEmoji: '🛋️',
    signboardStyle: 'text-amber-200 bg-amber-900',
    glowEffect: false,
    accentColor: '#fde68a',
  },
  industrial: {
    floorColor: 'bg-zinc-700',
    wallColor: 'bg-zinc-600',
    furnitureEmoji: '🪑',
    signboardStyle: 'text-orange-300 bg-zinc-800',
    glowEffect: false,
    accentColor: '#fdba74',
  },
  premium: {
    floorColor: 'bg-indigo-900/50',
    wallColor: 'bg-indigo-800/40',
    furnitureEmoji: '🛋️',
    signboardStyle: 'text-yellow-200 bg-indigo-950',
    glowEffect: true,
    accentColor: '#fef08a',
  },
  luxury: {
    floorColor: 'bg-yellow-900/30',
    wallColor: 'bg-yellow-800/20',
    furnitureEmoji: '🛋️',
    signboardStyle: 'text-yellow-300 bg-gradient-to-r from-yellow-900 to-amber-900',
    glowEffect: true,
    accentColor: '#fcd34d',
  },
};

export function getDecorationVisual(decoId: string | undefined): DecorationVisual {
  return DECORATION_VISUALS[decoId || 'simple'] || DECORATION_VISUALS.simple;
}

// ============ 区位环境映射 ============

export interface LocationEnvironment {
  buildingEmojis: string[];     // 周围建筑
  pedestrianEmojis: string[];   // 行人类型
  ambientEmojis: string[];      // 环境装饰
}

export const LOCATION_ENVIRONMENTS: Record<string, LocationEnvironment> = {
  school: {
    buildingEmojis: ['🏫', '📚', '🏟️'],
    pedestrianEmojis: ['👦', '👧', '🧑‍🎓', '👨‍🏫'],
    ambientEmojis: ['🎒', '📖'],
  },
  office: {
    buildingEmojis: ['🏢', '🏦', '🏛️'],
    pedestrianEmojis: ['👨‍💼', '👩‍💼', '🧑‍💻', '👔'],
    ambientEmojis: ['💼', '☕'],
  },
  community: {
    buildingEmojis: ['🏘️', '🏠', '🌳'],
    pedestrianEmojis: ['👵', '👴', '👶', '🐕'],
    ambientEmojis: ['🌿', '🏪'],
  },
  business: {
    buildingEmojis: ['🏬', '🎪', '🏙️'],
    pedestrianEmojis: ['🧑', '👩', '👫', '🛍️'],
    ambientEmojis: ['🎵', '✨'],
  },
  tourist: {
    buildingEmojis: ['🎡', '⛩️', '🗼'],
    pedestrianEmojis: ['📸', '🧳', '👒', '🎎'],
    ambientEmojis: ['🎈', '🗺️'],
  },
};

export function getLocationEnvironment(locType: string | undefined): LocationEnvironment {
  return LOCATION_ENVIRONMENTS[locType || 'community'] || LOCATION_ENVIRONMENTS.community;
}

// ============ 店铺品类颜色映射 ============

export const SHOP_CATEGORY_COLORS: Record<ShopCategory, string> = {
  drink: '#5eead4',   // 蓝绿
  food: '#fb923c',    // 橙
  snack: '#f9a8d4',   // 粉
  meal: '#f87171',    // 红
  grocery: '#4ade80',  // 绿
  service: '#c084fc',  // 紫
};

export const SHOP_CATEGORY_EMOJIS: Record<ShopCategory, string> = {
  drink: '🧋',
  food: '🍢',
  snack: '🍰',
  meal: '🍜',
  grocery: '🏪',
  service: '💈',
};
