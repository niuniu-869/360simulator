/**
 * balanced.mjs — 均衡流策略
 *
 * 风格：社区 + 独立 + 简装 + 适中外卖 + 适中员工
 */

export const balancedStrategy = {
  name: 'balanced',
  setup: {
    brandId: 'independent',
    locationId: 'community',
    addressId: 'community_main',
    decorationId: 'simple',
    products: ['milktea', 'fruittea', 'fries'],
    staffTypes: ['fulltime', 'parttime'],
  },
  async weeklyAction(cli, state) {
    if (state.week === 3 && !state.activeMarketing.some((a) => a.id === 'social_media')) {
      await cli.action({ type: 'start_marketing', activityId: 'social_media' }).catch(() => {});
    }
    if (state.week === 6 && state.delivery.platforms.length === 0 && state.cash > 80000) {
      await cli.action({ type: 'join_platform', platformId: 'meituan' }).catch(() => {});
    }
  },
  pickEventOption(opts) {
    return opts
      .map((o) => {
        const eff = o.effects || {};
        return {
          o,
          score: (eff.cash || 0) + (eff.cognitionExp || 0) * 50 + (eff.reputation || 0) * 80 + (eff.exposure || 0) * 100,
        };
      })
      .sort((a, b) => b.score - a.score)[0]?.o;
  },
};
