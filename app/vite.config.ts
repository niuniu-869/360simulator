import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'
import { llmProxyPlugin } from './src/vite-plugins/llmProxy'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载非 VITE_ 前缀的环境变量到 process.env（供 llmProxy 插件使用）
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    base: '/360/',
    plugins: [inspectAttr(), react(), llmProxyPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
