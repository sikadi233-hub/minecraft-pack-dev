# CIT 条件通道时代矩阵

> 核对日期：2026-09。与 pack-format-matrix.md（minecraft-pack-core）同源。
> **pack_format 数值不在此重复**——需要数值查 minecraft-pack-core 的 pack-format-matrix.md。

## 1. 通道可用性

| 时代 | nbt.display.Name | nbt.display.Lore.* | components.minecraft\:custom_name / item_name | damage= |
|---|---|---|---|---|
| 1.7.10–1.20.4 | ✅ | ✅ | ❌（无组件系统） | ✅（普通耐久物品） |
| 1.20.5–1.21.x | ❌（组件时代） | ❌ | ✅ | ⚠️ 依赖物品是否 unbreakable |
| 26.2（citresewn fork） | ❌ | ❌ **（lore 变 compound tags，路径匹配永不成功）** | ✅（首选） | ❌（MMOItems 类 unbreakable 恒失败） |
| 26.3 | ❌（组件时代） | ❌ | ✅（语义按 26.2 外推，**UNVERIFIED**） | ❌（同上，**UNVERIFIED**） |

- **26.3 有额外前提**：cit-resewn-continuation / cit-resewn-fork 截至 2026-09 **都没有 26.3 版本**
  （来源：Modrinth `api.modrinth.com/v2/search?query=cit resewn` 搜索结果）。也就是说 26.3 上
  **根本没有 CIT 运行时**：上表 26.3 行写的是"假如 fork 更新到 26.3 时预期的语义"，不是实测结论。
  要证实需要 26.3 版 citresewn fork 的字节码反编译 + 游戏内实测。
  `mc_pack_validate -targetMc 26.3` 在包内含 `.properties` 时会给出非阻塞 `cit-runtime-missing` WARN。

## 2. 为什么 lore 在 26.2 死了（反编译结论）

- 26.2 组件系统下 lore 是 compound tags（组件结构），旧式 `nbt.display.Lore.*=` 路径匹配**永不成功**——不是"偶尔失败"，是结构性失效。
- 结论：**26.x 时代的属性文件一律用 components 通道**；服务端物品按 item_name 匹配优先（custom_name 会被附魔/其他系统改写，item_name 更稳）。
- 该结论的**实测范围只到 26.2**；26.3 无 fork 可测（见 §1）。

## 3. 通道选择建议（按场景）

| 场景 | 建议通道 |
|---|---|
| 匹配服务端写死的显示名（MMOItems 等） | `components.minecraft\:custom_name=ipattern:*…*`（首选）或 `item_name` |
| 双通道保险（拼写不确定的服务端名） | 同时生成 `_in` 变体（item_name 条件），两通道覆盖 |
| ≤1.20.4 老包 | `nbt.display.Name`（同时被 OptiFine 匹配） |
| 同一包跨 1.7.10–26.3 | 按时代分版：老时代 nbt.display、新时代 components（mc_pack_build 分版支持）；26.3 分版目前只对资源包内容有意义，CIT 部分等 fork 更新 |

## 4. 双通道实践（v10 沉淀）

- 服务端可能用 `custom_name` 也可能用 `item_name` 下发名称 → 同一套条件生成两份属性文件（`_in` 后缀 = item_name 变体），v14 批量生成过 68+4 个 `_in` 文件。
- `mc_pack_validate` 的 names 字典 + name-dict-hint 会提示两通道与真实物品名的差异（Biamond 类问题）。

## 5. 工具联动

- `mc_pack_validate -targetMc <版本>`：`nbt.display.*` 在组件时代 → ERROR（lore-dead）；无目标时代 → WARN（lore-era）。
- `mc_pack_validate -targetMc 26.3`：额外给 `cit-runtime-missing` WARN（26.3 无 CIT 前端）。
- 时代数值与断代见 minecraft-pack-core 的 pack-format-matrix.md。
