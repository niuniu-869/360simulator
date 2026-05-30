// ruleAdvisor.ts — 规则版"赛博勇哥"兜底引擎
//
// 设计目标（上线财务地雷修复 任务1）：
//   - 完全本地、零网络、永不报错。无 LLM key 时也能给出有用诊断。
//   - 产出与 LLM 诊断【同构】的结果：DiagnosisSection[]（喂给现有 XML 渲染管线）
//     + Proposal[]（复用 prompts.ts 的可执行提案，让"一键采纳"继续可用）
//     + SimulationResult（复用 simulator.ts 的本地供需推演）。
//
// 数据来源：
//   - healthAlerts：已经是管理会计口径的告警（来自 healthCheck.ts），是规则版的"大脑"。
//   - simulator.ts：把映射出的提案跑一遍真实供需模型，给出"如果这么改会怎样"的本地推演。
//
// 人设：保持勇哥毒舌但有用，每条建议带一句"为什么"（毛利率/盈亏平衡/固定vs变动成本视角），
//       强化教学卖点。

import type { GameState, SupplyDemandResult, HealthAlert } from "@/types/game";
import type { DiagnosisSection } from "@/lib/llm/xmlParser";
import type { Proposal } from "@/lib/llm/prompts";
import { simulateProposals } from "@/lib/llm/simulator";
import type { SimulationResult } from "@/lib/llm/simulator";

// CyberYongGe 用到的当前财务快照（与组件 prop 同形，避免引入额外依赖）
interface CurrentStatsLite {
  revenue: number;
  variableCost: number;
  fixedCost: number;
  profit: number;
  margin: number;
  breakEvenPoint: number;
}

export interface RuleAdvice {
  /** 与 LLM 诊断同构的分步卡片，直接喂给现有渲染管线 */
  sections: DiagnosisSection[];
  /** 可执行提案（可能为空 = 稳住别折腾） */
  proposals: Proposal[];
  /** 本地供需推演结果（提案非空时给出，便于"一键采纳"前看效果） */
  simResult: SimulationResult | null;
}

// ============ 工具：把告警按严重度排序、取关键几条 ============

const SEVERITY_RANK: Record<HealthAlert["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function sortAlerts(alerts: HealthAlert[]): HealthAlert[] {
  return [...alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
}

// ============ 告警 → 提案映射 ============
//
// 只映射"能确定生成合法 Proposal"的告警；不确定的（如选址/品牌问题）只给文字建议、不强造提案。
// 每条映射都返回 { proposal, why }，why 是教学点（采纳建议后展示理由）。

interface MappedProposal {
  proposal: Proposal;
  why: string; // 教学点：为什么这么做
}

/**
 * 把单条告警映射成可执行提案。返回 null 表示该告警无对应的安全提案（只给文字建议）。
 */
function mapAlertToProposal(
  alert: HealthAlert,
  state: GameState,
): MappedProposal | null {
  // 1. 人工占比过高 → 裁掉一个冗余员工（保留关键岗位：唯一厨师/唯一服务员不动）
  if (alert.id === "staff_salary_exceeds_revenue") {
    const target = pickRedundantStaff(state);
    if (target) {
      return {
        proposal: {
          type: "fire_staff",
          params: { index: target.index, staffId: target.id },
          label: `开掉${target.name}（${taskZh(target.task)}）`,
        },
        why: "人工是固定成本里最大的一块。砍掉冗余人手能直接降低盈亏平衡点——记住：盈亏平衡点 = 固定成本 ÷ 毛利率，固定成本降了，你更容易保本。",
      };
    }
    return null; // 没有可安全裁的人（全是关键岗位）→ 只给文字
  }

  // 2. 定价过高 → 降到参考价 1.1 倍附近
  if (alert.id.startsWith("overpriced_")) {
    const productId = alert.id.slice("overpriced_".length);
    const product = state.selectedProducts.find((p) => p.id === productId);
    if (product) {
      const targetPrice = Math.round(product.referencePrice * 1.1);
      return {
        proposal: {
          type: "set_price",
          params: { productId, price: targetPrice },
          label: `${product.name}降价到${targetPrice}元`,
        },
        why: "价格超过消费者心理价位太多，转化率会断崖式下跌——卖不出去，毛利率再高也是纸面富贵。降到心理价位附近，用销量换利润。",
      };
    }
    return null;
  }

  // 3. 定价过低 → 提价到成本 1.5 倍以上（毛利率约 33%）
  if (alert.id.startsWith("underpriced_")) {
    const productId = alert.id.slice("underpriced_".length);
    const product = state.selectedProducts.find((p) => p.id === productId);
    if (product) {
      const targetPrice = Math.round(product.baseCost * 1.5);
      return {
        proposal: {
          type: "set_price",
          params: { productId, price: targetPrice },
          label: `${product.name}提价到${targetPrice}元`,
        },
        why: "毛利率 = (售价−成本)÷售价。你这价格毛利率太薄，卖一份赚不了几毛钱，卖再多也覆盖不了房租人工。小幅提价能直接把每一单的贡献毛益拉上来。",
      };
    }
    return null;
  }

  // 4. 曝光度太低且没营销 → 开社交媒体推广（费用最低的曝光手段）
  if (alert.id === "low_exposure" || alert.id === "no_marketer_low_exposure") {
    if (state.activeMarketingActivities.length === 0) {
      return {
        proposal: {
          type: "start_marketing",
          params: { activityId: "social_media" },
          label: "开始社交媒体推广",
        },
        why: "酒香也怕巷子深。社交媒体是单位曝光最便宜的渠道——这笔营销费是变动/可调成本，效果要 3-4 周才显现，别指望立竿见影，但不打出知名度永远没客流。",
      };
    }
    return null;
  }

  // 5. 严重缺货 → 改激进补货（比招人更轻、立即生效）
  if (alert.id === "supply_shortage") {
    if (state.inventoryState && state.inventoryState.items.length > 0) {
      return {
        proposal: {
          type: "change_restock",
          params: { strategy: "aggressive" },
          label: "改为激进补货策略",
        },
        why: "有客人来了却买不到，等于把钱往外推。先把库存堆足把眼前的单子接住——缺货损失的是确定的收入，多备点货增加的只是可控的持有成本。",
      };
    }
    return null;
  }

  // 6. 损耗太大 → 改保守补货
  if (alert.id === "high_waste") {
    if (state.inventoryState && state.inventoryState.items.length > 0) {
      return {
        proposal: {
          type: "change_restock",
          params: { strategy: "conservative" },
          label: "改为保守补货策略",
        },
        why: "东西烂在仓库里就是纯亏的变动成本。保守补货减少积压，损耗降下来，毛利率自然回升——省下来的每一块都是净利润。",
      };
    }
    return null;
  }

  // 7. 卖正餐没厨师 → 招厨师（出餐能力归零的硬伤，必须补）
  if (alert.id === "no_chef_for_meal") {
    return {
      proposal: {
        type: "hire_staff",
        params: { task: "chef" },
        label: "招一个全职厨师",
      },
      why: "没厨师等于没产能，再多客人也接不住。这是硬伤不是优化——注意新人有1周适应期且立刻增加工资，短期是纯成本，但不补这个口子永远开不了张。",
    };
  }

  // 8. 经营够久还没上外卖、且当前不亏 → 上美团（亏损时不上，避免雪上加霜）
  if (alert.id === "no_delivery") {
    const notLosing = (state.profitHistory.slice(-1)[0] ?? 0) >= 0;
    if (
      notLosing &&
      !state.deliveryState.platforms.some((p) => p.platformId === "meituan")
    ) {
      return {
        proposal: {
          type: "join_platform",
          params: { platformId: "meituan" },
          label: "上线美团外卖",
        },
        why: "外卖能扩客源，但有2-3周冷启动期，佣金从第一天就开始扣。所以只在不亏钱时上——亏损时上外卖只会因为佣金亏得更多。",
      };
    }
    return null;
  }

  // 其余告警（选址差/品牌快招/沉没成本/口碑/士气/疲劳等）没有"一键可执行"的安全提案，
  // 故只在诊断文字里给建议，不强造提案。
  return null;
}

/** 挑一个可以安全裁掉的冗余员工：不动唯一厨师、不动唯一服务员，优先裁非关键岗位/低技能 */
function pickRedundantStaff(
  state: GameState,
): { index: number; id: string; name: string; task: string } | null {
  const staff = state.staff;
  if (staff.length <= 1) return null;

  const chefCount = staff.filter((s) => s.assignedTask === "chef").length;
  const waiterCount = staff.filter((s) => s.assignedTask === "waiter").length;

  // 候选：去掉"唯一厨师""唯一服务员"
  const candidates = staff
    .map((s, index) => ({ s, index }))
    .filter(({ s }) => {
      if (s.assignedTask === "chef" && chefCount <= 1) return false;
      if (s.assignedTask === "waiter" && waiterCount <= 1) return false;
      return true;
    });

  if (candidates.length === 0) return null;

  // 优先裁：非关键岗位（marketer/cleaner）> 技能最低 > 薪资最高（最贵的冗余）
  candidates.sort((a, b) => {
    const aSupport = a.s.assignedTask === "marketer" || a.s.assignedTask === "cleaner";
    const bSupport = b.s.assignedTask === "marketer" || b.s.assignedTask === "cleaner";
    if (aSupport !== bSupport) return aSupport ? -1 : 1;
    if (a.s.skillLevel !== b.s.skillLevel) return a.s.skillLevel - b.s.skillLevel;
    return b.s.salary - a.s.salary;
  });

  const chosen = candidates[0];
  return {
    index: chosen.index,
    id: chosen.s.id,
    name: chosen.s.name,
    task: chosen.s.assignedTask,
  };
}

function taskZh(task: string): string {
  switch (task) {
    case "chef":
      return "后厨";
    case "waiter":
      return "服务";
    case "marketer":
      return "营销";
    case "cleaner":
      return "勤杂";
    default:
      return task;
  }
}

// ============ 勇哥口吻文案拼装 ============

/** 把数字说成口语约数，避免暴露精确数值（与勇哥人设一致） */
function colloquial(n: number): string {
  const abs = Math.abs(Math.round(n));
  if (abs >= 10000) return `${(abs / 10000).toFixed(1)}万来块`;
  if (abs >= 1000) return `${Math.round(abs / 100) * 100}块来钱`;
  return `${Math.round(abs / 10) * 10}块`;
}

function buildGreeting(): string {
  return "来，把手机转一圈，让我看看你这个店。今天勇哥不连麦了，直接给你把账算明白——我跟你说，做生意不要凭感觉，给我看数据。";
}

function buildAccounting(
  stats: CurrentStatsLite,
  state: GameState,
): string {
  const lines: string[] = ["我给你算笔账。"];

  if (stats.profit < 0) {
    lines.push(
      `你这一周下来亏了${colloquial(stats.profit)}，固定成本就压着你${colloquial(stats.fixedCost)}，房租人工水电这些是雷打不动要出的。`,
    );
  } else if (stats.fixedCost > 0 && stats.profit < stats.fixedCost * 0.2) {
    lines.push(
      `看着是赚了${colloquial(stats.profit)}，但你固定成本一周就要${colloquial(stats.fixedCost)}，这点利润连零头都不够，一个意外就打回原形。`,
    );
  } else if (stats.profit > 0) {
    lines.push(
      `这一周净赚${colloquial(stats.profit)}，账面是健康的，固定成本${colloquial(stats.fixedCost)}你也覆盖住了。`,
    );
  } else {
    lines.push("你还没正经开张算账，先把店撑起来再说。");
  }

  // 毛利率 + 盈亏平衡点教学
  if (stats.margin > 0) {
    lines.push(
      `你的毛利不到${Math.round(stats.margin)}%上下，记住盈亏平衡点 = 固定成本 ÷ 毛利率，毛利越薄，你每个月要卖的量就越离谱。`,
    );
  }
  if (stats.breakEvenPoint > 0 && stats.breakEvenPoint < Infinity) {
    const cmp =
      stats.revenue >= stats.breakEvenPoint
        ? "你现在的营业额是过了这条线的，能活。"
        : "你现在的营业额还没摸到这条线，每开一天都在亏。";
    lines.push(
      `你这店一周得卖到${colloquial(stats.breakEvenPoint)}才保本。${cmp}`,
    );
  }

  // 累计盈亏
  const cum = state.cumulativeProfit || 0;
  if (cum < 0) {
    lines.push(`从开店到现在你累计还倒贴着${colloquial(cum)}，离回本还差着十万八千里。`);
  } else if (cum > 0) {
    lines.push(`从开店到现在累计赚了${colloquial(cum)}，这个方向是对的。`);
  }

  return lines.join("");
}

function buildConclusion(
  alerts: HealthAlert[],
  mapped: MappedProposal[],
  stats: CurrentStatsLite,
): string {
  if (alerts.length === 0) {
    if (stats.profit > 0) {
      return "我看了一圈，你这店没啥大毛病，账也算得过来。不错，继续保持，别瞎折腾——做餐饮最忌讳没事找事，稳住就是赚。";
    }
    return "暂时没看出特别扎眼的硬伤，但也别大意。先把基本盘稳住，盯紧每周的现金流，有起色再考虑扩张。";
  }

  const lines: string[] = [];
  // 点名最严重的几个问题
  const top = alerts.slice(0, 3);
  const titles = top.map((a) => a.title.replace(/[！!？?]/g, "")).join("、");
  lines.push(`不是我说你，你这店现在有几个坎得迈过去：${titles}。`);

  if (mapped.length > 0) {
    lines.push(
      `下面这${mapped.length}步我已经帮你用模型算过账了，是能往好处走的方向，你可以一键采纳。`,
    );
  } else {
    lines.push(
      "这几个问题没法靠一两个按钮一键解决，得你自己拿主意——但方向我给你指明白了，照着改。",
    );
  }

  if (stats.profit < 0) {
    lines.push("现在在亏钱，先止血再谈发展，把成本压下来比什么都重要。");
  }

  return lines.join("");
}

/**
 * 把一条告警 + 它的教学点拼成一句"勇哥点评"。
 * 没有提案的告警，用告警自带的 suggestion + 一句教学视角。
 */
function buildAlertComment(alert: HealthAlert, why?: string): string {
  const head = `【${alert.title}】${alert.message}`;
  const advice = why ? `${alert.suggestion} 为什么这么干：${why}` : alert.suggestion;
  return `${head} ${advice}`;
}

// ============ 主入口 ============

/**
 * 规则版勇哥诊断：完全本地、零网络、永不抛错。
 *
 * @param gameState           当前游戏状态
 * @param currentStats        当前财务快照（CyberYongGe 的 currentStats prop）
 * @param supplyDemandResult  供需结果（用于丰富诊断，可为 null）
 * @param healthAlerts        健康告警（规则版的大脑）
 */
export function buildRuleAdvice(
  gameState: GameState,
  currentStats: CurrentStatsLite,
  supplyDemandResult: SupplyDemandResult | null,
  healthAlerts?: HealthAlert[],
): RuleAdvice {
  const alerts = sortAlerts(healthAlerts || []);

  // 1. 告警 → 提案（最多取 3 条可执行的）
  const mappedAll: MappedProposal[] = [];
  const seenTypes = new Set<string>(); // 避免重复同类提案
  for (const alert of alerts) {
    if (mappedAll.length >= 3) break;
    const m = mapAlertToProposal(alert, gameState);
    if (!m) continue;
    // 同一产品的调价/同类操作去重（用 type+主参数做 key）
    const key = `${m.proposal.type}:${
      m.proposal.params.productId ?? m.proposal.params.staffId ?? m.proposal.params.activityId ?? m.proposal.params.strategy ?? m.proposal.params.task ?? m.proposal.params.platformId ?? ""
    }`;
    if (seenTypes.has(key)) continue;
    // 禁止危险组合：不要同时招人 + 开营销（都是短期增成本）
    if (
      (m.proposal.type === "hire_staff" &&
        mappedAll.some((x) => x.proposal.type === "start_marketing")) ||
      (m.proposal.type === "start_marketing" &&
        mappedAll.some((x) => x.proposal.type === "hire_staff"))
    ) {
      continue;
    }
    seenTypes.add(key);
    mappedAll.push(m);
  }

  let mapped = mappedAll;
  let proposals = mapped.map((m) => m.proposal);

  // 2. 本地推演 + 剪枝：把提案跑一遍真实供需模型，挑出"最不亏/能改善"的子集。
  //    避免重蹈"假勇哥"覆辙——绝不把一组净恶化的操作当成建议推给玩家。
  let simResult: SimulationResult | null = null;
  if (proposals.length > 0) {
    try {
      const runSim = (ps: Proposal[]) =>
        simulateProposals(
          gameState,
          currentStats.revenue,
          currentStats.fixedCost,
          currentStats.profit,
          ps,
        );

      simResult = runSim(proposals);

      // 若整组恶化，逐步剪枝：移除"边际贡献最差"的提案，直到改善为正或只剩 1 条。
      if (simResult.improvement <= 0 && mapped.length > 1) {
        let bestMapped = mapped;
        let bestResult = simResult;
        const working = [...mapped];
        while (working.length > 1 && bestResult.improvement <= 0) {
          // 找出移除哪一条后剩余组合最优
          let removeIdx = -1;
          let removeResult: SimulationResult | null = null;
          for (let i = 0; i < working.length; i++) {
            const subset = working.filter((_, j) => j !== i);
            const r = runSim(subset.map((m) => m.proposal));
            if (!removeResult || r.improvement > removeResult.improvement) {
              removeResult = r;
              removeIdx = i;
            }
          }
          if (removeIdx < 0 || !removeResult) break;
          working.splice(removeIdx, 1);
          if (removeResult.improvement > bestResult.improvement) {
            bestResult = removeResult;
            bestMapped = [...working];
          }
        }
        mapped = bestMapped;
        proposals = mapped.map((m) => m.proposal);
        simResult = bestResult;
      }

      // 剪枝后仍恶化：当前不亏 → 干脆"稳住别折腾"，不给会变差的建议。
      // 当前在亏 → 保留剪枝后的最优组合（止血动作短期可能仍未转正，但方向正确，
      // 并由 UI 的 VerificationCard 明确标注预测变化，让玩家知情决策）。
      if (simResult.improvement <= 0 && currentStats.profit >= 0) {
        return buildSteadyAdvice(gameState, currentStats, alerts, mapped, simResult);
      }
    } catch {
      // 推演失败也绝不报错：退化为只给文字建议
      simResult = null;
    }
  }

  // 3. 拼装诊断文字（DiagnosisSection[]，喂给现有渲染管线）
  const sections = buildSections(gameState, currentStats, supplyDemandResult, alerts, mapped);

  return { sections, proposals, simResult };
}

/** "稳住别折腾"分支：提案被推演否决时调用 */
function buildSteadyAdvice(
  gameState: GameState,
  currentStats: CurrentStatsLite,
  alerts: HealthAlert[],
  mapped: MappedProposal[],
  simResult: SimulationResult | null,
): RuleAdvice {
  const sections = buildSections(gameState, currentStats, null, alerts, mapped, true);
  void simResult;
  return { sections, proposals: [], simResult: null };
}

/** 组装 DiagnosisSection[]：greeting / accounting / conclusion + 逐条告警点评 */
function buildSections(
  gameState: GameState,
  currentStats: CurrentStatsLite,
  supplyDemandResult: SupplyDemandResult | null,
  alerts: HealthAlert[],
  mapped: MappedProposal[],
  forceSteady = false,
): DiagnosisSection[] {
  void supplyDemandResult;
  const whyByAlertId = new Map<string, string>();
  // 把映射出来的教学点回填到对应告警（用提案 label 关联不可靠，用告警顺序近似）
  // 这里改用：按告警 id 重新映射一次拿 why（mapAlertToProposal 是纯函数，安全）
  for (const alert of alerts) {
    const m = mapAlertToProposal(alert, gameState);
    if (m) whyByAlertId.set(alert.id, m.why);
  }
  void mapped;

  const sections: DiagnosisSection[] = [];

  sections.push({
    tag: "greeting",
    content: buildGreeting(),
    isComplete: true,
  });

  sections.push({
    tag: "accounting",
    content: buildAccounting(currentStats, gameState),
    isComplete: true,
  });

  // 逐条告警点评塞进 conclusion 之前的 surroundings/brand 等会被渲染管线展示；
  // 但渲染管线只认固定 tag。把告警点评汇总进 conclusion，保证全部可见。
  const alertComments = alerts
    .slice(0, 5)
    .map((a) => buildAlertComment(a, whyByAlertId.get(a.id)))
    .join("\n\n");

  const conclusionBody = forceSteady
    ? "我反复算了好几遍，以你现在这个情况，瞎动反而更糟。先稳住别折腾，把基本盘守好，等时机。"
    : buildConclusion(alerts, mapped, currentStats);

  sections.push({
    tag: "conclusion",
    content: alertComments
      ? `${conclusionBody}\n\n———— 逐条说道说道 ————\n\n${alertComments}`
      : conclusionBody,
    isComplete: true,
  });

  return sections;
}
