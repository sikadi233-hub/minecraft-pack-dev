/**
 * 严格 JSON 工具：带行列号的解析错误、BOM 检测、重复键收集。
 * @module minecraft-pack-dev/lib/json
 */

/** UTF-8 BOM 检测。 */
export function hasBom(text) {
  return typeof text === 'string' && text.charCodeAt(0) === 0xFEFF
}

/** 去掉首字符 BOM。 */
export function stripBom(text) {
  return hasBom(text) ? text.slice(1) : text
}

/**
 * 由字符偏移计算 1 起始的行列号。
 * @param {string} text
 * @param {number} position
 * @returns {{ line: number, column: number }}
 */
export function lineColOf(text, position) {
  const pos = Math.max(0, Math.min(position, text.length))
  let line = 1
  let lineStart = 0
  for (let i = 0; i < pos; i++) {
    if (text.charCodeAt(i) === 10) {
      line++
      lineStart = i + 1
    }
  }
  return { line, column: pos - lineStart + 1 }
}

/**
 * 严格 JSON.parse：成功返回 { ok: true, value }；
 * 失败返回 { ok: false, error: { message, line, column, position } }。
 * @param {string} text 原始文本（内部自动 strip BOM 后解析）
 * @param {string} [file] 仅用于错误信息上下文
 * @returns {{ ok: boolean, value?: any, error?: { message: string, line: number, column: number, position: number } }}
 */
export function parseJson(text, file = '<json>') {
  const cleaned = stripBom(text)
  try {
    return { ok: true, value: JSON.parse(cleaned) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // V8: "Unexpected token } in JSON at position 12" / "Expected ... at position 1 (line 1 column 2)"
    let position = -1
    const m = msg.match(/position (\d+)/)
    if (m) position = Number(m[1])
    if (position < 0 && /Unexpected end of JSON input/.test(msg)) position = cleaned.length
    const lc = position >= 0 ? lineColOf(cleaned, position) : { line: -1, column: -1 }
    return {
      ok: false,
      error: {
        message: msg,
        position,
        line: lc.line,
        column: lc.column,
      },
    }
  }
}

/**
 * 从原始 JSON 文本检测重复键（JSON.parse 会静默折叠重复键，必须在文本层扫描）。
 * 轻量扫描器：逐字符跟踪字符串/对象/数组上下文，只记录「键字符串 + 紧随的 :」。
 * @param {string} text 原始 JSON 文本
 * @returns {{ path: string, key: string, count: number }[]}
 */
export function collectDuplicateKeys(text) {
  const out = []
  /** @type {{ kind: 'obj' | 'arr', path: string, keys: Map<string, number>, lastKey: string|null }[]} */
  const stack = []
  const n = text.length
  let i = 0
  let inStr = false
  let pendingKey = null
  const pushPath = () => {
    const parent = stack[stack.length - 1]
    if (parent && parent.kind === 'obj' && parent.lastKey !== null) {
      return `${parent.path || '$'}.${parent.lastKey}`
    }
    return parent ? parent.path : '$'
  }
  while (i < n) {
    const c = text[i]
    if (inStr) {
      if (c === '\\') { i += 2; continue }
      if (c === '"') inStr = false
      i++
      continue
    }
    if (c === '"') {
      let j = i + 1
      let s = ''
      while (j < n && text[j] !== '"') {
        if (text[j] === '\\') { j += 2; continue }
        s += text[j]
        j++
      }
      pendingKey = s
      i = j + 1
      continue
    }
    if (c === '{') { stack.push({ kind: 'obj', path: pushPath(), keys: new Map(), lastKey: null }); i++; continue }
    if (c === '[') { stack.push({ kind: 'arr', path: pushPath(), keys: null, lastKey: null }); i++; continue }
    if (c === '}' || c === ']') { if (stack.length) stack.pop(); i++; continue }
    if (c === ':') {
      const frame = stack[stack.length - 1]
      if (frame && frame.kind === 'obj' && pendingKey !== null) {
        const count = frame.keys.get(pendingKey) ?? 0
        frame.keys.set(pendingKey, count + 1)
        frame.lastKey = pendingKey
        if (count + 1 === 2) out.push({ path: frame.path || '$', key: pendingKey, count: count + 1 })
      }
      pendingKey = null
      i++
      continue
    }
    i++
  }
  return out
}
