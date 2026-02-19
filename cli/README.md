# 360simulator CLI Agent 接口

> JSON-lines over stdin/stdout，供 LLM Agent 游玩 360 模拟器

## 快速开始

```bash
cd cli
npm install
npm run dev    # 使用 tsx 直接运行
# 或
npm run build && npm start  # 编译后运行
```

## 协议说明

每行一个 JSON 对象，通过 stdin 发送请求，stdout 接收响应。

### 请求格式

```typescript
// 1. 执行游戏操作
{ "id": "唯一ID", "type": "action", "action": GameAction }

// 2. 查询游戏数据
{ "id": "唯一ID", "type": "query", "query": QueryType }

// 3. 元操作
{ "id": "唯一ID", "type": "meta", "meta": "help" | "reset" }
```

### 响应格式

```typescript
{
  "id": "对应请求ID",
  "success": true | false,
  "error": "错误信息（仅失败时）",
  "data": { ... }  // 响应数据
}
```

## 查询类型 (QueryType)

| 查询 | 说明 |
|------|------|
| `state` | 当前游戏状态摘要 |
| `available_actions` | 当前可用操作列表（含参数选项） |
| `game_info` | 开店条件 + 游戏结果 |
| `stats` | 当前财务统计 |
| `supply_demand` | 供需模型计算结果 |
| `brands` | 所有品牌数据 |
| `locations` | 所有区位数据 |
| `products` | 所有产品数据 |
| `decorations` | 所有装修风格 |
| `staff_types` | 所有员工类型 |
| `marketing_activities` | 所有营销活动 |
| `delivery_platforms` | 所有外卖平台 |

## 操作类型 (GameAction)

### 筹备阶段

| Action | 参数 | 说明 |
|--------|------|------|
| `select_brand` | `brandId: string` | 选择品牌 |
| `select_location` | `locationId: string` | 选择区位 |
| `select_address` | `addressId: string` | 选择具体地址 |
| `set_store_area` | `area: number` | 设置店铺面积 |
| `select_decoration` | `decorationId: string` | 选择装修风格 |
| `toggle_product` | `productId: string` | 添加/移除产品（最多5个） |
| `add_staff` | `staffTypeId: string` | 招聘员工 |
| `fire_staff` | `staffId: string` | 解雇员工 |
| `open_store` | 无 | 开店（进入经营阶段） |

### 经营阶段

| Action | 参数 | 说明 |
|--------|------|------|
| `next_week` | 无 | 推进到下一周 |
| `restart` | 无 | 重新开始游戏 |
| `set_product_price` | `productId, price` | 调整产品价格 |
| `set_product_inventory` | `productId, quantity` | 设置产品库存 |
| `set_restock_strategy` | `productId, strategy` | 设置补货策略 |
| `assign_staff_task` | `staffId, task` | 分配员工任务 |
| `set_staff_work_hours` | `staffId, hours` | 设置员工工时 |
| `recruit_staff` | `staffTypeId, channelId` | 通过渠道招聘 |
| `fire_staff` | `staffId` | 解雇员工 |
| `join_platform` | `platformId` | 加入外卖平台 |
| `leave_platform` | `platformId` | 退出外卖平台 |
| `toggle_promotion` | `platformId, tierId` | 切换推广档位 |
| `start_marketing` | `activityId` | 开始营销活动 |
| `stop_marketing` | `activityId` | 停止营销活动 |
| `consult_yong_ge` | 无 | 咨询赛博勇哥 |
