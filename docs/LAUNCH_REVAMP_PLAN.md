# 360° 模拟器 — 小红书走量上线改造方案 v1.0

> 创建：2026-05-30 ｜ 审计方：Claude（4 路子代理） + codex（独立交叉验证）
> 目标：作为免费游戏发小红书/抖音走量，达成【好玩 · 重玩 · 愿分享 · 有趣+教学】
> 执行：自驱动，按 R1→R4 顺序用 subagent 改造，每阶段过 build/test 验收。**不做 git 提交（留工作区待 review）。**

---

## 一、审计总结论

> **这是一款桌面硬核模拟器，套了个未适配的移动壳。内容有走量基因（勇哥毒舌、翻车剧本），但用户「进不去、玩不完/玩不爽、发不出去」。**
> 问题不在会计系统不够深，而在**获客漏斗三段全断**。工程底子是好的（build 通过、23 测试全过、陈旧 .js 已 gitignore 非风险）——这是产品/UX/增长问题。

5 个独立信源（codex + 4 子代理）高度收敛，铁证：50 局压测中 `dine_in` 策略**赚 12.9 万、0 破产，胜率却只有 50%**——玩家在赚钱，游戏却判"未达标"。这是趣味性头号杀手。

### 漏斗三段断点

| 断点 | 现状（证据） | 后果 |
|---|---|---|
| **进不去** | 无新手引导；开店前 5 步重度筹备（`App.tsx:388-425`）；欢迎页 566 行长落地页，CTA 埋在底部（`WelcomePage.tsx:543`）；移动端阻断（顶栏 6 数据墙 `GameHeader.tsx:66`、6 Tab 横向溢出 `App.tsx:661`、街景双栏挤压、`grid-cols-5` 表格、触摸目标 <44px、`text-[10px]`）；无 viewport 缩放控制 | 高曝光零留存 |
| **玩不爽** | 胜利与"赚钱"脱钩（`gameEngine.ts:166-222` win route 卡 week≥32 / exposure≥42 / reputation≥55）；52 周长局；drama 单向（无过山车，`bankruptcy_threat` 全 0）；**成就解锁零反馈**（`gameEngine.ts:2362` 只写 state 不弹 toast）；核心会计概念锁死认知 Lv3（~18-30 周，多数人弃游前看不到，`cognitionData.ts:187-308`） | 玩家无爽点、学不到 |
| **发不出** | **零分享机制**（全库无 `navigator.share`/`clipboard`/`html-to-image`）；结局页只有"重新开始"（`GameResult.tsx:217`）；`AchievementsPanel` 孤儿组件无人引用；6 剧本前端死代码（`applyScenarioToInitialState` 只改现金）；无 OG meta（`index.html`）；seed 只读不可生成分享链接 | 无自传播 = 走不动量 |

### 上线运维地雷（P0）

1. **LLM 财务地雷**：未实现 BYOK；server 鉴权悖论（前端从不带 token → 配 token 全员 403；不配 token 仅 loopback/反代后可被无限刷）；限速可被伪造 `X-Forwarded-For` 绕过（`server.mjs:72-96`）。上千免费用户 → 要么功能坏、要么烧爆作者钱包。
2. **无 key 不降级**：`getLLMConfig()` 定义了从不调用；无 key 时按钮可点 → 扣游戏币 → 500 报错（`CyberYongGe.tsx:179`）。
3. **无 ErrorBoundary**：任何渲染异常 = 整页白屏（`main.tsx`）。
4. **无主存档持久化**：刷新即丢进度（`useGameState.ts:36`）——留存杀手。
5. **lint 失败**：`useGameState.ts:468` render 期读 ref（React 19）。

---

## 二、设计主张

**「在硬核内核之上加一道休闲前门」**——不阉割模拟深度，而是：

1. 补一条**休闲主线**：剧本卡/一键开局 → 3 秒进经营 → 短局（默认仍可长玩，但有清晰早期小胜）→ 一键战报分享。
2. 硬核系统**默认折叠/智能托管**（自动补货、自动出餐优先级），愿意深挖的玩家可展开。
3. LLM 勇哥：**默认规则版（零成本、人人可用）**，真 LLM 走 BYOK（玩家自带 key）或作者配额托管。

---

## 三、改造路线（R1→R4，按序执行）

### R1 — 玩得爽（核心循环可赢 + 即时反馈） 🎯最高趣味杠杆
**目标**：玩家"赚到钱就赢"，成就解锁有金色爆点，开局前 2 周就有可见波动。

- **[P0] 胜利=赚钱**：`gameEngine.ts` `getWinRoute` 增加早期通关路线（累计利润转正 + 连盈 6 周即"小胜利/回本在望"，不卡 exposure/reputation/week≥32）。数值入口收敛到 `balance.ts`。
- **[P0] 成就即时反馈**：监听 `unlockedAchievements` 增量 → `pushToast` 金色"🏆 成就达成"；调用 `persistUnlocked` 跨局持久化（`achievements.ts:360` 已有函数没人调）。
- **[P1] 拉高开局水位**：`gameEngine.ts:592-599` `launchProgress 8→~22`、`awarenessStock 12→~28`，缩短前 6 周空窗。
- **[P1] 早期高光保底**：`highlight_viral_dish` 加低门槛变体（week≤4 且 profit>0 触发一次），保证首月吃一次高光。
- **[P1] 会计概念前移**：`cognitionData.ts` 把 `grossMargin/variableCost/fixedCost` 的 `unlockLevel` 从 3 降到 1，Lv0 给 fuzzy 而非 hidden；周报关键数旁加一句话概念气泡。
- **验收**：跑 `auto:smart` 压测，dine_in/balanced 等"会赚钱"策略胜率显著上升；新建/已有自检脚本确认早期路线可触发。

### R2 — 进得去（一键开局 + 剧本入口 + 移动端漏斗）
**目标**：刷到→30 秒内在玩；375px 竖屏主流程可玩。

- **[P0] 剧本真正可玩**：`applyScenarioToInitialState` 完整应用 品牌/选址/装修/选品/员工（现只改现金）；`useGameState` 加 `scenario?` 入参 + `quickStart(scenarioId?, seed?)`（用现成 dispatch 序列在单次 setState 内 fold 应用，避开 React 批处理）。
- **[P0] 欢迎页改造**：首屏一张"40 万→开店→连赢即胜"卡 + 大 CTA「立即开店」；下方剧本卡墙（复用 `scenarios.ts` narrative/tags/difficulty），点击直接 quickStart 进经营；长介绍折叠二级。
- **[P0] 移动端关键路径**：顶栏紧凑（窄屏只留 现金+周利润，余进抽屉）；Tabs `<md` 真横滚/底部 TabBar；筹备步骤器单列；`GameResult` `grid-cols-2`；街景上下堆叠+响应式高度；`SupplyDemandPanel` `grid-cols-5` 改卡片；交互按钮 `min-h-[44px]`、正文 ≥`text-xs`。
- **[P0] viewport/基建**：`index.html` viewport 加 `maximum-scale=1,user-scalable=no,viewport-fit=cover`；`<html lang="zh-CN">`。
- **验收**：Playwright 375×667 跑欢迎页→剧本→经营→推周→结局无溢出/可点；build 通过。

### R3 — 发得出（战报分享 + 重玩可见）🚀最高增长杠杆
**目标**：通关后一键生成可晒成绩海报；剧本/成就/挑战链接前台可见。

- **[P0] 9:16 战报海报**：新增 `ShareCard` 组件，引入 `html-to-image`，把结局核心（赚/亏额、活了几周、剧本、踩坑标签、勇哥金句、本局成就、挑战二维码/链接）渲染成竖版海报 → 移动端 `navigator.share`(带图)、桌面 `<a download>`+`clipboard` 复制带话题文案（`#360度转一圈 #创业避坑 #勇哥`）。
- **[P0] 挑战链接**：结局页"复制挑战链接" = `origin + ?scenario=xxx&seed=N`；`App.tsx` 加 `readScenarioFromUrl`。
- **[P1] 成就墙上线**：把孤儿 `AchievementsPanel` 挂进结局页（本局解锁高亮）+ 一个入口；修两个 `test:()=>false` 剧本成就。
- **[P1] OG/分享 meta**：`index.html` 补 `og:title/og:description/og:image` + favicon。
- **验收**：结局页能导出 PNG 海报；挑战链接可复现同剧本/种子；build 通过。

### R4 — 上线安全（运维 P0）
**目标**：免费大流量下不烧钱、不白屏、不丢档。

- **[P0] LLM 安全**：默认**规则版勇哥**（基于现成 `simulator.ts`/`healthCheck` 本地算建议，零 LLM）；真 LLM 入口仅在 `getLLMConfig().available` 时显示，否则隐藏/切规则版；支持 **BYOK**（前端 localStorage 存玩家自己的 key，作者零成本）。`CyberYongGe.tsx:179` `canConsult` 纳入可用性。
- **[P0] ErrorBoundary**：`main.tsx` 包 `<App/>`，捕获后显示"出错了"+清 localStorage 逃生按钮。
- **[P1] 主存档持久化**：`useGameState` debounce 存 localStorage（带 schema version），启动恢复 + "继续上局/重新开始"。
- **[P1] lint 修复**：`isAutoAdvancing` 改 state。
- **[P1] server 加固**（若作者坚持托管 key）：按真实 socket IP 日配额 + 全局日预算熔断 + AbortController 超时；否则文档明确 BYOK 部署。
- **[P2] 性能**：`vite.config.ts` `manualChunks` 拆 recharts/radix vendor；重面板 `React.lazy`（当前单 chunk 1.4MB/gzip 396KB）。
- **[P2] 匿名埋点**：进游戏/完成首周/通关/点分享 4 个事件（走量必须看漏斗）。

---

## 四、明确不做（本轮交付外）
- 后端账号体系/排行榜服务器（需后端，超出"免费 H5"范围；用 seed 链接做轻量 PvP 代替）。
- 完整 i18n 多语言、Service Worker 离线（PWA manifest 可选做）。
- New Game+ 完整养成（先用 seed/scenario 重玩覆盖重玩需求）。

## 五、风险与回滚
- 所有数值改动集中 `balance.ts`，便于 `git checkout` 回滚。
- 每个 R 阶段结束跑 `npm run build && npm run test`，红则停修。
- 休闲前门为**叠加**，不删除原有深度路径，老存档/老流程不破坏。
- 不自动 git 提交；交付为干净通过构建的工作区 + 本文件 + 改动清单。

---

## 六、执行结果（2026-05-30 完成）

**状态：R1→R4 全部完成并通过验收。`build` ✅ exit 0 · `test` ✅ 23/23 · `lint` ✅ 0 error。**
Playwright 375px 移动端 + 生产构建（preview）跑通端到端全流程，**0 console error、0 白屏**。

> **codex 独立复审**（贯穿"和 codex 一起"）：确认 `getWinRoute` 早胜路线有 `weeklyProfit>0 && cumulativeProfit>=0` 守卫、不会让亏损局获胜；`GameResult/ShareCard` hooks 顺序无违规；`tsc --noEmit` 通过。提出 3 项，已处置：① 剧本现金在 open_store 后修正 → 经核为**债务陷阱剧本的预期设计**（百万奶茶负债开局），保留并加注释；② 规则版勇哥照扣游戏币 → 可接受（真实诊断的咨询费，已无报错）；③ **采纳**：`server.mjs` 反代下信任 loopback 可能烧作者 key → 已加固为"配了作者 key 时 loopback 需显式 `LLM_ALLOW_LOCAL_LLM_PROXY=true` opt-in"，默认拒绝。

### 已交付（按目标归类）

**🎮 好玩（R1）**
- 修复"赚了钱却判负"：`gameEngine.ts getWinRoute` 新增主胜利路线（累计利润≥总投资 + 连盈 6 周即胜，去掉曝光/口碑超额闸门）。智能压测胜率 **~50% → 94.4%、0 破产**，多数 11-22 周即回本，正好是走量要的"短局出结果"。
- 成就即时金色 toast（`App.tsx`）+ `persistUnlocked` 跨局持久化（原来解锁零反馈）。
- 开局水位 `launchProgress 8→20 / awarenessStock 12→26`，缩短前几周冷启动空窗。
- 会计概念前移：`cognitionData.ts` 把毛利率/变动成本/固定成本降到 Lv1 可见、Lv0 给模糊值（实测周报已显示"五六千/大几千"模糊口径）。

**🔁 重玩（R2+R3）**
- `quickStart()` 一键开局 + 6 剧本卡墙全部可玩（`applyScenarioToInitialState` 现完整套用品牌/选址/装修/选品/员工，实测百万奶茶大厦正确呈现 7 员工负债开局）。
- `GameState.scenarioId` 新增 → 剧本成就（修了 2 个 `test:()=>false` 占位）+ 战报显示剧本名 + 挑战链接带剧本。
- 孤儿 `AchievementsPanel` 挂上结局页（实测"成就 6/35"展示本局解锁含隐藏成就"破产体验卡"）。

**📤 分享（R3）**
- `ShareCard.tsx` 9:16 竖版战报海报（`html-to-image` 导出）：结局/剧本/利润/ROI/活几周/踩坑标签/勇哥金句/本局成就 + **挑战链接二维码**（`qrcode`）。实测预览渲染完美。
- 移动端 `navigator.share`(带图)、桌面下载 + 复制带话题文案（`#360度转一圈 #创业避坑 #勇哥`）。
- 挑战链接 `?scenario=&seed=`；URL 深链落地直接开局（实测 `?scenario=scen_baiwanshenglou` 自动进剧本）。
- `index.html` 补 OG/Twitter 分享卡 meta + favicon + `og-cover.png`（占位，建议替换为设计版封面）。

**🛡️ 上线安全（R4）**
- **LLM 零成本默认**：无 key 时走本地规则版勇哥（`ruleAdvisor.ts` 基于 healthAlerts+simulator，零网络、不报错、不白扣游戏币）；真 AI 仅在配了 key 或玩家 BYOK 时启用。**作者默认零 LLM 成本。**
- `server.mjs`：真实 IP 限速（不再信任可伪造的 XFF）+ 每日全局预算熔断 + 上游 30s 超时 + BYOK 转发；`.env.example` 写明"默认不配 key=规则版"。
- `ErrorBoundary`（`main.tsx`）防白屏 + 清档逃生按钮。
- 主存档 localStorage 持久化（`useGameState`）：刷新不丢进度（恢复 operating 局直接续玩）。
- 修复 React 19 lint error（`isAutoAdvancing` 改 state）。
- **拆包**：主 JS 1.45MB → **801KB**（gzip 405→218KB）+ vendor-core/radix 独立缓存。
  - ⚠️ 修复了拆包引入的生产崩溃：react/recharts 跨 chunk 循环导致 `Cannot access 'X' before initialization` 的 TDZ 错误（已合并同块解决，Playwright 验证消失）。

### 改动清单（21 改 + 4 新）
新文件：`ShareCard.tsx`、`ErrorBoundary.tsx`、`lib/llm/ruleAdvisor.ts`、`docs/LAUNCH_REVAMP_PLAN.md`、`public/`(favicon.svg + og-cover)。
改动：App / useGameState / gameEngine / cognitionData / scenarios / achievements / types / GameResult / GameHeader / OperatingPanel / SupplyDemandPanel / StreetViewScene / WelcomePage / CyberYongGe / llm/client / server.mjs / index.html / vite.config / package(.json/lock) / .env.example。

### 建议提交结构（未自动提交，留你 review）
```
R1 feat(fun): 胜利=回本 + 成就即时反馈 + 开局水位 + 会计概念前移
R2 feat(funnel): 一键开局/6剧本入口 + 欢迎页30秒看懂 + 移动端竖屏适配
R3 feat(share): 9:16战报海报+二维码 + 挑战链接 + 成就墙 + OG meta
R4 feat(ops): LLM规则版兜底+BYOK + ErrorBoundary + 主存档 + 拆包/lint修复
```

### 已知可改进项（非阻断，建议上线后迭代）
1. `og-cover.png` 是程序生成的占位封面，建议换成设计版（决定小红书外链点击率）。
2. 财务"面板"仍 Lv3 解锁（仅信息口径前移到 Lv1）；如想更早教学可降 `PANEL_UNLOCK_CONFIG.finance`。
3. 默认一键开局（均衡配置）被动不操作会小亏到 52 周，需玩家做决策才稳赢——符合预期，但可考虑给新手默认配置再加一点冗余利润。
4. 无"继续上局/重开"选择 UI：刷新会自动续上存档局（跳欢迎页）；如需"换剧本"得先结束当前局。
5. 事件触发偏密（每 1-2 周一次），体验张力足但部分玩家可能觉得打断频繁，可观察数据后微调冷却。
6. 真 LLM 托管路径默认每日预算 200 次，若要公网托管自己的 key 需按量调整并加验证码。
