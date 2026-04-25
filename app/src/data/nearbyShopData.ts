// 周边店铺系统数据配置

import type { ShopCategory } from "@/types/game";
import { rand } from "@/lib/rng";

// ============ 店铺名称生成器 ============

const SURNAMES = [
  "张",
  "李",
  "王",
  "刘",
  "陈",
  "杨",
  "赵",
  "黄",
  "周",
  "吴",
  "孙",
  "马",
];

const CATEGORY_WORDS: Record<ShopCategory, string[]> = {
  drink: ["茶饮", "奶茶", "果汁", "饮品", "茶坊"],
  food: ["小吃", "烧烤", "串串", "炸鸡", "卤味"],
  snack: ["甜品", "蛋糕", "面包", "糕点", "零食"],
  meal: ["快餐", "面馆", "饭店", "餐厅", "食堂"],
  grocery: ["便利店", "超市", "杂货", "零食铺"],
  service: ["美甲", "理发", "洗衣", "打印"],
};

const SHOP_PREFIXES = [
  "老",
  "小",
  "大",
  "新",
  "金",
  "福",
  "旺",
  "鑫",
  "好",
  "美",
];

/** 生成随机独立店铺名称 */
export function generateShopName(category: ShopCategory): string {
  const usePrefix = rand() > 0.5;
  const useSurname = rand() > 0.4;
  const words = CATEGORY_WORDS[category];
  const word = words[Math.floor(rand() * words.length)];

  if (useSurname) {
    const surname = SURNAMES[Math.floor(rand() * SURNAMES.length)];
    return `${surname}记${word}`;
  }
  if (usePrefix) {
    const prefix = SHOP_PREFIXES[Math.floor(rand() * SHOP_PREFIXES.length)];
    return `${prefix}${word}`;
  }
  return `${word}小店`;
}

// ============ 品类图标 ============

export const SHOP_CATEGORY_ICONS: Record<ShopCategory, string> = {
  drink: "🧋",
  food: "🍢",
  snack: "🍰",
  meal: "🍜",
  grocery: "🏪",
  service: "💈",
};

// ============ 连锁品牌模板 ============

export interface ChainBrandTemplate {
  id: string;
  name: string;
  icon: string;
  shopCategory: ShopCategory;
  brandTier: "budget" | "standard" | "premium";
  products: {
    name: string;
    category: ShopCategory;
    subType: string;
    priceRange: { min: number; max: number };
    baseCostRate: number; // 成本率
    quality: number;
    appeal: number;
  }[];
  exposure: number;
  serviceQuality: number;
  decorationLevel: number;
  priceVolatility: number;
  deliveryProbability: number; // 做外卖的概率 0-1
}

export const CHAIN_BRANDS: ChainBrandTemplate[] = [
  {
    id: "mixue_nearby",
    name: "蜜雪冰城",
    icon: "🍦",
    shopCategory: "drink",
    brandTier: "budget",
    products: [
      {
        name: "柠檬水",
        category: "drink",
        subType: "cold_drink",
        priceRange: { min: 4, max: 4 },
        baseCostRate: 0.3,
        quality: 60,
        appeal: 85,
      },
      {
        name: "冰淇淋",
        category: "snack",
        subType: "dessert",
        priceRange: { min: 3, max: 4 },
        baseCostRate: 0.35,
        quality: 55,
        appeal: 80,
      },
      {
        name: "奶茶",
        category: "drink",
        subType: "cold_drink",
        priceRange: { min: 6, max: 8 },
        baseCostRate: 0.35,
        quality: 55,
        appeal: 80,
      },
    ],
    exposure: 95,
    serviceQuality: 0.75,
    decorationLevel: 2,
    priceVolatility: 0.02,
    deliveryProbability: 0.95,
  },
  {
    id: "luckin_nearby",
    name: "瑞幸咖啡",
    icon: "☕",
    shopCategory: "drink",
    brandTier: "standard",
    products: [
      {
        name: "生椰拿铁",
        category: "drink",
        subType: "hot_drink",
        priceRange: { min: 9, max: 13 },
        baseCostRate: 0.35,
        quality: 75,
        appeal: 85,
      },
      {
        name: "美式咖啡",
        category: "drink",
        subType: "hot_drink",
        priceRange: { min: 9, max: 12 },
        baseCostRate: 0.25,
        quality: 70,
        appeal: 70,
      },
    ],
    exposure: 90,
    serviceQuality: 0.85,
    decorationLevel: 3,
    priceVolatility: 0.05,
    deliveryProbability: 0.95,
  },
  {
    id: "shaxian_nearby",
    name: "沙县小吃",
    icon: "🥟",
    shopCategory: "meal",
    brandTier: "budget",
    products: [
      {
        name: "拌面",
        category: "meal",
        subType: "main_food",
        priceRange: { min: 8, max: 12 },
        baseCostRate: 0.4,
        quality: 60,
        appeal: 70,
      },
      {
        name: "蒸饺",
        category: "meal",
        subType: "main_food",
        priceRange: { min: 6, max: 10 },
        baseCostRate: 0.4,
        quality: 60,
        appeal: 65,
      },
      {
        name: "炖汤",
        category: "meal",
        subType: "main_food",
        priceRange: { min: 10, max: 15 },
        baseCostRate: 0.45,
        quality: 65,
        appeal: 60,
      },
    ],
    exposure: 80,
    serviceQuality: 0.65,
    decorationLevel: 1,
    priceVolatility: 0.03,
    deliveryProbability: 0.95,
  },
  {
    id: "lanzhou_nearby",
    name: "兰州拉面",
    icon: "🍜",
    shopCategory: "meal",
    brandTier: "budget",
    products: [
      {
        name: "牛肉面",
        category: "meal",
        subType: "main_food",
        priceRange: { min: 12, max: 18 },
        baseCostRate: 0.45,
        quality: 65,
        appeal: 75,
      },
      {
        name: "拌面",
        category: "meal",
        subType: "main_food",
        priceRange: { min: 10, max: 14 },
        baseCostRate: 0.4,
        quality: 60,
        appeal: 65,
      },
    ],
    exposure: 75,
    serviceQuality: 0.65,
    decorationLevel: 1,
    priceVolatility: 0.03,
    deliveryProbability: 0.8,
  },
  {
    id: "zhengxin_nearby",
    name: "正新鸡排",
    icon: "🍗",
    shopCategory: "food",
    brandTier: "budget",
    products: [
      {
        name: "大鸡排",
        category: "food",
        subType: "snack",
        priceRange: { min: 12, max: 15 },
        baseCostRate: 0.4,
        quality: 60,
        appeal: 80,
      },
      {
        name: "烤肠",
        category: "food",
        subType: "snack",
        priceRange: { min: 5, max: 8 },
        baseCostRate: 0.35,
        quality: 55,
        appeal: 70,
      },
    ],
    exposure: 80,
    serviceQuality: 0.7,
    decorationLevel: 2,
    priceVolatility: 0.03,
    deliveryProbability: 0.6,
  },
  {
    id: "juewei_nearby",
    name: "绝味鸭脖",
    icon: "🦆",
    shopCategory: "food",
    brandTier: "standard",
    products: [
      {
        name: "鸭脖",
        category: "food",
        subType: "snack",
        priceRange: { min: 15, max: 25 },
        baseCostRate: 0.45,
        quality: 70,
        appeal: 75,
      },
      {
        name: "鸭翅",
        category: "food",
        subType: "snack",
        priceRange: { min: 18, max: 28 },
        baseCostRate: 0.45,
        quality: 70,
        appeal: 70,
      },
    ],
    exposure: 85,
    serviceQuality: 0.8,
    decorationLevel: 3,
    priceVolatility: 0.04,
    deliveryProbability: 0.7,
  },
  {
    id: "starbucks_nearby",
    name: "星巴克",
    icon: "⭐",
    shopCategory: "drink",
    brandTier: "premium",
    products: [
      {
        name: "拿铁",
        category: "drink",
        subType: "hot_drink",
        priceRange: { min: 30, max: 38 },
        baseCostRate: 0.25,
        quality: 85,
        appeal: 80,
      },
      {
        name: "星冰乐",
        category: "drink",
        subType: "cold_drink",
        priceRange: { min: 35, max: 42 },
        baseCostRate: 0.2,
        quality: 80,
        appeal: 75,
      },
    ],
    exposure: 95,
    serviceQuality: 0.85,
    decorationLevel: 4,
    priceVolatility: 0.01,
    deliveryProbability: 0.7,
  },
  {
    id: "mcdonald_nearby",
    name: "麦当劳",
    icon: "🍔",
    shopCategory: "meal",
    brandTier: "standard",
    products: [
      {
        name: "巨无霸",
        category: "meal",
        subType: "main_food",
        priceRange: { min: 22, max: 28 },
        baseCostRate: 0.4,
        quality: 75,
        appeal: 80,
      },
      {
        name: "薯条",
        category: "snack",
        subType: "snack",
        priceRange: { min: 10, max: 15 },
        baseCostRate: 0.3,
        quality: 70,
        appeal: 85,
      },
    ],
    exposure: 95,
    serviceQuality: 0.85,
    decorationLevel: 3,
    priceVolatility: 0.02,
    deliveryProbability: 0.9,
  },
  {
    id: "heytea_nearby",
    name: "喜茶",
    icon: "🍵",
    shopCategory: "drink",
    brandTier: "premium",
    products: [
      {
        name: "多肉葡萄",
        category: "drink",
        subType: "cold_drink",
        priceRange: { min: 15, max: 22 },
        baseCostRate: 0.35,
        quality: 85,
        appeal: 85,
      },
      {
        name: "芝芝莓莓",
        category: "drink",
        subType: "cold_drink",
        priceRange: { min: 18, max: 25 },
        baseCostRate: 0.3,
        quality: 85,
        appeal: 80,
      },
    ],
    exposure: 85,
    serviceQuality: 0.85,
    decorationLevel: 4,
    priceVolatility: 0.03,
    deliveryProbability: 0.9,
  },
  {
    id: "wallace_nearby",
    name: "华莱士",
    icon: "🍔",
    shopCategory: "meal",
    brandTier: "budget",
    products: [
      {
        name: "香辣鸡腿堡",
        category: "meal",
        subType: "main_food",
        priceRange: { min: 8, max: 12 },
        baseCostRate: 0.45,
        quality: 50,
        appeal: 70,
      },
      {
        name: "炸鸡",
        category: "food",
        subType: "snack",
        priceRange: { min: 10, max: 15 },
        baseCostRate: 0.4,
        quality: 50,
        appeal: 75,
      },
    ],
    exposure: 75,
    serviceQuality: 0.65,
    decorationLevel: 2,
    priceVolatility: 0.04,
    deliveryProbability: 0.95,
  },
];

// ============ 独立店铺模板 ============

export interface IndependentShopTemplate {
  shopCategory: ShopCategory;
  products: {
    name: string;
    subType: string;
    priceRange: { min: number; max: number };
    baseCostRate: number;
    quality: number;
    appeal: number;
  }[];
  exposureRange: { min: number; max: number };
  serviceQualityRange: { min: number; max: number };
  decorationRange: { min: number; max: number };
  priceVolatility: number;
}

export const INDEPENDENT_TEMPLATES: IndependentShopTemplate[] = [
  // 饮品类
  {
    shopCategory: "drink",
    products: [
      {
        name: "奶茶",
        subType: "cold_drink",
        priceRange: { min: 8, max: 16 },
        baseCostRate: 0.35,
        quality: 55,
        appeal: 70,
      },
      {
        name: "果茶",
        subType: "cold_drink",
        priceRange: { min: 10, max: 18 },
        baseCostRate: 0.35,
        quality: 55,
        appeal: 65,
      },
    ],
    exposureRange: { min: 25, max: 55 },
    serviceQualityRange: { min: 0.45, max: 0.85 },
    decorationRange: { min: 1, max: 3 },
    priceVolatility: 0.08,
  },
  {
    shopCategory: "drink",
    products: [
      {
        name: "手冲咖啡",
        subType: "hot_drink",
        priceRange: { min: 15, max: 30 },
        baseCostRate: 0.3,
        quality: 70,
        appeal: 60,
      },
      {
        name: "拿铁",
        subType: "hot_drink",
        priceRange: { min: 18, max: 28 },
        baseCostRate: 0.3,
        quality: 65,
        appeal: 65,
      },
    ],
    exposureRange: { min: 20, max: 50 },
    serviceQualityRange: { min: 0.55, max: 0.9 },
    decorationRange: { min: 2, max: 4 },
    priceVolatility: 0.06,
  },
  // 小吃类
  {
    shopCategory: "food",
    products: [
      {
        name: "烤串",
        subType: "snack",
        priceRange: { min: 2, max: 5 },
        baseCostRate: 0.4,
        quality: 55,
        appeal: 75,
      },
      {
        name: "炸串",
        subType: "snack",
        priceRange: { min: 2, max: 4 },
        baseCostRate: 0.35,
        quality: 50,
        appeal: 70,
      },
    ],
    exposureRange: { min: 20, max: 45 },
    serviceQualityRange: { min: 0.35, max: 0.75 },
    decorationRange: { min: 1, max: 2 },
    priceVolatility: 0.1,
  },
  // 甜品类
  {
    shopCategory: "snack",
    products: [
      {
        name: "蛋糕",
        subType: "dessert",
        priceRange: { min: 15, max: 35 },
        baseCostRate: 0.4,
        quality: 60,
        appeal: 65,
      },
      {
        name: "面包",
        subType: "snack",
        priceRange: { min: 8, max: 18 },
        baseCostRate: 0.4,
        quality: 55,
        appeal: 60,
      },
    ],
    exposureRange: { min: 25, max: 55 },
    serviceQualityRange: { min: 0.55, max: 0.85 },
    decorationRange: { min: 2, max: 4 },
    priceVolatility: 0.06,
  },
  // 正餐类
  {
    shopCategory: "meal",
    products: [
      {
        name: "盖浇饭",
        subType: "main_food",
        priceRange: { min: 12, max: 22 },
        baseCostRate: 0.45,
        quality: 50,
        appeal: 65,
      },
      {
        name: "炒菜",
        subType: "main_food",
        priceRange: { min: 15, max: 28 },
        baseCostRate: 0.45,
        quality: 55,
        appeal: 60,
      },
    ],
    exposureRange: { min: 20, max: 45 },
    serviceQualityRange: { min: 0.45, max: 0.75 },
    decorationRange: { min: 1, max: 3 },
    priceVolatility: 0.07,
  },
  {
    shopCategory: "meal",
    products: [
      {
        name: "麻辣烫",
        subType: "main_food",
        priceRange: { min: 15, max: 30 },
        baseCostRate: 0.4,
        quality: 55,
        appeal: 75,
      },
    ],
    exposureRange: { min: 25, max: 55 },
    serviceQualityRange: { min: 0.45, max: 0.75 },
    decorationRange: { min: 1, max: 3 },
    priceVolatility: 0.08,
  },
  // 便利店
  {
    shopCategory: "grocery",
    products: [
      {
        name: "饮料零食",
        subType: "snack",
        priceRange: { min: 3, max: 10 },
        baseCostRate: 0.7,
        quality: 60,
        appeal: 50,
      },
    ],
    exposureRange: { min: 30, max: 60 },
    serviceQualityRange: { min: 0.5, max: 0.7 },
    decorationRange: { min: 1, max: 2 },
    priceVolatility: 0.03,
  },
];

// ============ 区位店铺分布配置 ============

export interface LocationShopDistribution {
  locationType: string;
  shopCountRange: { min: number; max: number };
  chainProbability: number;
  categoryWeights: Record<ShopCategory, number>;
  tierDistribution: { budget: number; standard: number; premium: number };
  preferredChains: string[];
}

export const LOCATION_SHOP_DISTRIBUTIONS: LocationShopDistribution[] = [
  {
    locationType: "school",
    shopCountRange: { min: 9, max: 15 },
    chainProbability: 0.65,
    categoryWeights: {
      drink: 0.35,
      food: 0.2,
      snack: 0.15,
      meal: 0.2,
      grocery: 0.08,
      service: 0.02,
    },
    tierDistribution: { budget: 0.5, standard: 0.35, premium: 0.15 },
    preferredChains: [
      "mixue_nearby",
      "zhengxin_nearby",
      "wallace_nearby",
      "shaxian_nearby",
      "luckin_nearby",
    ],
  },
  {
    locationType: "office",
    shopCountRange: { min: 8, max: 14 },
    chainProbability: 0.75,
    categoryWeights: {
      drink: 0.3,
      food: 0.1,
      snack: 0.1,
      meal: 0.35,
      grocery: 0.1,
      service: 0.05,
    },
    tierDistribution: { budget: 0.15, standard: 0.5, premium: 0.35 },
    preferredChains: [
      "luckin_nearby",
      "starbucks_nearby",
      "mcdonald_nearby",
      "lanzhou_nearby",
      "heytea_nearby",
    ],
  },
  {
    locationType: "community",
    shopCountRange: { min: 8, max: 13 },
    chainProbability: 0.5,
    categoryWeights: {
      drink: 0.15,
      food: 0.15,
      snack: 0.15,
      meal: 0.25,
      grocery: 0.2,
      service: 0.1,
    },
    tierDistribution: { budget: 0.45, standard: 0.4, premium: 0.15 },
    preferredChains: [
      "mixue_nearby",
      "shaxian_nearby",
      "juewei_nearby",
      "wallace_nearby",
    ],
  },
  {
    locationType: "business",
    shopCountRange: { min: 10, max: 16 },
    chainProbability: 0.8,
    categoryWeights: {
      drink: 0.3,
      food: 0.15,
      snack: 0.15,
      meal: 0.25,
      grocery: 0.05,
      service: 0.1,
    },
    tierDistribution: { budget: 0.1, standard: 0.45, premium: 0.45 },
    preferredChains: [
      "starbucks_nearby",
      "heytea_nearby",
      "luckin_nearby",
      "mcdonald_nearby",
      "juewei_nearby",
    ],
  },
  {
    locationType: "tourist",
    shopCountRange: { min: 9, max: 14 },
    chainProbability: 0.6,
    categoryWeights: {
      drink: 0.25,
      food: 0.25,
      snack: 0.2,
      meal: 0.2,
      grocery: 0.05,
      service: 0.05,
    },
    tierDistribution: { budget: 0.25, standard: 0.4, premium: 0.35 },
    preferredChains: [
      "starbucks_nearby",
      "heytea_nearby",
      "mcdonald_nearby",
      "juewei_nearby",
      "mixue_nearby",
    ],
  },
];
