# 360° 转一圈模拟器

> 管理会计实战演练游戏 —— 在虚拟世界体验开店创业的酸甜苦辣

一款基于 Web 的餐饮创业模拟游戏，灵感来源于网红博主"勇哥"的创业避坑系列视频。玩家从选择品牌、选址、装修、选品到人员配置，全方位体验开店经营的决策过程，学习管理会计的核心概念。

## ✨ 特性

- 🏪 **完整创业流程** — 品牌选择 → 选址 → 装修 → 选品 → 人员配置 → 经营决策
- 📊 **管理会计教学** — 收入、变动成本、固定成本、毛利率、盈亏平衡点
- 🤖 **赛博勇哥** — LLM 驱动的实时经营诊断（支持 OpenAI 兼容接口）
- 🗺️ **供需模型** — 堂食 + 外卖双通道，消费者距离环，周边店铺竞争
- 🎯 **交互事件** — 15 个上下文感知的随机经营事件
- 🏥 **健康诊断** — 12 条规则自动检测慢性亏损、定价异常等问题
- 🎮 **CLI Agent** — JSON-lines 协议，支持 LLM Agent 自动游玩与压测

## 🎯 胜利条件

- 累计利润 ≥ 总投资额（回本）
- 连续 6 周盈利

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript 5.9 |
| 构建 | Vite 7 |
| 样式 | Tailwind CSS 3.4 + Radix UI + shadcn/ui |
| 图表 | Recharts |
| 游戏引擎 | 纯函数架构（gameEngine + gameActions + gameQuery） |
| LLM | OpenAI 兼容接口，流式 SSE |

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/your-username/360simulator.git
cd 360simulator

# 安装依赖并启动开发服务器
cd app
npm install
npm run dev
```

访问 `http://localhost:5173` 开始游戏。

### 启用赛博勇哥（可选）

赛博勇哥需要 LLM API 支持，兼容所有 OpenAI 格式的接口：

```bash
cp app/.env.example app/.env
# 编辑 .env，填入你的 API 密钥
```

### 生产部署

```bash
cd app
npm run build
# 使用内置 BFF 服务器（自动代理 LLM API，密钥不暴露到前端）
node --env-file .env server.mjs
```

或使用快捷脚本：

```bash
./start.sh   # 构建并启动（端口 10041）
./stop.sh    # 停止服务
```

## 🏗️ 项目结构

```
360simulator/
├── app/                    # 前端主应用
│   ├── src/
│   │   ├── components/     # UI 组件（55 个 shadcn + 23 个业务组件）
│   │   ├── data/           # 游戏数据配置
│   │   ├── hooks/          # React Hooks
│   │   ├── lib/            # 纯函数游戏引擎
│   │   │   ├── gameEngine.ts       # 核心引擎（周循环、成本计算）
│   │   │   ├── gameActions.ts      # 35 种 Action 处理器
│   │   │   ├── gameQuery.ts        # 计算属性（财务统计）
│   │   │   ├── healthCheck.ts      # 经营健康诊断
│   │   │   ├── eventEngine.ts      # 交互事件引擎
│   │   │   ├── supplyDemand/       # 供需模型
│   │   │   └── llm/               # 赛博勇哥 LLM 集成
│   │   ├── automation/     # 智能自动化压测系统
│   │   └── types/          # TypeScript 类型定义
│   ├── server.mjs          # BFF 代理服务器
│   └── .env.example        # 环境变量模板
├── cli/                    # CLI Agent 接口
├── start.sh               # 快捷启动脚本
└── stop.sh                # 快捷停止脚本
```

## 🎮 游戏系统

### 核心引擎

纯函数架构，UI 与逻辑完全解耦：

```
gameActionTypes.ts  →  35 种 GameAction（discriminated union）
gameActions.ts      →  dispatch(state, action) => ActionResult
gameEngine.ts       →  weeklyTick 周循环、成本计算、员工生命周期
gameQuery.ts        →  财务统计、供需结果、游戏结果判定
```

### 子系统

| 系统 | 说明 |
|------|------|
| 供需模型 | 堂食（Ring0-2）+ 外卖（Ring0-3）双通道 |
| 外卖平台 | 美团 / 饿了么 / 抖音，权重分模型 |
| 员工系统 | 招聘、培训、任务分配、士气、疲劳 |
| 营销系统 | 曝光度 + 口碑双指标漏斗 |
| 认知系统 | 6 级认知等级，踩坑经验积累 |
| 库存系统 | 补货策略、损耗率 |
| 健康诊断 | 12 条规则覆盖慢性失血场景 |
| 交互事件 | 15 个上下文感知事件 |
| 赛博勇哥 | LLM 流式诊断 + 可执行提案 |

## 🤖 CLI Agent

支持 LLM Agent 通过 JSON-lines 协议自动游玩：

```bash
cd cli
npm install
npm run dev          # 启动 CLI（stdin/stdout）
node agent-play.mjs  # 模拟 Agent 完整游玩
```

### 智能自动化压测

```bash
cd app
npm run auto:smart        # 默认模式
npm run auto:smart:full   # 完整模式（6 场景 × 多种子）
```

## 📄 License

MIT
