/**
 * setupEvents.ts — 筹备阶段事件（v3.1 增强）
 *
 * search_hijack / showroom_trap / location_teacher_scam
 * 增强：链式事件、信任 debuff、延迟效果
 */

import type { InteractiveGameEvent } from '@/types/game';

export const SETUP_EVENTS: InteractiveGameEvent[] = [

  // -------- 18. search_hijack（改造：链式骚扰电话） --------
  {
    id: 'search_hijack',
    name: '🔍 加盟品牌搜索',
    description: '你在网上搜品牌加盟电话，排在第一的"官方客服"热情地说：这个品牌已经饱和了，推荐你看看我们的"子品牌"。',
    category: 'franchise',
    triggerCondition: { phase: 'setup', setupStep: 'select_brand', probability: 0.60 },
    contextCheck: 'browsing_franchise',
    options: [
      {
        id: 'see_through',
        text: '识破套路，直接挂电话',
        yonggeQuote: '「搜索引擎前几条都是广告，快招公司专门截胡正规品牌的流量。记住：官方电话要从品牌官网找。」',
        narrativeHint: '避开了一个坑，但电话号码可能已经泄露了',
        effects: {
          cognitionExp: 20,
        },
      },
      {
        id: 'curious_listen',
        text: '好奇听听，了解一下"子品牌"',
        yonggeQuote: '「你一听就完了，他们话术练了几千遍，专门针对你这种犹豫的人。」',
        narrativeHint: '留了联系方式，接下来可能会被轮番轰炸',
        effects: {
          cognitionExp: 10,
          chainEvent: {
            eventId: 'harassment_calls',
            probability: 0.70,
            delayWeeks: 1,
          },
        },
      },
    ],
  },

  // -------- harassment_calls（链式事件：骚扰电话轰炸） --------
  {
    id: 'harassment_calls',
    name: '📱 电话被轰炸了',
    description: '自从那次搜索后，每天都有不同的"品牌顾问"打电话来，有的甚至直接加了你微信。删都删不完。',
    category: 'franchise',
    triggerCondition: { phase: 'setup', setupStep: 'select_brand', probability: 0 }, // 仅链式触发
    options: [],
    notificationEffects: {
      cognitionExp: 8,
    },
    notificationQuote: '「你的信息已经在快招公司之间流通了。一个号码卖几十块，他们叫"资源"。以后搜加盟信息，别用真号码。」',
  },

  // -------- 19. showroom_trap（增强：信任 debuff） --------
  {
    id: 'showroom_trap',
    name: '🏢 总部样板间参观',
    description: '品牌方带你参观了气派的总部和样板店，生意火爆，你心动了。但仔细看，样板店里的"顾客"好像都是工作人员……',
    category: 'franchise',
    triggerCondition: { phase: 'setup', setupStep: 'select_brand', probability: 0.70 },
    contextCheck: 'selected_quick_franchise',
    options: [
      {
        id: 'investigate',
        text: '暗访其他加盟店，问问真实情况',
        yonggeQuote: '「样板间谁不会搞？你要看的是普通加盟店的真实经营数据。去问问已经开了半年的加盟商。」',
        narrativeHint: '花时间调查，建立了更理性的判断力',
        effects: {
          cognitionExp: 25,
        },
      },
      {
        id: 'trust_brand',
        text: '总部这么大，应该靠谱',
        yonggeQuote: '「写字楼租一层，样板间花10万搞一个，骗你几十万加盟费，这笔账他们算得很清楚。」',
        narrativeHint: '被表象迷惑，后续决策可能受影响',
        effects: {
          cash: -3000,
          cognitionExp: 5,
          buffs: [
            { type: 'reputation_weekly', value: -1, durationWeeks: 4, source: '盲目信任快招品牌，经营方向偏差' },
          ],
        },
      },
    ],
  },

  // -------- 20. location_teacher_scam（增强：链式事件"专家消失"） --------
  {
    id: 'location_teacher_scam',
    name: '📍 选址专家来电',
    description: '有个"选址专家"主动联系你，说有个绝佳旺铺要转让，但要先交2万"信息费"。声音很专业，还发了营业执照照片。',
    category: 'franchise',
    triggerCondition: { phase: 'setup', setupStep: 'select_location', probability: 0.40 },
    options: [
      {
        id: 'refuse_scam',
        text: '拒绝，自己实地考察',
        yonggeQuote: '「选址没有捷径，自己去蹲点数人头。花钱找"选址老师"，十个有九个是中介吃差价。」',
        narrativeHint: '省下2万，靠自己的腿和眼睛',
        effects: { cognitionExp: 20 },
      },
      {
        id: 'pay_info_fee',
        text: '交钱看看，万一是真的呢',
        yonggeQuote: '「2万块买个教训。那个"旺铺"大概率是别人转不出去的烂铺，他赚的就是你这个信息费。」',
        narrativeHint: '钱打过去了，对方可能就消失了',
        effects: {
          cash: -20000,
          cognitionExp: 10,
          chainEvent: {
            eventId: 'expert_vanished',
            probability: 0.80,
            delayWeeks: 1,
          },
        },
      },
    ],
  },

  // -------- expert_vanished（链式事件：选址专家消失） --------
  {
    id: 'expert_vanished',
    name: '👻 "专家"失联了',
    description: '你打电话过去，提示"您拨打的号码已停机"。微信也被删了。2万块，就这么没了。',
    category: 'franchise',
    triggerCondition: { phase: 'setup', setupStep: 'select_location', probability: 0 }, // 仅链式触发
    options: [],
    notificationEffects: {
      cognitionExp: 15,
    },
    notificationQuote: '「我见过太多这种了。营业执照？网上花50块就能P一个。记住：任何要你先交钱的"好机会"，99%是骗局。」',
  },
];
