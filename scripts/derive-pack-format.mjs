#!/usr/bin/env node
/**
 * derive-pack-format.mjs — 从 Mojang 官方 artifact 推导 pack_format 表行。
 *
 * 为什么需要它：`lib/pack-format.js` 的 PACK_ENTRIES 曾经用手工记录/Wiki 抄写，
 * 结果把**数据包**格式号当成了**资源包**格式号（1.20.5–26.2 全部错位）。
 * 本脚本让表格可以随时从权威来源重新生成，而不是继续手改。
 *
 * ── 权威来源（与 lib/pack-format.js 头部注释一致）────────────────────────
 *   1. GET https://piston-meta.mojang.com/mc/game/version_manifest_v2.json
 *   2. 目标版本 → 该条目的 `url`（version json）
 *   3. version json 的 `downloads.client.url` → client.jar
 *   4. 读 client.jar 内**顶层 `version.json`** 的 `pack_version`：
 *        - 老形态：{"resource": 64, "data": 81}
 *        - 26.x 形态：{"resource_major": 97, "resource_minor": 1,
 *                      "data_major": 121, "data_minor": 0}
 *      `resource` / `resource_major` 即 pack.mcmeta 的 pack_format。
 *      （`data`/`data_major` 是数据包格式，不是资源包格式。）
 *
 * ── 用法 ────────────────────────────────────────────────────────────────
 *   node scripts/derive-pack-format.mjs                      # 默认核对全表版本
 *   node scripts/derive-pack-format.mjs 1.21.8 26.2 26.3      # 指定版本
 *   node scripts/derive-pack-format.mjs --json                # 输出 JSON
 *   node scripts/derive-pack-format.mjs --out rows.js         # 写文件
 *   node scripts/derive-pack-format.mjs --cache-dir D:\mcjars # 自定义缓存目录
 *
 * ── 运行要求（重要）────────────────────────────────────────────────────
 *   - **需要网络**：首次运行每个版本要下载一份 client.jar，**约 25–40MB/版本**。
 *     全表默认 17 个版本 ≈ 450MB 下载量 + 同等磁盘占用。
 *   - **离线可用**：只要 jar 已在缓存目录里，本脚本完全不联网（不请求 manifest、
 *     不请求 version json），直接读 jar。缓存目录默认 `%TEMP%/mc-format-jars`
 *     （Linux/macOS 为 `$TMPDIR/mc-format-jars`）。
 *   - 只用 Node 内置模块，无新增依赖。
 *   - **不要接进 `npm test`**：测试必须保持离线、快速。
 *
 * ── 已知不能回答的情况 ──────────────────────────────────────────────────
 *   - 1.13 以前的 client.jar **没有 `version.json`**（该字段 1.13 才引入）。
 *     脚本对此明确报 `no-version.json`，不会猜数值——请手工查 jar 内根
 *     `pack.mcmeta`（1.16.5 有）或沿用长期稳定表。
 *   - 1.13–1.20.4 的 `pack_version` 是 {"resource","data"}；1.20.5+ 起
 *     resource 与 data 开始分家，26.x 起变成 minor 版本对。脚本两种都认。
 *   - 某些 client.jar 的 CDN 不稳定，会截断下载。脚本对每个下载校验
 *     zip 可读性（能列出条目），失败时报 `download-failed`，不会写坏缓存。
 *
 * @module minecraft-pack-dev/scripts/derive-pack-format
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

/** 默认核对清单：与 lib/pack-format.js 的 PACK_ENTRIES 一致。 */
export const DEFAULT_VERSIONS = [
  '1.7.10', '1.12.2', '1.16.5', '1.20.1', '1.20.2', '1.20.3', '1.20.5',
  '1.21', '1.21.2', '1.21.4', '1.21.5', '1.21.6', '1.21.7', '1.21.8',
  '1.21.11', '26.2', '26.3',
]

const downloadCache = new Map()

function defaultCacheDir() {
  return path.join(os.tmpdir(), 'mc-format-jars')
}

async function fetchWithRetry(url, { tries = 4, timeoutMs = 120000 } = {}) {
  if (downloadCache.has(url)) return downloadCache.get(url)
  let lastErr
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const buf = Buffer.from(await res.arrayBuffer())
      downloadCache.set(url, buf)
      return buf
    } catch (err) {
      lastErr = err
      if (attempt < tries) await new Promise(r => setTimeout(r, 1500 * attempt))
    }
  }
  throw new Error(`下载失败 ${url}: ${lastErr && lastErr.message}`)
}

/**
 * 读 zip 内指定条目。zip 中央目录从尾部扫描，不整个解压。
 * @param {string} zipPath
 * @param {string} entryName 精确匹配（'version.json' 即顶层）
 * @returns {Buffer|null}
 */
function readZipEntry(zipPath, entryName) {
  const fd = fs.openSync(zipPath, 'r')
  try {
    const size = fs.fstatSync(fd).size
    const tailLen = Math.min(size, 66_000)
    const tail = Buffer.alloc(tailLen)
    fs.readSync(fd, tail, 0, tailLen, size - tailLen)

    // EOCD: 0x06054b50
    let eocd = -1
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
    }
    if (eocd < 0) throw new Error('不是有效的 zip（未找到 EOCD）')

    const total = tail.readUInt16LE(eocd + 10)
    const cdSize = tail.readUInt32LE(eocd + 12)
    const cdOffset = tail.readUInt32LE(eocd + 16)
    if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      throw new Error('ZIP64 不支持（client.jar 不应出现）')
    }

    const cd = Buffer.alloc(cdSize)
    fs.readSync(fd, cd, 0, cdSize, cdOffset)

    let p = 0
    const want = entryName.replace(/\\/g, '/')
    while (p + 46 <= cd.length) {
      if (cd.readUInt32LE(p) !== 0x02014b50) break
      const method = cd.readUInt16LE(p + 10)
      const compSize = cd.readUInt32LE(p + 20)
      const nameLen = cd.readUInt16LE(p + 28)
      const extraLen = cd.readUInt16LE(p + 30)
      const commentLen = cd.readUInt16LE(p + 32)
      const localOffset = cd.readUInt32LE(p + 42)
      const name = cd.toString('utf8', p + 46, p + 46 + nameLen)

      if (name === want) {
        // local file header: 30 + nameLen + extraLen
        const lh = Buffer.alloc(30)
        fs.readSync(fd, lh, 0, 30, localOffset)
        if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error('local header 损坏')
        const lNameLen = lh.readUInt16LE(26)
        const lExtraLen = lh.readUInt16LE(28)
        const dataStart = localOffset + 30 + lNameLen + lExtraLen
        const raw = Buffer.alloc(compSize)
        fs.readSync(fd, raw, 0, compSize, dataStart)
        if (method === 0) return raw
        if (method === 8) return zlib.inflateRawSync(raw)
        throw new Error(`不支持的压缩方式 ${method}`)
      }
      p += 46 + nameLen + extraLen + commentLen
    }
    return null
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * 解析 pack_version 对象为 { format, minor, data, dataMinor, shape }。
 * @param {object} pv
 */
export function parsePackVersion(pv) {
  // 1.16.x 及更早：pack_version 就是一个裸整数（资源包格式 == 数据包格式）。
  if (typeof pv === 'number') {
    return {
      shape: 'scalar',
      format: pv,
      minor: 0,
      dataMajor: pv,
      dataMinor: 0,
      data: pv,
    }
  }
  if (pv === null || typeof pv !== 'object') return null
  if (typeof pv.resource_major === 'number') {
    return {
      shape: 'major-minor',
      format: pv.resource_major,
      minor: typeof pv.resource_minor === 'number' ? pv.resource_minor : 0,
      dataMajor: pv.data_major ?? null,
      dataMinor: pv.data_minor ?? null,
      data: pv.data_major ?? null,
    }
  }
  if (typeof pv.resource === 'number') {
    return {
      shape: 'resource-data',
      format: pv.resource,
      minor: 0,
      dataMajor: typeof pv.data === 'number' ? pv.data : null,
      dataMinor: 0,
      data: pv.data ?? null,
    }
  }
  return null
}

/**
 * 解析一个版本。永远不抛错——失败时返回 { version, status, error }。
 * @param {string} version
 * @param {{ cacheDir: string, manifest?: object, offline?: boolean }} opts
 */
export async function deriveOne(version, { cacheDir, manifest = null, offline = false }) {
  const jarPath = path.join(cacheDir, `mc-${version}-client.jar`)
  const cached = fs.existsSync(jarPath)

  if (!cached) {
    if (offline) {
      return { version, status: 'not-cached', error: `离线模式且无缓存 jar：${jarPath}` }
    }
    try {
      const man = manifest ?? JSON.parse((await fetchWithRetry(MANIFEST_URL)).toString('utf8'))
      const entry = (man.versions || []).find(v => v.id === version)
      if (!entry) return { version, status: 'unknown-version', error: `version_manifest 中无 ${version}` }
      const vjson = JSON.parse((await fetchWithRetry(entry.url)).toString('utf8'))
      const clientUrl = vjson?.downloads?.client?.url
      if (!clientUrl) return { version, status: 'no-client-download', error: 'version json 无 downloads.client' }
      const buf = await fetchWithRetry(clientUrl)
      fs.mkdirSync(cacheDir, { recursive: true })
      const tmp = `${jarPath}.part`
      fs.writeFileSync(tmp, buf)
      // 下载校验：能读到中央目录才算完整，否则不污染缓存
      try { readZipEntry(tmp, 'version.json') } catch (err) {
        fs.rmSync(tmp, { force: true })
        return { version, status: 'download-failed', error: `zip 不可读（可能被截断）：${err.message}` }
      }
      fs.renameSync(tmp, jarPath)
    } catch (err) {
      return { version, status: 'download-failed', error: err.message }
    }
  }

  let raw
  try {
    raw = readZipEntry(jarPath, 'version.json')
  } catch (err) {
    return { version, status: 'jar-unreadable', cachePath: jarPath, error: err.message }
  }
  if (raw === null) {
    return { version, status: 'no-version.json', cachePath: jarPath, error: '该版 client.jar 无顶层 version.json（1.13 以前）' }
  }

  let parsed
  try { parsed = JSON.parse(raw.toString('utf8')) } catch (err) {
    return { version, status: 'bad-json', cachePath: jarPath, error: err.message }
  }
  const pv = parsePackVersion(parsed.pack_version)
  if (!pv) {
    return { version, status: 'unexpected-pack-version', cachePath: jarPath, raw: parsed.pack_version ?? null }
  }

  return {
    version,
    status: 'ok',
    cachePath: jarPath,
    fromCache: cached,
    id: parsed.id ?? null,
    shape: pv.shape,
    format: pv.format,
    minor: pv.minor,
    data: pv.data,
    dataMajor: pv.dataMajor,
    dataMinor: pv.dataMinor,
  }
}

/** 把结果格式化成 PACK_ENTRIES 里可粘贴的行。 */
export function formatRows(results) {
  const lines = []
  for (const r of results) {
    if (r.status !== 'ok') {
      lines.push(`// ${r.version}: 无法验证（${r.status}）${r.error ? ' — ' + r.error : ''}`)
      continue
    }
    const minorNote = r.minor ? ` resource_minor=${r.minor}` : ''
    lines.push(`// ${r.version}: format=${r.format}${minorNote}  [data=${r.dataMajor}.${r.dataMinor ?? 0}]  (${r.shape}${r.fromCache ? ', 缓存' : ''})`)
  }
  return lines.join('\n')
}

/** 把结果格式化成可直接贴进 lib/pack-format.js 的条目草稿。 */
export function formatEntries(results) {
  return results.map(r => {
    if (r.status !== 'ok') return `// ${r.version}: ${r.status} — ${r.error ?? ''}`
    const minor = r.minor ? `（resource_minor=${r.minor}）` : ''
    return [
      '  {',
      `    version: '${r.version}', format: ${r.format}, langFormat: 'json', itemModels: 'items-json', blockModels: 'blocks-json',`,
      `    fontSystem: 'bitmap', atlas: true, particles: 'json', guiSprites: 'split',`,
      `    cit: 'optifine', lore: false, components: true, distribution: 'spm',`,
      `    note: 'jar 核对：resource=${r.format}${minor}、data=${r.dataMajor}.${r.dataMinor ?? 0}',`,
      '  },',
    ].join('\n')
  }).join('\n')
}

function parseArgs(argv) {
  const opts = { versions: [], json: false, entries: false, out: null, cacheDir: defaultCacheDir(), offline: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') opts.json = true
    else if (a === '--entries') opts.entries = true
    else if (a === '--offline') opts.offline = true
    else if (a === '--out') opts.out = argv[++i]
    else if (a === '--cache-dir') opts.cacheDir = argv[++i]
    else if (a === '--help' || a === '-h') opts.help = true
    else if (!a.startsWith('-')) opts.versions.push(a)
  }
  if (opts.versions.length === 0) opts.versions = DEFAULT_VERSIONS.slice()
  return opts
}

const HELP = `derive-pack-format.mjs — 从 client.jar 推导 pack_format 表行

用法:
  node scripts/derive-pack-format.mjs [版本...] [选项]

选项:
  --json               输出 JSON
  --entries            输出可粘贴的 PACK_ENTRIES 条目草稿
  --out <file>         把输出写入文件
  --cache-dir <dir>    jar 缓存目录（默认 ${defaultCacheDir()}）
  --offline            只用已缓存 jar，绝不联网
  -h, --help           显示本帮助

需要网络（首次运行），每版本约 25–40MB 的 client.jar 下载。
jar 已在缓存目录时完全离线可跑。不要把它接进 npm test。`

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) { process.stdout.write(HELP + '\n'); return }

  let manifest = null
  if (!opts.offline && opts.versions.some(v => !fs.existsSync(path.join(opts.cacheDir, `mc-${v}-client.jar`)))) {
    try {
      manifest = JSON.parse((await fetchWithRetry(MANIFEST_URL)).toString('utf8'))
    } catch (err) {
      process.stderr.write(`[warn] 取 version_manifest 失败，退化为只用缓存：${err.message}\n`)
    }
  }

  const results = []
  for (const v of opts.versions) {
    results.push(await deriveOne(v, { cacheDir: opts.cacheDir, manifest, offline: opts.offline }))
  }

  let text
  if (opts.json) text = JSON.stringify(results, null, 2) + '\n'
  else if (opts.entries) text = formatEntries(results) + '\n'
  else {
    text = [`# pack_format（resource）推导结果 — 缓存目录 ${opts.cacheDir}`, '', formatRows(results), ''].join('\n')
  }

  if (opts.out) {
    fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true })
    fs.writeFileSync(opts.out, text, 'utf8')
    process.stdout.write(`写入 ${path.resolve(opts.out)}\n`)
  } else {
    process.stdout.write(text)
  }

  const bad = results.filter(r => r.status !== 'ok')
  if (bad.length > 0) {
    process.stderr.write(`\n[warn] ${bad.length}/${results.length} 个版本无法验证：${bad.map(b => `${b.version}(${b.status})`).join(', ')}\n`)
    process.exitCode = 2
  }
}

// 仅在被当作脚本执行时跑 main（便于测试 import）。
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (isMain) {
  main().catch(err => { process.stderr.write(String(err && err.stack || err) + '\n'); process.exit(1) })
}
