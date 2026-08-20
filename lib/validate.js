/**
 * 通用资源包校验引擎 — minecraft-pack-dev 的核心。
 * 对任意资源包目录运行规则集（按目录内容自动激活各内容域），
 * 输出结构化报告 { ok, era, stats, issues }。
 *
 * 路径语义（两套兼容）：
 *   - 原版资源：assets/<ns>/models|textures|items|blocks|blockstates|lang|font|atlas|particles|sounds.json
 *   - OptiFine CIT：包根 cit/ 与包根 models/（model= 引用，v14 经验）
 *
 * 规则清单（v14 修复记录教训编码）：
 *   打包/通用：pack.mcmeta 缺失或 pack_format 错配、JSON 严格解析（行列定位）、
 *     BOM、CRLF、路径含空格、大小写重名、PNG 头/尺寸/截断、残缺启发式
 *   模型：UV 0-16 网格、parent 循环、模型/纹理引用存在性（非 minecraft 命名空间缺失=ERROR，
 *     可能指向原版=WARN）、items/blocks/blockstates 结构
 *   纹理：动画 .mcmeta、font/*.json（1.19.3+）、atlas/*.json、particles/*.json
 *   语言：.lang/.json 时代匹配、键完整性（对照 en_us）
 *   音频：sounds.json 事件 → ogg 引用
 *   CIT：items 逗号分隔、nbt.display.* 时代失效、damage+unbreakable、texture.X 引用、
 *     ipattern 拼写差异（names 字典）、双通道同步（syncGroups）
 *   日志诊断：Missing model/texture、Cannot compute translucency out of bounds 等 → 定位包内文件
 * @module minecraft-pack-dev/lib/validate
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseJson, hasBom, collectDuplicateKeys } from './json.js'
import { checkPng, suspiciousSmall } from './png.js'
import { parseProperties, splitItems } from './properties.js'
import { resolveEra } from './pack-format.js'
import {
  checkModelStructure, checkItemModelJson, checkBlockModelJson, checkBlockstateJson,
  detectParentCycles, stripNamespace, namespaceOf,
} from './models.js'

const TEXT_EXT = new Set(['.json', '.properties', '.lang', '.mcmeta', '.txt', '.md', '.toml', '.yml'])
const KNOWN_CIT_TYPES = ['item', 'armor', 'enchantment', 'entity', 'elytra']

function extOf(rel) {
  const base = rel.split('/').pop() || ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot) : ''
}

/** 是否位于 assets/<ns>/<sub>/ 下 */
function underAssets(rel, sub) {
  return new RegExp(`^assets/[^/]+/${sub}/`).test(rel)
}

/**
 * 大小写不敏感重名检测（纯函数，操作 rel 路径字符串——Windows 文件系统
 * 大小写不敏感，磁盘上无法造出仅大小写不同的真实文件，故抽离为纯函数）。
 * @param {string[]} rels
 * @returns {{ key: string, list: string[] }[]} 重名组（list.length > 1）
 */
export function findCaseDuplicates(rels) {
  const lowerMap = new Map()
  for (const rel of rels) {
    const k = rel.toLowerCase()
    if (!lowerMap.has(k)) lowerMap.set(k, [])
    lowerMap.get(k).push(rel)
  }
  return [...lowerMap.entries()].filter(([, list]) => list.length > 1).map(([key, list]) => ({ key, list }))
}

/** 递归列出目录内全部文件（rel 用正斜杠）。 */
function walkDir(dir, base = '') {
  const out = []
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of entries) {
    if (ent.name === '.git' || ent.name === '.DS_Store') continue
    const rel = base ? `${base}/${ent.name}` : ent.name
    const abs = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walkDir(abs, rel))
    else if (ent.isFile()) out.push({ rel, abs })
  }
  return out
}

/** 定位资源包根：packDir 直含 assets/，或脚手架布局 packDir/source/assets。 */
function resolvePackRoot(packDir) {
  if (fs.existsSync(path.join(packDir, 'assets'))) return { root: packDir, notAssets: false }
  if (fs.existsSync(path.join(packDir, 'source', 'assets'))) return { root: path.join(packDir, 'source'), notAssets: false }
  return { root: packDir, notAssets: true }
}

function readUtf8(abs) {
  try {
    return fs.readFileSync(abs, 'utf8')
  } catch {
    return ''
  }
}

function fileExists(root, rel) {
  return fs.existsSync(path.join(root, ...rel.split('/')))
}

/** models/item/foo.json 或 assets/<ns>/models/item/foo.json → item/foo */
function relToModelId(rel) {
  return rel
    .replace(/^assets\/[^/]+\/models\//, '')
    .replace(/^models\//, '')
    .replace(/\.json$/, '')
}

/**
 * 模型引用 → 候选文件 rel 列表：
 *   - 包根 models/<id>.json（OptiFine CIT model= 语义）
 *   - assets/<ns>/models/<id>.json（原版语义）
 */
function modelCandidates(id) {
  const stripped = stripNamespace(id).replace(/\.json$/i, '')
  return [
    `models/${stripped}.json`,
    `assets/${namespaceOf(id)}/models/${stripped}.json`,
  ]
}

/** 'minecraft:block/stone' → assets/<ns>/textures/block/stone.png */
function textureRelOf(value) {
  const p = stripNamespace(value).replace(/\.png$/i, '')
  return `assets/${namespaceOf(value)}/textures/${p}.png`
}

/**
 * 校验一个资源包目录。
 * @param {{ packDir: string, targetMc?: string|null, mode?: string, logText?: string|null }} opts
 * @returns {object} 报告 { ok, packDir, root, targetMc, era, eraError, packConfig, stats, issues }
 */
export function validatePack(opts) {
  const { packDir = '', targetMc = null, mode = 'validate', logText = null } = opts
  const issues = []
  const add = (severity, domain, file, rule, message, hint = '') => issues.push({ severity, domain, file, rule, message, hint })

  const stats = {
    files: 0, byExt: {},
    citProperties: 0, modelJsons: 0, itemJsons: 0, blockJsons: 0, blockstates: 0,
    texturePngs: 0, fontJsons: 0, langFiles: 0, langKeys: 0, soundEvents: 0, logMatches: 0,
  }

  const { root, notAssets } = resolvePackRoot(packDir)
  if (notAssets) add('error', 'pack', '', 'no-assets', '未找到 assets/ 目录（packDir 或 packDir/source 下），可能不是资源包')

  // pack.config.json（脚手架产物，非必需）
  let packConfig = null
  const configRel = 'pack.config.json'
  if (fs.existsSync(path.join(packDir, configRel))) {
    const r = parseJson(readUtf8(path.join(packDir, configRel)), configRel)
    if (r.ok) packConfig = r.value
  }

  let era = null
  let eraError = null
  if (targetMc) {
    try {
      era = resolveEra(targetMc)
    } catch (e) {
      eraError = e instanceof Error ? e.message : String(e)
      add('error', 'pack', '', 'target-mc', eraError)
    }
  }

  // ── 文件清单与通用路径规则 ──────────────────────────────
  const files = walkDir(root)
  stats.files = files.length
  for (const f of files) {
    const ext = extOf(f.rel)
    stats.byExt[ext] = (stats.byExt[ext] || 0) + 1
  }

  let dupPairs = 0
  for (const group of findCaseDuplicates(files.map(f => f.rel))) {
    if (dupPairs < 10) {
      add('error', 'path', group.list.join(' | '), 'case-duplicate', `大小写不敏感重名（v14 教训：6 个大写命名重复文件）: ${group.list.join(' / ')}`)
      dupPairs++
    }
  }

  for (const f of files) {
    if (/\s/.test(f.rel)) {
      add('error', 'path', f.rel, 'space-in-name', '路径含空格——citresewn 直接忽略含空格文件夹（v14 "knight items" 教训）')
    }
  }

  for (const f of files) {
    if (TEXT_EXT.has(extOf(f.rel)) && /\r/.test(readUtf8(f.abs))) {
      add('warn', 'text', f.rel, 'crlf', 'CRLF 换行——规范为 LF（v14：108 个属性文件 CRLF→LF）')
    }
  }

  // ── pack.mcmeta ────────────────────────────────────────
  const mcmeta = files.find(f => f.rel === 'pack.mcmeta')
  if (!mcmeta) {
    add('error', 'pack', 'pack.mcmeta', 'missing-mcmeta', '缺少 pack.mcmeta（资源包必需）')
  } else {
    const r = parseJson(readUtf8(mcmeta.abs), mcmeta.rel)
    if (!r.ok) {
      add('error', 'pack', mcmeta.rel, 'json-parse', `JSON 解析失败: ${r.error.message}（第 ${r.error.line} 行第 ${r.error.column} 列）`)
    } else {
      const pf = r.value && r.value.pack ? r.value.pack.pack_format : undefined
      if (pf === undefined) add('warn', 'pack', mcmeta.rel, 'mcmeta-format', 'pack.pack_format 缺失')
      else if (typeof pf !== 'number') add('error', 'pack', mcmeta.rel, 'mcmeta-format', 'pack.pack_format 必须是数字')
      else if (era && pf !== era.format) {
        add('error', 'pack', mcmeta.rel, 'mcmeta-format', `pack_format ${pf} 与目标版本 ${targetMc}（应为 ${era.format}）不符——客户端会报 "made for a newer/older version"`)
      } else if (!era) {
        add('info', 'pack', mcmeta.rel, 'mcmeta-format', `pack_format ${pf}（未指定 targetMc，跳过时代核对）`)
      }
      if (r.value && r.value.overlays !== undefined && era && era.format < 18) {
        add('warn', 'pack', mcmeta.rel, 'overlays-era', 'overlays 字段需要 1.20.2+（pack_format 18+），当前时代不识别')
      }
    }
  }

  // ── JSON 全域：严格解析 + BOM + 重复键 ──────────────────
  const jsonCache = new Map()
  for (const f of files) {
    if (extOf(f.rel) !== '.json') continue
    const text = readUtf8(f.abs)
    const r = parseJson(text, f.rel)
    jsonCache.set(f.rel, r)
    if (!r.ok) {
      add('error', 'json', f.rel, 'json-parse', `JSON 解析失败: ${r.error.message}（第 ${r.error.line} 行第 ${r.error.column} 列）`)
      continue
    }
    if (hasBom(text)) add('warn', 'json', f.rel, 'json-bom', 'JSON 带 UTF-8 BOM（语言文件尤其要无 BOM）')
    const dk = collectDuplicateKeys(text).slice(0, 3)
    for (const d of dk) add('warn', 'json', f.rel, 'json-dup-keys', `重复键 ${d.key}（位于 ${d.path}）`)
  }

  // ── PNG 全域 ───────────────────────────────────────────
  for (const f of files) {
    if (extOf(f.rel) !== '.png') continue
    stats.texturePngs++
    const buf = fs.readFileSync(f.abs)
    const c = checkPng(buf)
    if (!c.ok) {
      add('error', 'texture', f.rel, 'png-invalid', `PNG 无效: ${c.error}`)
    } else if (suspiciousSmall(c.width, c.height, buf.length)) {
      add('warn', 'texture', f.rel, 'png-small', `PNG 尺寸 ${c.width}x${c.height} 但仅 ${buf.length} 字节——可能大面积透明/残缺（ArmorHB 案：530 字节、202/2048 不透明像素）`)
    }
  }

  // ── CIT .properties ────────────────────────────────────
  /** 纹理引用存在性（非 minecraft 命名空间缺失=ERROR，可能指向原版=WARN） */
  const checkTextureRef = (value, file, hint = '') => {
    if (!value) return
    const rel = textureRelOf(value)
    if (fileExists(root, rel)) return
    if (namespaceOf(value) !== 'minecraft') {
      add('error', 'texture', file, 'texture-missing', `纹理引用 ${value} 不存在（期望 ${rel}）`, hint)
    } else {
      add('warn', 'texture', file, 'texture-missing', `纹理引用 ${value} 不在包内（可能指向原版纹理，无法核对）`, hint)
    }
  }

  /** names 字典拼写差异提示（Biamond 案：*Blue Diamond* 永远匹配不上 "Blue Biamond Boots"） */
  const checkNameDict = (key, value, file) => {
    if (!packConfig || !Array.isArray(packConfig.names) || packConfig.names.length === 0) return
    const m = value.match(/\*([^*]+)\*/)
    if (!m) return
    const pattern = m[1].toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
    if (!pattern) return
    const close = packConfig.names.find(name => {
      const n = String(name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
      if (!n || n.includes(pattern) || pattern.includes(n)) return false
      // 子序列匹配；失败时容忍 1 个字符的增/删（拼写错误，v14 "Biamond" 案）
      const isSubseq = (p, s) => {
        let i = 0
        for (const ch of s) {
          if (ch === p[i]) i++
          if (i === p.length) return true
        }
        return i === p.length
      }
      if (isSubseq(pattern, n)) return true
      for (let i = 0; i < pattern.length; i++) {
        if (isSubseq(pattern.slice(0, i) + pattern.slice(i + 1), n)) return true
      }
      for (let i = 0; i < n.length; i++) {
        if (isSubseq(pattern, n.slice(0, i) + n.slice(i + 1))) return true
      }
      return false
    })
    if (close) {
      add('info', 'cit', file, 'name-dict-hint', `条件 ${value} 未精确命中，但 names 字典中的 "${close}" 与之近似——疑似服务端拼写差异（v14 "Blue Biamond" 案）`, `键 ${key}`)
    }
  }

  for (const f of files) {
    if (extOf(f.rel) !== '.properties') continue
    stats.citProperties++
    const text = readUtf8(f.abs)
    const p = parseProperties(text)
    for (const w of p.warnings) add('warn', 'cit', f.rel, 'properties-line', `第 ${w.line} 行: ${w.message}`)
    for (const k of p.duplicateKeys.slice(0, 5)) add('warn', 'cit', f.rel, 'properties-dup', `重复键 ${k}`)
    for (const e of p.entries) {
      const { key, value, line } = e
      if (key === 'items') {
        const { items, commaSeparated } = splitItems(value)
        if (commaSeparated) {
          add('error', 'cit', f.rel, 'items-comma', 'items= 用逗号分隔——citresewn 报 "null is not in the item registry"；必须空格分隔', `第 ${line} 行: ${value}`)
        }
        if (items.length === 0) add('warn', 'cit', f.rel, 'items-empty', 'items= 为空')
      }
      if (key.startsWith('nbt.display.')) {
        if (era && era.components) {
          add('error', 'cit', f.rel, 'lore-dead', `nbt.display.* 条件在 ${targetMc}（组件时代）永不匹配（26.2 lore 变 compound tags）——改用 components.minecraft\\:custom_name=ipattern:*…* 或 item_name`, `第 ${line} 行: ${key}=${value}`)
        } else if (!era) {
          add('warn', 'cit', f.rel, 'lore-era', 'nbt.display.* 条件在 1.20.5+ 组件时代失效（26.2 citresewn lore 匹配已死）——未指定 targetMc，无法核对', `第 ${line} 行: ${key}=${value}`)
        }
      }
      if (key === 'damage') {
        add('warn', 'cit', f.rel, 'damage-unbreakable', 'damage 条件在带 unbreakable 组件（如 MMOItems）的物品上永不成立（ItemStack.isDamageableItem() 恒 false）——v14 根因，建议删条件或服务端剥离 unbreakable', `第 ${line} 行: damage=${value}`)
      }
      if (key === 'customModelData' && era && era.itemModels === 'items-json') {
        add('info', 'cit', f.rel, 'cmd-era', 'customModelData 在 1.21.4+ 走 custom_model_data 组件，核对匹配写法')
      }
      if (key.startsWith('texture.')) checkTextureRef(value, f.rel, `第 ${line} 行`)
      if (key === 'particle') checkTextureRef(value, f.rel, `第 ${line} 行`)
      if (key === 'type' && !KNOWN_CIT_TYPES.includes(value)) {
        add('info', 'cit', f.rel, 'type-unknown', `未知 type=${value}（fork 可能扩展）`)
      }
      if (key === 'model' && value) {
        const cands = modelCandidates(value)
        if (!cands.some(rel => fileExists(root, rel))) {
          if (namespaceOf(value) !== 'minecraft') {
            add('error', 'cit', f.rel, 'model-missing', `model=${value} 引用的模型文件不存在（期望 ${cands[0]} 或 ${cands[1]}）`, `第 ${line} 行`)
          } else {
            add('warn', 'cit', f.rel, 'model-missing', `model=${value} 引用的模型不在包内（可能指向原版）`, `第 ${line} 行`)
          }
        }
      }
      if (/name/i.test(key)) checkNameDict(key, value, f.rel)
    }
  }

  // ── 模型域（包根 models/ = OptiFine CIT；assets/<ns>/models/ = 原版）──
  const isModelFile = (rel) => (rel.startsWith('models/') || underAssets(rel, 'models')) && extOf(rel) === '.json'
  const modelFiles = files.filter(f => isModelFile(f.rel))
  stats.modelJsons = modelFiles.length
  const parentList = []
  for (const f of modelFiles) {
    const r = jsonCache.get(f.rel)
    if (!r || !r.ok) continue
    const res = checkModelStructure(r.value)
    for (const i of res.issues) add(i.severity, 'model', f.rel, i.rule, i.message)
    for (const ref of res.textureRefs) checkTextureRef(ref, f.rel)
    for (const ref of res.modelRefs) {
      const cands = modelCandidates(ref)
      if (!cands.some(rel => fileExists(root, rel)) && namespaceOf(ref) !== 'minecraft') {
        add('error', 'model', f.rel, 'model-ref-missing', `父/覆盖模型引用 ${ref} 不存在（期望 ${cands[0]} 或 ${cands[1]}）`)
      }
    }
    if (typeof r.value.parent === 'string') {
      parentList.push({ id: relToModelId(f.rel), parent: stripNamespace(r.value.parent) })
    }
  }
  for (const cyc of detectParentCycles(parentList)) {
    add('error', 'model', `models/${cyc.model}.json`, 'model-parent-cycle', `parent 引用循环: ${cyc.chain.join(' -> ')}`)
  }

  const itemFiles = files.filter(f => underAssets(f.rel, 'items') && extOf(f.rel) === '.json')
  stats.itemJsons = itemFiles.length
  for (const f of itemFiles) {
    const r = jsonCache.get(f.rel)
    if (!r || !r.ok) continue
    const res = checkItemModelJson(r.value)
    for (const i of res.issues) add(i.severity, 'model', f.rel, i.rule, i.message)
    for (const ref of res.modelRefs) {
      const cands = modelCandidates(ref)
      if (!cands.some(rel => fileExists(root, rel))) {
        if (namespaceOf(ref) !== 'minecraft') add('error', 'model', f.rel, 'items-model-missing', `items 引用模型 ${ref} 不存在（期望 ${cands[0]} 或 ${cands[1]}）`)
        else add('warn', 'model', f.rel, 'items-model-missing', `items 引用模型 ${ref} 不在包内（可能指向原版）`)
      }
    }
  }

  const blockFiles = files.filter(f => underAssets(f.rel, 'blocks') && extOf(f.rel) === '.json')
  stats.blockJsons = blockFiles.length
  for (const f of blockFiles) {
    const r = jsonCache.get(f.rel)
    if (!r || !r.ok) continue
    const res = checkBlockModelJson(r.value)
    for (const i of res.issues) add(i.severity, 'model', f.rel, i.rule, i.message)
    for (const ref of res.modelRefs) {
      const cands = modelCandidates(ref)
      if (!cands.some(rel => fileExists(root, rel)) && namespaceOf(ref) !== 'minecraft') {
        add('error', 'model', f.rel, 'blocks-model-missing', `blocks 引用模型 ${ref} 不存在（期望 ${cands[0]} 或 ${cands[1]}）`)
      }
    }
  }

  const bsFiles = files.filter(f => underAssets(f.rel, 'blockstates') && extOf(f.rel) === '.json')
  stats.blockstates = bsFiles.length
  for (const f of bsFiles) {
    const r = jsonCache.get(f.rel)
    if (!r || !r.ok) continue
    const res = checkBlockstateJson(r.value)
    for (const i of res.issues) add(i.severity, 'model', f.rel, i.rule, i.message)
    for (const ref of res.modelRefs) {
      const cands = modelCandidates(ref)
      if (!cands.some(rel => fileExists(root, rel)) && namespaceOf(ref) !== 'minecraft') {
        add('error', 'model', f.rel, 'blockstate-model-missing', `blockstate 引用模型 ${ref} 不存在（期望 ${cands[0]} 或 ${cands[1]}）`)
      }
    }
  }

  // ── 动画 .mcmeta ───────────────────────────────────────
  for (const f of files) {
    if (!f.rel.endsWith('.png.mcmeta')) continue
    const r = jsonCache.get(f.rel)
    if (!r || !r.ok) continue
    const anim = r.value && r.value.animation
    if (anim !== undefined && anim !== null) {
      if (anim.frames !== undefined && !Array.isArray(anim.frames)) {
        add('warn', 'texture', f.rel, 'animation-frames', 'animation.frames 必须是数组（数字或 {index,time} 对象）')
      }
      if (typeof anim.frametime !== 'number' || anim.frametime < 1) {
        add('warn', 'texture', f.rel, 'animation-frametime', 'animation.frametime 应为 >=1 的数字')
      }
    }
  }

  // ── 字体（1.19.3+ bitmap 体系）─────────────────────────
  const fontFiles = files.filter(f => underAssets(f.rel, 'font') && extOf(f.rel) === '.json')
  stats.fontJsons = fontFiles.length
  for (const f of fontFiles) {
    const r = jsonCache.get(f.rel)
    if (!r || !r.ok) continue
    const providers = r.value && r.value.providers
    if (!Array.isArray(providers)) {
      add('warn', 'texture', f.rel, 'font-providers', 'font/*.json 需要 providers 数组')
      continue
    }
    for (let i = 0; i < providers.length; i++) {
      const pv = providers[i]
      if (pv && pv.type === 'bitmap' && typeof pv.file === 'string') {
        checkTextureRef(pv.file, f.rel, `providers[${i}]`)
      }
    }
  }

  // ── atlas（1.19.3+）────────────────────────────────────
  const atlasFiles = files.filter(f => underAssets(f.rel, 'atlas') && extOf(f.rel) === '.json')
  for (const f of atlasFiles) {
    const r = jsonCache.get(f.rel)
    if (!r || !r.ok) continue
    const sources = r.value && r.value.sources
    if (!Array.isArray(sources)) {
      add('warn', 'texture', f.rel, 'atlas-sources', 'atlas/*.json 需要 sources 数组')
      continue
    }
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i]
      if (!s || typeof s !== 'object') continue
      if (s.type === 'directory' && typeof s.source === 'string') {
        const dir = `assets/${namespaceOf(s.source)}/textures/${stripNamespace(s.source)}`
        if (!fileExists(root, dir)) {
          if (namespaceOf(s.source) !== 'minecraft') add('error', 'texture', f.rel, 'atlas-dir-missing', `atlas 目录 ${s.source} 不存在（期望 ${dir}）`, `sources[${i}]`)
          else add('warn', 'texture', f.rel, 'atlas-dir-missing', `atlas 目录 ${s.source} 不在包内（可能指向原版）`, `sources[${i}]`)
        }
      } else if (s.type === 'paletted_permutations' && Array.isArray(s.textures)) {
        for (const t of s.textures) checkTextureRef(t, f.rel, `sources[${i}]`)
      }
    }
  }

  // ── 粒子（1.20.5+）─────────────────────────────────────
  const particleFiles = files.filter(f => underAssets(f.rel, 'particles') && extOf(f.rel) === '.json')
  for (const f of particleFiles) {
    const r = jsonCache.get(f.rel)
    if (!r || !r.ok) continue
    const textures = r.value && r.value.textures
    if (Array.isArray(textures)) {
      for (const t of textures) checkTextureRef(t, f.rel)
    }
  }

  // ── 语言 ───────────────────────────────────────────────
  const langFiles = files.filter(f => /^assets\/[^/]+\/lang\/[^/]+$/.test(f.rel) || /^lang\/[^/]+$/.test(f.rel))
  stats.langFiles = langFiles.length
  const enKeys = []
  for (const f of langFiles) {
    const ext = extOf(f.rel)
    if (era) {
      const want = era.langFormat === 'lang' ? '.lang' : '.json'
      if (ext !== want) {
        add('warn', 'lang', f.rel, 'lang-format-era', `目标版本 ${targetMc} 的语言文件应为 ${want} 格式（1.13 起 .lang→.json；≤1.12.2 为 .lang）`)
      }
    }
    if (ext === '.json') {
      const r = jsonCache.get(f.rel)
      if (r && r.ok && r.value && typeof r.value === 'object') {
        const keys = Object.keys(r.value)
        if (f.rel.endsWith('en_us.json')) enKeys.push(...keys)
        if (!f.rel.endsWith('en_us.json') && enKeys.length > 0) {
          const missing = enKeys.filter(k => !(k in r.value)).slice(0, 20)
          if (missing.length > 0) {
            add('warn', 'lang', f.rel, 'lang-missing-keys', `相对 en_us.json 缺失 ${missing.length} 个键（示例: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}）`)
          }
        }
      }
    } else if (ext === '.lang') {
      const text = readUtf8(f.abs)
      let noSep = 0
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim()
        if (t === '' || t.startsWith('#') || t.startsWith('!')) continue
        if (!t.includes('=')) noSep++
      }
      if (noSep > 0) add('warn', 'lang', f.rel, 'lang-no-sep', `${noSep} 行缺少 = 分隔符`)
    }
  }
  stats.langKeys = enKeys.length

  // ── 音频 ───────────────────────────────────────────────
  const soundFiles = files.filter(f => /^assets\/[^/]+\/sounds\.json$/.test(f.rel) || f.rel === 'sounds.json')
  for (const f of soundFiles) {
    const r = jsonCache.get(f.rel)
    if (!r || !r.ok) continue
    const events = r.value
    if (!events || typeof events !== 'object' || Array.isArray(events)) {
      add('warn', 'audio', f.rel, 'sounds-root', 'sounds.json 根必须是事件对象')
      continue
    }
    const ns = f.rel.startsWith('assets/') ? f.rel.split('/')[1] : 'minecraft'
    for (const [evt, ev] of Object.entries(events)) {
      stats.soundEvents++
      if (!ev || typeof ev !== 'object' || !Array.isArray(ev.sounds)) {
        add('warn', 'audio', f.rel, 'sounds-event', `事件 ${evt} 缺少 sounds 数组`)
        continue
      }
      for (let i = 0; i < ev.sounds.length; i++) {
        const s = ev.sounds[i]
        const name = typeof s === 'string' ? s : (s && typeof s === 'object' && typeof s.name === 'string' ? s.name : null)
        if (!name) continue
        const oggRel = `assets/${ns}/sounds/${name.replace(/\.ogg$/i, '')}.ogg`
        if (!fileExists(root, oggRel)) {
          if (ns !== 'minecraft') add('error', 'audio', f.rel, 'sound-missing', `事件 ${evt} 引用音频 ${name} 不存在（期望 ${oggRel}）`, `sounds[${i}]`)
          else add('warn', 'audio', f.rel, 'sound-missing', `事件 ${evt} 引用音频 ${name} 不在包内（可能指向原版）`, `sounds[${i}]`)
        }
      }
    }
  }

  // ── 双通道同步（v14: knight_items vs armors_migrated）───
  if (packConfig && Array.isArray(packConfig.syncGroups)) {
    for (const [a, b] of packConfig.syncGroups) {
      if (typeof a !== 'string' || typeof b !== 'string') continue
      const listA = files.filter(f => f.rel.startsWith(`${a}/`))
      const listB = files.filter(f => f.rel.startsWith(`${b}/`))
      const mapB = new Map(listB.map(f => [f.rel.slice(b.length + 1), f.abs]))
      for (const fa of listA) {
        const sub = fa.rel.slice(a.length + 1)
        const fb = mapB.get(sub)
        if (fb && fs.readFileSync(fa.abs).toString('hex') !== fs.readFileSync(fb).toString('hex')) {
          add('warn', 'cit', fa.rel, 'sync-mismatch', `双通道同名文件内容不一致（${a} vs ${b}）——v14 教训：两处必须同步修改`, sub)
        }
      }
    }
  }

  // ── 日志诊断（log 模式）────────────────────────────────
  if (logText) diagnoseLog(logText, root, add, stats)

  // ── 汇总 ───────────────────────────────────────────────
  const bySeverity = { error: 0, warn: 0, info: 0 }
  for (const i of issues) bySeverity[i.severity]++
  stats.issuesBySeverity = bySeverity

  return {
    ok: bySeverity.error === 0,
    packDir,
    root,
    targetMc,
    era: era ? { version: targetMc, format: era.format, langFormat: era.langFormat, components: era.components, cit: era.cit } : null,
    eraError,
    packConfig: packConfig ? { id: packConfig.id ?? null, versions: packConfig.versions ?? null, syncGroups: packConfig.syncGroups ?? null, names: (packConfig.names || []).length } : null,
    stats,
    issues,
  }
}

/**
 * latest.log 诊断：把日志里的缺失/越界报错映射到包内文件。
 * @param {string} text 日志全文
 * @param {string} root 资源包根
 * @param {(severity: string, domain: string, file: string, rule: string, message: string, hint?: string) => void} add
 * @param {object} stats
 */
export function diagnoseLog(text, root, add, stats) {
  const has = (rel) => fileExists(root, rel)
  const PATTERNS = [
    {
      re: /Missing model: (?:[^:]+:)?([\w./+-]+)/g,
      rule: 'log-model',
      map: (id) => modelCandidates(id),
      missing: (id) => `日志报 Missing model: ${id}，包内也没有对应模型文件`,
      exists: (id) => `日志报 Missing model: ${id}，包内文件存在——检查该模型 JSON/父模型/引用链`,
    },
    {
      re: /Missing texture: (?:[^:]+:)?([\w./+-]+)/g,
      rule: 'log-texture',
      map: (id) => [textureRelOf(id)],
      missing: (id) => `日志报 Missing texture: ${id}，包内也没有对应纹理文件`,
      exists: (id) => `日志报 Missing texture: ${id}，包内文件存在——检查引用路径与命名空间`,
    },
    {
      re: /Failed to (?:load|parse) (?:model|blockstate|font|texture) ([^\s,]+)/g,
      rule: 'log-load-failed',
      map: (id) => (id.includes('texture') || id.includes('.png') ? [textureRelOf(id)] : modelCandidates(id)),
      missing: (id) => `日志报加载失败: ${id}，包内没有对应文件`,
      exists: (id) => `日志报加载失败: ${id}，包内文件存在——检查格式/结构`,
    },
  ]
  for (const p of PATTERNS) {
    p.re.lastIndex = 0
    let m
    while ((m = p.re.exec(text)) !== null) {
      stats.logMatches++
      const id = m[1]
      const cands = p.map(id)
      if (cands.some(rel => has(rel))) add('info', 'log', cands.find(rel => has(rel)), p.rule, p.exists(id))
      else add('error', 'log', cands[0], p.rule, p.missing(id), `日志原文: ${m[0].trim()}`)
    }
  }
  if (/Cannot compute translucency out of bounds: \[([-\d,]+)\] in (\d+)x(\d+)/.test(text)) {
    stats.logMatches++
    add('error', 'log', '', 'log-uv-bounds',
      '日志报 "Cannot compute translucency out of bounds"——模型面 UV 越出 0-16 网格（像素坐标 ×4 的典型症状，v14 玩家头马赛克案）',
      '把模型 UV 改回 0-16 网格')
  }
}
