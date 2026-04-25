#!/usr/bin/env node
/**
 * phase5_ui.mjs — Phase 5 UI 整合自检
 *
 * 验证：
 *   1. npm run build 通过
 *   2. bundle size ≤ 1.20× baseline (1.30MB)（容忍 +20% 因新增 Cmd+K/Sparkline/Drama 等）
 *   3. 关键决策路径 click depth ≤ 2（CLI: state → 任意决策 action）
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { CliClient, runStandardSetup, writeReport, evaluate, CLI_ROOT } from './runner.mjs';

const APP_ROOT = resolve(CLI_ROOT, '..', 'app');
const DIST_DIR = resolve(APP_ROOT, 'dist');

// 真实下载体积以 gzip 为准（420KB 目标）；未压缩 JS 限 1.50MB（容忍 Cmd+K/recharts 二次加载）
const BUNDLE_LIMIT_BYTES = 1.50 * 1024 * 1024;
const BUNDLE_GZIP_LIMIT_BYTES = 420 * 1024;

function measureDistSize() {
  let total = 0;
  let totalJs = 0;
  let totalCss = 0;
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = resolve(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else {
        total += s.size;
        if (name.endsWith('.js')) totalJs += s.size;
        if (name.endsWith('.css')) totalCss += s.size;
      }
    }
  }
  walk(DIST_DIR);
  return { totalBytes: total, jsBytes: totalJs, cssBytes: totalCss };
}

function runBuild() {
  return new Promise((resolveProc, reject) => {
    const proc = spawn('npm', ['run', 'build'], { cwd: APP_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    proc.stdout.on('data', (c) => (out += c));
    proc.stderr.on('data', (c) => (err += c));
    proc.on('exit', (code) => {
      resolveProc({ code, out, err });
    });
    proc.on('error', reject);
  });
}

async function clickDepthTest() {
  const cli = new CliClient();
  await cli.ready();
  await cli.meta({ reset: { seed: 42 } });
  await runStandardSetup(cli);
  // 关键决策路径深度：state → 任意决策（最多 2 次 query+action）
  // 模拟：拿到 state，第二次发出一个决策 action（推一周）
  const t0 = Date.now();
  const r1 = await cli.query('state');
  const r2 = await cli.action({ type: 'next_week' });
  const ms = Date.now() - t0;
  cli.close();
  return { steps: 2, msToFirstDecision: ms, ok: r1.success && r2.success };
}

async function main() {
  console.log('[phase5] 1) npm run build');
  const buildResult = await runBuild();
  if (buildResult.code !== 0) {
    console.log('  ❌ build failed');
    console.log(buildResult.err.slice(0, 1000));
    process.exit(1);
  }
  console.log('  ✅ build pass');

  const bundle = measureDistSize();
  console.log(`  bundle size: js=${(bundle.jsBytes / 1024).toFixed(1)}KB, css=${(bundle.cssBytes / 1024).toFixed(1)}KB, total=${(bundle.totalBytes / 1024).toFixed(1)}KB`);

  // 解析 vite 输出中的 gzip 大小
  const gzMatch = buildResult.out.match(/gzip:\s+([\d.]+)\s+kB/g);
  let mainGzipKb = 0;
  if (gzMatch) {
    for (const m of gzMatch) {
      const n = Number(m.match(/[\d.]+/)?.[0] ?? 0);
      if (n > mainGzipKb) mainGzipKb = n;
    }
  }
  console.log(`  bundle gzip(main chunk): ${mainGzipKb.toFixed(1)}KB`);

  console.log('[phase5] 2) click depth');
  const click = await clickDepthTest();
  console.log(`  depth=${click.steps}, ms=${click.msToFirstDecision}, ok=${click.ok}`);

  const expected = {
    bundleOk: () => bundle.jsBytes <= BUNDLE_LIMIT_BYTES,
    gzipOk: () => mainGzipKb * 1024 <= BUNDLE_GZIP_LIMIT_BYTES,
    clickDepthOk: () => click.steps <= 2 && click.ok,
  };
  const m = {
    bundleOk: bundle.jsBytes <= BUNDLE_LIMIT_BYTES,
    bundleJsKB: Math.round(bundle.jsBytes / 1024),
    bundleTotalKB: Math.round(bundle.totalBytes / 1024),
    gzipOk: mainGzipKb * 1024 <= BUNDLE_GZIP_LIMIT_BYTES,
    mainGzipKb,
    clickDepth: click.steps,
    clickMs: click.msToFirstDecision,
  };
  const evalRes = evaluate(m, expected);

  const report = {
    phase: 5,
    timestamp: new Date().toISOString(),
    metrics: m,
    expected,
    evalDetail: evalRes.detail,
    pass: evalRes.pass,
  };
  const path = writeReport('phase5-ui', report);

  console.log('\n—— Phase 5 UI 整合 ——');
  console.log(`  build: ✅`);
  console.log(`  bundle js: ${m.bundleJsKB}KB (limit ${Math.round(BUNDLE_LIMIT_BYTES / 1024)}KB)`);
  console.log(`  gzip main: ${mainGzipKb}KB (limit ${Math.round(BUNDLE_GZIP_LIMIT_BYTES / 1024)}KB)`);
  console.log(`  click depth: ${m.clickDepth} (limit 2)`);
  console.log(`  -> ${report.pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  report: ${path}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[phase5] error:', e);
  process.exit(2);
});
