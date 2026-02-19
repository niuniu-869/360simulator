/**
 * EventDialog.tsx — 交互式事件弹窗（v3.1）
 *
 * 展示交互事件描述 + 选项按钮。
 * 选择后显示 narrativeHint（叙事提示）和勇哥语录，不再展示数字效果。
 * 支持动态描述（函数类型 description）和纯通知型事件。
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Zap, MessageCircle, Brain, Info } from 'lucide-react';
import { resolveDescription } from '@/lib/eventEngine';
import type { InteractiveGameEvent, GameState } from '@/types/game';

interface EventDialogProps {
  event: InteractiveGameEvent;
  gameState: GameState;
  onRespond: (eventId: string, optionId: string) => void;
}

const CATEGORY_STYLES: Record<string, { icon: string; label: string; color: string }> = {
  franchise: { icon: '🏪', label: '加盟相关', color: 'text-purple-400' },
  operation: { icon: '⚠️', label: '经营事件', color: 'text-amber-400' },
  mindset:   { icon: '🧠', label: '心态考验', color: 'text-blue-400' },
  random:    { icon: '🎲', label: '随机事件', color: 'text-emerald-400' },
};

export function EventDialog({ event, gameState, onRespond }: EventDialogProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showQuote, setShowQuote] = useState(false);

  const categoryStyle = CATEGORY_STYLES[event.category] || CATEGORY_STYLES.random;
  const selectedOpt = event.options.find(o => o.id === selectedOption);
  const isNotification = event.options.length === 0 && event.notificationEffects;

  const handleSelect = (optionId: string) => {
    setSelectedOption(optionId);
    setShowQuote(true);
  };

  const handleConfirm = () => {
    if (isNotification) {
      // 通知型事件：用特殊 optionId 标识
      onRespond(event.id, '__notification__');
    } else if (selectedOption) {
      onRespond(event.id, selectedOption);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="bg-[#151d2b] border-[#1e293b] max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Zap className="w-5 h-5 text-amber-500" />
            <span>{event.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* 事件描述 */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded">
            <p className="text-sm text-slate-200 leading-relaxed">{resolveDescription(event, gameState)}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {categoryStyle.icon} {categoryStyle.label}
              </span>
            </div>
          </div>

          {isNotification ? (
            /* 纯通知型事件：勇哥语录（不展示数字效果） */
            <>
              {event.notificationQuote && (
                <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded">
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-orange-400 font-bold mb-1">勇哥说：</p>
                      <p className="text-sm text-slate-300 italic leading-relaxed">
                        {event.notificationQuote}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* 选择型事件：选项列表 */
            <div className="space-y-2">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Brain className="w-3 h-3" />
                你的选择：
              </p>
              {event.options.map(option => {
                const isSelected = selectedOption === option.id;
                return (
                  <button
                    key={option.id}
                    className={`w-full text-left p-3 border rounded transition-all ${
                      isSelected
                        ? 'bg-orange-500/20 border-orange-500/50'
                        : 'bg-[#0a0e17] border-[#1e293b] hover:border-slate-600'
                    }`}
                    onClick={() => handleSelect(option.id)}
                  >
                    <p className={`text-sm ${isSelected ? 'text-orange-300' : 'text-slate-200'}`}>
                      {option.text}
                    </p>
                    {/* v3.1: 选中后显示叙事提示（替代数字效果） */}
                    {isSelected && option.narrativeHint && (
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        <Info className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                        {option.narrativeHint}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 勇哥点评（选择型事件：选择后显示） */}
          {!isNotification && showQuote && selectedOpt && (
            <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded animate-in fade-in duration-300">
              <div className="flex items-start gap-2">
                <MessageCircle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-orange-400 font-bold mb-1">勇哥说：</p>
                  <p className="text-sm text-slate-300 italic leading-relaxed">
                    {selectedOpt.yonggeQuote}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 确认按钮 */}
          <div className="flex justify-end pt-2">
            <button
              className={`px-6 py-2 rounded-md text-sm transition-colors ${
                isNotification || selectedOption
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
              disabled={!isNotification && !selectedOption}
              onClick={handleConfirm}
            >
              {isNotification ? '知道了' : '确认选择'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EventDialog;
