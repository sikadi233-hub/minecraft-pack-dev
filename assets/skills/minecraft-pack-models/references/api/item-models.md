# 物品模型：legacy 与 1.21.4+ items/*.json

> 核对日期：2026-08。

## 1. 时代断代

| 时代 | 系统 | 说明 |
|---|---|---|
| 1.7.10 | 物品无独立模型文件 | 物品用方块模型渲染或 OptiFine CIT |
| 1.8–1.21.3 | models/item/*.json | 父模型链 + elements + 原版 blockstates 引用；OptiFine CIT 覆盖显示 |
| 1.21.4+ | **items/*.json** | 新物品模型定义系统；引用 models/*.json 作为具体模型 |

## 2. 1.21.4+ items/*.json 结构

```json
{
  "model": {
    "type": "model",
    "model": "minecraft:item/example"
  }
}
```

`model.type` 常用值：

| type | 结构要点 | 用途 |
|---|---|---|
| `model` | `"model": "<模型ID>"` | 静态模型（最常见） |
| `range_dispatch` | `property` + `entries: [{threshold, model}]` | 按数值属性分档（含 custom_model_data） |
| `using_item` | `base`/`hand` 子模型 | 使用物品时切换（盾牌举盾等） |
| `special` | `model` + 可选 transforms | 特殊槽位渲染 |

- 模型 ID `minecraft:item/xxx` → 文件 `assets/minecraft/models/item/xxx.json`。
- `condition` 风格（早期快照写法）已弃用，以 range_dispatch 等 type 为准。
- **v14 案例**：shield 改用 `minecraft:condition` + `using_item` + `range_dispatch` 组合实现"举盾换模型"；charcoal 用 CMD 17/18 双分档（items/charcoal.json → charcoal/17 与 charcoal/18 两个子模型）。

## 3. CMD（custom_model_data）通道

- ≤1.21.3：`customModelData` NBT/组件 → OptiFine CIT 或原版 overrides。
- 1.21.4+：custom_model_data 组件 + items/*.json range_dispatch。
- 玩家头案例：`player_head[custom_model_data=10000..10005]` → _iainternal 实体模型；10006/默认 → 原版玩家头（v14）。

## 4. 引用链检查（mc_pack_validate）

- items/*.json 引用的模型 ID → `assets/<ns>/models/<id>.json` 存在性（非 minecraft ns 缺失 = ERROR）。
- 模型内 `parent` 引用 → 存在性 + 循环检测。
- 纹理变量 → `assets/<ns>/textures/<path>.png` 存在性。
