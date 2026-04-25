# 360° 模拟器：可玩性提升计划 v1.0

> **创建日期**：2026-04-25
> **目标读者**：未来负责开发的 Claude Code 实例
> **执行模式**：自驱动 — 按 phase 顺序实现 → 自检 → 提交 → 进入下一 phase

---

## 设计哲学（必读）

```
好玩 = (即时奖励 × 戏剧张力) / (操作摩擦 + 学习曲线)
```

**优先级：砍摩擦 > 加张力 > 给奖励 > 数值平衡**

不再强调"管理会计教学"。三层目标：

- **第 1 局**：玩家觉得**爽**，想继续
- **第 2 局**：玩家觉得**有挑战**，想通关
- **第 3 局**：玩家觉得**有花样**，想分享

---

## 通用工作流（每个 Phase 都按这个走）

```
读本 phase → 实现所有任务 → 跑自检脚本 → 检查指标
  PASS → 按 commit 模板提交 → 进入下一 phase
  FAIL → 调整 → 重测（最多 3 轮）；连续失败暂停求助
```

**强制规则**：

- 每个 phase 一个 git commit，commit message 必须含 metrics 数据
- 每个 phase 的自检脚本输出 `cli/agent-tests/reports/phaseN-<timestamp>.json` 永久存档
- 任何破坏性数值改动都放在 `app/src/data/balance.ts`，便于 revert
- 不要主动 `git push`（除非用户明确要求），完成 commit 即可

---

## CLI Agent 自检框架（Phase 0 建立）

新建目录 `cli/agent-tests/`：

```
cli/agent-tests/
├── runner.mjs             # 通用：spawn cli + JSON-lines client
├── strategies/            # 决策策略（agent 玩家行为）
│   ├── conservative.mjs   # 保守流（学校+独立+简装+不开外卖）
│   ├── aggressive.mjs     # 激进流（写字楼+加盟+高装+全外卖）
│   └── balanced.mjs       # 均衡流
├── baseline.mjs           # Phase 0：baseline metrics
├── phase1_pace.mjs        # Phase 1：节奏指标
├── phase2_feedback.mjs    # Phase 2：反馈完整性
├── phase3_drama.mjs       # Phase 3：戏剧性指标
├── phase4_replay.mjs      # Phase 4：成就/种子/剧本
├── phase5_ui.mjs          # Phase 5：build + bundle size
├── phase6_balance.mjs     # Phase 6：策略胜率分布
└── reports/               # 历史报告
```

每个自检脚本统一输出：

```json
{
  "phase": 1,
  "timestamp": "2026-04-25T17:30:00Z",
  "metrics": { "weeksPerSec": 2.1, "clicksPerWeek": 1.4 },
  "expected": { "weeksPerSec": ">=2.0", "clicksPerWeek": "<=1.5" },
  "pass": true,
  "duration_ms": 12340
}
```

**参考样例**：`/tmp/agent_player.mjs`（已写过的客户端骨架，可作为 runner.mjs 的起点）。

---

## Phase 0：基础设施（先做，否则后续 phase 无法验证）

**目标**：让后续每个 phase 都能 quantitatively 自检 + 录像回放 + seed 复现。

**任务（4 项）**：

1. **加 game seed**：`app/src/lib/gameEngine.ts` 的 `createInitialGameState(seed?: number)` 接收可选种子，所有 `Math.random()` 替换为 seeded RNG（用 mulberry32 单文件即可）
2. **加 timeline 收集**：`cli/src/timeline.ts` 在 `next_week` 后记录 `{ week, events[], cashChange, key_decisions[] }`，CLI 加 `query: 'timeline'`
3. **新建 runner 框架**：`cli/agent-tests/runner.mjs`（封装 spawn + JSON-lines + 通用 metrics 收集器）
4. **新建 baseline.mjs**：用"无脑 next_week"策略玩完一局 60 周，收集所有当前指标作为对比基线

**指标采集（baseline）**：

- `wallClockMs` —— 完整玩完耗时
- `weeksCompleted` / `bankruptWeek` —— 终局
- `actionsCount` / `clicksPerWeek` —— 操作密度
- `dramaMoments` —— crisis/highlight/turning_point 总数
- `eventCount` / `responseCount` —— 事件触发与响应

**自检 PASS 条件**：

- `npm run agent-test:baseline` 跑通且输出 `reports/baseline.json`
- `timeline` query 返回非空数组
- 用同 seed 跑 2 次结果完全一致（cash/profit 对比）

**commit 模板**：

```
chore(cli): Phase 0 基础设施 - seed/timeline/runner/baseline

- gameEngine 接收可选 seed，Math.random 全部替换为 mulberry32
- CLI 加 timeline query，记录每周关键事件
- 建立 cli/agent-tests/ 自检框架
- baseline 报告：52 周完整玩完耗时 X ms，操作 Y 次
```

---

## Phase 1：节奏革命 ★ 最高优先级

**目标**：完整玩 52 周从 ~60s 压到 ~15s（agent wall-clock，不含人类 think time）。

**量化验收**：

- `weeksPerSec ≥ 2.0`（baseline ~0.8）
- `clicksPerWeek ≤ 1.5`（baseline ~3，每周事件+周报+升级各点一次）
- `popupChainMs ≤ 100`（弹窗连续可秒点）

**任务（6 项）**：

1. **删 1.5s 推周延迟**：`app/src/components/OperatingPanel.tsx` 第 60-67 行的 `setTimeout(...,1500)` 改为立即执行；保留视觉过渡用 CSS animation（不阻塞 dispatch）
2. **加全局 speed 状态**：`app/src/hooks/usePlaySpeed.ts`，提供 1×/2×/4× tab，存 localStorage；speed 影响弹窗自动关闭延迟
3. **加"自动推进 N 周"按钮**：`OperatingPanel` 顶部加按钮组 `+1 / +3 / +5 / +13`，触发后循环调 dispatch；遇到 `pendingInteractiveEvent` 自动暂停
4. **弹窗合并**：周报弹窗内嵌入升级 banner（升级时显示，否则隐藏），删 `CognitionLevelUpDialog` 单独弹窗或改为 toast
5. **全局快捷键**：`Esc` 关顶层弹窗、`Space` 下一周、`1/2/3/4` 切 Tab、`?` 帮助
6. **CLI 同步**：CLI 加 `auto_advance` action（参数 `weeks: number`），等价 UI 的"自动推进 N 周"

**自检脚本** `phase1_pace.mjs`：

```js
// 1. reset → setup 标准流程 → open
// 2. 调 auto_advance(52) 跑完一局
// 3. 测 wallClockMs / actionsCount
// 4. 模拟弹窗连点：发 5 个 next_week + clear_weekly_summary 间隔 < 100ms
// 5. 对比 baseline 改善率
```

**PASS 条件**：3 项指标全达标 + 改善率 ≥ 100%。

**commit 模板**：

```
feat(pacing): Phase 1 节奏革命 - 去延迟+倍速+自动推进+快捷键

- OperatingPanel 移除 1.5s setTimeout
- 新增 usePlaySpeed hook，1×/2×/4× 全局倍速
- 自动推进 N 周按钮（+1/+3/+5/+13）
- 弹窗合并：升级 banner 内嵌周报
- 全局快捷键：Esc/Space/数字键切换
- CLI 加 auto_advance action

指标：weeksPerSec X.X (baseline X.X), clicksPerWeek X.X (baseline X.X)
完整 52 周耗时：XXs (baseline XXs)
```

---

## Phase 2：即时反馈

**目标**：玩家做关键决策**前**看到预测，做完**后**看到 toast 摘要。

**量化验收**：

- 调价 / 营销 / 老板行动 3 类决策**前**都能 query 到预测影响
- 重要事件触发**后** state 中有对应 toast 队列
- agent 视角"决策透明度自评"≥ 8/10（脚本里启发式判分）

**任务（6 项）**：

1. **价格预测**：`app/src/lib/gameQuery.ts` 加 `predictPriceChange(state, productId, newPrice) → { Δrevenue, Δdemand, Δprofit, breakEvenAt }`
2. **老板行动 effects 提示**：`BossActionPanel` 5 个动作每个加 `effectsHint`（hover 显示 "+5 曝光 / -300 现金 / +10 EXP"）
3. **营销 ROI 预览**：`MarketingPanel` 8 个活动各显示 "预计 ROI: +X% / -X 周回本"
4. **Toast 系统**：`app/src/hooks/useToast.ts` + `Toaster` 组件；右上角 stack，3s 自动消失，可点关
5. **关键事件 → toast**：事件响应后 dispatch toast（"你选了 X，预计影响 Y"）；薪资变动、员工离职、库存告警全部 toast
6. **CLI 暴露**：`stateView.ts` 加 `toasts: Array<{ type, message, week }>`；新 query `prediction`（参数化决策预测）

**自检脚本** `phase2_feedback.mjs`：

```js
// 1. 调用 prediction query 测 3 类决策都返回字段
// 2. 触发事件 → 检查 toast 队列长度 ≥ 1
// 3. 启营销活动 → ROI 预测非空
// 4. 计算 "决策透明度评分"：可见 / 不可见决策比
```

**PASS 条件**：所有 prediction 接口返回非 null；toast 数 ≥ 1/事件；评分 ≥ 8/10。

**commit 模板**：

```
feat(feedback): Phase 2 即时反馈 - 决策预览+Toast 系统

- gameQuery 加 predictPriceChange / predictMarketingROI
- BossActionPanel/MarketingPanel 各加 effectsHint/roiPreview
- 新增 useToast hook + Toaster 组件
- CLI stateView 暴露 toasts，加 prediction query

指标：决策透明度 X/10 (baseline X/10), Toast 触发率 X/事件
```

---

## Phase 3：戏剧性

**目标**：每局至少 5 个让玩家"哇/惨/绝"的时刻。把"温水煮青蛙 30 周"改成"过山车 52 周"。

**量化验收**：

- 5 局 × 52 周平均 `dramaCount ≥ 5`（crisis + highlight + turning_point + bankruptcy_threat）
- runway < 3 周时 `state.crisisMode === true`
- 连亏 5 周后**必触发**翻盘事件链
- 连亏 8 周后**必触发**`debt_collector` 倒计时

**任务（6 项）**：

1. **危机模式**：新建 `app/src/lib/dramaEngine.ts`，每周 tick 检测 → state 加 `crisisMode: 'none' | 'cash_low' | 'rep_crisis' | 'bankruptcy_warning'`；UI Header 危机模式时红色脉冲
2. **5 个高光事件**：`app/src/data/interactiveEvents/highlights.ts`：
   - `viral_dish` —— 单周营收破万触发，加 trustConfidence
   - `media_探店` —— 整洁度 ≥ 80 持续 3 周触发
   - `chain_invitation` —— 连续 6 周盈利后触发"加盟邀请"事件链
   - `delivery_top3` —— 外卖排名进前 3 触发
   - `award_winning` —— 口碑 > 90 持续 4 周触发
3. **3 个翻盘事件链**：`turnaround.ts`：
   - `vc_angel` —— 连亏 5 周后概率触发"投资人主动找上门"
   - `media_redeem` —— 食安/卫生告警后 4 周触发"媒体翻案"
   - `community_save` —— 社区/学校客群忠诚度高时触发"社群众筹"
4. **破产倒计时**：连亏 8 周强制 `debt_collector` 事件链（不可避免，玩家必须做出"卖店 / 借钱 / 死撑"3 选 1）
5. **事件触发率上调**：`pendingInteractiveEvent` 概率 × 1.5；同事件冷却 ≥ 8 周
6. **CLI 暴露**：`stateView` 加 `crisisMode`；timeline 自动标记 dramaMoment

**自检脚本** `phase3_drama.mjs`：

```js
// 跑 5 局 × seed 不同
// 统计每局 crisis/highlight/turning/bankruptcy 数
// 验证：连亏 5 周后必有翻盘事件
// 验证：连亏 8 周后必有 debt_collector
```

**PASS 条件**：5 局平均 drama ≥ 5；强制事件链 100% 触发。

**commit 模板**：

```
feat(drama): Phase 3 戏剧性 - 危机/高光/翻盘/破产倒计时

- 新建 dramaEngine：crisisMode 状态 + UI 红色脉冲
- 5 个高光事件 + 3 个翻盘事件链
- debt_collector 强制事件（连亏 8 周）
- 事件触发率 × 1.5，加 8 周冷却

指标：5 局平均 dramaCount X.X, 翻盘触发率 100%
```

---

## Phase 4：成就与重玩

**目标**：通关后玩家有动机再来。

**量化验收**：

- 30+ achievements，10+ 在第 1 局可达
- 同 seed 重玩 100% 复现
- 6 个经典剧本全部可玩到结局
- New Game+ 模式可启动

**任务（7 项）**：

1. **成就系统**：`app/src/lib/achievements.ts` —— 30 个 achievement（首次盈利、连续盈利 X 周、单周破 5K/破万/破 5 万、品牌专属链、灾难成就如"连续 30 周亏损"）；`useGameState` 拉 progress；存 localStorage v2 schema
2. **AchievementsPanel.tsx** —— 通关页"本局解锁"+ 总览页"全成就"
3. **game seed UI**：`WelcomePage` 加"输入种子开局"按钮；URL 参数 `?seed=xxx` 支持
4. **6 经典剧本** —— `app/src/data/scenarios/`，每个剧本预设品牌/区位/装修/选品/初始资金/特殊事件链：
   - `scen_zhinanguozhi` 脚盆果汁（蜜雪对面 / 初始 ¥30k 困难）
   - `scen_baiwanshenglou` 百万奶茶大厦（整栋楼 / 7 员工 / 高负债开局）
   - `scen_zhongyao` 中药奶茶（小学门口 / 定位灾难）
   - `scen_shanlu` 禅意奶茶（山路 / 客流极低）
   - `scen_kuaizhao` 哪吒仙饮（快招陷阱 / 自动触发加盟事件链）
   - `scen_aixiage` AI 写歌（强制全程使用营销 gimmick）
5. **每日挑战**：按 `Date.now()` 日 hash 生成种子；首页显示"今日挑战种子: XXX"
6. **New Game+**：通关后存档 cognition.level；新开局所有事件难度 × 1.5，奖励翻倍
7. **CLI 接口**：`cli/src/main.ts` 启动支持 `--seed=X` 与 `--scenario=Y`

**自检脚本** `phase4_replay.mjs`：

```js
// 1. seed=42 玩 2 次 → 完全一致
// 2. 跑 6 个 scenario → 全部能玩完
// 3. 用激进策略玩 → 触发的 achievement ≥ 10
// 4. NG+ 模式启动 → 难度系数检查
```

**PASS 条件**：seed 一致；6 剧本可玩；achievement ≥ 10。

**commit 模板**：

```
feat(replay): Phase 4 成就与重玩 - achievements/seeds/剧本/NG+

- 30+ achievement 系统 + AchievementsPanel
- game seed UI + URL 参数支持
- 6 经典剧本：脚盆果汁/百万奶茶/中药奶茶/禅意/快招/AI写歌
- 每日挑战 + New Game+ 难度 × 1.5
- CLI 启动支持 --seed/--scenario

指标：成就 X/30, 剧本 6/6 可玩, seed 复现率 100%
```

---

## Phase 5：UI 整合

**目标**：跨 Tab 信息查找成本减半 + 移动端可玩。

**量化验收**：

- 关键决策的 click depth ≤ 2
- mobile viewport (375×667) 主流程可玩
- bundle size 增长 ≤ 15%
- lighthouse perf ≥ 80

**任务（6 项）**：

1. **TodaysTaskBar.tsx** —— sticky 在 Header 下，列紧急事项（员工想离职 / 库存告警 / 活动到期 / 事件待响应 / 现金告警），每条带"立即处理"跳转
2. **MiniSparkline.tsx** —— Header 下方 8 周毛利率/口碑/曝光趋势小图（recharts ResponsiveContainer）
3. **决策卡片化** —— `OperatingPanel` 顶部加"本周关键决策"区域，5 张卡片合并：定价 / 老板行动 / 员工任务 / 营销 / 推周
4. **Cmd+K 全局搜索** —— `@/components/CommandPalette.tsx`，支持搜 Tab / 操作 / 员工 / 产品
5. **GameHeader 移动端紧凑模式** —— 5 个数字 < 768px 折叠成 2×3 网格 + 抽屉
6. **bundle size 监控** —— `phase5_ui.mjs` 跑 `npm run build` 后检查 dist 大小

**自检脚本** `phase5_ui.mjs`：

```js
// 1. exec npm run build → 解析输出
// 2. 测 bundle size vs phase 0 baseline
// 3. CLI: 关键决策的 query path 深度
// 4. 简单模拟 mobile：headless puppeteer 设 viewport 验证可点击
```

**PASS 条件**：build pass；bundle size ≤ 1.15× baseline；click depth ≤ 2。

**commit 模板**：

```
feat(ui): Phase 5 UI 整合 - 今日待办/趋势小图/决策卡片/Cmd+K

- TodaysTaskBar：跨 Tab 紧急事项 sticky 栏
- MiniSparkline：Header 下方 8 周趋势
- 决策卡片化：本周 5 张关键决策卡
- Cmd+K 全局搜索面板
- GameHeader 移动端紧凑模式

指标：bundle X kb (+ X.X%), click depth X, mobile viewport pass
```

---

## Phase 6：抛光与平衡

**目标**：5 种策略胜率分布合理，移动端 UX 完整。

**量化验收**：

- 5 种策略各跑 10 局，胜率分布 25%-55%（避免一家独大或全输）
- mobile viewport 主流程跑通
- lighthouse perf ≥ 85

**任务（7 项）**：

1. **5 种策略 agent**：保守 / 激进 / 外卖 / 堂食 / 网红
2. **数值平衡循环**：跑 5 × 10 = 50 局，调整 `app/src/data/balance.ts`
3. **移动端 responsive** —— 所有面板加断点
4. **大列表虚拟化** —— `react-window` 处理员工/库存/事件历史
5. **i18n 框架** —— 加 `react-i18next`，先支持中文，留扩展位
6. **PWA manifest** —— `index.html` 加 manifest + service worker
7. **lighthouse 跑分** —— 加 `npm run lighthouse` 命令

**自检脚本** `phase6_balance.mjs`：

```js
// 1. 跑 5 strategies × 10 games × 60 weeks
// 2. 统计胜率
// 3. 跑 lighthouse → 解析 perf 分
// 4. 跑 puppeteer mobile snapshot 测试
```

**PASS 条件**：策略胜率合理 + perf ≥ 85 + mobile 流程跑通。

**commit 模板**：

```
chore(polish): Phase 6 抛光 - 平衡/移动/性能/i18n/PWA

- 5 策略 agent + balance.ts 调优
- responsive + react-window + i18n + PWA

指标：胜率分布 X-X%, perf X, mobile pass
```

---

## 路线图速览

| Phase | 主题     | 任务数 | 代码量    | 优先级 | 关键 metric          |
| ----- | -------- | ------ | --------- | ------ | -------------------- |
| 0     | 基础设施 | 4      | ~200 行   | P0     | 自检框架就位         |
| 1     | 节奏革命 | 6      | ~150 行   | **P0** | weeksPerSec ≥ 2.0    |
| 2     | 即时反馈 | 6      | ~300 行   | P1     | 决策透明度 ≥ 8/10    |
| 3     | 戏剧性   | 6      | ~500 行   | **P0** | dramaCount ≥ 5/局    |
| 4     | 成就重玩 | 7      | ~800 行   | P1     | 6 剧本可玩           |
| 5     | UI 整合  | 6      | ~500 行   | P2     | click depth ≤ 2      |
| 6     | 抛光     | 7      | ~400 行   | P2     | 胜率 25-55%          |

**关键路径**：Phase 0 → 1 → 3 → 4 是必经之路。Phase 2/5/6 可视进度调整。

---

## 风险点与回滚

1. **Phase 1 弹窗合并可能信息密度过高** → 加 collapse/expand 折叠
2. **Phase 3 事件率提高可能"事件疲劳"** → 同事件冷却 ≥ 8 周（已含）
3. **Phase 4 成就 schema 变更** → localStorage 加 `version: 2` + 兼容老存档
4. **任何数值改动**都放 `balance.ts` 单文件，便于 `git checkout balance.ts` 回滚
5. **每个 phase 的自检 ~5 分钟**（CLI 启动 + 60 周 × 5 局）→ 必要时 `Promise.all` 并行启多个 CLI 实例

---

## 已完成的前置工作（背景）

- **CLI Agent 端口已可用**（commit `8ae03e9`）：
  - `cli/src/stateView.ts` 已暴露 25+ 字段，支持 `pendingInteractiveEvent` 完整查看
  - `cli/src/gameRunner.ts` 已加 `next_week` 守卫（事件未响应时拒绝推进）
  - 新增 6 个 query：`pending_event` / `inventory` / `weekly_report` / `nearby_shops` / `cognition` / `boss_action`
  - 已有可工作的 agent 客户端样例：`/tmp/agent_player.mjs`（~170 行）
- **本计划起点**：在已有 CLI 自检能力之上，按 Phase 0 → 6 推进可玩性提升

---

## Claude Code 拿到这份 plan 后的第一步

```bash
# 1. 读这份计划（你正在做的事情）
# 2. 确认 git 工作区干净：git status
# 3. 创建 TaskList，列出 Phase 0-6 为待办任务
# 4. 进入 Phase 0：
#    - 实现 4 项任务
#    - 跑 baseline.mjs，记录 baseline metrics
#    - 验证 PASS 条件
#    - commit
# 5. 进入 Phase 1
# ... 依此类推
```

每个 phase 完成后**必须**：

- ✅ 自检脚本输出 `pass: true`
- ✅ commit message 包含具体指标数据
- ✅ 确认 git 工作区干净（无遗漏改动）
- ✅ 在 `cli/agent-tests/reports/` 留下报告

**遇到不可解决的阻塞**（连续 3 次 fail / 设计冲突 / 数值无法平衡）→ 暂停推进、记录在 `docs/PHASE_LOG.md` 等用户介入。

---

## 附：CLI 端口快速参考

```bash
# 启动 CLI agent server
cd cli && npx tsx src/main.ts

# 主要 actions（详见 cli/README.md）
{ "id": "1", "type": "action", "action": { "type": "select_brand", "brandId": "independent" } }
{ "id": "2", "type": "action", "action": { "type": "next_week" } }
{ "id": "3", "type": "action", "action": { "type": "respond_to_event", "eventId": "...", "optionId": "..." } }

# 主要 queries
{ "id": "1", "type": "query", "query": "state" }
{ "id": "2", "type": "query", "query": "available_actions" }
{ "id": "3", "type": "query", "query": "pending_event" }
{ "id": "4", "type": "query", "query": "weekly_report" }

# Meta
{ "id": "1", "type": "meta", "meta": "reset" }
```

---

**版本历史**：

- v1.0 (2026-04-25) — 初版，由 Claude 在审计 + 完整玩通一局后撰写
