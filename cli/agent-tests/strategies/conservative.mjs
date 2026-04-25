/**
 * conservative.mjs — 保守流策略
 *
 * 风格：学校 + 独立 + 简装 + 不开外卖 + 1 兼职 + 1 全职
 * 目标：低成本生存，避免高风险决策
 */

export const conservativeStrategy = {
  name: 'conservative',
  setup: {
    brandId: 'independent',
    locationId: 'school',
    addressId: 'school_canteen',
    decorationId: 'simple',
    products: ['milktea', 'fruittea'],
    staffTypes: ['parttime', 'fulltime'],
  },
  /** 每周决策（在 next_week 之前调用） */
  async weeklyAction(cli, state) {
    // 第 3 周开通最便宜的曝光活动
    if (state.week === 3 && !state.activeMarketing.some((a) => a.id === 'social_media')) {
      await cli.action({ type: 'start_marketing', activityId: 'social_media' }).catch(() => {});
    }
    // 现金告急：裁兼职
    if (state.cash < 50000 && state.staff.length > 1) {
      const pt = state.staff.find((s) => s.typeId === 'parttime');
      if (pt) await cli.action({ type: 'fire_staff', staffId: pt.id }).catch(() => {});
    }
  },
  /** 事件选项决策 */
  pickEventOption(opts) {
    return opts
      .map((o) => {
        const eff = o.effects || {};
        return { o, score: (eff.cash || 0) + (eff.cognitionExp || 0) * 50 + (eff.reputation || 0) * 100 };
      })
      .sort((a, b) => b.score - a.score)[0]?.o;
  },
};
