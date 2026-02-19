/**
 * interactiveEvents/index.ts — 事件数据汇总导出（v3.1）
 *
 * 将事件按类别拆分为多个文件，此处合并导出 INTERACTIVE_EVENTS 数组。
 * 导入路径保持 '@/data/interactiveEvents' 不变。
 *
 * 文件结构：
 * - operatingCore.ts  — 经营阶段核心事件（改造后的原有事件 6 个 + 1 链式）
 * - operatingMore.ts  — 经营阶段补充事件（5 个 + 1 链式）
 * - newEvents.ts      — v3.1 新增经营事件（6 个）
 * - setupEvents.ts    — 筹备阶段事件（3 个 + 2 链式）
 */

import { OPERATING_CORE_EVENTS } from './operatingCore';
import { OPERATING_MORE_EVENTS } from './operatingMore';
import { NEW_EVENTS } from './newEvents';
import { SETUP_EVENTS } from './setupEvents';

export const INTERACTIVE_EVENTS = [
  ...OPERATING_CORE_EVENTS,
  ...OPERATING_MORE_EVENTS,
  ...NEW_EVENTS,
  ...SETUP_EVENTS,
];
