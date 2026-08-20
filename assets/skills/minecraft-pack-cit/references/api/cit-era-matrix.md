# CIT 条件通道时代矩阵

> 核对日期：2026-08。与 pack-format-matrix.md（minecraft-pack-core）同源。

## 1. 通道可用性

| 时代 | nbt.display.Name | nbt.display.Lore.* | components.minecraft\:custom_name / item_name | damage= |
|---|---|---|---|---|
| 1.7.10–1.20.4 | ✅ | ✅ | ❌（无组件系统） | ✅（普通耐久物品） |
| 1.20.5–1.21.x | ❌（组件时代） | ❌ | ✅ | ⚠️ 依赖物品是否 unbreakable |
| 26.2（citresewn fork） | ❌ | ❌ **（lore 变 compound tags，路径匹配永不成功）** | ✅（首选） | ❌（MMOItems 类 unbreakable 恒失败） |

## 2. 为什么 lore 在 26.2 死了（反编译结论）

- 26.2 组件系统下 lore 是 compound tags（组件结构），旧式 `nbt.display.Lore.*=` 路径匹配**永不成功**——不是"偶尔失败"，是结构性失效。
- 结论：**26.2 时代的属性文件一律用 components 通道**；服务端物品按 item_name 匹配优先（custom_name 会被附魔/其他系统改写，item_name 更稳）。

## 3. 通道选择建议（按场景）

| 场景 | 建议通道 |
|---|---|
| 匹配服务端写死的显示名（MMOItems 等） | `components.minecraft\:custom_name=ipattern:*…*`（首选）或 `item_name` |
| 双通道保险（拼写不确定的服务端名） | 同时生成 `_in` 变体（item_name 条件），两通道覆盖 |
| ≤1.20.4 老包 | `nbt.display.Name`（同时被 OptiFine 匹配） |
| 同一包跨 1.7.10–26.2 | 按时代分版：老时代 nbt.display、新时代 components（mc_pack_build 分版支持） |

## 4. 双通道实践（v10 沉淀）

- 服务端可能用 `custom_name` 也可能用 `item_name` 下发名称 → 同一套条件生成两份属性文件（`_in` 后缀 = item_name 变体），v14 批量生成过 68+4 个 `_in` 文件。
- `mc_pack_validate` 的 names 字典 + name-dict-hint 会提示两通道与真实物品名的差异（Biamond 类问题）。

## 5. 工具联动

- `mc_pack_validate -targetMc <版本>`：`nbt.display.*` 在组件时代 → ERROR（lore-dead）；无目标时代 → WARN（lore-era）。
- 时代数值与断代见 minecraft-pack-core 的 pack-format-matrix.md。
