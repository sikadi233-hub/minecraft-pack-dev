# pack_format 全表与格式断代（唯一事实表）

> 核对日期：2026-08。数值来源：Minecraft Wiki Pack format 页（老线/1.20 线长期稳定）；
> 1.21.4=63、1.21.5=71 为公认断代；1.21.6–26.2（75–84）按 MoonLight 修复记录一手实测
> （用户读取 wiki 范围 75–84，26.2 + citresewn fork 实测通过）。
> ⚠ verify：26.x 数值仍在变化；客户端报 "made for a newer version" 时以 Wiki 为准更新。

## 1. pack_format 表

| MC 版本 | pack_format | 关键变化 |
|---|---|---|
| 1.7.10 | 1 | 资源包早期格式；无服务端推送（手动安装） |
| 1.12.2 | 3 | .lang 语言文件 |
| 1.16.5 | 6 | .json 语言文件（1.13 起）；sounds.json 事件结构 |
| 1.20.1 | 15 | 位图字体（1.19.3+）、atlas/*.json（1.19.3+）已生效 |
| 1.20.2 | 18 | pack.mcmeta `overlays` 字段引入 |
| 1.20.3–1.20.4 | 22 | 服务端分发改 ServerResourcePackManager |
| 1.20.5–1.20.6 | 34 | **组件系统**（custom_name/item_name）；GUI 贴图拆分；particles/*.json |
| 1.21–1.21.1 | 48 | |
| 1.21.2–1.21.3 | 57 | |
| 1.21.4 | 63 | **items/*.json + blocks/*.json 模型系统重写** |
| 1.21.5 | 71 | |
| 1.21.6 | 75 | |
| 1.21.7 | 77 | |
| 1.21.8 | 80 | 1.21.x 线当前默认 |
| 26.2 | 84 | verify（一手范围 75–84）；citresewn fork；原版无 zh_cn |

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

## 4. 解析语义（lib/pack-format.js 同款）

- `1.21.x` / `26.x` 通配 → 该行默认（1.21.8=80 / 26.2=84）
- 精确版本命中（`1.21.2`=57）；同线内向下取整（`1.21.3`→57）
- 工具与文档共用本表；改表必须同步 lib/pack-format.js
