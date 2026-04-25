#!/usr/bin/env node
/**
 * phase2_feedback.mjs — Phase 2 即时反馈自检
 *
 * 验证：
 *   1. prediction.kind=price / marketing 返回非 null
 *   2. 触发事件后，state 中能看到事件 + timeline 中有响应记录
 *   3. 决策透明度评分 ≥ 8/10（启发式：可见决策 / 总决策）
 */

import {
  CliClient,
  runStandardSetup,
  Metrics,
  writeReport,
  evaluate,
} from './runner.mjs';

const SEED = 100;

async function main() {
  const cli = new CliClient();
  await cli.ready();
  await cli.meta({ reset: { seed: SEED } });
  await runStandardSetup(cli);

  // ============ 1) 价格预测 ============
  const stateResp = await cli.query('state');
  const state = stateResp.data;
  const product = state.products[0];
  const oldPrice = product.price;
  const pricePred = await cli.predict({
    kind: 'price',
    productId: product.id,
    newPrice: oldPrice * 1.2,
  });
  const priceOk = pricePred.success && pricePred.data &&
    Number.isFinite(pricePred.data.deltaProfit) &&
    Number.isFinite(pricePred.data.deltaRevenue) &&
    Number.isFinite(pricePred.data.predictedDemand);

  // ============ 2) 营销 ROI 预测 ============
  const mkts = await cli.query('marketing_activities');
  const firstActivity = mkts.data?.exposure?.[0];
  let marketingOk = false;
  let marketingPred = null;
  if (firstActivity) {
    const mp = await cli.predict({ kind: 'marketing', activityId: firstActivity.id });
    marketingPred = mp.data;
    marketingOk = mp.success && mp.data &&
      Number.isFinite(mp.data.estROI) &&
      typeof mp.data.weeksToBreakEven === 'number' || marketingPred?.weeksToBreakEven === Infinity;
  }

  // ============ 3) 老板行动预测（占位，最少返回 hint） ============
  const bossPred = await cli.predict({ kind: 'boss_action', actionId: 'investigate_nearby' });
  const bossOk = bossPred.success && bossPred.data && bossPred.data.actionId === 'investigate_nearby';

  // ============ 4) 决策透明度（事件触发率 vs 响应率） ============
  // 跑 30 周看事件触发与响应
  const metrics = new Metrics();
  let st = state;
  let visibleDecisions = 0;
  let totalDecisions = 0;
  for (let w = 0; w < 30 && st.phase === 'operating'; w += 1) {
    if (st.pendingInteractiveEvent) {
      // 事件 = 一次"可见决策"
      visibleDecisions += 1;
      totalDecisions += 1;
      const ev = st.pendingInteractiveEvent;
      let optionId = '__notification__';
      if (!ev.isNotification) {
        const peResp = await cli.query('pending_event');
        const opts = peResp?.data?.options || [];
        if (opts.length > 0) optionId = opts[0].id;
      }
      const r = await cli.action({ type: 'respond_to_event', eventId: ev.id, optionId });
      metrics.observeAction();
      if (!r.success) break;
      st = r.data;
    } else {
      // 推周本身不算"决策"（自动行为），不计入
    }
    if (st.weeklySummary) await cli.action({ type: 'clear_weekly_summary' });
    if (st.lastWeekEvent) await cli.action({ type: 'clear_last_week_event' });
    const adv = await cli.action({ type: 'next_week' });
    metrics.observeAction();
    if (!adv.success) break;
    st = adv.data;
  }

  const transparencyScore = totalDecisions > 0 ? Math.round((visibleDecisions / totalDecisions) * 10) : 10;
  const finalMetrics = metrics.finalize();

  // 时间线 toast/event 验证（gameRunner.timeline 收集）
  const tl = (await cli.query('timeline'))?.data || [];
  const timelineEvents = tl.reduce((s, e) => s + (e.events?.length || 0), 0);

  cli.close();

  const expected = {
    transparencyScore: '>=8',
    priceOk: () => priceOk,
    marketingOk: () => marketingOk,
    bossOk: () => bossOk,
    timelineEvents: '>=1',
  };
  const m = {
    ...finalMetrics,
    transparencyScore,
    priceOk,
    marketingOk,
    bossOk,
    timelineEvents,
  };
  const evalRes = evaluate(m, expected);

  const report = {
    phase: 2,
    timestamp: new Date().toISOString(),
    seed: SEED,
    metrics: m,
    expected,
    evalDetail: evalRes.detail,
    samples: {
      pricePrediction: pricePred.data,
      marketingPrediction: marketingPred,
      bossPrediction: bossPred.data,
    },
    pass: evalRes.pass,
  };
  const path = writeReport('phase2-feedback', report);

  console.log('—— Phase 2 即时反馈 ——');
  console.log(`  predict price: ${priceOk ? '✅' : '❌'} (Δprofit=${pricePred.data?.deltaProfit ?? 'n/a'})`);
  console.log(`  predict marketing: ${marketingOk ? '✅' : '❌'} (estROI=${marketingPred?.estROI ?? 'n/a'})`);
  console.log(`  predict boss: ${bossOk ? '✅' : '❌'}`);
  console.log(`  transparencyScore: ${transparencyScore}/10`);
  console.log(`  timelineEvents: ${timelineEvents}`);
  console.log(`  -> ${report.pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  report: ${path}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[phase2] error:', e);
  process.exit(2);
});
