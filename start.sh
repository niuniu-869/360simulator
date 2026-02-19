#!/bin/bash

# 360simulator 启动脚本
# 端口: 10041

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"
PID_FILE="$SCRIPT_DIR/.360simulator.pid"
LOG_FILE="$SCRIPT_DIR/360simulator.log"
PORT=10041

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  360simulator 启动脚本${NC}"
echo -e "${GREEN}  端口: $PORT${NC}"
echo -e "${GREEN}========================================${NC}"

# 清理旧进程：先按 PID 文件，再按端口兜底
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}🛑 停止旧服务 (PID: $OLD_PID)...${NC}"
        kill "$OLD_PID" 2>/dev/null
        sleep 1
    fi
    rm -f "$PID_FILE"
fi

# 兜底：按端口清理残留进程
PID_BY_PORT=$(lsof -t -i:"$PORT" 2>/dev/null | head -1)
if [ -n "$PID_BY_PORT" ]; then
    echo -e "${YELLOW}🔍 端口 $PORT 被进程 $PID_BY_PORT 占用，自动清理...${NC}"
    kill "$PID_BY_PORT" 2>/dev/null
    sleep 1
    if ps -p "$PID_BY_PORT" > /dev/null 2>&1; then
        kill -9 "$PID_BY_PORT" 2>/dev/null
        sleep 1
    fi
fi

# 进入 app 目录
cd "$APP_DIR"

# 检查 .env 配置文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 配置文件${NC}"
    echo -e "${YELLOW}   复制模板: cp .env.example .env${NC}"
    echo -e "${YELLOW}   然后填入你的 LLM API 密钥（赛博勇哥功能需要）${NC}"
    echo -e "${YELLOW}   无 .env 也可启动，但 LLM 功能不可用${NC}"
    echo ""
fi

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 安装依赖...${NC}"
    npm install
fi

# 检查是否需要构建：dist 不存在 或 源码比 dist 更新
NEED_BUILD=false
if [ ! -d "dist" ]; then
    NEED_BUILD=true
else
    # 找 src/ 下最新修改的文件，与 dist 目录比较
    NEWEST_SRC=$(find src/ -type f -newer dist -print -quit 2>/dev/null)
    if [ -n "$NEWEST_SRC" ]; then
        NEED_BUILD=true
    fi
fi

if [ "$NEED_BUILD" = true ]; then
    echo -e "${YELLOW}🔨 构建项目...${NC}"
    npm run build
else
    echo -e "${GREEN}📦 dist 已是最新，跳过构建${NC}"
fi

# 启动服务 (后台运行)
echo -e "${GREEN}🚀 启动服务...${NC}"
if [ -f ".env" ]; then
    nohup node --env-file .env server.mjs > "$LOG_FILE" 2>&1 &
else
    nohup node server.mjs > "$LOG_FILE" 2>&1 &
fi
APP_PID=$!

# 保存 PID
echo $APP_PID > "$PID_FILE"

# 等待服务启动
sleep 2

# 检查是否启动成功
if ps -p $APP_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 服务启动成功！${NC}"
    echo -e "${GREEN}   PID: $APP_PID${NC}"
    echo -e "${GREEN}   端口: $PORT${NC}"
    echo -e "${GREEN}   日志: $LOG_FILE${NC}"
    echo -e "${GREEN}   访问: http://localhost:$PORT${NC}"
else
    echo -e "${RED}❌ 服务启动失败！${NC}"
    echo -e "${RED}   请查看日志: $LOG_FILE${NC}"
    rm -f "$PID_FILE"
    exit 1
fi
