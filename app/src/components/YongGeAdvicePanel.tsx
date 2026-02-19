import type { GameState } from '@/types/game';
import { yongGeAdvices } from '@/data/gameData';
import { AlertTriangle, AlertCircle, MessageCircle } from 'lucide-react';

interface YongGeAdvicePanelProps {
  gameState: GameState;
}

// 根据游戏状态判断触发条件
function evaluateTriggerCondition(condition: string, gameState: GameState): boolean {
  switch (condition) {
    case 'selectedHighRiskBrand':
      return gameState.selectedBrand?.isQuickFranchise === true;

    case 'badLocation':
      {
        if (!gameState.selectedLocation || gameState.selectedProducts.length === 0) return false;
        const location = gameState.selectedLocation;
        const hasStudentProduct = gameState.selectedProducts.some(p => p.appeal.students > 70);
        const hasOfficeProduct = gameState.selectedProducts.some(p => p.appeal.office > 70);
        return (location.type === 'school' && !hasStudentProduct) ||
               (location.type === 'office' && !hasOfficeProduct);
      }

    case 'overStaff':
      return gameState.staff.length > 6;

    case 'singleProduct':
      return gameState.selectedProducts.length === 1;

    case 'fakeFranchise':
      return gameState.selectedBrand?.isQuickFranchise === true;

    case 'lowMargin':
      {
        if (gameState.selectedProducts.length === 0) return false;
        const avgMargin = gameState.selectedProducts.reduce(
          (sum, p) => sum + (1 - p.baseCost / p.basePrice), 0
        ) / gameState.selectedProducts.length;
        return avgMargin < 0.3;
      }

    case 'competeWithGiant':
      {
        const playerCategories: string[] = gameState.selectedProducts.map(p => p.category);
        const directCompetitors = (gameState.nearbyShops || []).filter(
          s => !s.isClosing && playerCategories.includes(s.shopCategory)
        );
        return directCompetitors.length >= 3;
      }

    case 'unsaveable':
      return gameState.cash < 0 && (gameState.consecutiveProfits || 0) === 0;

    default:
      return false;
  }
}

export function YongGeAdvicePanel({ gameState }: YongGeAdvicePanelProps) {
  // 获取当前触发的建议
  const triggeredAdvices = yongGeAdvices.filter(
    advice => evaluateTriggerCondition(advice.triggerCondition, gameState)
  );

  if (triggeredAdvices.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-orange-500">
        <MessageCircle className="w-5 h-5" />
        <span className="font-bold">勇哥提醒</span>
        <span className="text-xs text-slate-400">({triggeredAdvices.length}条)</span>
      </div>

      {triggeredAdvices.map((advice) => (
        <div
          key={advice.id}
          className={`p-4 border-l-4 ${
            advice.severity === 'critical'
              ? 'bg-red-500/10 border-red-500'
              : 'bg-amber-500/10 border-amber-500'
          }`}
        >
          <div className="flex items-start gap-3">
            {advice.severity === 'critical' ? (
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className={`font-bold ${
                advice.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {advice.title}
              </h4>
              <p className="text-sm text-slate-300 mt-1 italic">
                「{advice.content}」
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
