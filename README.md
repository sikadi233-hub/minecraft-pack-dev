# minecraft-pack-dev

通用材质包修复插件 for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）：**minecraft-dev 的附属插件**——让 agent 能诊断和修复大部分类型的资源包（模型/纹理/CIT/字体/GUI/语言/音频/分版），覆盖 **MC 1.7.10 ~ 26.x 全时代**。

定位：与 [minecraft-dev](https://www.npmjs.com/package/minecraft-dev) **平行安装、互不侵入**。minecraft-dev 管"写插件/模组"，本插件管"修资源包"。知识来自 MoonLight 材质包 v2–v14 修复记录（见 `minecraft-pack-cit` 技能的 moonlight-casebook.md）。

## 前置要求

**先下载并安装 [minecraft-dev](https://github.com/sikadi233-hub/minecraft-dev)**（本插件的母项目）：

```sh
dsh plugin --profile web add minecraft-dev
```

两个插件都装好后**重启 dsh**（或一并装完再重启）。minecraft-dev 提供 Minecraft 开发通用技能与 mc_scaffold/mc_gradle；本插件在其基础上补充资源包修复技能与 mc_pack_* 工具。

## 功能一览

### 5 个技能（模型按需加载，不占常驻上下文）

| 技能 | 内容 |
|---|---|
| `minecraft-pack-core` | 资源包基础与排障：pack_format 全表（1.7.10=1 ~ 26.2=84）、目录布局、overlay、zip/LF 规范、sounds.json、日志判读与四步排障法 |
| `minecraft-pack-models` | 物品/方块/实体/盔甲模型：1.21.4+ items·blocks json、blockstates、OptiFine CIT 模型、玩家头实体模型、TypeArmor 盔甲层、UV 0-16 网格、parent 循环、Blockbench 坑 |
| `minecraft-pack-textures` | 纹理/GUI/字体/粒子：PNG 规范与残缺检测、动画 .mcmeta、1.20.5+ GUI sprite 拆分、位图字体（1.19.3+）、particles/*.json |
| `minecraft-pack-lang` | 语言与本地化：.lang ↔ .json 断代与转换、键完整性、中文 zh_cn 附属包、服务端字面名边界（资源包翻译不了的，只能服务端改名） |
| `minecraft-pack-cit` | CIT 物品显示：.properties 语法、条件通道时代矩阵（26.2 citresewn fork lore 已死、unbreakable 杀 damage）、MoonLight v2–v14 案例库 |

### 3 个工具（纯本地文件操作，无网络、无子进程）

| 工具 | 用途 |
|---|---|
| `mc_pack_scaffold` | 创建分版资源包项目骨架：pack.config.json + source/（cit/models/lang/sounds）+ overlays/<版本>/ |
| `mc_pack_validate` | 全域规则校验：pack_format/JSON/CRLF/空格/重名/PNG/UV/parent 循环/引用断链/lang 键完整/声音引用/CIT 13 规则；analyze 统计模式；log 日志诊断模式（latest.log → 包内文件定位） |
| `mc_pack_build` | 分版组装：source + overlays → pack_format 注入 → lang .json→.lang 转换（≤1.12.2）→ LF/BOM 规范 → dist/<版本>/<packId>.zip；fix 低风险自动修复；failOnError 预校验 |

## 安装

### 方式一：npm（发布后）

```sh
dsh plugin --profile web add minecraft-pack-dev
```

### 方式二：源码直连（开发迭代）

```sh
dsh plugin --profile web add C:\Users\YX-ASUS\Desktop\minecraft-dev\addons\minecraft-pack-dev
```

（从 dsh 仓库源码运行时用 `pnpm dsh` 代替 `dsh`，先 `cd` 到 dsh 仓库根目录，见 minecraft-dev README。）

### ⚠️ 安装后必须重启 dsh 服务

装完插件**重启 dsh** 才生效（minecraft-dev 同理）。验证：

```sh
pnpm dsh --profile web dump-config   # 应出现 "# == minecraft-pack-dev" 与 minecraft-pack-skills/minecraft-pack-tools 两行
```

### 卸载

```sh
dsh plugin --profile web remove minecraft-pack-dev
```

## 使用

发材质包任务时模型自动路由到对应技能（也可手动 `/minecraft-pack-cit` 注入）。对话示例：

```
这个资源包在 26.2 上锁链骑士套不生效，帮我查
帮我校验这个资源包目录：mc_pack_validate D:\packs\moonlight -targetMc 26.2
把 latest.log 的报错映射到包内文件：mc_pack_validate D:\packs\moonlight -mode log -logPath D:\mama\logs\latest.log
给这个资源包做 1.7.10 到 26.2 的分版：mc_pack_build D:\packs\moonlight
新建一个分版资源包项目：mc_pack_scaffold D:\packs\newpack moonlight
```

## 技能路由关键词

资源包 / 材质包 / texture pack / resource pack / CIT / OptiFine / citresewn / pack_format / 模型 UV / Blockbench / 字体 / GUI 贴图 / 语言文件 / zh_cn / sounds.json。

## 开发

```sh
npm test          # 纯函数单测（43 项）。注意：本环境沙箱禁子进程管道，
                  # 用 node --test --test-isolation=none 代替默认 runner
npm run typecheck # tsc --noEmit（tsc 6 兼容；Node 类型用自包含 types/node.d.ts）
npm run check-links  # 核对 README/技能文档里的 http(s) 链接（联网；BROKEN=0 为通过）
```

### npm 发布（用户已授权自动执行）

发布配置已就绪（`repository`/`homepage`/`prepublishOnly` 自检）。**发布流程由 agent 自动执行**（用户 2026-08-31 确认"以后都这样发"，与 minecraft-dev 同流程）：

1. `npm whoami --registry=https://registry.npmjs.org` 确认登录；失效时 `npm login --auth-type=web --registry=https://registry.npmjs.org`（浏览器授权）。
2. 发布前先 bump 版本（`npm version patch --no-git-tag-version`，改完提交）。
3. `npm publish --registry=https://registry.npmjs.org`。
4. `npm view <name> version` 验证（npm 处理有几分钟延迟）。

已知坑（同 minecraft-dev，2026-08-31 实测）：token 过期 → `404 PUT`（不是网络问题，重新 web 登录）；版本已 staged → `409 Cannot publish over previously staged version`（bump 或等待过期）；浏览器授权 URL 只在真实 TTY 显示。

版本号发布前需人工 bump（`npm version patch` 等）。

## Known Limitations

- pack_format 数值以 2026-08 核对为准：老线/1.20 线为长期稳定值；**26.2=84 按 MoonLight 一手记录（Wiki 范围 75–84）**；26.x 生态仍在变化，客户端报 "made for a newer version" 时以 Wiki 为准更新 `lib/pack-format.js` 与 pack-format-matrix.md。
- PNG 检测 v1 只做结构（签名/IHDR/截断）+ 字节阈值残缺启发式；像素级统计（ArmorHB 202/2048）为 v2。
- 26.2 物品 registry 全表缺失 → 引用存在性按命名空间分级（非 minecraft 缺失=ERROR，可能指向原版=WARN）。
- 1.20.5+ GUI sprite 拆分、OptiFine 着色器等"需人工核对"项工具不自动判定。
- 技能 rank 600（bundled）；用户本地同名技能会覆盖本包技能——冲突时删本地同名目录。
- 与 minecraft-dev 无依赖关系（peer 仅 dsh 运行时四件套）；两插件可分别安装/卸载。
- Windows 文件系统大小写不敏感 → 大小写重名检测为纯函数（findCaseDuplicates / planCaseDuplicates），磁盘上无法构造该场景。
