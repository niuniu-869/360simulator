import { useRef, useState, useEffect } from 'react';
import type { GameState } from '@/types/game';
import { Trophy, RotateCcw, AlertCircle, Check, X, Camera, Link2, Image as ImageIcon } from 'lucide-react';
import { pitfalls } from '@/data/gameData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ShareCard } from '@/components/ShareCard';
import { AchievementsPanel } from '@/components/AchievementsPanel';
import { SCENARIO_BY_ID } from '@/data/scenarios';
import { pushToast } from '@/hooks/useToast';

interface GameResultProps {
  gameState: GameState;
  result: {
    isWin: boolean;
    reason: 'win' | 'bankrupt' | 'time_limit';
    winRoute?: GameState['winRoute'];
    totalProfit: number;
    totalInvestment: number;
    roi: number;
    cognitionLevel?: number;
    meetsStreakRequirement?: boolean;
    meetsReturnRequirement?: boolean;
    meetsBrandRequirement?: boolean;
    isNonLosing?: boolean;
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

  // ===== R3b 自传播 hooks（必须在任何 early return 之前，遵守 Hooks 规则） =====
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // 挑战链接：?scenario=&seed=（无 scenarioId 时省略该参数）；仅依赖 gameState，与 result 无关
  const buildChallengeUrl = (): string => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams();
    if (gameState.scenarioId) params.set('scenario', gameState.scenarioId);
    if (gameState.seed != null) params.set('seed', String(gameState.seed));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const challengeUrl = buildChallengeUrl();

  // 预览弹窗打开时尝试生成挑战链接二维码（qrcode 集成；失败则海报回退文字链接）
  useEffect(() => {
    if (!showPreview || qrDataUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const url = await QRCode.toDataURL(challengeUrl, {
          margin: 1,
          width: 184,
          color: { dark: '#0a0e17', light: '#ffffff' },
        });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        // 二维码生成失败：海报回退到文字链接，不阻断分享
        if (!cancelled) setQrDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showPreview, qrDataUrl, challengeUrl]);

  if (!result) return null;
  const routeLabel: Record<NonNullable<GameState['winRoute']>, string> = {
    return_on_investment: '回本胜利',
    growth: '增长胜利',
    reputation: '口碑胜利',
    survival: '生存胜利',
  };

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

  // ===== R3b 自传播：战报数据（hooks 已在上方声明） =====
  // 截短的勇哥金句（复用结局页胜/负金句，海报里更精炼）
  const shareQuote = result.isWin
    ? '连续盈利还回本了，算你有点本事！但真开店比这复杂一百倍，别一上来就梭哈。'
    : result.reason === 'bankrupt'
      ? '看到了吧？这就是不听劝的下场！真开店前，先 360 度转一圈，认清现实。'
      : '没撑到达标。位置、选品、人力，每一步都在劝退你——下次先认清现实。';

  const pitfallNames = encounteredPitfallData.map((p) => p.name);

  const scenarioName = gameState.scenarioId ? SCENARIO_BY_ID[gameState.scenarioId]?.name : undefined;
  const weeksAlive = gameState.profitHistory.length || gameState.currentWeek || 0;

  const outcomeWord = result.isWin ? `赚了${formatMoney(result.totalProfit)}` : `亏了${formatMoney(Math.abs(result.totalProfit))}`;
  const challengeText =
    `我在【${scenarioName ?? '360度转一圈模拟器'}】活了${weeksAlive}周，${outcomeWord}，你来挑战！` +
    ` ${challengeUrl} #360度转一圈 #创业避坑 #勇哥`;

  // 抓取 ShareCard DOM 导出 PNG blob
  const exportBlob = async (): Promise<Blob | null> => {
    const node = shareCardRef.current;
    if (!node || typeof window === 'undefined') return null;
    const { toBlob } = await import('html-to-image');
    return toBlob(node, {
      width: 540,
      height: 960,
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#0a0e17',
    });
  };

  // 「保存战报图」：移动端优先 Web Share（带图片），否则下载
  const handleSaveImage = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const blob = await exportBlob();
      if (!blob) throw new Error('生成图片失败');
      const file = new File([blob], '360战报.png', { type: 'image/png' });

      const navAny = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      const canShareFiles =
        typeof navAny.canShare === 'function' && navAny.canShare({ files: [file] });

      if (canShareFiles && typeof navAny.share === 'function') {
        try {
          await navAny.share({
            files: [file],
            title: '360° 转一圈模拟器战报',
            text: challengeText,
          });
          pushToast({ message: '已唤起分享', severity: 'success' });
          return;
        } catch (err) {
          // 用户取消分享不算错误，直接静默返回
          if (err instanceof DOMException && err.name === 'AbortError') return;
          // 其它失败 → 回退下载
        }
      }

      // 桌面/不支持 Web Share：触发下载
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = '360战报.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      pushToast({ message: '战报图已保存', detail: '快去小红书晒一晒', severity: 'success' });
    } catch {
      pushToast({ message: '生成战报图失败', detail: '请重试或截图保存', severity: 'danger' });
    } finally {
      setGenerating(false);
    }
  };

  // 「复制挑战链接」：链接 + 话题文案
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(challengeText);
      } else {
        // 兜底：textarea + execCommand
        const ta = document.createElement('textarea');
        ta.value = challengeText;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      pushToast({ message: '挑战链接已复制', detail: '发到群里喊人来挑战', severity: 'success' });
    } catch {
      pushToast({ message: '复制失败', detail: challengeUrl, severity: 'danger' });
    }
  };

  const shareResult: React.ComponentProps<typeof ShareCard>['result'] = {
    isWin: result.isWin,
    reason: result.reason,
    totalProfit: result.totalProfit,
    totalInvestment: result.totalInvestment,
    roi: result.roi,
    meetsReturnRequirement: result.meetsReturnRequirement,
  };

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
            ? `达成${result.winRoute ? routeLabel[result.winRoute] : '胜利'}：所有胜利路线都要求当前不赔钱，说明这不是烧钱换来的虚假繁荣。`
            : result.reason === 'bankrupt'
              ? '现金流断裂触发破产。先把店“活下去”，再谈扩张和营销。'
              : result.meetsStreakRequirement && !result.meetsReturnRequirement
                ? '这段时间能稳定赚钱，但还没回本。继续提升客流与毛利结构。'
                : '时间截止未达标：没能满足胜利条件。看看踩了哪些坑？'}
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
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

      {/* 本局成就墙（只显示已解锁，避免一墙问号） */}
      <AchievementsPanel currentRunUnlocked={gameState.unlockedAchievements ?? []} unlockedOnly />

      {/* 分享 + 重新开始 */}
      <div className="ark-card p-5 space-y-4">
        <div className="text-center">
          <h3 className="font-bold text-white">晒出你的战报</h3>
          <p className="text-xs text-slate-400 mt-1">
            一张图说清你这局有多离谱，发小红书喊朋友来挑战同款剧本
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            className="ark-button ark-button-primary px-6 py-3 flex items-center justify-center gap-2 disabled:opacity-60"
            onClick={handleSaveImage}
            disabled={generating}
          >
            <Camera className="w-4 h-4" />
            {generating ? '生成中…' : '📸 保存战报图'}
          </button>
          <button
            className="ark-button px-6 py-3 flex items-center justify-center gap-2"
            onClick={handleCopyLink}
          >
            <Link2 className="w-4 h-4" />
            🔗 复制挑战链接
          </button>
          <button
            className="ark-button px-6 py-3 flex items-center justify-center gap-2"
            onClick={() => setShowPreview(true)}
          >
            <ImageIcon className="w-4 h-4" />
            预览战报
          </button>
        </div>
        <div className="flex justify-center pt-2">
          <button
            className="ark-button ark-button-primary px-12 py-4 text-lg flex items-center gap-3"
            onClick={onRestart}
          >
            <RotateCcw className="w-5 h-5" />
            重新开始
          </button>
        </div>
      </div>

      {/* 战报海报：常驻屏幕外，供 html-to-image 抓取（导出不依赖弹窗是否打开） */}
      <ShareCard
        ref={shareCardRef}
        gameState={gameState}
        result={shareResult}
        pitfallNames={pitfallNames}
        yongGeQuote={shareQuote}
        qrDataUrl={qrDataUrl}
        challengeUrl={challengeUrl}
      />

      {/* 预览弹窗 */}
      {showPreview && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4 overflow-auto"
          onClick={() => setShowPreview(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-3 -right-3 z-10 bg-[#1e293b] border border-slate-600 rounded-full p-1.5 text-slate-300 hover:text-white"
              onClick={() => setShowPreview(false)}
              aria-label="关闭预览"
            >
              <X className="w-5 h-5" />
            </button>
            {/* 预览缩放版（origin 在容器内时不能用 fixed 海报本体，故渲染一个克隆视图） */}
            <div
              style={{
                width: 270,
                height: 480,
                overflow: 'hidden',
                border: '1px solid #1e293b',
              }}
            >
              <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left' }}>
                <ShareCard
                  preview
                  gameState={gameState}
                  result={shareResult}
                  pitfallNames={pitfallNames}
                  yongGeQuote={shareQuote}
                  qrDataUrl={qrDataUrl}
                  challengeUrl={challengeUrl}
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2 justify-center">
              <button
                className="ark-button ark-button-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-60"
                onClick={handleSaveImage}
                disabled={generating}
              >
                <Camera className="w-4 h-4" />
                {generating ? '生成中…' : '保存图片'}
              </button>
              <button
                className="ark-button px-5 py-2.5 text-sm flex items-center gap-2"
                onClick={handleCopyLink}
              >
                <Link2 className="w-4 h-4" />
                复制链接
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
