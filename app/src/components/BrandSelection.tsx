import { useState, useCallback, useEffect, useRef } from 'react';
import type { Brand } from '@/types/game';
import { brands } from '@/data/gameData';
import {
  generateDialogueFlow,
  quickFranchiseMap,
  quickFranchisePromo,
  TRAP_THRESHOLD,
  type DialogueNode,
  type DialogueOption
} from '@/data/brandDialogues';
import { Store, TrendingUp, Phone, MessageCircle, Clock, Gift, ChevronRight, X, Sparkles } from 'lucide-react';

interface BrandSelectionProps {
  selectedBrand: Brand | null;
  onSelect: (brand: Brand | null) => void;
  cash: number;
}

// 对话状态
interface DialogueState {
  isActive: boolean;
  targetBrand: Brand | null;        // 玩家想加盟的正规品牌
  quickBrand: Brand | null;         // 对应的快招品牌
  currentNodeId: string;
  trapScore: number;                // 累计的"被拐走"分数
  dialogueHistory: DialogueNode[];  // 对话历史
  showHighlights: boolean;          // 是否显示PPT亮点
  showCountdown: boolean;           // 是否显示倒计时
  isTyping: boolean;                // 打字机效果
}

// 获取正规品牌列表（不包含快招品牌和自主创业）
const getLegitBrands = () => {
  return brands.filter(b =>
    !b.isQuickFranchise &&
    b.id !== 'independent' &&
    b.id !== 'yogurt'  // 茉酸奶也排除，保持简洁
  );
};

// 获取自主创业选项
const getIndependentBrand = () => {
  return brands.find(b => b.id === 'independent');
};

// 格式化金额
const formatMoney = (amount: number) => {
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(1)}万`;
  }
  return `¥${amount.toLocaleString()}`;
};

export function BrandSelection({ selectedBrand, onSelect, cash }: BrandSelectionProps) {
  // 筹备阶段认知始终为0，直接使用基础阈值
  const adjustedTrapThreshold = TRAP_THRESHOLD;

  const [dialogueState, setDialogueState] = useState<DialogueState>({
    isActive: false,
    targetBrand: null,
    quickBrand: null,
    currentNodeId: 'start',
    trapScore: 0,
    dialogueHistory: [],
    showHighlights: false,
    showCountdown: false,
    isTyping: false,
  });

  const [dialogueNodes, setDialogueNodes] = useState<DialogueNode[]>([]);
  const dialogueEndRef = useRef<HTMLDivElement>(null);
  const dialogueStateRef = useRef(dialogueState);
  const dialogueNodesRef = useRef<DialogueNode[]>([]);
  const advanceDialogueRef = useRef<(nodeId: string, nodes?: DialogueNode[]) => void>(() => {});

  // 滚动到对话底部
  useEffect(() => {
    if (dialogueEndRef.current) {
      dialogueEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dialogueState.dialogueHistory]);

  useEffect(() => {
    dialogueStateRef.current = dialogueState;
  }, [dialogueState]);

  useEffect(() => {
    dialogueNodesRef.current = dialogueNodes;
  }, [dialogueNodes]);

  // 处理对话结束
  const handleDialogueEnd = useCallback(() => {
    setTimeout(() => {
      const { trapScore, targetBrand, quickBrand } = dialogueStateRef.current;

      if (trapScore >= adjustedTrapThreshold && quickBrand) {
        onSelect(quickBrand);
      } else if (targetBrand) {
        onSelect(targetBrand);
      }

      setDialogueState(prev => ({ ...prev, isActive: false, isTyping: false }));
    }, 1000);
  }, [onSelect, adjustedTrapThreshold]);

  // 推进对话
  const advanceDialogue = useCallback((nodeId: string, nodes?: DialogueNode[]) => {
    const activeNodes = nodes ?? dialogueNodesRef.current;
    const node = activeNodes.find(n => n.id === nodeId);
    if (!node) return;

    setDialogueState(prev => ({
      ...prev,
      currentNodeId: nodeId,
      dialogueHistory: [...prev.dialogueHistory, node],
      isTyping: false,
      showHighlights: node.effect?.type === 'highlight' || prev.showHighlights,
      showCountdown: node.effect?.type === 'countdown' || prev.showCountdown,
    }));

    if (!node.requireChoice && node.nextNodeId) {
      setTimeout(() => {
        setDialogueState(prev => ({ ...prev, isTyping: true }));
        setTimeout(() => {
          advanceDialogueRef.current(node.nextNodeId!, activeNodes);
        }, 800);
      }, 1200);
    }

    if (node.nextNodeId === null) {
      handleDialogueEnd();
    }
  }, [handleDialogueEnd]);

  useEffect(() => {
    advanceDialogueRef.current = advanceDialogue;
  }, [advanceDialogue]);

  // 开始对话流程
  const startDialogue = useCallback((brand: Brand) => {
    const quickBrandId = quickFranchiseMap[brand.id];
    const quickBrand = brands.find(b => b.id === quickBrandId) || null;
    const quickBrandName = quickBrand ? quickBrand.name : '新品牌';

    const nodes = generateDialogueFlow(brand.name, quickBrandName);
    setDialogueNodes(nodes);

    setDialogueState({
      isActive: true,
      targetBrand: brand,
      quickBrand,
      currentNodeId: 'start',
      trapScore: 0,
      dialogueHistory: [],
      showHighlights: false,
      showCountdown: false,
      isTyping: true,
    });

    // 开始第一个对话节点
    setTimeout(() => {
      advanceDialogueRef.current('start', nodes);
    }, 500);
  }, []);

  // 处理玩家选择
  const handleChoice = useCallback((option: DialogueOption) => {
    setDialogueState(prev => ({
      ...prev,
      trapScore: prev.trapScore + option.trapScore,
      isTyping: true,
    }));

    if (option.nextNodeId) {
      setTimeout(() => {
        advanceDialogue(option.nextNodeId!);
      }, 600);
    } else {
      // 结束对话
      setTimeout(() => {
        handleDialogueEnd();
      }, 600);
    }
  }, [advanceDialogue, handleDialogueEnd]);

  // 关闭对话（放弃）
  const closeDialogue = useCallback(() => {
    setDialogueState(prev => ({ ...prev, isActive: false }));
  }, []);

  // 直接选择自主创业
  const selectIndependent = useCallback(() => {
    const independentBrand = getIndependentBrand();
    if (independentBrand) {
      onSelect(independentBrand);
    }
  }, [onSelect]);

  const legitBrands = getLegitBrands();
  const independentBrand = getIndependentBrand();
  const currentNode = dialogueNodes.find(n => n.id === dialogueState.currentNodeId);

  // 渲染品牌卡片
  const renderBrandCard = (brand: Brand) => {
    const canAfford = cash >= brand.franchiseFee;

    return (
      <div
        key={brand.id}
        onClick={() => canAfford && startDialogue(brand)}
        className={`
          ark-card p-5 cursor-pointer transition-all duration-300
          hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10
          ${!canAfford ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-white">{brand.name}</h3>
          </div>
          <Phone className="w-4 h-4 text-slate-500" />
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">加盟费</span>
            <span className={`font-mono font-bold ${canAfford ? 'text-white' : 'text-red-400'}`}>
              ¥{formatMoney(brand.franchiseFee)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">品牌口碑</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i <= Math.ceil(brand.initialReputation / 20)
                      ? 'bg-orange-500'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 line-clamp-2">{brand.description}</p>

        <div className="mt-4 flex items-center justify-center gap-2 text-orange-500 text-sm">
          <span>点击咨询加盟</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    );
  };

  // 渲染对话消息
  const renderDialogueMessage = (node: DialogueNode, index: number) => {
    switch (node.type) {
      case 'system':
        return (
          <div key={`${node.id}-${index}`} className="text-center py-3">
            <span className="text-slate-400 text-sm italic">{node.content}</span>
          </div>
        );

      case 'npc':
        return (
          <div key={`${node.id}-${index}`} className="flex gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-blue-400 mb-1">{node.speaker}</div>
              <div className="bg-slate-800 rounded-lg rounded-tl-none p-3 text-sm text-slate-200">
                {node.content}
              </div>
            </div>
          </div>
        );

      case 'player':
        return (
          <div key={`${node.id}-${index}`} className="flex gap-3 mb-4 justify-end">
            <div className="flex-1 flex justify-end">
              <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg rounded-tr-none p-3 text-sm text-orange-100 max-w-[80%]">
                {node.content}
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm">你</span>
            </div>
          </div>
        );

      case 'thinking':
        return (
          <div key={`${node.id}-${index}`} className="flex justify-center mb-4">
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-400 italic max-w-[90%]">
              💭 {node.content}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // 主渲染
  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h2 className="ark-title">选择加盟品牌</h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Store className="w-4 h-4" />
          <span>启动资金: <span className="text-orange-500 font-mono">¥{formatMoney(cash)}</span></span>
        </div>
      </div>

      {/* 提示 */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          💡 <strong>小贴士：</strong>加盟前建议先咨询专业人士，了解品牌真实情况。小心"快招"公司冒充知名品牌！
        </p>
      </div>

      {/* 正规品牌列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {legitBrands.map(renderBrandCard)}
      </div>

      {/* 自主创业选项 */}
      {independentBrand && (
        <div
          onClick={selectIndependent}
          className="ark-card p-5 cursor-pointer transition-all duration-300 hover:border-blue-500/50 border-dashed"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Store className="w-6 h-6 text-blue-500" />
              <div>
                <h3 className="font-bold text-white">{independentBrand.name}</h3>
                <p className="text-xs text-slate-400">不加盟任何品牌，从零开始自主经营</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-emerald-400 font-bold">免加盟费</div>
              <div className="text-xs text-slate-500">风险自担</div>
            </div>
          </div>
        </div>
      )}

      {/* 已选择品牌反馈 */}
      {selectedBrand && (
        <div className={`rounded-lg p-4 ${
          selectedBrand.isQuickFranchise
            ? 'bg-red-500/10 border border-red-500/50'
            : 'bg-emerald-500/10 border border-emerald-500/50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                selectedBrand.isQuickFranchise ? 'bg-red-500/20' : 'bg-emerald-500/20'
              }`}>
                <TrendingUp className={`w-5 h-5 ${
                  selectedBrand.isQuickFranchise ? 'text-red-400' : 'text-emerald-400'
                }`} />
              </div>
              <div>
                <div className={`font-bold ${
                  selectedBrand.isQuickFranchise ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {selectedBrand.isQuickFranchise ? '⚠️ 已签约品牌' : '已选择加盟品牌'}
                </div>
                <div className="text-white text-lg">{selectedBrand.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-slate-400">加盟费</div>
                <div className="text-orange-400 font-mono font-bold">
                  ¥{formatMoney(selectedBrand.franchiseFee)}
                </div>
              </div>
              {/* 取消选择按钮 */}
              <button
                onClick={() => onSelect(null)}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="取消选择"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {selectedBrand.isQuickFranchise && (
            <p className="text-xs text-red-400 mt-3">
              ⚠️ 您已签约快招品牌，后续选址、装修、选品将受到限制
            </p>
          )}
        </div>
      )}

      {/* 对话框模态窗口 */}
      {dialogueState.isActive && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1117] border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* 对话框头部 */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-green-500 animate-pulse" />
                <span className="text-white font-medium">
                  正在咨询: {dialogueState.targetBrand?.name}
                </span>
              </div>
              <button
                onClick={closeDialogue}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 对话内容区域 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {dialogueState.dialogueHistory.map((node, index) =>
                renderDialogueMessage(node, index)
              )}

              {/* 打字指示器 */}
              {dialogueState.isTyping && (
                <div className="flex gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-slate-800 rounded-lg rounded-tl-none p-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={dialogueEndRef} />
            </div>

            {/* PPT亮点展示 */}
            {dialogueState.showHighlights && dialogueState.quickBrand && (
              <div className="mx-4 mb-4 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <span className="text-white font-bold">
                    {quickFranchisePromo[dialogueState.quickBrand.id]?.name || dialogueState.quickBrand.name} 核心优势
                  </span>
                </div>
                <div className="space-y-2">
                  {(quickFranchisePromo[dialogueState.quickBrand.id]?.highlights || []).map((h, i) => (
                    <div key={i} className="text-sm text-slate-200">{h}</div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 line-through text-sm">
                      原价: {quickFranchisePromo[dialogueState.quickBrand.id]?.originalPrice}
                    </span>
                    <span className="ml-3 text-2xl font-bold text-emerald-400">
                      现价: {quickFranchisePromo[dialogueState.quickBrand.id]?.currentPrice}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-red-400">
                    <Gift className="w-4 h-4" />
                    <span className="text-xs">限时优惠</span>
                  </div>
                </div>
              </div>
            )}

            {/* 倒计时显示 */}
            {dialogueState.showCountdown && dialogueState.quickBrand && (
              <div className="mx-4 mb-4 bg-red-900/30 border border-red-500/50 rounded-lg p-3 flex items-center justify-center gap-3">
                <Clock className="w-5 h-5 text-red-400 animate-pulse" />
                <span className="text-red-300 font-mono text-lg">
                  优惠倒计时: {quickFranchisePromo[dialogueState.quickBrand.id]?.deadline || '2:59:59'}
                </span>
              </div>
            )}

            {/* 选项按钮 */}
            {currentNode?.requireChoice && currentNode.options && !dialogueState.isTyping && (
              <div className="p-4 border-t border-slate-700 space-y-2">
                {currentNode.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleChoice(option)}
                    className={`
                      w-full p-3 rounded-lg text-left text-sm transition-all
                      ${option.trapScore > 20
                        ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 hover:border-orange-500/60 text-orange-100'
                        : option.trapScore > 0
                          ? 'bg-slate-800 border border-slate-600 hover:border-slate-500 text-slate-200'
                          : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600 text-slate-300'
                      }
                    `}
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
