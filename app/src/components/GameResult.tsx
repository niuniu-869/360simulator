import type { GameState } from '@/types/game';
import { Trophy, RotateCcw, AlertCircle, Check, X } from 'lucide-react';
import { pitfalls } from '@/data/gameData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from 'recharts';

interface GameResultProps {
  gameState: GameState;
  result: {
    isWin: boolean;
    reason: 'win' | 'bankrupt' | 'time_limit';
    totalProfit: number;
    totalInvestment: number;
    roi: number;
    cognitionLevel?: number;
    meetsStreakRequirement?: boolean;
    meetsReturnRequirement?: boolean;
    meetsBrandRequirement?: boolean;
  } | null;
  onRestart: () => void;
}

export function GameResult({ gameState, result, onRestart }: GameResultProps) {

  const formatMoney = (amount: number) => {
    if (amount >= 10000) {
      return `¥${(amount / 10000).toFixed(1)}万`;
    }
    return `¥${Math.round(amount).toLocaleString()}`;
  };

  if (!result) return null;

  // 分析踩坑情况
  const encounteredPitfalls: string[] = [];
  
  if (gameState.selectedBrand?.riskLevel === 'high') {
    encounteredPitfalls.push('fake_franchise');
  }
  
  if (gameState.selectedLocation && gameState.selectedProducts.length > 0) {
    const location = gameState.selectedLocation;
    const hasStudentProduct = gameState.selectedProducts.some(p => p.appeal.students > 70);
    const hasOfficeProduct = gameState.selectedProducts.some(p => p.appeal.office > 70);
    
    if ((location.type === 'school' && !hasStudentProduct) ||
        (location.type === 'office' && !hasOfficeProduct)) {
      encounteredPitfalls.push('bad_location');
    }
  }
  
  if (gameState.selectedProducts.length === 1) {
    encounteredPitfalls.push('single_product');
  }
  
  if (gameState.staff.length > 6) {
    encounteredPitfalls.push('over_staff');
  }
  
  const monthlyRent = (gameState.selectedLocation?.rentPerSqm || 0) * gameState.storeArea;
  if (monthlyRent > 10000 && gameState.selectedDecoration && gameState.selectedDecoration.level >= 4) {
    encounteredPitfalls.push('luxury_decor');
  }

  const encounteredPitfallData = pitfalls.filter(p => encounteredPitfalls.includes(p.id));

  return (
    <div className="space-y-6">
      {/* 结果展示 */}
      <div className={`ark-card p-8 text-center ${result.isWin ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
        <div className={`
          w-24 h-24 mx-auto mb-6 flex items-center justify-center
          ${result.isWin ? 'bg-emerald-500/20' : 'bg-red-500/20'}
        `}>
          {result.isWin ? (
            <Trophy className="w-12 h-12 text-emerald-500" />
          ) : (
            <X className="w-12 h-12 text-red-500" />
          )}
        </div>
        
        <h2 className={`text-3xl font-bold mb-2 ${result.isWin ? 'text-emerald-400' : 'text-red-400'}`}>
          {result.isWin ? '挑战成功！' : (result.reason === 'bankrupt' ? '破产了' : '时间截止：未达标')}
        </h2>
        
        <p className="text-slate-400 mb-6">
          {result.isWin
            ? '达成胜利条件：回本 + 连续6周盈利 + 知名度/口碑达标。你已经摸到餐饮经营的门道了！'
            : result.reason === 'bankrupt'
              ? '现金流断裂触发破产。先把店“活下去”，再谈扩张和营销。'
              : result.meetsStreakRequirement && !result.meetsReturnRequirement
                ? '这段时间能稳定赚钱，但还没回本。继续提升客流与毛利结构。'
                : '时间截止未达标：没能满足胜利条件。看看踩了哪些坑？'}
        </p>
        
        <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
          <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
            <p className="text-xs text-slate-400">总利润</p>
            <p className={`text-xl font-mono font-bold ${result.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatMoney(result.totalProfit)}
            </p>
          </div>
          <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
            <p className="text-xs text-slate-400">总投资</p>
            <p className="text-xl font-mono font-bold text-orange-400">
              {formatMoney(result.totalInvestment)}
            </p>
          </div>
          <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
            <p className="text-xs text-slate-400">投资回报率</p>
            <p className={`text-xl font-mono font-bold ${result.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.roi.toFixed(1)}%
            </p>
          </div>
          <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
            <p className="text-xs text-slate-400">回本进度</p>
            <p className={`text-xl font-mono font-bold ${result.meetsReturnRequirement ? 'text-emerald-400' : 'text-amber-400'}`}>
              {result.totalInvestment > 0
                ? `${Math.min(100, (result.totalProfit / result.totalInvestment * 100)).toFixed(0)}%`
                : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {result.meetsReturnRequirement ? '已回本 ✓' : '未回本'}
            </p>
          </div>
        </div>
      </div>

      {/* 利润趋势 */}
      <div className="ark-card p-5">
        <h3 className="font-bold text-white mb-4">
          {gameState.profitHistory.length}周利润趋势
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={gameState.profitHistory.map((profit, i) => ({ week: `${i + 1}`, profit }))} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 10000 || v <= -10000 ? `${(v / 10000).toFixed(1)}万` : `${v}`} />
            <Tooltip
              contentStyle={{ background: '#0a0e17', border: '1px solid #1e293b', borderRadius: 0, fontSize: 12 }}
              labelFormatter={(label: string) => `第${label}周`}
              formatter={(value: number) => [formatMoney(value), '利润']}
            />
            <ReferenceLine y={0} stroke="#1e293b" />
            <Bar dataKey="profit" radius={[2, 2, 0, 0]}>
              {gameState.profitHistory.map((profit, i) => (
                <Cell key={i} fill={profit >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 踩坑分析 */}
      <div className="ark-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            踩坑分析
          </h3>
          <span className="text-sm text-slate-400">
            发现 {encounteredPitfallData.length} 个问题
          </span>
        </div>
        
        {encounteredPitfallData.length > 0 ? (
          <div className="space-y-3">
            {encounteredPitfallData.map((pitfall) => (
              <div key={pitfall.id} className="bg-[#0a0e17] p-4 border-l-4 border-red-500">
                <div className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-red-400">{pitfall.name}</h4>
                    <p className="text-sm text-slate-300 mt-1">{pitfall.description}</p>
                    <p className="text-xs text-amber-400 mt-2">
                      <strong>如何避免：</strong>{pitfall.howToAvoid}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 italic">
                      "{pitfall.realCase}"
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/50 p-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Check className="w-5 h-5" />
              <span className="font-bold">恭喜！你没有踩到明显的坑</span>
            </div>
            <p className="text-sm text-slate-300 mt-2">
              你的决策相对合理，但市场环境复杂，仍需持续优化。
            </p>
          </div>
        )}
      </div>

      {/* 勇哥总结 */}
      <div className="bg-orange-500/10 border border-orange-500/50 p-5">
        <h3 className="font-bold text-orange-400 mb-3">勇哥总结</h3>
        <p className="text-sm text-slate-300">
          {result.isWin 
            ? '「不错嘛哥们，连续6周盈利还回本了，算你有点本事！但记住，游戏是游戏，真开店比这复杂一百倍。多少人在我这连麦，投了几百万血本无归。你要是真想创业，先花399买个课学习一下，别一上来就梭哈！」'
            : '「看到了吧？这就是不听劝的下场！我直播间每天多少人，本来加盟蜜雪冰城，结果打到快招公司去了。选址老师选的、总部说都包的、我觉得有市场...这些话我耳朵都听出茧子了。真开店前，来，360度转一圈，先认清现实！」'
          }
        </p>
      </div>

      {/* 重新开始 */}
      <div className="flex justify-center">
        <button
          className="ark-button ark-button-primary px-12 py-4 text-lg flex items-center gap-3"
          onClick={onRestart}
        >
          <RotateCcw className="w-5 h-5" />
          重新开始
        </button>
      </div>
    </div>
  );
}
