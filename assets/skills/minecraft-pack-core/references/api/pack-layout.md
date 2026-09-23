# 资源包目录布局、pack.mcmeta 与打包规范

> 核对日期：2026-09（pack_format 数值见 `pack-format-matrix.md`，勿在此处另立一份）。

## 1. pack.mcmeta（包根必需）

```json
{
  "pack": {
    "pack_format": 97,
    "description": "我的资源包"
  }
}
```

（`97` 是 26.3 的值——具体版本查 `pack-format-matrix.md`，不要照抄本示例。）

- `pack_format` 缺失或与客户端版本不符 → 客户端报 "made for a newer version"（过高）或 "out of date"（过低）。
- description 是文本组件（字符串即可）。
- 1.20.2+ 可选 `overlays` 字段：`{"overlays": [{"format": 34, "directory": "overlay34"}]}`——按 pack_format 范围条件加载子目录；`mc_pack_build` 采用**分版本 zip** 方案（每版本一个包），原生 overlay 是二选一备选。

## 2. 目录布局

```
pack/
├─ pack.mcmeta
├─ assets/<namespace>/          # 原版内容（默认命名空间 minecraft）
│  ├─ models/                   # 模型 JSON（parent 链、elements）
│  ├─ textures/                 # 贴图 PNG（+ 动画 <name>.png.mcmeta）
│  ├─ items/                    # 1.21.4+ 物品模型定义
│  ├─ blocks/                   # 1.21.4+ 方块模型定义
│  ├─ blockstates/              # ≤1.21.3 方块状态（variants/multipart）
│  ├─ lang/                     # 语言文件（≤1.12.2 .lang / 1.13+ .json）
│  ├─ font/                     # 1.19.3+ 位图字体
│  ├─ atlas/                    # 1.19.3+ 纹理图集资源
│  ├─ particles/                # 1.20.5+ 粒子定义
│  └─ sounds.json + sounds/     # 声音事件 + ogg
├─ cit/                         # OptiFine / citresewn CIT 属性文件（包根！）
└─ models/                      # OptiFine CIT model= 引用的模型（包根！）
```

**两套 models/ 并存是常态**：`assets/<ns>/models/` 是原版语义；包根 `models/` 是 OptiFine CIT 语义（`model=` 属性）。`mc_pack_validate` 两者都查。

## 3. 打包规范（v14 教训）

1. 文本文件一律 **LF**（CRLF 是历史坑：MoonLight 曾 108 个属性文件 CRLF→LF）。
2. JSON 无 BOM、严格合法（无注释/尾逗号）；语言文件尤其要无 BOM。
3. 目录/文件名**不要含空格**（citresewn 直接忽略含空格文件夹）。
4. **不要大小写命名重复**（"Textures" vs "textures" 在打包/加载链路里会互相遮蔽）。
5. zip 内路径用正斜杠；`mc_pack_build` 产出确定性排序 + deflate 的 zip。

## 4. 分版策略（mc_pack_scaffold / mc_pack_build 方案）

```
pack/
├─ pack.config.json        # id / description / versions / syncGroups / names
├─ source/                 # 唯一内容源（所有版本共享）
└─ overlays/<版本>/         # 每版本独有（如 items/*.json 仅 1.21.4+）
```

- `mc_pack_build`：source + overlays/<版本> 合并 → pack_format 注入 → lang 转换（≤1.12.2 自动 .json→.lang）→ LF 强制 → dist/<版本>/<id>.zip。
- overlay 覆盖 source 且内容不同 → 告警（防静默覆盖）。
- 需要同步修改的两处目录（如 `cit/knight_items/armor` 与 `cit/armors_migrated/knight_items/armor`）在 `syncGroups` 声明 → validate 对比内容一致性。
