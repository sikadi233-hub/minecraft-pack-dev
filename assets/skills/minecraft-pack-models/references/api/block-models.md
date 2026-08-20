# 方块模型：blockstates 与 1.21.4+ blocks/*.json

> 核对日期：2026-08。

## 1. 时代断代

| 时代 | 系统 |
|---|---|
| ≤1.21.3 | `blockstates/<方块>.json`（variants / multipart）→ `models/block/*.json` |
| 1.21.4+ | `blocks/<方块>.json`（when/apply）+ 旧 blockstates 仍兼容 |

## 2. blockstates（≤1.21.3）

```json
{
  "variants": {
    "": { "model": "minecraft:block/stone" },
    "facing=north": { "model": "minecraft:block/furnace", "y": 90 }
  }
}
```

- variants 键 = 属性组合（`""` 匹配无属性方块）；值可以是单对象或数组（随机模型）。
- multipart：`[{ "when": {"north": "true"}, "apply": {"model": "..."} }]`（栅栏/红石线类）。
- 条目可带 `x`/`y` 旋转与 `uvlock`。

## 3. blocks/*.json（1.21.4+）

```json
[
  { "when": { "facing": "north" }, "apply": { "model": "minecraft:block/furnace" } },
  { "when": {}, "apply": { "model": "minecraft:block/stone" } }
]
```

- 根可以是单对象或数组；`apply.model` 引用模型 ID。
- 1.21.4+ 客户端加载顺序：blocks/*.json 优先，blockstates/*.json 兜底。

## 4. 常见坑

- variants 值写成字符串而不是对象/数组（`"model"` 放错层）。
- 引用的模型文件不存在（validate：非 minecraft ns = ERROR）。
- 方块物品图标：1.21.4+ 的物品显示走 items/*.json，方块模型只影响世界内渲染——"方块变了物品图标没变"是预期行为。
