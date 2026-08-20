/**
 * 资源包时代矩阵（pack-format.js）— minecraft-pack-dev 的事实表。
 * 驱动 mc_pack_build 的 pack_format 注入与 mc_pack_validate 的时代规则。
 *
 * 数值来源（2026-08 核对）：
 *   - 老线/1.20 线：Minecraft Wiki Pack format 页（长期稳定值，多源一致）
 *   - 1.21.4=63、1.21.5=71：Wiki + 物品/方块模型系统重写断代（公认）
 *   - 1.21.6=75 / 1.21.7=77 / 1.21.8=80 / 26.2=84：用户一手记录
 *     （MoonLight 修复记录："Minecraft Wiki 资源包格式（pack_format 75-84）"，
 *     26.2 + citresewn fork 实测通过）。注意：npm pack-format 包的 release 表
 *     在 1.20.5+ 断代不可信，勿引用。
 * 生态仍在变化：26.x 数值如客户端报 "made for a newer version" 请以 Wiki 为准
 * 更新本文件并同步 references/pack-format-matrix.md。
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
    note: '无服务端资源包推送（1.8 才有），只能手动安装；CIT 需 OptiFine',
  },
  {
    version: '1.12.2', format: 3, langFormat: 'lang', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'legacy', atlas: false, particles: 'texture', guiSprites: 'whole',
    cit: 'optifine', lore: true, components: false, distribution: 'setResourcePack',
    note: '.lang 语言文件；lore 匹配可用',
  },
  {
    version: '1.16.5', format: 6, langFormat: 'json', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'legacy', atlas: false, particles: 'texture', guiSprites: 'whole',
    cit: 'optifine', lore: true, components: false, distribution: 'setResourcePack',
    note: 'json 语言文件；老线最后一档 MCP 时代',
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
    version: '1.20.5', format: 34, langFormat: 'json', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '组件系统引入：nbt.display.* 失效，改用 components.minecraft\\:custom_name / item_name；GUI 贴图拆分（旧路径失效）；particles/*.json',
  },
  {
    version: '1.21', format: 48, langFormat: 'json', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '1.21–1.21.1',
  },
  {
    version: '1.21.2', format: 57, langFormat: 'json', itemModels: 'legacy', blockModels: 'blockstates',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '1.21.2–1.21.3',
  },
  {
    version: '1.21.4', format: 63, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '物品模型系统重写：items/*.json + blocks/*.json（condition/using_item/range_dispatch）',
  },
  {
    version: '1.21.5', format: 71, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '',
  },
  {
    version: '1.21.6', format: 75, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '',
  },
  {
    version: '1.21.7', format: 77, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '',
  },
  {
    version: '1.21.8', format: 80, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'optifine', lore: false, components: true, distribution: 'spm',
    note: '1.21.x 线当前默认（2026-08）',
  },
  {
    version: '26.2', format: 84, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',
    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',
    cit: 'citresewn', lore: false, components: true, distribution: 'spm',
    note: 'verify: 84 按用户一手记录（Wiki 范围 75–84）；citresewn fork 下 lore 匹配失效，用 components 通道；原版无 zh_cn',
  },
]

/** 行（major.minor）默认指向的完整版本。 */
export const LINE_DEFAULTS = {
  '1.7': '1.7.10',
  '1.12': '1.12.2',
  '1.16': '1.16.5',
  '1.20': '1.20.1',
  '1.21': '1.21.8',
  '26': '26.2',
}

/** mc_pack_scaffold 的默认分版目标。 */
export const SUPPORTED_VERSIONS = ['1.7.10', '1.12.2', '1.16.5', '1.20.1', '1.21.8', '26.2']

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
 *   - "1.21.x" / "26.x" 通配 → 该行默认版本（1.21.8 / 26.2）
 *   - 精确版本命中（如 "1.21.2"）
 *   - 同线内向下取整（"1.21.3" → 1.21.2 条目的 57）
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
