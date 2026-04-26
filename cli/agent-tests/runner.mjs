/**
 * runner.mjs — CLI Agent 测试通用运行器
 *
 * 设计：
 *   - spawn 一个 cli/src/main.ts 进程
 *   - JSON-lines client（每行一个请求/响应）
 *   - 通用度量收集器：调用计数 / 时间戳 / 事件计数 / drama 计数
 *   - 提供 setup/operatingLoop 的"复刻 UI 玩家"高层方法
 *
 * 使用：
 *   import { CliClient, runStandardSetup, runOperatingLoop, baseStrategy } from './runner.mjs';
 *   const cli = new CliClient();
 *   await cli.ready();
 *   await runStandardSetup(cli);
 *   const summary = await runOperatingLoop(cli, { strategy: baseStrategy, maxWeeks: 60 });
 *   cli.close();
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const CLI_ROOT = resolve(__dirname, '..');
export const REPORTS_DIR = resolve(__dirname, 'reports');

// ============ Cli Client ============

export class CliClient {
  constructor(opts = {}) {
    const { silent = true } = opts;
    const distEntry = resolve(CLI_ROOT, 'dist/main.js');
    const hasBuiltCli = existsSync(distEntry);
    const command = hasBuiltCli ? process.execPath : 'npx';
    const args = hasBuiltCli ? [distEntry] : ['tsx', 'src/main.ts'];
    this.proc = spawn(command, args, {
      cwd: CLI_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.buf = '';
    this.pending = new Map();
    this.idCounter = 0;
    this.silent = silent;
    this.proc.stdout.setEncoding('utf-8');
    this.proc.stdout.on('data', (chunk) => {
      this.buf += chunk;
      let idx;
      while ((idx = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, idx).trim();
        this.buf = this.buf.slice(idx + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line);
          const r = this.pending.get(obj.id);
          if (r) {
            this.pending.delete(obj.id);
            r(obj);
          }
        } catch {
          process.stderr.write('[runner] parse error: ' + line + '\n');
        }
      }
    });
    this.proc.stderr.on('data', (d) => {
      if (!silent) process.stderr.write('[CLI-ERR] ' + d);
    });
  }

  async ready(timeoutMs = 8000) {
    // 直接发一次 help 响应来确认就绪
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const r = await Promise.race([
          this.send({ type: 'meta', meta: 'help' }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500)),
        ]);
        if (r?.success) return true;
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('CLI not ready in ' + timeoutMs + 'ms');
  }

  async send(req, perCallTimeout = 30000) {
    this.idCounter += 1;
    const id = String(this.idCounter);
    const full = { ...req, id };
    return new Promise((resolveResp, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CLI request timeout (id=${id}, type=${req.type})`));
      }, perCallTimeout);
      this.pending.set(id, (obj) => {
        clearTimeout(timer);
        resolveResp(obj);
      });
      this.proc.stdin.write(JSON.stringify(full) + '\n');
    });
  }

  async action(action) { return this.send({ type: 'action', action }); }
  async query(query) { return this.send({ type: 'query', query }); }
  async meta(meta) { return this.send({ type: 'meta', meta }); }
  async autoAdvance(weeks) { return this.send({ type: 'auto_advance', weeks }); }
  async predict(prediction) { return this.send({ type: 'prediction', prediction }); }

  close() {
    try { this.proc.stdin.end(); } catch {}
    try { this.proc.kill(); } catch {}
  }
}

// ============ 通用度量收集器 ============

export class Metrics {
  constructor() {
    this.t0 = Date.now();
    this.actionsCount = 0;
    this.eventsTriggered = 0;
    this.eventsResponded = 0;
    this.weeksCompleted = 0;
    this.bankruptWeek = null;
    this.endReason = null;
    this.dramaMoments = 0;
    this.dramaByType = { crisis: 0, highlight: 0, turning_point: 0, bankruptcy_threat: 0 };
    this.toastsTotal = 0;
    this.popupChainSamples = [];
  }

  observeAction() { this.actionsCount += 1; }
  observeEventTrigger() { this.eventsTriggered += 1; }
  observeEventResponse() { this.eventsResponded += 1; }
  observeWeek(week) { this.weeksCompleted = Math.max(this.weeksCompleted, week); }
  observeDrama(timeline) {
    for (const entry of timeline) {
      for (const d of entry.dramaMoments || []) {
        this.dramaMoments += 1;
        if (this.dramaByType[d.type] != null) this.dramaByType[d.type] += 1;
      }
    }
  }
  observeEnd(state) {
    if (state.phase === 'ended') {
      this.endReason = state.gameOverReason || 'unknown';
      if (state.gameOverReason === 'bankrupt') this.bankruptWeek = state.week;
    }
  }

  finalize() {
    const wallClockMs = Date.now() - this.t0;
    const weeksPerSec = this.weeksCompleted > 0 ? (this.weeksCompleted / (wallClockMs / 1000)) : 0;
    const clicksPerWeek = this.weeksCompleted > 0 ? this.actionsCount / this.weeksCompleted : 0;
    return {
      wallClockMs,
      weeksCompleted: this.weeksCompleted,
      bankruptWeek: this.bankruptWeek,
      endReason: this.endReason,
      actionsCount: this.actionsCount,
      eventsTriggered: this.eventsTriggered,
      eventsResponded: this.eventsResponded,
      weeksPerSec: Math.round(weeksPerSec * 100) / 100,
      clicksPerWeek: Math.round(clicksPerWeek * 100) / 100,
      dramaMoments: this.dramaMoments,
      dramaByType: this.dramaByType,
      toastsTotal: this.toastsTotal,
      popupChainSamples: this.popupChainSamples,
    };
  }
}

// ============ Phase 0: 标准 setup（学校独立 + 简装 + 学生选品） ============

export async function runStandardSetup(cli, opts = {}) {
  const {
    brandId = 'independent',
    locationId = 'school',
    addressId = 'school_canteen',
    decorationId = 'simple',
    products = ['milktea', 'fries', 'fruittea'],
    staffTypes = ['parttime', 'fulltime'],
    season = 'spring',
  } = opts;
  const trace = [];
  const step = async (label, action) => {
    const r = await cli.action(action);
    if (!r.success) throw new Error(`setup ${label} 失败: ${r.error}`);
    trace.push(label);
    return r;
  };
  await step('select_brand', { type: 'select_brand', brandId });
  await step('select_location', { type: 'select_location', locationId });
  await step('select_address', { type: 'select_address', addressId });
  await step('select_decoration', { type: 'select_decoration', decorationId });
  for (const pid of products) {
    await step(`toggle_${pid}`, { type: 'toggle_product', productId: pid });
  }
  for (const st of staffTypes) {
    await step(`add_${st}`, { type: 'add_staff', staffTypeId: st });
  }
  const finalRes = await step('open_store', { type: 'open_store', season });
  return finalRes.data;
}

// ============ Phase 0: baseline 策略（无脑推周） ============

export async function baselineStrategy(cli, state) {
  // 处理待响应事件：选第一个非破坏性选项（cash 损失最小）
  if (state.pendingInteractiveEvent) {
    const ev = state.pendingInteractiveEvent;
    if (ev.isNotification) {
      const r = await cli.action({ type: 'respond_to_event', eventId: ev.id, optionId: '__notification__' });
      return { ok: r.success, state: r.data };
    }
    const peResp = await cli.query('pending_event');
    const opts = peResp?.data?.options || [];
    if (opts.length === 0) return { ok: false, state };
    const ranked = opts
      .map((o) => {
        const eff = o.effects || {};
        const cashImpact = eff.cash || 0;
        const expGain = eff.cognitionExp || 0;
        return { o, score: cashImpact + expGain * 50 };
      })
      .sort((a, b) => b.score - a.score);
    const optionId = ranked[0].o.id;
    const r = await cli.action({ type: 'respond_to_event', eventId: ev.id, optionId });
    return { ok: r.success, state: r.data };
  }
  return { ok: true, state, noop: true };
}

// ============ Phase 0: 基础经营循环（事件响应 → next_week） ============

export async function runOperatingLoop(cli, opts = {}) {
  const { strategy = baselineStrategy, maxWeeks = 60, metrics = new Metrics() } = opts;
  let state = (await cli.query('state'))?.data;
  let weekIter = 0;
  while (state.phase === 'operating' && weekIter < maxWeeks) {
    weekIter += 1;
    metrics.observeWeek(state.week);

    // 响应事件
    if (state.pendingInteractiveEvent) {
      metrics.observeEventTrigger();
      const r = await strategy(cli, state);
      metrics.observeAction();
      if (!r.ok) break;
      metrics.observeEventResponse();
      state = r.state;
    }
    // 关闭弹窗
    if (state.lastWeekEvent) {
      const r = await cli.action({ type: 'clear_last_week_event' });
      metrics.observeAction();
      if (r.success) state = r.data;
    }
    if (state.weeklySummary) {
      const r = await cli.action({ type: 'clear_weekly_summary' });
      metrics.observeAction();
      if (r.success) state = r.data;
    }
    // 推进
    const adv = await cli.action({ type: 'next_week' });
    metrics.observeAction();
    if (!adv.success) break;
    state = adv.data;
    metrics.observeEnd(state);
    if (state.phase === 'ended') break;
  }

  const tl = (await cli.query('timeline'))?.data || [];
  metrics.observeDrama(tl);
  return { state, timeline: tl, metrics: metrics.finalize() };
}

// ============ 报告写盘 ============

export function writeReport(name, data) {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const path = resolve(REPORTS_DIR, `${name}-${ts}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  return path;
}

// ============ 通用 PASS/FAIL 评估 ============

export function evaluate(metrics, expected) {
  const detail = {};
  let pass = true;
  for (const [k, expr] of Object.entries(expected)) {
    const v = metrics[k];
    let ok = false;
    if (typeof expr === 'string') {
      const m = expr.match(/^(>=|<=|>|<|==)?\s*(-?\d+(?:\.\d+)?)$/);
      if (m) {
        const op = m[1] || '>=';
        const target = Number(m[2]);
        switch (op) {
          case '>=': ok = v >= target; break;
          case '<=': ok = v <= target; break;
          case '>': ok = v > target; break;
          case '<': ok = v < target; break;
          case '==': ok = v === target; break;
        }
      }
    } else if (typeof expr === 'function') {
      ok = !!expr(v);
    }
    detail[k] = { actual: v, expected: expr, pass: ok };
    pass = pass && ok;
  }
  return { pass, detail };
}
