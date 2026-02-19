/**
 * operatingMore.ts — 经营阶段事件（第二批改造）
 *
 * barber_decor / blind_box_hotpot / ai_song_promotion /
 * slow_service_complaint / hyaluronic_coffee
 */

import type { InteractiveGameEvent } from '@/types/game';

export const OPERATING_MORE_EVENTS: InteractiveGameEvent[] = [

  // -------- 7. barber_decor（改造：渐进 buff + 新选项 DIY） --------
  {
    id: 'barber_decor',
    name: '💈 顾客吐槽装修',
    description: '有顾客在点评网站吐槽："这家店装修像理发店，我差点走错门。" 评论下面一堆人点赞。',
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 3, probability: 0.40 },
    contextCheck: 'cheap_decoration',
    options: [
      {
        id: 'add_signage',
        text: '花钱加个醒目招牌和门头',
        yonggeQuote: '「门头是你的第一张名片。路人3秒内决定进不进来，你那招牌能留住人吗？」',
        narrativeHint: '投入一笔钱，门面逐渐改善，进店率慢慢提升',
        effects: {
          cash: -4000,
          cognitionExp: 10,
          buffs: [
            { type: 'reputation_weekly', value: 2, durationWeeks: 4, source: '新门头提升了店铺形象' },
            { type: 'exposure_weekly', value: 3, durationWeeks: 4, source: '醒目招牌吸引更多路人注意' },
          ],
        },
      },
      {
        id: 'diy_decor',
        text: '自己动手，花小钱改造',
        yonggeQuote: '「省钱是好事，但别省过头。自己刷墙贴纸，效果能好到哪去？」',
        narrativeHint: '花费不多，效果有限但聊胜于无',
        effects: {
          cash: -800,
          cognitionExp: 8,
          buffs: [
            { type: 'reputation_weekly', value: 1, durationWeeks: 3, source: 'DIY装修略有改善' },
          ],
        },
      },
      {
        id: 'ignore_review',
        text: '不理会，产品好就行',
        yonggeQuote: '「酒香也怕巷子深。你产品再好，人家连门都不想进，有什么用？」',
        narrativeHint: '什么都没变，吐槽还会继续',
        effects: {
          cognitionExp: 5,
          buffs: [
            { type: 'reputation_weekly', value: -1, durationWeeks: 3, source: '"理发店装修"的吐槽持续发酵' },
          ],
        },
      },
    ],
  },

  // -------- 8. blind_box_hotpot（重设计：先涨后跌延迟效果） --------
  {
    id: 'blind_box_hotpot',
    name: '🎁 盲盒营销诱惑',
    description: '有人建议你搞"盲盒套餐"——随机菜品组合，在社交媒体上很火。短视频博主都在拍。',
    category: 'random',
    triggerCondition: { phase: 'operating', minWeek: 3, probability: 0.30 },
    options: [
      {
        id: 'try_blindbox',
        text: '试试看，搞个限时盲盒活动',
        yonggeQuote: '「噱头能带来一波流量，但留不住人。顾客来了发现不好吃，下次就不来了。」',
        narrativeHint: '短期流量暴涨，但后续可能有反噬',
        effects: {
          cash: -2000,
          exposure: 15,
          cognitionExp: 10,
          buffs: [
            { type: 'demand_boost', value: 0.20, durationWeeks: 2, source: '盲盒活动引爆短期流量' },
          ],
          delayedEffects: [
            {
              delayWeeks: 3,
              effects: { reputation: -8, exposure: -10 },
              description: '盲盒热度退去，部分顾客吐槽"开到的菜品不值这个价"',
            },
          ],
        },
      },
      {
        id: 'focus_quality',
        text: '不搞花活，专注产品品质',
        yonggeQuote: '「餐饮的本质是好吃、干净、性价比。花里胡哨的东西，火一阵就没了。」',
        narrativeHint: '稳扎稳打，口碑慢慢积累',
        effects: {
          reputation: 3,
          cognitionExp: 15,
        },
      },
    ],
  },

  // -------- 9. ai_song_promotion（改造：概率大成功链式事件） --------
  {
    id: 'ai_song_promotion',
    name: '🎵 AI写歌推广',
    description: '朋友说现在流行用AI给店铺写主题曲，发到抖音上能火。要不要试试？',
    category: 'random',
    triggerCondition: { phase: 'operating', minWeek: 2, probability: 0.25 },
    options: [
      {
        id: 'try_ai_song',
        text: '花500块搞一个试试',
        yonggeQuote: '「500块买个乐子也行，但别指望一首歌能救活一家店。营销是锦上添花，不是雪中送炭。」',
        narrativeHint: '小成本尝试，说不定有惊喜',
        effects: {
          cash: -500,
          exposure: 6,
          cognitionExp: 8,
          chainEvent: {
            eventId: 'viral_review',
            probability: 0.20,
            delayWeeks: 2,
          },
        },
      },
      {
        id: 'skip_gimmick',
        text: '算了，把钱花在刀刃上',
        yonggeQuote: '「这个判断不错。钱要花在能直接带来客流的地方。」',
        narrativeHint: '省下钱用在更实际的地方',
        effects: { cognitionExp: 10 },
      },
    ],
  },

  // -------- 10. slow_service_complaint（替换 ancient_method_obsession） --------
  {
    id: 'slow_service_complaint',
    name: '🐢 顾客抱怨出餐慢',
    description: '最近差评里频繁出现"等了40分钟""出餐太慢了"。高峰期顾客排队等到不耐烦直接走了。',
    category: 'operation',
    triggerCondition: { phase: 'operating', minWeek: 4, probability: 0.40 },
    contextCheck: 'supply_shortage',
    options: [
      {
        id: 'streamline',
        text: '优化出餐流程，标准化操作',
        yonggeQuote: '「消费者为结果买单，不为过程买单。标准化不是偷工减料，是效率。」',
        narrativeHint: '花时间整顿流程，出餐速度逐步提升',
        effects: {
          cognitionExp: 20,
          buffs: [
            { type: 'reputation_weekly', value: 2, durationWeeks: 3, source: '出餐流程优化后顾客等待时间缩短' },
          ],
        },
      },
      {
        id: 'add_staff',
        text: '加人手解决问题',
        yonggeQuote: '「加人是最简单的办法，但也是最贵的。你算过人效比吗？」',
        narrativeHint: '人工成本上升，但出餐确实快了',
        effects: {
          cognitionExp: 10,
          buffs: [
            { type: 'cost_multiplier', value: 0.08, durationWeeks: 4, source: '临时加人手增加人工成本' },
            { type: 'reputation_weekly', value: 1, durationWeeks: 4, source: '加人后出餐速度有所改善' },
          ],
        },
      },
      {
        id: 'insist_craft',
        text: '坚持手作品质，慢工出细活',
        yonggeQuote: '「情怀不能当饭吃。先活下来，再谈情怀。顾客等不了你的"慢工"。」',
        narrativeHint: '什么都没改变，差评还会继续',
        effects: {
          cognitionExp: 5,
          buffs: [
            { type: 'reputation_weekly', value: -2, durationWeeks: 4, source: '出餐慢的差评持续增加' },
          ],
        },
      },
    ],
  },

  // -------- 11. hyaluronic_coffee（改造：成本 debuff） --------
  {
    id: 'hyaluronic_coffee',
    name: '💉 总部推新品',
    description: '总部推出"玻尿酸咖啡"新品，要求你进货。成本高，卖点全靠噱头。"不进货就扣分。"',
    category: 'franchise',
    triggerCondition: { phase: 'operating', minWeek: 4, probability: 0.50 },
    contextCheck: 'is_quick_franchise',
    options: [
      {
        id: 'refuse_hq',
        text: '拒绝总部要求',
        yonggeQuote: '「敢对总部说不，说明你开始有自己的判断了。快招品牌的"新品"，十有八九是割韭菜。」',
        narrativeHint: '保住了钱包，但总部可能有后续动作',
        effects: {
          cognitionExp: 20,
          delayedEffects: [{
            delayWeeks: 2,
            effects: { cash: -1000 },
            description: '总部以"不配合推广"为由扣了你的保证金',
          }],
        },
      },
      {
        id: 'obey_hq',
        text: '听总部的，进一批试试',
        yonggeQuote: '「又交学费了。总部赚的是你的进货钱，卖不卖得出去跟他们没关系。」',
        narrativeHint: '进了一批高价货，卖不动就砸手里了',
        effects: {
          cash: -5000,
          cognitionExp: 8,
          buffs: [
            { type: 'cost_multiplier', value: 0.10, durationWeeks: 4, source: '玻尿酸咖啡原料成本高昂' },
          ],
          delayedEffects: [{
            delayWeeks: 4,
            effects: { cash: -2000 },
            description: '玻尿酸咖啡滞销，大量原料过期报废',
          }],
        },
      },
    ],
  },

  // -------- influencer_refund_success（链式事件：达人退款成功） --------
  {
    id: 'influencer_refund_success',
    name: '💸 达人退款了！',
    description: '没想到那个达人居然真的退了一部分钱。看来据理力争还是有用的。',
    category: 'random',
    triggerCondition: { phase: 'operating', minWeek: 1, probability: 0 }, // 仅链式触发
    options: [],
    notificationEffects: {
      cash: 2000,
      cognitionExp: 5,
    },
    notificationQuote: '「运气不错，但别指望每次都能要回来。预防比补救重要。」',
  },
];
