/**
 * main.ts — CLI 入口
 *
 * JSON-lines over stdin/stdout，每行一个 JSON 对象。
 * Agent 通过 stdin 发送请求，通过 stdout 接收响应。
 */

import * as readline from 'node:readline';
import { GameRunner } from './gameRunner';
import type { AgentRequest } from './protocol';

const runner = new GameRunner();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

/** 向 stdout 写入一行 JSON */
function send(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return; // 跳过空行

  let req: AgentRequest;
  try {
    req = JSON.parse(trimmed);
  } catch {
    send({ id: null, success: false, error: 'Invalid JSON' });
    return;
  }

  // 基本校验
  if (!req || typeof req !== 'object' || !req.id || !req.type) {
    send({ id: req?.id ?? null, success: false, error: 'Missing required fields: id, type' });
    return;
  }

  const resp = runner.handleRequest(req);
  send(resp);
});

rl.on('close', () => {
  process.exit(0);
});
