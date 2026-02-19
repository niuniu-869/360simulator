// 店铺状态指示器 — HTML absolute overlay，避免 SVG 坐标冲突

interface StoreIndicatorsProps {
  width: number;
  height: number;
  chefCount: number;
  maxChefs: number;
  waiterCount: number;
  cleanerCount: number;
  deliveryPlatformCount: number;
  avgPlatformRating: number;
  deliveryOrderRate: number;
  hasActiveMarketing: boolean;
  cleanliness: number;
  exposure: number;
  occupancyRate: number;
}

export function StoreIndicators({
  width,
  height,
  chefCount,
  maxChefs,
  waiterCount,
  cleanerCount,
  deliveryPlatformCount,
  avgPlatformRating,
  deliveryOrderRate,
  hasActiveMarketing,
  cleanliness,
  exposure,
  occupancyRate,
}: StoreIndicatorsProps) {
  const trafficValue = Math.max(0, Math.min(100, Math.round(exposure)));
  const diningValue = Math.max(0, Math.min(100, Math.round(occupancyRate * 100)));
  const cleanValue = Math.max(0, Math.min(100, Math.round(cleanliness)));
  const deliveryValue = Math.max(0, Math.min(100, Math.round(deliveryOrderRate * 100)));
  const railOffset = Math.max(148, Math.round(width * 0.52));
  const railWidth = 132;
  const metricRows = [
    { label: '店外客流', value: trafficValue, color: '#f59e0b' },
    { label: '堂食热度', value: diningValue, color: '#f97316' },
    { label: '店面整洁', value: cleanValue, color: cleanValue < 40 ? '#ef4444' : '#06b6d4' },
  ];

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width, height, overflow: 'visible' }}
    >
      {/* 左侧：经营态势看板（外置，避免遮挡店铺） */}
      <div
        className="absolute border border-slate-700/75 bg-slate-950/78 px-2 py-1.5"
        style={{ top: 6, left: -railOffset, width: railWidth }}
      >
        <div className="mb-1 flex items-center justify-between border-b border-slate-700/70 pb-1">
          <span className="text-[9px] tracking-wide text-slate-200">经营态势</span>
          {hasActiveMarketing && (
            <span className="sv-marketing-pulse text-[8px] text-orange-300">营销中</span>
          )}
        </div>
        <div className="space-y-1">
          {metricRows.map(metric => (
            <div key={metric.label}>
              <div className="mb-0.5 flex items-center justify-between text-[8px] text-slate-300">
                <span>{metric.label}</span>
                <span className="font-mono text-slate-200">{metric.value}%</span>
              </div>
              <div className="h-1 bg-slate-800/85">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${metric.value}%`,
                    background: `linear-gradient(90deg, ${metric.color}99, ${metric.color})`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧：员工编制（外置） */}
      <div className="absolute flex flex-col items-end gap-1" style={{ top: 6, right: -railOffset + 20 }}>
        <div className="border border-orange-500/35 bg-slate-950/80 px-1.5 py-0.5 text-[8px] text-slate-200">
          厨师 {chefCount}/{maxChefs}
        </div>
        <div className="border border-cyan-500/35 bg-slate-950/80 px-1.5 py-0.5 text-[8px] text-slate-200">
          前场 {waiterCount}人
        </div>
        <div className="border border-teal-500/35 bg-slate-950/80 px-1.5 py-0.5 text-[8px] text-slate-200">
          保洁 {cleanerCount}人
        </div>
        {cleanliness < 40 && (
          <div className="border border-red-500/45 bg-red-950/75 px-1.5 py-0.5 text-[8px] text-red-300 sv-warning-blink">
            卫生预警
          </div>
        )}
      </div>

      {/* 左下：进店转化提示（外置） */}
      <div
        className="absolute border border-amber-500/30 bg-slate-950/78 px-2 py-1 text-[8px] text-amber-200"
        style={{ left: -railOffset, bottom: 8, width: railWidth }}
      >
        进店热度 {Math.round((trafficValue * 0.4 + diningValue * 0.6))}%
      </div>

      {/* 右下：外卖运力（外置） */}
      {deliveryPlatformCount > 0 && (
        <div
          className="absolute border border-cyan-500/35 bg-slate-950/80 px-2 py-1"
          style={{ right: -railOffset, bottom: 8, width: railWidth }}
        >
          <div className="text-[8px] text-cyan-200">外卖运力</div>
          <div className="mt-0.5 flex items-center gap-2 text-[8px] text-slate-200">
            <span>平台 {deliveryPlatformCount}</span>
            <span className="font-mono">评分 {avgPlatformRating.toFixed(1)}</span>
          </div>
          <div className="mt-0.5 h-1 bg-slate-800/85">
            <div
              className="h-full transition-all"
              style={{
                width: `${deliveryValue}%`,
                background: 'linear-gradient(90deg, #06b6d499, #06b6d4)',
              }}
            />
          </div>
          <div className="mt-0.5 text-right text-[8px] font-mono text-cyan-200">
            外卖占比 {deliveryValue}%
          </div>
        </div>
      )}
    </div>
  );
}
