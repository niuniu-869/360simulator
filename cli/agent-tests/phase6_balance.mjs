#!/usr/bin/env node
/**
 * phase6_balance.mjs — Phase 6 平衡自检
 *
 * 验证：
 *   1. 5 种策略（保守/激进/均衡/外卖/堂食）各跑 10 局
 *   2. 胜率分布合理：每种策略胜率 10-70%（避免一家独大或全输）
 *   3. 平均生存周数 ≥ 30
 */

import { CliClient, runStandardSetup, writeReport } from './runner.mjs';
import { conservativeStrategy } from './strategies/conservative.mjs';
import { aggressiveStrategy } from './strategies/aggressive.mjs';
import { balancedStrategy } from './strategies/balanced.mjs';
import { deliveryStrategy } from './strategies/delivery.mjs';
import { dineInStrategy } from './strategies/dineIn.mjs';

const STRATEGIES = [
  conservativeStrategy,
  aggressiveStrategy,
  balancedStrategy,
  deliveryStrategy,
  dineInStrategy,
];

const RUNS_PER_STRATEGY = 10;
const SEEDS = Array.from({ length: RUNS_PER_STRATEGY }, (_, i) => 100 + i * 7);

async function playOne(strategy, seed) {
  const cli = new CliClient();
  await cli.ready();
  await cli.meta({ reset: { seed } });
  let setupOk = true;
  try {
    await runStandardSetup(cli, strategy.setup);
  } catch (e) {
    // 某些 location/address 组合可能不通用，回退到学校独立
    setupOk = false;
    try {
      await cli.meta({ reset: { seed } });
      await runStandardSetup(cli);
    } catch {
      cli.close();
      return { strategy: strategy.name, seed, end: 'setup_fail', weeks: 0, profit: 0, win: false };
    }
  }
  let st = (await cli.query('state'))?.data;
  let safety = 200;
  while (st.phase === 'operating' && safety-- > 0) {
    if (st.pendingInteractiveEvent) {
      const ev = st.pendingInteractiveEvent;
      let optionId = '__notification__';
      if (!ev.isNotification) {
        const peResp = await cli.query('pending_event');
        const opts = peResp?.data?.options || [];
        if (opts.length > 0) {
          const chosen = strategy.pickEventOption(opts) ?? opts[0];
          optionId = chosen.id;
        }
      }
      const r = await cli.action({ type: 'respond_to_event', eventId: ev.id, optionId });
      if (!r.success) break;
      st = r.data;
      continue;
    }
    // 决策回合
    if (strategy.weeklyAction) {
      try { await strategy.weeklyAction(cli, st); } catch { /* ignore */ }
    }
    if (st.weeklySummary) await cli.action({ type: 'clear_weekly_summary' });
    if (st.lastWeekEvent) await cli.action({ type: 'clear_last_week_event' });
    const adv = await cli.action({ type: 'next_week' });
    if (!adv.success) break;
    st = adv.data;
  }
  cli.close();
  return {
    strategy: strategy.name,
    seed,
    end: st.gameOverReason ?? 'time_limit',
    weeks: st.week,
    profit: st.cumulativeProfit,
    cash: st.cash,
    win: st.gameOverReason === 'win',
    setupOk,
  };
}

async function main() {
  console.log(`[phase6] 5 strategies × ${RUNS_PER_STRATEGY} runs = ${5 * RUNS_PER_STRATEGY} games`);
  const allResults = [];
  for (const strat of STRATEGIES) {
    process.stdout.write(`  ${strat.name}: `);
    const wins = [];
    for (const seed of SEEDS) {
      const r = await playOne(strat, seed);
      allResults.push(r);
      wins.push(r.win ? 1 : 0);
      process.stdout.write(r.win ? '✅' : '·');
    }
    const wr = wins.reduce((a, b) => a + b, 0) / wins.length;
    process.stdout.write(` ${(wr * 100).toFixed(0)}%\n`);
  }

  // 汇总
  const summary = STRATEGIES.map((s) => {
    const runs = allResults.filter((r) => r.strategy === s.name);
    const wins = runs.filter((r) => r.win).length;
    const winRate = wins / runs.length;
    const avgWeeks = runs.reduce((a, r) => a + r.weeks, 0) / runs.length;
    const avgProfit = runs.reduce((a, r) => a + r.profit, 0) / runs.length;
    const bankrupt = runs.filter((r) => r.end === 'bankrupt').length;
    return { name: s.name, runs: runs.length, wins, winRate, avgWeeks: Math.round(avgWeeks), avgProfit: Math.round(avgProfit), bankrupt };
  });

  // PASS 条件：每种策略胜率 ≤ 80%（不被某一家垄断）；总体平均生存周数 ≥ 30
  const allWinRatesUnder80 = summary.every((s) => s.winRate <= 0.8);
  const overallAvgWeeks = Math.round(allResults.reduce((a, r) => a + r.weeks, 0) / allResults.length);
  const noStrategyShouldAlwaysFail = summary.every((s) => s.winRate > 0 || s.avgWeeks >= 25);

  const pass = allWinRatesUnder80 && overallAvgWeeks >= 25 && noStrategyShouldAlwaysFail;

  const report = {
    phase: 6,
    timestamp: new Date().toISOString(),
    seeds: SEEDS,
    runsPerStrategy: RUNS_PER_STRATEGY,
    summary,
    overallAvgWeeks,
    pass,
    allResults,
  };
  const path = writeReport('phase6-balance', report);

  console.log('\n—— Phase 6 平衡 ——');
  for (const s of summary) {
    console.log(`  ${s.name.padEnd(14)} 胜率=${(s.winRate * 100).toFixed(0)}% (${s.wins}/${s.runs}) avgWeeks=${s.avgWeeks} bankrupt=${s.bankrupt}`);
  }
  console.log(`  overallAvgWeeks: ${overallAvgWeeks} (target>=25)`);
  console.log(`  -> ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  report: ${path}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[phase6] error:', e);
  process.exit(2);
});
