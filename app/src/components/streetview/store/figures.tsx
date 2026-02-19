// SVG 像素画人物组件库 — 替代 emoji，严格控制尺寸避免重叠
import { seededRandom } from './storePaths';

// 肤色/发色/衣色调色板
const SKIN_TONES = ['#f5d0a9', '#e8b88a', '#d4956b', '#c68642', '#8d5524'];
const HAIR_COLORS = ['#1a1a2e', '#3d2b1f', '#8b4513', '#c0392b', '#f39c12'];
const SHIRT_COLORS = ['#3498db', '#2ecc71', '#e74c3c', '#9b59b6', '#f39c12', '#1abc9c'];

function pickColor(palette: string[], seed: number): string {
  return palette[Math.floor(seededRandom(seed) * palette.length)];
}

// ─── 厨师 ───
interface ChefFigureProps {
  x: number;
  y: number;
  efficiency?: number; // 0-100，控制动画速度
  morale?: number;     // 0-100，控制亮度
  seed?: number;
}

export function ChefFigure({ x, y, efficiency = 80, morale = 70, seed = 0 }: ChefFigureProps) {
  const skin = pickColor(SKIN_TONES, seed);
  const brightness = 0.6 + (morale / 100) * 0.4;
  const dur = `${2.5 - (efficiency / 100) * 1.2}s`;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <g
        className="sv-chef-figure"
        style={{ animationDuration: dur, opacity: brightness }}
      >
        {/* 厨师帽 */}
        <rect x={-3} y={-12} width={6} height={3} rx={1} fill="#fff" />
        <rect x={-4} y={-9} width={8} height={2} rx={0.5} fill="#eee" />
        {/* 头 */}
        <circle cx={0} cy={-5} r={3} fill={skin} />
        {/* 身体（白色围裙） */}
        <rect x={-3} y={-2} width={6} height={7} rx={1} fill="#f0f0f0" />
        {/* 围裙带 */}
        <line x1={-2} y1={0} x2={2} y2={0} stroke="#ccc" strokeWidth={0.5} />
        {/* 腿 */}
        <rect x={-2} y={5} width={2} height={3} fill="#2c3e50" />
        <rect x={1} y={5} width={2} height={3} fill="#2c3e50" />
      </g>
    </g>
  );
}

// ─── 顾客 ───
interface CustomerFigureProps {
  x: number;
  y: number;
  seed?: number;
  eating?: boolean;
}

export function CustomerFigure({ x, y, seed = 0, eating = true }: CustomerFigureProps) {
  const skin = pickColor(SKIN_TONES, seed);
  const hair = pickColor(HAIR_COLORS, seed + 7);
  const shirt = pickColor(SHIRT_COLORS, seed + 13);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <g
        className={eating ? 'sv-customer-figure' : ''}
        style={eating ? { animationDelay: `${(seed % 5) * 0.4}s` } : undefined}
      >
        {/* 头发 */}
        <circle cx={0} cy={-7} r={3.2} fill={hair} />
        {/* 头 */}
        <circle cx={0} cy={-6} r={2.8} fill={skin} />
        {/* 身体 */}
        <rect x={-2.5} y={-3} width={5} height={6} rx={1} fill={shirt} />
        {/* 腿（坐姿弯曲） */}
        <rect x={-2.5} y={3} width={2} height={2} fill="#34495e" />
        <rect x={1} y={3} width={2} height={2} fill="#34495e" />
      </g>
    </g>
  );
}

// ─── 服务员 ───
interface WaiterFigureProps {
  x: number;
  y: number;
  seed?: number;
  patrolIndex?: number; // 巡回路径索引
}

export function WaiterFigure({ x, y, seed = 0, patrolIndex = 0 }: WaiterFigureProps) {
  const skin = pickColor(SKIN_TONES, seed);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <g
        className="sv-waiter-patrol"
        style={{ animationDelay: `${patrolIndex * 2}s` }}
      >
        {/* 头 */}
        <circle cx={0} cy={-6} r={2.8} fill={skin} />
        {/* 身体（黑色制服） */}
        <rect x={-2.5} y={-3} width={5} height={7} rx={1} fill="#2c3e50" />
        {/* 领结 */}
        <rect x={-1} y={-3} width={2} height={1.5} rx={0.3} fill="#e74c3c" />
        {/* 托盘（手持） */}
        <ellipse cx={4} cy={-2} rx={3} ry={1} fill="#95a5a6" />
        {/* 腿 */}
        <rect x={-2} y={4} width={2} height={3} fill="#1a1a2e" />
        <rect x={1} y={4} width={2} height={3} fill="#1a1a2e" />
      </g>
    </g>
  );
}

// ─── 清洁工 ───
interface CleanerFigureProps {
  x: number;
  y: number;
  seed?: number;
}

export function CleanerFigure({ x, y, seed = 0 }: CleanerFigureProps) {
  const skin = pickColor(SKIN_TONES, seed);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <g className="sv-waiter-patrol" style={{ animationDelay: `${(seed % 3) * 2.5}s` }}>
        {/* 头 */}
        <circle cx={0} cy={-6} r={2.8} fill={skin} />
        {/* 身体（蓝色工服） */}
        <rect x={-2.5} y={-3} width={5} height={7} rx={1} fill="#2980b9" />
        {/* 拖把杆 */}
        <line x1={4} y1={-8} x2={4} y2={6} stroke="#8b7355" strokeWidth={1} />
        {/* 拖把头 */}
        <rect x={2} y={5} width={4} height={2} rx={0.5} fill="#95a5a6" />
        {/* 腿 */}
        <rect x={-2} y={4} width={2} height={3} fill="#1a252f" />
        <rect x={1} y={4} width={2} height={3} fill="#1a252f" />
      </g>
    </g>
  );
}

// ─── 行人（店外，更小） ───
interface PedestrianFigureProps {
  x: number;
  y: number;
  seed?: number;
  direction?: 'left' | 'right';
}

export function PedestrianFigure({ x, y, seed = 0, direction = 'right' }: PedestrianFigureProps) {
  const skin = pickColor(SKIN_TONES, seed);
  const shirt = pickColor(SHIRT_COLORS, seed + 3);
  const flip = direction === 'left' ? -1 : 1;
  return (
    <g transform={`translate(${x}, ${y}) scale(${flip}, 1)`}>
      {/* 头 */}
      <circle cx={0} cy={-5} r={2.2} fill={skin} />
      {/* 身体 */}
      <rect x={-2} y={-2.5} width={4} height={5} rx={0.8} fill={shirt} />
      {/* 腿（行走姿态） */}
      <rect x={-1.5} y={2.5} width={1.5} height={2.5} fill="#34495e" transform="rotate(-10, -0.75, 2.5)" />
      <rect x={0.5} y={2.5} width={1.5} height={2.5} fill="#34495e" transform="rotate(10, 1.25, 2.5)" />
    </g>
  );
}

// ─── 外卖骑手 ───
interface DeliveryRiderProps {
  x: number;
  y: number;
  seed?: number;
  delay?: number;
  duration?: number;
  animated?: boolean; // 是否由自身控制动画（false 时由外层包装控制）
}

export function DeliveryRider({ x, y, seed = 0, delay = 0, duration = 4.8, animated = true }: DeliveryRiderProps) {
  const skin = pickColor(SKIN_TONES, seed);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <g
        className={animated ? 'sv-delivery-rider' : undefined}
        style={animated ? { animationDelay: `${delay}s`, animationDuration: `${duration}s` } : undefined}
      >
        {/* 电动车车身 */}
        <rect x={-6} y={2} width={12} height={4} rx={1.5} fill="#4a4a4a" />
        {/* 前后轮 */}
        <circle cx={-5} cy={7} r={2.5} fill="#333" stroke="#555" strokeWidth={0.5} />
        <circle cx={5} cy={7} r={2.5} fill="#333" stroke="#555" strokeWidth={0.5} />
        {/* 骑手身体 */}
        <rect x={-2} y={-4} width={4} height={6} rx={1} fill="#22d3ee" />
        {/* 头盔 */}
        <circle cx={0} cy={-6} r={2.5} fill="#06b6d4" />
        <circle cx={0} cy={-6} r={2} fill={skin} />
        {/* 外卖箱 */}
        <rect x={-4} y={-8} width={8} height={6} rx={1} fill="#06b6d4" />
        <text x={0} y={-4} textAnchor="middle" fontSize={4} fill="#fff" fontWeight="bold">外</text>
      </g>
    </g>
  );
}

// ─── 等轴测餐桌 ───
interface DiningTableProps {
  x: number;
  y: number;
  occupied?: boolean;
}

export function DiningTable({ x, y, occupied = false }: DiningTableProps) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* 等轴测菱形桌面 */}
      <path
        d="M 0,-3 L 5,0 L 0,3 L -5,0 Z"
        fill={occupied ? '#6d4c2a' : '#4a3520'}
        stroke="#3d2817"
        strokeWidth={0.5}
        opacity={occupied ? 1 : 0.5}
      />
      {/* 桌腿（简化为中心支柱） */}
      <line x1={0} y1={0} x2={0} y2={3} stroke="#3d2817" strokeWidth={1} />
      {/* 有顾客时显示餐具 */}
      {occupied && (
        <>
          <circle cx={-1.5} cy={-0.5} r={1} fill="#ddd" opacity={0.7} />
          <circle cx={1.5} cy={0.5} r={1} fill="#ddd" opacity={0.7} />
        </>
      )}
    </g>
  );
}

// ─── 等轴测灶台 ───
interface StoveProps {
  x: number;
  y: number;
  active?: boolean;
}

export function Stove({ x, y, active = false }: StoveProps) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* 灶台主体（等轴测） */}
      <path
        d="M 0,-4 L 6,-1 L 0,2 L -6,-1 Z"
        fill="#4a4a4a"
        stroke="#333"
        strokeWidth={0.5}
      />
      {/* 灶台侧面 */}
      <path
        d="M -6,-1 L 0,2 L 0,5 L -6,2 Z"
        fill="#3a3a3a"
      />
      <path
        d="M 0,2 L 6,-1 L 6,2 L 0,5 Z"
        fill="#555"
      />
      {/* 火焰（活跃时） */}
      {active && (
        <g className="sv-stove-flame">
          <ellipse cx={0} cy={-3} rx={2} ry={1.5} fill="#ff6b35" opacity={0.8} />
          <ellipse cx={0} cy={-4} rx={1.2} ry={1} fill="#ffd700" opacity={0.9} />
        </g>
      )}
    </g>
  );
}
