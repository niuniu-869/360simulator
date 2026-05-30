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
    base: '/',
    plugins: [inspectAttr(), react(), llmProxyPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // 手动拆包：把体积大、变动少的依赖拆成独立 vendor chunk，
          // 让首屏主 chunk 变小、vendor 能被浏览器长期缓存。
          //
          // ⚠️ 关键：recharts 内部依赖 react/react-is，若把 charts 与 react 拆成
          // 两个互相引用的 chunk，会产生跨 chunk 循环（vendor-react ↔ vendor-charts），
          // 导致生产构建运行时 "Cannot access 'X' before initialization" 的 TDZ 崩溃。
          // 因此 react 运行时 + recharts 图表库**必须放在同一个 chunk**（循环变为块内、
          // 由 Rollup 正确排序）。radix 仅单向依赖 react，可安全独立成块。
          manualChunks: (id) => {
            if (!id.includes("node_modules")) return undefined;
            // React 运行时 + 图表库（recharts/d3/动画）合并为核心 vendor，避免跨块循环
            if (
              /[\\/]node_modules[\\/](react|react-dom|react-is|scheduler|recharts|recharts-scale|d3-[^\\/]+|victory-vendor|decimal\.js-light|internmap|react-smooth|react-transition-group)[\\/]/.test(
                id,
              )
            ) {
              return "vendor-core";
            }
            // 所有 Radix UI 原语：单向依赖 react，可整体独立成块
            if (/[\\/]node_modules[\\/]@radix-ui[\\/]/.test(id)) {
              return "vendor-radix";
            }
            // 其余第三方依赖：留在主 chunk（不强拆，避免循环 & 碎片化）
            return undefined;
          },
        },
      },
    },
  };
});
