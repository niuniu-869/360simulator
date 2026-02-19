// BFF 代理服务器 — 隔离 LLM API 密钥，防止前端泄露
// 零外部依赖，仅使用 Node.js 内置模块
//
// 职责：
// 1. 托管 dist/ 静态文件
// 2. 代理 /api/llm/chat/completions → 真实 LLM API（密钥留在服务端）
// 3. 提供 /api/llm/config 供前端获取模型名称（不含密钥）

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, 'dist');
const PORT = parseInt(process.env.PORT || '10041', 10);
const BASE_PATH = '/360'; // 与 vite.config.ts 中的 base 一致

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
  if (!filePath.startsWith(DIST_DIR)) {
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
  const { apiKey, model, baseUrl } = getEnvConfig();

  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '服务端未配置 LLM_API_KEY' }));
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

  // 注入服务端模型名（前端不再需要知道）
  if (!body.model) {
    body.model = model;
  }

  const targetUrl = normalizeChatCompletionsUrl(baseUrl);

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
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
        // 客户端断开连接等
        if (e.name !== 'AbortError') {
          console.error('[proxy] 流式传输中断:', e.message);
        }
      } finally {
        res.end();
      }
      return;
    }

    // 非流式响应
    const responseBody = await upstream.text();
    res.writeHead(upstream.status, headers);
    res.end(responseBody);
  } catch (e) {
    console.error('[proxy] 请求上游 LLM 失败:', e.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'LLM 服务不可用，请稍后重试' }));
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
    const allowed = origin && new URL(origin).hostname === (req.headers.host || '').split(':')[0];
    res.writeHead(204, {
      ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
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
