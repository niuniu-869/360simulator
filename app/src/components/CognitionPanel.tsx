// 认知系统面板组件

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { COGNITION_LEVELS, PANEL_UNLOCK_CONFIG } from '@/data/cognitionData';
import { WIN_STREAK } from '@/lib/gameEngine';
import type { CognitionState, PanelId } from '@/types/game';

interface CognitionPanelProps {
  cognition: CognitionState;
  consecutiveProfits?: number;
  currentProfit?: number;
  cumulativeProfit?: number;
  totalInvestment?: number;
}

export function CognitionPanel({
  cognition,
  consecutiveProfits = 0,
  cumulativeProfit = 0,
  totalInvestment = 0,
}: CognitionPanelProps) {
  const levelConfig = COGNITION_LEVELS.find(l => l.level === cognition.level);
  const nextLevelConfig = COGNITION_LEVELS.find(l => l.level === cognition.level + 1);
  const progress = cognition.expToNext > 0
    ? (cognition.exp / cognition.expToNext) * 100
    : 100;

  // 当前目标提示
  const getGoalText = () => {
    if (consecutiveProfits >= WIN_STREAK && cumulativeProfit < totalInvestment) {
      return `已连续盈利${WIN_STREAK}周，努力回本！`;
    }
    if (consecutiveProfits > 0) {
      return `连续盈利 ${consecutiveProfits}/${WIN_STREAK} 周，继续保持！`;
    }
    return '先让店铺活下来，争取本周盈利';
  };

  // 下一级解锁的面板
  const getNextUnlock = () => {
    const nextLevel = cognition.level + 1;
    if (nextLevel > 5) return null;
    const panelNames: Record<PanelId, string> = {
      operating: '经营面板',
      staff: '人员面板',
      inventory: '库存管理面板',
      marketing: '营销活动面板',
      finance: '财务看板',
      supplydemand: '供需分析面板',
    };
    const unlocks = (Object.entries(PANEL_UNLOCK_CONFIG) as [PanelId, number][])
      .filter(([, level]) => level === nextLevel)
      .map(([id]) => panelNames[id]);
    return unlocks.length > 0 ? unlocks.join('、') : null;
  };

  return (
    <Card className="ark-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <span>{levelConfig?.icon}</span>
          <span>认知等级</span>
          <Badge variant="outline" className="ml-auto text-orange-400 border-orange-500/50">
            Lv.{cognition.level}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 当前目标提示 */}
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded">
          <p className="text-xs text-amber-300 font-medium">
            🎯 {getGoalText()}
          </p>
        </div>

        {/* 等级信息 */}
        <div className="p-2 bg-slate-800/50 rounded">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-white">{levelConfig?.name}</span>
            <span className="text-xs text-slate-400">"{levelConfig?.title}"</span>
          </div>
        </div>

        {/* 经验进度 */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>经验值</span>
            <span>{cognition.exp} / {cognition.expToNext}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* 下一级解锁预览 */}
        {nextLevelConfig && (
          <div className="text-xs space-y-1">
            <div className="text-slate-500">
              <span>下一级: </span>
              <span className="text-slate-400">{nextLevelConfig.icon} {nextLevelConfig.name}</span>
              <span className="text-slate-500 ml-1">
                (还需 {cognition.expToNext - cognition.exp} 经验)
              </span>
            </div>
            {getNextUnlock() && (
              <div className="text-blue-400">
                🔓 下一级解锁: {getNextUnlock()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CognitionPanel;
