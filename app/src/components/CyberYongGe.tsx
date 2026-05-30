// 赛博勇哥 — LLM 驱动的实时诊断面板
// 流式 XML 渲染 + function calling 自动验证提案

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { GameState, SupplyDemandResult, HealthAlert } from '@/types/game';
import {
  streamChat,
  getLLMConfig,
  getByokConfig,
  setByokConfig,
  hasByok,
} from '@/lib/llm/client';
import type { ByokConfig } from '@/lib/llm/client';
import { buildMessages, SIMULATE_TOOL } from '@/lib/llm/prompts';
import type { Proposal } from '@/lib/llm/prompts';
import { StreamingXMLParser } from '@/lib/llm/xmlParser';
import type { DiagnosisSection } from '@/lib/llm/xmlParser';
import { simulateProposals } from '@/lib/llm/simulator';
import type { SimulationResult } from '@/lib/llm/simulator';
import { buildRuleAdvice } from '@/lib/llm/ruleAdvisor';
import { PASSIVE_EXP_CONFIG } from '@/data/cognitionData';
import {
  MessageCircle,
  Wallet,
  Building2,
  Eye,
  Calculator,
  Lightbulb,
  Loader2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Flame,
  AlertTriangle,
  Settings,
  Sparkles,
  Cpu,
} from 'lucide-react';

// ============ 类型 ============

interface CyberYongGeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameState: GameState;
  currentStats: {
    revenue: number;
    variableCost: number;
    fixedCost: number;
    fixedCostBreakdown: {
      rent: number;
      salary: number;
      utilities: number;
      marketing: number;
      depreciation: number;
    };
    profit: number;
    margin: number;
    breakEvenPoint: number;
  };
  supplyDemandResult: SupplyDemandResult | null;
  onConsult: () => boolean;
  onApplyProposals?: (proposals: Proposal[]) => void;
  consultCost: number;
  consultLimit: number;
  consultedThisWeek: number;
  healthAlerts?: HealthAlert[];
}

type DiagnosisPhase = 'idle' | 'streaming' | 'tool_calling' | 'done' | 'error' | 'gave_up';

const MAX_TOOL_ROUNDS = 3;

// 每个诊断步骤的配置
const STEP_CONFIG: Record<string, {
  icon: typeof MessageCircle;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  greeting: {
    icon: MessageCircle,
    label: '问好',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  investment: {
    icon: Wallet,
    label: '追问投资',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  brand: {
    icon: Building2,
    label: '核实品牌',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  surroundings: {
    icon: Eye,
    label: '360°转一圈',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
  },
  accounting: {
    icon: Calculator,
    label: '算账',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  conclusion: {
    icon: Lightbulb,
    label: '结论建议',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
};

// ============ 提案解析 ============

/** 从流式解析的 sections 中提取 proposals JSON */
function parseProposalsFromSections(sections: DiagnosisSection[]): Proposal[] {
  const proposalSection = sections.find(s => s.tag === 'proposals');
  if (!proposalSection?.content) return [];
  try {
    const jsonMatch = proposalSection.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* ignore */ }
  return [];
}

// ============ 组件 ============

export function CyberYongGe({
  open,
  onOpenChange,
  gameState,
  currentStats,
  supplyDemandResult,
  onConsult,
  onApplyProposals,
  consultCost,
  consultLimit,
  consultedThisWeek,
  healthAlerts,
}: CyberYongGeProps) {
  const [phase, setPhase] = useState<DiagnosisPhase>('idle');
  const [sections, setSections] = useState<DiagnosisSection[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [toolRound, setToolRound] = useState(0);
  // 服务端是否配置了作者 key（getLLMConfig 缓存结果）
  const [serverLLMAvailable, setServerLLMAvailable] = useState(false);
  // 用户是否接入了自己的 key（BYOK），状态同步到 localStorage
  const [byokActive, setByokActive] = useState(() => hasByok());
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const parserRef = useRef(new StreamingXMLParser());
  const scrollRef = useRef<HTMLDivElement>(null);
  // 在 tool call handler 中捕获最后一次成功的提案
  const lastToolProposalsRef = useRef<Proposal[]>([]);
  const lastToolResultRef = useRef<SimulationResult | null>(null);
  const toolCallCountRef = useRef(0);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sections, simResult, phase, toolRound]);

  // 关闭时中止请求
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
    }
  }, [open]);

  // 打开时探测"真 LLM 是否可用"：服务端作者 key（带缓存） + 本地 BYOK
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getLLMConfig()
      .then((cfg) => {
        if (!cancelled) setServerLLMAvailable(!!cfg.available);
      })
      .catch(() => {
        if (!cancelled) setServerLLMAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 真 LLM 是否可用 = 服务端配了作者 key || 用户接入了自己的 key
  const realLLMAvailable = serverLLMAvailable || byokActive;

  const canConsult = consultedThisWeek < consultLimit && gameState.cash >= consultCost;

  // tool call 处理器：运行模拟并返回结果给 LLM
  const handleToolCall = useCallback((name: string, args: Record<string, unknown>): string => {
    if (name !== 'simulate_proposals') {
      return JSON.stringify({ error: `未知工具: ${name}` });
    }

    const toolProposals = (args.proposals as Proposal[]) || [];
    toolCallCountRef.current += 1;

    if (toolProposals.length === 0) {
      return JSON.stringify({
        result: 'empty',
        message: '空提案，无需验证。如果你认为不需要操作，直接输出 <proposals>[]</proposals>',
      });
    }

    const result = simulateProposals(
      gameState,
      currentStats.revenue,
      currentStats.fixedCost,
      currentStats.profit,
      toolProposals,
    );

    // 保存最后一次工具调用的结果
    lastToolProposalsRef.current = toolProposals;
    lastToolResultRef.current = result;

    // 更新 UI 状态
    setSimResult(result);
    setProposals(toolProposals);

    return JSON.stringify({
      currentProfit: Math.round(result.currentProfit),
      projectedProfit: Math.round(result.projectedProfit),
      projectedRevenue: Math.round(result.projectedRevenue),
      improvement: Math.round(result.improvement),
      improved: result.improvement > 0,
      isProfitable: result.isProfitable,
      appliedProposals: result.appliedProposals,
      failedProposals: result.failedProposals,
      hint: result.improvement > 0
        ? '方案可行！利润有改善。请输出 <proposals> 标签包含这个方案。'
        : `方案不理想，利润${result.improvement < 0 ? '恶化' : '无改善'}。请换个思路再试，或输出空数组 [] 表示"稳住别折腾"。`,
    });
  }, [gameState, currentStats]);

  /**
   * 规则版诊断：完全本地、零网络、永不报错。
   * 直接把 ruleAdvisor 产出的 sections/proposals/simResult 填进现有渲染管线，phase 直接到 done。
   */
  const runRuleDiagnosis = useCallback(() => {
    const advice = buildRuleAdvice(
      gameState,
      currentStats,
      supplyDemandResult,
      healthAlerts,
    );
    setSections(advice.sections);
    setProposals(advice.proposals);
    setSimResult(advice.simResult);
    setToolRound(0);
    setPhase('done');
  }, [gameState, currentStats, supplyDemandResult, healthAlerts]);

  // 开始诊断：真 LLM 可用走 streamChat，否则走规则版（零成本、不报错）
  const startDiagnosis = useCallback(async () => {
    // 扣费策略：诊断必定产出结果（规则版也产出，LLM 失败也兜底到规则版），
    // 所以扣费是安全的——绝不会出现"扣了币又报错"。先校验次数/余额再扣。
    const ok = onConsult();
    if (!ok) {
      setErrorMsg('余额不足或本周咨询次数已满');
      setPhase('error');
      return;
    }

    // 重置状态
    setSections([]);
    setProposals([]);
    setSimResult(null);
    setErrorMsg('');
    setToolRound(0);
    lastToolProposalsRef.current = [];
    lastToolResultRef.current = null;
    toolCallCountRef.current = 0;
    parserRef.current.reset();

    // 真 LLM 不可用 → 直接走规则版，不发任何网络请求、不报 500
    if (!realLLMAvailable) {
      runRuleDiagnosis();
      return;
    }

    setPhase('streaming');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const messages = buildMessages(gameState, currentStats, supplyDemandResult, healthAlerts);

      // 单次调用，client 自动处理 tool calling 循环
      await streamChat({
        messages,
        signal: controller.signal,
        tools: [SIMULATE_TOOL],
        maxToolRounds: MAX_TOOL_ROUNDS,
        onChunk: (chunk) => {
          parserRef.current.feed(chunk);
          const newSections = parserRef.current.getSections();
          setSections([...newSections]);
        },
        onToolCall: handleToolCall,
        onToolRound: (round) => {
          setToolRound(round);
          setPhase('tool_calling');
        },
      });

      // 流式结束，解析最终 proposals
      const finalSections = parserRef.current.getSections();
      setSections([...finalSections]);

      // 优先从 XML <proposals> 标签解析（LLM 最终确认的方案）
      const xmlProposals = parseProposalsFromSections(finalSections);

      if (xmlProposals.length > 0) {
        setProposals(xmlProposals);
        // 用 XML 中的提案重新模拟一次，确保 simResult 与最终提案一致
        const finalResult = simulateProposals(
          gameState, currentStats.revenue, currentStats.fixedCost,
          currentStats.profit, xmlProposals,
        );
        setSimResult(finalResult);
        setPhase('done');
      } else if (lastToolProposalsRef.current.length > 0 && lastToolResultRef.current) {
        // fallback：LLM 没输出 <proposals> 但工具调用过，用最后一次工具结果
        const lastProposals = lastToolProposalsRef.current;
        const lastResult: SimulationResult = lastToolResultRef.current;
        setProposals(lastProposals);
        setSimResult(lastResult);
        // 如果最后一次工具结果也不好，标记 gave_up
        if (lastResult.improvement <= 0 && toolCallCountRef.current >= MAX_TOOL_ROUNDS) {
          setPhase('gave_up');
        } else {
          setPhase('done');
        }
      } else {
        // 空提案 = "稳住别折腾" 或 LLM 没调用工具
        setProposals([]);
        setSimResult(null);
        setPhase('done');
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      // 真 LLM 路径失败（网络/上游错误/预算耗尽等）→ 兜底到规则版，
      // 玩家已扣的费照样换来一份有用诊断，绝不"扣了币又报错"。
      console.warn('[CyberYongGe] AI 勇哥请求失败，降级到规则版:', err);
      parserRef.current.reset();
      runRuleDiagnosis();
    }
  }, [gameState, currentStats, supplyDemandResult, onConsult, healthAlerts, handleToolCall, realLLMAvailable, runRuleDiagnosis]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#0d1117] border-[#1e293b] w-full sm:max-w-lg flex flex-col p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-[#1e293b]">
          <SheetTitle className="flex items-center gap-2 text-orange-500">
            <Flame className="w-5 h-5" />
            赛博勇哥 · 连麦诊断
            {/* 当前模式标注，让用户知情 */}
            {realLLMAvailable ? (
              <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-normal px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300">
                <Sparkles className="w-3 h-3" />
                AI 勇哥（{byokActive ? '已接入你的key' : '已接入'}）
              </span>
            ) : (
              <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-500/15 border border-slate-500/30 text-slate-300">
                <Cpu className="w-3 h-3" />
                规则版勇哥（免费）
              </span>
            )}
            {/* 设置入口：接入我的AI */}
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="ml-auto p-1 rounded text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
              title="接入我的 AI（自带 key）"
              aria-label="接入我的 AI"
            >
              <Settings className="w-4 h-4" />
            </button>
          </SheetTitle>
          <SheetDescription className="text-slate-400 text-xs">
            {consultCost}元/次 · 本周 {consultedThisWeek}/{consultLimit} 次 · +
            {PASSIVE_EXP_CONFIG.consultYongGeExp}认知经验
          </SheetDescription>
        </SheetHeader>

        {/* BYOK 设置面板 */}
        {showSettings && (
          <ByokSettings
            onClose={() => setShowSettings(false)}
            onSaved={() => {
              setByokActive(hasByok());
              setShowSettings(false);
            }}
          />
        )}

        {/* 滚动内容区 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* 空闲状态 */}
          {phase === 'idle' && (
            <IdleView
              canConsult={canConsult}
              consultCost={consultCost}
              onStart={startDiagnosis}
              realLLMAvailable={realLLMAvailable}
            />
          )}

          {/* 诊断步骤卡片 */}
          {phase !== 'idle' && sections
            .filter(s => s.tag !== 'proposals' && s.tag !== 'verification')
            .map(section => (
              <StepCard key={section.tag} section={section} />
            ))}

          {/* 流式加载指示器 */}
          {phase === 'streaming' && (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              勇哥正在分析...
            </div>
          )}

          {/* 勇哥在给你想办法（tool calling 中） */}
          {phase === 'tool_calling' && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span className="text-sm font-bold text-amber-400">勇哥在给你想办法…</span>
              </div>
              <p className="text-xs text-slate-400">
                正在用数值模型测算方案效果（第{toolRound}/{MAX_TOOL_ROUNDS}次尝试）
              </p>
            </div>
          )}

          {/* 提案列表（完成时显示） */}
          {proposals.length > 0 && (phase === 'done' || phase === 'gave_up') && (
            <ProposalList proposals={proposals} />
          )}

          {/* 验证结果 */}
          {simResult && phase === 'done' && (
            <VerificationCard
              result={simResult}
              proposals={proposals}
              onApply={onApplyProposals}
              onClose={() => onOpenChange(false)}
            />
          )}

          {/* 勇哥没招了 */}
          {phase === 'gave_up' && (
            <div className="p-4 bg-slate-500/10 border border-slate-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-300">勇哥没招了</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                "哥们，我反复算了好几遍，以你现在这个情况，我暂时想不出什么好办法。
                {simResult && simResult.currentProfit < 0
                  ? '要么先稳住别折腾，把成本压下来再说。'
                  : '目前的经营状态还行，别瞎折腾，保持就好。'}
                "
              </p>
              {simResult && (
                <div className="mt-3 text-xs text-slate-500">
                  经过{toolRound}轮测算，所有方案均无法改善利润（当前周利润 ¥{Math.round(simResult.currentProfit)}）
                </div>
              )}
            </div>
          )}

          {/* 无操作建议（空提案 + 无 simResult） */}
          {phase === 'done' && proposals.length === 0 && !simResult && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400">勇哥的建议：稳住别折腾</span>
              </div>
              <p className="text-xs text-slate-400">
                当前经营状态不需要大的调整，保持现状就好。
              </p>
            </div>
          )}

          {/* 错误状态 */}
          {phase === 'error' && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {errorMsg || '诊断失败'}
              </div>
            </div>
          )}

          {/* 完成后的操作按钮 */}
          {(phase === 'done' || phase === 'error' || phase === 'gave_up') && (
            <div className="flex justify-center pt-3 pb-2">
              <button
                className="ark-button flex items-center gap-2 text-sm px-6 py-2 bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30 transition-colors"
                onClick={startDiagnosis}
                disabled={!canConsult}
              >
                <RotateCcw className="w-4 h-4" />
                再问一次（{consultCost}元）
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============ 子组件 ============

/** 空闲状态视图 */
function IdleView({
  canConsult,
  consultCost,
  onStart,
  realLLMAvailable,
}: {
  canConsult: boolean;
  consultCost: number;
  onStart: () => void;
  realLLMAvailable: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center">
        <span className="text-4xl">📹</span>
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-white">连麦勇哥</h3>
        <p className="text-sm text-slate-400 max-w-xs">
          "来，把手机转一圈，让我看看你这个店的情况"
        </p>
        {!realLLMAvailable && (
          <p className="text-[11px] text-slate-500 max-w-xs">
            当前为规则版勇哥（免费、本地推演，不联网）。想要真 AI 对话？点右上角齿轮接入你自己的 key。
          </p>
        )}
      </div>
      <button
        className="ark-button ark-button-primary px-8 py-3 text-base flex items-center gap-2"
        onClick={onStart}
        disabled={!canConsult}
      >
        <Flame className="w-5 h-5" />
        开始连麦（{consultCost}元）
      </button>
      {!canConsult && (
        <p className="text-xs text-red-400">余额不足或本周次数已满</p>
      )}
    </div>
  );
}

/** BYOK 设置面板：填自己的 OpenAI 兼容 key / baseURL / model */
function ByokSettings({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing: ByokConfig | null = getByokConfig();
  const [apiKey, setApiKey] = useState(existing?.apiKey || '');
  const [baseURL, setBaseURL] = useState(existing?.baseURL || '');
  const [model, setModel] = useState(existing?.model || '');

  const handleSave = () => {
    setByokConfig(apiKey.trim() ? { apiKey, baseURL, model } : null);
    onSaved();
  };

  const handleClear = () => {
    setByokConfig(null);
    setApiKey('');
    setBaseURL('');
    setModel('');
    onSaved();
  };

  return (
    <div className="px-5 py-4 border-b border-[#1e293b] bg-[#0a0e14] space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-bold text-violet-300">接入我的 AI（自带 key）</span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        填你自己的 OpenAI 兼容 key，即可用真 AI 勇哥对话。key 只存在你本地浏览器，
        通过服务端代理转发（你自付费，不占用免费额度）。留空保存即清除、回到免费规则版。
      </p>
      <div className="space-y-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key（sk-...）"
          className="w-full px-3 py-2 text-xs rounded bg-[#0d1117] border border-[#1e293b] text-slate-200 placeholder:text-slate-600 focus:border-violet-500/50 outline-none"
          autoComplete="off"
        />
        <input
          type="text"
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          placeholder="Base URL（可选，如 https://api.openai.com）"
          className="w-full px-3 py-2 text-xs rounded bg-[#0d1117] border border-[#1e293b] text-slate-200 placeholder:text-slate-600 focus:border-violet-500/50 outline-none"
          autoComplete="off"
        />
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="模型名（可选，如 gpt-4o-mini）"
          className="w-full px-3 py-2 text-xs rounded bg-[#0d1117] border border-[#1e293b] text-slate-200 placeholder:text-slate-600 focus:border-violet-500/50 outline-none"
          autoComplete="off"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          className="flex-1 py-2 text-xs font-bold rounded bg-violet-500/20 border border-violet-500/40 text-violet-300 hover:bg-violet-500/30 transition-colors"
        >
          保存并启用
        </button>
        <button
          onClick={handleClear}
          className="px-3 py-2 text-xs rounded bg-slate-500/10 border border-slate-500/30 text-slate-400 hover:bg-slate-500/20 transition-colors"
        >
          清除
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 text-xs rounded bg-slate-500/10 border border-slate-500/30 text-slate-400 hover:bg-slate-500/20 transition-colors"
        >
          收起
        </button>
      </div>
    </div>
  );
}

/** 诊断步骤卡片 */
function StepCard({ section }: { section: DiagnosisSection }) {
  const config = STEP_CONFIG[section.tag];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className={`p-4 border rounded-lg ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
        {!section.isComplete && (
          <Loader2 className="w-3 h-3 animate-spin text-slate-400 ml-auto" />
        )}
        {section.isComplete && (
          <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto" />
        )}
      </div>
      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
        {section.content}
        {!section.isComplete && <span className="animate-pulse text-orange-400">▌</span>}
      </p>
    </div>
  );
}

/** 提案列表 */
function ProposalList({ proposals }: { proposals: Proposal[] }) {
  return (
    <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-orange-400" />
        <span className="text-xs font-bold text-orange-400">勇哥的建议操作</span>
      </div>
      <div className="space-y-2">
        {proposals.map((p, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="text-orange-500 font-mono text-xs mt-0.5">{i + 1}.</span>
            <span className="text-slate-200">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 验证结果卡片 */
function VerificationCard({
  result,
  proposals,
  onApply,
  onClose,
}: {
  result: SimulationResult;
  proposals: Proposal[];
  onApply?: (proposals: Proposal[]) => void;
  onClose: () => void;
}) {
  const improved = result.improvement > 0;
  const profitable = result.isProfitable;

  return (
    <div className={`p-4 border rounded-lg ${
      profitable
        ? 'bg-emerald-500/10 border-emerald-500/30'
        : 'bg-red-500/10 border-red-500/30'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        {profitable ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
        <span className={`text-xs font-bold ${profitable ? 'text-emerald-400' : 'text-red-400'}`}>
          📊 供需模型验证结果
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div>
          <span className="text-xs text-slate-500">当前利润</span>
          <div className={`font-mono ${result.currentProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ¥{Math.round(result.currentProfit)}
          </div>
        </div>
        <div>
          <span className="text-xs text-slate-500">预测利润</span>
          <div className={`font-mono ${result.projectedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ¥{Math.round(result.projectedProfit)}
          </div>
        </div>
        <div>
          <span className="text-xs text-slate-500">预测收入</span>
          <div className="font-mono text-blue-400">
            ¥{Math.round(result.projectedRevenue)}
          </div>
        </div>
        <div>
          <span className="text-xs text-slate-500">利润变化</span>
          <div className="flex items-center gap-1">
            {improved ? (
              <TrendingUp className="w-3 h-3 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-400" />
            )}
            <span className={`font-mono ${improved ? 'text-emerald-400' : 'text-red-400'}`}>
              {improved ? '+' : ''}{Math.round(result.improvement)}
            </span>
          </div>
        </div>
      </div>

      {/* 恶化警告 */}
      {!improved && (
        <div className="flex items-center gap-2 text-xs text-red-400 mb-2 p-2 bg-red-500/10 rounded">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>勇哥这次的建议可能让情况更糟，利润预计下降 ¥{Math.abs(Math.round(result.improvement))}</span>
        </div>
      )}

      {/* 失败的提案 */}
      {result.failedProposals.length > 0 && (
        <div className="text-xs text-amber-400 mb-2">
          ⚠️ 无法应用: {result.failedProposals.join('、')}
        </div>
      )}

      {/* 一键采纳按钮 */}
      {onApply && proposals.length > 0 && result.appliedProposals.length > 0 && (
        <button
          className={`w-full mt-3 py-2 text-sm font-bold rounded-md transition-colors ${
            improved
              ? 'bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30'
              : 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
          }`}
          onClick={() => {
            onApply(proposals);
            onClose();
          }}
        >
          {improved
            ? `✅ 采纳勇哥建议（${result.appliedProposals.length}项操作）`
            : `⚠️ 风险采纳（利润预计下降 ¥${Math.abs(Math.round(result.improvement))}）`
          }
        </button>
      )}
    </div>
  );
}

export default CyberYongGe;
