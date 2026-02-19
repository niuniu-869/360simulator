import { useMemo, useState } from 'react';
import type { NearbyShop, RingId } from '@/types/game';
import { SHOP_CATEGORY_COLORS, SHOP_CATEGORY_EMOJIS } from '@/data/streetviewData';
import './streetview.css';

interface NearbyShopRingsProps {
  nearbyShops: NearbyShop[];
  children: React.ReactNode; // PlayerStoreView 居中
}

const RING_CONFIG: { id: RingId; radius: number; color: string; label: string }[] = [
  { id: 'ring0', radius: 90, color: 'rgba(249,115,22,0.3)', label: '300m' },
  { id: 'ring1', radius: 140, color: 'rgba(249,115,22,0.15)', label: '1km' },
  { id: 'ring2', radius: 190, color: 'rgba(249,115,22,0.08)', label: '3km' },
];

interface ShopDotProps {
  shop: NearbyShop;
  x: number;
  y: number;
}

function ShopDot({ shop, x, y }: ShopDotProps) {
  const [hovered, setHovered] = useState(false);
  const color = SHOP_CATEGORY_COLORS[shop.shopCategory] || '#94a3b8';
  const emoji = SHOP_CATEGORY_EMOJIS[shop.shopCategory] || '🏪';

  return (
    <div
      className="absolute"
      style={{
        left: x - 12,
        top: y - 12,
        width: 24,
        height: 24,
        zIndex: hovered ? 50 : 10,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 店铺圆点 */}
      <div
        className="w-6 h-6 flex items-center justify-center rounded-full border transition-all cursor-pointer"
        style={{
          backgroundColor: `${color}20`,
          borderColor: `${color}60`,
          opacity: shop.isClosing ? 0.25 : 1,
          filter: shop.isClosing ? 'grayscale(1)' : 'none',
        }}
      >
        <span style={{ fontSize: '11px' }}>{emoji}</span>
      </div>

      {/* 连锁标记 */}
      {shop.brandType === 'chain' && !shop.isClosing && (
        <div
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
          style={{ backgroundColor: '#f97316' }}
        />
      )}

      {/* 外卖标记 */}
      {shop.hasDelivery && !shop.isClosing && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2" style={{ fontSize: '7px' }}>
          🛵
        </div>
      )}

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute z-50 px-2.5 py-2 text-[10px] leading-relaxed whitespace-nowrap border"
          style={{
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '6px',
            background: '#151d2b',
            borderColor: '#1e293b',
            color: '#e2e8f0',
          }}
        >
          <div className="font-bold text-white mb-0.5">{shop.name}</div>
          <div className="text-slate-400">
            {shop.brandType === 'chain' ? '🔗 连锁' : '🏠 独立'} · {shop.shopCategory}
          </div>
          <div className="text-slate-400">
            曝光 {Math.round(shop.exposure)} · 装修 Lv{shop.decorationLevel}
          </div>
          {shop.isClosing && <div className="text-red-400 mt-0.5">⚠ 即将关门</div>}
        </div>
      )}
    </div>
  );
}

export function NearbyShopRings({ nearbyShops, children }: NearbyShopRingsProps) {
  const containerSize = 400;
  const center = containerSize / 2;

  // 按 ring 分组并计算位置
  const shopPositions = useMemo(() => {
    const result: { shop: NearbyShop; x: number; y: number }[] = [];

    for (const ringCfg of RING_CONFIG) {
      const shopsInRing = nearbyShops.filter(s => s.ring === ringCfg.id);
      if (shopsInRing.length === 0) continue;

      // 起始角度加随机偏移避免对称感（用 ring id 做种子）
      const startAngle = ringCfg.id === 'ring0' ? 0.3 : ringCfg.id === 'ring1' ? 0.8 : 1.5;
      const angleStep = (2 * Math.PI) / shopsInRing.length;

      shopsInRing.forEach((shop, idx) => {
        const angle = startAngle + angleStep * idx;
        // 使用确定性偏移（基于店铺索引）避免 Math.random
        const seed = (idx * 137 + ringCfg.radius) % 100;
        const radiusJitter = (seed / 100 - 0.5) * 12;
        const r = ringCfg.radius + radiusJitter;
        const x = center + Math.cos(angle) * r;
        const y = center + Math.sin(angle) * r;
        result.push({ shop, x, y });
      });
    }

    return result;
  }, [nearbyShops, center]);

  return (
    <div
      className="relative mx-auto"
      style={{ width: containerSize, height: containerSize - 60 }}
    >
      {/* 同心圆环 */}
      {RING_CONFIG.map(ring => (
        <div key={ring.id}>
          {/* 圆环 */}
          <div
            className="absolute rounded-full border border-dashed sv-ring pointer-events-auto"
            style={{
              width: ring.radius * 2,
              height: ring.radius * 2,
              left: center - ring.radius,
              top: center - ring.radius - 30, // 上移补偿容器高度裁剪
              borderColor: ring.color,
              transition: 'border-color 0.3s',
            }}
          />
          {/* 距离标签 */}
          <div
            className="absolute text-[9px] text-orange-500/40 font-mono"
            style={{
              left: center + ring.radius + 4,
              top: center - 30 - 6,
            }}
          >
            {ring.label}
          </div>
        </div>
      ))}

      {/* 玩家店铺居中 */}
      <div
        className="absolute z-20"
        style={{
          left: '50%',
          top: `${center - 30}px`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {children}
      </div>

      {/* 周边店铺图标 */}
      {shopPositions.map(({ shop, x, y }) => (
        <ShopDot
          key={shop.id}
          shop={shop}
          x={x}
          y={y - 30}
        />
      ))}
    </div>
  );
}
