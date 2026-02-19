import type { Product, Location } from '@/types/game';
import { products } from '@/data/gameData';
import { Utensils, Check, Plus, Lock, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ProductSelectionProps {
  selectedProducts: Product[];
  selectedLocation: Location | null;
  onToggleProduct: (product: Product) => void;
  isLocked?: boolean;
  isQuickFranchise?: boolean;
  supplyCostModifier?: number;
  allowedCategories?: ('drink' | 'food' | 'snack' | 'meal')[];
}

export function ProductSelection({
  selectedProducts,
  selectedLocation,
  onToggleProduct,
  isLocked = false,
  isQuickFranchise = false,
  supplyCostModifier = 1.0,
  allowedCategories
}: ProductSelectionProps) {

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'drink':
        return '饮品';
      case 'food':
        return '食品';
      case 'snack':
        return '小吃';
      case 'meal':
        return '正餐';
      default:
        return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'drink':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'food':
        return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
      case 'snack':
        return 'text-pink-400 bg-pink-400/10 border-pink-400/30';
      case 'meal':
        return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
      default:
        return 'text-slate-400 bg-slate-400/10 border-slate-400/30';
    }
  };

  // 处理选择/取消选择（阻止冒泡，不触发 Dialog）
  const handleToggle = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isLocked) {
      const isCategoryRestricted = allowedCategories && !allowedCategories.includes(product.category as 'drink' | 'food' | 'snack' | 'meal');
      if (!isCategoryRestricted) {
        onToggleProduct(product);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="ark-title">选品策略</h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Utensils className="w-4 h-4 text-orange-500" />
            <span>已选: <span className="text-orange-500 font-mono">{selectedProducts.length}/5</span></span>
          </div>
        </div>
      </div>

      {/* 选品提示 */}
      {selectedLocation && (
        <div className="bg-[#0a0e17] p-3 border border-[#1e293b]">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>💡</span>
            <span>
              {selectedLocation.type === 'school' && '学校周边推荐：奶茶、汉堡、薯条、甜品'}
              {selectedLocation.type === 'office' && '写字楼区推荐：咖啡、盒饭、面条、烘焙'}
              {selectedLocation.type === 'community' && '居民区推荐：面条、烘焙、甜品、奶茶'}
              {selectedLocation.type === 'business' && '商业街区推荐：全品类均可'}
              {selectedLocation.type === 'tourist' && '景区周边推荐：奶茶、烤串、甜品、小吃'}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => {
          const isSelected = selectedProducts.some(p => p.id === product.id);
          const isCategoryRestricted = allowedCategories && !allowedCategories.includes(product.category as 'drink' | 'food' | 'snack' | 'meal');
          const isDisabled = isLocked || !!isCategoryRestricted;

          return (
            <Dialog key={product.id}>
              <DialogTrigger asChild>
                <div
                  className={`
                    ark-card ark-corner-border p-5 transition-all duration-300
                    ${isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
                    ${isSelected ? 'ark-selected' : ''}
                    ${!isDisabled ? 'hover:border-orange-500/50' : ''}
                  `}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{product.icon}</span>
                      <div>
                        <h3 className="font-bold text-white">{product.name}</h3>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs px-2 py-0.5 border ${getCategoryColor(product.category)}`}>
                            {getCategoryName(product.category)}
                          </span>
                          {isCategoryRestricted && (
                            <span className="text-xs px-2 py-0.5 border border-red-500/30 text-red-400 bg-red-500/10">
                              品牌限制
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* 选择按钮：点击只切换选品，不弹窗 */}
                    <button
                      className={`
                        w-6 h-6 flex items-center justify-center border transition-all
                        ${isSelected
                          ? 'bg-orange-500 border-orange-500'
                          : !isDisabled
                            ? 'border-slate-600 hover:border-orange-500'
                            : 'border-slate-700 bg-slate-800 cursor-not-allowed'
                        }
                      `}
                      onClick={(e) => handleToggle(product, e)}
                      disabled={isDisabled}
                    >
                      {isSelected ? (
                        isLocked ? <Lock className="w-3 h-3 text-white" /> : <Check className="w-4 h-4 text-white" />
                      ) : (
                        <Plus className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>

                  {/* 价格信息 */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-[#0a0e17] p-2">
                      <p className="text-xs text-slate-500">成本</p>
                      <p className="font-mono text-red-400">¥{product.baseCost}</p>
                    </div>
                    <div className="bg-[#0a0e17] p-2">
                      <p className="text-xs text-slate-500">售价</p>
                      <p className="font-mono text-emerald-400">¥{product.basePrice}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2">{product.description}</p>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-slate-600">点击查看详情</span>
                    <Info className="w-4 h-4 text-slate-600" />
                  </div>
                </div>
              </DialogTrigger>

              <DialogContent className="bg-[#151d2b] border-[#1e293b] max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-white">
                    <span className="text-2xl">{product.icon}</span>
                    {product.name}
                    <span className={`text-xs px-2 py-0.5 border ${getCategoryColor(product.category)}`}>
                      {getCategoryName(product.category)}
                    </span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-slate-300">{product.description}</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0a0e17] p-3 border border-[#1e293b]">
                      <p className="text-xs text-slate-400">原料成本</p>
                      <p className="text-lg font-mono font-bold text-red-400">¥{product.baseCost}</p>
                    </div>
                    <div className="bg-[#0a0e17] p-3 border border-[#1e293b]">
                      <p className="text-xs text-slate-400">建议售价</p>
                      <p className="text-lg font-mono font-bold text-emerald-400">¥{product.basePrice}</p>
                    </div>
                  </div>

                  {/* 筹备阶段认知为0，隐藏毛利率和客群吸引力等市场洞察信息 */}
                  <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
                    <p className="text-xs text-slate-500 text-center">
                      🔒 客群吸引力、毛利率等市场数据需要经营经验才能了解
                    </p>
                  </div>

                  <button
                    className={`ark-button w-full ${isSelected ? 'bg-red-500/20 border-red-500 text-red-400' : 'ark-button-primary'}`}
                    onClick={() => onToggleProduct(product)}
                  >
                    {isSelected ? '移除选品' : '添加选品'}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })}
      </div>

      {/* 选品分析 */}
      {selectedProducts.length > 0 && (
        <div className={`p-4 border rounded-lg ${isLocked && isQuickFranchise ? 'bg-red-500/10 border-red-500/50' : 'bg-[#0a0e17] border-[#1e293b]'}`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              {isLocked && isQuickFranchise ? (
                <>
                  <Lock className="w-4 h-4 text-red-500" />
                  <span className="text-red-400">总部供货产品</span>
                </>
              ) : (
                '当前选品分析'
              )}
            </h4>
            {isLocked && isQuickFranchise && (
              <span className="text-xs text-red-400">(已锁定，无法更改)</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">平均客单价</p>
              <p className="text-lg font-mono text-emerald-400">
                ¥{(selectedProducts.reduce((sum, p) => sum + p.basePrice, 0) / selectedProducts.length).toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">品类数量</p>
              <p className="text-lg font-mono text-blue-400">
                {new Set(selectedProducts.map(p => p.category)).size} 类
              </p>
            </div>
          </div>
          {isLocked && isQuickFranchise && supplyCostModifier > 1 && (
            <p className="text-xs text-red-400 mt-3">
              ⚠️ 总部要求使用指定供应商，原料成本上浮 {((supplyCostModifier - 1) * 100).toFixed(0)}%，毛利率下降
            </p>
          )}
        </div>
      )}
    </div>
  );
}
