// 三指标摘要组件（用于顶部状态栏）
// 显示曝光度+口碑+整洁度数值

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Eye, Heart, Sparkles } from 'lucide-react';
import type { GameState } from '@/types/game';

interface ExposurePanelProps {
  gameState: GameState;
}

export function ExposurePanel({ gameState }: ExposurePanelProps) {
  const { exposure, reputation, cleanliness } = gameState;

  return (
    <Card className="ark-card">
      <CardContent className="py-3 px-4">
        <div className="grid grid-cols-3 gap-4">
          {/* 曝光度 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Eye className="w-3 h-3 text-cyan-400" />
                曝光度
              </span>
              <span className="text-sm font-mono text-cyan-400">
                {Math.round(exposure)}<span className="text-[10px] text-slate-500">/100</span>
              </span>
            </div>
            <Progress value={exposure} className="h-1.5" />
          </div>
          {/* 口碑 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Heart className="w-3 h-3 text-pink-400" />
                口碑
              </span>
              <span className="text-sm font-mono text-pink-400">
                {Math.round(reputation)}<span className="text-[10px] text-slate-500">/100</span>
              </span>
            </div>
            <Progress value={reputation} className="h-1.5" />
          </div>
          {/* 整洁度 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                整洁度
              </span>
              <span className="text-sm font-mono text-emerald-400">
                {Math.round(cleanliness ?? 60)}<span className="text-[10px] text-slate-500">/100</span>
              </span>
            </div>
            <Progress value={cleanliness ?? 60} className="h-1.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ExposurePanel;
