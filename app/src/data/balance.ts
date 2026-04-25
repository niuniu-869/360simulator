/**
 * balance.ts — 集中管理"可被反复调优"的平衡常数（Phase 6 校准）
 *
 * 设计目的：所有"破坏性数值改动"放在这里，便于：
 *   - git checkout balance.ts 一键 revert
 *   - A/B 测试不同数值
 *   - 不污染数据/逻辑文件
 *
 * 校准基准（中国二线城市真实小奶茶店）：
 *   - 月营收：¥22k-33k（学校档口） / ¥35k-55k（商业区） / ¥20k-31k（社区）
 *   - 净利率：10-18%（健康店）
 *   - 月净利：¥3.5k-8k
 *   - 1 年存活率：30-50%
 *   - 投资回收期：12-28 月
 *
 * 修订原则：
 *   1. 现实数据优先（来源：勇哥案例 + 行业公开数据 + 训练知识）
 *   2. 任何修改都注明「原值 → 新值 + 理由」
 *   3. 修改后必须跑 cli/agent-tests/phase6_balance.mjs 验证
 */

// ============ 事件系统平衡 ============

/**
 * 事件触发概率放大倍数（Phase 3 引入）
 *
 * 历史：
 *   - 原始 1.0（baseline）
 *   - Phase 3 调到 1.5（提升戏剧密度）
 *   - Phase 6 校准回 1.10（1.5 把惩罚类老事件 ×1.5，导致每周 -¥2.5k 系统性亏损）
 *
 * 影响：影响 eventEngine.ts rollInteractiveEvent 的每个候选事件命中率
 */
export const EVENT_PROBABILITY_BOOST = 1.1;

// ============ 库存系统平衡 ============

/**
 * 库存持有成本（每周占库存价值的百分比）
 *
 * 历史：
 *   - 原值 normal 2% / refrig 5% / frozen 7%
 *   - 校准后：现实超商冷链含电费 1-3%/周已合理（原值偏高 50-100%）
 */
export const HOLDING_COST_RATES_CALIBRATED = {
  normal: 0.01, // 2% → 1%
  refrigerated: 0.025, // 5% → 2.5%
  frozen: 0.035, // 7% → 3.5%
} as const;

/**
 * 损耗率（每周丢弃比例）
 * 原值已基本合理，仅微调
 */
export const WASTE_RATES_CALIBRATED = {
  normal: 0.04, // 5% → 4%
  refrigerated: 0.07, // 8% → 7%
  frozen: 0.025, // 3% → 2.5%
} as const;

// ============ 价格弹性平衡 ============

/**
 * 学生群体价格弹性
 *
 * 历史：
 *   - 1.5（地狱难度）
 *   - 1.3（已降一档）
 *   - 校准 0.9：现实学生对 ¥12 → ¥13 的涨价不敏感（粘性高、买零食习惯化）
 */
export const STUDENT_PRICE_ELASTICITY = 0.9;

// ============ 营销活动平衡 ============

/**
 * 持续型营销活动周费
 *
 * 历史：
 *   - social_media 原 2000/周 → 校准 800/周
 *     现实：小店抖音/小红书代运营 ¥2-4k/月（≈ ¥500-1000/周）
 *   - ingredient_upgrade 原 800/周 → 校准 500/周
 *     现实：升级食材成本应是售价 5-10% 的差额，对 ¥10 客单 ≈ ¥0.5-1/杯
 */
export const SOCIAL_MEDIA_WEEKLY_COST = 800;
export const INGREDIENT_UPGRADE_WEEKLY_COST = 500;

/**
 * 月度基础营销费（gameData.MONTHLY_MARKETING_COST）
 * 小店"门头维护 + 偶尔传单"实际 ¥400/月足够
 */
export const MONTHLY_MARKETING_COST_CALIBRATED = 400;

// ============ 设备折旧平衡 ============

/**
 * 月度设备折旧（gameData.EQUIPMENT_DEPRECIATION）
 * 小型设备（咖啡机/制冰机）一次性投入 ¥1-3 万，折旧 3-5 年 → ¥200-800/月
 * 原值 ¥400 已合理，保留
 */
export const EQUIPMENT_DEPRECIATION_CALIBRATED = 400;

// ============ 整洁度系统平衡 ============

/**
 * 整洁度衰减
 *
 * 历史问题：
 *   - BASE_DIRT 2.0 + 面积/销售因子 → 周净 -2 ~ -3
 *   - 1 全 1 兼小店没有专职 cleaner，52 周必然跌穿 0
 *   - 跌到 < 40 后触发 reputation -0.8/周（× 30 周 = -24 分）
 *   - 这是 dine_in / balanced "持续盈利但 reputation 暴跌无法胜利" 的根源
 *
 * 校准：基础脏度 2.0 → 1.2（对小店更友好），其他保留
 */
export const CLEANLINESS_BASE_DIRT = 1.2;

/**
 * 整洁度对口碑的惩罚（gameEngine.ts 1040-1042）
 *
 * 原值：< 80 +0.35, < 40 -0.8, < 20 -1.8
 * 校准：< 40 -0.4, < 20 -1.0（玩家有时间察觉再补救）
 */
export const CLEANLINESS_REPUTATION_IMPACT = {
  highBonus: 0.35, // ≥ 80 +0.35（保留）
  lowPenalty: -0.4, // < 40 -0.8 → -0.4
  veryLowPenalty: -1.0, // < 20 -1.8 → -1.0
} as const;

// ============ 不活跃惩罚（Demand 衰减）平衡 ============

/**
 * 长期无营销/无操作的需求衰减阈值（demandCalculator.calculateDemandModifiers）
 *
 * 原逻辑：3 周不操作开始衰减；6 周清空脉冲
 * 校准：放宽到 5 周开始 / 10 周清空，匹配现实"老店稳态"特性
 */
export const INACTIVITY_PENALTY = {
  startWeek: 5, // 3 → 5
  fullDecayWeek: 10, // 6 → 10
  maxPenalty: 0.18, // 0.25 → 0.18（最大需求扣减 25% → 18%）
} as const;
