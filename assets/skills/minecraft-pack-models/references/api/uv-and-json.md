# UV 网格规则、parent 链与 JSON 严格性

> 核对日期：2026-08。报错语义来自 MoonLight v14 实测。

## 1. UV 0-16 网格（最高频翻车点）

- 模型面 `uv: [x1, y1, x2, y2]` 的坐标是**贴图上的 0-16 比例坐标**（不是像素）。
- 用像素坐标（×4）→ UV [64,0,96,32] 越界 → 报错：

```
Cannot compute translucency out of bounds: [64,0,96,32] in 64x64
```

- 游戏内表现：部件马赛克/透明错乱（v14 玩家头案）。
- **判定规则（mc_pack_validate）**：UV 任意值 <0 或 >16 → ERROR `model-uv-bounds`。
- 边界值 0 与 16 本身合法（贴图整边）。

## 2. parent 引用链

- `"parent": "<模型ID>"`：父模型提供 textures 变量与 elements，子模型可覆盖。
- 引用解析：`models/item/foo.json` 的 parent `minecraft:block/cube_all` → `assets/minecraft/models/block/cube_all.json`。
- **自引用/循环 → 加载失败**（validate `model-parent-cycle`：DFS 三色标记）。
- 常见坏链：parent 指向包内不存在文件（ERROR，非 minecraft ns）；parent 值不是字符串（ERROR）。

## 3. JSON 严格性

- 无注释、无尾逗号、键值类型正确（Blockbench 导出一般合规；手改易坏）。
- 结构要点：
  - `elements[]`：每个元素 `from`/`to` 各 3 个数字；`faces` 的键 ∈ {north,south,east,west,up,down}；面对象 `uv`（4 数字）+ `texture`（`#变量`）+ 可选 `cullface`/`rotation`。
  - `textures`：变量 → 路径（`block/stone`、`minecraft:block/stone`）或 `#其他变量`。
  - `display`：槽位键（thirdperson_righthand 等）→ rotation/translation/scale 各 3 数字。
  - `overrides`（legacy）：`{predicate, model}` 列表。
- 数值合法性：from/to 超出常见范围 [-32, 64] → WARN（不常见但可合法，如手持大模型）。

## 4. 报错 → 修复对照

| 报错 | 修复 |
|---|---|
| Cannot compute translucency out of bounds | UV 改回 0-16 |
| Missing model: X | 补 `models/<X>.json` 或修引用 |
| 模型不显示/白模 | 纹理引用断链（#变量未定义、路径错） |
| 部件错位 | display 变换数组类型错误 / from-to 颠倒 |
