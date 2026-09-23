/**
 * 资源包时代矩阵（pack-format.js）— minecraft-pack-dev 的事实表。
 * 驱动 mc_pack_build 的 pack_format 注入与 mc_pack_validate 的时代规则。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 数值来源（2026-09 重新核对）— 权威来源 = 该版本 client.jar 内的机器可读常量
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 获取方式（可重跑，见 scripts/derive-pack-format.mjs）：
 *   1. GET https://piston-meta.mojang.com/mc/game/version_manifest_v2.json
 *   2. 找到目标版本 → 取该版本的 `url`（version json）
 *   3. 从 version json 取 `downloads.client.url` → 下载 client.jar（~25-40MB/版本）
 *   4. 读取 client.jar 内的**顶层 `version.json`**，看 `pack_version`：
 *        - 老形态：{"resource": 64, "data": 81}
 *        - 26.x 形态：{"resource_major": 97, "resource_minor": 1,
 *                      "data_major": 121, "data_minor": 0}
 *      `resource` / `resource_major` **就是** pack.mcmeta 里要填的 pack_format。
 *      （`data`/`data_major` 是数据包格式，不是资源包格式，别混用。）
 *
 * 交叉验证（本次实际执行，全部离线可复现）：
 *   - client.jar 里的混淆常量类 `ac`（26.x 为 net.minecraft.SharedConstants）：
 *       `i` = 资源包格式，`j` = 数据包格式（26.x 为
 *       RESOURCE_PACK_FORMAT_MAJOR / DATA_PACK_FORMAT_MAJOR）。
 *       实测：1.21.4 i=46 j=61；1.21.6 i=63 j=80；1.21.8 i=64 j=81；
 *             26.2 = 88.0 / 107.1；26.3 = 97.1 / 121.0。
 *   - client.jar 内自带数据包的 pack.mcmeta（data/minecraft/datapacks/<pack>/pack.mcmeta）
 *     给出的是 data 值（1.21.8=81、26.2=min_format[107,1]、26.3=121），与
 *     SharedConstants 的 data 字段一致 → 说明两个字段的语义划分成立。
 *
 * 已用 client.jar 的 version.json 直接验证（2026-09）：
 *   1.20.1=15  1.20.2=18  1.20.3=22  1.20.5=32  1.21=34  1.21.2=42
 *   1.21.4=46  1.21.5=55  1.21.6=63  1.21.8=64  1.21.11=75.0  26.2=88.0  26.3=97.1
 * 另经 SharedConstants/`ac` 常量二次确认：1.21.4 / 1.21.6 / 1.21.8 / 26.2 / 26.3。
 *
 * 未能用 jar 验证，只能标注推断的：
 *   - 1.7.10=1、1.12.2=3：这两版 client.jar **不含 version.json**（该字段 1.13 才引入），
 *     jar 内也没有资源包 pack.mcmeta。取值沿用长期稳定表（1.6.1–1.8.9=1、1.11–1.12.2=3），
 *     保留原记录，未被本次核对推翻。
 *   - 1.16.5=6：已用 jar 内**根 pack.mcmeta** 直接确认（"pack_format": 6）。
 *   - 1.21.7=64：该版本 client.jar 多次下载均被 CDN 截断（网络不稳定），**未能验证**。
 *     值为推断：1.21.7 与 1.21.8 官服同周发布，1.21.8 的 resource=64，
 *     故 1.21.7 取 64；若客户端报 "made for a newer version" 以 jar 复核后修正。
 *
 * ⚠ 与旧版本文档的差异（重要）：本表 1.20.5–1.21.8 的旧值（34/48/57/71/75/77/80）
 *   实际是**数据包**格式号，被误当成了资源包格式。Minecraft Wiki 部分页面/二手表格
 *   混用了这两个数；本表一律以 client.jar 的 resource/resource_major 为准。
 *   26.2 的旧值 84 来自"用户一手记录"，实测 SharedConstants=88.0，已修正为 88。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 生态仍在变化：26.x 数值如客户端报 "made for a newer version" 请按上述流程
 * 重新用 client.jar 核对本文件并同步 references/api/pack-format-matrix.md。
 * 重新生成：node scripts/derive-pack-format.mjs 1.21.8 26.3 （需联网首次运行）
 * @module minecraft-pack-dev/lib/pack-format
 */

/**
 * 一行一条：精确版本优先，行默认值兜底。
 * 字段：
 *   format         pack_format（pack.mcmeta 必需）
 *   langFormat     lang（≤1.12.2 .lang 文件）| json（1.13+）
 *   itemModels     legacy（models/item/*.json + OptiFine CIT）| items-json（1.21.4+ items/*.json）
 *   blockModels    blockstates（blockstates/*.json）| blocks-json（1.21.4+ blocks/*.json）
 *   fontSystem     legacy（unicode 字体）| bitmap（1.19.3+ font/*.json）
 *   atlas          1.19.3+ atlas/*.json 资源列表
 *   particles      texture（粒子贴图直引）| json（1.20.5+ particles/*.json）
 *   guiSprites     whole（整图）| split（1.20.5+ GUI 贴图拆分，旧路径失效）
 *   cit            optifine | citresewn（26.x fork）
 *   lore           nbt.display.Lore/Name 条件是否仍可匹配
 *   components     组件系统（1.20.5+ custom_name/item_name）
 *   distribution   manual（1.7.10 无服务端推送）| setResourcePack（1.8-1.20.2）
 *                  | spm（1.20.3+ ServerResourcePackManager）
 */
export const PACK_ENTRIES = [
  {
    version: '1.7.10', format: 1, langFormat: 'lang', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'legacy', atlas: false, particles: 'texture', guiSprites: 'whole',
    cit: 'optifine', lore: true, components: false, distribution: 'manual',
    note: '无服务端资源包推送（1.8 才有），只能手动安装；CIT 需 OptiFine；该版 client.jar 无 version.json，数值沿用长期稳定表',
  },
  {
    version: '1.12.2', format: 3, langFormat: 'lang', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'legacy', atlas: false, particles: 'texture', guiSprites: 'whole',
    cit: 'optifine', lore: true, components: false, distribution: 'setResourcePack',
    note: '.lang 语言文件；lore 匹配可用；该版 client.jar 无 version.json，数值沿用长期稳定表',
  },
  {
    version: '1.16.5', format: 6, langFormat: 'json', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'legacy', atlas: false, particles: 'texture', guiSprites: 'whole',
    cit: 'optifine', lore: true, components: false, distribution: 'setResourcePack',
    note: 'json 语言文件；老线最后一档 MCP 时代（jar 内根 pack.mcmeta 已确认 6）',
  },
  {
    version: '1.20.1', format: 15, langFormat: 'json', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'bitmap', atlas: true, particles: 'texture', guiSprites: 'whole',
    cit: 'optifine', lore: true, components: false, distribution: 'setResourcePack',
    note: '字体重写（1.19.3+）与 atlas 已生效；lore 匹配仍可用',
  },
  {
    version: '1.20.2', format: 18, langFormat: 'json', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'bitmap', atlas: true, particles: 'texture', guiSprites: 'whole',
    cit: 'optifine', lore: true, components: false, distribution: 'setResourcePack',
    note: 'pack.mcmeta overlays 字段引入（分版可走原生 overlay）',
  },
  {
    version: '1.20.3', format: 22, langFormat: 'json', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'bitmap', atlas: true, particles: 'texture', guiSprites: 'whole',
    cit: 'optifine', lore: true, components: false, distribution: 'spm',
    note: '服务端资源包分发改 ServerResourcePackManager',
  },
  {
    version: '1.20.5', format: 32, langFormat: 'json', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '组件系统引入：nbt.display.* 失效，改用 components.minecraft\\:custom_name / item_name；GUI 贴图拆分（旧路径失效）；particles/*.json；resource=32、data=41（旧表误记 34=data）',
  },
  {
    version: '1.21', format: 34, langFormat: 'json', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '1.21–1.21.1；resource=34、data=48（旧表误记 48=data）',
  },
  {
    version: '1.21.2', format: 42, langFormat: 'json', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '1.21.2–1.21.3；resource=42、data=57（旧表误记 57=data）',
  },
  {
    version: '1.21.4', format: 46, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '物品模型系统重写：items/*.json + blocks/*.json（condition/using_item/range_dispatch）；SharedConstants i=46 j=61 已确认',
  },
  {
    version: '1.21.5', format: 55, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: 'resource=55、data=71（旧表误记 71=data）',
  },
  {
    version: '1.21.6', format: 63, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: 'SharedConstants i=63 j=80 已确认（旧表误记 75）',
  },
  {
    version: '1.21.7', format: 64, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: 'verify：jar 未取到（CDN 截断），按 1.21.8 的 resource=64 推断；旧表误记 77',
  },
  {
    version: '1.21.8', format: 64, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '1.21.x 线默认（2026-09）；SharedConstants i=64 j=81 已确认（旧表误记 80）',
  },
  {
    version: '1.21.11', format: 75, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: 'resource_major=75.0、data_major=94.1（jar version.json 已确认）；1.21.x 线最后一档',
  },
  {
    version: '26.2', format: 88, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'citresewn', lore: false, components: true, distribution: 'spm',
    note: 'SharedConstants RESOURCE_PACK_FORMAT_MAJOR=88 / MINOR=0、data 107.1 已确认（旧表误记 84）；citresewn fork 下 lore 匹配失效，用 components 通道；原版无 zh_cn',
  },
  {
    version: '26.3', format: 97, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'citresewn', lore: false, components: true, distribution: 'spm',
    note: 'SharedConstants RESOURCE_PACK_FORMAT_MAJOR=97 / MINOR=1（resource 97、minor 1）、data 121.0 已确认；UNVERIFIED：CIT 前端（cit-resewn-continuation / cit-resewn-fork）截至 2026-09 无 26.3 版本，26.3 上 CIT 无运行时可依赖；items/blocks/GUI 断代沿用 1.21.4/1.20.5，未逐项复核',
  },
]

/** 行（major.minor）默认指向的完整版本。 */
export const LINE_DEFAULTS = {
  '1.7': '1.7.10',
  '1.12': '1.12.2',
  '1.16': '1.16.5',
  '1.20': '1.20.1',
  '1.21': '1.21.8',
  '26': '26.3',
}

/** mc_pack_scaffold 的默认分版目标。 */
export const SUPPORTED_VERSIONS = ['1.7.10', '1.12.2', '1.16.5', '1.20.1', '1.21.8', '26.2', '26.3']

/**
 * CIT 前端（cit-resewn-continuation / cit-resewn-fork）尚未适配的版本。
 * 这些版本上资源包可以正常装，但 CIT `.properties` 没有运行时可执行——
 * mc_pack_validate 会据此给 non-blocking 提示，不要当成错误。
 * 依据：Modrinth 搜索 cit resewn，2026-09 无 26.3 版本。
 */
export const CIT_RUNTIME_MISSING_VERSIONS = ['26.3']

/**
 * 版本字符串归一化到 major.minor 行："1.21.8"/"1.21.x" → "1.21"；"26.2" → "26.2"。
 * @param {string} version
 * @returns {string}
 */
export function normalizeMcLine(version) {
  const stripped = String(version).replace(/\.x$/i, '')
  const parts = stripped.split('.')
  if (parts.length < 2) return stripped
  return `${parts[0]}.${parts[1]}`
}

function cmpVersion(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x - y
  }
  return 0
}

/**
 * 解析 MC 版本到时代条目，语义：
 *   - "1.21.x" / "26.x" 通配 → 该行默认版本（1.21.8 / 26.3）
 *   - 精确版本命中（如 "1.21.2"）
 *   - 同线内向下取整（"1.21.3" → 1.21.2 条目的 42）
 *   - 兜底行默认
 * @param {string} version
 * @returns {object} PACK_ENTRIES 中的条目
 */
export function resolveEra(version) {
  const v = String(version).trim()
  if (/\.x$/i.test(v)) {
    const line = normalizeMcLine(v)
    const def = LINE_DEFAULTS[line]
    if (!def) throw new Error(`不支持的 MC 版本 ${JSON.stringify(v)}；支持: ${SUPPORTED_VERSIONS.join(', ')}`)
    return PACK_ENTRIES.find(e => e.version === def)
  }
  const exact = PACK_ENTRIES.find(e => e.version === v)
  if (exact) return exact
  const line = normalizeMcLine(v)
  const sameLine = PACK_ENTRIES.filter(e => normalizeMcLine(e.version) === line)
  const floor = sameLine.filter(e => cmpVersion(e.version, v) <= 0).sort((a, b) => cmpVersion(a.version, b.version)).pop()
  if (floor) return floor
  const def = LINE_DEFAULTS[line]
  if (!def) {
    throw new Error(`不支持的 MC 版本 ${JSON.stringify(v)}；支持: ${SUPPORTED_VERSIONS.join(', ')}`)
  }
  return PACK_ENTRIES.find(e => e.version === def)
}

/** 别名。 */
export const eraOf = resolveEra

/**
 * 取 pack_format。
 * @param {string} version
 * @returns {number}
 */
export function packFormatFor(version) {
  return resolveEra(version).format
}

/**
 * 版本是否在支持表内（允许行写法，如 "1.21"、"26.x"）。
 * @param {string} version
 * @returns {boolean}
 */
export function isKnownVersion(version) {
  try {
    resolveEra(version)
    return true
  } catch {
    return false
  }
}

/**
 * 该版本是否缺 CIT 运行时（前端模组尚未适配）。
 * @param {string} version
 * @returns {boolean}
 */
export function citRuntimeMissingFor(version) {
  let resolved
  try {
    resolved = resolveEra(version)
  } catch {
    return false
  }
  return CIT_RUNTIME_MISSING_VERSIONS.includes(resolved.version)
}
