# 字体与 GUI：系统断代与 1.20.5+ 拆分

> 核对日期：2026-09（数值/生态）。pack_format 数值查 minecraft-pack-core 的 pack-format-matrix.md。

## 1. 字体系统断代

| 时代 | 系统 | 位置 |
|---|---|---|
| ≤1.19.2 | 旧 unicode 字体 | `textures/font/unicode_page_*.png`（按 Unicode 区块整页贴图） |
| 1.19.3+ | **位图字体** | `assets/<ns>/font/*.json` + `textures/<file>.png` |

## 2. 位图字体（1.19.3+）

```json
{
  "providers": [
    {
      "type": "bitmap",
      "file": "font/example",
      "height": 8,
      "ascent": 7,
      "chars": ["\uE001"]
    },
    { "type": "space", "advances": { " ": 4 } }
  ]
}
```

- `providers` 数组按顺序匹配（前命中优先）；常用 type：`bitmap`、`space`、`reference`。
- bitmap 的 `file` 相对 `textures/`（`font/example` → `textures/font/example.png`）；`chars` 每行字符串 = 贴图一行（横向逐格）。
- `height`（行高，默认 8）+ `ascent`（基线，默认 7）。
- **私有区字符（\uE000–\uF8FF）**是自定义字形的事实标准（不与其他字体冲突）。
- validate：providers 非数组 → WARN；bitmap 的 file 引用缺失 → 按命名空间 WARN/ERROR。

## 3. 中文补字

- 生僻字/特殊符号：语言文件能给文本，但**字形**必须由字体提供。
- 26.2 原版字体不含全部生僻字 → 用位图字体补（1.19.3+）；≤1.19.2 只能补 unicode 区块页（重）。（26.3 字体内容未核对——需查 26.3 client.jar 的 `assets/minecraft/font/`。）

## 4. GUI 贴图与 1.20.5+ 拆分（高频坑）

| 时代 | GUI 贴图形态 |
|---|---|
| ≤1.20.4 | 整图：`textures/gui/container/*.png`、`textures/gui/widgets.png` 等 |
| 1.20.5+ | **大量整图拆成独立 sprite PNG**（按钮/图标/容器部件各一文件） |

- **旧包升级 1.20.5+ 的症状**：GUI 图标/部件缺失（引用旧整图路径失效）。
- 修复：把旧整图按 sprite 拆图；或对旧版本保留整图、1.20.5+ overlay 提供拆分版（mc_pack_build 分版方案天然支持）。
- 标题界面（panorama/标题按钮）、加载图标、成就帧等同理，1.20.5+ 核对路径。

## 5. validate 覆盖

- font/*.json 结构 + 引用存在性（`mc_pack_validate` 字体域）。
- GUI 贴图时代差异**无法自动判定**（需人工核对路径是否属于拆分后体系）——这是模型的判断职责，工具给不了。
