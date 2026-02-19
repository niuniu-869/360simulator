// 游戏核心类型定义

// ============ 认知系统类型 ============

// 认知等级 0-5
export type CognitionLevel = 0 | 1 | 2 | 3 | 4 | 5;

// 认知等级配置
export interface CognitionLevelConfig {
  level: CognitionLevel;
  name: string;           // 等级名称
  title: string;          // 称号
  icon: string;           // 图标
  description: string;    // 描述
  expRequired: number;    // 升级所需经验
  expTotal: number;       // 累计经验
}

// 踩坑记录
export interface MistakeRecord {
  type: string;           // 踩坑类型
  exp: number;            // 获得经验
  week: number;           // 发生周数
  description: string;    // 描述
}

// 面板ID（用于渐进式解锁）
export type PanelId = 'operating' | 'supplydemand' | 'finance'
  | 'marketing' | 'staff' | 'inventory';

// 认知状态
export interface CognitionState {
  level: CognitionLevel;  // 当前等级
  exp: number;            // 当前经验
  expToNext: number;      // 升级所需经验
  totalExp: number;       // 累计经验
  unlockedInfo: string[]; // 已解锁信息类型
  mistakeHistory: MistakeRecord[];  // 踩坑记录
  weeklyOperationCount: number;     // 本周操作次数（被动经验来源）
  consultYongGeThisWeek: number;    // 本周咨询勇哥次数
}

// 健康告警（从 healthCheck.ts 导入类型会造成循环依赖，这里内联定义）
export interface HealthAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  suggestion: string;
  relatedCaseId?: string;
  category: 'finance' | 'demand' | 'supply' | 'staff' | 'marketing' | 'pricing' | 'delivery';
}

// 每周总结数据
export interface WeeklySummary {
  week: number;
  revenue: number;
  variableCost: number;
  fixedCost: number;
  profit: number;
  cumulativeProfit: number;
  totalInvestment: number;
  cashRemaining: number;
  totalDemand: number;
  totalSupply: number;
  fulfillmentRate: number;
  productSales: {
    productId: string;
    name: string;
    sales: number;
    revenue: number;
  }[];
  staffCount: number;
  avgMorale: number;
  avgFatigue: number;
  quitStaffNames: string[];
  cognitionLevel: CognitionLevel;
  expGained: number;
  expSources: { label: string; exp: number }[];
  event: GameEvent | null;
  interactiveEventResponse: InteractiveEventResponse | null; // 交互事件响应（v2.9）
  consecutiveProfits: number;
  returnOnInvestmentProgress: number; // 累计利润/总投资 百分比
  healthAlerts: HealthAlert[]; // 经营健康诊断告警
  // 员工忙碌度统计
  // 认知等级提升信息（本周是否升级）
  cognitionLevelUp: {
    fromLevel: CognitionLevel;
    toLevel: CognitionLevel;
  } | null;
  cleanlinessChange: number; // 整洁度变化（用于周报展示）
  delayedEffectNarratives: string[]; // 本周生效的延迟效果叙事描述
  activeBuffSummaries: string[];     // 当前生效的事件buff来源描述
  staffWorkStats: {
    staffId: string;
    name: string;
    task: string;        // 岗位ID
    taskName: string;    // 岗位名称
    totalHours: number;  // 本周总工时
    busyHours: number;   // 实际忙碌时间（有效产出时间）
    busyRate: number;    // 忙碌率 0-1
    efficiency: number;  // 当前效率
    isOnboarding: boolean;
    // v2.7 绩效扩展
    weeklyContribution: number;  // 本周贡献值（归一化）
    weeklyRevenue: number;       // 本周创收估算
    costEfficiency: number;      // 性价比 = contribution / (salary/4)
  }[];
  restockCost?: number;     // 本周补货支出（资产转换，非费用）
  bossActionCost?: number;  // 本周老板行动费用
}

// 信息模糊化配置
export interface InfoFuzzConfig {
  infoType: string;       // 信息类型
  unlockLevel: CognitionLevel;  // 解锁等级
  fuzzLevels: {
    level: CognitionLevel;
    type: 'hidden' | 'fuzzy' | 'range' | 'exact';
    minRatio?: number;    // 模糊范围最小比例
    maxRatio?: number;    // 模糊范围最大比例
    fuzzyWords?: string[];  // 模糊词汇
  }[];
}

// ============ 游戏常量类型 ============

// 季节类型
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

// 营销活动影响类别
export type MarketingCategory = 'exposure' | 'reputation' | 'both';

// 产品子类型（用于季节性调整）
export type ProductSubType = 'hot_drink' | 'cold_drink' | 'main_food' | 'snack' | 'dessert';

// 选品类型
export interface Product {
  id: string;
  name: string;
  category: 'drink' | 'food' | 'snack' | 'meal';
  subType: ProductSubType;  // 产品子类型
  icon: string;
  baseCost: number; // 变动成本（原料成本）
  basePrice: number; // 基础售价
  referencePrice: number; // 消费者心理价位（超过此价格需求急剧下降）
  makeTime: number; // 制作时间（秒）
  storageType: 'normal' | 'refrigerated' | 'frozen'; // 存储方式
  appeal: {
    students: number; // 对学生的吸引力 0-100
    office: number; // 对上班族的吸引力 0-100
    family: number; // 对家庭的吸引力 0-100
    tourist: number; // 对游客的吸引力 0-100
  };
  description: string;
}

// 区位类型
export interface Location {
  id: string;
  name: string;
  type: 'school' | 'office' | 'community' | 'business' | 'tourist';
  description: string;
  footTraffic: {
    students: number; // 学生流量
    office: number; // 上班族流量
    family: number; // 家庭流量
    tourist: number; // 游客流量
  };
  rentPerSqm: number; // 每平米租金
  wageLevel: number; // 工资水平系数
  image: string;
  addresses: StoreAddress[]; // 可选店铺地址列表
}

// 装修类型
export interface Decoration {
  id: string;
  name: string;
  level: 1 | 2 | 3 | 4 | 5;
  costPerSqm: number;
  appealBonus: {
    students: number;
    office: number;
    family: number;
    tourist: number;
  };
  categoryBonus: {
    drink: number;
    food: number;
    snack: number;
    meal: number;
  };
  description: string;
}

// 员工类型定义
export interface StaffType {
  id: string;
  name: string;
  baseSalary: number;
  efficiency: number;              // 基础工作效率
  serviceQuality: number;          // 基础服务质量
  canHandleProducts: string[];     // 能处理的产品类别
  maxSkillLevel: number;           // 技能等级上限
  availableTasks: string[];        // 可分配的岗位列表
  // v2.8 时薪制
  payType?: 'monthly' | 'hourly';  // 薪资类型，默认 'monthly'
  hourlyRate?: number;             // 时薪（元/小时），仅 payType='hourly' 时有效
}

// 岗位定义
export interface TaskDefinition {
  id: string;
  name: string;
  icon: string;
  productionMultiplier: number;    // 对出餐产能的贡献系数
  serviceMultiplier: number;       // 对服务质量的贡献系数
  exposureBoostRate?: number;      // 营销员：每人每周满效率曝光度贡献
  cleanlinessRate?: number;        // 勤杂工：每人每周满效率整洁度恢复
  description: string;
}

// 员工疲劳效果
export interface StaffFatigueEffect {
  minFatigue: number;
  maxFatigue: number;
  efficiencyPenalty: number;       // 效率惩罚（乘法）
  servicePenalty: number;          // 服务惩罚（乘法）
  quitRisk: number;               // 每周离职概率
  status: string;
  icon: string;
}

// 员工实例
export interface Staff {
  id: string;
  typeId: string;
  name: string;
  salary: number;
  skillLevel: number;              // 技能等级 1-5
  baseEfficiency: number;          // 基础效率（不受状态影响的底值）
  efficiency: number;              // 当前效率（受疲劳/士气影响后的实际值）
  baseServiceQuality: number;      // 基础服务质量
  serviceQuality: number;          // 当前服务质量
  morale: number;                  // 士气值 0-100
  fatigue: number;                 // 疲劳值 0-100
  hiredWeek: number;               // 入职周数
  assignedTask: string;            // 分配的岗位（必填，默认 'waiter'）
  taskExp: number;                 // 当前岗位累计经验
  currentTaskSince: number;        // 当前岗位开始周数
  workDaysPerWeek: number;         // 每周工作天数 5-7
  workHoursPerDay: number;         // 每天工时 4-12
  isOnboarding: boolean;           // 是否入职适应期
  onboardingEndsWeek: number;      // 适应期结束周数
  wantsToQuit?: boolean;           // 是否想辞职（离职预警，给玩家1周缓冲）
  // v2.7 员工系统升级
  isTransitioning?: boolean;       // 是否转岗过渡期
  transitionEndsWeek?: number;     // 过渡期结束周数
  previousTasks?: Record<string, number>; // 历史岗位经验存档 { taskId: exp }
  lastBonusWeek?: number;          // 上次发奖金的周数
  lastDayOffWeek?: number;         // 上次放假的周数
  salaryRaiseMoraleBoost?: number; // 加薪士气加成（每周衰减）
  // v2.8 产品专注度
  focusProductId?: string;                     // 专注的产品 ID（null/undefined = 无专注）
  productProficiency?: Record<string, number>; // 各产品熟练度 0-100
}

// 招聘渠道
export interface RecruitmentChannel {
  id: string;
  name: string;
  cost: number;
  candidateQuality: 'normal' | 'high' | 'excellent';
  description: string;
}


// 店铺地址（每个区位下的具体位置）
export interface StoreAddress {
  id: string;
  name: string;
  area: number; // 店铺面积（平米）
  trafficModifier: number; // 客流量修正系数（0.5-1.5）
  rentModifier: number; // 租金修正系数
  description: string;
}

// ============ 消费者地理模型类型 ============

// 距离环ID
export type RingId = 'ring0' | 'ring1' | 'ring2' | 'ring3';

// 消费者环数据（选址时随机生成）
export interface ConsumerRing {
  distance: RingId;
  label: string;           // "门前300m" / "步行1km" / "骑行3km" / "外卖5km"
  consumers: Record<CustomerType, number>;  // 各客群人数
  baseConversion: number;  // 基础转化率（距离越远越低）
  nearbyShopIds: string[]; // 该环内的竞争店铺ID
}

// ============ 外卖平台系统类型 (v3.0 重做) ============

// 出餐分配优先级
export type SupplyPriority = 'dine_in_first' | 'delivery_first' | 'proportional';

// 满减档位ID
export type DiscountTierId = 'none' | 'small' | 'standard' | 'large' | 'loss_leader';

// 满减档位配置
export interface DiscountTierConfig {
  id: DiscountTierId;
  name: string;
  description: string;
  subsidyRate: number;            // 商家补贴率（占菜单价比例，顾客实付 = 菜单价 × (1 - subsidyRate)）
  conversionMultiplier: number;   // 对外卖转化率的倍率
  weightBonus: number;            // 平台权重分加成（平台奖励做满减的商家）
}

// 外卖定价倍率ID
export type DeliveryPricingId = 'same' | 'slight' | 'medium' | 'high';

// 外卖定价配置
export interface DeliveryPricingConfig {
  id: DeliveryPricingId;
  name: string;
  multiplier: number;             // 菜单价 = 堂食价 × multiplier
  description: string;
}

// 包装档次ID
export type PackagingTierId = 'basic' | 'premium';

// 包装档次配置
export interface PackagingTierConfig {
  id: PackagingTierId;
  name: string;
  costPerOrder: number;           // 每单包装费（元）
  ratingBonus: number;            // 每周评分加成
  description: string;
}

// 外卖平台定义
export interface DeliveryPlatform {
  id: 'meituan' | 'eleme' | 'douyin';
  name: string;
  commissionRate: number;           // 平台抽成率（基于顾客实付金额）
  audienceMultiplier: Record<CustomerType, number>;  // 各客群触达倍率
  minCognitionByBrandType: Record<'franchise' | 'independent', CognitionLevel>;
  newStoreBoostWeeks: number;       // 新店流量扶持持续周数
}

// 推广档位
export interface PromotionTier {
  id: 'none' | 'basic' | 'advanced' | 'premium';
  name: string;
  weeklyCost: number;
  weightBonus: number;    // 平台权重分加成（替代旧的 exposureBoost）
  ratingBoost: number;    // 每周评分加成
  description: string;
}

// 已上线的平台实例
export interface ActivePlatform {
  platformId: string;
  activeWeeks: number;              // 已运营周数
  platformExposure: number;         // 平台权重分（0-90，由多因子综合计算）
  promotionTierId: string;          // 当前推广档位ID
  discountTierId: DiscountTierId;   // 当前满减档位
  deliveryPricingId: DeliveryPricingId; // 外卖定价倍率
  packagingTierId: PackagingTierId; // 包装档次
  weeklyPromotionCost: number;      // 平台推广费
  recentWeeklyOrders: number[];     // 近4周单量（滚动窗口，用于权重分计算）
  // 上周权重分构成拆解（用于UI可解释展示）
  lastWeightBase?: number;          // 基础分（含新店扶持）
  lastWeightSales?: number;         // 销量分
  lastWeightRating?: number;        // 评分分
  lastWeightPromotion?: number;     // 推广分
  lastWeightDiscount?: number;      // 满减分
}

// 玩家的外卖状态
export interface DeliveryState {
  platforms: ActivePlatform[];       // 已上线的平台列表
  totalPlatformExposure: number;     // 综合平台权重分
  platformRating: number;            // 平台评分(0-5.0)
  weeklyDeliveryOrders: number;      // 上周外卖单量
  weeklyDeliveryRevenue: number;     // 上周外卖收入（顾客实付总额）
  weeklyCommissionPaid: number;      // 上周平台佣金
  weeklyPackageCost: number;         // 上周包装成本
  weeklyDiscountCost: number;        // 上周满减补贴成本（商家承担）
}

// ============ 增长系统类型 ============

export interface GrowthSystemState {
  launchProgress: number;       // 开业爬坡进度 0-100（由经营动作推动）
  awarenessFactor: number;      // 爬坡需求倍率 0.25-1.0（由 launchProgress 映射）
  awarenessStock: number;       // 认知存量（慢变量）
  campaignPulse: number;        // 营销脉冲（快变量）
  trustConfidence: number;      // 口碑置信度 0-1（评价样本越多越高）
  repeatIntent: number;         // 复购意愿 0-100（稳定履约与服务积累）
}

// ============ 周边店铺系统类型 ============

// 店铺品类
export type ShopCategory = 'drink' | 'food' | 'snack' | 'meal' | 'grocery' | 'service';

// 周边店铺产品
export interface NearbyShopProduct {
  name: string;
  category: ShopCategory;
  subType: string;
  price: number;
  baseCost: number;
  quality: number;       // 品质 0-100
  appeal: number;        // 吸引力 0-100
}

// 周边店铺
export interface NearbyShop {
  id: string;
  name: string;
  icon: string;
  shopCategory: ShopCategory;
  brandType: 'chain' | 'independent';
  brandTier: 'budget' | 'standard' | 'premium';
  products: NearbyShopProduct[];
  exposure: number;          // 曝光度 0-100
  serviceQuality: number;    // 服务质量 0-1
  decorationLevel: number;   // 装修档次 1-5
  openedWeek: number;        // 开业周数
  isClosing: boolean;        // 是否即将关门
  closedWeek?: number;       // 关门周数
  monthlyRent: number;       // 月租金
  weeklyProfit: number;      // 周利润（估算）
  priceVolatility: number;   // 价格波动幅度 0-0.15
  ring: RingId;              // 店铺所在距离环
  hasDelivery: boolean;      // 是否做外卖
}

// 周边店铺事件
export interface NearbyShopEvent {
  type: 'new_open' | 'closing' | 'price_change' | 'promotion';
  shopId: string;
  shopName: string;
  description: string;
  week: number;
}

// ============ 营销活动系统类型 ============

// 营销活动类型
export type MarketingActivityType = 'one_time' | 'continuous';

// 营销活动（运行时实例）
export interface MarketingActivity {
  id: string;
  name: string;
  type: MarketingActivityType;
  category: MarketingCategory;     // 影响类别
  weeklyCost: number;              // 每周成本
  exposureBoost: number;           // 曝光度提升/周
  reputationBoost: number;         // 口碑提升/周
  priceModifier: number;           // 客单价修正
  dependencyCoefficient: number;   // 依赖系数 0-1
  activeWeeks: number;             // 已持续周数
  description: string;
}

// 营销活动配置（模板）
export interface MarketingActivityConfig {
  id: string;
  name: string;
  type: MarketingActivityType;
  category: MarketingCategory;     // 影响类别：曝光/口碑/混合
  baseCost: number;
  exposureBoost: number;           // 对曝光度的影响/周
  reputationBoost: number;         // 对口碑的影响/周
  priceModifier: number;
  dependencyCoefficient: number;
  maxDuration?: number;            // 最大持续周数（一次性活动）
  unique?: boolean;                // 是否全局唯一（只能使用一次）
  cooldownWeeks?: number;          // 冷却周数（非唯一活动的重复间隔）
  description: string;
  teachingTip: string;             // 教学提示
}

// 激活的营销活动（运行时状态）
export interface ActiveMarketingActivity {
  activityId: string;        // 活动配置ID
  startWeek: number;         // 开始周数
  activeWeeks: number;       // 已运行周数
  totalCost: number;         // 累计成本
}

// ============ 库存系统类型 ============

// 存储方式
export type StorageType = 'normal' | 'refrigerated' | 'frozen';

// 补货策略
export type RestockStrategy = 'manual' | 'auto_conservative' | 'auto_standard' | 'auto_aggressive';

// 补货策略配置
export interface RestockStrategyConfig {
  id: RestockStrategy;
  name: string;
  targetStockWeeks: number;  // 目标备货周数（基于上周销量）
  description: string;
}

// 缺货效果
export interface StockoutEffect {
  minFulfillment: number;
  maxFulfillment: number;
  salesModifier: number;     // 销量修正
  reputationImpact: number;   // 口碑惩罚/周
  description: string;
}

// 库存项
export interface InventoryItem {
  productId: string;
  name: string;
  quantity: number;           // 当前库存量（份）
  unitCost: number;           // 单位采购成本
  storageType: StorageType;
  restockStrategy: RestockStrategy;  // 该产品的补货策略
  lastWeekSales: number;      // 上周实际销量
  lastWeekWaste: number;      // 上周损耗量
  lastRestockQuantity: number; // 上次补货量
  lastRestockCost: number;    // 上次补货花费
}

// 库存状态
export interface InventoryState {
  items: InventoryItem[];
  totalValue: number;
  weeklyHoldingCost: number;
  weeklyWasteCost: number;
  weeklyRestockCost: number;  // 本周补货花费
}

// 采购订单
export interface PurchaseOrder {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  week: number;               // 采购周数
}

// ============ 品牌类型 ============

export interface Brand {
  id: string;
  name: string;
  type: 'franchise' | 'independent';
  franchiseFee: number; // 加盟费
  royaltyRate: number; // royalty比例
  initialReputation: number;  // 初始口碑 0-100
  supplyCostModifier: number; // 供应链成本调整
  trafficMultiplier: number;  // 品牌自带流量倍率（作用于堂食需求基数）
  conversionBonus: number;    // 品牌转化率加成（消费者更信任知名品牌）
  description: string;
  minArea?: number; // 最小店铺面积要求
  maxArea?: number; // 最大店铺面积要求
  isQuickFranchise?: boolean; // 内部标记：是否为快招品牌（不对外显示）
  parentBrandId?: string; // 关联的正规品牌ID（用于快招拐走流程）
  riskLevel?: 'low' | 'medium' | 'high'; // 风险等级（用于游戏结果判断）
  allowedCategories?: ('drink' | 'food' | 'snack' | 'meal')[]; // 加盟品牌限定选品品类
}

// ============ 老板周行动系统类型 ============

// 老板行动类型
export type BossActionType =
  | 'work_in_store'       // 亲自坐镇（替代一个岗位，省薪资）
  | 'supervise'           // 巡店督导（提升员工士气/效率）
  | 'investigate_nearby'  // 周边考察（揭示竞对信息，可能有误）
  | 'count_traffic'       // 蹲点数人头（获取客流数据，可能有误）
  | 'industry_dinner';    // 同行饭局（行业洞察，可能有误）

// 考察揭示的店铺维度
export type InvestigationDimension = 'traffic' | 'price' | 'category' | 'decoration' | 'staffCount';

// 单条考察结果
export interface InvestigationResult {
  shopId: string;
  shopName: string;
  dimension: InvestigationDimension;
  displayValue: string;       // 展示给玩家的值（可能有误）
  isAccurate: boolean;        // 内部标记：是否准确
  cogWarning?: string;        // 认知等级足够时的提示
  week: number;
}

// 同行饭局洞察
export interface IndustryInsight {
  content: string;            // 洞察内容
  isAccurate: boolean;        // 是否靠谱
  cogWarning?: string;        // 认知提示
  week: number;
  // 可能附带的 buff
  buff?: BossBuff;
}

// 老板行动产生的临时增益
export interface BossBuff {
  type: 'supply_cost_reduction' | 'exposure_boost' | 'efficiency_boost' | 'morale_boost';
  value: number;              // 效果值（百分比或绝对值）
  remainingWeeks: number;     // 剩余周数
  source: string;             // 来源描述
}

// 老板行动状态
export interface BossActionState {
  currentAction: BossActionType;              // 本周选择的行动
  workRole?: string;                          // 亲自坐镇时选择的岗位
  targetShopId?: string;                      // 考察/蹲点目标店铺ID（undefined=本店周边）
  consecutiveStudyWeeks: number;              // 连续蹲点周数（用于连续奖励）
  benchmarkCooldown: number;                  // 标杆考察冷却（预留）
  revealedShopInfo: Record<string, InvestigationDimension[]>; // 已揭示的店铺维度
  investigationHistory: InvestigationResult[];  // 考察历史记录
  insightHistory: IndustryInsight[];          // 饭局洞察历史
  activeBuffs: BossBuff[];                    // 当前生效的增益
  lastActionWeek: number;                     // 上次设置行动的周数
}

// 游戏状态
export interface GameState {
  // 基础信息
  currentWeek: number;
  totalWeeks: number;
  consecutiveProfits?: number; // 连续盈利周数
  gamePhase: 'setup' | 'operating' | 'ended';
  gameOverReason?: 'win' | 'bankrupt' | 'time_limit' | null;

  // 决策状态
  selectedBrand: Brand | null;
  selectedLocation: Location | null;
  selectedAddress: StoreAddress | null; // 选中的店铺地址
  storeArea: number;
  selectedDecoration: Decoration | null;
  selectedProducts: Product[];
  staff: Staff[];

  // 经营状态
  isOpen: boolean;
  hasDelivery: boolean;  // 保留兼容，语义变为"是否上线了任何外卖平台"

  // ============ 出餐分配优先级 ============
  supplyPriority: SupplyPriority;  // 堂食/外卖出餐分配策略

  // ============ 消费者地理模型 ============
  baseConsumerRings: ConsumerRing[];  // 选址时生成的原始消费者环（不随季节变化）
  consumerRings: ConsumerRing[];      // 当前消费者环数据（受季节波动影响）

  // ============ 外卖平台系统 ============
  deliveryState: DeliveryState;       // 外卖状态

  // 财务状态
  cash: number;
  totalInvestment: number;
  weeklyRevenue: number;
  weeklyVariableCost: number;
  weeklyFixedCost: number;
  profitHistory: number[];
  revenueHistory: number[];    // 周收入历史
  cashHistory: number[];       // 周末现金余额历史

  // 双指标系统
  exposure: number;    // 曝光度 0-100
  reputation: number;  // 口碑值 0-100
  cleanliness: number; // 整洁度 0-100
  growthSystem?: GrowthSystemState; // v3 增长系统（兼容旧存档可为空）

  // 快招品牌锁定状态（选定后无法修改）
  locationLocked?: boolean;
  decorationLocked?: boolean;
  productsLocked?: boolean;
  decorationCostMarkup?: number; // 快招品牌装修费用上浮比例

  // ============ 季节与时间机制 ============
  currentSeason: Season;               // 当前季节
  startMonth: number;                  // 开店月份 (1-12)

  // ============ 周边店铺系统 ============
  nearbyShops: NearbyShop[];             // 周边店铺列表
  nearbyShopEvents: NearbyShopEvent[];   // 本周店铺动态事件

  // ============ 老板周行动系统 ============
  bossAction: BossActionState;         // 老板本周行动状态

  // ============ 认知系统 ============
  cognition: CognitionState;           // 认知状态

  // ============ 定价系统（纯单品自由定价） ============
  productPrices: Record<string, number>;  // 产品自定义价格

  // ============ 营销活动系统 ============
  activeMarketingActivities: MarketingActivity[];  // 进行中的营销活动

  // ============ 库存系统 ============
  inventoryState: InventoryState;      // 库存状态
  lastWeekFulfillment: number;         // 上周整体满足率（用于缺货惩罚延续）

  // ============ 选品调整追踪 ============
  weeklyProductChanges: number;        // 本周产品调整次数
  weeksSinceLastAction: number;        // 连续无主动操作周数（用于不活跃衰减惩罚）

  // ============ 活动使用记录 ============
  usedOneTimeActivities: string[];     // 已使用的一次性营销活动ID
  lastActivityWeek: Record<string, number>;  // 活动上次使用的周数（用于冷却期）

  // ============ 员工管理追踪（v2.7） ============
  lastTeamMealWeek?: number;           // 上次团建聚餐的周数
  staffMoraleActionCount?: number;     // 累计士气管理操作次数（用于健康诊断）
  weeksSinceLastMoraleAction?: number; // 距上次士气管理操作的周数

  // ============ 事件追踪 ============
  encounteredEventTypes: string[];     // 已遇到的事件类型ID
  lastWeekEvent: GameEvent | null;     // 上一周发生的被动事件（用于UI展示）

  // ============ 交互式事件系统（v2.9） ============
  pendingInteractiveEvent: InteractiveGameEvent | null;  // 待玩家响应的交互事件
  interactiveEventHistory: string[];   // 已触发的交互事件ID（防重复）
  lastInteractiveEventResponse: InteractiveEventResponse | null; // 上周交互事件响应（用于周报展示）

  // ============ 事件高级机制（v3.1） ============
  activeEventBuffs: EventBuff[];                   // 事件产生的临时buff列表
  pendingDelayedEffects: PendingDelayedEffect[];   // 待执行的延迟效果队列
  pendingChainEvents: Array<{                      // 待触发的链式事件
    eventId: string;
    triggerAtWeek: number;
    probability: number;
  }>;

  // ============ 每周总结与回本追踪 ============
  weeklySummary: WeeklySummary | null; // 上周总结（弹窗展示后清空）
  lastWeeklySummary: WeeklySummary | null; // 上周总结存档（用于"回顾"按钮）
  cumulativeProfit: number;            // 累计利润（用于回本判定）
}

// 勇哥建议类型
export interface YongGeAdvice {
  id: string;
  title: string;
  content: string;
  triggerCondition: string;
  severity: 'info' | 'warning' | 'critical';
}

// 踩坑类型（基于勇哥案例分析）
export interface Pitfall {
  id: string;
  category: 'franchise' | 'location' | 'product' | 'staff' | 'operation' | 'finance';
  name: string;
  description: string;
  howToAvoid: string;
  realCase: string;
}

// 周经营数据
export interface WeeklyReport {
  week: number;
  revenue: number;
  variableCost: number;
  fixedCost: number;
  profit: number;
  customers: number;
  events: GameEvent[];
}

// 游戏事件（被动，无玩家选择）
export interface GameEvent {
  id: string;
  title: string;
  description: string;
  impact: {
    type: 'revenue' | 'cost' | 'reputation';
    value: number;
  };
}

// ============ 交互式事件系统（v2.9） ============

// 事件产生的临时 Buff/Debuff
export interface EventBuff {
  type: 'revenue_multiplier' | 'cost_multiplier' | 'exposure_weekly'
        | 'reputation_weekly' | 'supply_reduction' | 'demand_boost';
  value: number;
  durationWeeks: number;
  source: string;               // 来源描述（周报展示）
}

// 待执行的延迟效果
export interface PendingDelayedEffect {
  executeAtWeek: number;
  effects: InteractiveEventEffectsBase;
  sourceEventId: string;
  description?: string;         // 周报中的叙事描述
}

// 交互事件选项效果（基础字段，不含递归引用）
export interface InteractiveEventEffectsBase {
  cash?: number;           // 直接现金变化
  reputation?: number;     // 口碑变化
  exposure?: number;       // 曝光度变化
  morale?: number;         // 全体员工士气变化
  cognitionExp?: number;   // 认知经验
  cleanliness?: number;    // 整洁度变化
}

// 交互事件选项效果（完整版，含高级机制）
export interface InteractiveEventEffects extends InteractiveEventEffectsBase {
  // === 目标员工效果 ===
  targetStaff?: {
    selector: 'highest_skill' | 'lowest_morale' | 'highest_fatigue'
              | 'random' | 'by_task' | 'specific';
    taskFilter?: string;
    effects: {
      remove?: boolean;           // 真实移除（离职）
      morale?: number;
      fatigue?: number;
      salary?: number;            // 薪资变化量
      wantsToQuit?: boolean;
    };
  };

  // === 延迟效果（不在选择时显示） ===
  delayedEffects?: Array<{
    delayWeeks: number;
    effects: InteractiveEventEffectsBase;
    description?: string;         // 周报中的叙事描述
  }>;

  // === 临时 Buff/Debuff ===
  buffs?: Array<{
    type: EventBuff['type'];
    value: number;
    durationWeeks: number;
    source: string;
  }>;

  // === 链式事件（概率触发后续事件） ===
  chainEvent?: {
    eventId: string;
    probability: number;          // 0-1
    delayWeeks: number;
  };
}

// 交互事件选项
export interface InteractiveEventOption {
  id: string;
  text: string;
  yonggeQuote: string;     // 勇哥点评
  effects: InteractiveEventEffects;
  narrativeHint?: string;  // 叙事提示（替代效果数字展示）
}

// 交互事件触发条件（纯数据，引擎侧用函数判定）
export interface InteractiveEventTrigger {
  phase: 'setup' | 'operating';
  /** setup 阶段细分步骤，决定在哪个筹备动作后触发 */
  setupStep?: 'select_brand' | 'select_location';
  minWeek?: number;
  maxWeek?: number;
  probability: number;     // 基础概率 0-1
}

// 交互事件分类
export type InteractiveEventCategory =
  | 'franchise'   // 加盟相关
  | 'operation'   // 经营事件
  | 'mindset'     // 心态考验
  | 'random';     // 随机事件

// 交互式游戏事件
export interface InteractiveGameEvent {
  id: string;
  name: string;
  description: string | ((state: GameState) => string);  // 支持动态生成
  category: InteractiveEventCategory;
  triggerCondition: InteractiveEventTrigger;
  /** 上下文感知触发条件：(state) => boolean，运行时判定 */
  contextCheck?: string;   // 条件标识符，引擎侧映射为函数
  options: InteractiveEventOption[];
  /** 纯通知型事件：无选项，自动应用效果 */
  notificationEffects?: InteractiveEventEffects;
  notificationQuote?: string;
}

// 玩家对交互事件的响应记录
export interface InteractiveEventResponse {
  eventId: string;
  optionId: string;
  week: number;
  effects: InteractiveEventEffects;
}

// ============ 供需模型类型定义 ============

// 客群类型
export type CustomerType = 'students' | 'office' | 'family' | 'tourist';

// 需求修正因子明细
export interface DemandModifiers {
  season: number;          // 季节贡献 (-0.1 ~ +0.15)
  marketing: number;       // 营销活动 (0 ~ +0.3)
  serviceQuality: number;  // 服务质量 (-0.1 ~ +0.1)
  cleanliness: number;     // 整洁度贡献 (-0.048 ~ +0.048)
  inactivity: number;      // 长期不调整导致的热度衰减 (-0.25 ~ 0)
}

// 单个产品的需求明细
export interface ProductDemandBreakdown {
  productId: string;
  productName: string;
  // 各客群的基础需求
  baseTrafficByType: Record<CustomerType, number>;
  // 产品吸引力占比
  appealRatio: number;
  // 需求修正总和
  demandModifierTotal: number;
  // 最终需求量（人次/周）
  finalDemand: number;
}

// 需求侧汇总
export interface DemandBreakdown {
  // 基础客流（来自区位）
  baseTraffic: Record<CustomerType, number>;
  totalBaseTraffic: number;
  // 需求修正因子
  modifiers: DemandModifiers;
  modifierTotal: number;
  // 各产品需求明细
  productDemands: ProductDemandBreakdown[];
  // 总需求量
  totalDemand: number;
}

// 单个产品的供给明细
export interface ProductSupplyBreakdown {
  productId: string;
  productName: string;
  // 库存量
  inventoryQuantity: number;
  // 出餐能力（人次/周）
  productionCapacity: number;
  // 最终供给量
  finalSupply: number;
  // 瓶颈类型
  bottleneck: 'inventory' | 'capacity' | 'none';
}

// 供给侧汇总
export interface SupplyBreakdown {
  // 员工总数
  staffCount: number;
  // 总工时（小时/周）
  totalWorkHours: number;
  // 平均效率
  avgEfficiency: number;
  // 各产品供给明细
  productSupplies: ProductSupplyBreakdown[];
  // 总供给量
  totalSupply: number;
}

// 单个产品的销售结果
export interface ProductSaleResult {
  productId: string;
  productName: string;
  icon: string;
  // 需求量
  demand: number;
  // 供给量
  supply: number;
  // 实际销量 = min(需求, 供给)
  actualSales: number;
  // 客单价
  unitPrice: number;
  // 销售额
  revenue: number;
  // 瓶颈类型
  bottleneck: 'demand' | 'supply_inventory' | 'supply_capacity' | 'balanced';
  // 满足率
  fulfillmentRate: number;
  // 堂食/外卖拆分
  dineInDemand: number;      // 堂食需求量
  deliveryDemand: number;    // 外卖需求量
  dineInSales: number;       // 堂食实际销量
  deliverySales: number;     // 外卖实际销量
  dineInRevenue: number;     // 堂食收入
  deliveryRevenue: number;   // 外卖收入（顾客实付）
}

// 供需计算总结果
export interface SupplyDemandResult {
  // 需求侧明细
  demand: DemandBreakdown;
  // 供给侧明细
  supply: SupplyBreakdown;
  // 各产品销售结果
  productSales: ProductSaleResult[];
  // 收入拆分
  dineInRevenue: number;        // 堂食收入
  deliveryRevenue: number;      // 外卖收入（扣佣前）
  deliveryCommission: number;   // 外卖佣金
  deliveryPackageCost: number;  // 外卖包装成本
  deliveryDiscountCost: number; // 外卖满减补贴成本（商家承担）
  // 总收入 = 堂食 + 外卖（保持兼容）
  totalRevenue: number;
  // 总销量
  totalSales: number;
  // 外卖销量
  deliverySales: number;
  // 中间计算数据（供面板可视化）
  attractionScore: number;                 // 吸引力分数 0-100
  ringCoverage: Record<string, number>;    // 各环覆盖率
  awarenessFactor: number;                 // 新店爬坡因子
  trafficReachMultiplier: number;          // 交通触达倍率
  supplyPriority: SupplyPriority;          // 当前出餐优先级
  // 整体瓶颈分析
  overallBottleneck: {
    type: 'demand' | 'supply' | 'balanced';
    description: string;
    suggestion: string;
  };
}
