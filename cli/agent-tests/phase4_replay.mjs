#!/usr/bin/env node
/**
 * phase4_replay.mjs — Phase 4 成就与重玩自检
 *
 * 验证：
 *   1. 同 seed 玩两次 → 完全一致
 *   2. 至少 10+ 成就在第 1 局可解锁
 *   3. 6 个剧本可正常启动并跑完
 *   4. CLI 启动参数 --seed/--scenario 生效
 */

import { spawn } from 'node:child_process';
import {
  CliClient,
  runStandardSetup,
  Metrics,
  writeReport,
  evaluate,
  CLI_ROOT,
} from './runner.mjs';

const SEED = 1234;

async function playOnce(seed) {
  const cli = new CliClient();
  await cli.ready();
  await cli.meta({ reset: { seed } });
  await runStandardSetup(cli);
  const metrics = new Metrics();
  let st = (await cli.query('state'))?.data;
  let safety = 200;
  while (st.phase === 'operating' && safety-- > 0) {
    if (st.pendingInteractiveEvent) {
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
      continue;
    }
    if (st.weeklySummary) await cli.action({ type: 'clear_weekly_summary' });
    if (st.lastWeekEvent) await cli.action({ type: 'clear_last_week_event' });
    const r = await cli.action({ type: 'next_week' });
    metrics.observeAction();
    if (!r.success) break;
    st = r.data;
  }
  const ach = await cli.query('achievements');
  cli.close();
  return { st, achievements: ach.data?.unlocked ?? [], metrics: metrics.finalize() };
}

async function playWithCliArgs(seed, scenarioId) {
  return new Promise((resolve, reject) => {
    const args = ['tsx', 'src/main.ts'];
    if (seed !== undefined) args.push(`--seed=${seed}`);
    if (scenarioId) args.push(`--scenario=${scenarioId}`);
    const proc = spawn('npx', args, { cwd: CLI_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    let resolved = false;
    let response = null;
    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; proc.kill(); reject(new Error('timeout')); }
    }, 8000);
    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const idx = buf.indexOf('\n');
      if (idx >= 0 && !resolved) {
        const line = buf.slice(0, idx);
        try {
          response = JSON.parse(line);
        } catch {}
        clearTimeout(timer);
        resolved = true;
        proc.kill();
        resolve(response);
      }
    });
    proc.stderr.on('data', () => {});
    proc.on('error', reject);
    // 发送一个 query 来确认启动正常
    proc.stdin.write(JSON.stringify({ id: '1', type: 'query', query: 'state' }) + '\n');
  });
}

async function runScenario(scenarioId) {
  const cli = new CliClient();
  await cli.ready();
  // 用剧本 reset
  const resetResp = await cli.meta({ reset: { seed: 42, scenarioId } });
  if (!resetResp.success) {
    cli.close();
    return { ok: false, scenarioId, error: 'reset failed' };
  }
  // setup 阶段：剧本只覆盖 cash，仍需常规 setup
  await runStandardSetup(cli, {
    brandId: 'independent',
    locationId: 'school',
    addressId: 'school_canteen',
    decorationId: 'simple',
    products: ['milktea'],
    staffTypes: ['parttime'],
  }).catch((e) => ({ ok: false, error: String(e) }));

  const adv = await cli.autoAdvance(40);
  cli.close();
  return {
    ok: !!adv.success,
    scenarioId,
    advanced: adv.data?.advanced,
    finalPhase: adv.data?.state?.phase,
    finalCash: adv.data?.state?.cash,
  };
}

async function main() {
  console.log('[phase4] 1) 同 seed 复现');
  const a = await playOnce(SEED);
  const b = await playOnce(SEED);
  const reproducible = a.st.cash === b.st.cash && a.st.cumulativeProfit === b.st.cumulativeProfit && a.st.week === b.st.week;
  console.log(`  reproducible: ${reproducible ? '✅' : '❌'} (a.cash=${a.st.cash} b.cash=${b.st.cash})`);

  console.log('[phase4] 2) 第一局成就解锁');
  const unlocked = a.achievements;
  console.log(`  unlocked: ${unlocked.length} (${unlocked.slice(0, 6).join(', ')}${unlocked.length > 6 ? '...' : ''})`);

  console.log('[phase4] 3) CLI 启动参数 --seed=42');
  const cliArgsResp = await playWithCliArgs(42, undefined).catch((e) => ({ error: String(e) }));
  const cliArgsOk = cliArgsResp?.success && cliArgsResp?.data?.week === 0;
  console.log(`  --seed: ${cliArgsOk ? '✅' : '❌'}`);

  console.log('[phase4] 4) CLI 启动参数 --scenario=scen_zhinanguozhi');
  const scenArgsResp = await playWithCliArgs(undefined, 'scen_zhinanguozhi').catch((e) => ({ error: String(e) }));
  const scenArgsOk = scenArgsResp?.success && scenArgsResp?.data?.cash === 30000;
  console.log(`  --scenario: ${scenArgsOk ? '✅' : '❌'} (cash=${scenArgsResp?.data?.cash})`);

  console.log('[phase4] 5) 6 个剧本可启动');
  const scenarioIds = [
    'scen_zhinanguozhi',
    'scen_baiwanshenglou',
    'scen_zhongyao',
    'scen_shanlu',
    'scen_kuaizhao',
    'scen_aixiage',
  ];
  const scenarioResults = [];
  for (const sid of scenarioIds) {
    const r = await runScenario(sid);
    scenarioResults.push(r);
    console.log(`  ${sid}: ${r.ok ? '✅' : '❌'} (advanced=${r.advanced}, phase=${r.finalPhase})`);
  }
  const allScenariosOk = scenarioResults.every((r) => r.ok);

  const expected = {
    reproducible: () => reproducible,
    unlockedCount: '>=10',
    cliArgsOk: () => cliArgsOk,
    scenArgsOk: () => scenArgsOk,
    allScenariosOk: () => allScenariosOk,
  };
  const m = {
    reproducible,
    unlockedCount: unlocked.length,
    cliArgsOk,
    scenArgsOk,
    allScenariosOk,
    scenarioResults,
  };
  const evalRes = evaluate(m, expected);

  const report = {
    phase: 4,
    timestamp: new Date().toISOString(),
    seed: SEED,
    metrics: m,
    expected,
    evalDetail: evalRes.detail,
    pass: evalRes.pass,
  };
  const path = writeReport('phase4-replay', report);

  console.log('\n—— Phase 4 成就与重玩 ——');
  console.log(`  reproducible: ${reproducible ? '✅' : '❌'}`);
  console.log(`  achievementsUnlocked: ${unlocked.length} (target>=10)`);
  console.log(`  cli --seed: ${cliArgsOk ? '✅' : '❌'}`);
  console.log(`  cli --scenario: ${scenArgsOk ? '✅' : '❌'}`);
  console.log(`  6 scenarios runnable: ${allScenariosOk ? '✅' : '❌'}`);
  console.log(`  -> ${report.pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  report: ${path}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[phase4] error:', e);
  process.exit(2);
});
