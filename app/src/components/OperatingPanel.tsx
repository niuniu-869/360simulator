import { useState, useRef, useEffect } from 'react';
import type { GameState, CognitionLevel, Product, WeeklySummary, SupplyDemandResult, BossActionType, DiscountTierId, DeliveryPricingId, PackagingTierId, SupplyPriority } from '@/types/game';
import { fuzzOperatingRevenue, fuzzOperatingProfit, fuzzOperatingCost, fuzzAcceptRatio } from '@/lib/fuzzUtils';
import { WIN_STREAK } from '@/lib/gameEngine';
import { DELIVERY_PLATFORMS, PROMOTION_TIERS, DISCOUNT_TIERS, DELIVERY_PRICING_TIERS, PACKAGING_TIERS } from '@/data/deliveryData';
import { BossActionPanel } from '@/components/BossActionPanel';
import { PRODUCT_ADJUSTMENT_CONFIG, ADJUSTMENT_COSTS } from '@/data/productAdjustmentData';
import { Play, Truck, TrendingUp, TrendingDown, Calendar, Sparkles, Store, History, AlertTriangle, DollarSign, Plus, Minus, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StreetViewScene } from '@/components/streetview/StreetViewScene';

interface OperatingPanelProps {
  gameState: GameState;
  currentStats: {
    revenue: number;
    variableCost: number;
    fixedCost: number;
    profit: number;
    margin: number;
    breakEvenPoint: number;
  };
  cognitionLevel: CognitionLevel;
  onJoinPlatform: (platformId: string) => void;
  onLeavePlatform: (platformId: string) => void;
  onTogglePromotion: (platformId: string, tierIndex: number) => void;
  onSetDiscountTier?: (platformId: string, tierId: DiscountTierId) => void;
  onSetDeliveryPricing?: (platformId: string, pricingId: DeliveryPricingId) => void;
  onSetPackagingTier?: (platformId: string, tierId: PackagingTierId) => void;
  onNextWeek: () => void;
  onClearEvent: () => void;
  onShowReview: () => void;
  hasLastSummary: boolean;
  lastWeeklySummary?: WeeklySummary;
  onSetProductPrice?: (productId: string, price: number) => void;
  onToggleProduct?: (product: Product) => void;
  allProducts?: Product[];
  supplyDemandResult?: SupplyDemandResult;
  onSetBossAction?: (action: BossActionType, role?: string, shopId?: string) => void;
  onSetSupplyPriority?: (priority: SupplyPriority) => void;
}

export function OperatingPanel({ gameState, currentStats: _currentStats, cognitionLevel, onJoinPlatform, onLeavePlatform, onTogglePromotion, onSetDiscountTier, onSetDeliveryPricing, onSetPackagingTier, onNextWeek, onClearEvent, onShowReview, hasLastSummary, lastWeeklySummary, onSetProductPrice, onToggleProduct, allProducts, supplyDemandResult, onSetBossAction, onSetSupplyPriority }: OperatingPanelProps) {
  void _currentStats;
  const [processing, setProcessing] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 组件卸载时清理 setTimeout，防止内存泄漏
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const formatMoney = (amount: number) => {
    if (amount >= 10000) {
      return `¥${(amount / 10000).toFixed(1)}万`;
    }
    return `¥${Math.round(amount).toLocaleString()}`;
  };

  const handleNextWeek = () => {
    setProcessing(true);

    timerRef.current = setTimeout(() => {
      onNextWeek();
      setProcessing(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* 老板本周行动（经营面板顶部，每周第一个决策） */}
      <BossActionPanel
        gameState={gameState}
        cognitionLevel={cognitionLevel}
        onSetBossAction={onSetBossAction ?? (() => {})}
      />

      <div className="flex items-center justify-between">
        <h2 className="ark-title">经营控制台</h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>连续盈利进度:</span>
          <div className="flex gap-1">
            {Array.from({ length: WIN_STREAK }, (_, idx) => idx + 1).map((week) => (
              <div
                key={week}
                className={`w-6 h-6 flex items-center justify-center text-xs font-bold
                  ${(gameState.consecutiveProfits || 0) >= week
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[#1a2332] text-slate-500 border border-[#1e293b]'
                  }
                `}
              >
                {week}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Calendar className="w-4 h-4 text-orange-500" />
          <span>第 <span className="text-orange-500 font-mono">{gameState.currentWeek}</span> / {gameState.totalWeeks} 周</span>
        </div>
      </div>

      {/* 街景视角 */}
      {supplyDemandResult && (
        <StreetViewScene gameState={gameState} supplyDemandResult={supplyDemandResult} />
      )}

      {/* 经营状态 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ark-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">店铺状态</p>
              <p className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                营业中
              </p>
            </div>
            <Play className="w-8 h-8 text-emerald-500" />
          </div>
        </div>
        
        <div className="ark-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">外卖平台</p>
              <p className={`text-lg font-bold ${gameState.deliveryState.platforms.length > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                {gameState.deliveryState.platforms.length > 0
                  ? `${gameState.deliveryState.platforms.length}个平台`
                  : '未上线'}
              </p>
            </div>
            <Truck className={`w-8 h-8 ${gameState.deliveryState.platforms.length > 0 ? 'text-orange-500' : 'text-slate-600'}`} />
          </div>
        </div>
        
        <div className="ark-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">本周目标</p>
              <p className="text-lg font-bold text-blue-400">
                持续盈利
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* 经营操作 */}
      <div className="ark-card p-5">
        <h3 className="font-bold text-white mb-4">经营策略</h3>
        
        <div className="space-y-4">
          {/* 选品与定价（折叠区域） */}
          {onSetProductPrice && (
            <div className="p-4 bg-[#0a0e17] border border-[#1e293b]">
              <button
                className="flex items-center justify-between w-full"
                onClick={() => setShowPricing(!showPricing)}
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-500" />
                  <p className="font-bold text-white">选品与定价</p>
                  <span className="text-xs text-slate-500">
                    {gameState.selectedProducts.length} 种产品
                  </span>
                </div>
                {showPricing
                  ? <ChevronUp className="w-4 h-4 text-slate-400" />
                  : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showPricing && (
                <div className="mt-4 space-y-4">
                  {/* 已选产品定价卡片 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {gameState.selectedProducts.map(product => {
                      const currentPrice = gameState.productPrices[product.id] || product.basePrice;
                      const margin = ((currentPrice - product.baseCost) / currentPrice * 100).toFixed(0);
                      const nearbyShops = gameState.nearbyShops || [];
                      // 修复 #9：只取同品类产品的价格，避免跨品类产品（如冰淇淋）干扰饮品均价
                      const sameCategoryPrices = nearbyShops
                        .filter(s => !s.isClosing && s.shopCategory === product.category)
                        .flatMap(s => s.products.filter(p => p.category === product.category).map(p => p.price));
                      const nearbyRange = sameCategoryPrices.length > 0 ? {
                        min: Math.min(...sameCategoryPrices),
                        max: Math.max(...sameCategoryPrices),
                        avg: Math.round(sameCategoryPrices.reduce((s, p) => s + p, 0) / sameCategoryPrices.length),
                      } : null;

                      // 消费者接受度（基于 referencePrice，根据认知等级模糊化）
                      const acceptRatio = product.referencePrice > 0
                        ? currentPrice / product.referencePrice
                        : 0;
                      const acceptResult = fuzzAcceptRatio(acceptRatio, cognitionLevel);

                      return (
                        <div key={product.id} className="p-3 bg-[#1a2332] border border-[#1e293b]">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{product.icon}</span>
                            <div className="flex-1">
                              <div className="font-bold text-white text-sm">{product.name}</div>
                              <div className="text-[10px] text-slate-500">成本 ¥{product.baseCost}</div>
                            </div>
                            {onToggleProduct && (
                              <button
                                className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                                onClick={() => onToggleProduct(product)}
                                disabled={gameState.selectedProducts.length <= PRODUCT_ADJUSTMENT_CONFIG.minProducts}
                                title="下架产品"
                              >
                                下架
                              </button>
                            )}
                          </div>

                          {/* 周边参考价 */}
                          {nearbyRange && (
                            <div className="mb-2 p-1.5 bg-[#0a0e17] text-[10px]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">
                                  <Store className="w-3 h-3 inline text-orange-500 mr-0.5" />
                                  周边 ¥{nearbyRange.min}~¥{nearbyRange.max}
                                </span>
                                <span className="text-orange-400 font-mono">均价 ¥{nearbyRange.avg}</span>
                              </div>
                            </div>
                          )}

                          {/* 价格调整 */}
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3 text-emerald-500" />
                                售价
                              </span>
                              {cognitionLevel >= 2 && (
                                <span className="text-emerald-400">毛利 {margin}%</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="w-7 h-7 flex items-center justify-center bg-[#0a0e17] border border-[#1e293b] text-slate-400 hover:bg-[#252f3f] transition-all"
                                onClick={() => onSetProductPrice(product.id, Math.max(product.baseCost + 1, currentPrice - 1))}
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <div className="flex-1 text-center">
                                <span className="text-base font-mono text-emerald-400">¥{currentPrice}</span>
                              </div>
                              <button
                                className="w-7 h-7 flex items-center justify-center bg-[#0a0e17] border border-[#1e293b] text-slate-400 hover:bg-[#252f3f] transition-all"
                                onClick={() => onSetProductPrice(product.id, currentPrice + 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* 消费者接受度指示器（根据认知等级模糊化） */}
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="text-slate-500">消费者接受度</span>
                              <span className={`font-bold ${acceptResult.textColor}`}>
                                {acceptResult.label}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-[#0a0e17] rounded-full overflow-hidden">
                              <div
                                className={`h-full ${acceptResult.barColor} transition-all`}
                                style={{ width: `${acceptResult.barWidth}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 可上架产品区域 */}
                  {onToggleProduct && allProducts && allProducts.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">
                        可上架产品
                        <span className="text-slate-600 ml-1">
                          (本周已调整 {gameState.weeklyProductChanges || 0}/{PRODUCT_ADJUSTMENT_CONFIG.maxWeeklyChanges} 次，
                          上架费 ¥{ADJUSTMENT_COSTS.addProduct.moneyCost})
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {allProducts
                          .filter(p => !gameState.selectedProducts.some(sp => sp.id === p.id))
                          .map(product => {
                            const canAdd = gameState.selectedProducts.length < PRODUCT_ADJUSTMENT_CONFIG.maxProducts
                              && (gameState.weeklyProductChanges || 0) < PRODUCT_ADJUSTMENT_CONFIG.maxWeeklyChanges
                              && gameState.cash >= ADJUSTMENT_COSTS.addProduct.moneyCost;
                            return (
                              <button
                                key={product.id}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-all ${
                                  canAdd
                                    ? 'bg-[#1a2332] border-[#1e293b] text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400'
                                    : 'bg-[#0a0e17] border-[#1e293b] text-slate-600 cursor-not-allowed'
                                }`}
                                onClick={() => canAdd && onToggleProduct(product)}
                                disabled={!canAdd}
                              >
                                <span>{product.icon}</span>
                                <span>{product.name}</span>
                                <span className="text-emerald-500 text-[10px]">+¥{ADJUSTMENT_COSTS.addProduct.moneyCost}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 外卖平台管理（认知≥1时显示） */}
          {(() => {
            const brandKey: 'franchise' | 'independent' =
              gameState.selectedBrand?.type === 'franchise' || gameState.selectedBrand?.isQuickFranchise
                ? 'franchise' : 'independent';
            const anyPlatformVisible = DELIVERY_PLATFORMS.some(
              p => cognitionLevel >= p.minCognitionByBrandType[brandKey] || gameState.deliveryState.platforms.some(ap => ap.platformId === p.id)
            );
            return anyPlatformVisible;
          })() && (
            <div className="p-4 bg-[#0a0e17] border border-[#1e293b]">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-5 h-5 text-orange-500" />
                <p className="font-bold text-white">外卖平台管理</p>
              </div>
              <div className="space-y-3">
                {DELIVERY_PLATFORMS.map(platform => {
                  const isJoined = gameState.deliveryState.platforms.some(
                    p => p.platformId === platform.id
                  );
                  const activePlatform = gameState.deliveryState.platforms.find(
                    p => p.platformId === platform.id
                  );
                  const brandKey: 'franchise' | 'independent' =
                    gameState.selectedBrand?.type === 'franchise' || gameState.selectedBrand?.isQuickFranchise
                      ? 'franchise' : 'independent';
                  const requiredLevel = platform.minCognitionByBrandType[brandKey];
                  const canJoin = cognitionLevel >= requiredLevel;

                  return (
                    <div key={platform.id} className="p-3 bg-[#1a2332] border border-[#1e293b]">
                      {/* 平台头部：名称 + 抽成 + 上线/下线按钮 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{platform.name}</span>
                          <span className="text-xs text-slate-500">佣金{Math.round(platform.commissionRate * 100)}%</span>
                          {isJoined && activePlatform && activePlatform.activeWeeks <= platform.newStoreBoostWeeks && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              新店扶持中
                            </span>
                          )}
                        </div>
                        <button
                          className={`px-4 py-1.5 text-sm font-bold transition-all ${
                            isJoined
                              ? 'bg-orange-500 text-white'
                              : canJoin
                                ? 'bg-[#0a0e17] text-slate-400 border border-[#1e293b] hover:border-orange-500'
                                : 'bg-[#0a0e17] text-slate-600 border border-[#1e293b] cursor-not-allowed'
                          }`}
                          onClick={() => isJoined ? onLeavePlatform(platform.id) : onJoinPlatform(platform.id)}
                          disabled={!canJoin && !isJoined}
                        >
                          {isJoined ? '下线' : '上线'}
                        </button>
                      </div>

                      {/* 已上线平台：运营控制面板 */}
                      {isJoined && activePlatform && (
                        <div className="mt-3 space-y-2.5">
                          {/* 权重分展示 */}
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-slate-400">平台权重分</span>
                              <span className="text-orange-400 font-mono font-bold">
                                {Math.round(activePlatform.platformExposure)}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-[#0a0e17] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all"
                                style={{ width: `${Math.min(100, activePlatform.platformExposure)}%` }}
                              />
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-slate-500">
                              <span>基础<span className="text-slate-400 ml-0.5">{(activePlatform.lastWeightBase ?? 0).toFixed(0)}</span></span>
                              <span>销量<span className="text-slate-400 ml-0.5">{(activePlatform.lastWeightSales ?? 0).toFixed(0)}</span></span>
                              <span>评分<span className="text-slate-400 ml-0.5">{(activePlatform.lastWeightRating ?? 0).toFixed(0)}</span></span>
                              <span>推广<span className="text-blue-400 ml-0.5">+{(activePlatform.lastWeightPromotion ?? 0).toFixed(0)}</span></span>
                              <span>满减<span className={`ml-0.5 ${(activePlatform.lastWeightDiscount ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {(activePlatform.lastWeightDiscount ?? 0) >= 0 ? '+' : ''}{(activePlatform.lastWeightDiscount ?? 0).toFixed(0)}
                              </span></span>
                            </div>
                          </div>

                          {/* 推广档位 */}
                          <div>
                            <p className="text-[10px] text-slate-500 mb-1">推广</p>
                            <div className="flex items-center gap-1">
                              {PROMOTION_TIERS.map((tier, idx) => (
                                <button
                                  key={tier.id}
                                  className={`px-1.5 py-0.5 text-[10px] transition-all ${
                                    activePlatform.promotionTierId === tier.id
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-[#0a0e17] text-slate-400 border border-[#1e293b] hover:border-blue-500'
                                  }`}
                                  onClick={() => onTogglePromotion(platform.id, idx)}
                                  title={`${tier.name}: ${tier.description}${tier.weeklyCost > 0 ? ` (¥${tier.weeklyCost}/周)` : ''}`}
                                >
                                  {tier.name}
                                  {tier.weeklyCost > 0 && <span className="ml-0.5 opacity-70">¥{tier.weeklyCost}</span>}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 满减档位 */}
                          <div>
                            <p className="text-[10px] text-slate-500 mb-1">满减活动</p>
                            <div className="flex flex-wrap items-center gap-1">
                              {DISCOUNT_TIERS.map(tier => {
                                const isActive = activePlatform.discountTierId === tier.id;
                                const isLossLeader = tier.id === 'loss_leader';
                                return (
                                  <button
                                    key={tier.id}
                                    className={`px-1.5 py-0.5 text-[10px] transition-all ${
                                      isActive
                                        ? isLossLeader ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                                        : 'bg-[#0a0e17] text-slate-400 border border-[#1e293b] hover:border-emerald-500'
                                    }`}
                                    onClick={() => onSetDiscountTier?.(platform.id, tier.id)}
                                    title={`${tier.name}: ${tier.description}（补贴率${Math.round(tier.subsidyRate * 100)}%）`}
                                  >
                                    {tier.name}
                                  </button>
                                );
                              })}
                            </div>
                            {activePlatform.discountTierId !== 'none' && (() => {
                              const tier = DISCOUNT_TIERS.find(t => t.id === activePlatform.discountTierId);
                              return tier ? (
                                <p className={`text-[10px] mt-0.5 ${tier.id === 'loss_leader' ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {tier.description}（商家补贴{Math.round(tier.subsidyRate * 100)}%）
                                </p>
                              ) : null;
                            })()}
                          </div>

                          {/* 外卖定价 */}
                          <div>
                            <p className="text-[10px] text-slate-500 mb-1">外卖定价</p>
                            <div className="flex items-center gap-1">
                              {DELIVERY_PRICING_TIERS.map(tier => (
                                <button
                                  key={tier.id}
                                  className={`px-1.5 py-0.5 text-[10px] transition-all ${
                                    activePlatform.deliveryPricingId === tier.id
                                      ? 'bg-purple-500 text-white'
                                      : 'bg-[#0a0e17] text-slate-400 border border-[#1e293b] hover:border-purple-500'
                                  }`}
                                  onClick={() => onSetDeliveryPricing?.(platform.id, tier.id)}
                                  title={`${tier.name}: ${tier.description}`}
                                >
                                  {tier.name}
                                </button>
                              ))}
                            </div>
                            {(() => {
                              const tier = DELIVERY_PRICING_TIERS.find(t => t.id === activePlatform.deliveryPricingId);
                              return tier && tier.multiplier > 1 ? (
                                <p className="text-[10px] text-purple-400 mt-0.5">
                                  菜单价 = 堂食价 × {tier.multiplier.toFixed(2)}
                                </p>
                              ) : null;
                            })()}
                          </div>

                          {/* 包装档次 */}
                          <div>
                            <p className="text-[10px] text-slate-500 mb-1">包装</p>
                            <div className="flex items-center gap-1">
                              {PACKAGING_TIERS.map(tier => (
                                <button
                                  key={tier.id}
                                  className={`px-1.5 py-0.5 text-[10px] transition-all ${
                                    activePlatform.packagingTierId === tier.id
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-[#0a0e17] text-slate-400 border border-[#1e293b] hover:border-amber-500'
                                  }`}
                                  onClick={() => onSetPackagingTier?.(platform.id, tier.id)}
                                  title={`${tier.name}: ${tier.description}（¥${tier.costPerOrder}/单）`}
                                >
                                  {tier.name} ¥{tier.costPerOrder}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 未解锁提示 */}
                      {!isJoined && !canJoin && (
                        <p className="text-xs text-red-400 mt-1">
                          {brandKey === 'franchise'
                            ? `加盟品牌需要认知等级${requiredLevel}`
                            : `自营品牌需要认知等级${requiredLevel}`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 平台评分和外卖概览 */}
              {gameState.deliveryState.platforms.length > 0 && (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="bg-[#1a2332] p-2 text-center">
                    <p className="text-[10px] text-slate-400">平台评分</p>
                    <p className="text-sm font-bold text-yellow-400">
                      {gameState.deliveryState.platformRating > 0
                        ? `${gameState.deliveryState.platformRating.toFixed(1)}★`
                        : '暂无'}
                    </p>
                  </div>
                  <div className="bg-[#1a2332] p-2 text-center">
                    <p className="text-[10px] text-slate-400">上周单量</p>
                    <p className="text-sm font-bold text-orange-400">
                      {gameState.deliveryState.weeklyDeliveryOrders}
                    </p>
                  </div>
                  <div className="bg-[#1a2332] p-2 text-center">
                    <p className="text-[10px] text-slate-400">外卖收入</p>
                    <p className="text-sm font-bold text-emerald-400">
                      {formatMoney(gameState.deliveryState.weeklyDeliveryRevenue)}
                    </p>
                  </div>
                  <div className="bg-[#1a2332] p-2 text-center">
                    <p className="text-[10px] text-slate-400">佣金</p>
                    <p className="text-sm font-bold text-red-400">
                      {formatMoney(gameState.deliveryState.weeklyCommissionPaid)}
                    </p>
                  </div>
                  <div className="bg-[#1a2332] p-2 text-center">
                    <p className="text-[10px] text-slate-400">满减+包装</p>
                    <p className="text-sm font-bold text-red-400">
                      {formatMoney((gameState.deliveryState.weeklyDiscountCost || 0) + (gameState.deliveryState.weeklyPackageCost || 0))}
                    </p>
                  </div>
                </div>
              )}

              {/* 外卖无单诊断提示 */}
              {gameState.deliveryState.platforms.length > 0 &&
                gameState.deliveryState.weeklyDeliveryOrders === 0 &&
                gameState.currentWeek > 0 && (() => {
                  const lowWeight = gameState.deliveryState.totalPlatformExposure < 20;
                  const noDiscount = gameState.deliveryState.platforms.every(p => p.discountTierId === 'none');
                  const diagnostics: { text: string; color: string }[] = [];
                  if (noDiscount) {
                    diagnostics.push({ text: '未设置满减活动，外卖平台会严重降权，几乎没有自然流量', color: 'text-red-400' });
                  }
                  if (lowWeight) {
                    diagnostics.push({ text: '平台权重分过低，建议开启推广+设置满减提升排名', color: 'text-blue-400' });
                  }
                  if (diagnostics.length === 0) {
                    const rating = gameState.deliveryState.platformRating;
                    const maxActiveWeeks = Math.max(...gameState.deliveryState.platforms.map(p => p.activeWeeks));
                    if (rating < 1 && maxActiveWeeks <= 4) {
                      diagnostics.push({ text: '新店需要时间积累评价，建议配合满减活动度过冷启动期', color: 'text-blue-400' });
                    } else if (rating < 1) {
                      diagnostics.push({ text: '平台评分过低，影响转化率，注意出餐质量和配送体验', color: 'text-yellow-400' });
                    } else {
                      diagnostics.push({ text: '堂食产能已占满，外卖无出餐余量，考虑调整出餐分配策略', color: 'text-yellow-400' });
                    }
                  }
                  return (
                    <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-sm font-bold text-amber-400">外卖0单诊断</span>
                      </div>
                      <div className="space-y-1">
                        {diagnostics.map((d, i) => (
                          <p key={i} className={`text-xs ${d.color}`}>• {d.text}</p>
                        ))}
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}

          {/* 出餐分配优先级（有外卖平台时显示） */}
          {gameState.deliveryState.platforms.length > 0 && onSetSupplyPriority && (
            <div className="p-4 bg-[#0a0e17] border border-[#1e293b]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-cyan-500" />
                  <p className="font-bold text-white text-sm">出餐分配策略</p>
                </div>
                <div className="flex items-center gap-1">
                  {([
                    { id: 'dine_in_first' as const, label: '堂食优先', desc: '堂食先满足，外卖取剩余' },
                    { id: 'delivery_first' as const, label: '外卖优先', desc: '外卖先满足，堂食取剩余' },
                    { id: 'proportional' as const, label: '按需分配', desc: '按需求比例分配产能' },
                  ]).map(opt => (
                    <button
                      key={opt.id}
                      className={`px-2 py-1 text-[11px] transition-all ${
                        gameState.supplyPriority === opt.id
                          ? 'bg-cyan-500 text-white'
                          : 'bg-[#1a2332] text-slate-400 border border-[#1e293b] hover:border-cyan-500'
                      }`}
                      onClick={() => onSetSupplyPriority(opt.id)}
                      title={opt.desc}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 上周经营数据（根据认知等级模糊化） */}
          {lastWeeklySummary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#0a0e17] p-3 border border-[#1e293b]">
                <p className="text-xs text-slate-400">上周收入</p>
                <p className="text-lg font-mono text-emerald-400">
                  {fuzzOperatingRevenue(lastWeeklySummary.revenue, cognitionLevel).display}
                </p>
              </div>
              <div className="bg-[#0a0e17] p-3 border border-[#1e293b]">
                <p className="text-xs text-slate-400">变动成本</p>
                <p className="text-lg font-mono text-red-400">
                  {fuzzOperatingCost(lastWeeklySummary.variableCost, cognitionLevel, 'variable').display}
                </p>
              </div>
              <div className="bg-[#0a0e17] p-3 border border-[#1e293b]">
                <p className="text-xs text-slate-400">固定成本</p>
                <p className="text-lg font-mono text-orange-400">
                  {fuzzOperatingCost(lastWeeklySummary.fixedCost, cognitionLevel, 'fixed').display}
                </p>
              </div>
              <div className="bg-[#0a0e17] p-3 border border-[#1e293b]">
                <p className="text-xs text-slate-400">上周利润</p>
                <p className={`text-lg font-mono ${lastWeeklySummary.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fuzzOperatingProfit(lastWeeklySummary.profit, cognitionLevel).display}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#0a0e17] p-4 border border-[#1e293b] text-center">
              <p className="text-sm text-slate-500">尚无经营数据，点击"开始经营"推进第一周</p>
            </div>
          )}
        </div>
      </div>

      {/* 周边店铺动态 */}
      {gameState.nearbyShopEvents && gameState.nearbyShopEvents.length > 0 && (
        <div className="ark-card p-4">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
            <Store className="w-4 h-4 text-orange-500" />
            商圈动态
          </h3>
          <div className="space-y-2">
            {gameState.nearbyShopEvents.map((evt, i) => (
              <div key={i} className="flex items-center gap-2 text-xs p-2 bg-[#0a0e17] border border-[#1e293b]">
                {evt.type === 'new_open' && <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />}
                {evt.type === 'closing' && <TrendingDown className="w-3 h-3 text-red-400 shrink-0" />}
                {evt.type === 'price_change' && <TrendingUp className="w-3 h-3 text-amber-400 shrink-0" />}
                {evt.type === 'promotion' && <Store className="w-3 h-3 text-blue-400 shrink-0" />}
                <span className="text-slate-300">{evt.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 下周按钮 */}
      <div className="flex justify-center gap-4">
        {/* 回顾按钮 */}
        <button
          className="ark-button px-8 py-4 text-lg flex items-center gap-3 bg-[#1a2332] border border-[#1e293b] text-slate-300 hover:border-blue-500/50 hover:text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          onClick={onShowReview}
          disabled={!hasLastSummary || processing}
          title={hasLastSummary ? '查看上周经营总结' : '暂无历史数据'}
        >
          <History className="w-5 h-5" />
          回顾
        </button>
        {/* 下一周按钮 */}
        <button
          className="ark-button ark-button-primary px-12 py-4 text-lg flex items-center gap-3 disabled:opacity-50"
          onClick={handleNextWeek}
          disabled={processing || gameState.gamePhase === 'ended'}
        >
          {processing ? (
            <>
              <div className="ark-loading" />
              经营中...
            </>
          ) : (
            <>
              <Calendar className="w-5 h-5" />
              {gameState.currentWeek === 0 ? '开始经营' : '下一周'}
            </>
          )}
        </button>
      </div>

      {/* 事件弹窗 - 读取 gameState.lastWeekEvent，关闭时清除状态 */}
      <Dialog open={!!gameState.lastWeekEvent} onOpenChange={() => onClearEvent()}>
        <DialogContent className="bg-[#151d2b] border-[#1e293b] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5 text-amber-500" />
              本周事件
            </DialogTitle>
          </DialogHeader>
          {gameState.lastWeekEvent && (
            <div className="space-y-4 mt-4">
              <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
                <h4 className="font-bold text-white mb-2">{gameState.lastWeekEvent.title}</h4>
                <p className="text-sm text-slate-300">{gameState.lastWeekEvent.description}</p>
              </div>

              <div className={`p-4 border ${
                gameState.lastWeekEvent.impact.type === 'reputation'
                  ? (gameState.lastWeekEvent.impact.value >= 0
                    ? 'bg-pink-500/10 border-pink-500/50'
                    : 'bg-red-500/10 border-red-500/50')
                  : (gameState.lastWeekEvent.impact.type === 'revenue' && gameState.lastWeekEvent.impact.value >= 0
                    ? 'bg-emerald-500/10 border-emerald-500/50'
                    : 'bg-red-500/10 border-red-500/50')
              }`}>
                <p className={`text-sm ${
                  gameState.lastWeekEvent.impact.type === 'reputation'
                    ? (gameState.lastWeekEvent.impact.value >= 0 ? 'text-pink-400' : 'text-red-400')
                    : (gameState.lastWeekEvent.impact.type === 'revenue' && gameState.lastWeekEvent.impact.value >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400')
                }`}>
                  影响: {gameState.lastWeekEvent.impact.type === 'revenue'
                    ? `收入 ${gameState.lastWeekEvent.impact.value >= 0 ? '+' : ''}${(gameState.lastWeekEvent.impact.value * 100).toFixed(0)}%`
                    : gameState.lastWeekEvent.impact.type === 'reputation'
                      ? `口碑 ${gameState.lastWeekEvent.impact.value >= 0 ? '+' : ''}${gameState.lastWeekEvent.impact.value}`
                      : `额外支出 ${formatMoney(gameState.lastWeekEvent.impact.value)}`
                  }
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
