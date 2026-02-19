/**
 * operatingCore.ts — 经营阶段核心事件（v3.1 改造）
 *
 * 原 15 个事件中的经营阶段事件，升级为沉浸式叙事：
 * - 延迟效果、临时 buff、链式事件、目标员工、动态描述
 * - narrativeHint 替代数字展示
 */

import type { InteractiveGameEvent, GameState } from '@/types/game';

export const OPERATING_CORE_EVENTS: InteractiveGameEvent[] = [

  // -------- 1. footbasin_juice（改造：目标员工移除 + 链式事件） --------
  {
    id: 'footbasin_juice',
    name: '🦶 后厨卫生危机',
    description: ((state: GameState) => {
      const kitchen = state.staff.find(s => s.assignedTask === 'kitchen');
      return kitchen
        ? `有顾客拍到${kitchen.name}用塑料洗脚盆装水果，视频在本地群疯传。评论区已经炸了。`
        : '有顾客拍到后厨用塑料洗脚盆装水果，视频在本地群疯传。评论区已经炸了。';
    }) as InteractiveGameEvent['description'],
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 3, probability: 0.35 },
    contextCheck: 'cleanliness_low',
    options: [
      {
        id: 'apologize_fix',
        text: '立即道歉 + 全面整改卫生',
        yonggeQuote: '「态度决定一切，出了事第一时间认错，花钱整改，口碑还能救回来。」',
        narrativeHint: '花一笔钱整改，口碑短期受损但能止血',
        effects: {
          cash: -5000,
          reputation: -10,
          cleanliness: 20,
          cognitionExp: 15,
          buffs: [
            { type: 'reputation_weekly', value: 3, durationWeeks: 3, source: '卫生整改后口碑逐步恢复' },
          ],
        },
      },
      {
        id: 'ignore_deny',
        text: '装作没看见，等热度过去',
        yonggeQuote: '「你以为互联网没记忆？脚盆果汁店我连线3年了，到现在还有人提。」',
        narrativeHint: '视频持续发酵，口碑和曝光持续下滑',
        effects: {
          reputation: -15,
          exposure: -10,
          cognitionExp: 5,
          buffs: [
            { type: 'reputation_weekly', value: -5, durationWeeks: 4, source: '"脚盆果汁"视频持续传播' },
            { type: 'exposure_weekly', value: -3, durationWeeks: 4, source: '负面舆情扩散' },
          ],
        },
      },
      {
        id: 'blame_employee',
        text: '甩锅给员工，开除当事人',
        yonggeQuote: '「开除员工解决不了管理问题，其他员工看在眼里，心都凉了。」',
        narrativeHint: '开除了一名员工，但团队士气受挫',
        effects: {
          reputation: -20,
          morale: -15,
          cognitionExp: 8,
          targetStaff: {
            selector: 'by_task',
            taskFilter: 'kitchen',
            effects: { remove: true },
          },
          chainEvent: {
            eventId: 'food_poisoning',
            probability: 0.3,
            delayWeeks: 3,
          },
        },
      },
    ],
  },

  // -------- 2. staff_salary_demand（重设计：原 too_many_staff） --------
  {
    id: 'staff_salary_demand',
    name: '💰 核心员工要求加薪',
    description: ((state: GameState) => {
      const best = state.staff.reduce((a, b) => a.skillLevel > b.skillLevel ? a : b, state.staff[0]);
      return best
        ? `${best.name}找你谈话，说隔壁店开出了更高的工资，希望你能涨薪。不然……`
        : '你的核心员工找你谈话，说隔壁店开出了更高的工资，希望你能涨薪。';
    }) as InteractiveGameEvent['description'],
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 4, probability: 0.45 },
    contextCheck: 'high_skill_staff',
    options: [
      {
        id: 'agree_raise',
        text: '同意加薪，留住人才',
        yonggeQuote: '「核心员工值得投资。一个熟练工顶三个新手，算算账就知道了。」',
        narrativeHint: '月薪增加，但留住了骨干',
        effects: {
          cognitionExp: 12,
          targetStaff: {
            selector: 'highest_skill',
            effects: { salary: 500, morale: 20 },
          },
        },
      },
      {
        id: 'negotiate',
        text: '谈谈，承诺下季度涨',
        yonggeQuote: '「画饼可以，但别画太大。员工不傻，你说到要做到。」',
        narrativeHint: '暂时稳住了，但对方心里有数',
        effects: {
          cognitionExp: 8,
          targetStaff: {
            selector: 'highest_skill',
            effects: { morale: -5 },
          },
          delayedEffects: [{
            delayWeeks: 4,
            effects: { morale: -10 },
            description: '承诺的加薪迟迟没兑现，核心员工开始消极怠工',
          }],
        },
      },
      {
        id: 'refuse',
        text: '拒绝，爱干干不干走',
        yonggeQuote: '「你这态度，人家不走才怪。培养一个熟练工要多久，你算过吗？」',
        narrativeHint: '对方可能会离职',
        effects: {
          cognitionExp: 5,
          targetStaff: {
            selector: 'highest_skill',
            effects: { wantsToQuit: true, morale: -30 },
          },
        },
      },
    ],
  },

  // -------- 3. supplier_price_hike（替换 no_profit_margin） --------
  {
    id: 'supplier_price_hike',
    name: '📦 供应商突然涨价',
    description: '你的主要食材供应商通知你：下周起原材料涨价15%。"没办法，上游都涨了。"',
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 4, probability: 0.40 },
    contextCheck: 'low_margin',
    options: [
      {
        id: 'accept_hike',
        text: '接受涨价，先稳住供应',
        yonggeQuote: '「短期可以接受，但你得马上算一下新的盈亏平衡点。成本涨了，售价不动，利润就被吃掉了。」',
        narrativeHint: '成本上升，利润空间被压缩',
        effects: {
          cognitionExp: 10,
          buffs: [
            { type: 'cost_multiplier', value: 0.15, durationWeeks: 6, source: '供应商涨价导致原材料成本上升15%' },
          ],
        },
      },
      {
        id: 'find_new_supplier',
        text: '花时间找新供应商',
        yonggeQuote: '「货比三家是基本功。但换供应商有磨合期，品质可能波动。」',
        narrativeHint: '短期成本略升，几周后新供应商到位',
        effects: {
          cash: -2000,
          cognitionExp: 18,
          buffs: [
            { type: 'cost_multiplier', value: 0.10, durationWeeks: 3, source: '寻找新供应商期间成本略升' },
          ],
          delayedEffects: [{
            delayWeeks: 3,
            effects: { reputation: -3 },
            description: '新供应商磨合期，食材品质略有波动',
          }],
        },
      },
      {
        id: 'negotiate_hard',
        text: '强硬谈判，威胁换人',
        yonggeQuote: '「谈判是门艺术。你有底气吗？如果你量不大，人家不怕你换。」',
        narrativeHint: '可能谈下来一点，也可能谈崩',
        effects: {
          cognitionExp: 15,
          buffs: [
            { type: 'cost_multiplier', value: 0.08, durationWeeks: 4, source: '谈判后供应商小幅涨价8%' },
          ],
        },
      },
    ],
  },

  // -------- 4. landlord_pressure（替换 sunk_cost_trap） --------
  {
    id: 'landlord_pressure',
    name: '🏠 房东要涨房租',
    description: ((state: GameState) => {
      const area = state.selectedAddress?.area || state.storeArea || 30;
      const rentMod = state.selectedAddress?.rentModifier || 1;
      const monthlyRent = (state.selectedLocation?.rentPerSqm ?? 100) * area * rentMod;
      const increase = Math.round(monthlyRent * 0.2);
      return `房东找你谈话："合同快到期了，周边都涨了，下个月起月租加${increase}。" 你刚装修完，搬走等于白扔钱……`;
    }) as InteractiveGameEvent['description'],
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 8, probability: 0.45 },
    contextCheck: 'deep_loss',
    options: [
      {
        id: 'negotiate_rent',
        text: '跟房东谈，争取少涨点',
        yonggeQuote: '「谈判的关键是让对方觉得你走了他也不好租。拿出你的经营数据，证明你是好租客。」',
        narrativeHint: '可能谈下来一些，固定成本小幅上升',
        effects: {
          cognitionExp: 20,
          buffs: [
            { type: 'cost_multiplier', value: 0.05, durationWeeks: 8, source: '房租小幅上涨' },
          ],
        },
      },
      {
        id: 'accept_rent',
        text: '认了，搬家成本更高',
        yonggeQuote: '「沉没成本陷阱。已经花出去的装修钱不应该影响你的决策，要看未来能不能赚回来。」',
        narrativeHint: '固定成本明显上升，利润进一步承压',
        effects: {
          cognitionExp: 10,
          buffs: [
            { type: 'cost_multiplier', value: 0.12, durationWeeks: 12, source: '房租大幅上涨' },
          ],
        },
      },
      {
        id: 'threaten_leave',
        text: '威胁搬走，看谁怕谁',
        yonggeQuote: '「你装修花了多少钱？搬走全打水漂。房东心里有数，你走不了的。」',
        narrativeHint: '房东不为所动，关系还搞僵了',
        effects: {
          cognitionExp: 8,
          buffs: [
            { type: 'cost_multiplier', value: 0.15, durationWeeks: 10, source: '谈崩后房东强硬涨租' },
          ],
        },
      },
    ],
  },

  // -------- 5. influencer_scam（改造：buff + 概率退款链式事件） --------
  {
    id: 'influencer_scam',
    name: '🎭 达人推广效果存疑',
    description: '你花钱请了个"本地美食达人"发视频，播放量只有200，评论看起来也不太真实……',
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 2, probability: 0.55 },
    contextCheck: 'has_social_media_marketing',
    options: [
      {
        id: 'learn_lesson',
        text: '吃一堑长一智，下次找靠谱的',
        yonggeQuote: '「找达人推广，先看他往期数据，别光看粉丝数。10万粉丝播放量200，一看就是刷的。」',
        narrativeHint: '花了冤枉钱，但学到了教训',
        effects: {
          cash: -3000,
          cognitionExp: 20,
          buffs: [
            { type: 'exposure_weekly', value: -2, durationWeeks: 2, source: '假达人视频被识破，反而掉粉' },
          ],
        },
      },
      {
        id: 'demand_refund',
        text: '找达人要求退款',
        yonggeQuote: '「要得回来算你运气好，大部分情况是钱花了就没了。所以投之前要做功课。」',
        narrativeHint: '据理力争，有一定概率要回部分费用',
        effects: {
          cash: -1500,
          cognitionExp: 12,
          chainEvent: {
            eventId: 'influencer_refund_success',
            probability: 0.35,
            delayWeeks: 2,
          },
        },
      },
      {
        id: 'hire_more',
        text: '不信邪，再找几个达人试试',
        yonggeQuote: '「同样的坑踩两次，那就不是坑的问题了，是你的问题。」',
        narrativeHint: '继续烧钱，效果依然存疑',
        effects: {
          cash: -6000,
          exposure: 5,
          cognitionExp: 5,
          buffs: [
            { type: 'exposure_weekly', value: -3, durationWeeks: 3, source: '多个假达人视频被扒，店铺口碑受损' },
          ],
        },
      },
    ],
  },

  // -------- 6. morning_cant_wake（改造：动态描述 + 收入 buff） --------
  {
    id: 'morning_cant_wake',
    name: '😴 错过早高峰',
    description: ((state: GameState) => {
      const tired = state.staff.reduce((a, b) => a.fatigue > b.fatigue ? a : b, state.staff[0]);
      return tired
        ? `连续几周高强度经营，${tired.name}今早直接睡过头了。店门10点才开，早高峰的客人全去了隔壁。`
        : '连续几周高强度经营，你和员工都疲惫不堪。今天店门10点才开，错过了整个早高峰时段。';
    }) as InteractiveGameEvent['description'],
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 4, probability: 0.40 },
    contextCheck: 'high_fatigue',
    options: [],
    notificationEffects: {
      reputation: -5,
      morale: -5,
      cognitionExp: 10,
      buffs: [
        { type: 'revenue_multiplier', value: -0.15, durationWeeks: 1, source: '错过早高峰，本周营业额下降' },
      ],
    },
    notificationQuote: '「老板不是什么都要自己干。你的时间应该花在决策上，不是每天开门关门。身体是革命的本钱，你倒下了，店也就倒了。」',
  },
];
