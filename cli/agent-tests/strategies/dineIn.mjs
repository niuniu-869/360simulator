/**
 * dineIn.mjs — 堂食流策略
 *
 * 学校 + 独立 + 舒适装 + 不开外卖 + 适中员工
 */

export const dineInStrategy = {
  name: 'dine_in',
  setup: {
    brandId: 'independent',
    locationId: 'school',
    addressId: 'school_canteen',
    decorationId: 'cozy',
    products: ['milktea', 'fruittea', 'fries', 'dessert'],
    staffTypes: ['fulltime', 'parttime'],
  },
  async weeklyAction(cli, state) {
    if (state.week === 3 && !state.activeMarketing.some((a) => a.id === 'social_media')) {
      await cli.action({ type: 'start_marketing', activityId: 'social_media' }).catch(() => {});
    }
  },
  pickEventOption(opts) {
    return opts
      .map((o) => {
        const eff = o.effects || {};
        return { o, score: (eff.reputation || 0) * 200 + (eff.cleanliness || 0) * 100 + (eff.cash || 0) };
      })
      .sort((a, b) => b.score - a.score)[0]?.o;
  },
};
