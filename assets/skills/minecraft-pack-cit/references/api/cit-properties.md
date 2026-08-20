# CIT .properties 语法全表

> 核对日期：2026-08。语法来源：OptiFine CIT 格式 + citresewn（continuation fork）兼容集；
> 26.2 fork 差异见 citresewn-fork-26.md。

## 1. 文件位置与命名

- `cit/<任意路径>/<任意名>.properties`（包根 `cit/`；fork 兼容 `optifine/cit/` 旧路径）。
- **文件夹名/文件名不要含空格**（citresewn 直接忽略含空格文件夹——v14 "knight items" 案）。
- 文本规范：LF 换行（CRLF 是历史坑）、UTF-8。

## 2. 匹配条件键（谁被替换）

| 键 | 语义 | 示例 |
|---|---|---|
| `items=` | 目标物品（**空格分隔**，禁逗号） | `items=paper` / `items=diamond_sword netherite_sword` |
| `nbt.display.Name=` | 显示名匹配（≤1.20.4 可用；26.2 死） | `nbt.display.Name=ipattern:*Moon*` |
| `nbt.display.Lore.*=` | 描述行匹配（26.2 死） | `nbt.display.Lore.0=ipattern:*xxx*` |
| `components.minecraft\:custom_name=` | **1.20.5+ 组件通道（首选）** | `components.minecraft\:custom_name=ipattern:*Moon*` |
| `components.minecraft\:item_name=` | 物品名组件通道 | `components.minecraft\:item_name=ipattern:*Moon*` |
| `damage=` | 耐久百分比条件（unbreakable 上永不成立） | `damage=0-25` |
| `enchantments=` | 附魔条件 | `enchantments=sharpness` |
| `customModelData=` | CMD 条件 | `customModelData=10000` |
| `nbt.*=` / 其他 | 通用 NBT / 组件路径条件 | `nbt.components.minecraft\:custom_data.mmoitems=ipattern:*KNIGHT*` |

- `ipattern:` 前缀 = **正则式通配**（`*` = 任意串，`?` = 单字符）；`pattern:` = 通配符风格（`*`/`?` 同义，语法略不同）。
- 条件值里含 `\:`（组件键的冒号转义）——26.2 fork 实测如此，注意反斜杠。

## 3. 行为键（替换成什么）

| 键 | 语义 | 示例 |
|---|---|---|
| `type=` | 作用域：`item` / `armor` / `enchantment` / `entity` / `elytra` | `type=item` |
| `texture.N=` | 纹理替换（N 为层号；type=armor 时 1/2 对应穿戴层） | `texture.0=item/example` |
| `model=` | 模型替换（**包根 models/** 下的路径） | `model=item/example` |
| `particle=` | 粒子纹理（粒子类替换） | `particle=item/example` |
| `matchItems=` | 盔甲类：按物品分别指定纹理 | `matchItems=leather_helmet.0=…` |
| `nbt.display.Name=`（在行为段的意义） | 重命名显示名 | — |

- 纹理路径解析：相对 `assets/<ns>/textures/`（无扩展名；`item/example` → `textures/item/example.png`）。

## 4. 一个完整示例（v14 现代通道）

```properties
# 骑士套胸甲（26.2 时代写法）
type=item
items=diamond_chestplate
texture.0=knight_items/armor/red_chestplate
components.minecraft\:custom_name=ipattern:*Red*Knight*Chestplate*
```

## 5. 高频坑（validate 全部自动查）

| 坑 | 结果 | 修复 |
|---|---|---|
| `items=` 逗号分隔 | citresewn 报 "null is not in the item registry" | 空格分隔 |
| 文件夹名含空格 | citresewn 忽略整个目录 | 改名（knight_items） |
| CRLF 换行 | fork 兼容但规范不符 | 转 LF |
| `nbt.display.*` 在 1.20.5+ | 永不匹配 | components 通道 |
| `damage=` 在 unbreakable 物品 | 永不成立 | 删条件 / 服务端剥离 unbreakable |
| `ipattern:*Red Knight*` 匹配 "Red Villager Knight Chestplate" | 连续子串失败 | `*Red*Knight*Chestplate*`（隔词） |
