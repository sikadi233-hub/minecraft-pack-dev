# 资源包纹理 / GUI / 字体 / 粒子（minecraft-pack-textures）

> 前置：结构/打包问题同时加载 minecraft-pack-core。
> **铁律：字体/atlas/粒子等格式的时代断代查 `references/api/font-and-gui.md` 与 `references/api/texture-spec.md`，禁止凭记忆写格式。**
> 核对日期：2026-08。

## 1. 定位与适用

- 本技能覆盖资源包内**非模型类视觉内容**：PNG 纹理（尺寸/透明/动画/mipmap）、GUI 贴图（含 1.20.5+ 拆分）、字体（1.19.3+ 位图字体系统）、粒子（1.20.5+ JSON）、OptiFine 天空/着色器结构（文件层）。
- 常见症状：紫黑格缺纹理、GUI 图标缺失、字体乱码/缺字、粒子不显示、动画不播放。

## 2. PNG 纹理规范

- 合法 PNG：签名 + IHDR（尺寸/位深/颜色类型）+ IDAT + IEND；截断文件缺 IEND（validate 检出）。
- 尺寸任意合法即可，超大（>16384）或 0 尺寸非法；mipmap 需要非 1 的 2 的幂尺寸才完整（非强制）。
- **动画纹理**：`<贴图>.png.mcmeta` 的 `animation` 对象（frames 数组 + frametime）。
- **残缺启发式**（v14 ArmorHB 案）：64x64 以上但文件 <1KB → 大概率大面积透明/只画了部分身体——validate 给 WARN，人工用像素统计确认（202/2048 不透明像素）。

## 3. 引用与断链

- 纹理被模型（textures 变量）、CIT（texture.X=/particle=）、字体（bitmap provider 的 file）、粒子（textures[]）、atlas（directory source）引用——**引用存在性全部由 `mc_pack_validate` 检查**。
- 缺失分两种：指向包内文件但路径写错（ERROR 级，自定义命名空间）；指向原版资源（合法叠包，minecraft 命名空间缺失只 WARN）。

## 4. GUI 时代断代（高频坑）

- **1.20.5+ GUI 贴图拆分**：大量屏幕的整图贴图拆成独立 sprite PNG（如容器、按钮、图标），**旧包引用的旧整图路径在 1.20.5+ 失效** → 图标缺失。升级老包到 1.20.5+ 必须核对 GUI 路径。
- 标题界面/图标/按钮在 `textures/gui/`；1.20.5+ 部分移到 sprite 体系（查 font-and-gui.md）。

## 5. 字体

- **1.19.3+ 位图字体**：`assets/<ns>/font/*.json` 的 providers 数组；bitmap provider：`file` 指向 `textures/<file>.png`、`chars` 指定字符、`height/ascent` 控制行高基线。生僻字/emoji 用私有区字符（\uE000+）映射。
- **≤1.19.2**：旧 unicode 字体文件体系（textures/font/ 下的 unicode_page_*.png）。
- 中文补字：位图字体是资源包补生僻字的唯一途径（见 minecraft-pack-lang 的 localization-guide.md）。

## 6. 粒子与天空

- **1.20.5+**：`assets/<ns>/particles/*.json` 数据驱动粒子，`textures[]` 引用贴图；旧版本粒子贴图直引。
- OptiFine 天空/着色器：`shaders/`（GLSL）与 `sky/` 目录**文件存在性**可查，但 GLSL 语法不在本插件修复范围（v1）。

## 7. 参考文件索引

- `references/api/texture-spec.md` — PNG 规范、动画 .mcmeta、残缺检测、mipmap
- `references/api/font-and-gui.md` — 字体系统断代 + GUI sprite 拆分表
- `references/api/particles-and-sky.md` — 粒子 JSON、OptiFine 天空/着色器结构
