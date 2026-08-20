# 资源包语言与本地化（minecraft-pack-lang）

> 前置：结构/打包问题同时加载 minecraft-pack-core。
> **铁律：语言文件格式与键约定查 `references/api/lang-formats.md`；服务端字面名边界见 `references/api/localization-guide.md`——这两条是高频翻车区。**
> 核对日期：2026-08。

## 1. 定位与适用

- 本技能覆盖资源包内**语言与本地化**内容，MC 1.7.10 ~ 26.x：语言文件格式断代（.lang → .json）、键命名与完整性、中文（zh_cn）附属包做法、位图字体补字，以及**服务端字面名的翻译边界**（资源包做不到的事）。

## 2. 格式断代（第一判断）

| 时代 | 文件 | 示例 |
|---|---|---|
| ≤1.12.2 | `.lang`（Java properties 风格） | `assets/minecraft/lang/zh_CN.lang`，键 `item.diamond.name=钻石` |
| 1.13+ | `.json`（UTF-8 无 BOM） | `assets/minecraft/lang/zh_cn.json`，键 `item.diamond` |

- 键格式差异：老式物品/方块键带 `.name` 后缀（`item.diamond.name`），新式不带（`item.diamond`）；`mc_pack_build` 的 lang 转换自动处理（zh_cn.json → zh_CN.lang 加 .name）。
- **26.2 原版只有 en_us.json，没有 zh_cn**——中文显示需要语言包补键（v14 中文附属包，79 键起步）。

## 3. 键完整性

- 语言文件应覆盖 en_us.json 的全部键（缺失键回退英文显示）；`mc_pack_validate` 对照 en_us 列出缺失键。
- JSON 语言文件必须无 BOM、严格合法、无重复键（重复键在文本层检测——JSON.parse 会静默折叠）。

## 4. 中文附属包做法（v14 沉淀）

1. 从 en_us.json 出发，逐键翻译；**不要翻译键名**，只翻译值。
2. 覆盖策略：按物品/方块/实体/UI 分组；服务端物品（MMOItems 等）的键不在原版语言文件里——它们走服务端字面名，见下。
3. 生僻字/特殊符号：语言文件能映射文本，但**字形**由字体决定——缺字形要加位图字体（font/*.json，1.19.3+）。

## 5. 服务端字面名边界（关键结论）

- **`custom_name` / `item_name` 组件是服务端写死的字面文本，资源包语言文件无法翻译它们**（语言文件只翻译 `item.*`/`block.*`/`entity.*` 等**键**）。
- 服务端物品（MMOItems 的 MMOITEMS_NAME 等）显示中文 = **改服务端配置**（改名后 `reload`），资源包侧唯一能做的是匹配它们的字面名（CIT 条件）。
- v14 实证：26.2 上 "Blue Biamond Boots" 这类服务端拼写错误，客户端条件永远匹配不上——改服务端或改条件双通道兼容（见 minecraft-pack-cit 案例库）。

## 6. 工具联动

- `mc_pack_validate`：lang 格式时代核对、键完整性、BOM/重复键。
- `mc_pack_build`：老时代自动 .json → .lang 转换（含 .name 后缀）。

## 7. 参考文件索引

- `references/api/lang-formats.md` — 语言文件格式全表 + 键约定 + 转换规则
- `references/api/localization-guide.md` — 中文附属包流程、服务端字面名边界、字体补字
