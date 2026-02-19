# 智能自动化执行系统

## 目标
- 每周自动决策（定价、岗位、补货、营销、外卖）
- 自动识别引擎异常（数值越界、汇总不一致、异常增长）
- 自动识别平衡性风险（胜率过高/过低、20周双高、低履约仍增曝光）

## 运行方式
在仓库根目录执行：

```bash
npm --prefix app run auto:smart:quick
npm --prefix app run auto:smart:full
```

也可自定义参数：

```bash
npm --prefix app run auto:smart -- --mode full --weeks 52 --seeds 10 --seed 20260213 --out output/automation-smart
```

## 输出
- `report.json`：完整结构化结果（每周决策、异常、全局统计）
- `report.md`：高层摘要（胜率、破产率、告警、场景结果）

默认输出目录：`output/automation-smart`

## 入口文件
- `src/automation/run.ts`
- `src/automation/intelligentEngine.ts`
- `src/automation/scenarios.ts`
- `src/automation/types.ts`
