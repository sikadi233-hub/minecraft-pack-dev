# 语言文件格式全表与转换规则

> 核对日期：2026-08。

## 1. 格式断代

| 时代 | 文件 | 位置与命名 | 语法 |
|---|---|---|---|
| ≤1.12.2 | `.lang` | `assets/minecraft/lang/zh_CN.lang` | `键=值`（Java properties；# 注释） |
| 1.13+ | `.json` | `assets/minecraft/lang/zh_cn.json` | `{"键": "值"}`（UTF-8 无 BOM） |

- 语言文件按客户端语言自动选择：en_us / zh_cn / ja_jp …；缺失回退 en_us。
- **26.2 原版只有 en_us.json，没有 zh_cn**——中文显示需要语言包补键。

## 2. 键约定

- 新式键（1.13+）：`item.diamond`、`block.diamond_block`、`entity.minecraft.zombie`、`itemGroup.misc`…
- 老式键（≤1.12.2）：物品/方块键带 `.name` 后缀——`item.diamond.name`、`tile.diamond_block.name`。
- **转换规则（mc_pack_build 自动执行）**：json → lang 时，匹配 `^(item|block|tile)\.([^.]+)$` 的键追加 `.name`；其余键不变。反方向（lang → json）为删 `.name`。

## 3. 键完整性

- 语言包应覆盖 en_us.json 的全部键；缺失键回退英文（半中半英观感）。
- `mc_pack_validate`：有 en_us.json 时，对照其他语言文件列出缺失键（最多列 20 个，WARN）。

## 4. 文件级要求（validate 检查）

- JSON：无 BOM（`mc_pack_validate` 的 json-bom 规则）、严格合法、**无重复键**（文本层检测——JSON.parse 会静默折叠重复键，v0.1 起用文本扫描器）。
- .lang：每行必须含 `=`（无分隔符行 WARN）；CRLF 可读但规范 LF。
- 语言文件名：语言码 + 正确扩展名（`zh_cn.json` / `zh_CN.lang`——注意老式用大写语言码）。

## 5. 分版注意

- 老时代（≤1.12.2）包内放 .json 语言文件无效——`mc_pack_build` 自动转换后进包。
- 现代时代（1.13+）包内出现 .lang → validate 的 lang-format-era WARN。
