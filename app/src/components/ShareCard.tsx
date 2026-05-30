/**
 * ShareCard.tsx — 9:16 竖版战报海报（R3b 自传播闭环）
 *
 * 为图片导出（html-to-image）优化的自包含组件：
 *   - 固定像素 540×960（9:16），深色品牌底 + 橙色点缀
 *   - 纯内联样式 / 简单结构，避免外部 webfont、复杂滤镜 —— 否则导出会糊
 *   - 由 GameResult 通过 ref 抓取该 DOM 导出 PNG
 *
 * 内容：大标题 / 剧本名 / 核心数字 / 踩坑标签 / 勇哥金句 / 本局成就 / 品牌挑战引导
 */

import { forwardRef } from 'react';
import type { GameState } from '@/types/game';
import { SCENARIO_BY_ID } from '@/data/scenarios';
import { ACHIEVEMENT_BY_ID } from '@/lib/achievements';

export interface ShareCardResult {
  isWin: boolean;
  reason: 'win' | 'bankrupt' | 'time_limit';
  totalProfit: number;
  totalInvestment: number;
  roi: number;
  meetsReturnRequirement?: boolean;
}

interface ShareCardProps {
  gameState: GameState;
  result: ShareCardResult;
  /** GameResult 预算好的踩坑名称（2-4 个） */
  pitfallNames: string[];
  /** 勇哥毒舌金句（已截短） */
  yongGeQuote: string;
  /** 挑战链接二维码 dataURL（可选；无则展示文字引导） */
  qrDataUrl?: string | null;
  /** 文字版挑战链接（二维码不可用时展示） */
  challengeUrl?: string;
  /** 预览模式：在文档流内渲染（默认 false：屏幕外 fixed 供导出抓取） */
  preview?: boolean;
}

const BRAND_ORANGE = '#f97316';
const BG = '#0a0e17';

function formatMoney(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 10000) return `${sign}¥${(abs / 10000).toFixed(1)}万`;
  return `${sign}¥${Math.round(abs).toLocaleString()}`;
}

/**
 * 战报海报。用 forwardRef 暴露根 DOM 供 html-to-image 抓取。
 * 默认屏幕外定位（left:-9999px），调用方可用 style 覆盖以在弹窗里预览。
 */
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { gameState, result, pitfallNames, yongGeQuote, qrDataUrl, challengeUrl, preview = false },
  ref,
) {
  const scenario = gameState.scenarioId ? SCENARIO_BY_ID[gameState.scenarioId] : undefined;

  const title = result.isWin
    ? '🎉 我回本了！'
    : result.reason === 'bankrupt'
      ? '💀 我破产了'
      : '⏰ 没撑住';

  const titleColor = result.isWin ? '#34d399' : result.reason === 'bankrupt' ? '#f87171' : '#fbbf24';

  const weeksAlive = gameState.profitHistory.length || gameState.currentWeek || 0;
  const returnPct =
    result.totalInvestment > 0
      ? Math.min(100, (result.totalProfit / result.totalInvestment) * 100)
      : 0;

  // 本局解锁成就（最多 4 个，隐藏/剧本成就视为稀有高亮）
  const runAchievements = (gameState.unlockedAchievements ?? [])
    .map((id) => ACHIEVEMENT_BY_ID[id])
    .filter((a): a is NonNullable<typeof a> => !!a)
    .slice(0, 4);

  const numberCard = (label: string, value: string, color: string) => (
    <div
      style={{
        flex: 1,
        background: '#11182a',
        border: '1px solid #1e293b',
        padding: '14px 10px',
        textAlign: 'center' as const,
      }}
    >
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
    </div>
  );

  return (
    <div
      ref={ref}
      style={{
        position: preview ? 'relative' : 'fixed',
        left: preview ? 0 : -9999,
        top: 0,
        width: 540,
        height: 960,
        background: `linear-gradient(160deg, ${BG} 0%, #0d1424 60%, #131a2e 100%)`,
        color: '#e2e8f0',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif',
        boxSizing: 'border-box',
        padding: '40px 36px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 顶部品牌条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div
          style={{
            background: BRAND_ORANGE,
            color: '#0a0e17',
            fontWeight: 900,
            fontSize: 18,
            padding: '4px 10px',
            letterSpacing: 1,
          }}
        >
          360°
        </div>
        <div style={{ fontSize: 16, color: '#cbd5e1', fontWeight: 600 }}>转一圈模拟器</div>
      </div>

      {/* 大标题 */}
      <div style={{ fontSize: 48, fontWeight: 900, color: titleColor, lineHeight: 1.1 }}>
        {title}
      </div>

      {/* 剧本名（话题点） */}
      {scenario && (
        <div
          style={{
            marginTop: 16,
            alignSelf: 'flex-start',
            background: 'rgba(249,115,22,0.15)',
            border: `1px solid ${BRAND_ORANGE}`,
            color: '#fdba74',
            fontSize: 15,
            fontWeight: 700,
            padding: '6px 14px',
          }}
        >
          剧本 · {scenario.name}
        </div>
      )}

      {/* 核心数字 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
        {numberCard(
          '总利润',
          formatMoney(result.totalProfit),
          result.totalProfit >= 0 ? '#34d399' : '#f87171',
        )}
        {numberCard('ROI', `${result.roi.toFixed(0)}%`, result.roi >= 0 ? '#34d399' : '#f87171')}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        {numberCard('活了', `${weeksAlive}周`, '#e2e8f0')}
        {numberCard(
          '回本进度',
          `${returnPct.toFixed(0)}%`,
          result.meetsReturnRequirement ? '#34d399' : '#fbbf24',
        )}
      </div>

      {/* 踩坑标签 */}
      {pitfallNames.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 10 }}>踩过的坑</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pitfallNames.slice(0, 4).map((name) => (
              <span
                key={name}
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.5)',
                  color: '#fca5a5',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '5px 12px',
                }}
              >
                #{name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 本局解锁成就 */}
      {runAchievements.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 10 }}>本局解锁成就</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {runAchievements.map((a) => {
              const rare = !!a.hidden || a.category === 'scenario';
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: rare ? 'rgba(245,158,11,0.12)' : '#11182a',
                    border: rare ? '1px solid rgba(245,158,11,0.6)' : '1px solid #1e293b',
                    padding: '8px 12px',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{rare ? '🏆' : '🎖️'}</span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: rare ? '#fcd34d' : '#e2e8f0',
                    }}
                  >
                    {a.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 勇哥金句 */}
      <div
        style={{
          marginTop: 26,
          background: 'rgba(249,115,22,0.1)',
          borderLeft: `4px solid ${BRAND_ORANGE}`,
          padding: '12px 14px',
        }}
      >
        <div style={{ fontSize: 13, color: BRAND_ORANGE, fontWeight: 700, marginBottom: 4 }}>
          勇哥点评
        </div>
        <div style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.5 }}>{yongGeQuote}</div>
      </div>

      {/* 弹性占位，把底部推到底 */}
      <div style={{ flex: 1, minHeight: 12 }} />

      {/* 底部品牌行 + 挑战引导 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          paddingTop: 18,
          borderTop: '1px solid #1e293b',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>
            360° 转一圈模拟器
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>创业避坑模拟</div>
          <div style={{ fontSize: 13, color: '#fdba74', marginTop: 8, fontWeight: 600 }}>
            {qrDataUrl ? '扫码挑战同款剧本 →' : '来挑战同款剧本'}
          </div>
          {!qrDataUrl && challengeUrl && (
            <div
              style={{
                fontSize: 11,
                color: '#64748b',
                marginTop: 4,
                wordBreak: 'break-all' as const,
                maxWidth: 300,
              }}
            >
              {challengeUrl}
            </div>
          )}
        </div>
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="挑战二维码"
            width={92}
            height={92}
            style={{ width: 92, height: 92, background: '#fff', padding: 4 }}
          />
        )}
      </div>
    </div>
  );
});
