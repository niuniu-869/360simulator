/**
 * healthCheck.ts — 经营健康诊断引擎
 *
 * 纯函数模块，覆盖"沉默地带"：玩家慢性失血但无任何提示的场景。
 * 输入 GameState + CurrentStats + SupplyDemandResult，输出 HealthAlert[]。
 *
 * v2.8: 诊断文案尊重认知等级，低等级用口语化模糊数字，避免与周报上方模糊数据矛盾。
 *       no_delivery 规则检查认知等级与品牌类型，不推荐玩家暂时执行不了的操作。
 *       demand_collapse 增加绝对销量下限，高销量场景不再误报"门可罗雀"。
 */

import type { GameState, SupplyDemandResult, HealthAlert, CognitionLevel } from '@/types/game';
import type { CurrentStats } from '@/lib/gameQuery';
import { DELIVERY_PLATFORMS } from '@/data/deliveryData';
import { QUICK_FRANCHISE_HONEYMOON } from '@/lib/gameEngine';
import { colloquialAmount } from '@/lib/fuzzUtils';

export type { HealthAlert };

// ============ 认知等级感知的模糊化工具 ============

/** 根据认知等级模糊化金额：Lv0 口语化，Lv1 粗略，Lv2+ 精确 */
function fuzzMoney(value: number, level: CognitionLevel): string {
  const abs = Math.abs(value);
  if (level === 0) return colloquialAmount(abs, 0);
  if (level === 1) return colloquialAmount(abs, 1);
  return Math.round(value) + '元';
}

/** 根据认知等级模糊化百分比：Lv0 口语化，Lv1 粗略，Lv2+ 精确 */
function fuzzPercent(value: number, level: CognitionLevel): string {
  if (level === 0) {
    if (value < 20) return '很低';
    if (value < 40) return '不太行';
    if (value < 60) return '一般';
    if (value < 80) return '还行';
    return '挺高';
  }
  if (level === 1) return '约' + (Math.round(value / 10) * 10) + '%';
  return Math.round(value) + '%';
}

/** 根据认知等级模糊化士气值：Lv0 口语描述，Lv1 粗略，Lv2+ 精确 */
function fuzzMorale(value: number, level: CognitionLevel): string {
  if (level === 0) {
    if (value < 20) return '快崩了';
    if (value < 35) return '很低迷';
    if (value < 50) return '不太好';
    if (value < 65) return '还凑合';
    if (value < 80) return '还不错';
    return '干劲十足';
  }
  if (level === 1) return '约' + (Math.round(value / 10) * 10);
  return String(Math.round(value));
}

// ============ 诊断规则 ============

export function diagnoseHealth(
  state: GameState,
  stats: CurrentStats,
  sdResult: SupplyDemandResult | null,
): HealthAlert[] {
  if (state.gamePhase !== 'operating') return [];

  const alerts: HealthAlert[] = [];
  const cl = state.cognition.level as CognitionLevel; // 当前认知等级

  // 1. chronic_loss: 连续3周亏损
  if (state.profitHistory.length >= 3) {
    const last3 = state.profitHistory.slice(-3);
    if (last3.every(p => p < 0)) {
      alerts.push({
        id: 'chronic_loss',
        severity: 'critical',
        title: '连续亏损警报！',
        message: '哥们，你已经连续3周亏钱了，再这样下去现金流要断了。不要跟我说感觉，给我看数据！',
        suggestion: '立刻检查固定成本结构，考虑裁减冗余人员或停止低效营销活动。',
        relatedCaseId: 'milktea-tower',
        category: 'finance',
      });
    }
  }

  // 2. slow_bleeding: 微利陷阱（利润为正但<固定成本的10%）
  if (stats.profit > 0 && stats.fixedCost > 0 && stats.profit < stats.fixedCost * 0.1) {
    alerts.push({
      id: 'slow_bleeding',
      severity: 'warning',
      title: '微利陷阱',
      message: '看着是赚钱了，但这点利润连固定成本的零头都不够。一个意外就能把你打回亏损。',
      suggestion: '提升客单价或增加高毛利产品，目标是利润覆盖固定成本的30%以上。',
      category: 'finance',
    });
  }

  // 3. low_exposure: 曝光度<25 且无营销活动
  if (state.exposure < 25 && state.activeMarketingActivities.length === 0) {
    const hasMarketer = state.staff.some(s => s.assignedTask === 'marketer' && !s.isOnboarding);
    alerts.push({
      id: 'low_exposure',
      severity: 'warning',
      title: '没人知道你的店',
      message: '曝光度太低了，周围的人根本不知道你这有家店。酒香也怕巷子深啊！',
      suggestion: hasMarketer
        ? '已有营销员但曝光仍低，建议配合社交媒体推广或本地广告投放加速提升。'
        : '安排一名营销员发传单拉客，或启动社交媒体推广，先把知名度拉起来。',
      relatedCaseId: 'fourth-burger',
      category: 'marketing',
    });
  }

  // 3.5 no_marketer_low_exposure: 曝光度<25 且无营销员且无营销活动
  if (state.exposure < 25
    && !state.staff.some(s => s.assignedTask === 'marketer' && !s.isOnboarding)
    && state.activeMarketingActivities.length === 0
    && state.currentWeek > 3) {
    alerts.push({
      id: 'no_marketer_low_exposure',
      severity: 'info',
      title: '没人帮你拉客',
      message: '既没有营销员也没有营销活动，曝光度全靠自然衰减，知名度只会越来越低。',
      suggestion: '安排一名员工做营销岗，或者启动一个营销活动。',
      category: 'marketing',
    });
  }

  // 4. low_reputation: 口碑<40
  if (state.reputation < 40 && state.currentWeek > 4) {
    alerts.push({
      id: 'low_reputation',
      severity: 'warning',
      title: '口碑堪忧',
      message: '回头客太少了，说明顾客体验有问题。口碑上不去，做再多推广也是白搭。',
      suggestion: '检查服务质量和满足率，考虑食材升级或服务培训。',
      category: 'marketing',
    });
  }

  // 5. supply_shortage: 满足率<0.7
  if (sdResult && sdResult.demand.totalDemand > 0) {
    const fulfillment = sdResult.supply.totalSupply > 0
      ? Math.min(1, sdResult.totalSales / sdResult.demand.totalDemand)
      : 0;
    if (fulfillment < 0.7) {
      alerts.push({
        id: 'supply_shortage',
        severity: 'critical',
        title: '供不应求！',
        message: '有顾客来了却买不到东西，这是在往外推客人啊！满足率才' +
          fuzzPercent(fulfillment * 100, cl) + '。',
        suggestion: '增加后厨人手或调整补货策略为激进模式，确保库存充足。',
        category: 'supply',
      });
    }

    // 6. demand_collapse: 总需求<总供给的30% 且 满足率>80%（真正的产能过剩）
    // 修复 #10：增加满足率校验，避免供需接近时误报"门可罗雀"
    // 修复 #11：增加绝对销量下限，周销量>3000份时不再误报（生意其实不差）
    const actualFulfillment = sdResult.supply.totalSupply > 0
      ? Math.min(1, sdResult.totalSales / Math.max(1, sdResult.demand.totalDemand))
      : 0;
    if (sdResult.supply.totalSupply > 0 &&
        sdResult.demand.totalDemand < sdResult.supply.totalSupply * 0.3 &&
        actualFulfillment > 0.8 &&
        sdResult.totalSales < 3000) {
      alerts.push({
        id: 'demand_collapse',
        severity: 'warning',
        title: '门可罗雀',
        message: '供给能力远超需求，员工闲着没事干。要么是位置不行，要么是没人知道你。',
        suggestion: '加大营销投入提升曝光度，或考虑上线外卖平台扩大客源。',
        relatedCaseId: 'oyster-bro',
        category: 'demand',
      });
    }
  }

  // 7/8. 定价检查
  state.selectedProducts.forEach(product => {
    const actualPrice = state.productPrices[product.id] || product.basePrice;

    // overpriced: 实际售价 > referencePrice×1.3
    if (actualPrice > product.referencePrice * 1.3) {
      alerts.push({
        id: `overpriced_${product.id}`,
        severity: 'warning',
        title: `${product.name}定价过高`,
        message: `${product.name}卖${actualPrice}元，消费者心理价位才${product.referencePrice}元，贵了太多没人买。`,
        suggestion: `建议将${product.name}降价到${Math.round(product.referencePrice * 1.1)}元左右。`,
        category: 'pricing',
      });
    }

    // underpriced: 实际售价 < baseCost×1.3（毛利率<23%）
    if (actualPrice < product.baseCost * 1.3) {
      alerts.push({
        id: `underpriced_${product.id}`,
        severity: 'warning',
        title: `${product.name}卖太便宜了`,
        message: `${product.name}成本${product.baseCost}元，卖${actualPrice}元，毛利率才${Math.round((1 - product.baseCost / actualPrice) * 100)}%，赚个寂寞。`,
        suggestion: `建议将${product.name}提价到${Math.round(product.baseCost * 1.5)}元以上。`,
        category: 'pricing',
      });
    }
  });

  // 9. no_delivery: 经营>6周且未上外卖平台
  // 修复：检查玩家当前认知等级是否足以加入至少一个平台，避免推荐不可执行的操作
  if (state.currentWeek > 6 && state.deliveryState.platforms.length === 0) {
    const brandKey = (state.selectedBrand?.type === 'franchise' || state.selectedBrand?.isQuickFranchise)
      ? 'franchise' : 'independent';
    const canJoinAny = DELIVERY_PLATFORMS.some(
      p => cl >= (p.minCognitionByBrandType[brandKey] ?? 99)
    );
    if (canJoinAny) {
      alerts.push({
        id: 'no_delivery',
        severity: 'info',
        title: '还没上外卖？',
        message: '都开了6周了还没上外卖平台，现在餐饮不做外卖等于少了一条腿。',
        suggestion: '考虑上线美团或饿了么，扩大销售渠道。',
        category: 'delivery',
      });
    }
  }

  // 10. staff_salary_exceeds_revenue: 周工资>周收入的60%（收入为0时也触发）
  // 修复：使用 fixedCostBreakdown.salary（与引擎一致），避免手动重算偏差
  if (state.staff.length > 0) {
    const weeklySalary = stats.fixedCostBreakdown.salary;
    if (stats.revenue <= 0 ? weeklySalary > 0 : weeklySalary > stats.revenue * 0.6) {
      alerts.push({
        id: 'staff_salary_exceeds_revenue',
        severity: 'critical',
        title: '人工比营业额还高！',
        message: '你在做慈善呢？周工资' + fuzzMoney(weeklySalary, cl) +
          '，周收入才' + fuzzMoney(stats.revenue, cl) + '，人工占比超过60%了。',
        suggestion: '立刻裁减冗余员工，或调整工时降低人工成本。',
        relatedCaseId: 'milktea-tower',
        category: 'staff',
      });
    }
  }

  // 11. no_chef_for_meal: 有meal品类但无chef岗位
  const hasMealProduct = state.selectedProducts.some(p => p.category === 'meal');
  const hasChef = state.staff.some(s => s.assignedTask === 'chef');
  if (hasMealProduct && !hasChef) {
    alerts.push({
      id: 'no_chef_for_meal',
      severity: 'warning',
      title: '卖饭没厨师？',
      message: '你卖正餐但没有后厨人员，出餐能力严重不足。',
      suggestion: '招聘一名厨师并分配到后厨岗位。',
      category: 'staff',
    });
  }

  // 12. high_waste: 库存损耗成本>变动成本的20%
  if (stats.variableCost > 0 && state.inventoryState.weeklyWasteCost > stats.variableCost * 0.2) {
    alerts.push({
      id: 'high_waste',
      severity: 'warning',
      title: '损耗太大了',
      message: '库存损耗占变动成本的' +
        fuzzPercent(state.inventoryState.weeklyWasteCost / stats.variableCost * 100, cl) +
        '，东西都烂在仓库里了。',
      suggestion: '切换为保守补货策略，减少库存积压。',
      category: 'supply',
    });
  }

  // 13. low_cleanliness: 整洁度<40
  if ((state.cleanliness ?? 60) < 40) {
    const hasCleaner = state.staff.some(s => s.assignedTask === 'cleaner' && !s.isOnboarding);
    alerts.push({
      id: 'low_cleanliness',
      severity: 'warning',
      title: '店里太脏了',
      message: '整洁度太低，顾客进来一看环境就想走，差评也会越来越多。',
      suggestion: hasCleaner
        ? '已有勤杂工但整洁度仍低，考虑增加人手或减少工时压力。'
        : '安排一名员工做勤杂岗，负责店面清洁卫生。',
      relatedCaseId: 'foot-basin',
      category: 'staff',
    });
  }

  // ============ v2.7 员工系统升级诊断规则 ============

  // 14. underpaid_staff: 高技能低薪（技能≥3但薪资低于基准薪资）
  if (state.cognition.level >= 2) {
    state.staff.forEach(s => {
      if (s.skillLevel >= 3 && s.morale < 50) {
        // 简单判断：士气低+技能高 → 可能是薪资问题
        const avgMorale = state.staff.length > 0
          ? state.staff.reduce((sum, st) => sum + st.morale, 0) / state.staff.length : 50;
        if (s.morale < avgMorale - 10) {
          alerts.push({
            id: `underpaid_${s.id}`,
            severity: 'warning',
            title: `${s.name}可能不满薪资`,
            message: `${s.name}技能Lv.${s.skillLevel}，但士气只有${fuzzMorale(s.morale, cl)}，明显低于团队平均。老员工干得好却看不到回报，迟早要走。`,
            suggestion: `考虑给${s.name}加薪或发奖金，留住核心员工。`,
            category: 'staff',
          });
        }
      }
    });
  }

  // 15. low_morale_no_action: 平均士气<40且连续4周未使用士气管理工具
  if (state.staff.length > 0) {
    const avgMorale = state.staff.reduce((sum, s) => sum + s.morale, 0) / state.staff.length;
    if (avgMorale < 40 && (state.weeksSinceLastMoraleAction || 99) >= 4) {
      alerts.push({
        id: 'low_morale_no_action',
        severity: 'critical',
        title: '团队士气崩了！',
        message: `平均士气只有${fuzzMorale(avgMorale, cl)}，而且你已经${state.weeksSinceLastMoraleAction || '很多'}周没管过员工了。人心散了，队伍不好带了。`,
        suggestion: '立刻组织团建聚餐提振士气，或给表现好的员工发奖金。认知达到Lv1即可使用士气管理工具。',
        category: 'staff',
      });
    }
  }

  // 16. all_staff_exhausted: 全员疲劳>70
  if (state.staff.length > 0) {
    const exhaustedCount = state.staff.filter(s => !s.isOnboarding && s.fatigue > 70).length;
    const activeCount = state.staff.filter(s => !s.isOnboarding).length;
    if (activeCount > 0 && exhaustedCount === activeCount) {
      alerts.push({
        id: 'all_staff_exhausted',
        severity: 'critical',
        title: '全员过劳！',
        message: '所有员工疲劳度都超过70%了，效率大打折扣，离职风险极高。再不休息就要集体罢工了。',
        suggestion: '减少工时、安排轮休，或给疲劳最严重的员工放一天假。',
        category: 'staff',
      });
    }
  }

  // ============ v3.0 外卖运营诊断规则 ============

  // 20. delivery_no_discount: 上了外卖但没设满减
  if (state.deliveryState.platforms.length > 0) {
    const allNoDiscount = state.deliveryState.platforms.every(p => p.discountTierId === 'none');
    if (allNoDiscount && state.currentWeek > 2) {
      alerts.push({
        id: 'delivery_no_discount',
        severity: 'warning',
        title: '外卖没做满减！',
        message: '上了外卖但一个满减活动都没设，平台会严重降权，几乎没有自然流量。现在做外卖不做满减等于白上。',
        suggestion: '至少设置"小额满减"（满20减3），标准满减效果更好但补贴成本更高，根据毛利率选择。',
        category: 'delivery',
      });
    }
  }

  // 21. delivery_loss_leader_warning: 亏本冲量满减持续超过3周
  if (state.deliveryState.platforms.length > 0) {
    const lossLeaderPlatforms = state.deliveryState.platforms.filter(
      p => p.discountTierId === 'loss_leader' && p.activeWeeks > 3
    );
    if (lossLeaderPlatforms.length > 0) {
      alerts.push({
        id: 'delivery_loss_leader',
        severity: 'warning',
        title: '亏本冲量不能长干！',
        message: '满减力度太大了，每单都在亏钱补贴顾客。冲量可以短期做，长期做就是给平台打工。',
        suggestion: '单量稳定后切换到"标准满减"或"小额满减"，靠口碑和复购维持单量。',
        category: 'delivery',
      });
    }
  }

  // ============ v2.8 勇哥案例新增诊断规则 ============

  // 17. sunk_cost_trap: 沉没成本陷阱（累计亏损>总投资50%，还在硬撑）
  // 教训16：已经损失的钱不要追，及时止损才是正确选择
  // 冷却：每4周最多提醒一次，避免每周重复弹出同一条 critical 警告
  if (state.cumulativeProfit < -(state.totalInvestment * 0.5) && state.currentWeek > 6
      && state.currentWeek % 4 === 0) {
    alerts.push({
      id: 'sunk_cost_trap',
      severity: 'critical',
      title: '沉没成本陷阱！',
      message: '已经亏了总投资的一半以上了，你还在想"再试试"？越陷越深只会亏得更多。',
      suggestion: '冷静算一笔账：按目前趋势还要亏多久？如果看不到扭亏的具体路径，及时止损比硬撑更明智。',
      relatedCaseId: 'village-bar',
      category: 'finance',
    });
  }

  // 18. honeymoon_cliff: 快招品牌蜜月期悬崖预警
  // 教训1-4：快招品牌蜜月期结束后供货成本暴涨、虚假口碑消失
  if (state.selectedBrand?.isQuickFranchise) {
    const hw = QUICK_FRANCHISE_HONEYMOON.weeks;
    // 蜜月期倒数第1-2周：提前预警
    if (state.currentWeek >= hw - 1 && state.currentWeek <= hw) {
      alerts.push({
        id: 'honeymoon_cliff',
        severity: 'warning',
        title: '蜜月期快结束了…',
        message: '快招品牌的"扶持期"马上到期，之后供货成本会暴涨，总部刷的好评也会消失。做好心理准备。',
        suggestion: '提前储备现金，考虑寻找替代供应商或调整产品结构降低对总部供货的依赖。',
        relatedCaseId: 'naza-drink',
        category: 'finance',
      });
    }
    // 蜜月期刚结束（第9-10周）：事后确认
    if (state.currentWeek === hw + 1 || state.currentWeek === hw + 2) {
      alerts.push({
        id: 'honeymoon_over',
        severity: 'critical',
        title: '蜜月期结束了！',
        message: '总部的"扶持"已经撤了，供货成本回到真实水平，口碑加成也没了。接下来才是真正的考验。',
        suggestion: '重新核算盈亏平衡点，如果发现根本不赚钱，趁早考虑转型或止损。',
        relatedCaseId: 'naza-drink',
        category: 'finance',
      });
    }
  }

  // 19. revenue_below_breakeven: 营业额远低于盈亏平衡点
  // 算账知识：日盈亏平衡点 = 日固定成本 / 毛利率
  if (stats.breakEvenPoint > 0 && stats.breakEvenPoint < Infinity &&
      stats.revenue < stats.breakEvenPoint * 0.5 && state.currentWeek > 3) {
    alerts.push({
      id: 'revenue_below_breakeven',
      severity: 'critical',
      title: '离保本还远着呢',
      message: '你的营业额连盈亏平衡点的一半都不到。简单说：每开一天都在亏钱，而且亏得不少。',
      suggestion: '盈亏平衡点 = 固定成本 ÷ 毛利率。要么想办法把营业额翻倍，要么砍固定成本。两头都动不了就该考虑止损了。',
      category: 'finance',
    });
  }

  return alerts;
}
