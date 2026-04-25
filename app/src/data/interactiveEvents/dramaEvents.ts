/**
 * dramaEvents.ts — 戏剧性事件（Phase 3）
 *
 * 5 个高光事件：
 *   - viral_dish      单周营收破万
 *   - media_visit     整洁度高 + 媒体探店
 *   - chain_invitation 6 周连续盈利后的加盟邀请
 *   - delivery_top3   外卖排名进前 3
 *   - award_winning   口碑 90+ 行业奖项
 *
 * 3 个翻盘事件链：
 *   - vc_angel       连亏 5 周后投资人主动找上门
 *   - media_redeem   食安/卫生告警后媒体翻案
 *   - community_save 社区/学校客群忠诚度高时社群众筹
 *
 * 1 个破产强制事件：
 *   - debt_collector 连亏 8 周强制 3 选 1
 *
 * 这些事件的 triggerCondition.probability 设为 0：
 *   它们不通过常规事件抽取触发，仅由 dramaEngine 主动注入。
 */

import type { InteractiveGameEvent } from '@/types/game';

export const DRAMA_EVENTS: InteractiveGameEvent[] = [
  // ===== 高光事件 =====
  {
    id: 'highlight_viral_dish',
    name: '🌟 单品爆单',
    description: (s) => `这周营收破了 ¥${Math.round(s.weeklyRevenue ?? 0).toLocaleString()}！有食客把照片发到了网上，评论区开始有人@你的店。`,
    category: 'random',
    triggerCondition: { phase: 'operating', probability: 0 },
    options: [
      {
        id: 'ride_wave',
        text: '顺势加大营销，趁热打铁',
        yonggeQuote: '风口来了猪都能飞，但风停了你得是只鸟。',
        effects: {
          cash: -800,
          exposure: 6,
          reputation: 4,
          cognitionExp: 30,
          buffs: [{ type: 'demand_boost', value: 0.2, durationWeeks: 3, source: 'viral_buff' }],
        },
      },
      {
        id: 'stay_calm',
        text: '保持节奏，不让员工累垮',
        yonggeQuote: '你以为是火，其实是闪光。爆单一时爽，员工跑光火葬场。',
        effects: { reputation: 3, morale: 5, cognitionExp: 25 },
      },
    ],
  },
  {
    id: 'highlight_media_visit',
    name: '📺 美食博主探店',
    description: '一个本地美食博主突然来探店，说店里干净又有味道，准备拍条视频。',
    category: 'operation',
    triggerCondition: { phase: 'operating', probability: 0 },
    options: [
      {
        id: 'paid_promo',
        text: '掏钱买推广位',
        yonggeQuote: '钱花对地方就是投资，花错地方就是供养。你算清楚再决定。',
        effects: { cash: -1500, exposure: 12, reputation: 6, cognitionExp: 35 },
      },
      {
        id: 'natural_visit',
        text: '请他自由发挥',
        yonggeQuote: '真东西不怕真镜头。',
        effects: { exposure: 5, reputation: 8, cleanliness: 2, cognitionExp: 30 },
      },
    ],
  },
  {
    id: 'highlight_chain_invitation',
    name: '🤝 加盟邀请',
    description: '一家区域品牌看上你的口碑，发来加盟邀请——挂他们的牌子，他们出供货和营销，你出店面和管理。',
    category: 'franchise',
    triggerCondition: { phase: 'operating', probability: 0 },
    options: [
      {
        id: 'accept_chain',
        text: '挂牌：稳定供货 + 现成流量',
        yonggeQuote: '换了招牌就不是你自己的店了。但稳。',
        effects: {
          cash: 5000,
          exposure: 10,
          reputation: -2,
          cognitionExp: 60,
          buffs: [{ type: 'cost_increase', value: 0.05, durationWeeks: 12, source: 'franchise_fee' }],
        },
      },
      {
        id: 'reject_chain',
        text: '拒绝：守住自己的牌子',
        yonggeQuote: '心里有招牌的人，不会轻易换招牌。',
        effects: { reputation: 6, cognitionExp: 50 },
      },
    ],
  },
  {
    id: 'highlight_delivery_top3',
    name: '🥇 平台 TOP3',
    description: '外卖平台运营找上门：你的店挤进了片区前三，可以申请"金标商家"。',
    category: 'operation',
    triggerCondition: { phase: 'operating', probability: 0 },
    options: [
      {
        id: 'apply_gold',
        text: '申请：年费换更高曝光',
        yonggeQuote: '平台给的标，平台随时能拿走，你心里得有这根弦。',
        effects: {
          cash: -2000,
          exposure: 14,
          cognitionExp: 40,
          buffs: [{ type: 'demand_boost', value: 0.12, durationWeeks: 8, source: 'platform_gold' }],
        },
      },
      {
        id: 'skip_gold',
        text: '不申请，把钱花在出餐质量上',
        yonggeQuote: '复购率永远比曝光率值钱。',
        effects: { reputation: 6, cleanliness: 3, cognitionExp: 35 },
      },
    ],
  },
  {
    id: 'highlight_award_winning',
    name: '🏆 行业奖项',
    description: '当地行业协会发来通知，你被提名为"年度优质小店"。颁奖晚会上需要你出席并发言。',
    category: 'mindset',
    triggerCondition: { phase: 'operating', probability: 0 },
    options: [
      {
        id: 'attend_award',
        text: '出席：露脸 + 行业人脉',
        yonggeQuote: '镜头再多，也得记得回来给客人续茶。',
        effects: { cash: -800, exposure: 8, reputation: 8, cognitionExp: 50 },
      },
      {
        id: 'send_thanks',
        text: '婉拒：把时间留给店里',
        yonggeQuote: '该上的台一次不少，但不该被名头牵着走。',
        effects: { reputation: 4, cognitionExp: 40, morale: 3 },
      },
    ],
  },

  // ===== 翻盘事件链 =====
  {
    id: 'turnaround_vc_angel',
    name: '💼 投资人主动联系',
    description: (s) =>
      `你已经连亏 ${s.consecutiveLossWeeks ?? 0} 周。一个自称"做小餐饮投资"的人发来微信：愿意注资 ¥20k，占 30% 股份。`,
    category: 'mindset',
    triggerCondition: { phase: 'operating', probability: 0 },
    options: [
      {
        id: 'take_funding',
        text: '签字接受：救命钱',
        yonggeQuote: '有人愿意投你，先看清楚他要什么。30% 不是小数。',
        effects: { cash: 20000, reputation: -2, cognitionExp: 60 },
      },
      {
        id: 'negotiate',
        text: '反提：¥30k 占 20%',
        yonggeQuote: '有底气的人才有筹码，他既然找你就证明你还有价值。',
        effects: {
          cash: 0,
          cognitionExp: 80,
          delayedEffects: [
            { delayWeeks: 1, effects: { cash: 25000 }, description: '投资人最终接受了 ¥25k 占 25% 的方案' },
          ],
        },
      },
      {
        id: 'reject_funding',
        text: '拒绝：自己扛',
        yonggeQuote: '能自救的店主，比能借钱的店主活得久。',
        effects: { reputation: 5, morale: 5, cognitionExp: 70 },
      },
    ],
  },
  {
    id: 'turnaround_media_redeem',
    name: '🎙️ 媒体翻案',
    description: '前段时间的食安/卫生告警让你口碑下滑，一个本地公众号愿意做一期"小店改造"专题，给你正名。',
    category: 'random',
    triggerCondition: { phase: 'operating', probability: 0 },
    options: [
      {
        id: 'accept_makeover',
        text: '配合改造：拍摄+整改',
        yonggeQuote: '愿意整改的店主，比死扛面子的店主活得长。',
        effects: { cash: -1200, cleanliness: 15, reputation: 12, cognitionExp: 50 },
      },
      {
        id: 'private_fix',
        text: '不上镜，自己悄悄改',
        yonggeQuote: '行有行的规矩，但默默做事的人也有他的市场。',
        effects: { cash: -600, cleanliness: 8, reputation: 4, cognitionExp: 40 },
      },
    ],
  },
  {
    id: 'turnaround_community_save',
    name: '👥 社区众筹',
    description: '常客们听说你最近不容易，私下组了个群，说要发起"先付费，后消费"的会员卡，帮你撑过来。',
    category: 'mindset',
    triggerCondition: { phase: 'operating', probability: 0 },
    options: [
      {
        id: 'accept_crowdfund',
        text: '接受：感恩并兑现承诺',
        yonggeQuote: '欠人情比欠钱难还，但用心还的人最终都还得起。',
        effects: {
          cash: 8000,
          reputation: 12,
          cognitionExp: 70,
          delayedEffects: [
            { delayWeeks: 4, effects: { cash: -800, reputation: 3 }, description: '陆续兑现会员卡消费，但口碑回升' },
          ],
        },
      },
      {
        id: 'decline_crowdfund',
        text: '婉拒：不让客人为我兜底',
        yonggeQuote: '尊重客人最好的方式，是不把他们当救命稻草。',
        effects: { reputation: 8, cognitionExp: 60, morale: 4 },
      },
    ],
  },

  // ===== 强制破产事件 =====
  {
    id: 'turnaround_debt_collector',
    name: '⚠️ 房东+供应商上门',
    description: (s) =>
      `连亏 ${s.consecutiveLossWeeks ?? 8} 周。这周房东和供应商一起堵在门口，限你 3 天内给个说法。`,
    category: 'mindset',
    triggerCondition: { phase: 'operating', probability: 0 },
    options: [
      {
        id: 'sell_store',
        text: '卖店止损：转让给同行',
        yonggeQuote: '能体面退出，也是赢。',
        effects: { cash: 8000, reputation: -10, cognitionExp: 100 },
      },
      {
        id: 'borrow_money',
        text: '借钱续命：抵押 + 高利',
        yonggeQuote: '利息这东西，不见血但能要命。',
        effects: {
          cash: 15000,
          cognitionExp: 80,
          delayedEffects: [
            { delayWeeks: 4, effects: { cash: -8000 }, description: '第一笔利息到期' },
            { delayWeeks: 8, effects: { cash: -8000 }, description: '第二笔利息到期' },
          ],
        },
      },
      {
        id: 'tough_it_out',
        text: '死撑：跟房东谈宽限',
        yonggeQuote: '硬撑过去叫坚持，撑不过去叫顽固。',
        effects: { reputation: -3, morale: -5, cognitionExp: 60 },
      },
    ],
  },
];
