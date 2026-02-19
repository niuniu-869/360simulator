import { useState } from 'react';
import type { Season } from '@/types/game';
import { Flower2, Sun, Leaf, Snowflake, Play } from 'lucide-react';

interface SeasonSelectDialogProps {
  open: boolean;
  onSelect: (season: Season) => void;
  onCancel: () => void;
}

const SEASONS: {
  id: Season;
  name: string;
  icon: typeof Flower2;
  months: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    id: 'spring',
    name: '春季',
    icon: Flower2,
    months: '3-5月',
    description: '万物复苏，客流回暖',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/50',
  },
  {
    id: 'summer',
    name: '夏季',
    icon: Sun,
    months: '6-8月',
    description: '饮品旺季，客流最高',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/50',
  },
  {
    id: 'autumn',
    name: '秋季',
    icon: Leaf,
    months: '9-11月',
    description: '平稳过渡，需求均衡',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/50',
  },
  {
    id: 'winter',
    name: '冬季',
    icon: Snowflake,
    months: '12-2月',
    description: '冷饮淡季，热饮上升',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/50',
  },
];

export function SeasonSelectDialog({ open, onSelect, onCancel }: SeasonSelectDialogProps) {
  const [selected, setSelected] = useState<Season | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-[#151d2b] border border-[#1e293b] p-6 rounded-lg shadow-2xl">
        <h2 className="text-xl font-bold text-white text-center mb-2">选择开店季节</h2>
        <p className="text-sm text-slate-400 text-center mb-6">
          不同季节影响客流量和产品需求
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {SEASONS.map((season) => {
            const Icon = season.icon;
            const isSelected = selected === season.id;
            return (
              <div
                key={season.id}
                className={`
                  p-4 border rounded-lg cursor-pointer transition-all duration-200
                  ${isSelected
                    ? `${season.borderColor} ${season.bgColor}`
                    : 'border-[#1e293b] bg-[#0a0e17] hover:border-slate-600'
                  }
                `}
                onClick={() => setSelected(season.id)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-5 h-5 ${season.color}`} />
                  <span className={`font-bold ${isSelected ? season.color : 'text-white'}`}>
                    {season.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-1">{season.months}</p>
                <p className="text-xs text-slate-400">{season.description}</p>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            className="flex-1 ark-button py-3"
            onClick={onCancel}
          >
            返回
          </button>
          <button
            className="flex-1 ark-button ark-button-primary py-3 flex items-center justify-center gap-2"
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
          >
            <Play className="w-4 h-4" />
            确认开店
          </button>
        </div>
      </div>
    </div>
  );
}
