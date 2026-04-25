#!/usr/bin/env node
/**
 * phase1_pace.mjs — Phase 1 节奏革命自检
 *
 * 验证：
 *   1. CLI auto_advance 可用，跑 52 周
 *   2. 弹窗连续可秒点（同步连发 next_week + clear_weekly_summary）
 *   3. 改善率（vs Phase 0 baseline）
 */

import {
  CliClient,
  runStandardSetup,
  Metrics,
  writeReport,
  evaluate,
} from './runner.mjs';

const SEED = 42;
const TARGET_WEEKS = 52;

async function autoAdvanceLoop(cli, metrics, maxWeeks = TARGET_WEEKS) {
  const t0 = Date.now();
  let totalAdvanced = 0;
  let safety = 200;
  while (totalAdvanced < maxWeeks && safety-- > 0) {
    let r = await cli.autoAdvance(maxWeeks - totalAdvanced);
    metrics.observeAction();
    if (!r.success) {
      console.error('[phase1] auto_advance fail:', r.error);
      break;
    }
    totalAdvanced += r.data.advanced;
    metrics.observeWeek(r.data.state.week);
    metrics.observeEnd(r.data.state);
    if (r.data.state.phase === 'ended') break;
    if (r.data.stoppedReason === 'pending_event') {
      // 响应事件
      const ev = r.data.state.pendingInteractiveEvent;
      let optionId = '__notification__';
      if (!ev.isNotification) {
        const peResp = await cli.query('pending_event');
        const opts = peResp?.data?.options || [];
        if (opts.length === 0) break;
        const ranked = opts
          .map((o) => ({ o, score: (o.effects?.cash || 0) + (o.effects?.cognitionExp || 0) * 50 }))
          .sort((a, b) => b.score - a.score);
        optionId = ranked[0].o.id;
      }
      const rr = await cli.action({ type: 'respond_to_event', eventId: ev.id, optionId });
      metrics.observeAction();
      metrics.observeEventResponse();
      metrics.observeEventTrigger();
      if (!rr.success) break;
    }
  }
  const wallMs = Date.now() - t0;
  return { totalAdvanced, wallMs };
}

async function popupChainTest(cli) {
  // 用一个新会话验证弹窗连续秒点
  // 设置场景 → 推 5 周 → 测每次响应 ms
  const samples = [];
  for (let i = 0; i < 5; i += 1) {
    const t0 = Date.now();
    const r1 = await cli.action({ type: 'next_week' });
    if (r1.success && r1.data.weeklySummary) {
      const r2 = await cli.action({ type: 'clear_weekly_summary' });
      void r2;
    }
    if (r1.success && r1.data.lastWeekEvent) {
      await cli.action({ type: 'clear_last_week_event' });
    }
    samples.push(Date.now() - t0);
    if (r1.data?.pendingInteractiveEvent) break;
    if (r1.data?.phase === 'ended') break;
  }
  return samples;
}

async function main() {
  console.log(`[phase1] seed=${SEED}, 目标 ${TARGET_WEEKS} 周`);

  // 1) auto_advance 连贯播放
  const cli1 = new CliClient();
  await cli1.ready();
  await cli1.meta({ reset: { seed: SEED } });
  await runStandardSetup(cli1);
  const metrics = new Metrics();
  const { totalAdvanced, wallMs } = await autoAdvanceLoop(cli1, metrics, TARGET_WEEKS);
  metrics.t0 = Date.now() - wallMs; // 矫正 wallclock，只算 auto_advance 段
  const final = (await cli1.query('state'))?.data;
  const tl = (await cli1.query('timeline'))?.data || [];
  metrics.observeDrama(tl);

  // 2) 弹窗链路连点
  const cli2 = new CliClient();
  await cli2.ready();
  await cli2.meta({ reset: { seed: SEED + 1 } });
  await runStandardSetup(cli2);
  const popupSamples = await popupChainTest(cli2);
  cli2.close();
  cli1.close();

  const final2 = metrics.finalize();
  // 计算节奏指标
  const weeksPerSec = totalAdvanced > 0 ? totalAdvanced / (wallMs / 1000) : 0;
  const clicksPerWeek = totalAdvanced > 0 ? final2.actionsCount / totalAdvanced : 0;
  const popupChainMaxMs = Math.max(...(popupSamples.length ? popupSamples : [0]));

  const expected = {
    weeksPerSec: '>=2.0',
    clicksPerWeek: '<=1.5',
    popupChainMaxMs: '<=200',
  };
  const m = {
    ...final2,
    weeksPerSec: Math.round(weeksPerSec * 100) / 100,
    clicksPerWeek: Math.round(clicksPerWeek * 100) / 100,
    popupChainMaxMs,
    popupSamples,
    advancedWeeks: totalAdvanced,
    autoAdvanceWallMs: wallMs,
    finalWeek: final?.week,
    finalCash: final?.cash,
    finalCumulativeProfit: final?.cumulativeProfit,
  };
  const evalRes = evaluate(m, expected);

  // baseline 改善率（vs Phase 0：clicksPerWeek 2.35）
  const BASELINE_CLICKS = 2.35;
  const BASELINE_WEEKS_PER_SEC = 301; // baseline 跑得很快（CLI overhead 主导）
  const improvement = {
    clicks_pct: Math.round(((BASELINE_CLICKS - clicksPerWeek) / BASELINE_CLICKS) * 100),
  };

  const report = {
    phase: 1,
    timestamp: new Date().toISOString(),
    seed: SEED,
    targetWeeks: TARGET_WEEKS,
    metrics: m,
    expected,
    evalDetail: evalRes.detail,
    improvement,
    pass: evalRes.pass,
    duration_ms: wallMs,
  };
  const path = writeReport('phase1-pace', report);

  console.log('—— Phase 1 节奏 ——');
  console.log(`  advancedWeeks: ${totalAdvanced}`);
  console.log(`  autoAdvanceWallMs: ${wallMs}`);
  console.log(`  weeksPerSec: ${m.weeksPerSec} (target >=2.0)`);
  console.log(`  clicksPerWeek: ${m.clicksPerWeek} (target <=1.5; baseline=${BASELINE_CLICKS})`);
  console.log(`  popupChainMaxMs: ${popupChainMaxMs} (target <=200)`);
  console.log(`  popupSamples: ${popupSamples.join(', ')}`);
  console.log(`  -> ${report.pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  report: ${path}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[phase1] error:', e);
  process.exit(2);
});
