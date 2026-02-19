// 信息模糊化工具函数
// 筹备阶段：费用已知，市场信息模糊
// 经营阶段：根据认知等级逐步清晰

import type { CognitionLevel } from '@/types/game';
import { INFO_FUZZ_CONFIG } from '@/data/cognitionData';

// 模糊化结果类型
export interface FuzzResult {
  display: string;      // 显示的文本
  isExact: boolean;     // 是否精确值
  isHidden: boolean;    // 是否隐藏
  tooltip?: string;     // 提示文本
}

// 格式化金额
export function formatMoney(amount: number): string {
  if (amount >= 10000) {
    return `¥${(amount / 10000).toFixed(1)}万`;
  }
  return `¥${amount.toLocaleString()}`;
}

// 格式化百分比
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// 格式化整数
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

// 核心模糊化函数
export function applyFuzz(
  infoType: string,
  value: number,
  cognitionLevel: CognitionLevel,
  formatter: (v: number) => string = formatNumber
): FuzzResult {
  const config = INFO_FUZZ_CONFIG.find(c => c.infoType === infoType);

  // 没有配置，返回精确值
  if (!config) {
    return {
      display: formatter(value),
      isExact: true,
      isHidden: false,
    };
  }

  const fuzzLevel = config.fuzzLevels.find(f => f.level === cognitionLevel);
  if (!fuzzLevel) {
    return {
      display: formatter(value),
      isExact: true,
      isHidden: false,
    };
  }

  switch (fuzzLevel.type) {
    case 'hidden':
      return {
        display: '???',
        isExact: false,
        isHidden: true,
        tooltip: `需要认知等级 ${config.unlockLevel} 才能查看`,
      };

    case 'fuzzy':
      {
        const words = fuzzLevel.fuzzyWords || ['未知'];
        let wordIndex = 0;
        if (value > 0) {
          wordIndex = Math.min(Math.floor(value / 5000), words.length - 1);
        }
        return {
          display: words[wordIndex] || words[0],
          isExact: false,
          isHidden: false,
          tooltip: '认知不足，数据模糊',
        };
      }

    case 'range':
      {
        const COST_INFO_TYPES = ['variableCost', 'fixedCost', 'breakEvenPoint'];
        const REVENUE_INFO_TYPES = ['weeklyRevenue', 'monthlyRevenue', 'grossMargin', 'netProfit'];
        let minRatio = fuzzLevel.minRatio || 0.8;
        let maxRatio = fuzzLevel.maxRatio || 1.2;
        if (COST_INFO_TYPES.includes(infoType)) {
          minRatio = (fuzzLevel.minRatio || 0.8) * 0.85;
          maxRatio = (fuzzLevel.maxRatio || 1.2) * 0.9;
        } else if (REVENUE_INFO_TYPES.includes(infoType)) {
          minRatio = (fuzzLevel.minRatio || 0.8) * 1.1;
          maxRatio = (fuzzLevel.maxRatio || 1.2) * 1.15;
        }
        const minVal = Math.round(value * minRatio);
        const maxVal = Math.round(value * maxRatio);
        return {
          display: `${formatter(minVal)} ~ ${formatter(maxVal)}`,
          isExact: false,
          isHidden: false,
          tooltip: '认知有限，显示范围值',
        };
      }

    case 'exact':
    default:
      return {
        display: formatter(value),
        isExact: true,
        isHidden: false,
      };
  }
}

// 专用模糊化函数：客流量（筹备阶段使用）
// 有区分但不精确，根据数值大小给出不同描述
export function fuzzTraffic(
  value: number,
  cognitionLevel: CognitionLevel
): FuzzResult {
  // 筹备阶段（认知0-1）：有区分的模糊描述
  if (cognitionLevel <= 1) {
    let description: string;
    if (value >= 800) {
      description = '人流很旺';
    } else if (value >= 500) {
      description = '人流较多';
    } else if (value >= 300) {
      description = '人流一般';
    } else if (value >= 150) {
      description = '人流偏少';
    } else {
      description = '人流稀少';
    }
    return {
      display: description,
      isExact: false,
      isHidden: false,
      tooltip: '需要实地考察才能准确判断',
    };
  }
  // 认知2：给出大致范围
  if (cognitionLevel === 2) {
    const min = Math.round(value * 0.7);
    const max = Math.round(value * 1.3);
    return {
      display: `${min} ~ ${max}`,
      isExact: false,
      isHidden: false,
    };
  }
  // 认知3+：精确值
  return {
    display: formatNumber(value),
    isExact: true,
    isHidden: false,
  };
}

// 专用模糊化函数：租金
// 租金是花出去的钱，应该是已知的
export function fuzzRent(
  value: number,
  _cognitionLevel: CognitionLevel
): FuzzResult {
  void _cognitionLevel;
  // 租金是已知费用，直接显示精确值
  return {
    display: `¥${value}/㎡`,
    isExact: true,
    isHidden: false,
  };
}

// 专用模糊化函数：竞争度
// 竞争度是市场信息，筹备阶段应该模糊
export function fuzzCompetition(
  value: number,
  cognitionLevel: CognitionLevel
): FuzzResult {
  // 筹备阶段（认知0-1）：模糊描述
  if (cognitionLevel <= 1) {
    let description: string;
    if (value > 0.8) {
      description = '竞争激烈';
    } else if (value > 0.5) {
      description = '竞争一般';
    } else {
      description = '竞争较少';
    }
    return {
      display: description,
      isExact: false,
      isHidden: false,
      tooltip: '需要深入调研才能准确判断',
    };
  }
  // 认知2：给出范围
  if (cognitionLevel === 2) {
    const percent = Math.round(value * 100);
    const min = Math.max(0, percent - 15);
    const max = Math.min(100, percent + 15);
    return {
      display: `${min}% ~ ${max}%`,
      isExact: false,
      isHidden: false,
    };
  }
  // 认知3+：精确值
  return {
    display: `${(value * 100).toFixed(0)}%`,
    isExact: true,
    isHidden: false,
  };
}

// 专用模糊化函数：毛利率
// 筹备阶段新手不太懂毛利率概念
export function fuzzMargin(
  value: number,
  cognitionLevel: CognitionLevel
): FuzzResult {
  // 认知0：完全不懂
  if (cognitionLevel === 0) {
    return {
      display: '???',
      isExact: false,
      isHidden: true,
      tooltip: '什么是毛利率？',
    };
  }
  // 认知1：只知道高低
  if (cognitionLevel === 1) {
    const level = value > 0.6 ? '应该挺高' : value > 0.4 ? '感觉一般' : '好像不高';
    return {
      display: level,
      isExact: false,
      isHidden: false,
      tooltip: '不太确定具体多少',
    };
  }
  // 认知2：大致水平
  if (cognitionLevel === 2) {
    const level = value > 0.6 ? '高' : value > 0.4 ? '中' : '低';
    return {
      display: level,
      isExact: false,
      isHidden: false,
    };
  }
  // 认知3：范围值
  if (cognitionLevel === 3) {
    const percent = Math.round(value * 100);
    const min = Math.max(0, percent - 10);
    const max = Math.min(100, percent + 10);
    return {
      display: `${min}% ~ ${max}%`,
      isExact: false,
      isHidden: false,
    };
  }
  // 认知4+：精确值
  return {
    display: `${(value * 100).toFixed(1)}%`,
    isExact: true,
    isHidden: false,
  };
}

// 专用模糊化函数：成本
// 产品进货成本是已知费用
export function fuzzCost(
  value: number,
  _cognitionLevel: CognitionLevel
): FuzzResult {
  void _cognitionLevel;
  // 成本是已知费用，直接显示
  return {
    display: `¥${value}`,
    isExact: true,
    isHidden: false,
  };
}

// 专用模糊化函数：工资
// 工资是已知费用
export function fuzzSalary(
  value: number,
  _cognitionLevel: CognitionLevel
): FuzzResult {
  void _cognitionLevel;
  // 工资是已知费用，直接显示
  return {
    display: formatMoney(value),
    isExact: true,
    isHidden: false,
  };
}

// 专用模糊化函数：装修费用
// 装修费用是已知费用
export function fuzzDecorationCost(
  value: number,
  _cognitionLevel: CognitionLevel
): FuzzResult {
  void _cognitionLevel;
  // 装修费用是已知费用，直接显示
  return {
    display: formatMoney(value),
    isExact: true,
    isHidden: false,
  };
}

// ============ 财务预览专用函数 ============
// 筹备阶段：成本相对清楚，但收入会被大幅高估

// 预估收入模糊化（新手总是高估收入）
export function fuzzEstimatedRevenue(
  value: number,
  cognitionLevel: CognitionLevel
): { display: string; actualMultiplier: number } {
  // 筹备阶段（认知0-1）：大幅高估收入
  if (cognitionLevel <= 1) {
    const multiplier = 1.8 + Math.random() * 0.4; // 1.8-2.2倍
    const inflatedValue = Math.round(value * multiplier);
    return {
      display: formatMoney(inflatedValue),
      actualMultiplier: multiplier,
    };
  }
  // 认知2：略微高估
  if (cognitionLevel === 2) {
    const multiplier = 1.3 + Math.random() * 0.2; // 1.3-1.5倍
    const inflatedValue = Math.round(value * multiplier);
    return {
      display: formatMoney(inflatedValue),
      actualMultiplier: multiplier,
    };
  }
  // 认知3+：接近真实
  return {
    display: formatMoney(value),
    actualMultiplier: 1,
  };
}

// 预估成本模糊化（成本相对清楚但略有偏差）
export function fuzzEstimatedCost(
  value: number,
  cognitionLevel: CognitionLevel
): { display: string; actualMultiplier: number } {
  // 筹备阶段（认知0-1）：略微低估成本
  if (cognitionLevel <= 1) {
    const multiplier = 0.85 + Math.random() * 0.1; // 0.85-0.95倍
    const deflatedValue = Math.round(value * multiplier);
    return {
      display: formatMoney(deflatedValue),
      actualMultiplier: multiplier,
    };
  }
  // 认知2+：接近真实
  return {
    display: formatMoney(value),
    actualMultiplier: 1,
  };
}

// ============ 周边店铺信息模糊化 ============

// 周边店铺价格模糊化
export function fuzzShopPrice(
  price: number,
  cognitionLevel: CognitionLevel
): FuzzResult {
  // 认知0：完全看不到价格
  if (cognitionLevel === 0) {
    return {
      display: '???',
      isExact: false,
      isHidden: true,
      tooltip: '需要提升认知才能看到价格',
    };
  }
  // 认知1：大致范围
  if (cognitionLevel === 1) {
    const min = Math.round(price * 0.7);
    const max = Math.round(price * 1.3);
    return {
      display: `约¥${min}~${max}`,
      isExact: false,
      isHidden: false,
      tooltip: '价格估算不太准确',
    };
  }
  // 认知2+：精确价格
  return {
    display: `¥${price.toFixed(0)}`,
    isExact: true,
    isHidden: false,
  };
}

// 周边店铺数量模糊化
export function fuzzShopCount(
  count: number,
  cognitionLevel: CognitionLevel
): FuzzResult {
  // 认知0：只知道大概
  if (cognitionLevel === 0) {
    let desc: string;
    if (count >= 8) desc = '很多家';
    else if (count >= 5) desc = '好几家';
    else if (count >= 3) desc = '几家';
    else desc = '不多';
    return {
      display: desc,
      isExact: false,
      isHidden: false,
      tooltip: '没仔细数过',
    };
  }
  // 认知1+：精确数量
  return {
    display: `${count} 家`,
    isExact: true,
    isHidden: false,
  };
}

// 市场份额模糊化
export function fuzzMarketShare(
  share: number,
  cognitionLevel: CognitionLevel
): FuzzResult {
  // 认知0-1：完全看不到
  if (cognitionLevel <= 1) {
    return {
      display: '???',
      isExact: false,
      isHidden: true,
      tooltip: '需要更高认知才能分析市场份额',
    };
  }
  // 认知2：模糊描述
  if (cognitionLevel === 2) {
    let desc: string;
    if (share >= 0.5) desc = '份额较大';
    else if (share >= 0.3) desc = '份额中等';
    else if (share >= 0.15) desc = '份额偏小';
    else desc = '份额很小';
    return {
      display: desc,
      isExact: false,
      isHidden: false,
    };
  }
  // 认知3：范围值
  if (cognitionLevel === 3) {
    const percent = Math.round(share * 100);
    const min = Math.max(0, percent - 8);
    const max = Math.min(100, percent + 8);
    return {
      display: `${min}%~${max}%`,
      isExact: false,
      isHidden: false,
    };
  }
  // 认知4+：精确值
  return {
    display: `${(share * 100).toFixed(1)}%`,
    isExact: true,
    isHidden: false,
  };
}

// ============ 口语化模糊函数 ============

/**
 * 将金额转为中国人日常口语表达
 * @param value 金额（正数）
 * @param precision 0=认知0级（粗略），1=认知1级（稍精确）
 */
export function fuzzToColloquial(value: number, precision: 0 | 1): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '亏了' : '赚了';
  const isLoss = value < 0;

  if (precision === 0) {
    // 认知0：非常粗略的口语
    if (abs < 200) return isLoss ? '亏了一点点' : '赚了一点点';
    if (abs < 800) return `${sign}几百块`;
    if (abs < 1500) return `${sign}一千来块`;
    if (abs < 3000) return `${sign}两三千`;
    if (abs < 5000) return `${sign}三五千`;
    if (abs < 8000) return `${sign}五六千`;
    if (abs < 12000) return `${sign}大几千`;
    if (abs < 20000) return `${sign}一两万`;
    if (abs < 35000) return `${sign}两三万`;
    if (abs < 60000) return `${sign}好几万`;
    return `${sign}很多钱`;
  }

  // precision === 1：认知1级，稍精确的口语
  if (abs < 300) return isLoss ? '小亏几百' : '小赚几百';
  if (abs < 800) return `${sign}五六百`;
  if (abs < 1200) return `${sign}一千出头`;
  if (abs < 2000) return `${sign}大概一两千`;
  if (abs < 3500) return `${sign}大概三千左右`;
  if (abs < 5000) return `${sign}大概四五千`;
  if (abs < 7000) return `${sign}五六千左右`;
  if (abs < 10000) return `${sign}七八千`;
  if (abs < 15000) return `${sign}一万出头`;
  if (abs < 25000) return `${sign}大概两万左右`;
  if (abs < 40000) return `${sign}三四万`;
  return `${sign}好几万`;
}

/**
 * 将金额转为口语（仅描述数额，不带"赚了/亏了"前缀）
 */
export function colloquialAmount(abs: number, precision: 0 | 1): string {
  if (precision === 0) {
    if (abs < 200) return '一点点';
    if (abs < 800) return '几百块';
    if (abs < 1500) return '一千来块';
    if (abs < 3000) return '两三千';
    if (abs < 5000) return '三五千';
    if (abs < 8000) return '五六千';
    if (abs < 12000) return '大几千';
    if (abs < 20000) return '一两万';
    if (abs < 35000) return '两三万';
    return '好几万';
  }
  if (abs < 300) return '几百块';
  if (abs < 800) return '五六百';
  if (abs < 1200) return '一千出头';
  if (abs < 2000) return '一两千';
  if (abs < 3500) return '三千左右';
  if (abs < 5000) return '四五千';
  if (abs < 7000) return '五六千左右';
  if (abs < 10000) return '七八千';
  if (abs < 15000) return '一万出头';
  if (abs < 25000) return '两万左右';
  return '好几万';
}

// 经营面板成本模糊化
export function fuzzOperatingCost(
  value: number,
  cognitionLevel: CognitionLevel,
  _costType: 'variable' | 'fixed'
): FuzzResult {
  void _costType;
  if (cognitionLevel === 0) {
    return {
      display: colloquialAmount(Math.abs(value), 0),
      isExact: false,
      isHidden: false,
      tooltip: '不太清楚具体花了多少',
    };
  }
  if (cognitionLevel === 1) {
    return {
      display: colloquialAmount(Math.abs(value), 1),
      isExact: false,
      isHidden: false,
      tooltip: '大概知道花了多少',
    };
  }
  if (cognitionLevel === 2) {
    const min = Math.round(value * 0.8);
    const max = Math.round(value * 1.2);
    return {
      display: `${formatMoney(min)} ~ ${formatMoney(max)}`,
      isExact: false,
      isHidden: false,
    };
  }
  if (cognitionLevel === 3) {
    const min = Math.round(value * 0.9);
    const max = Math.round(value * 1.1);
    return {
      display: `${formatMoney(min)} ~ ${formatMoney(max)}`,
      isExact: false,
      isHidden: false,
    };
  }
  return { display: formatMoney(value), isExact: true, isHidden: false };
}

// ============ 经营面板模糊化函数 ============

// 经营面板收入模糊化
export function fuzzOperatingRevenue(
  value: number,
  cognitionLevel: CognitionLevel
): FuzzResult {
  if (cognitionLevel === 0) {
    // 口语化 + 略微高估（新手总觉得赚得多）
    const inflated = Math.round(value * (1.3 + Math.random() * 0.4));
    return {
      display: colloquialAmount(inflated, 0),
      isExact: false,
      isHidden: false,
      tooltip: '感觉收入还不错',
    };
  }
  if (cognitionLevel === 1) {
    return {
      display: colloquialAmount(Math.abs(value), 1),
      isExact: false,
      isHidden: false,
    };
  }
  if (cognitionLevel === 2) {
    const min = Math.round(value * 0.7);
    const max = Math.round(value * 1.3);
    return {
      display: `${formatMoney(min)} ~ ${formatMoney(max)}`,
      isExact: false,
      isHidden: false,
    };
  }
  if (cognitionLevel === 3) {
    const min = Math.round(value * 0.85);
    const max = Math.round(value * 1.15);
    return {
      display: `${formatMoney(min)} ~ ${formatMoney(max)}`,
      isExact: false,
      isHidden: false,
    };
  }
  if (cognitionLevel === 4) {
    const min = Math.round(value * 0.95);
    const max = Math.round(value * 1.05);
    return {
      display: `${formatMoney(min)} ~ ${formatMoney(max)}`,
      isExact: false,
      isHidden: false,
    };
  }
  return { display: formatMoney(value), isExact: true, isHidden: false };
}

// 经营面板利润模糊化
export function fuzzOperatingProfit(
  value: number,
  cognitionLevel: CognitionLevel
): FuzzResult {
  if (cognitionLevel === 0) {
    return {
      display: fuzzToColloquial(value, 0),
      isExact: false,
      isHidden: false,
      tooltip: '完全凭感觉',
    };
  }
  if (cognitionLevel === 1) {
    return {
      display: fuzzToColloquial(value, 1),
      isExact: false,
      isHidden: false,
    };
  }
  if (cognitionLevel === 2) {
    const min = Math.round(value * 0.7);
    const max = Math.round(value * 1.3);
    return {
      display: `${formatMoney(Math.min(min, max))} ~ ${formatMoney(Math.max(min, max))}`,
      isExact: false, isHidden: false,
    };
  }
  if (cognitionLevel === 3) {
    const min = Math.round(value * 0.85);
    const max = Math.round(value * 1.15);
    return {
      display: `${formatMoney(Math.min(min, max))} ~ ${formatMoney(Math.max(min, max))}`,
      isExact: false, isHidden: false,
    };
  }
  if (cognitionLevel === 4) {
    const min = Math.round(value * 0.95);
    const max = Math.round(value * 1.05);
    return {
      display: `${formatMoney(Math.min(min, max))} ~ ${formatMoney(Math.max(min, max))}`,
      isExact: false, isHidden: false,
    };
  }
  return { display: formatMoney(value), isExact: true, isHidden: false };
}

// ============ 供需面板模糊化 ============

// 供需面板数据模糊化（4级才解锁）
export function fuzzSupplyDemandValue(
  value: number,
  cognitionLevel: CognitionLevel
): FuzzResult {
  if (cognitionLevel < 4) {
    return { display: '???', isExact: false, isHidden: true };
  }
  if (cognitionLevel === 4) {
    const min = Math.round(value * 0.8);
    const max = Math.round(value * 1.2);
    return {
      display: `${formatNumber(min)} ~ ${formatNumber(max)}`,
      isExact: false, isHidden: false,
    };
  }
  return { display: formatNumber(value), isExact: true, isHidden: false };
}

// ============ 消费者接受度模糊化 ============

export interface FuzzAcceptResult {
  label: string;
  textColor: string;
  barColor: string;
  barWidth: number; // 0-100
}

/**
 * 根据认知等级模糊化消费者接受度（单调保证）
 * ratio = currentPrice / referencePrice，越低越划算
 *
 * 低认知 = 更少档位 + 阈值向上偏移（对高价更迟钝）
 * 高认知 = 更多档位 + 阈值趋近真实值
 * 所有等级均保证：ratio 单调递增 → 结果单调递减（或不变）
 */
export function fuzzAcceptRatio(
  ratio: number,
  cognitionLevel: CognitionLevel
): FuzzAcceptResult {
  // 认知0级：极粗略的两档方向感
  if (cognitionLevel === 0) {
    if (ratio <= 1.15) {
      return { label: '感觉还行', textColor: 'text-slate-400', barColor: 'bg-slate-500', barWidth: 55 };
    }
    return { label: '好像有点贵', textColor: 'text-amber-400', barColor: 'bg-amber-500', barWidth: 35 };
  }

  // 认知1级：三档粗略感知，阈值偏移+0.10（新手对高价更迟钝）
  if (cognitionLevel === 1) {
    if (ratio <= 1.0) {
      return { label: '便宜', textColor: 'text-emerald-400', barColor: 'bg-emerald-500', barWidth: 75 };
    } else if (ratio <= 1.25) {
      return { label: '正常', textColor: 'text-yellow-400', barColor: 'bg-yellow-500', barWidth: 55 };
    }
    return { label: '偏贵', textColor: 'text-red-400', barColor: 'bg-red-500', barWidth: 30 };
  }

  // 认知2级：四档感知，阈值偏移+0.05
  if (cognitionLevel === 2) {
    return acceptResultWithOffset(ratio, 0.05);
  }

  // 认知3级：四档感知，阈值偏移+0.02
  if (cognitionLevel === 3) {
    return acceptResultWithOffset(ratio, 0.02);
  }

  // 认知4级：四档感知，阈值偏移+0.01
  if (cognitionLevel === 4) {
    return acceptResultWithOffset(ratio, 0.01);
  }

  // 认知5级：精确值
  return acceptResultFromRatio(ratio);
}

/** 带阈值偏移的接受度判定（offset > 0 = 对高价更迟钝） */
function acceptResultWithOffset(r: number, offset: number): FuzzAcceptResult {
  if (r <= 0.9 + offset) {
    return { label: '很划算', textColor: 'text-emerald-400', barColor: 'bg-emerald-500', barWidth: 90 };
  } else if (r <= 1.0 + offset) {
    return { label: '合理', textColor: 'text-emerald-400', barColor: 'bg-emerald-400', barWidth: 70 };
  } else if (r <= 1.15 + offset) {
    return { label: '偏贵', textColor: 'text-yellow-400', barColor: 'bg-yellow-500', barWidth: 40 };
  }
  return { label: '太贵了', textColor: 'text-red-400', barColor: 'bg-red-500', barWidth: 15 };
}

/** 根据感知比率返回精确的接受度结果 */
function acceptResultFromRatio(r: number): FuzzAcceptResult {
  if (r <= 0.9) {
    return { label: '很划算', textColor: 'text-emerald-400', barColor: 'bg-emerald-500', barWidth: 90 };
  } else if (r <= 1.0) {
    return { label: '合理', textColor: 'text-emerald-400', barColor: 'bg-emerald-400', barWidth: 70 };
  } else if (r <= 1.15) {
    return { label: '偏贵', textColor: 'text-yellow-400', barColor: 'bg-yellow-500', barWidth: 40 };
  } else {
    return { label: '太贵了', textColor: 'text-red-400', barColor: 'bg-red-500', barWidth: 15 };
  }
}

// ============ 每周总结模糊化 ============

export function fuzzWeeklySummaryValue(
  value: number,
  cognitionLevel: CognitionLevel,
  dataType: 'money' | 'count' | 'percent'
): FuzzResult {
  const fmt = dataType === 'money'
    ? formatMoney
    : dataType === 'percent'
    ? (v: number) => `${v.toFixed(1)}%`
    : formatNumber;

  if (cognitionLevel === 0) {
    if (dataType === 'money') {
      return {
        display: colloquialAmount(Math.abs(value), 0),
        isExact: false,
        isHidden: false,
      };
    }
    return { display: '???', isExact: false, isHidden: true };
  }
  if (cognitionLevel === 1) {
    if (dataType === 'money') {
      return {
        display: colloquialAmount(Math.abs(value), 1),
        isExact: false,
        isHidden: false,
      };
    }
    const min = Math.round(value * 0.5);
    const max = Math.round(value * 1.5);
    return {
      display: `${fmt(Math.min(min, max))} ~ ${fmt(Math.max(min, max))}`,
      isExact: false, isHidden: false,
    };
  }
  if (cognitionLevel === 2) {
    const min = Math.round(value * 0.8);
    const max = Math.round(value * 1.2);
    return {
      display: `${fmt(Math.min(min, max))} ~ ${fmt(Math.max(min, max))}`,
      isExact: false, isHidden: false,
    };
  }
  return { display: fmt(value), isExact: true, isHidden: false };
}
