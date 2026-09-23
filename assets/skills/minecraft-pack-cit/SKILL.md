# CIT 物品显示与 citresewn（minecraft-pack-cit）

> 前置：结构/打包问题同时加载 minecraft-pack-core。
> **铁律：CIT 条件语法查 `references/api/cit-properties.md`；时代通道查 `references/api/cit-era-matrix.md`；26.x fork 专属结论（含字节码反编译来源）查 `references/api/citresewn-fork-26.md`；实战案例查 `references/api/moonlight-casebook.md`。禁止凭记忆写条件键名。**
> 核对日期：2026-09。26.2 + citresewn fork 结论来自反编译字节码 + 游戏内实测（无现成文档，见 casebook 方法论）。
> ⚠ **26.3 没有 CIT 前端**：cit-resewn-continuation / cit-resewn-fork 截至 2026-09 均无 26.3 版本 → 26.3 上 CIT 没有运行时；其通道语义按 26.2 外推（**UNVERIFIED**），详见 cit-era-matrix.md。pack_format 数值查 minecraft-pack-core 的 pack-format-matrix.md（勿凭记忆写）。

## 1. 定位与适用

- 本技能覆盖 **CIT（Custom Item Textures）**：OptiFine 系与 CIT Resewn（continuation fork）的物品/盔甲自定义显示，MC 1.7.10 ~ 26.x。CIT 用 `.properties` 文件按条件把特定物品替换为自定义模型/纹理。
- 本技能是 MoonLight 材质包修复记录（v2–v14）的完整知识沉淀——**每个结论都来自真实排障**。

## 2. 三条核心结论（先记住）

1. **条件通道有时代断代**：≤1.20.4 用 `nbt.display.Name/Lore` 可匹配；1.20.5+ 组件系统后 `nbt.display.*` 失效；**26.2 起 citresewn fork 上 lore 匹配已死**（lore 变 compound tags，路径匹配永不成功）——必须用 `components.minecraft\:custom_name=ipattern:*xxx*` 或 `item_name`。
2. **MMOItems 等带 unbreakable 组件的物品上 `damage=` 条件永不成立**（`ItemStack.isDamageableItem()` 恒 false → 百分比 0/0）——v14 根因，删条件或服务端剥离 unbreakable。
3. **机械坑全部可自动查**：文件夹名含空格（citresewn 直接忽略）、`items=` 逗号分隔（报 "null is not in the item registry"）、CRLF 换行、大小写重名、双通道（两处目录）不同步——`mc_pack_validate` 一条命令全检。

## 3. 匹配写法要点

- `ipattern:` 前缀 = 正则式通配（`*` 任意串）；`pattern:` = 通配符风格。**连续子串要求是经典坑**：`*Red Knight*` 匹配不了 "Red Villager Knight Chestplate"（中间隔词）→ 用 `*Red*Knight*Chestplate*` 允许隔词（v8 案）。
- 拼写兼容：`*Blue*iamond*` 同时匹配 Diamond/Biamond 两种拼写（v13 案）。
- `items=` 空格分隔（禁逗号）；`type=` 决定作用域（item/armor/enchantment/entity/elytra）。

## 4. 与工具的关系

- `mc_pack_validate -targetMc <版本>`：时代规则自动生效（组件时代出现 `nbt.display.*` 条件 → ERROR；无目标时代 → WARN）。
- `mc_pack_validate -targetMc 26.3`：额外给出 `cit-runtime-missing` **WARN**（非阻塞，不是包的错误）——26.3 尚无 CIT 前端可装。
- `pack.config.json` 的 `names` 数组填服务端已知物品名 → validate 输出拼写差异提示（Biamond 级问题自动化）。
- `pack.config.json` 的 `syncGroups` 声明双通道目录对 → validate 对比同名文件内容。

## 5. 参考文件索引

- `references/api/cit-properties.md` — .properties 全表（type/items/texture.X/nbt/components/ipattern/CMD）
- `references/api/cit-era-matrix.md` — 条件通道时代矩阵（1.7.10 → 26.3）
- `references/api/citresewn-fork-26.md` — 26.x fork 专属规则（反编译 + 实测来源，实测范围止于 26.2）
- `references/api/moonlight-casebook.md` — v2–v14 实战案例库 + 方法论（/data 实测、javap、日志）
