/**
 * aggressive.mjs — 激进流策略
 *
 * 风格：写字楼 + 加盟 + 高装 + 全外卖 + 多个全职 + 高密度营销
 */

export const aggressiveStrategy = {
  name: 'aggressive',
  setup: {
    // 独立品牌避开高额加盟费 + 现代装修 + 写字楼
    brandId: 'independent',
    locationId: 'office',
    addressId: 'office_lobby',
    decorationId: 'modern',
    products: ['milktea', 'coffee', 'fruittea'],
    staffTypes: ['fulltime', 'parttime'],
  },
  async weeklyAction(cli, state) {
    if (state.week === 2 && !state.activeMarketing.some((a) => a.id === 'social_media')) {
      await cli.action({ type: 'start_marketing', activityId: 'social_media' }).catch(() => {});
    }
    // 现金还充裕时再加营销
    if (state.week === 5 && state.cash > 100000 && !state.activeMarketing.some((a) => a.id === 'grand_opening')) {
      await cli.action({ type: 'start_marketing', activityId: 'grand_opening' }).catch(() => {});
    }
    // 第 6 周加入饿了么（仅在现金 > 80k）
    if (state.week === 6 && state.delivery.platforms.length === 0 && state.cash > 80000) {
      await cli.action({ type: 'join_platform', platformId: 'eleme' }).catch(() => {});
    }
    // 现金告急自救：裁兼职
    if (state.cash < 30000 && state.staff.length > 1) {
      const pt = state.staff.find((s) => s.typeId === 'parttime');
      if (pt) await cli.action({ type: 'fire_staff', staffId: pt.id }).catch(() => {});
    }
  },
  pickEventOption(opts) {
    return opts
      .map((o) => {
        const eff = o.effects || {};
        // 现金影响仍占主导，激进只是更看重 exposure
        return { o, score: (eff.cash || 0) + (eff.exposure || 0) * 150 + (eff.cognitionExp || 0) * 50 };
      })
      .sort((a, b) => b.score - a.score)[0]?.o;
  },
};
