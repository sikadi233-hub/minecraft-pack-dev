# pack_format 全表与格式断代（唯一事实表）

> 核对日期：**2026-09**。权威来源：**该版本 client.jar 内顶层 `version.json` 的
> `pack_version.resource` / `resource_major`**（`resource*` 才是 pack.mcmeta 的 pack_format；
> `data*` 是**数据包**格式，两者从 1.20.5 起分家，混用会写出错误数值）。
>
> 获取流程（可重跑，脚本：`scripts/derive-pack-format.mjs`）：
> `version_manifest_v2.json` → 该版本 `url` → `downloads.client.url` → client.jar → 读 `version.json`。
> 二次确认：client.jar 内混淆常量类 `ac`（26.x 为 `net.minecraft.SharedConstants`）的
> `i` = 资源包格式、`j` = 数据包格式（26.x 为 `RESOURCE_PACK_FORMAT_MAJOR/MINOR`）。
>
> ⚠ 旧版本文档（2026-08）列出的 1.20.5=34、1.21=48、1.21.2=57、1.21.5=71、
> 1.21.6=75、1.21.7=77、1.21.8=80 是**数据包**格式号被误当资源包格式，已全部修正。
> 26.2 旧值 84 来自"用户一手记录"，实测 `SharedConstants` = 88.0，已修正。

## 1. pack_format 表

| MC 版本 | pack_format（resource） | 数据包格式（data） | 核对 | 关键变化 |
|---|---|---|---|---|
| 1.7.10 | 1 | 1 | 沿用稳定表（jar 无 version.json） | 资源包早期格式；无服务端推送（手动安装） |
| 1.12.2 | 3 | 3 | 沿用稳定表（jar 无 version.json） | .lang 语言文件 |
| 1.16.5 | 6 | 6 | ✅ jar 内根 pack.mcmeta | .json 语言文件（1.13 起）；sounds.json 事件结构 |
| 1.20.1 | 15 | 15 | ✅ version.json | 位图字体（1.19.3+）、atlas/*.json（1.19.3+）已生效 |
| 1.20.2 | 18 | 18 | ✅ version.json | pack.mcmeta `overlays` 字段引入 |
| 1.20.3–1.20.4 | 22 | 26 | ✅ version.json | 服务端分发改 ServerResourcePackManager |
| 1.20.5–1.20.6 | 32 | 41 | ✅ version.json | **组件系统**（custom_name/item_name）；GUI 贴图拆分；particles/*.json |
| 1.21–1.21.1 | 34 | 48 | ✅ version.json | |
| 1.21.2–1.21.3 | 42 | 57 | ✅ version.json | |
| 1.21.4 | 46 | 61 | ✅ version.json + SharedConstants | **items/*.json + blocks/*.json 模型系统重写** |
| 1.21.5 | 55 | 71 | ✅ version.json | |
| 1.21.6 | 63 | 80 | ✅ version.json + SharedConstants | |
| 1.21.7 | 64 | 80 | ⚠ 推断（jar 未取到） | |
| 1.21.8 | 64 | 81 | ✅ version.json + SharedConstants | 1.21.x 线默认 |
| 1.21.11 | 75 | 94.1 | ✅ version.json | 1.21.x 线最后一档 |
| 26.2 | 88.0 | 107.1 | ✅ version.json + SharedConstants | citresewn fork；原版无 zh_cn |
| 26.3 | **97.1** | 121.0 | ✅ version.json + SharedConstants | **CIT 前端截至 2026-09 无 26.3 版本**（见 §3） |

## 2. 格式断代速查（按内容域）

| 内容域 | 断代点 | 旧 → 新 |
|---|---|---|
| 语言文件 | 1.13 | .lang（zh_CN.lang，键带 .name）→ .json（zh_cn.json） |
| 字体 | 1.19.3 | unicode 字体文件 → font/*.json 位图字体 providers |
| atlas | 1.19.3 | 无 → atlas/*.json 资源列表 |
| overlay | 1.20.2 | 无 → pack.mcmeta overlays 字段 |
| 服务端分发 | 1.8 / 1.20.3 | 无（1.7.10）→ setResourcePack → ServerResourcePackManager |
| 组件系统 | 1.20.5 | NBT display 标签 → 组件（nbt.display.* 条件失效） |
| GUI 贴图 | 1.20.5 | 整图 → 独立 sprite（旧路径失效） |
| 粒子 | 1.20.5 | 贴图直引 → particles/*.json |
| 物品/方块模型 | 1.21.4 | models/item + blockstates → items/*.json + blocks/*.json（condition/using_item/range_dispatch、when/apply） |

## 3. CIT 条件通道断代（与 minecraft-pack-cit 的 cit-era-matrix.md 同源）

| 时代 | 可用通道 | 失效通道 |
|---|---|---|
| ≤1.20.4 | nbt.display.Name / nbt.display.Lore.* | — |
| 1.20.5–1.21.x | components.minecraft\:custom_name / item_name | nbt.display.* |
| 26.2（citresewn fork） | components.minecraft\:custom_name / item_name | nbt.display.*（lore 匹配已死） |
| 26.3 | **同上（语义沿用）**，但**无 CIT 前端可装** | nbt.display.*；且 CIT 整体无运行时 |

- **UNVERIFIED（26.3 CIT）**：cit-resewn-continuation / cit-resewn-fork 截至 2026-09 均无
  26.3 版本（来源：Modrinth `api.modrinth.com/v2/search?query=cit resewn` 搜索结果）。
  因此 26.3 上 CIT 通道语义**未经实测**，上表 26.3 行是按 26.2 语义外推——
  要证实需要 26.3 版 citresewn fork 的字节码反编译 + 游戏内实测。
  `mc_pack_validate -targetMc 26.3` 检测到包内有 `.properties` 时会给出
  非阻塞 `cit-runtime-missing` WARN。
- **UNVERIFIED（26.3 其余内容域）**：items/blocks 模型、GUI sprite 拆分、
  particles/*.json、lang 文件格式在 26.3 上是否与 26.2/1.21.x 一致**未逐项复核**；
  要证实需要 26.3 client.jar 的 assets 树比对（本次只核对了 pack_version 数值）。

## 4. 解析语义（lib/pack-format.js 同款）

- `1.21.x` 通配 → 该行默认（1.21.8=64）；`26.x` 通配 → 26.3=97
- 精确版本命中（`1.21.2`=42）；同线内向下取整（`1.21.3`→42、`1.21.9`→64）
- 工具与文档共用本表；改表必须同步 `lib/pack-format.js`
  （最佳做法：先跑 `node scripts/derive-pack-format.mjs` 重新推导，再同步）
