# MoonLight 实战案例库（v2–v14）

> 核对日期：2026-08。这是 MoonLight 材质包修复全记录的知识化——**每个结论都来自真实排障**，
> 是 minecraft-pack-* 各技能的实证来源。方法论四步：日志判读 → 时代核对 → 文件级检查 → 数据侧实测。

## 1. 物品显示（最早修复，v2–v7）

- 症状：火药、纸、燧石、木炭、橡木门、盾牌显示异常。
- 修复：重写 `assets/minecraft/items/*.json` 物品模型定义：
  - charcoal：CMD 17 → charcoal/17，新增 18 → charcoal/18
  - shield：`minecraft:condition` + `using_item` + `range_dispatch` 组合
  - player_head：CMD 10000–10005 → _iainternal 实体模型；10006/默认 → 原版玩家头

## 2. 玩家头模型缺失 + 穿戴马赛克

- 模型缺失（Missing block model）：创建 `_iainternal/models/entity/player/` 6 部件
  （phead_0 / parm_left_3 / pbody_2 / pleg_left_1 / pleg_right_5 / parm_right_4），
  纹理 `textures/item/steve_skin.png`（从原版 jar 提取 Steve 皮肤）。
- 马赛克根因：模型 UV 用像素坐标（×4）越出 0-16 网格 →
  `Cannot compute translucency out of bounds: [64,0,96,32] in 64x64` → **UV 全部改回 0-16**。

## 3. CraftEngine 验证警告（格式规范类）

- 6 个 mccosmetics 模型删"自引用 parent"；capev.json / book/1 / netherite_axe/14 的 particle 路径修正；
- command_block.json 删无效 "all" 纹理；backpack2_thirdperson.json 纹理路径修正；
- diamond_sword/37.json 修复损坏的 Blockbench groups；删除 6 个大写命名重复文件。

## 4. 锁链骑士套不生效（核心战役，v14 最贵一课）

1. 文件夹名含空格（"knight items"）→ citresewn 忽略 → 改名 knight_items（illager king → illager_king）。
2. `items=` 逗号分隔 → 报 null is not in the item registry → 69 个文件改空格分隔。
3. 旧条件 `nbt.display.Lore.*=` 在 26.2 失效（lore 变 compound tags）→ 改 `components.minecraft\:custom_name=ipattern:*xxx*`。
4. **真正根因**：MMOItems 物品带 `minecraft:unbreakable` → `isDamageableItem()` 恒 false →
   ConditionDamage 百分比 = 0/0，`damage=xx%` 永不成立 → **删除全部 damage= 条件（40 个文件）**。
5. 双通道：knight_items/armor/* 与 armors_migrated/knight_items/armor/* 两处同步改。

## 5. Red Villager Knight Chestplate 没材质

- 原因：物品名 "Red Villager Knight Chestplate"，条件 `ipattern:*Red Knight*` 要求**连续子串**，匹配失败。
- 修复：`*Red*Knight*Chestplate*`（允许隔词）；四色胸甲 32 个文件同步修改。

## 6. 五组套装没材质（Pink Diamond / ArmorHB / Illager King / Elite Knight / Blue Diamond）

- 根因：cit 根目录属性文件仍是旧格式 `nbt.display.Lore.*=`（26.2 失效）；
  armors_migrated 迁移版条件写错（匹配 Lore 文本而非物品名：2Pink Diamond2、Royal、Armored 等）；
  Elite Knight 缺图标文件（品质套只有穿戴层）。
- 修复：条件全部改为匹配实际物品名（`*Pink Diamond*` / `*ArmorHB*` / `*Illager King*` / `*Blue Diamond*`）；
  Elite Knight 新建 pknight_elite_chestplate 图标（匹配 `*Elite*Knight`）；品质穿戴层条件 `*Elite*Knight`（兼容 Elite Knight 与 Elite Force Knight）。

## 7. Blue Diamond 与 ArmorHB 深入排查

1. 双通道：只有 custom_name 条件 → 批量生成 `_in.properties`（item_name 条件）68+4 个。
2. [ETF] 日志报错是 Entity Texture Features 的（**无关红鲱鱼**）；但发现 108 个属性文件 CRLF → 全转 LF。
3. `/citresewn analyze` 确认 356 armor + 168 item 全部加载。
4. ArmorHB 穿戴透明 → armored_layer_1.png 残缺（202/2048 不透明像素；正常套装 ≈632）→ 重建完整黑曜石纹理 → 用户要求换回原始透明版 → v14 恢复 530 字节原始文件。
5. Blue Diamond 完全没匹配 → `/data get entity @p SelectedItem` 查到**服务端拼写错误**：
   `"minecraft:custom_name": {text: "Blue Biamond Boots"}`（MMOITEMS_NAME: "&1Blue Biamond Boots"，Diamond 拼成 Biamond）
   → 客户端条件 `*Blue Diamond*` 永远匹配不上 → 条件改 `*Blue*iamond*`（两种拼写都能匹配，48 个文件）。

## 8. 方法论沉淀（给排障者的固定流程）

1. **日志判读**：latest.log 的 [citresewn] 加载错误、Missing model/texture；**[ETF] 报错一律忽略**。
2. **时代核对**：26.2 + citresewn fork 下 lore 匹配已死、unbreakable 杀 damage、文件夹空格被忽略、items 逗号报错。
3. **文件级检查**：CRLF、大小写重名、双通道同步、UV 越界、纹理残缺（字节阈值 + 像素统计）。
4. **数据侧实测**：`/data get entity @p SelectedItem` = **最终裁判**（服务端拼写/组件真相）。

## 9. 给服主的建议（服务端侧修复清单）

- MMOItems `BLUE_DIAMOND4` 的 `MMOITEMS_NAME` 改 `"&1Blue Diamond Boots"` 后 `reload mmoitems`。
- 服务端 custom_name/item_name 是字面文本，资源包翻译不了 → 中文只能服务端改配置。
- 客户端必须装 citresewn fork（26.2）——资源包/插件无法替代。

## 10. 版本记录（供回归对照）

v2–v7 早期修复（物品模型、骑士套、删 damage、删默认外观）→ v8 Red Villager 匹配 → v9 五组套装条件 → v10 item_name 双通道（_in 文件）→ v11 全量 CRLF→LF → v12 重建 ArmorHB 纹理 → v13 Blue Diamond 拼写兼容（*Blue*iamond*）→ v14 ArmorHB 换回原始透明版（终版）。

## 11. 第一手来源清单

1. citresewn fork jar（javap 反编译：ConditionComponents.getString() 匹配、resolveAsset 纹理规则、CRLF 兼容、analyze 命令、TypeArmor 层映射）
2. 原版 jar versions/mama/mama.jar（en_us.json 确认无 zh_cn、Steve 皮肤、原版物品模型）
3. 游戏日志 versions/mama/logs/latest.log（[citresewn] 错误、[ETF] 噪音、Missing model/texture）
4. 服务器 `/data get entity @p SelectedItem`（物品真实组件 = 最终裁判）
