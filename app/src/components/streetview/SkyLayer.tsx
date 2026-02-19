import type { SolarTerm } from '@/data/streetviewData';
import { WeatherParticles } from './WeatherParticles';

interface SkyLayerProps {
  solarTerm: SolarTerm;
  currentWeek: number;
  totalWeeks: number;
}

export function SkyLayer({ solarTerm, currentWeek, totalWeeks }: SkyLayerProps) {
  return (
    <div
      className="relative w-full shrink-0"
      style={{
        height: '80px',
        background: solarTerm.skyGradient,
      }}
    >
      {/* 天气粒子 - 放在最底层但在天空背景之上 */}
      <WeatherParticles solarTerm={solarTerm} />

      {/* 节气名称 + 氛围 */}
      <div className="absolute top-2 left-3 flex items-center gap-1.5 z-20">
        <span className="text-base">{solarTerm.ambientEmoji}</span>
        <span className="text-xs font-bold text-slate-200/90">{solarTerm.name}</span>
        <span className="text-[10px] text-slate-300/60">· {solarTerm.description}</span>
      </div>

      {/* 周数显示 */}
      <div className="absolute top-2 right-3 flex items-center gap-1 z-20">
        <span className="text-[10px] text-slate-300/60">第</span>
        <span className="text-xs font-mono text-orange-400/90">{currentWeek}</span>
        <span className="text-[10px] text-slate-300/60">/ {totalWeeks} 周</span>
      </div>

      {/* 底部渐变过渡（与下方面板融合） */}
      <div
        className="absolute bottom-0 left-0 right-0 h-4"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(12,18,32,0.72) 100%)',
        }}
      />
    </div>
  );
}
