#!/usr/bin/env node
/**
 * baseline.mjs — Phase 0 基线
 *
 * 用最朴素的"无脑推周"策略玩满 60 周，收集所有指标。
 * 同 seed 跑两次确保确定性。
 */

import {
  CliClient,
  runStandardSetup,
  runOperatingLoop,
  baselineStrategy,
  Metrics,
  writeReport,
  evaluate,
} from './runner.mjs';

const SEED = 42;

async function playOnce(seed, label) {
  const cli = new CliClient();
  await cli.ready();
  // reset with seed
  await cli.meta({ reset: { seed } });
  await runStandardSetup(cli);
  const metrics = new Metrics();
  const result = await runOperatingLoop(cli, {
    strategy: baselineStrategy,
    maxWeeks: 60,
    metrics,
  });
  const finalState = result.state;
  cli.close();
  return { label, finalState, ...result };
}

async function main() {
  console.log(`[baseline] seed=${SEED}, run #1`);
  const a = await playOnce(SEED, 'run-1');
  console.log(`[baseline] seed=${SEED}, run #2 (确定性验证)`);
  const b = await playOnce(SEED, 'run-2');

  const sameCash = a.finalState.cash === b.finalState.cash;
  const sameProfit = a.finalState.cumulativeProfit === b.finalState.cumulativeProfit;
  const sameWeek = a.finalState.week === b.finalState.week;
  const sameTimelineLen = a.timeline.length === b.timeline.length;
  const reproducible = sameCash && sameProfit && sameWeek && sameTimelineLen;

  const expected = {
    weeksCompleted: '>=10', // baseline 至少要走 10 周
  };
  const evalResult = evaluate(a.metrics, expected);

  const report = {
    phase: 0,
    timestamp: new Date().toISOString(),
    seed: SEED,
    metrics: a.metrics,
    deterministic: {
      reproducible,
      cash: { run1: a.finalState.cash, run2: b.finalState.cash, equal: sameCash },
      cumulativeProfit: {
        run1: a.finalState.cumulativeProfit,
        run2: b.finalState.cumulativeProfit,
        equal: sameProfit,
      },
      week: { run1: a.finalState.week, run2: b.finalState.week, equal: sameWeek },
      timelineLen: {
        run1: a.timeline.length,
        run2: b.timeline.length,
        equal: sameTimelineLen,
      },
    },
    timelineLength: a.timeline.length,
    timelineNonEmpty: a.timeline.length > 0,
    expected,
    evalDetail: evalResult.detail,
    pass: evalResult.pass && reproducible && a.timeline.length > 0,
    duration_ms: a.metrics.wallClockMs + b.metrics.wallClockMs,
  };

  const path = writeReport('phase0-baseline', report);
  console.log('—— Phase 0 Baseline ——');
  console.log(`  weeksCompleted: ${a.metrics.weeksCompleted}`);
  console.log(`  endReason: ${a.metrics.endReason}`);
  console.log(`  wallClockMs: ${a.metrics.wallClockMs}`);
  console.log(`  weeksPerSec: ${a.metrics.weeksPerSec}`);
  console.log(`  actionsCount: ${a.metrics.actionsCount}`);
  console.log(`  clicksPerWeek: ${a.metrics.clicksPerWeek}`);
  console.log(`  eventsTriggered: ${a.metrics.eventsTriggered}`);
  console.log(`  dramaMoments: ${a.metrics.dramaMoments}`);
  console.log(`  timelineLength: ${a.timeline.length}`);
  console.log(`  reproducible(seed=${SEED}): ${reproducible ? '✅' : '❌'}`);
  console.log(`  -> ${report.pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  report: ${path}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[baseline] error:', e);
  process.exit(2);
});
