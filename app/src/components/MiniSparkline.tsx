/**
 * MiniSparkline.tsx — Header 下方紧凑趋势小图（Phase 5）
 *
 * 用 recharts ResponsiveContainer 渲染 8 周数据，紧凑、无坐标轴。
 */

import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts';

interface MiniSparklineProps {
  label: string;
  data: number[];
  color?: string;
  formatValue?: (v: number) => string;
}

export function MiniSparkline({
  label,
  data,
  color = '#34d399',
  formatValue,
}: MiniSparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-[10px] text-slate-500 px-2 py-1 border border-[#1e293b] bg-[#0a0e17]">
        {label}: —
      </div>
    );
  }
  const last = data[data.length - 1];
  const first = data[0];
  const delta = last - first;
  const rows = data.map((v, i) => ({ x: i, v }));
  return (
    <div className="px-2 py-1 border border-[#1e293b] bg-[#0a0e17] flex items-center gap-2 min-w-[120px]">
      <div className="flex flex-col">
        <div className="text-[10px] text-slate-500 leading-none">{label}</div>
        <div className="text-xs font-mono leading-tight" style={{ color }}>
          {formatValue ? formatValue(last) : Math.round(last)}
          <span className={`ml-1 text-[9px] ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {delta >= 0 ? '↑' : '↓'}
          </span>
        </div>
      </div>
      <div className="flex-1 h-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 1, right: 0, bottom: 1, left: 0 }}>
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Tooltip
              cursor={false}
              wrapperStyle={{ fontSize: 10 }}
              contentStyle={{ background: '#0a0e17', border: '1px solid #1e293b', padding: '2px 6px' }}
              labelFormatter={() => ''}
              formatter={(v: number | string) => [formatValue ? formatValue(Number(v)) : Math.round(Number(v)), label]}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
