// Vite 插件：开发模式下的 LLM 代理中间件
// 拦截 /api/llm/* 请求，在服务端注入 API 密钥后转发到真实 LLM API
// 与 server.mjs 的生产代理逻辑保持一致

import type { Plugin } from 'vite';

function getEnvConfig() {
  const apiKey = process.env.LLM_API_KEY || process.env.MOONSHOT_API_KEY || '';
  const model = process.env.LLM_MODEL || process.env.MOONSHOT_MODEL || 'kimi-k2-turbo-preview';
  const baseUrl = (process.env.LLM_BASE_URL || process.env.MOONSHOT_BASE_URL || '').trim().replace(/\/+$/, '');
  return { apiKey, model, baseUrl };
}

function normalizeChatCompletionsUrl(raw: string): string {
  const base = (raw || '').trim().replace(/\/+$/, '');
  if (!base) return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  if (base.includes('/chat/completions')) return base;
  if (base.endsWith('/openai')) return `${base}/chat/completions`;
  if (base.endsWith('/v1beta')) return `${base}/openai/chat/completions`;
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

export function llmProxyPlugin(): Plugin {
  return {
    name: 'llm-proxy',
    configureServer(server) {
      // /api/llm/config — 返回非敏感配置
      server.middlewares.use('/api/llm/config', (_req, res) => {
        const { model, apiKey } = getEnvConfig();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ model, available: !!apiKey }));
      });

      // /api/llm/chat/completions — 代理到真实 LLM API
      server.middlewares.use('/api/llm/chat/completions', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const { apiKey, model, baseUrl } = getEnvConfig();
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '服务端未配置 LLM_API_KEY（检查 app/.env）' }));
          return;
        }

        try {
          const rawBody = await readBody(req);
          const body = JSON.parse(rawBody);
          if (!body.model) body.model = model;

          const targetUrl = normalizeChatCompletionsUrl(baseUrl);
          const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
          });

          res.writeHead(upstream.status, {
            'Content-Type': upstream.headers.get('content-type') || 'application/json',
            'Cache-Control': 'no-cache',
          });

          if (body.stream && upstream.body) {
            const reader = (upstream.body as ReadableStream<Uint8Array>).getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
              }
            } catch { /* 客户端断开 */ }
            res.end();
          } else {
            const text = await upstream.text();
            res.end(text);
          }
        } catch (e) {
          console.error('[llm-proxy] 代理请求失败:', (e as Error).message);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'LLM 服务不可用' }));
        }
      });
    },
  };
}
