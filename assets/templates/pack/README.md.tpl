# {{packId}} — 分版资源包项目

由 `mc_pack_scaffold` 生成。布局：

```
pack.config.json          # 构建配置：id / description / versions / syncGroups / names
source/                   # 唯一内容源（所有版本共享）
  cit/                    # OptiFine / citresewn CIT 属性文件（包根，非 assets）
  assets/minecraft/       # 原版命名空间内容：models/ textures/ lang/ sounds.json
overlays/<mc-version>/    # 每版本独有内容（如 items/*.json 仅 1.21.4+，.lang 由构建转换）
```

## 常用命令

- 校验：`mc_pack_validate <本目录> -targetMc 26.3`（或 analyze / log 模式）
- 构建：`mc_pack_build <本目录>` → `dist/<版本>/{{packId}}.zip`
- 时代核对：pack_format 矩阵见 `minecraft-pack-core` 技能 references/pack-format-matrix.md

## 示例文件说明

- `source/cit/example_modern.properties` — 1.20.5+ / 26.x 组件时代条件（components.minecraft\:custom_name）
- `source/cit/example_legacy.properties` — ≤1.20.4 的 nbt.display.Name 条件
- `overlays/1.21.8/assets/minecraft/items/example.json` — 1.21.4+ 物品模型定义示例
- `overlays/1.21.8/assets/minecraft/font/example.json` — 1.19.3+ 位图字体示例

## 约定（v14 经验）

1. 文本文件一律 LF（构建时强制）；JSON 无 BOM
2. CIT `items=` 用空格分隔，禁止逗号
3. 目录/文件名不要含空格
4. 组件时代（1.20.5+）不要用 `nbt.display.*` 条件（lore 匹配已死）
5. `syncGroups` 声明需同步的两处目录（如 knight_items vs armors_migrated）
6. `names` 填服务端已知物品名，供拼写差异诊断（Biamond 类问题）
7. 26.3 分版：资源包本体可用，但 CIT 前端（citresewn fork）截至 2026-09 尚无 26.3 版本——
   `-targetMc 26.3` 校验含 CIT 的包会给出非阻塞 `cit-runtime-missing` WARN
