/**
 * mc_pack_build 实现：source + overlays/<版本>/ 组装 → pack.mcmeta 注入 →
 * lang 格式转换（.json→.lang，≤1.12.2）→ LF/BOM 规范化 → zip 产出。
 * fix 模式：大小写重名重命名（低风险可逆）；其余问题只报告。
 * @module minecraft-pack-dev/lib/build
 */

import fs from 'node:fs'
import path from 'node:path'
import { writeZip } from './zip.js'
import { resolveEra, SUPPORTED_VERSIONS, isKnownVersion } from './pack-format.js'
import { parseJson, stripBom } from './json.js'
import { validatePack } from './validate.js'

const TEXT_EXT = new Set(['.json', '.properties', '.lang', '.mcmeta', '.txt', '.md', '.toml', '.yml'])

function walk(dir, base = '') {
  const out = []
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of entries) {
    if (ent.name === '.git' || ent.name === '.DS_Store' || ent.name === '.gitkeep') continue
    const rel = base ? `${base}/${ent.name}` : ent.name
    const abs = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(abs, rel))
    else if (ent.isFile()) out.push({ rel, abs })
  }
  return out
}

const LANG_NAME_MAP = { en_us: 'en_US', zh_cn: 'zh_CN', en_gb: 'en_GB', zh_tw: 'zh_TW', ja_jp: 'ja_JP' }

/** 现代 json 键 → 老式 .lang 键（item/block/tile 加 .name 后缀） */
function langKeyToLegacy(key) {
  const m = key.match(/^(item|block|tile)\.([^.]+)$/)
  return m ? `${key}.name` : key
}

/** .json 语言文件 → .lang 文本 */
export function convertLangJsonToLang(json, file) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`${file}: 语言 JSON 必须是键值对象`)
  }
  const lines = []
  for (const [k, v] of Object.entries(json)) {
    lines.push(`${langKeyToLegacy(k)}=${v}`)
  }
  return lines.join('\n') + '\n'
}

function normalizeText(data, isJson) {
  let text = data.toString('utf8').replace(/\r\n?/g, '\n')
  if (isJson) text = stripBom(text)
  return Buffer.from(text, 'utf8')
}

/**
 * 大小写重名处理方案（纯函数）：返回 { warnings, renamed: Map<old,new> }。
 * fix=true 时除每组第一个外全部重命名加 .dup 后缀；否则仅警告。
 * @param {string[]} rels
 * @param {boolean} fix
 * @returns {{ warnings: string[], renamed: Map<string, string> }}
 */
export function planCaseDuplicates(rels, fix) {
  const warnings = []
  /** @type {Map<string, string>} */
  const renamed = new Map()
  const lowerMap = new Map()
  for (const rel of rels) {
    const k = rel.toLowerCase()
    if (!lowerMap.has(k)) lowerMap.set(k, [])
    lowerMap.get(k).push(rel)
  }
  for (const list of lowerMap.values()) {
    if (list.length <= 1) continue
    for (const rel of list.slice(1)) {
      if (fix) {
        const target = rel + '.dup'
        renamed.set(rel, target)
        warnings.push(`fix: 大小写重名 ${rel} → ${target}`)
      } else {
        warnings.push(`大小写不敏感重名（fix=true 可自动重命名）: ${list.join(' / ')}`)
      }
    }
  }
  return { warnings, renamed }
}

/**
 * 组装分版资源包。
 * @param {{ packDir: string, versions?: string[]|null, outDir?: string|null, fix?: boolean, failOnError?: boolean }} opts
 * @returns {object} { ok, packDir, outDir, id, built, errors, warnings, validateReport }
 */
export function buildPack(opts) {
  const { packDir = '', versions = null, outDir = null, fix = false, failOnError = false } = opts
  const errors = []
  const sourceRoot = fs.existsSync(path.join(packDir, 'source')) ? path.join(packDir, 'source') : packDir

  let config = null
  const configRel = 'pack.config.json'
  if (fs.existsSync(path.join(packDir, configRel))) {
    const r = parseJson(fs.readFileSync(path.join(packDir, configRel), 'utf8'), configRel)
    if (r.ok && r.value && typeof r.value === 'object') config = r.value
  }

  const id = (config && config.id) || path.basename(packDir)
  const description = (config && config.description) || `${id} resource pack`
  const versionsList = versions || (config && Array.isArray(config.versions) && config.versions.length ? config.versions : null) || SUPPORTED_VERSIONS

  for (const v of versionsList) {
    if (!isKnownVersion(v)) errors.push(`不支持的版本 ${JSON.stringify(v)}；支持: ${SUPPORTED_VERSIONS.join(', ')}`)
  }
  if (errors.length > 0) return { ok: false, packDir, outDir, id, built: [], errors }

  // failOnError：先跑一次结构校验（不带 targetMc，只拦 ERROR 级）
  let validateReport = null
  if (failOnError) {
    validateReport = validatePack({ packDir })
    if (!validateReport.ok) {
      const errs = validateReport.issues.filter(i => i.severity === 'error').map(i => `${i.file} (${i.rule}): ${i.message}`)
      return { ok: false, packDir, outDir, id, built: [], errors: ['failOnError 校验未通过：', ...errs.slice(0, 20)], validateReport }
    }
  }

  const outRoot = outDir || path.join(packDir, 'dist')
  const built = []
  const globalWarnings = []

  for (const version of versionsList) {
    const era = resolveEra(version)
    /** @type {Map<string, Buffer>} */
    const map = new Map()
    const warnings = []
    const sourceFiles = walk(sourceRoot)
    for (const f of sourceFiles) {
      // 非脚手架布局（sourceRoot === packDir）时排除构建产物与配置
      if (sourceRoot === packDir && (f.rel === 'pack.config.json' || f.rel === 'README.md' || f.rel.startsWith('overlays/') || f.rel.startsWith('dist/'))) continue
      const data = fs.readFileSync(f.abs)
      map.set(f.rel, data)
    }
    // overlay 覆盖（冲突记警告）
    const overlayDir = path.join(packDir, 'overlays', version)
    if (fs.existsSync(overlayDir)) {
      for (const f of walk(overlayDir)) {
        if (map.has(f.rel)) {
          const prev = map.get(f.rel)
          if (prev.toString('hex') !== fs.readFileSync(f.abs).toString('hex')) {
            warnings.push(`overlay ${version} 覆盖 source/${f.rel}（内容不同）`)
          }
        }
        map.set(f.rel, fs.readFileSync(f.abs))
      }
    }

    // lang 转换：老时代 .json → .lang
    if (era.langFormat === 'lang') {
      const langEntries = [...map.entries()].filter(([rel]) => /^assets\/[^/]+\/lang\/.+\.json$/.test(rel))
      for (const [rel, data] of langEntries) {
        const parsed = parseJson(data.toString('utf8'), rel)
        if (!parsed.ok) {
          errors.push(`${version}: 语言文件 ${rel} JSON 解析失败（${parsed.error.message}）`)
          continue
        }
        const base = rel.split('/').pop().replace(/\.json$/, '')
        const legacyName = (LANG_NAME_MAP[base] || base) + '.lang'
        const legacyRel = rel.replace(/[^/]+$/, legacyName)
        let text
        try {
          text = convertLangJsonToLang(parsed.value, rel)
        } catch (e) {
          errors.push(`${version}: ${rel} 转换失败: ${e.message}`)
          continue
        }
        map.delete(rel)
        map.set(legacyRel, Buffer.from(text, 'utf8'))
      }
    }

    // pack.mcmeta 注入
    map.set('pack.mcmeta', Buffer.from(JSON.stringify({ pack: { pack_format: era.format, description } }, null, 2) + '\n', 'utf8'))

    // 文本规范化：LF + json BOM 清理（build 恒做，无需 fix 开关）
    for (const [rel, data] of [...map.entries()]) {
      const ext = rel.split('.').pop()
      if (TEXT_EXT.has(`.${ext}`)) {
        map.set(rel, normalizeText(data, ext === 'json'))
      }
    }

    // 大小写重名：fix 模式重命名，否则警告
    const { warnings: dupWarnings, renamed } = planCaseDuplicates([...map.keys()], fix)
    warnings.push(...dupWarnings)
    for (const [old, target] of renamed) {
      map.set(target, map.get(old))
      map.delete(old)
    }

    // 确定性排序 + 打包
    const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([p, d]) => ({ path: p, data: d }))
    const zipOut = path.join(outRoot, version, `${id}.zip`)
    fs.mkdirSync(path.dirname(zipOut), { recursive: true })
    fs.writeFileSync(zipOut, writeZip(entries))
    built.push({
      version,
      format: era.format,
      zipPath: zipOut,
      fileCount: entries.length,
      warnings,
    })
    globalWarnings.push(...warnings.map(w => `[${version}] ${w}`))
  }

  return {
    ok: errors.length === 0,
    packDir,
    outDir: outRoot,
    id,
    built,
    errors,
    warnings: globalWarnings,
    validateReport,
  }
}
