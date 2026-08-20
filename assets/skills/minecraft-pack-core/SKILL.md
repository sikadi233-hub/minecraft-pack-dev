# 资源包基础与排障（minecraft-pack-core）

> 前置：无。构建/Java 问题加载 minecraft-java-build；模型/纹理/CIT/语言细节分别加载 minecraft-pack-models / minecraft-pack-textures / minecraft-pack-cit / minecraft-pack-lang。
> **铁律：pack_format 等数值一律查 `references/api/pack-format-matrix.md`（本技能唯一事实表），禁止凭记忆写。** 参考里标注「verify」的数值，用 web 工具核对 Minecraft Wiki 后再用。
> 核对日期：2026-08。26.x 生态仍在变化（NeoForge 26.2 beta、pack_format 84 按用户实测）。

## 1. 定位与适用

- 本技能覆盖**任意类型资源包**（材质包/纹理包/音效包/CIT 包/语言包）的**结构与打包层**知识，MC 1.7.10 ~ 26.x 全时代：pack.mcmeta 与 pack_format、目录布局与命名空间、overlay 机制、zip 与换行规范、sounds.json、以及排障方法论（日志判读 → 时代核对 → 文件级检查 → 数据侧核对）。
- 这是排障的**入口技能**：先判时代，再决定哪份参考文件生效。
- 配套工具：`mc_pack_validate`（结构校验 + analyze 统计 + log 日志诊断）、`mc_pack_build`（分版组装）、`mc_pack_scaffold`（项目骨架）。工具把本技能的方法论代码化——但工具只查机械性问题，**语义问题（条件该不该这么写、名字该不该这样拼）仍要模型判断**。

## 2. 时代判定的第一步（永远先做）

拿到任何资源包任务，先回答三个问题：

1. **目标 MC 版本**？→ 查 pack-format-matrix.md 拿 pack_format、lang 格式（.lang/.json）、模型系统（legacy/items-json）、CIT 通道（nbt.display/components）。
2. **包的类型**？→ 模型（models/ + items/ + blockstates/）、纹理（textures/ + font/ + atlas/ + particles/）、CIT（cit/ + 包根 models/）、语言（lang/）、音频（sounds.json + sounds/）。
3. **症状**？→ 游戏内不生效 / 花屏马赛克 / 紫黑格缺纹理 / 控制台报错（Missing model、Missing texture、atlas 报错）/ 分版加载失败（"made for a newer version"）。

## 3. 四步排障法（v14 实战沉淀）

1. **日志判读**：`<版本目录>/logs/latest.log` 搜 `Missing model` / `Missing texture` / `Cannot compute translucency` / `atlas` 相关行；**忽略无关噪音**（如 [ETF] Entity Texture Features 的报错是另一个模组的，与本包无关）。
2. **时代核对**：该版本用的是 .lang 还是 .json？lore 条件还能不能匹配（26.2 已死）？items/*.json 有没有（1.21.4+）？→ 全部对照 pack-format-matrix.md。
3. **文件级检查**：CRLF 换行、目录/文件名含空格、items= 逗号分隔、大小写重名、JSON 语法、UV 越界、纹理引用断链——这些 `mc_pack_validate` 一条命令全查。
4. **数据侧核对**（服务端相关时）：游戏内 `/data get entity @p SelectedItem` 看物品真实组件——**服务端给的数据才是最终裁判**（v14 查出服务端把 Diamond 拼成 Biamond 就是靠这一步）。

## 4. 核心概念速记

- **pack.mcmeta**：`{"pack":{"pack_format":N,"description":"..."}}`；pack_format 不对 → 客户端报 "made for a newer/older version"。
- **命名空间**：所有内容在 `assets/<namespace>/` 下（默认 `minecraft`）；OptiFine CIT 例外——`cit/` 属性文件与 `models/` 在**包根**。
- **overlay（1.20.2+）**：pack.mcmeta 的 `overlays` 字段可按版本条件加载内容；本插件族的 `mc_pack_build` 用**分版本 zip** 方案（overlay 字段为原生备选，见 pack-layout.md）。
- **文本规范**：LF 换行（CRLF 是历史坑：108 个属性文件批量转 LF）、JSON 无 BOM、UTF-8。
- **sounds.json**：`assets/<ns>/sounds.json` 事件 → `assets/<ns>/sounds/<name>.ogg`。

## 5. 工具联动

- `mc_pack_validate <packDir> -targetMc <版本>` → 校验（目标时代规则自动生效）
- `mc_pack_validate <packDir> -mode analyze` → 全包统计（对应 citresewn analyze 的 "356 armor + 168 item" 类结论）
- `mc_pack_validate <packDir> -mode log -logPath <latest.log>` → 日志报错映射到包内文件
- `mc_pack_build <packDir>` → 产出 dist/<版本>/*.zip（pack_format 注入、lang 转换、LF 强制）
- `mc_pack_scaffold <targetDir> <packId>` → 新包骨架

## 6. 参考文件索引

- `references/api/pack-format-matrix.md` — **pack_format 全表 + 关键格式断代**（唯一事实表）
- `references/api/pack-layout.md` — 目录结构、pack.mcmeta 字段、overlay、zip 规范
- `references/api/audio.md` — sounds.json 结构、ogg 引用、常见损坏
- `references/api/troubleshooting.md` — 日志判读模式表、四步排障法细节、v14 案例引用
