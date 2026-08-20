# 资源包模型（minecraft-pack-models）

> 前置：结构/打包问题同时加载 minecraft-pack-core；pack_format 数值查 minecraft-pack-core 的 pack-format-matrix.md。
> **铁律：模型 JSON 结构与 1.21.4+ 条件字段签名查 `references/api/item-models.md` 等参考文件，禁止凭记忆写结构。**
> 核对日期：2026-08。

## 1. 定位与适用

- 本技能覆盖资源包内**所有模型类内容**，MC 1.7.10 ~ 26.x：物品模型（旧版 models/item/*.json + OptiFine CIT → 1.21.4+ items/*.json）、方块模型（blockstates variants/multipart → 1.21.4+ blocks/*.json）、实体模型（玩家头实体部件、OptiFine CEM）、盔甲层（TypeArmor / armored_layer_1/2.png）、UV 规则与 Blockbench 导出坑。
- 配套工具：`mc_pack_validate` 自动执行本文档的机械规则（UV 越界、parent 循环、引用断链、JSON 结构）。

## 2. 时代断代（先判时代）

| 时代 | 物品模型 | 方块模型 |
|---|---|---|
| 1.7.10–1.21.3 | models/item/*.json（1.8+）+ blockstates（物品以方块形式渲染）+ OptiFine CIT | blockstates/*.json variants/multipart → models/block/*.json |
| 1.21.4+ | **items/*.json**（condition / using_item / range_dispatch 等 model 类型）| **blocks/*.json**（when/apply）+ 旧 blockstates 仍兼容 |

- 1.21.4 的 items/*.json 引用模型 ID：`"model": {"type": "model", "model": "minecraft:item/xxx"}` → 实际文件 `assets/minecraft/models/item/xxx.json`。
- OptiFine CIT 的 `model=` 属性引用**包根 models/**（不是 assets），两套路径并存（validate 两者都查）。

## 3. UV 0-16 网格（最高频翻车点）

- 模型面 `uv: [x1,y1,x2,y2]` **必须落在 0-16 网格**内（对应贴图 0-16 像素区域）。
- 用**像素坐标（×4）**是经典错误：UV [64,0,96,32] 会报 `Cannot compute translucency out of bounds: [64,0,96,32] in 64x64`，游戏内表现为部件马赛克/透明错乱（v14 玩家头案）。
- Blockbench 的 UV 模式要选 **Box UV / Per-face UV 的 0-16 语义**，导出后核对数值。

## 4. 引用链与 parent

- 模型 `parent` 构成继承链：`models/item/foo.json` 的 parent 指向另一个模型 ID（可跨命名空间）；**自引用/循环引用**导致加载失败（validate 会查环）。
- 纹理引用：`textures: {"all": "block/stone"}` → 实际文件 `assets/<ns>/textures/block/stone.png`；`"#变量"` 是模型内变量引用，不是文件。
- 缺失引用可能是"指向原版资源"（合法，包叠包场景）——validate 对 minecraft 命名空间缺失只给 WARN，非 minecraft 命名空间缺失给 ERROR。

## 5. Blockbench / 工具链坑

- Blockbench 导出损坏的 groups/elements 结构 → JSON 解析失败或 UV 越界（v14 diamond_sword/37.json 案）。
- 模型 JSON 必须严格合法（无注释、无尾逗号、键值类型正确）。
- `display`（第三人称/手持变换）的 rotation/translation/scale 必须是 3 个数字。

## 6. 参考文件索引

- `references/api/item-models.md` — 物品模型全时代：legacy 模型 + 1.21.4+ items/*.json 条件系统
- `references/api/block-models.md` — 方块模型：blockstates → blocks/*.json
- `references/api/entity-models.md` — 实体模型：玩家头部件、OptiFine CEM、盔甲层 TypeArmor
- `references/api/uv-and-json.md` — UV 网格规则、parent 链、JSON 严格性（含报错语义）
