# overlays/<mc-version>/ 目录

每个版本的独有内容放这里，构建时与 source/ 合并（overlay 优先，内容冲突会告警）。

常见用途：
- `overlays/1.21.8/assets/minecraft/items/` — 1.21.4+ 物品模型定义（旧版本没有此系统）
- `overlays/1.21.8/assets/minecraft/blocks/` — 1.21.4+ 方块模型定义
- `overlays/1.21.8/assets/minecraft/font/` — 1.19.3+ 位图字体
- `overlays/26.2/...` — citresewn fork 专属调整

≤1.12.2 的语言文件无需手工放：构建时自动把 source 的 .json 转换为 .lang（含 .name 键后缀）。
