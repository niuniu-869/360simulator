#!/bin/bash

# 360simulator 停止脚本
# 策略：先按 PID 停，再按端口兜底，确保端口一定释放

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.360simulator.pid"
PORT=10041

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  360simulator 停止脚本${NC}"
echo -e "${GREEN}========================================${NC}"

STOPPED=false

# ---- 第一步：尝试按 PID 文件停止 ----
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${GREEN}🛑 停止服务 (PID: $PID)...${NC}"
        kill "$PID" 2>/dev/null
        # 等待进程结束
        WAIT_COUNT=0
        while ps -p "$PID" > /dev/null 2>&1; do
            sleep 1
            WAIT_COUNT=$((WAIT_COUNT + 1))
            if [ $WAIT_COUNT -ge 10 ]; then
                echo -e "${YELLOW}⚠️  进程未响应，强制终止...${NC}"
                kill -9 "$PID" 2>/dev/null
                break
            fi
        done
        STOPPED=true
    else
        echo -e "${YELLOW}⚠️  PID $PID 已不存在，清理 PID 文件${NC}"
    fi
    rm -f "$PID_FILE"
fi

# ---- 第二步：兜底——按端口清理残留进程 ----
PID_BY_PORT=$(lsof -t -i:"$PORT" 2>/dev/null | head -1)
if [ -n "$PID_BY_PORT" ]; then
    echo -e "${YELLOW}🔍 端口 $PORT 仍被进程 $PID_BY_PORT 占用，清理中...${NC}"
    kill "$PID_BY_PORT" 2>/dev/null
    sleep 1
    # 如果还没死，强杀
    if ps -p "$PID_BY_PORT" > /dev/null 2>&1; then
        kill -9 "$PID_BY_PORT" 2>/dev/null
    fi
    STOPPED=true
fi

if [ "$STOPPED" = true ]; then
    echo -e "${GREEN}✅ 服务已停止${NC}"
else
    echo -e "${YELLOW}⚠️  服务未在运行${NC}"
fi
