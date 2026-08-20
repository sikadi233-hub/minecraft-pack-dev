/**
 * OptiFine / CIT .properties 解析器。java-properties 语义子集：
 *   - 注释：# 或 ! 开头
 *   - key=value（按第一个 = 切分；无 = 的行视为 key + 空值并告警）
 *   - 支持 \uXXXX 转义（解码键与值）
 *   - 记录 CRLF / BOM / 重复键（CIT 排障所需）
 * @module minecraft-pack-dev/lib/properties
 */

function unescape(text) {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * 解析 .properties 文本。
 * @param {string} text
 * @returns {{ entries: { key: string, value: string, line: number }[], warnings: { line: number, message: string }[], duplicateKeys: string[], crlf: boolean, bom: boolean }}
 */
export function parseProperties(text) {
  const bom = text.charCodeAt(0) === 0xFEFF
  const crlf = /\r/.test(text)
  const cleaned = bom ? text.slice(1) : text
  const lines = cleaned.split(/\r?\n/)
  /** @type {{ key: string, value: string, line: number }[]} */
  const entries = []
  /** @type {{ line: number, message: string }[]} */
  const warnings = []
  const seen = new Map()
  const duplicateKeys = []
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const lineNo = i + 1
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!')) continue
    const eq = raw.indexOf('=')
    if (eq < 0) {
      warnings.push({ line: lineNo, message: '行内没有 = 分隔符，按空值键处理' })
      const key = unescape(raw.trim())
      entries.push({ key, value: '', line: lineNo })
      if (seen.has(key)) duplicateKeys.push(key)
      seen.set(key, true)
      continue
    }
    const key = unescape(raw.slice(0, eq).trim())
    let value = raw.slice(eq + 1)
    value = value.replace(/^\s+/, '').replace(/\s+$/, '')
    entries.push({ key, value: unescape(value), line: lineNo })
    if (seen.has(key)) duplicateKeys.push(key)
    seen.set(key, true)
  }
  return { entries, warnings, duplicateKeys, crlf, bom }
}

/**
 * items= 值解析：按空白切分，检出逗号分隔（citresewn 报
 * "null is not in the item registry" 的根因）。
 * @param {string} value
 * @returns {{ items: string[], commaSeparated: boolean }}
 */
export function splitItems(value) {
  const commaSeparated = value.includes(',')
  const items = value.split(/[\s,]+/).filter(Boolean)
  return { items, commaSeparated }
}
