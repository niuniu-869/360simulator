import type { GameAction } from '@/lib/gameActionTypes';

export type FindingSeverity = 'info' | 'warning' | 'critical';

export interface AutomationFinding {
  severity: FindingSeverity;
  category: 'engine_bug' | 'balance' | 'operation';
  code: string;
  message: string;
  suspectedModule?: string;
  week?: number;
}

export interface SetupBlueprint {
  id: string;
  name: string;
  description: string;
  brandId: string;
  locationId: string;
  addressId: string;
  decorationId: string;
  productIds: string[];
  staffPlan: Array<{ staffTypeId: string; task: string }>;
  startSeason?: 'spring' | 'summer' | 'autumn' | 'winter';
}

export interface DecisionSnapshot {
  week: number;
  planId: string;
  rationale: string;
  actions: GameAction[];
  score: number;
  profitBefore: number;
  profitAfter: number;
  fulfillmentBefore: number;
  fulfillmentAfter: number;
  failedActions: string[];
}

export interface RunSummary {
  scenarioId: string;
  scenarioName: string;
  seed: number;
  finalWeek: number;
  isWin: boolean;
  isBankrupt: boolean;
  finalCash: number;
  cumulativeProfit: number;
  roi: number;
  avgProfit: number;
  avgFulfillment: number;
  week20DualTopRate: boolean;
  lowFulfillmentExposureRiseWeeks: number;
  findings: AutomationFinding[];
  decisions: DecisionSnapshot[];
}

export interface AggregateSummary {
  totalRuns: number;
  winRate: number;
  bankruptRate: number;
  averageFinalCash: number;
  averageRoi: number;
  averageProfit: number;
  averageFulfillment: number;
  dualTopByWeek20Rate: number;
  lowFulfillmentExposureRiseRate: number;
  findingCounts: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface AutomationReport {
  generatedAt: string;
  config: {
    mode: 'quick' | 'full';
    maxWeeks: number;
    seedsPerScenario: number;
    baseSeed: number;
  };
  aggregate: AggregateSummary;
  balanceAlerts: AutomationFinding[];
  runs: RunSummary[];
}
