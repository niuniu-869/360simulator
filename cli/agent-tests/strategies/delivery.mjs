/**
 * delivery.mjs — 外卖流策略
 *
 * 全外卖：商务区 + 简装 + 全员后厨 + 同时上美团饿了么
 */

export const deliveryStrategy = {
  name: 'delivery',
  setup: {
    brandId: 'independent',
    locationId: 'office',
    addressId: 'office_lobby',
    decorationId: 'simple',
    products: ['ricebox', 'noodles', 'milktea'],
    staffTypes: ['fulltime', 'fulltime'],
  },
  async weeklyAction(cli, state) {
    if (state.week === 2 && state.delivery.platforms.length === 0) {
      await cli.action({ type: 'join_platform', platformId: 'meituan' }).catch(() => {});
    }
    if (state.week === 3 && state.delivery.platforms.length === 1) {
      await cli.action({ type: 'join_platform', platformId: 'eleme' }).catch(() => {});
    }
    if (state.week === 4 && !state.activeMarketing.some((a) => a.id === 'social_media')) {
      await cli.action({ type: 'start_marketing', activityId: 'social_media' }).catch(() => {});
    }
  },
  pickEventOption(opts) {
    return opts
      .map((o) => {
        const eff = o.effects || {};
        return { o, score: (eff.exposure || 0) * 150 + (eff.cash || 0) * 0.8 };
      })
      .sort((a, b) => b.score - a.score)[0]?.o;
  },
};
