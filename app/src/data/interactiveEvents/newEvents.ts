/**
 * newEvents.ts — v3.1 新增经营阶段事件（6个）
 *
 * employee_poached / food_poisoning / viral_review /
 * health_inspection / staff_conflict / ingredient_shortage
 */

import type { InteractiveGameEvent, GameState } from '@/types/game';

export const NEW_EVENTS: InteractiveGameEvent[] = [

  // -------- 12. employee_poached（新增：竞争对手挖人） --------
  {
    id: 'employee_poached',
    name: '🏃 竞争对手挖墙脚',
    description: ((state: GameState) => {
      const best = state.staff.reduce((a, b) => a.skillLevel > b.skillLevel ? a : b, state.staff[0]);
      return best
        ? `隔壁新开的店老板私下找到${best.name}，开出了双倍工资。${best.name}跟你说了这件事，但看得出来在犹豫。`
        : '隔壁新开的店老板私下找你的核心员工，开出了双倍工资。';
    }) as InteractiveGameEvent['description'],
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 6, probability: 0.35 },
    contextCheck: 'high_skill_staff',
    options: [
      {
        id: 'counter_offer',
        text: '加薪挽留，表达重视',
        yonggeQuote: '「人才是最贵的资产。留住一个熟练工，比招三个新手划算。」',
        narrativeHint: '花钱留人，团队稳定性得到保障',
        effects: {
          cognitionExp: 15,
          targetStaff: {
            selector: 'highest_skill',
            effects: { salary: 800, morale: 25 },
          },
        },
      },
      {
        id: 'let_go',
        text: '不留，强扭的瓜不甜',
        yonggeQuote: '「走了也好，说明你的薪资体系有问题。趁机反思一下。」',
        narrativeHint: '失去一名骨干，短期运营受影响',
        effects: {
          cognitionExp: 12,
          morale: -10,
          targetStaff: {
            selector: 'highest_skill',
            effects: { remove: true },
          },
          buffs: [
            { type: 'supply_reduction', value: 0.15, durationWeeks: 3, source: '核心员工离职，出餐能力下降' },
          ],
        },
      },
      {
        id: 'guilt_trip',
        text: '打感情牌，说"我们是一起打拼的"',
        yonggeQuote: '「感情牌能用一次，不能用两次。人家要养家糊口，你光画饼不行。」',
        narrativeHint: '暂时留住了，但心已经不在了',
        effects: {
          cognitionExp: 8,
          targetStaff: {
            selector: 'highest_skill',
            effects: { morale: -15 },
          },
          delayedEffects: [{
            delayWeeks: 4,
            effects: { morale: -10 },
            description: '当初被感情牌留下的员工，工作越来越敷衍',
          }],
        },
      },
    ],
  },

  // -------- 13. food_poisoning（新增：食品安全事故） --------
  {
    id: 'food_poisoning',
    name: '🤢 顾客吃坏肚子了',
    description: '一位顾客打电话来说吃完你家的东西上吐下泻，要求赔偿。语气很激动，说要投诉到市场监管局。',
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 3, probability: 0.30 },
    contextCheck: 'cleanliness_low',
    options: [
      {
        id: 'compensate_fast',
        text: '立即赔偿 + 排查后厨',
        yonggeQuote: '「食品安全是底线，出了事第一时间处理。拖一天，事情就大一分。」',
        narrativeHint: '花钱消灾，同时排查隐患',
        effects: {
          cash: -3000,
          reputation: -5,
          cleanliness: 15,
          cognitionExp: 18,
          buffs: [
            { type: 'reputation_weekly', value: -2, durationWeeks: 2, source: '食品安全事件短期影响' },
          ],
        },
      },
      {
        id: 'deny_responsibility',
        text: '否认是你家的问题',
        yonggeQuote: '「你否认有用吗？人家一个差评加一个投诉，你这店就上黑名单了。」',
        narrativeHint: '省了赔偿金，但后果可能更严重',
        effects: {
          cognitionExp: 5,
          buffs: [
            { type: 'reputation_weekly', value: -5, durationWeeks: 4, source: '食品安全投诉被曝光' },
          ],
          chainEvent: {
            eventId: 'health_inspection',
            probability: 0.60,
            delayWeeks: 2,
          },
        },
      },
    ],
  },

  // -------- 14. viral_review（新增：好评爆火） --------
  {
    id: 'viral_review',
    name: '🔥 一条好评火了！',
    description: ((state: GameState) => {
      const brandName = state.selectedBrand?.name ?? '你的店';
      return `一位顾客在小红书发了篇"${brandName}宝藏小店"的帖子，一夜之间点赞过万。评论区都在问地址。`;
    }) as InteractiveGameEvent['description'],
    category: 'random',
    triggerCondition: { phase: 'operating', minWeek: 4, probability: 0.25 },
    contextCheck: 'high_reputation',
    options: [
      {
        id: 'seize_moment',
        text: '趁热打铁，推出限时优惠',
        yonggeQuote: '「流量来了要接住。搞个限时活动，把路人变成回头客。」',
        narrativeHint: '花点钱做活动，把流量转化为长期客户',
        effects: {
          cash: -2000,
          cognitionExp: 15,
          buffs: [
            { type: 'demand_boost', value: 0.25, durationWeeks: 3, source: '小红书爆款帖子引流' },
            { type: 'exposure_weekly', value: 8, durationWeeks: 3, source: '社交媒体自然流量涌入' },
          ],
        },
      },
      {
        id: 'do_nothing',
        text: '顺其自然，不额外投入',
        yonggeQuote: '「白来的流量不抓住，过了这村就没这店了。但也别慌，稳住品质最重要。」',
        narrativeHint: '自然流量会来一波，但持续时间有限',
        effects: {
          cognitionExp: 10,
          buffs: [
            { type: 'demand_boost', value: 0.15, durationWeeks: 2, source: '小红书帖子自然引流' },
            { type: 'exposure_weekly', value: 5, durationWeeks: 2, source: '社交媒体自然曝光' },
          ],
        },
      },
    ],
  },

  // -------- 15. health_inspection（新增：卫生检查） --------
  {
    id: 'health_inspection',
    name: '🔍 市场监管局来检查了',
    description: '两个穿制服的人走进店里，亮出证件："例行检查，请配合。" 你心里咯噔一下。',
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 6, probability: 0.30 },
    contextCheck: 'operating_6_weeks',
    options: [
      {
        id: 'cooperate_fully',
        text: '全力配合，主动展示后厨',
        yonggeQuote: '「坦坦荡荡最好。如果你平时就注意卫生，检查就是加分项。」',
        narrativeHint: '配合检查，结果取决于你平时的卫生管理',
        effects: {
          cognitionExp: 12,
          // 整洁度高的店会因此获得口碑加成（通过 buff 模拟）
          buffs: [
            { type: 'reputation_weekly', value: 1, durationWeeks: 2, source: '通过卫生检查，顾客更放心' },
          ],
        },
      },
      {
        id: 'nervous_hide',
        text: '紧张地收拾，试图藏起问题',
        yonggeQuote: '「藏？你藏得住吗？人家是专业的，一眼就看出来了。越藏越严重。」',
        narrativeHint: '欲盖弥彰，可能被罚款',
        effects: {
          cash: -5000,
          reputation: -8,
          cognitionExp: 8,
          buffs: [
            { type: 'reputation_weekly', value: -3, durationWeeks: 3, source: '卫生检查不合格被公示' },
          ],
        },
      },
    ],
  },

  // -------- 16. staff_conflict（新增：员工内部矛盾） --------
  {
    id: 'staff_conflict',
    name: '⚡ 员工闹矛盾了',
    description: ((state: GameState) => {
      if (state.staff.length < 2) return '店里两个员工因为排班问题吵了起来，差点动手。';
      const morales = state.staff.map(s => ({ name: s.name, morale: s.morale }));
      morales.sort((a, b) => a.morale - b.morale);
      return `${morales[0].name}和${morales[morales.length - 1].name}因为排班问题吵了起来。${morales[0].name}觉得自己干得多拿得少，当着顾客的面发了脾气。`;
    }) as InteractiveGameEvent['description'],
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 4, probability: 0.35 },
    contextCheck: 'staff_morale_gap',
    options: [
      {
        id: 'mediate',
        text: '分别谈话，调解矛盾',
        yonggeQuote: '「管人是最难的。但你不管，小矛盾就变大矛盾，最后整个团队都散了。」',
        narrativeHint: '花时间调解，团队氛围逐步恢复',
        effects: {
          morale: 8,
          cognitionExp: 15,
          buffs: [
            { type: 'reputation_weekly', value: 1, durationWeeks: 2, source: '内部矛盾化解，服务态度改善' },
          ],
        },
      },
      {
        id: 'ignore_conflict',
        text: '不管，让他们自己解决',
        yonggeQuote: '「你不管，他们就用脚投票。要么消极怠工，要么直接走人。」',
        narrativeHint: '矛盾持续发酵，影响服务质量',
        effects: {
          cognitionExp: 5,
          targetStaff: {
            selector: 'lowest_morale',
            effects: { morale: -20 },
          },
          buffs: [
            { type: 'reputation_weekly', value: -2, durationWeeks: 3, source: '员工带着情绪上班，服务质量下降' },
          ],
        },
      },
      {
        id: 'fire_troublemaker',
        text: '开除闹事的那个',
        yonggeQuote: '「开除容易，但你搞清楚谁是"闹事的"了吗？也许人家说的是实话。」',
        narrativeHint: '快刀斩乱麻，但可能伤了其他人的心',
        effects: {
          morale: -10,
          cognitionExp: 8,
          targetStaff: {
            selector: 'lowest_morale',
            effects: { remove: true },
          },
        },
      },
    ],
  },

  // -------- 17. ingredient_shortage（新增：食材断供） --------
  {
    id: 'ingredient_shortage',
    name: '📉 食材断供了',
    description: '供应商打电话来："不好意思，这周的货发不了，物流出了问题。" 你的库存只够撑两天。',
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 3, probability: 0.30 },
    options: [
      {
        id: 'emergency_purchase',
        text: '紧急从超市高价采购',
        yonggeQuote: '「应急可以，但成本翻倍。这次之后，你得建立备用供应商名单。」',
        narrativeHint: '高价采购保住营业，成本大幅上升',
        effects: {
          cash: -3000,
          cognitionExp: 12,
          buffs: [
            { type: 'cost_multiplier', value: 0.25, durationWeeks: 1, source: '紧急采购导致本周食材成本翻倍' },
          ],
        },
      },
      {
        id: 'reduce_menu',
        text: '临时缩减菜单，卖能卖的',
        yonggeQuote: '「灵活应变，不错。但要跟顾客解释清楚，别让人家白跑一趟。」',
        narrativeHint: '营业额下降，但控制住了成本',
        effects: {
          cognitionExp: 15,
          buffs: [
            { type: 'supply_reduction', value: 0.30, durationWeeks: 1, source: '食材断供，部分产品暂停供应' },
            { type: 'reputation_weekly', value: -2, durationWeeks: 1, source: '菜单缩减引起部分顾客不满' },
          ],
        },
      },
      {
        id: 'close_temp',
        text: '干脆歇业两天等货到',
        yonggeQuote: '「歇业一天，固定成本照付，客人跑到竞争对手那去了。你算算这笔账。」',
        narrativeHint: '白白损失两天营业额和固定成本',
        effects: {
          cognitionExp: 5,
          buffs: [
            { type: 'revenue_multiplier', value: -0.30, durationWeeks: 1, source: '歇业两天损失大量营业额' },
          ],
        },
      },
    ],
  },
];
