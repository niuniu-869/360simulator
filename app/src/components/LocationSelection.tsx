import type { Location, StoreAddress, NearbyShop } from '@/types/game';
import { locations } from '@/data/gameData';
import { MapPin, DollarSign, Check, Lock, Store, X } from 'lucide-react';
import { formatMoney } from '@/lib/fuzzUtils';

interface LocationSelectionProps {
  selectedLocation: Location | null;
  selectedAddress: StoreAddress | null;
  storeArea: number;
  nearbyShops: NearbyShop[];
  onSelectLocation: (location: Location | null) => void;
  onSelectAddress: (address: StoreAddress | null) => void;
  onSetArea: (area: number) => void;
  isLocked?: boolean;
  isQuickFranchise?: boolean;
}

export function LocationSelection({
  selectedLocation,
  selectedAddress,
  storeArea: _storeArea,
  nearbyShops,
  onSelectLocation,
  onSelectAddress,
  onSetArea: _onSetArea,
  isLocked = false,
  isQuickFranchise = false
}: LocationSelectionProps) {
  void _storeArea;
  void _onSetArea;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="ark-title">选址决策</h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <MapPin className="w-4 h-4 text-orange-500" />
          <span>360度转一圈，看清商圈</span>
        </div>
      </div>

      {/* 区位选择 - 点击直接选择 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((location) => {
          const isSelected = selectedLocation?.id === location.id;

          return (
            <div
              key={location.id}
              className={`
                ark-card ark-corner-border p-5 transition-all duration-300
                ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                ${isSelected ? 'ark-selected' : isLocked ? '' : 'hover:border-orange-500/50'}
              `}
              onClick={() => !isLocked && onSelectLocation(location)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{location.image}</span>
                  <div>
                    <h3 className="font-bold text-white">{location.name}</h3>
                    <p className="text-xs text-slate-500">{location.description}</p>
                  </div>
                </div>
                <div className={`
                  w-6 h-6 flex items-center justify-center border
                  ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-600'}
                `}>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </div>
              </div>

              {/* 客流量分布 - 筹备阶段认知为0，隐藏精确数据 */}
              <div className="space-y-2 mb-4">
                <p className="text-xs text-slate-500">日均客流量: <span className="text-slate-400">需要实地考察才能了解</span></p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400">租金:</span>
                  <span className="font-mono text-orange-400">¥{location.rentPerSqm}/㎡</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 店铺地址选择 */}
      {selectedLocation && selectedLocation.addresses && (
        <div className="ark-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Store className="w-4 h-4 text-orange-500" />
              选择具体店铺
              {isLocked && <span className="text-xs text-red-400 ml-2">(已锁定)</span>}
            </h3>
            {!isLocked && !selectedAddress && (
              <span className="text-sm text-orange-400 font-medium">请选择具体店铺（必选）</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {selectedLocation.addresses.map((address) => {
              const isAddressSelected = selectedAddress?.id === address.id;
              const actualRent = Math.round(selectedLocation.rentPerSqm * address.rentModifier * address.area);

              return (
                <div
                  key={address.id}
                  className={`
                    p-4 border transition-all duration-200
                    ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                    ${isAddressSelected
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-slate-700 hover:border-orange-500/50 bg-[#0a0e17]'}
                  `}
                  onClick={() => !isLocked && onSelectAddress(address)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">{address.name}</span>
                    <div className={`
                      w-6 h-6 flex items-center justify-center border transition-all
                      ${isAddressSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-600'}
                    `}>
                      {isAddressSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{address.description}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">面积</span>
                      <span className="text-white font-mono">{address.area}㎡</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">月租金</span>
                      <span className="font-mono text-orange-400">
                        {formatMoney(actualRent)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">客流修正</span>
                      <span className={`font-mono ${address.trafficModifier > 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {`${address.trafficModifier > 1 ? '+' : ''}${((address.trafficModifier - 1) * 100).toFixed(0)}%`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 周边店铺展示 */}
      {selectedAddress && nearbyShops.length > 0 && (
        <div className="ark-card p-5">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <Store className="w-4 h-4 text-orange-500" />
            周边店铺
            <span className="text-xs text-slate-400 ml-auto">
              {nearbyShops.filter(s => !s.isClosing).length} 家
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {nearbyShops.filter(s => !s.isClosing).slice(0, 6).map(shop => {
              const avgPrice = shop.products.length > 0
                ? shop.products.reduce((s, p) => s + p.price, 0) / shop.products.length
                : 0;
              return (
                <div key={shop.id} className="flex items-center gap-2 p-2 bg-[#0a0e17] border border-[#1e293b] text-xs">
                  <span className="text-lg">{shop.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{shop.name}</div>
                    <div className="text-slate-500">
                      {shop.brandType === 'chain' ? '连锁' : '独立'} · {shop.shopCategory === 'drink' ? '饮品' : shop.shopCategory === 'food' ? '快餐' : shop.shopCategory === 'snack' ? '小吃' : shop.shopCategory === 'meal' ? '正餐' : shop.shopCategory}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-orange-400 font-mono">¥{avgPrice.toFixed(0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {nearbyShops.filter(s => !s.isClosing).length > 6 && (
            <p className="text-xs text-slate-500 text-center mt-2">
              还有 {nearbyShops.filter(s => !s.isClosing).length - 6} 家...
            </p>
          )}
        </div>
      )}

      {/* 确认区域 */}
      {selectedLocation && selectedAddress && (
        <div className={`border p-4 rounded-lg ${isLocked && isQuickFranchise ? 'bg-red-500/10 border-red-500/50' : 'bg-emerald-500/10 border-emerald-500/50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLocked && isQuickFranchise ? (
                <>
                  <Lock className="w-4 h-4 text-red-500" />
                  <span className="font-bold text-red-400">选址老师推荐</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold text-emerald-500">已选择店铺</span>
                </>
              )}
            </div>
            {/* 取消选择按钮 */}
            {!isLocked && (
              <button
                onClick={() => {
                  onSelectAddress(null);
                  onSelectLocation(null);
                }}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="取消选择"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-sm text-slate-300 mt-2">
            {selectedLocation.name} · {selectedAddress.name}
          </p>
          <p className="text-sm text-slate-400">
            面积 {selectedAddress.area}㎡，预估月租金 {formatMoney(Math.round(selectedLocation.rentPerSqm * selectedAddress.rentModifier * selectedAddress.area))}
          </p>
          {isLocked && isQuickFranchise && (
            <p className="text-xs text-red-400 mt-2">
              ⚠️ 总部选址老师已为您锁定此位置，无法更改
            </p>
          )}
        </div>
      )}

    </div>
  );
}
