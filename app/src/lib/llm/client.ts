// LLM 流式请求客户端
// 使用 OpenAI 兼容的 /chat/completions 接口，支持 function calling

// ============ 类型 ============

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCallMessage[];
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCallMessage {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
  // 允许厂商特有字段透传（如 Gemini thinking model 的 thought_signature）
  [key: string]: unknown;
}

/** tool call 处理器：接收函数名和参数，返回工具执行结果字符串 */
export type ToolCallHandler = (name: string, args: Record<string, unknown>) => Promise<string> | string;

export interface StreamOptions {
  messages: ChatMessage[];
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
  // function calling 支持
  tools?: ToolDefinition[];
  onToolCall?: ToolCallHandler;
  /** tool call 轮次回调（用于 UI 显示"勇哥在给你想办法"） */
  onToolRound?: (round: number) => void;
  /** 最大 tool call 轮次，默认 3 */
  maxToolRounds?: number;
}

export class LLMError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`LLM API Error (${status}): ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

// ============ BFF 代理端点 ============
// 前端不再直接持有 API 密钥，所有 LLM 请求通过服务端代理转发
// 开发模式由 vite.config.ts proxy 转发，生产模式由 server.mjs 处理

const LLM_PROXY_URL = '/api/llm/chat/completions';
const LLM_CONFIG_URL = '/api/llm/config';

/** 从服务端获取 LLM 配置（模型名称、是否可用），结果缓存 */
let _configCache: { model: string; available: boolean } | null = null;

export async function getLLMConfig(): Promise<{ model: string; available: boolean }> {
  if (_configCache) return _configCache;
  try {
    const res = await fetch(LLM_CONFIG_URL);
    if (res.ok) {
      _configCache = await res.json();
      return _configCache!;
    }
  } catch { /* 服务端不可用 */ }
  return { model: '', available: false };
}

// ============ 核心请求 ============

/** 单次流式请求（通过 BFF 代理，无需密钥），返回 { content, toolCalls } */
async function singleStreamRequest(
  messages: ChatMessage[],
  tools: ToolDefinition[] | undefined,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<{ content: string; toolCalls: ToolCallMessage[] }> {
  const body: Record<string, unknown> = { messages, stream: true };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const response = await fetch(LLM_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new LLMError(response.status, errorText);
  }

  return readSSEStream(response, onChunk);
}

// ============ SSE 解析（支持 content + tool_calls） ============

async function readSSEStream(
  response: Response,
  onChunk: (chunk: string) => void,
): Promise<{ content: string; toolCalls: ToolCallMessage[] }> {
  if (!response.body) {
    throw new LLMError(0, 'Response body is null, streaming not supported');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  // 累积 tool_calls（可能跨多个 SSE chunk）
  // extras 保存厂商特有字段（如 Gemini 的 thought_signature），回传时需原样带回
  const toolCallsMap = new Map<number, { id: string; name: string; args: string; extras: Record<string, unknown> }>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        return buildResult(fullContent, toolCallsMap);
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        // 文本内容
        if (delta.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }

        // tool_calls 增量
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            // 提取已知字段，其余作为 extras 透传
            const { index: _idx, id, type: _type, function: fn, ...extras } = tc;
            const existing = toolCallsMap.get(idx);
            if (!existing) {
              toolCallsMap.set(idx, {
                id: id || '',
                name: fn?.name || '',
                args: fn?.arguments || '',
                extras,
              });
            } else {
              if (id) existing.id = id;
              if (fn?.name) existing.name += fn.name;
              if (fn?.arguments) existing.args += fn.arguments;
              // 合并后续 chunk 中出现的额外字段
              Object.assign(existing.extras, extras);
            }
          }
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  return buildResult(fullContent, toolCallsMap);
}

function buildResult(
  content: string,
  toolCallsMap: Map<number, { id: string; name: string; args: string; extras: Record<string, unknown> }>,
): { content: string; toolCalls: ToolCallMessage[] } {
  const toolCalls: ToolCallMessage[] = [];
  for (const [, tc] of toolCallsMap) {
    if (tc.name) {
      toolCalls.push({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.args },
        ...tc.extras,
      });
    }
  }
  return { content, toolCalls };
}

// ============ 公开 API ============

/**
 * 流式对话，自动处理 tool calling 循环。
 * - 无 tools 时：行为与原版一致，返回完整文本
 * - 有 tools 时：LLM 发起 tool_call → 执行 onToolCall → 注入结果 → 继续流式，最多 maxToolRounds 轮
 */
export async function streamChat(options: StreamOptions): Promise<string> {
  const maxRounds = options.maxToolRounds ?? 3;
  let messages = [...options.messages];
  let fullContent = '';

  for (let round = 0; round <= maxRounds; round++) {
    const result = await singleStreamRequest(
      messages, options.tools, options.onChunk, options.signal,
    );

    fullContent += result.content;

    // 无 tool calls → 正常结束
    if (result.toolCalls.length === 0 || !options.onToolCall) {
      return fullContent;
    }

    // 通知 UI 进入 tool call 轮次
    options.onToolRound?.(round + 1);

    // 追加 assistant 消息（含 tool_calls）
    messages = [
      ...messages,
      {
        role: 'assistant' as const,
        content: result.content || null,
        tool_calls: result.toolCalls,
      },
    ];

    // 执行每个 tool call 并追加结果
    for (const tc of result.toolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* empty */ }

      const toolResult = await options.onToolCall(tc.function.name, args);

      messages.push({
        role: 'tool' as const,
        content: toolResult,
        tool_call_id: tc.id,
      });
    }
  }

  return fullContent;
}
