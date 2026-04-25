/**
 * rng.ts — 可种子化的全局伪随机数生成器
 *
 * 使用 mulberry32 算法（32-bit、单文件、无依赖、统计性质足够游戏使用）。
 * 用于替换游戏逻辑中的 Math.random()，实现 seed 可复现的局况。
 *
 * 设计：
 *   - 提供单例 `rng`，状态保存在模块作用域；
 *   - `createInitialGameState(seed)` 时调用 `seedRng(seed)` 重置状态；
 *   - 当未指定 seed 时，回退到不可预测的 seed（基于 Date.now + Math.random）；
 *   - UI 视觉粒子（components/streetview）不强求确定性，可继续用 Math.random。
 */

let _state = 0xc0ffee >>> 0;

/** mulberry32 — 经典 32-bit 随机数算法 */
function mulberry32(): number {
  _state = (_state + 0x6d2b79f5) >>> 0;
  let t = _state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 生成"看起来随机"的 fallback seed，避免被 cache 的 Date.now 同值 */
function defaultSeed(): number {
  return ((Date.now() * 1000003) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/** 重置 RNG 状态（外部 createInitialGameState 入口调用） */
export function seedRng(seed?: number): number {
  const s = (seed === undefined || seed === null || !Number.isFinite(seed))
    ? defaultSeed()
    : Math.floor(seed) >>> 0;
  // 避免 0：mulberry32 在 0 状态下首步会变 0x6d2b79f5，但更稳妥的初始化是
  // 用 seed 值与一个常量 mix 一下确保前几次输出立即"看起来随机"。
  _state = (s ^ 0x9e3779b9) >>> 0;
  // warm-up 几步，去掉明显模式
  for (let i = 0; i < 4; i += 1) mulberry32();
  return s;
}

/** 获取当前 RNG 状态（便于调试/快照） */
export function getRngState(): number {
  return _state >>> 0;
}

/** 强制设置 RNG 状态（很少用，用于精确恢复） */
export function setRngState(state: number): void {
  _state = state >>> 0;
}

/** 0..1 浮点 — Math.random() 的等价替换 */
export function rand(): number {
  return mulberry32();
}

/** 整数 [min, max] 闭区间 */
export function randInt(min: number, max: number): number {
  if (max < min) return min;
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** 数组随机一项 */
export function pickOne<T>(arr: readonly T[]): T | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(rand() * arr.length)];
}

/** 加权抽签（weights 同长度、值非负、总和 > 0） */
export function pickWeighted<T>(items: readonly T[], weights: readonly number[]): T | undefined {
  if (!items.length) return undefined;
  let total = 0;
  for (let i = 0; i < weights.length; i += 1) total += Math.max(0, weights[i] || 0);
  if (total <= 0) return items[0];
  let r = rand() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= Math.max(0, weights[i] || 0);
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Fisher-Yates 原地洗牌；返回输入数组（不新建数组） */
export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 短 id 生成器（替换 Math.random().toString(36).slice(2,X)） */
export function randId(len: number = 8): string {
  let out = '';
  while (out.length < len) {
    out += Math.floor(rand() * 36).toString(36);
  }
  return out.slice(0, len);
}
