#!/usr/bin/env node
// check-doc-links.mjs — minecraft-pack-dev 文档链接核对脚本
//
// 纯 Node 标准库 + 内置 fetch（无第三方依赖）。扫描 README.md 与 assets/**/*.md：
//   - http(s) 链接 → HEAD（405/501 或非 2xx/3xx 时回退 GET，Range: bytes=0-0）
// 失败分级：BROKEN（确定性失效：404/410/5xx）→ exit 1；
//           UNVERIFIABLE（超时/403 限流/网络错误等无法定论）→ 不导致失败退出。
// 退出码：0 = 无 BROKEN；1 = 存在 BROKEN；2 = 参数错误或网络整体不可用。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION = '0.1.0'
const DEFAULT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const USAGE = `check-doc-links v${VERSION} — 扫描 markdown 文档，核对 http(s) 链接

用法: node scripts/check-doc-links.mjs [选项]

扫描范围: <repo>/**/*.md（默认 ${DEFAULT_DIR}，含 README.md 与 assets/）

选项:
  --dir <path>    扫描根目录（默认仓库根）
  --timeout <ms>  单请求超时毫秒（默认 10000）
  --offline       不联网，只打印待检清单
  --json          输出机器可读 JSON（stdout 仅 JSON）
  --help          显示本帮助

退出码: 0 = 无 BROKEN（UNVERIFIABLE 可存在）; 1 = 存在 BROKEN; 2 = 参数错误或网络整体不可用`

// ---------------- 提取（纯函数，供单测） ----------------

// 全角字符与全角括号必须进终止符（与 minecraft-dev 同款正则）
const URL_RE = /https?:\/\/[^\s（(）)\]}>\x27"\x60，。；：、【】「」]+/g

function splitLines(text) {
  return String(text).split(/\r?\n/)
}

/** 提取全部 http(s) URL，返回 [{ value, line }]（1 起始行号；统一做尾部裁剪） */
export function extractLinks(text) {
  const out = []
  const lines = splitLines(text)
  for (let i = 0; i < lines.length; i++) {
    URL_RE.lastIndex = 0
    let m
    while ((m = URL_RE.exec(lines[i])) !== null) {
      let value = m[0].replace(/[.,;:)]+$/, '')
      if (value.includes('<')) continue // 占位符模板（<slug> 等）不是真实链接
      if (value) out.push({ value, line: i + 1 })
    }
  }
  return out
}

// ---------------- 分级 ----------------

/** HTTP 状态 → ok / broken / unverifiable。404/410/5xx=确定性失效；401/403/408/429=无法定论 */
export function classify(status) {
  if (typeof status === 'number' && status >= 200 && status < 400) return 'ok'
  if (status === 401 || status === 403 || status === 408 || status === 429) return 'unverifiable'
  return 'broken'
}

// ---------------- 请求 ----------------

function errMsg(e) {
  if (!e) return 'unknown'
  if (e.name === 'AbortError' || e.name === 'TimeoutError') return 'timeout'
  const code = e.cause && e.cause.code ? e.cause.code : ''
  return code ? `${e.name || 'Error'}: ${code}` : (e.message || String(e))
}

async function httpRequest(url, { method = 'GET', headers = {}, timeout = 10000, fetchImpl = globalThis.fetch } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetchImpl(url, { method, headers, signal: controller.signal })
    let body = null
    try { body = await res.text() } catch { /* HEAD 等无 body 场景 */ }
    return { status: res.status, statusText: res.statusText || '', body }
  } catch (e) {
    return { error: e }
  } finally {
    clearTimeout(timer)
  }
}

/** 幂等请求失败（网络错误或 5xx）重试 1 次 */
async function withRetry(fn) {
  let r = await fn()
  for (let i = 0; i < 1 && (r.error || r.status >= 500); i++) r = await fn()
  return r
}

/** 普通 URL 校验：HEAD；非 2xx/3xx（含 405/501 拒绝）回退 GET（Range: bytes=0-0）复核 */
export async function checkUrl(url, timeout = 10000, fetchImpl = globalThis.fetch) {
  const req = (method, headers = {}) => withRetry(() => httpRequest(url, { method, headers, timeout, fetchImpl }))
  let r = await req('HEAD')
  if (!r.error && r.status >= 200 && r.status < 400) {
    return { status: 'ok', httpStatus: r.status, reason: r.statusText || `HTTP ${r.status}` }
  }
  const g = await req('GET', { Range: 'bytes=0-0' })
  if (!g.error) {
    const c = classify(g.status)
    return { status: c, httpStatus: g.status, reason: g.statusText || `HTTP ${g.status}` }
  }
  if (r.error) return { status: 'unverifiable', httpStatus: null, reason: `网络错误: ${errMsg(r.error)}` }
  const c = classify(r.status)
  return { status: c, httpStatus: r.status, reason: r.statusText || `HTTP ${r.status}` }
}

// ---------------- 扫描与核对 ----------------

function scanMarkdown(dir) {
  const out = []
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true })
    } catch (e) {
      throw new Error(`读取目录失败 ${cur}: ${e.message}`)
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const ent of entries) {
      const p = path.join(cur, ent.name)
      if (ent.isDirectory()) stack.push(p)
      else if (ent.isFile() && ent.name.endsWith('.md')) out.push(p)
    }
  }
  return out.sort()
}

function today() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 主流程：返回退出码（0 无 BROKEN / 1 有 BROKEN / 2 参数错误或网络整体不可用）。
 * ctx.fetch / ctx.log 可注入（单测用 fake fetch）。
 */
export async function main(argv, ctx = {}) {
  const fetchImpl = ctx.fetch || globalThis.fetch
  const log = ctx.log || console.log
  let dir = DEFAULT_DIR
  let timeout = 10000
  let json = false
  let offline = false
  let help = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help') { help = true; continue }
    if (arg === '--json') { json = true; continue }
    if (arg === '--offline') { offline = true; continue }
    const eq = arg.indexOf('=')
    const name = eq >= 0 ? arg.slice(0, eq) : arg
    const inline = eq >= 0 ? arg.slice(eq + 1) : undefined
    const take = () => {
      if (inline !== undefined) return inline
      const v = argv[i + 1]
      if (v === undefined || v.startsWith('--')) throw new Error(`选项 ${name} 缺少参数`)
      return v
    }
    switch (name) {
      case '--dir': dir = path.resolve(take()); if (inline === undefined) i++; break
      case '--timeout': {
        const v = Number(take())
        if (inline === undefined) i++
        if (!Number.isFinite(v) || v < 100) throw new Error(`选项 --timeout 需要 >=100 的数字`)
        timeout = v
        break
      }
      default: throw new Error(`未知选项 ${arg}`)
    }
  }
  if (help) { log(USAGE); return 0 }

  let files
  try {
    files = scanMarkdown(dir)
  } catch (e) {
    log(`check-doc-links ${today()} — 扫描失败: ${e.message}`)
    return 2
  }
  const relPath = (p) => {
    const r = path.relative(process.cwd(), p)
    return r.startsWith('..') ? p : r
  }

  const occ = [] // { file, line, value }
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    for (const l of extractLinks(text)) occ.push({ file: relPath(f), line: l.line, value: l.value })
  }
  const units = new Map()
  for (const o of occ) {
    if (!units.has(o.value)) units.set(o.value, [])
    units.get(o.value).push(o)
  }

  const header = `check-doc-links ${today()} — 扫描 ${files.length} 个 .md，链接 ${occ.length} 个（去重 ${units.size}）`
  if (offline) {
    if (json) {
      log(JSON.stringify({ date: today(), mode: 'offline', summary: { files: files.length, linksTotal: occ.length, linksUnique: units.size }, pending: [...units.entries()].map(([url, locs]) => ({ url, locations: locs.map(l => ({ file: l.file, line: l.line })) })) }, null, 2))
    } else {
      log(header)
      log('待检清单（--offline，未联网）:')
      for (const [url, locs] of units) log(`  ${locs[0].file}:${locs[0].line}  ${url}`)
    }
    return 0
  }

  const results = new Map()
  const byLoc = (a, b) => a.file.localeCompare(b.file) || a.line - b.line
  let next = 0
  const n = Math.min(8, units.size)
  await Promise.all([...Array(n)].map(async () => {
    for (;;) {
      const idx = next++
      if (idx >= units.size) return
      const [url, locs] = [...units.entries()][idx]
      const r = await checkUrl(url, timeout, fetchImpl)
      results.set(url, { url, status: r.status, httpStatus: r.httpStatus ?? null, reason: r.reason ?? '', locations: locs })
    }
  }))

  const broken = [...results.values()].filter(e => e.status === 'broken').sort(byLoc)
  const unverifiable = [...results.values()].filter(e => e.status === 'unverifiable').sort(byLoc)
  const networkFailed = [...results.values()].filter(e => e.status === 'unverifiable' && e.httpStatus === null).length
  let exitCode = 0
  if (broken.length > 0) exitCode = 1
  else if (results.size > 0 && networkFailed === results.size) exitCode = 2

  const fmt = (e) => {
    const tag = e.httpStatus ?? '--'
    const lines = [`  ${e.locations[0].file}:${e.locations[0].line}  ${e.url}  [${tag}]  ${e.reason}`]
    for (let i = 1; i < e.locations.length; i++) lines.push(`    （同项另见 ${e.locations[i].file}:${e.locations[i].line}）`)
    return lines.join('\n')
  }
  if (json) {
    log(JSON.stringify({ date: today(), summary: { files: files.length, linksTotal: occ.length, linksUnique: units.size }, broken, unverifiable, exitCode }, null, 2))
    return exitCode
  }
  log(header)
  if (broken.length) {
    log(`BROKEN（${broken.length}）:`)
    for (const e of broken) log(fmt(e))
  }
  if (unverifiable.length) {
    log(`UNVERIFIABLE（${unverifiable.length}）:`)
    for (const e of unverifiable) log(fmt(e))
  }
  if (!broken.length && !unverifiable.length) log('无 BROKEN 与 UNVERIFIABLE，全部通过')
  else if (exitCode === 2) log('全部请求无法建立连接（网络整体不可用），按 exit 2 处理，避免误报')
  return exitCode
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => {
    process.exit(code)
  }).catch((e) => {
    console.error(`check-doc-links 意外错误: ${e && e.stack ? e.stack : e}`)
    process.exit(2)
  })
}
