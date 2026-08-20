# 排障方法论：日志判读与四步流程

> 核对日期：2026-08。案例引用：minecraft-pack-cit 的 moonlight-casebook.md（v2–v14）。

## 1. 日志判读模式表（<版本目录>/logs/latest.log）

| 日志行（关键词） | 含义 | 处理 |
|---|---|---|
| `Missing model: <id>` | 模型加载不到 | 包内定位 `assets/<ns>/models/<id>.json`；存在则查 JSON/父模型，不存在则补文件 |
| `Missing texture: <id>` | 纹理加载不到 | 定位 `assets/<ns>/textures/<id>.png` |
| `Cannot compute translucency out of bounds: [64,0,96,32] in 64x64` | **模型 UV 越出 0-16 网格**（像素坐标 ×4 的典型症状） | 模型 UV 改回 0-16（v14 玩家头马赛克案） |
| `Failed to load/parse model/blockstate/font/texture ...` | 格式/结构错误 | 严格 JSON 检查 + 结构核对 |
| `[ETF] ...` | Entity Texture Features 模组的报错 | **与本包无关，忽略**（v14 红鲱鱼） |
| `made for a newer version` | pack_format 过高 | 按目标版本改 pack_format |
| `out of date` / `incompatible` | pack_format 过低 | 按目标版本升 pack_format |

`mc_pack_validate -mode log -logPath <latest.log>` 自动执行上表前四行的映射。

## 2. 四步排障法

1. **日志判读**：先看 latest.log 有没有明确的 Missing/越界行；有则直接定位。
2. **时代核对**：症状不明确时，先确认目标版本的正确格式（lang/.json、lore/components、items json）——**"包不生效"最常见原因是格式时代错位**。
3. **文件级检查**：跑 `mc_pack_validate`（CRLF/空格/逗号/重名/JSON/UV/引用/PNG 全查）。
4. **数据侧核对**（服务端相关）：游戏内 `/data get entity @p SelectedItem` 看真实组件；**服务端数据是最终裁判**（v14 查出 "Blue Biamond Boots" 拼写错误）。

## 3. 症状 → 根因对照（速查）

| 症状 | 头号嫌疑 |
|---|---|
| 整包不生效 / 原版外观 | pack_format 错配；客户端没装 CIT 前端（OptiFine/citresewn）；文件夹名含空格被忽略 |
| 某套装备不生效 | 条件与物品真实数据不匹配（拼写/通道/lore 失效） |
| 花屏马赛克 | 模型 UV 越界（0-16 网格） |
| 紫黑格 | 纹理文件缺失/损坏/引用路径错 |
| GUI 图标缺失 | 1.20.5+ GUI sprite 拆分导致旧路径失效 |
| 汉字变方块 | 字形缺失（位图字体）或语言键缺失 |
| 客户端拒载 | pack_format 与客户端版本不符 |

## 4. 边界认知（插件/资源包能力边界）

- 客户端必须装 OptiFine 或 citresewn（fork）CIT 才生效——服务端插件与资源包都无法替代客户端模组。
- 服务端 `custom_name`/`item_name` 是字面文本，语言文件翻译不了；只能服务端改名（见 minecraft-pack-lang）。
- 多包叠放时"缺失"可能来自下层包——minecraft 命名空间缺失引用只告警不判错。
