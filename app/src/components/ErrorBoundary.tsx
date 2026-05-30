/**
 * ErrorBoundary.tsx — 全局渲染异常兜底
 *
 * 目标：任何子树渲染抛错时，不再整页白屏，而是显示友好的暗色风格兜底页，
 * 并给玩家两个逃生出口：
 *   1.「刷新重试」—— location.reload()，适合偶发渲染抖动。
 *   2.「清空存档并重启」—— 清掉本游戏相关 localStorage（坏档自救）后 reload，
 *      适合"存档损坏导致每次进来都崩"的死循环。
 *
 * 实现说明：
 *  - 标准 class 组件（React error boundary 只能用 class）。
 *  - getDerivedStateFromError 切换到兜底渲染；componentDidCatch 打 console（便于线上排查）。
 *  - 兜底页使用 inline style 而非依赖 Tailwind 类，确保即便样式系统/CSS 一同异常也能正常呈现。
 *  - 配色呼应游戏 UI：背景 #0a0e17、卡片 #151d2b、边框 #1e293b、强调色 orange。
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

/** 主存档 key（与 useGameState 的 SAVE_KEY 保持一致）。 */
const SAVE_KEY = "360sim:save:v1";
/** 本游戏所有 localStorage key 的统一前缀（playSpeed / achievements / save 等）。 */
const GAME_KEY_PREFIX = "360sim:";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 清空本游戏相关的 localStorage：
 *  - 显式清主存档 key（即便前缀扫描失败也兜底删掉它）。
 *  - 再清所有 360sim: 前缀的 key（成就 / 播放速度 / 存档等）。
 * 全程 try/catch，任何一步失败都不阻断后续 reload。
 */
function clearGameStorage(): void {
  try {
    const storage = window.localStorage;
    // 1) 显式删主存档（最关键的逃生目标）
    try {
      storage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    // 2) 扫描并删所有本游戏前缀 key（先收集再删，避免遍历时下标错位）
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(GAME_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      try {
        storage.removeItem(key);
      } catch {
        /* ignore single-key failure */
      }
    }
  } catch {
    /* localStorage 不可用（隐私模式等）：忽略，直接 reload */
  }
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 打到 console，方便线上用户提供截图 / 自己排查
    console.error("[ErrorBoundary] 渲染异常被捕获:", error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleClearAndRestart = (): void => {
    clearGameStorage();
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const errorMessage =
      this.state.error?.message ?? "发生了未知错误";

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
          backgroundColor: "#0a0e17",
          color: "#e2e8f0",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            backgroundColor: "#151d2b",
            border: "1px solid #1e293b",
            borderRadius: "12px",
            padding: "28px 24px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "40px",
              lineHeight: 1,
              marginBottom: "16px",
            }}
            aria-hidden="true"
          >
            🛠️
          </div>
          <h1
            style={{
              fontSize: "18px",
              fontWeight: 700,
              margin: "0 0 8px",
              color: "#f97316",
            }}
          >
            哎呀，店里出了点状况
          </h1>
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              margin: "0 0 4px",
              color: "#94a3b8",
            }}
          >
            页面遇到了一个错误。你可以先刷新重试；如果反复出错，
            可能是存档损坏，点「清空存档并重启」即可恢复。
          </p>
          <p
            style={{
              fontSize: "11px",
              lineHeight: 1.5,
              margin: "8px 0 20px",
              color: "#475569",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              wordBreak: "break-word",
            }}
          >
            {errorMessage}
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                width: "100%",
                padding: "11px 16px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#0a0e17",
                backgroundColor: "#f97316",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              刷新重试
            </button>
            <button
              type="button"
              onClick={this.handleClearAndRestart}
              style={{
                width: "100%",
                padding: "11px 16px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#cbd5e1",
                backgroundColor: "transparent",
                border: "1px solid #334155",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              清空存档并重启
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
