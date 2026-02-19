import fs from 'node:fs';
import path from 'node:path';
import { SMART_SCENARIOS } from './scenarios';
import {
  buildAggregateSummary,
  buildBalanceAlerts,
  runSingleSimulation,
} from './intelligentEngine';
import type { AutomationReport, RunSummary } from './types';

interface CliOptions {
  mode: 'quick' | 'full';
  maxWeeks: number;
  seedsPerScenario: number;
  baseSeed: number;
  outputDir: string;
}

function parseArgs(argv: string[]): CliOptions {
  const getValue = (name: string): string | undefined => {
    const index = argv.findIndex(arg => arg === name);
    if (index < 0 || index + 1 >= argv.length) return undefined;
    return argv[index + 1];
  };

  const modeArg = (getValue('--mode') || 'quick').toLowerCase();
  const mode: 'quick' | 'full' = modeArg === 'full' ? 'full' : 'quick';

  const defaultWeeks = mode === 'full' ? 52 : 40;
  const defaultSeeds = mode === 'full' ? 8 : 3;

  const maxWeeks = Number(getValue('--weeks') || defaultWeeks);
  const seedsPerScenario = Number(getValue('--seeds') || defaultSeeds);
  const baseSeed = Number(getValue('--seed') || 20260213);
  const outputDir = getValue('--out') || 'output/automation-smart';

  return {
    mode,
    maxWeeks: Number.isFinite(maxWeeks) && maxWeeks > 0 ? Math.round(maxWeeks) : defaultWeeks,
    seedsPerScenario: Number.isFinite(seedsPerScenario) && seedsPerScenario > 0
      ? Math.round(seedsPerScenario)
      : defaultSeeds,
    baseSeed: Number.isFinite(baseSeed) ? Math.round(baseSeed) : 20260213,
    outputDir,
  };
}

function createSeeds(baseSeed: number, count: number): number[] {
  const seeds: number[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push((baseSeed + i * 9973) >>> 0);
  }
  return seeds;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMoney(value: number): string {
  return `¥${Math.round(value).toLocaleString('zh-CN')}`;
}

function buildMarkdownReport(report: AutomationReport): string {
  const lines: string[] = [];

  lines.push('# 智能自动化周决策报告');
  lines.push('');
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push(`- 模式: ${report.config.mode}`);
  lines.push(`- 场景数: ${SMART_SCENARIOS.length}`);
  lines.push(`- 每场景种子数: ${report.config.seedsPerScenario}`);
  lines.push(`- 最大周数: ${report.config.maxWeeks}`);
  lines.push('');

  lines.push('## 总体指标');
  lines.push('');
  lines.push(`- 总运行数: ${report.aggregate.totalRuns}`);
  lines.push(`- 胜率: ${formatPercent(report.aggregate.winRate)}`);
  lines.push(`- 破产率: ${formatPercent(report.aggregate.bankruptRate)}`);
  lines.push(`- 平均最终现金: ${formatMoney(report.aggregate.averageFinalCash)}`);
  lines.push(`- 平均 ROI: ${report.aggregate.averageRoi.toFixed(1)}%`);
  lines.push(`- 平均周利润: ${formatMoney(report.aggregate.averageProfit)}`);
  lines.push(`- 平均满足率: ${formatPercent(report.aggregate.averageFulfillment)}`);
  lines.push(`- 20周双高占比(曝光/口碑>=95): ${formatPercent(report.aggregate.dualTopByWeek20Rate)}`);
  lines.push(`- 低履约仍增曝光占比: ${formatPercent(report.aggregate.lowFulfillmentExposureRiseRate)}`);
  lines.push('');

  lines.push('## 高优先级告警');
  lines.push('');
  if (report.balanceAlerts.length === 0) {
    lines.push('- 无');
  } else {
    for (const alert of report.balanceAlerts) {
      lines.push(`- [${alert.severity}] ${alert.code}: ${alert.message}${alert.suspectedModule ? `（疑似: ${alert.suspectedModule}）` : ''}`);
    }
  }
  lines.push('');

  lines.push('## 场景结果');
  lines.push('');
  const grouped = new Map<string, RunSummary[]>();
  for (const run of report.runs) {
    const arr = grouped.get(run.scenarioId) || [];
    arr.push(run);
    grouped.set(run.scenarioId, arr);
  }

  for (const scenario of SMART_SCENARIOS) {
    const runs = grouped.get(scenario.id) || [];
    if (runs.length === 0) continue;

    const wins = runs.filter(r => r.isWin).length;
    const bankrupts = runs.filter(r => r.isBankrupt).length;
    const avgRoi = runs.reduce((sum, r) => sum + r.roi, 0) / runs.length;
    const avgProfit = runs.reduce((sum, r) => sum + r.avgProfit, 0) / runs.length;

    lines.push(`### ${scenario.name}`);
    lines.push('');
    lines.push(`- 描述: ${scenario.description}`);
    lines.push(`- 胜率: ${formatPercent(wins / runs.length)} (${wins}/${runs.length})`);
    lines.push(`- 破产率: ${formatPercent(bankrupts / runs.length)} (${bankrupts}/${runs.length})`);
    lines.push(`- 平均 ROI: ${avgRoi.toFixed(1)}%`);
    lines.push(`- 平均周利润: ${formatMoney(avgProfit)}`);
    lines.push('');
  }

  lines.push('## 异常统计');
  lines.push('');
  lines.push(`- critical: ${report.aggregate.findingCounts.critical}`);
  lines.push(`- warning: ${report.aggregate.findingCounts.warning}`);
  lines.push(`- info: ${report.aggregate.findingCounts.info}`);
  lines.push('');

  return lines.join('\n');
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const seeds = createSeeds(options.baseSeed, options.seedsPerScenario);
  const runs: RunSummary[] = [];

  console.log('=== 智能自动化执行开始 ===');
  console.log(`mode=${options.mode} scenarios=${SMART_SCENARIOS.length} seeds=${options.seedsPerScenario} weeks=${options.maxWeeks}`);

  for (const scenario of SMART_SCENARIOS) {
    for (const seed of seeds) {
      const runSeed = (seed + (scenario.id.length * 31)) >>> 0;
      const run = runSingleSimulation(scenario, runSeed, options.maxWeeks);
      runs.push(run);

      const status = run.isWin ? 'WIN' : run.isBankrupt ? 'BANKRUPT' : 'ENDED';
      console.log(
        `[${status}] ${scenario.id} seed=${runSeed} week=${run.finalWeek} cash=${Math.round(run.finalCash)} roi=${run.roi.toFixed(1)}%` +
        ` findings=${run.findings.length}`
      );
    }
  }

  const aggregate = buildAggregateSummary(runs);
  const balanceAlerts = buildBalanceAlerts(aggregate, runs);

  const report: AutomationReport = {
    generatedAt: new Date().toISOString(),
    config: {
      mode: options.mode,
      maxWeeks: options.maxWeeks,
      seedsPerScenario: options.seedsPerScenario,
      baseSeed: options.baseSeed,
    },
    aggregate,
    balanceAlerts,
    runs,
  };

  const outputDir = path.resolve(options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, 'report.json');
  const mdPath = path.join(outputDir, 'report.md');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  fs.writeFileSync(mdPath, buildMarkdownReport(report), 'utf-8');

  console.log('=== 智能自动化执行完成 ===');
  console.log(`report(json): ${jsonPath}`);
  console.log(`report(md):   ${mdPath}`);
  console.log(
    `winRate=${formatPercent(aggregate.winRate)} ` +
    `bankruptRate=${formatPercent(aggregate.bankruptRate)} ` +
    `criticalFindings=${aggregate.findingCounts.critical}`
  );

  if (balanceAlerts.some(a => a.severity === 'critical')) {
    process.exitCode = 2;
  }
}

main();
