# 实体模型与盔甲层：玩家头、CEM、TypeArmor

> 核对日期：2026-09（数值/生态）；玩家头案来自 MoonLight v14 实测（26.2 时代）。pack_format 数值查 minecraft-pack-core 的 pack-format-matrix.md。

## 1. 玩家头实体模型（v14 完整案）

- 目标：`player_head` 物品（CMD 10000–10005）显示自定义实体头，而非原版 Steve。
- 方案：`_iainternal` 实体模型（6 部件）：
  - `phead_0`（头）、`pbody_2`（躯干）、`parm_left_3`（左臂）、`parm_right_4`（右臂）、`pleg_left_1`（左腿）、`pleg_right_5`（右腿）
- 纹理：`textures/item/steve_skin.png`——从原版 jar（versions/mama/mama.jar）提取 Steve 皮肤。
- 物品模型：`player_head` 的 CMD 10000–10005 → _iainternal 实体模型；10006/默认 → 原版玩家头。
- **UV 教训**：实体模型纹理 UV 用像素坐标（×4）会报 `Cannot compute translucency out of bounds: [64,0,96,32] in 64x64`，游戏内马赛克——**UV 全部改回 0-16 网格**（部件 UV 语义：部件在 64x64 皮肤纹理上的 0-16 比例区域）。
- 验证指令：`/give @p player_head[custom_model_data=10000]`（10006 = 普通玩家头）。

## 2. OptiFine CEM（Custom Entity Models）

- 目录：`assets/minecraft/optifine/cem/` 或旧式 `custom/`。
- 文件：`.properties`（模型/动画绑定）+ 模型文件（旧 .jpm / 新 json）。
- CEM 是 OptiFine 专属（citresewn 对 CEM 支持有限）——26.x 时代优先确认客户端前端是否支持（26.3 上 OptiFine/citresewn 是否可用**未核对**，与 CIT 前端同样存在缺口风险）。

## 3. 盔甲层（TypeArmor）

- CIT `type=armor` 属性文件：`texture.1`/`texture.2` 对应穿戴层纹理：
  - `armored_layer_1.png`（内层：腿+靴）
  - `armored_layer_2.png`（外层：胸+头）
- citresewn fork 的 TypeArmor 装备层映射：按装备槽位把 1/2 层纹理套到玩家模型。
- **纹理残缺案例**（v14 ArmorHB）：`armored_layer_1.png` 只有 202/2048 不透明像素（头盔/肩/手臂全空）→ 穿戴透明；正常套装约 632 像素。检测启发式：64x64+ 且文件 <1KB → WARN（`mc_pack_validate` 的 png-small 规则）。
- 四色胸甲（Red/Green/Purple/Blue Knight Chestplate）等 32 个文件同步修改时，注意条件与纹理都要一致（双通道同步见 CIT 技能）。

## 4. 常见坑

- 部件命名/数量与绑定模型不一致 → 部分身体不渲染。
- 纹理引用路径错（v14 capev.json、book/1、netherite_axe/14 的 particle 路径修正）。
- Blockbench 导出的实体模型 groups 损坏 → JSON 结构错（validate 检出）。
