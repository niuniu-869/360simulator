// BFF 代理服务器 — 隔离 LLM API 密钥，防止前端泄露
// 零外部依赖，仅使用 Node.js 内置模块
//
// 职责：
// 1. 托管 dist/ 静态文件
// 2. 代理 /api/llm/chat/completions → 真实 LLM API（密钥留在服务端）
// 3. 提供 /api/llm/config 供前端获取模型名称（不含密钥）
//
// ============ 推荐部署姿势（务必阅读，防烧钱） ============
//
// 【默认形态 = 零成本】不要配 LLM_API_KEY。
//   此时 /api/llm/config 返回 available:false，前端"赛博勇哥"自动走【规则版】
//   （完全本地、零网络、永不报错）。上千用户无 key 也能用，作者一分钱不花。
//
// 【进阶用户自带 key（BYOK）】用户在前端"接入我的AI"里填自己的 key。
//   请求带 X-BYOK-Key / X-BYOK-Base-URL / X-BYOK-Model header。
//   server 用【用户的 key】转发——这类请求自付费、不计作者预算、不受 loopback 限制。
//
// 【作者托管 AI（可选，烧钱路径）】若要给所有人提供 AI 勇哥：
//   - 设 LLM_API_KEY 后，务必同时设 LLM_DAILY_BUDGET（全局每日请求上限），否则会被刷爆。
//   - 公网部署需 HOST=0.0.0.0；此时鉴权依赖 LLM_PROXY_TOKEN（前端默认不带 token，
//     即匿名公网请求会被 403——这是有意为之，避免裸奔。要放开匿名访问需自行评估风险）。
//   - 限速按【真实 socket 地址】计，不信任可伪造的 X-Forwarded-For。
//   - 上游请求有 30s AbortController 超时，防止慢响应挂住连接。

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, 'dist');
const PORT = parseInt(process.env.PORT || '10041', 10);
const BASE_PATH = ''; // 与 vite.config.ts 中的 base 一致
const LLM_PROXY_TOKEN = (process.env.LLM_PROXY_TOKEN || '').trim();
const LLM_PROXY_RATE_LIMIT = Number.parseInt(process.env.LLM_PROXY_RATE_LIMIT || '30', 10);
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitStore = new Map();

// 全局每日预算（作者托管 key 路径专用）：当天累计放行的"作者 key 请求"超过此值后，
// 返回友好 429，引导用户在设置里接入自己的 key。默认 200，0 或负数视为不限制（不推荐公网）。
const LLM_DAILY_BUDGET = Number.parseInt(process.env.LLM_DAILY_BUDGET || '200', 10);
// 上游请求超时（毫秒），防止慢响应/挂死占用连接
const UPSTREAM_TIMEOUT_MS = Number.parseInt(process.env.LLM_UPSTREAM_TIMEOUT_MS || '30000', 10);

// 全局每日预算计数（内存即可，进程重启清零）
const dailyBudget = { day: currentDayKey(), count: 0 };

function currentDayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD（UTC）
}

/** 检查并占用一次作者预算配额。返回 true 表示已超限（应拒绝）。 */
function consumeAuthorBudget() {
  // 不限制：LLM_DAILY_BUDGET <= 0
  if (!(Number.isFinite(LLM_DAILY_BUDGET) && LLM_DAILY_BUDGET > 0)) return false;
  const today = currentDayKey();
  if (dailyBudget.day !== today) {
    dailyBudget.day = today;
    dailyBudget.count = 0;
  }
  if (dailyBudget.count >= LLM_DAILY_BUDGET) return true;
  dailyBudget.count += 1;
  return false;
}

/** 从请求 header 解析 BYOK 配置；无 key 返回 null。 */
function parseByok(req) {
  const apiKey = (req.headers['x-byok-key'] || '').toString().trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (req.headers['x-byok-base-url'] || '').toString().trim().replace(/\/+$/, ''),
    model: (req.headers['x-byok-model'] || '').toString().trim(),
  };
}

// ============ 环境变量（服务端私有，不会暴露到前端） ============

function getEnvConfig() {
  const apiKey = process.env.LLM_API_KEY || process.env.MOONSHOT_API_KEY || '';
  const model = process.env.LLM_MODEL || process.env.MOONSHOT_MODEL || 'kimi-k2-turbo-preview';
  const baseUrl = (process.env.LLM_BASE_URL || process.env.MOONSHOT_BASE_URL || '').trim().replace(/\/+$/, '');
  return { apiKey, model, baseUrl };
}

function normalizeChatCompletionsUrl(raw) {
  const base = (raw || '').trim().replace(/\/+$/, '');
  if (!base) return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  if (base.includes('/chat/completions')) return base;
  if (base.endsWith('/openai')) return `${base}/chat/completions`;
  if (base.endsWith('/v1beta')) return `${base}/openai/chat/completions`;
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function isPathInside(basePath, candidatePath) {
  const rel = relative(basePath, candidatePath);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function parseHostName(hostHeader = '') {
  const raw = hostHeader.split(',')[0].trim();
  return raw.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
}

function isSameHostOrigin(origin, hostHeader) {
  if (!origin) return false;
  try {
    const originHost = new URL(origin).hostname;
    return originHost === parseHostName(hostHeader);
  } catch {
    return false;
  }
}

function isLoopbackAddress(address = '') {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function hasValidProxyToken(req) {
  if (!LLM_PROXY_TOKEN) return false;
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${LLM_PROXY_TOKEN}`;
}

function isAuthorizedProxyRequest(req) {
  if (LLM_PROXY_TOKEN) {
    return hasValidProxyToken(req);
  }
  // 无 token：默认仅允许 loopback。但若配置了作者 key（LLM_API_KEY），反向代理
  // 部署下 req.socket.remoteAddress 可能恒为 127.0.0.1，匿名外部请求会被误判为本机
  // 而放行 → 烧作者 key/每日预算（codex 复审 P2）。因此存在作者 key 时，loopback
  // 放行需显式 opt-in（仅供本地开发），生产应改用 BYOK 或 LLM_PROXY_TOKEN。
  const { apiKey } = getEnvConfig();
  if (apiKey && process.env.LLM_ALLOW_LOCAL_LLM_PROXY !== 'true') {
    return false;
  }
  return isLoopbackAddress(req.socket.remoteAddress || '');
}

function isRateLimited(req) {
  const maxRequests = Number.isFinite(LLM_PROXY_RATE_LIMIT) && LLM_PROXY_RATE_LIMIT > 0
    ? LLM_PROXY_RATE_LIMIT
    : 30;
  // 安全：限速 key 用真实 socket 地址，不信任客户端可伪造的 X-Forwarded-For。
  // 若部署在【已知可信】的反向代理后（如 Nginx），可在此显式解析 XFF 首段——
  // 但默认不解析，避免攻击者刷 X-Forwarded-For 绕过限速。
  const clientId = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitStore.get(clientId);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(clientId, { windowStart: now, count: 1 });
    return false;
  }

  entry.count += 1;
  return entry.count > maxRequests;
}

// ============ 静态文件服务 ============

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

async function serveStatic(req, res) {
  // 去掉 base path 前缀
  let urlPath = req.url.split('?')[0];
  if (urlPath.startsWith(BASE_PATH)) {
    urlPath = urlPath.slice(BASE_PATH.length) || '/';
  }

  // 路径穿越防护：规范化后检查是否仍在 DIST_DIR 内
  let filePath = resolve(DIST_DIR, urlPath.replace(/^\/+/, ''));
  if (!isPathInside(DIST_DIR, filePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
  } catch {
    // 文件不存在，SPA fallback
    filePath = join(DIST_DIR, 'index.html');
  }

  try {
    const content = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

// ============ LLM 代理 ============

async function proxyLLM(req, res) {
  // BYOK：用户自带 key 的请求。这类请求自付费 →
  //   - 放行不受 loopback / token 鉴权限制（用户用自己的 key，不碰作者资源）
  //   - 不计作者预算
  //   - 仍受逐 IP 限速（防滥用作者带宽）
  const byok = parseByok(req);

  if (!byok) {
    // 非 BYOK → 走作者托管 key 路径，受全部限制
    if (!isAuthorizedProxyRequest(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: LLM proxy access denied' }));
      return;
    }
  }

  if (isRateLimited(req)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '请求过于频繁，请稍后重试' }));
    return;
  }

  const env = getEnvConfig();
  // 选用 key/baseURL/model：BYOK 优先用用户的，回退到 env 默认值
  const apiKey = byok ? byok.apiKey : env.apiKey;
  const baseUrl = byok && byok.baseUrl ? byok.baseUrl : env.baseUrl;
  const model = byok && byok.model ? byok.model : env.model;

  if (!apiKey) {
    // 作者未配 key 且用户也没带 BYOK → 这是默认零成本形态。
    // 前端本应走规则版、不会发这个请求；万一发了，返回友好 503 而非裸 500，
    // 让前端能识别并降级，而不是把"扣了币又报错"暴露给玩家。
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'AI 勇哥未启用',
      code: 'llm_unavailable',
      hint: '当前为规则版勇哥（免费）。如需真 AI，请在设置里接入你自己的 key。',
    }));
    return;
  }

  // 作者托管 key 路径才计预算；BYOK 用户自付，不计。
  if (!byok && consumeAuthorBudget()) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: '今日 AI 勇哥免费额度已用完',
      code: 'budget_exceeded',
      hint: '可在设置里接入你自己的 key，立刻继续使用真 AI 勇哥（不受此额度限制）。',
    }));
    return;
  }

  // 读取请求体（限制 1MB）
  const MAX_BODY = 1024 * 1024;
  const chunks = [];
  let totalSize = 0;
  for await (const chunk of req) {
    totalSize += chunk.length;
    if (totalSize > MAX_BODY) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '请求体过大' }));
      return;
    }
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '请求体 JSON 解析失败' }));
    return;
  }

  // 注入模型名（前端不再需要知道）
  if (!body.model) {
    body.model = model;
  }

  const targetUrl = normalizeChatCompletionsUrl(baseUrl);

  // 上游超时保护：30s 未完成则中止，防止慢响应挂住连接
  const upstreamController = new AbortController();
  const timeoutId = setTimeout(() => upstreamController.abort(), UPSTREAM_TIMEOUT_MS);
  // 客户端断开时也中止上游
  req.on('close', () => upstreamController.abort());

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: upstreamController.signal,
    });

    // 透传状态码和关键头
    const headers = {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    };

    // SSE 流式响应
    if (body.stream && upstream.body) {
      headers['Cache-Control'] = 'no-cache';
      headers['Connection'] = 'keep-alive';
      res.writeHead(upstream.status, headers);

      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (e) {
        // 客户端断开连接 / 超时中止等
        if (e.name !== 'AbortError') {
          console.error('[proxy] 流式传输中断:', e.message);
        }
      } finally {
        clearTimeout(timeoutId);
        res.end();
      }
      return;
    }

    // 非流式响应
    const responseBody = await upstream.text();
    clearTimeout(timeoutId);
    res.writeHead(upstream.status, headers);
    res.end(responseBody);
  } catch (e) {
    clearTimeout(timeoutId);
    const aborted = e.name === 'AbortError';
    console.error('[proxy] 请求上游 LLM 失败:', aborted ? '超时/中止' : e.message);
    if (!res.headersSent) {
      res.writeHead(aborted ? 504 : 502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: aborted ? 'LLM 上游响应超时' : 'LLM 服务不可用，请稍后重试',
      }));
    } else {
      res.end();
    }
  }
}

/** 返回前端所需的非敏感配置（模型名称等） */
function handleConfig(_req, res) {
  const { model } = getEnvConfig();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ model, available: !!getEnvConfig().apiKey }));
}

// ============ 请求路由 ============

const server = createServer(async (req, res) => {
  // CORS preflight（仅允许同源，生产环境 BFF 同源部署无需通配符）
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin || '';
    const allowed = isSameHostOrigin(origin, req.headers.host || '');
    res.writeHead(204, {
      ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  const url = req.url || '/';

  // API 路由
  if (url.startsWith('/api/llm/chat/completions') && req.method === 'POST') {
    return proxyLLM(req, res);
  }
  if (url.startsWith('/api/llm/config') && req.method === 'GET') {
    return handleConfig(req, res);
  }

  // 静态文件
  return serveStatic(req, res);
});

// 优雅退出
process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });

const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`[360simulator] 服务已启动`);
  console.log(`  地址: http://localhost:${PORT}${BASE_PATH}`);
  console.log(`  LLM 代理: /api/llm/chat/completions`);
  console.log(`  密钥状态: ${getEnvConfig().apiKey ? '已配置' : '未配置'}`);
});
