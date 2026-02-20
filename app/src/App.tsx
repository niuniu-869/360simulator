import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { GameHeader } from '@/components/GameHeader';
import { BrandSelection } from '@/components/BrandSelection';
import { LocationSelection } from '@/components/LocationSelection';
import { DecorationSelection } from '@/components/DecorationSelection';
import { ProductSelection } from '@/components/ProductSelection';
import { StaffManagement } from '@/components/StaffManagement';
import { FinanceDashboard } from '@/components/FinanceDashboard';
import { OperatingPanel } from '@/components/OperatingPanel';
import { GameResult } from '@/components/GameResult';
// 新增系统面板组件
import { CognitionPanel } from '@/components/CognitionPanel';
import { MarketingPanel } from '@/components/MarketingPanel';
import { StaffPanel } from '@/components/StaffPanel';
import { InventoryPanel } from '@/components/InventoryPanel';
import { products } from '@/data/gameData';
import { SupplyDemandPanel } from '@/components/SupplyDemandPanel';
import { WeeklySummaryDialog } from '@/components/WeeklySummaryDialog';
import { EventDialog } from '@/components/EventDialog';
import { CyberYongGe } from '@/components/CyberYongGe';
import { CognitionLevelUpDialog } from '@/components/CognitionLevelUpDialog';
import type { Proposal } from '@/lib/llm/prompts';
import type { CognitionLevel } from '@/types/game';
import { diagnoseHealth } from '@/lib/healthCheck';
import { SeasonSelectDialog } from '@/components/SeasonSelectDialog';
import { WelcomePage } from '@/components/WelcomePage';
import { isPanelUnlocked, PANEL_UNLOCK_CONFIG, PASSIVE_EXP_CONFIG } from '@/data/cognitionData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Store, MapPin, Paintbrush, Utensils, Users, Calculator, Play, Check, Megaphone, Package, TrendingUp, Lock } from 'lucide-react';

function App() {
  const {
    gameState,
    currentStats,
    supplyDemandResult,
    canOpen,
    gameResult,
    selectBrand,
    selectLocation,
    selectAddress,
    setStoreArea,
    selectDecoration,
    toggleProduct,
    addStaff,
    fireStaff,
    recruitStaff,
    // 外卖平台管理
    joinPlatform,
    leavePlatform,
    togglePromotion,
    setDiscountTier,
    setDeliveryPricing,
    setPackagingTier,
    openStore,
    nextWeek,
    restart,
    // 新增方法
    startMarketingActivity,
    stopMarketingActivity,
    setProductPrice,
    setProductInventory,
    assignStaffToTask,
    consultYongGe,
    clearWeeklySummary,
    clearLastWeekEvent,
    setRestockStrategy,
    setStaffWorkHours,
    // v2.7 员工系统升级
    setStaffSalary,
    staffMoraleAction,
    retainStaff,
    // v2.8 产品专注度
    setStaffFocusProduct,
    // v2.9 老板周行动
    setBossAction,
    // 出餐分配优先级
    setSupplyPriority,
    // v2.9 交互式事件
    respondToEvent,
  } = useGameState();

  // 回顾弹窗状态
  const [showReview, setShowReview] = useState(false);
  // 赛博勇哥面板状态
  const [showCyberYongGe, setShowCyberYongGe] = useState(false);
  // 欢迎页状态
  const [showWelcome, setShowWelcome] = useState(true);
  // 筹备阶段当前活跃步骤
  const [activeSetupStep, setActiveSetupStep] = useState<string>('brand');
  // 季节选择弹窗状态
  const [showSeasonSelect, setShowSeasonSelect] = useState(false);
  // 认知等级提升庆祝弹窗
  const [pendingLevelUp, setPendingLevelUp] = useState<{
    fromLevel: CognitionLevel;
    toLevel: CognitionLevel;
  } | null>(null);

  // 经营健康诊断（传给赛博勇哥作为 LLM 上下文）
  const healthAlerts = gameState.gamePhase === 'operating'
    ? diagnoseHealth(gameState, currentStats, supplyDemandResult)
    : [];

  // hire_staff 延迟任务分配：React 批处理下 recruitStaff 后无法立即拿到新员工 ID，
  // 用 ref 暂存待分配岗位，useEffect 在 staff 变化后执行分配。
  const pendingHireTasksRef = useRef<string[]>([]);
  const prevStaffCountRef = useRef(gameState.staff.length);

  useEffect(() => {
    const prevCount = prevStaffCountRef.current;
    const currentCount = gameState.staff.length;
    prevStaffCountRef.current = currentCount;

    if (pendingHireTasksRef.current.length === 0 || currentCount <= prevCount) return;

    const newStaffCount = currentCount - prevCount;
    const tasks = pendingHireTasksRef.current.splice(0, newStaffCount);
    const newStaff = gameState.staff.slice(-newStaffCount);

    newStaff.forEach((s, i) => {
      const task = tasks[i];
      if (task && s.assignedTask !== task) {
        assignStaffToTask(s.id, task);
      }
    });
  }, [gameState.staff.length, assignStaffToTask]);

  // 一键采纳勇哥提案
  const handleApplyProposals = useCallback((proposals: Proposal[]) => {
    for (const p of proposals) {
      switch (p.type) {
        case 'fire_staff': {
          // 优先使用 staffId 精确匹配，避免索引因用户操作而错位
          const staffId = p.params.staffId ? String(p.params.staffId) : null;
          if (staffId) {
            const found = gameState.staff.find(s => s.id === staffId);
            if (found) fireStaff(staffId);
          } else {
            // 兼容旧版提案：fallback 到 index
            const idx = Number(p.params.index);
            if (idx >= 0 && idx < gameState.staff.length) {
              fireStaff(gameState.staff[idx].id);
            }
          }
          break;
        }
        case 'set_price': {
          const pid = String(p.params.productId);
          const price = Number(p.params.price);
          if (pid && price > 0) setProductPrice(pid, price);
          break;
        }
        case 'start_marketing': {
          const aid = String(p.params.activityId);
          if (aid) startMarketingActivity(aid);
          break;
        }
        case 'stop_marketing': {
          const aid = String(p.params.activityId);
          if (aid) stopMarketingActivity(aid);
          break;
        }
        case 'join_platform': {
          const pid = String(p.params.platformId);
          if (pid) joinPlatform(pid);
          break;
        }
        case 'leave_platform': {
          const pid = String(p.params.platformId);
          if (pid) leavePlatform(pid);
          break;
        }
        case 'change_restock': {
          const strategyMap: Record<string, string> = {
            conservative: 'auto_conservative',
            standard: 'auto_standard',
            aggressive: 'auto_aggressive',
          };
          const strategy = strategyMap[String(p.params.strategy)];
          if (strategy) {
            gameState.inventoryState.items.forEach(item => {
              setRestockStrategy(item.productId, strategy as 'auto_conservative' | 'auto_standard' | 'auto_aggressive');
            });
          }
          break;
        }
        case 'hire_staff': {
          const task = String(p.params.task);
          if (['chef', 'waiter', 'marketer', 'cleaner'].includes(task)) {
            pendingHireTasksRef.current.push(task);
            recruitStaff('online', 'fulltime');
          }
          break;
        }
      }
    }
  }, [gameState.staff, gameState.inventoryState.items, fireStaff, setProductPrice, startMarketingActivity, stopMarketingActivity, joinPlatform, leavePlatform, setRestockStrategy, recruitStaff]);

  // 筹备阶段检查
  const setupSteps = [
    { id: 'brand', label: '选择品牌', desc: '加盟或自主', completed: !!gameState.selectedBrand, icon: Store },
    { id: 'location', label: '选址决策', desc: '区位与地段', completed: !!gameState.selectedLocation && !!gameState.selectedAddress, icon: MapPin },
    { id: 'decoration', label: '装修风格', desc: '风格与档次', completed: !!gameState.selectedDecoration, icon: Paintbrush },
    { id: 'product', label: '选品策略', desc: '最多选5种', completed: gameState.selectedProducts.length > 0, icon: Utensils },
    { id: 'staff', label: '人员配置', desc: '招聘员工', completed: gameState.staff.length > 0, icon: Users },
  ];

  const completedSteps = setupSteps.filter(s => s.completed).length;

  return (
    <>
      {showWelcome ? (
        <WelcomePage onStart={() => setShowWelcome(false)} />
      ) : (
    <div className="min-h-screen bg-[#0a0e17] ark-grid-bg">
      <GameHeader
        gameState={gameState}
        cognitionLevel={gameState.cognition.level}
        currentStats={currentStats}
        onOpenCyberYongGe={() => setShowCyberYongGe(true)}
      />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {gameState.gamePhase === 'setup' && (
          <div className="space-y-6">
            {/* 筹备进度导航 */}
            <div className="ark-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">筹备进度</h2>
                <span className="text-sm text-slate-400">
                  已完成 <span className="text-orange-500 font-mono">{completedSteps}</span> / {setupSteps.length} 步
                </span>
              </div>
              
              <div className="flex gap-2 mb-4">
                {setupSteps.map((step) => {
                  const Icon = step.icon;
                  const isActive = activeSetupStep === step.id;
                  return (
                    <div
                      key={step.id}
                      className={`
                        flex-1 p-3 border flex flex-col items-center gap-2 cursor-pointer transition-all duration-200
                        ${isActive
                          ? 'border-orange-500/50 bg-orange-500/10'
                          : step.completed
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-[#1e293b] bg-[#0a0e17]'
                        }
                        hover:border-orange-500/30
                      `}
                      onClick={() => setActiveSetupStep(step.id)}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-orange-500' : step.completed ? 'text-emerald-500' : 'text-slate-500'}`} />
                      <span className={`text-xs ${isActive ? 'text-orange-400' : step.completed ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {step.label}
                      </span>
                      <span className="text-[10px] text-slate-600">{step.desc}</span>
                      {step.completed && <Check className="w-4 h-4 text-emerald-500" />}
                    </div>
                  );
                })}
              </div>
              
              {/* 开店按钮 */}
              {completedSteps === setupSteps.length && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-slate-400">
                    总投资: <span className="text-orange-400 font-mono">¥{(gameState.totalInvestment / 10000).toFixed(1)}万</span>
                    ，剩余现金: <span className="text-emerald-400 font-mono">¥{(gameState.cash / 10000).toFixed(1)}万</span>
                  </p>
                  <button
                    className="ark-button ark-button-primary px-12 py-4 text-lg flex items-center gap-3"
                    onClick={() => setShowSeasonSelect(true)}
                    disabled={!canOpen}
                  >
                    <Play className="w-5 h-5" />
                    正式开店
                  </button>
                </div>
              )}
            </div>

            {/* 筹备面板内容 */}
            <div className="mt-6">
              {activeSetupStep === 'brand' && (
                <BrandSelection
                  selectedBrand={gameState.selectedBrand}
                  onSelect={selectBrand}
                  cash={gameState.cash + (gameState.selectedBrand?.franchiseFee || 0)}
                />
              )}

              {activeSetupStep === 'location' && (
                <LocationSelection
                  selectedLocation={gameState.selectedLocation}
                  selectedAddress={gameState.selectedAddress}
                  storeArea={gameState.storeArea}
                  nearbyShops={gameState.nearbyShops || []}
                  onSelectLocation={selectLocation}
                  onSelectAddress={selectAddress}
                  onSetArea={setStoreArea}
                  isLocked={gameState.locationLocked}
                  isQuickFranchise={gameState.selectedBrand?.isQuickFranchise}
                />
              )}

              {activeSetupStep === 'decoration' && (
                <DecorationSelection
                  selectedDecoration={gameState.selectedDecoration}
                  storeArea={gameState.storeArea}
                  cash={gameState.cash}
                  onSelect={selectDecoration}
                  isLocked={gameState.decorationLocked}
                  isQuickFranchise={gameState.selectedBrand?.isQuickFranchise}
                  costMarkup={gameState.decorationCostMarkup}
                />
              )}

              {activeSetupStep === 'product' && (
                <ProductSelection
                  selectedProducts={gameState.selectedProducts}
                  selectedLocation={gameState.selectedLocation}
                  onToggleProduct={toggleProduct}
                  isLocked={gameState.productsLocked}
                  isQuickFranchise={gameState.selectedBrand?.isQuickFranchise}
                  supplyCostModifier={gameState.selectedBrand?.supplyCostModifier}
                  allowedCategories={gameState.selectedBrand?.allowedCategories}
                />
              )}

              {activeSetupStep === 'staff' && (
                <StaffManagement
                  staff={gameState.staff}
                  selectedLocation={gameState.selectedLocation}
                  onAddStaff={addStaff}
                  onRemoveStaff={fireStaff}
                />
              )}
            </div>

          </div>
        )}

        {/* 季节选择弹窗 */}
        <SeasonSelectDialog
          open={showSeasonSelect}
          onSelect={(season) => {
            openStore(season);
            setShowSeasonSelect(false);
          }}
          onCancel={() => setShowSeasonSelect(false)}
        />

        {gameState.gamePhase === 'operating' && (
          <div className="space-y-6">
            {/* 状态面板区域 - 顶部显示认知 */}
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <CognitionPanel
                cognition={gameState.cognition}
                consecutiveProfits={gameState.consecutiveProfits}
                currentProfit={currentStats.profit}
                cumulativeProfit={gameState.cumulativeProfit}
                totalInvestment={gameState.totalInvestment}
              />
            </div>

            {/* 主要操作标签页（渐进式解锁） */}
            <Tabs defaultValue="operating" className="w-full">
              <TabsList className="w-full flex bg-[#151d2b] border border-[#1e293b] overflow-x-auto">
                {/* 已解锁的Tab */}
                {isPanelUnlocked('operating', gameState.cognition.level) && (
                  <TabsTrigger value="operating" className="flex-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                    <Play className="w-4 h-4 mr-1" />
                    经营
                  </TabsTrigger>
                )}
                {isPanelUnlocked('staff', gameState.cognition.level) && (
                  <TabsTrigger value="staff" className="flex-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                    <Users className="w-4 h-4 mr-1" />
                    人员
                  </TabsTrigger>
                )}
                {isPanelUnlocked('inventory', gameState.cognition.level) && (
                  <TabsTrigger value="inventory" className="flex-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                    <Package className="w-4 h-4 mr-1" />
                    库存
                  </TabsTrigger>
                )}
                {isPanelUnlocked('marketing', gameState.cognition.level) && (
                  <TabsTrigger value="marketing" className="flex-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                    <Megaphone className="w-4 h-4 mr-1" />
                    营销
                  </TabsTrigger>
                )}
                {isPanelUnlocked('finance', gameState.cognition.level) && (
                  <TabsTrigger value="finance" className="flex-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                    <Calculator className="w-4 h-4 mr-1" />
                    财务
                  </TabsTrigger>
                )}
                {isPanelUnlocked('supplydemand', gameState.cognition.level) && (
                  <TabsTrigger value="supplydemand" className="flex-1 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    供需
                  </TabsTrigger>
                )}

                {/* 未解锁的Tab（锁定状态提示） */}
                {([
                  { id: 'inventory' as const, label: '库存', icon: Package, level: PANEL_UNLOCK_CONFIG.inventory },
                  { id: 'marketing' as const, label: '营销', icon: Megaphone, level: PANEL_UNLOCK_CONFIG.marketing },
                  { id: 'finance' as const, label: '财务', icon: Calculator, level: PANEL_UNLOCK_CONFIG.finance },
                  { id: 'supplydemand' as const, label: '供需', icon: TrendingUp, level: PANEL_UNLOCK_CONFIG.supplydemand },
                ] as const).filter(tab => !isPanelUnlocked(tab.id, gameState.cognition.level)).map(tab => (
                    <div
                      key={tab.id}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-slate-600 cursor-not-allowed"
                      title={`认知等级 ${tab.level} 解锁`}
                    >
                      <Lock className="w-3 h-3" />
                      <span className="text-xs">{tab.label}</span>
                    </div>
                ))}
              </TabsList>

              <TabsContent value="operating" className="mt-6">
                <OperatingPanel
                  gameState={gameState}
                  currentStats={currentStats}
                  cognitionLevel={gameState.cognition.level}
                  onJoinPlatform={joinPlatform}
                  onLeavePlatform={leavePlatform}
                  onTogglePromotion={togglePromotion}
                  onSetDiscountTier={setDiscountTier}
                  onSetDeliveryPricing={setDeliveryPricing}
                  onSetPackagingTier={setPackagingTier}
                  onNextWeek={nextWeek}
                  onClearEvent={clearLastWeekEvent}
                  onShowReview={() => setShowReview(true)}
                  hasLastSummary={!!gameState.lastWeeklySummary}
                  lastWeeklySummary={gameState.lastWeeklySummary ?? undefined}
                  onSetProductPrice={setProductPrice}
                  onToggleProduct={toggleProduct}
                  allProducts={products}
                  supplyDemandResult={supplyDemandResult ?? undefined}
                  onSetBossAction={setBossAction}
                  onSetSupplyPriority={setSupplyPriority}
                />
              </TabsContent>

              <TabsContent value="supplydemand" className="mt-6">
                <SupplyDemandPanel result={supplyDemandResult} cognitionLevel={gameState.cognition.level} gameState={gameState} />
              </TabsContent>

              <TabsContent value="finance" className="mt-6">
                <FinanceDashboard gameState={gameState} currentStats={currentStats} />
              </TabsContent>

              <TabsContent value="marketing" className="mt-6">
                <MarketingPanel
                  gameState={gameState}
                  cognitionLevel={gameState.cognition.level}
                  onStartActivity={startMarketingActivity}
                  onStopActivity={stopMarketingActivity}
                />
              </TabsContent>

              <TabsContent value="staff" className="mt-6">
                <StaffPanel
                  staff={gameState.staff}
                  cash={gameState.cash}
                  currentWeek={gameState.currentWeek}
                  cognitionLevel={gameState.cognition.level}
                  storeArea={gameState.selectedAddress?.area || gameState.storeArea}
                  wageLevel={gameState.selectedLocation?.wageLevel || 1}
                  staffWorkStats={(gameState.weeklySummary ?? gameState.lastWeeklySummary)?.staffWorkStats}
                  lastTeamMealWeek={gameState.lastTeamMealWeek}
                  onRecruit={recruitStaff}
                  onFire={fireStaff}
                  onAssignTask={assignStaffToTask}
                  onSetWorkHours={setStaffWorkHours}
                  onSetSalary={setStaffSalary}
                  onMoraleAction={staffMoraleAction}
                  onRetainStaff={retainStaff}
                  selectedProducts={gameState.selectedProducts}
                  onSetFocusProduct={setStaffFocusProduct}
                />
              </TabsContent>

              <TabsContent value="inventory" className="mt-6">
                <InventoryPanel
                  inventoryState={gameState.inventoryState}
                  lastWeekFulfillment={gameState.lastWeekFulfillment}
                  cognitionLevel={gameState.cognition.level}
                  onChangeStrategy={setRestockStrategy}
                  onSetQuantity={setProductInventory}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {gameState.gamePhase === 'ended' && (
          <GameResult
            gameState={gameState}
            result={gameResult}
            onRestart={restart}
          />
        )}

        {/* 交互式事件弹窗（优先于周总结，玩家必须先做选择） */}
        {gameState.pendingInteractiveEvent && (
          <EventDialog
            event={gameState.pendingInteractiveEvent}
            gameState={gameState}
            onRespond={respondToEvent}
          />
        )}

        {/* 每周总结弹窗（交互事件优先，避免双弹窗） */}
        {gameState.weeklySummary && !gameState.pendingInteractiveEvent && (
          <WeeklySummaryDialog
            summary={gameState.weeklySummary}
            cognitionLevel={gameState.cognition.level}
            onClose={() => {
              // 关闭周报前，捕获升级信息用于后续庆祝弹窗
              if (gameState.weeklySummary?.cognitionLevelUp) {
                setPendingLevelUp(gameState.weeklySummary.cognitionLevelUp);
              }
              clearWeeklySummary();
            }}
            onOpenCyberYongGe={() => setShowCyberYongGe(true)}
          />
        )}

        {/* 认知等级提升庆祝弹窗 */}
        {pendingLevelUp && (
          <CognitionLevelUpDialog
            fromLevel={pendingLevelUp.fromLevel}
            toLevel={pendingLevelUp.toLevel}
            onClose={() => setPendingLevelUp(null)}
          />
        )}

        {/* 回顾弹窗（查看上周总结存档） */}
        {showReview && gameState.lastWeeklySummary && (
          <WeeklySummaryDialog
            summary={gameState.lastWeeklySummary}
            cognitionLevel={gameState.cognition.level}
            onClose={() => setShowReview(false)}
          />
        )}
      </main>

      {/* 赛博勇哥诊断面板 */}
      {gameState.gamePhase === 'operating' && (
        <CyberYongGe
          open={showCyberYongGe}
          onOpenChange={setShowCyberYongGe}
          gameState={gameState}
          currentStats={currentStats}
          supplyDemandResult={supplyDemandResult}
          onConsult={() => {
            const times = gameState.cognition.consultYongGeThisWeek || 0;
            if (times >= PASSIVE_EXP_CONFIG.consultYongGeWeeklyLimit) return false;
            if (gameState.cash < PASSIVE_EXP_CONFIG.consultYongGeCost) return false;
            consultYongGe();
            return true;
          }}
          onApplyProposals={handleApplyProposals}
          consultCost={PASSIVE_EXP_CONFIG.consultYongGeCost}
          consultLimit={PASSIVE_EXP_CONFIG.consultYongGeWeeklyLimit}
          consultedThisWeek={gameState.cognition.consultYongGeThisWeek || 0}
          healthAlerts={healthAlerts}
        />
      )}
    </div>
      )}
    </>
  );
}

export default App;
