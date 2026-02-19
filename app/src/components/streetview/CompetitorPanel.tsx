// 商圈竞争态势面板 - 列表形式展示周边店铺
import { useMemo, useState } from 'react';
import type { NearbyShop, RingId, ShopCategory } from '@/types/game';
import { SHOP_CATEGORY_COLORS, SHOP_CATEGORY_EMOJIS } from '@/data/streetviewData';
import './streetview.css';

interface CompetitorPanelProps {
  nearbyShops: NearbyShop[];
  playerExposure: number;
  playerReputation: number;
}

// 距离环配置
const RING_INFO: Record<RingId, { label: string; distance: string; color: string }> = {
  ring0: { label: '门前', distance: '300m', color: '#f97316' },
  ring1: { label: '步行', distance: '1km', color: '#fb923c' },
  ring2: { label: '骑行', distance: '3km', color: '#fdba74' },
  ring3: { label: '外卖', distance: '5km', color: '#fed7aa' },
};

// 品类中文名
const CATEGORY_NAMES: Record<ShopCategory, string> = {
  drink: '饮品',
  food: '小吃',
  snack: '甜点',
  meal: '正餐',
  grocery: '便利',
  service: '服务',
};

// 竞争强度计算
function getCompetitionLevel(shops: NearbyShop[]): { level: string; color: string; description: string } {
  const activeShops = shops.filter(s => !s.isClosing);
  const chainCount = activeShops.filter(s => s.brandType === 'chain').length;
  const avgExposure = activeShops.length > 0
    ? activeShops.reduce((sum, s) => sum + s.exposure, 0) / activeShops.length
    : 0;

  if (chainCount >= 3 || avgExposure > 70) {
    return { level: '激烈', color: '#ef4444', description: '连锁品牌扎堆，需差异化竞争' };
  }
  if (chainCount >= 1 || avgExposure > 50) {
    return { level: '中等', color: '#f59e0b', description: '有竞争压力，注意定位' };
  }
  if (activeShops.length > 3) {
    return { level: '一般', color: '#22c55e', description: '竞争适中，机会与挑战并存' };
  }
  return { level: '宽松', color: '#3b82f6', description: '竞争较少，但需警惕客流' };
}

// 单个店铺卡片
function ShopCard({ shop }: { shop: NearbyShop }) {
  const [expanded, setExpanded] = useState(false);
  const ringInfo = RING_INFO[shop.ring] || RING_INFO.ring1;
  const categoryColor = SHOP_CATEGORY_COLORS[shop.shopCategory] || '#94a3b8';
  const categoryEmoji = SHOP_CATEGORY_EMOJIS[shop.shopCategory] || '🏪';
  const categoryName = CATEGORY_NAMES[shop.shopCategory] || '其他';

  return (
    <div
      className={`
        relative px-2.5 py-2 rounded-lg border transition-all cursor-pointer
        ${shop.isClosing ? 'opacity-40 grayscale' : 'hover:bg-slate-800/50'}
      `}
      style={{
        borderColor: shop.isClosing ? '#374151' : `${categoryColor}30`,
        background: shop.isClosing ? 'transparent' : `${categoryColor}08`,
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        {/* 品类图标 */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${categoryColor}20` }}
        >
          <span className="text-base">{categoryEmoji}</span>
        </div>

        {/* 店铺信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-200 truncate">{shop.name}</span>
            {shop.brandType === 'chain' && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400">连锁</span>
            )}
            {shop.isClosing && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">关门</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500">{categoryName}</span>
            <span className="text-[10px]" style={{ color: ringInfo.color }}>
              {ringInfo.distance}
            </span>
            {shop.hasDelivery && (
              <span className="text-[10px] text-cyan-400">🛵外卖</span>
            )}
          </div>
        </div>

        {/* 曝光度指示器 */}
        <div className="flex flex-col items-end shrink-0">
          <div className="flex items-center gap-1">
            <div className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, shop.exposure)}%`,
                  background: `linear-gradient(90deg, ${categoryColor}80, ${categoryColor})`,
                }}
              />
            </div>
          </div>
          <span className="text-[9px] text-slate-500 mt-0.5">曝光 {Math.round(shop.exposure)}</span>
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && !shop.isClosing && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 text-[10px] text-slate-400 grid grid-cols-2 gap-1">
          <div>装修等级: Lv{shop.decorationLevel}</div>
          <div>定位: {shop.brandTier === 'budget' ? '平价' : shop.brandTier === 'premium' ? '高端' : '标准'}</div>
          {shop.products && shop.products.length > 0 && (
            <div className="col-span-2">
              主营: {shop.products.slice(0, 3).map(p => p.name).join('、')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 距离分布条
function DistanceBar({ nearbyShops }: { nearbyShops: NearbyShop[] }) {
  const distribution = useMemo(() => {
    const counts: Record<RingId, number> = { ring0: 0, ring1: 0, ring2: 0, ring3: 0 };
    nearbyShops.filter(s => !s.isClosing).forEach(s => {
      if (counts[s.ring] !== undefined) counts[s.ring]++;
    });
    return counts;
  }, [nearbyShops]);

  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center gap-1 text-[9px]">
      {(['ring0', 'ring1', 'ring2'] as RingId[]).map(ring => {
        const info = RING_INFO[ring];
        const count = distribution[ring];
        const width = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={ring} className="flex items-center gap-1">
            <div
              className="h-2 rounded-sm transition-all"
              style={{
                width: `${Math.max(8, width * 0.6)}px`,
                background: info.color,
                opacity: count > 0 ? 1 : 0.3,
              }}
            />
            <span style={{ color: info.color }}>{info.distance}</span>
            <span className="text-slate-500">({count})</span>
          </div>
        );
      })}
    </div>
  );
}

export function CompetitorPanel({ nearbyShops, playerExposure, playerReputation }: CompetitorPanelProps) {
  const [filter, setFilter] = useState<'all' | 'chain' | 'nearby'>('all');

  // 过滤和排序店铺
  const filteredShops = useMemo(() => {
    let shops = [...nearbyShops];

    if (filter === 'chain') {
      shops = shops.filter(s => s.brandType === 'chain');
    } else if (filter === 'nearby') {
      shops = shops.filter(s => s.ring === 'ring0' || s.ring === 'ring1');
    }

    // 按距离和曝光度排序
    const ringOrder: Record<RingId, number> = { ring0: 0, ring1: 1, ring2: 2, ring3: 3 };
    return shops.sort((a, b) => {
      if (a.isClosing !== b.isClosing) return a.isClosing ? 1 : -1;
      const ringDiff = ringOrder[a.ring] - ringOrder[b.ring];
      if (ringDiff !== 0) return ringDiff;
      return b.exposure - a.exposure;
    });
  }, [nearbyShops, filter]);

  // 竞争强度
  const competition = useMemo(() => getCompetitionLevel(nearbyShops), [nearbyShops]);

  // 玩家相对位置
  const playerRank = useMemo(() => {
    const activeShops = nearbyShops.filter(s => !s.isClosing);
    const higherExposure = activeShops.filter(s => s.exposure > playerExposure).length;
    return {
      rank: higherExposure + 1,
      total: activeShops.length + 1,
      percentile: activeShops.length > 0
        ? Math.round((1 - higherExposure / (activeShops.length + 1)) * 100)
        : 100,
    };
  }, [nearbyShops, playerExposure]);

  return (
    <div className="h-full flex flex-col bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* 标题栏 */}
      <div className="px-3 py-2 border-b border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200">商圈竞争态势</h3>
          <div
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: `${competition.color}20`, color: competition.color }}
          >
            {competition.level}
          </div>
        </div>
        <p className="text-[9px] text-slate-500 mt-0.5">{competition.description}</p>
      </div>

      {/* 玩家排名 */}
      <div className="px-3 py-2 border-b border-slate-700/30 bg-gradient-to-r from-orange-500/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏪</span>
            <div>
              <div className="text-[10px] text-slate-400">我的店铺排名</div>
              <div className="text-sm font-bold text-orange-400">
                第 {playerRank.rank} / {playerRank.total}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400">曝光度</div>
            <div className="text-sm font-mono text-slate-200">{Math.round(playerExposure)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400">口碑</div>
            <div className="text-sm font-mono text-slate-200">{Math.round(playerReputation)}</div>
          </div>
        </div>
      </div>

      {/* 距离分布 */}
      <div className="px-3 py-1.5 border-b border-slate-700/30">
        <DistanceBar nearbyShops={nearbyShops} />
      </div>

      {/* 筛选器 */}
      <div className="px-3 py-1.5 flex gap-1 border-b border-slate-700/30">
        {[
          { key: 'all', label: '全部' },
          { key: 'chain', label: '连锁' },
          { key: 'nearby', label: '近距离' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`
              text-[10px] px-2 py-0.5 rounded transition-all
              ${filter === key
                ? 'bg-orange-500/20 text-orange-400'
                : 'text-slate-500 hover:text-slate-300'
              }
            `}
            onClick={() => setFilter(key as typeof filter)}
          >
            {label}
          </button>
        ))}
        <span className="text-[10px] text-slate-600 ml-auto">
          {filteredShops.length} 家
        </span>
      </div>

      {/* 店铺列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 scrollbar-thin">
        {filteredShops.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-8">
            暂无竞争对手
          </div>
        ) : (
          filteredShops.map(shop => (
            <ShopCard key={shop.id} shop={shop} />
          ))
        )}
      </div>
    </div>
  );
}
