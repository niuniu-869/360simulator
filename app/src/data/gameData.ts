import type { Product, Location, Decoration, StaffType, Brand, Pitfall, YongGeAdvice } from '@/types/game';

// ============ 游戏核心常量（已优化） ============

// 转化率：6.5%，避免“躺赢”，把可玩性更多交给“人流量+运营”
export const CONVERSION_RATE = 0.065;

// 隐性成本常量（适度调整）
// 注意：外卖佣金已迁移至 deliveryData.ts 按平台精确计算
// 注意：损耗率已移至 inventoryData.ts，按存储类型和品类细分
export const MONTHLY_MARKETING_COST = 800;   // 月营销费用（小店基础宣传，传单+门头维护）
export const EQUIPMENT_DEPRECIATION = 400;   // 月设备折旧（小型设备折旧较低）

/** 每个厨房工位所需面积（㎡），含操作台、设备、走道 */
export const AREA_PER_KITCHEN_STATION = 10;

// 开店固定费用（独立品牌也需要的真实创业开支）
export const SETUP_FIXED_COSTS = {
  businessLicense: 5000,      // 营业执照 + 食品经营许可
  equipmentBase: 18000,       // 基础设备（冰柜、操作台、收银系统等，二手设备可大幅降低）
  firstBatchInventory: 8000,  // 首批进货备料
  depositMonths: 2,           // 押金 = 2个月租金（动态计算）
  prepaidRentMonths: 1,       // 预付租金 = 1个月租金（动态计算）
};

// 季节系数（适度波动，制造季节性盈亏差异但不至于致命）
export const SEASON_MODIFIER = {
  spring: 0.90,  // 春季淡季（返工/返校过渡期，但不至于太惨）
  summer: 1.25,  // 夏季旺季（饮品旺季+夜市经济）
  autumn: 1.05,  // 秋季微旺（金九银十）
  winter: 0.85,  // 冬季淡季（寒冬+春节前消费收缩，但火锅/热饮有补偿）
};

// 注意：竞争对手系统已重构为周边店铺系统，见 nearbyShopGenerator.ts
// 注意：曝光活动已移至 marketingData.ts，统一为营销活动系统

// 选品数据（成本已调整，毛利率更接近现实50-60%）
export const products: Product[] = [
  {
    id: 'milktea',
    name: '奶茶',
    category: 'drink',
    subType: 'cold_drink',
    icon: '🧋',
    baseCost: 5,  // 原3，调整后毛利率58%
    basePrice: 12,
    referencePrice: 15,  // 消费者心理价位
    makeTime: 75,
    storageType: 'refrigerated',
    appeal: { students: 90, office: 70, family: 50, tourist: 60 },
    description: '学生最爱，毛利高但竞争激烈',
  },
  {
    id: 'coffee',
    name: '咖啡',
    category: 'drink',
    subType: 'hot_drink',
    icon: '☕',
    baseCost: 7,  // 原4，调整后毛利率61%
    basePrice: 18,
    referencePrice: 22,
    makeTime: 110,
    storageType: 'normal',
    appeal: { students: 50, office: 95, family: 40, tourist: 70 },
    description: '上班族刚需，复购率高',
  },
  {
    id: 'fruittea',
    name: '果茶',
    category: 'drink',
    subType: 'cold_drink',
    icon: '🍹',
    baseCost: 6,  // 原4，调整后毛利率60%
    basePrice: 15,
    referencePrice: 18,
    makeTime: 90,
    storageType: 'refrigerated',
    appeal: { students: 80, office: 60, family: 70, tourist: 75 },
    description: '健康定位，适合家庭客群',
  },
  {
    id: 'burger',
    name: '汉堡',
    category: 'meal',
    subType: 'main_food',
    icon: '🍔',
    baseCost: 12,  // 原8，调整后毛利率52%
    basePrice: 25,
    referencePrice: 30,
    makeTime: 110,
    storageType: 'refrigerated',
    appeal: { students: 85, office: 75, family: 60, tourist: 70 },
    description: '快餐之王，出餐快',
  },
  {
    id: 'ricebox',
    name: '盒饭',
    category: 'meal',
    subType: 'main_food',
    icon: '🍱',
    baseCost: 14,  // 原10，调整后毛利率50%
    basePrice: 28,
    referencePrice: 32,
    makeTime: 180,
    storageType: 'refrigerated',
    appeal: { students: 70, office: 85, family: 50, tourist: 40 },
    description: '上班族午餐首选',
  },
  {
    id: 'noodles',
    name: '面条',
    category: 'meal',
    subType: 'main_food',
    icon: '🍜',
    baseCost: 8,  // 原6，调整后毛利率56%
    basePrice: 18,
    referencePrice: 22,
    makeTime: 150,
    storageType: 'normal',
    appeal: { students: 75, office: 70, family: 65, tourist: 55 },
    description: '大众口味，老少皆宜',
  },
  {
    id: 'bbq',
    name: '烤串',
    category: 'food',
    subType: 'snack',
    icon: '🍢',
    baseCost: 7,  // 原5，调整后毛利率53%
    basePrice: 15,
    referencePrice: 18,
    makeTime: 180,
    storageType: 'frozen',
    appeal: { students: 80, office: 65, family: 40, tourist: 60 },
    description: '夜宵神器，毛利极高',
  },
  {
    id: 'fries',
    name: '薯条',
    category: 'snack',
    subType: 'snack',
    icon: '🍟',
    baseCost: 4,  // 原3，调整后毛利率60%
    basePrice: 10,
    referencePrice: 12,
    makeTime: 110,
    storageType: 'frozen',
    appeal: { students: 90, office: 50, family: 75, tourist: 65 },
    description: '百搭小食，制作简单',
  },
  {
    id: 'dessert',
    name: '甜品',
    category: 'snack',
    subType: 'dessert',
    icon: '🍰',
    baseCost: 9,  // 原6，调整后毛利率59%
    basePrice: 22,
    referencePrice: 26,
    makeTime: 40,
    storageType: 'refrigerated',
    appeal: { students: 85, office: 70, family: 80, tourist: 75 },
    description: '下午茶首选，客单价高',
  },
  {
    id: 'bread',
    name: '烘焙',
    category: 'snack',
    subType: 'snack',
    icon: '🥐',
    baseCost: 7,  // 原5，调整后毛利率53%
    basePrice: 15,
    referencePrice: 18,
    makeTime: 75,
    storageType: 'normal',
    appeal: { students: 70, office: 80, family: 75, tourist: 60 },
    description: '早餐+下午茶双重场景',
  },
];

// 区位数据
export const locations: Location[] = [
  {
    id: 'school',
    name: '学校周边',
    type: 'school',
    description: '学生流量大，价格敏感度高',
    footTraffic: { students: 2600, office: 500, family: 360, tourist: 120 },
    rentPerSqm: 80,
    wageLevel: 0.8,
    image: '🏫',
    addresses: [
      { id: 'school_gate', name: '校门口临街铺', area: 25, trafficModifier: 1.3, rentModifier: 1.4, description: '黄金位置，人流量最大' },
      { id: 'school_canteen', name: '食堂旁档口', area: 15, trafficModifier: 1.1, rentModifier: 0.9, description: '面积小但位置好' },
      { id: 'school_back', name: '后街二楼', area: 60, trafficModifier: 0.7, rentModifier: 0.6, description: '面积大租金低，但位置偏' },
    ],
  },
  {
    id: 'office',
    name: '写字楼区',
    type: 'office',
    description: '上班族集中，午餐需求旺盛',
    footTraffic: { students: 310, office: 3500, family: 250, tourist: 250 },
    rentPerSqm: 150,
    wageLevel: 1.2,
    image: '🏢',
    addresses: [
      { id: 'office_lobby', name: '大堂底商', area: 45, trafficModifier: 1.2, rentModifier: 1.3, description: '写字楼大堂旁，白领必经之路' },
      { id: 'office_b1', name: '负一层美食城', area: 30, trafficModifier: 1.0, rentModifier: 0.85, description: '美食城档口，午餐高峰集中' },
      { id: 'office_street', name: '对面街边店', area: 80, trafficModifier: 0.8, rentModifier: 0.7, description: '面积大但需要过马路' },
    ],
  },
  {
    id: 'community',
    name: '居民区',
    type: 'community',
    description: '家庭客群稳定，复购率高',
    footTraffic: { students: 800, office: 680, family: 2700, tourist: 120 },
    rentPerSqm: 60,
    wageLevel: 0.9,
    image: '🏘️',
    addresses: [
      { id: 'community_entrance', name: '小区入口', area: 35, trafficModifier: 1.2, rentModifier: 1.1, description: '居民进出必经，早晚高峰' },
      { id: 'community_market', name: '菜市场旁', area: 20, trafficModifier: 1.0, rentModifier: 0.8, description: '买菜顺便消费，中老年客群' },
      { id: 'community_park', name: '社区公园边', area: 50, trafficModifier: 0.9, rentModifier: 0.75, description: '环境好，适合休闲消费' },
    ],
  },
  {
    id: 'business',
    name: '商业街区',
    type: 'business',
    description: '人流量大但租金高，竞争激烈',
    footTraffic: { students: 1430, office: 1750, family: 1430, tourist: 1170 },
    rentPerSqm: 200,
    wageLevel: 1.0,
    image: '🏬',
    addresses: [
      { id: 'business_mall', name: '购物中心店', area: 55, trafficModifier: 1.3, rentModifier: 1.5, description: '商场内铺，客流稳定但租金高' },
      { id: 'business_street', name: '步行街临街', area: 40, trafficModifier: 1.1, rentModifier: 1.2, description: '步行街一楼，人流量大' },
      { id: 'business_corner', name: '街角转角铺', area: 70, trafficModifier: 0.85, rentModifier: 0.9, description: '位置稍偏但面积大' },
    ],
  },
  {
    id: 'tourist',
    name: '景区周边',
    type: 'tourist',
    description: '游客多，季节性明显',
    footTraffic: { students: 420, office: 220, family: 910, tourist: 3640 },
    rentPerSqm: 180,
    wageLevel: 1.1,
    image: '🎡',
    addresses: [
      { id: 'tourist_gate', name: '景区入口', area: 30, trafficModifier: 1.4, rentModifier: 1.6, description: '游客必经，旺季爆满' },
      { id: 'tourist_inside', name: '景区内商铺', area: 25, trafficModifier: 1.2, rentModifier: 1.3, description: '景区内部，客单价高' },
      { id: 'tourist_parking', name: '停车场旁', area: 65, trafficModifier: 0.75, rentModifier: 0.7, description: '面积大租金低，自驾游客群' },
    ],
  },
];

// 装修数据
export const decorations: Decoration[] = [
  {
    id: 'simple',
    name: '简约装修',
    level: 1,
    costPerSqm: 500,
    appealBonus: { students: 5, office: 5, family: 5, tourist: 5 },
    categoryBonus: { drink: 0, food: 0, snack: 0, meal: 0 },
    description: '基础装修，能省则省',
  },
  {
    id: 'modern',
    name: '现代风格',
    level: 2,
    costPerSqm: 1200,
    appealBonus: { students: 15, office: 20, family: 10, tourist: 15 },
    categoryBonus: { drink: 10, food: 5, snack: 10, meal: 5 },
    description: '简洁明亮，适合大多数品类',
  },
  {
    id: 'cozy',
    name: '温馨风格',
    level: 3,
    costPerSqm: 1800,
    appealBonus: { students: 10, office: 15, family: 25, tourist: 20 },
    categoryBonus: { drink: 15, food: 10, snack: 15, meal: 10 },
    description: '温暖舒适，家庭客群最爱',
  },
  {
    id: 'industrial',
    name: '工业风格',
    level: 3,
    costPerSqm: 1500,
    appealBonus: { students: 25, office: 20, family: 5, tourist: 25 },
    categoryBonus: { drink: 15, food: 5, snack: 10, meal: 10 },
    description: '网红打卡风，年轻人喜欢',
  },
  {
    id: 'premium',
    name: '高端装修',
    level: 4,
    costPerSqm: 3000,
    appealBonus: { students: 15, office: 30, family: 25, tourist: 30 },
    categoryBonus: { drink: 20, food: 20, snack: 20, meal: 20 },
    description: '精致高端，支撑高客单价',
  },
  {
    id: 'luxury',
    name: '奢华装修',
    level: 5,
    costPerSqm: 5000,
    appealBonus: { students: 20, office: 35, family: 30, tourist: 40 },
    categoryBonus: { drink: 25, food: 25, snack: 25, meal: 25 },
    description: '顶级配置，但回本周期极长',
  },
];

// 员工类型
export const staffTypes: StaffType[] = [
  {
    id: 'parttime',
    name: '兼职员工',
    baseSalary: 3000,
    payType: 'hourly',
    hourlyRate: 18,
    efficiency: 0.7,
    serviceQuality: 0.6,
    canHandleProducts: ['drink', 'snack'],
    maxSkillLevel: 2,
    availableTasks: ['waiter', 'cleaner', 'marketer'],
  },
  {
    id: 'fulltime',
    name: '全职员工',
    baseSalary: 5000,
    efficiency: 1.0,
    serviceQuality: 0.8,
    canHandleProducts: ['drink', 'food', 'snack', 'meal'],
    maxSkillLevel: 3,
    availableTasks: ['waiter', 'chef', 'marketer', 'cleaner'],
  },
  {
    id: 'senior',
    name: '资深员工',
    baseSalary: 7000,
    efficiency: 1.3,
    serviceQuality: 1.0,
    canHandleProducts: ['drink', 'food', 'snack', 'meal'],
    maxSkillLevel: 4,
    availableTasks: ['waiter', 'chef', 'marketer', 'cleaner', 'manager'],
  },
  {
    id: 'chef',
    name: '专业厨师',
    baseSalary: 8000,
    efficiency: 1.2,
    serviceQuality: 1.1,
    canHandleProducts: ['food', 'meal'],
    maxSkillLevel: 5,
    availableTasks: ['chef', 'manager'],
  },
];

// 品牌数据 - 正规品牌直接展示，快招品牌通过"拐走"流程出现
export const brands: Brand[] = [
  // === 正规品牌（初始展示） ===
  {
    id: 'independent',
    name: '自主创业',
    type: 'independent',
    franchiseFee: 0,
    royaltyRate: 0,
    initialReputation: 50,
    supplyCostModifier: 1.0,
    trafficMultiplier: 1.0,   // 独立店铺靠选址+门面自然引流，不应有品牌惩罚
    conversionBonus: 0,       // 无品牌信任度加成
    description: '从零开始，自主经营，风险自担',
    minArea: 15,
    maxArea: 200,
  },
  {
    id: 'mixue',
    name: '蜜雪冰城',
    type: 'franchise',
    franchiseFee: 150000,  // 原250000，降40%
    royaltyRate: 0.05,
    initialReputation: 90,
    supplyCostModifier: 0.88,
    trafficMultiplier: 1.40,  // Round 4: 从1.65回调，品牌流量优势不应过大
    conversionBonus: 0,
    description: '全球4万+门店，下沉市场之王，加盟门槛高审核严',
    allowedCategories: ['drink'],
    minArea: 30,
    maxArea: 80,
  },
  {
    id: 'luckin',
    name: '瑞幸咖啡',
    type: 'franchise',
    franchiseFee: 150000,  // 原200000，降25%适配30万初始资金
    royaltyRate: 0.05,
    initialReputation: 85,
    supplyCostModifier: 0.85,
    trafficMultiplier: 1.45,  // Round 4: 从1.70回调
    conversionBonus: 0,
    description: '国内咖啡龙头，数字化运营能力强',
    allowedCategories: ['drink'],
    minArea: 40,
    maxArea: 120,
  },
  {
    id: 'chabaidao',
    name: '茶百道',
    type: 'franchise',
    franchiseFee: 160000,  // 原280000，降43%
    royaltyRate: 0.05,
    initialReputation: 78,
    supplyCostModifier: 0.9,
    trafficMultiplier: 1.30,  // Round 4: 从1.50回调
    conversionBonus: 0,
    description: '新茶饮第三，外卖占比高，选址灵活',
    allowedCategories: ['drink'],
    minArea: 25,
    maxArea: 60,
  },
  {
    id: 'tastien',
    name: '塔斯汀',
    type: 'franchise',
    franchiseFee: 130000,  // 原320000，适配30万初始资金
    royaltyRate: 0.05,
    initialReputation: 73,
    supplyCostModifier: 0.87,
    trafficMultiplier: 1.35,  // Round 5: 从1.25上调，塔斯汀两个Agent均超时
    conversionBonus: 0,
    description: '中式汉堡开创者，下沉市场扩张快',
    allowedCategories: ['meal', 'snack'],
    minArea: 50,
    maxArea: 150,
  },
  // === 快招品牌（通过"拐走"流程出现，不直接展示） ===
  {
    id: 'nezha',
    name: '哪吒仙饮',
    type: 'franchise',
    franchiseFee: 158000,
    royaltyRate: 0.10,        // 快招抽成更狠（原0.08）
    initialReputation: 30,
    supplyCostModifier: 1.8,  // 快招供货成本极高（原1.6），蜜月期后暴露
    trafficMultiplier: 0.8,   // 快招虚假品牌认知度有限
    conversionBonus: 0,       // 快招无信任度加成
    description: '蜜雪冰城原班人马打造，《哪吒3》官方联名，门槛更低更灵活',
    minArea: 15,
    maxArea: 50,
    isQuickFranchise: true,
    parentBrandId: 'mixue',
    riskLevel: 'high',
  },
  {
    id: 'hamburg4',
    name: '燃熊中国汉堡',
    type: 'franchise',
    franchiseFee: 168000,
    royaltyRate: 0.09,
    initialReputation: 28,
    supplyCostModifier: 1.7,  // 原1.4，加强惩罚
    trafficMultiplier: 0.8,   // 快招虚假品牌认知度有限
    conversionBonus: 0,       // 快招无信任度加成
    description: '第四代汉堡革命，塔斯汀核心团队创立，三年赶超塔斯汀',
    minArea: 30,
    maxArea: 80,
    isQuickFranchise: true,
    parentBrandId: 'tastien',
    riskLevel: 'high',
  },
  {
    id: 'koreacoffee',
    name: '清潭洞咖啡',
    type: 'franchise',
    franchiseFee: 450000,
    royaltyRate: 0.1,
    initialReputation: 40,
    supplyCostModifier: 1.8,  // 原1.45，加强惩罚
    trafficMultiplier: 0.8,   // 快招虚假品牌认知度有限
    conversionBonus: 0,       // 快招无信任度加成
    description: '韩国顶级咖啡品牌，首店杭州爆火，全国限量招商中',
    minArea: 60,
    maxArea: 200,
    isQuickFranchise: true,
    parentBrandId: 'luckin',
    riskLevel: 'high',
  },
  {
    id: 'yogurt',
    name: '茉酸奶',
    type: 'franchise',
    franchiseFee: 120000,  // 原220000，适配30万初始资金
    royaltyRate: 0.06,
    initialReputation: 58,
    supplyCostModifier: 1.15,
    trafficMultiplier: 1.50,  // Round 4: 从1.80回调
    conversionBonus: 0,
    description: '高端酸奶赛道，客单价高但市场教育成本高',
    minArea: 30,
    maxArea: 80,
  },
];

// 踩坑数据（基于勇哥真实案例）
export const pitfalls: Pitfall[] = [
  {
    id: 'fake_franchise',
    category: 'franchise',
    name: '快招陷阱',
    description: '本想加盟知名品牌，却被忽悠加盟了山寨品牌',
    howToAvoid: '务必核实品牌真实性，查看直营店数量，不要轻信"子品牌"话术',
    realCase: '本想加盟蜜雪冰城，结果被推荐"蜜雪子品牌"哪吒仙饮，40万血本无归',
  },
  {
    id: 'blind_confidence',
    category: 'franchise',
    name: '盲目自信',
    description: '认为自己能打败头部品牌',
    howToAvoid: '认清现实，不要和蜜雪、瑞幸等巨头正面竞争',
    realCase: '大姐加盟无名酸奶，开在蜜雪旁边，坚信"便宜没好货"',
  },
  {
    id: 'bad_location',
    category: 'location',
    name: '选址失误',
    description: '选择了人流稀少或客群不匹配的位置',
    howToAvoid: '实地考察，数人流，看竞品，不要轻信"选址老师"',
    realCase: '奶茶店开在废弃商场，总部选址老师说"楼上写字楼就是客源"',
  },
  {
    id: 'master_location',
    category: 'location',
    name: '迷信风水',
    description: '选址靠大师用罗盘算，不看实际人流',
    howToAvoid: '科学选址，数据说话，360度转一圈看真实环境',
    realCase: '在村里开酒吧，选址全靠大师罗盘',
  },
  {
    id: 'over_invest',
    category: 'finance',
    name: '过度投资',
    description: '投入远超承受能力的资金，甚至抵押房产',
    howToAvoid: '控制总投资，预留6个月运营资金，不要All in',
    realCase: '抵押房子贷款60万，再加上积蓄30万，开了一栋"奶茶大厦"',
  },
  {
    id: 'ignore_cost',
    category: 'finance',
    name: '不懂成本',
    description: '不算毛利率，不知道每天要做多少才能保本',
    howToAvoid: '学会管理会计：收入-变动成本-固定成本=利润',
    realCase: '日营业额800，人工就要900，还在硬撑',
  },
  {
    id: 'single_product',
    category: 'product',
    name: '单品执念',
    description: '只卖一种产品，认为"没人卖就是商机"',
    howToAvoid: '丰富产品线，满足多样化需求',
    realCase: '生蚝哥借10万开海鲜店，纯卖生蚝，认为"周围没人卖就是商机"',
  },
  {
    id: 'weird_idea',
    category: 'product',
    name: '奇葩创意',
    description: '自以为看破商机，实际毫无市场',
    howToAvoid: '做大众需求，不要做"教育市场"的事',
    realCase: '机器人泡咖啡、药膳馒头、烤肠店想三年赚15亿',
  },
  {
    id: 'over_staff',
    category: 'staff',
    name: '人浮于事',
    description: '员工过多，人工成本吞噬利润',
    howToAvoid: '精简人员，提高人效，不要养闲人',
    realCase: '日营业额800元，雇了7个员工，还设了"楼长"',
  },
  {
    id: 'family_labor',
    category: 'staff',
    name: '压榨家人',
    description: '让家人无偿或超负荷劳动',
    howToAvoid: '合理配置人力资源，尊重劳动者',
    realCase: '让带孩子的丈母娘凌晨三点起床包包子',
  },
  {
    id: 'luxury_decor',
    category: 'operation',
    name: '过度装修',
    description: '装修投入过大，回本周期极长',
    howToAvoid: '轻装修重运营，装修不超过总投资的30%',
    realCase: '为奶茶店租下一整栋楼，50万装修，还开复古零食铺',
  },
  {
    id: 'price_war',
    category: 'operation',
    name: '价格战',
    description: '试图和巨头打价格战',
    howToAvoid: '差异化竞争，不要拼价格',
    realCase: '拿10万想和瑞幸打价格战，认为"瑞幸低价撑不久"',
  },
];

// 勇哥建议库
export const yongGeAdvices: YongGeAdvice[] = [
  {
    id: 'advice_1',
    title: '快招警告',
    content: '哥们，这品牌我都没听说过，总部在哪？济南？就一样板间是吧？快招公司！赶紧退钱！',
    triggerCondition: 'selectedHighRiskBrand',
    severity: 'critical',
  },
  {
    id: 'advice_2',
    title: '选址建议',
    content: '来，360度转一圈。这地方根本没人流啊！楼上写字楼就是客源？人家下班直接回家了！',
    triggerCondition: 'badLocation',
    severity: 'critical',
  },
  {
    id: 'advice_3',
    title: '成本控制',
    content: '一天卖800块，你请7个人？现在就给我去把那4个员工开了！人工比营业额还高，你在做慈善吗？',
    triggerCondition: 'overStaff',
    severity: 'critical',
  },
  {
    id: 'advice_4',
    title: '单品警告',
    content: '周围没人卖生蚝就是商机？那是没人买！你卖车找达人宣传还被骗2000，赶紧关了吧！',
    triggerCondition: 'singleProduct',
    severity: 'warning',
  },
  {
    id: 'advice_5',
    title: '加盟提醒',
    content: '你想加盟蜜雪，结果打到快招公司去了？他们说这是"第四代汉堡"？哥们，塔斯汀高管出来单干？骗鬼呢！',
    triggerCondition: 'fakeFranchise',
    severity: 'critical',
  },
  {
    id: 'advice_6',
    title: '财务健康',
    content: '毛利率连20%都不到？总部原料比市场价高1-2倍，你这根本覆盖不了成本啊！',
    triggerCondition: 'lowMargin',
    severity: 'warning',
  },
  {
    id: 'advice_7',
    title: '竞争提醒',
    content: '你凭什么觉得能干得过旁边的蜜雪？人家上市公司全球4万家店，你觉得不怎么样？',
    triggerCondition: 'competeWithGiant',
    severity: 'warning',
  },
  {
    id: 'advice_8',
    title: '止损建议',
    content: '这店没救了，今天就去把员工开了，该起诉起诉，让总部把加盟费退回来。',
    triggerCondition: 'unsaveable',
    severity: 'critical',
  },
];

// 游戏事件
export const gameEvents = [
  {
    id: 'weather_good',
    title: '天气晴朗',
    description: '本周天气持续晴好，客流量增加20%',
    impact: { type: 'revenue' as const, value: 0.2 },
  },
  {
    id: 'weather_bad',
    title: '连续阴雨',
    description: '本周连续下雨，客流量减少30%',
    impact: { type: 'revenue' as const, value: -0.3 },
  },
  {
    id: 'viral_video',
    title: '视频爆火',
    description: '有人拍了你们店的视频，意外走红',
    impact: { type: 'reputation' as const, value: 20 },
  },
  {
    id: 'food_safety',
    title: '食品安全检查',
    description: '卫生部门检查，需要整改',
    impact: { type: 'cost' as const, value: 5000 },
  },
  {
    id: 'equipment_break',
    title: '设备故障',
    description: '关键设备损坏，需要维修',
    impact: { type: 'cost' as const, value: 3000 },
  },
];
