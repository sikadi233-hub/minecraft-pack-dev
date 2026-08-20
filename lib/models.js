/**
 * 模型结构校验（纯结构，不做文件系统检查——存在性由 validate 处理）。
 * 覆盖：模型 JSON（UV 0-16 网格、parent 引用、textures 引用收集）、
 * 1.21.4+ items/*.json 与 blocks/*.json、blockstates variants/multipart、
 * parent 链循环检测。
 *
 * UV 规则（MoonLight v14 教训）：模型面 UV 必须落在 0-16 网格内；
 * 用像素坐标（×4）会越界并报
 * "Cannot compute translucency out of bounds: [64,0,96,32] in 64x64"。
 * @module minecraft-pack-dev/lib/models
 */

const FACE_NAMES = ['north', 'south', 'east', 'west', 'up', 'down']
const KNOWN_ITEM_TYPES = ['model', 'range_dispatch', 'using_item', 'special']

/**
 * 检查一个模型 JSON 的结构。
 * @param {any} value 已解析的 JSON
 * @returns {{ issues: { severity: string, rule: string, message: string }[], textureRefs: string[], modelRefs: string[] }}
 */
export function checkModelStructure(value) {
  const issues = []
  /** @type {string[]} */
  const textureRefs = []
  /** @type {string[]} */
  const modelRefs = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { issues: [{ severity: 'error', rule: 'model-root', message: '模型根必须是 JSON 对象' }], textureRefs, modelRefs }
  }
  if ('parent' in value && typeof value.parent !== 'string') {
    issues.push({ severity: 'error', rule: 'model-parent', message: 'parent 必须是字符串模型 ID' })
  } else if (typeof value.parent === 'string') {
    modelRefs.push(value.parent)
  }
  if (value.textures !== undefined) {
    if (!value.textures || typeof value.textures !== 'object' || Array.isArray(value.textures)) {
      issues.push({ severity: 'error', rule: 'model-textures', message: 'textures 必须是对象（变量名 -> 路径或 #引用）' })
    } else {
      for (const [k, v] of Object.entries(value.textures)) {
        if (typeof v !== 'string') {
          issues.push({ severity: 'error', rule: 'model-textures', message: `纹理变量 ${k} 的值必须是字符串` })
        } else if (!v.startsWith('#')) {
          textureRefs.push(v)
        }
      }
    }
  }
  if (value.elements !== undefined) {
    if (!Array.isArray(value.elements)) {
      issues.push({ severity: 'error', rule: 'model-elements', message: 'elements 必须是数组' })
    } else {
      for (let i = 0; i < value.elements.length; i++) {
        const el = value.elements[i]
        if (!el || typeof el !== 'object') {
          issues.push({ severity: 'error', rule: 'model-element', message: `elements[${i}] 不是对象` })
          continue
        }
        const pos = (name) => (Array.isArray(el[name]) && el[name].length === 3) ? el[name] : null
        const from = pos('from')
        const to = pos('to')
        if (!from || !to) {
          issues.push({ severity: 'error', rule: 'model-element', message: `elements[${i}] 缺少 from/to（各 3 个数字）` })
        } else {
          const all = [...from, ...to]
          if (all.some(n => !Number.isFinite(n))) {
            issues.push({ severity: 'error', rule: 'model-element', message: `elements[${i}] from/to 含非数字` })
          } else if (all.some(n => n < -32 || n > 64)) {
            issues.push({ severity: 'warn', rule: 'model-bounds', message: `elements[${i}] from/to 超出常见范围 [-32,64]（${all.join(',')}）` })
          }
        }
        if (el.faces !== undefined && (typeof el.faces !== 'object' || Array.isArray(el.faces))) {
          issues.push({ severity: 'error', rule: 'model-faces', message: `elements[${i}] faces 必须是对象` })
        } else if (el.faces) {
          for (const [face, fv] of Object.entries(el.faces)) {
            if (!FACE_NAMES.includes(face)) {
              issues.push({ severity: 'warn', rule: 'model-face', message: `elements[${i}] 未知面 ${face}` })
              continue
            }
            if (!fv || typeof fv !== 'object') {
              issues.push({ severity: 'error', rule: 'model-face', message: `elements[${i}].faces.${face} 不是对象` })
              continue
            }
            if (fv.uv !== undefined) {
              if (!Array.isArray(fv.uv) || fv.uv.length !== 4 || fv.uv.some(n => !Number.isFinite(n))) {
                issues.push({ severity: 'error', rule: 'model-uv', message: `elements[${i}].faces.${face} uv 必须是 4 个数字` })
              } else if (fv.uv.some(n => n < 0 || n > 16)) {
                issues.push({
                  severity: 'error', rule: 'model-uv-bounds',
                  message: `elements[${i}].faces.${face} uv 越出 0-16 网格（${fv.uv.join(',')}）——像素坐标（×4）会报 "Cannot compute translucency out of bounds"`,
                })
              }
            }
            if (fv.texture !== undefined) {
              if (typeof fv.texture !== 'string' || !fv.texture.startsWith('#')) {
                issues.push({ severity: 'error', rule: 'model-face-texture', message: `elements[${i}].faces.${face} texture 必须是 #变量引用` })
              }
            }
          }
        }
      }
    }
  }
  if (value.display !== undefined) {
    if (typeof value.display !== 'object' || Array.isArray(value.display)) {
      issues.push({ severity: 'error', rule: 'model-display', message: 'display 必须是对象' })
    } else {
      for (const [slot, tv] of Object.entries(value.display)) {
        if (!tv || typeof tv !== 'object') continue
        for (const key of ['rotation', 'translation', 'scale']) {
          if (tv[key] !== undefined && (!Array.isArray(tv[key]) || tv[key].length !== 3 || tv[key].some(n => !Number.isFinite(n)))) {
            issues.push({ severity: 'warn', rule: 'model-display', message: `display.${slot}.${key} 必须是 3 个数字` })
          }
        }
      }
    }
  }
  if (value.overrides !== undefined) {
    if (!Array.isArray(value.overrides)) {
      issues.push({ severity: 'error', rule: 'model-overrides', message: 'overrides 必须是数组' })
    } else {
      for (let i = 0; i < value.overrides.length; i++) {
        const ov = value.overrides[i]
        if (ov && typeof ov === 'object' && typeof ov.model === 'string') modelRefs.push(ov.model)
        else issues.push({ severity: 'warn', rule: 'model-overrides', message: `overrides[${i}] 缺少 model 字符串` })
      }
    }
  }
  return { issues, textureRefs, modelRefs }
}

/**
 * 检查 1.21.4+ items/*.json 结构。
 * @param {any} value
 * @returns {{ issues: { severity: string, rule: string, message: string }[], modelRefs: string[] }}
 */
export function checkItemModelJson(value) {
  const issues = []
  /** @type {string[]} */
  const modelRefs = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { issues: [{ severity: 'error', rule: 'items-root', message: 'items/*.json 根必须是对象' }], modelRefs }
  }
  const model = value.model
  if (!model || typeof model !== 'object') {
    return { issues: [{ severity: 'error', rule: 'items-model', message: 'items/*.json 缺少 model 对象' }], modelRefs }
  }
  if (typeof model.type !== 'string' || !KNOWN_ITEM_TYPES.includes(model.type)) {
    issues.push({ severity: 'warn', rule: 'items-model-type', message: `未知 model.type ${JSON.stringify(model.type)}（已知: ${KNOWN_ITEM_TYPES.join(', ')}）` })
  }
  if (model.type === 'model') {
    if (typeof model.model === 'string') modelRefs.push(model.model)
    else issues.push({ severity: 'error', rule: 'items-model-ref', message: 'type=model 需要 model 字符串 ID' })
  }
  if (model.entries !== undefined) {
    if (!Array.isArray(model.entries)) {
      issues.push({ severity: 'error', rule: 'items-entries', message: 'range_dispatch 的 entries 必须是数组' })
    } else {
      for (let i = 0; i < model.entries.length; i++) {
        const en = model.entries[i]
        if (!en || typeof en !== 'object') {
          issues.push({ severity: 'warn', rule: 'items-entries', message: `entries[${i}] 不是对象` })
          continue
        }
        if (typeof en.threshold !== 'number' || !Number.isFinite(en.threshold)) {
          issues.push({ severity: 'warn', rule: 'items-entries', message: `entries[${i}] 缺 threshold 数字` })
        }
        if (en.model && typeof en.model === 'object' && typeof en.model.model === 'string') modelRefs.push(en.model.model)
        else if (typeof en.model === 'string') modelRefs.push(en.model)
        else issues.push({ severity: 'warn', rule: 'items-entries', message: `entries[${i}] 缺 model 引用` })
      }
    }
  }
  if (model.type === 'using_item') {
    const pick = (o) => {
      if (o && typeof o === 'object' && typeof o.model === 'string') modelRefs.push(o.model)
      else if (o && typeof o === 'object') {
        if (o.base && typeof o.base === 'object' && typeof o.base.model === 'string') modelRefs.push(o.base.model)
        if (o.first_person && typeof o.first_person === 'object' && typeof o.first_person.model === 'string') modelRefs.push(o.first_person.model)
        if (o.third_person && typeof o.third_person === 'object' && typeof o.third_person.model === 'string') modelRefs.push(o.third_person.model)
      }
    }
    pick(model.base)
    pick(model.hand)
  }
  return { issues, modelRefs }
}

/**
 * 检查 1.21.4+ blocks/*.json 结构。
 * @param {any} value
 * @returns {{ issues: { severity: string, rule: string, message: string }[], modelRefs: string[] }}
 */
export function checkBlockModelJson(value) {
  const issues = []
  /** @type {string[]} */
  const modelRefs = []
  const visit = (item, path) => {
    if (!item || typeof item !== 'object') {
      issues.push({ severity: 'error', rule: 'blocks-item', message: `${path} 必须是对象` })
      return
    }
    if (item.apply !== undefined && typeof item.apply.model === 'string') modelRefs.push(item.apply.model)
    if (item.apply !== undefined && typeof item.apply.model !== 'string') {
      issues.push({ severity: 'warn', rule: 'blocks-apply', message: `${path}.apply.model 必须是字符串` })
    }
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => visit(item, `[${i}]`))
  } else {
    visit(value, '$')
  }
  return { issues, modelRefs }
}

/**
 * 检查 blockstates/*.json 结构。
 * @param {any} value
 * @returns {{ issues: { severity: string, rule: string, message: string }[], modelRefs: string[] }}
 */
export function checkBlockstateJson(value) {
  const issues = []
  /** @type {string[]} */
  const modelRefs = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { issues: [{ severity: 'error', rule: 'blockstate-root', message: 'blockstates/*.json 根必须是对象' }], modelRefs }
  }
  const variants = value.variants
  if (variants !== undefined) {
    if (typeof variants !== 'object' || Array.isArray(variants)) {
      issues.push({ severity: 'error', rule: 'blockstate-variants', message: 'variants 必须是对象' })
    } else {
      for (const [k, v] of Object.entries(variants)) {
        const list = Array.isArray(v) ? v : [v]
        for (const item of list) {
          if (item && typeof item === 'object' && typeof item.model === 'string') modelRefs.push(item.model)
          else issues.push({ severity: 'warn', rule: 'blockstate-model', message: `variants.${k} 缺少 model 字符串` })
        }
      }
    }
  }
  const multipart = value.multipart
  if (multipart !== undefined) {
    if (!Array.isArray(multipart)) {
      issues.push({ severity: 'error', rule: 'blockstate-multipart', message: 'multipart 必须是数组' })
    } else {
      multipart.forEach((item, i) => {
        if (item && typeof item === 'object' && item.apply && typeof item.apply.model === 'string') modelRefs.push(item.apply.model)
        else issues.push({ severity: 'warn', rule: 'blockstate-multipart', message: `multipart[${i}] 缺少 apply.model` })
      })
    }
  }
  if (variants === undefined && multipart === undefined) {
    issues.push({ severity: 'warn', rule: 'blockstate-empty', message: '既无 variants 也无 multipart' })
  }
  return { issues, modelRefs }
}

/**
 * parent 链循环检测。models: [{ id: string（去命名空间，如 "item/foo"）, parent: string|null }]
 * @param {{ id: string, parent: string|null }[]} models
 * @returns {{ model: string, chain: string[] }[]}
 */
export function detectParentCycles(models) {
  const byId = new Map(models.map(m => [m.id, m]))
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map()
  const cycles = []
  const stack = []
  const visit = (id) => {
    const c = color.get(id) ?? WHITE
    if (c === BLACK) return
    if (c === GRAY) {
      const start = stack.indexOf(id)
      if (start >= 0) {
        cycles.push({ model: id, chain: [...stack.slice(start), id] })
      }
      return
    }
    color.set(id, GRAY)
    stack.push(id)
    const entry = byId.get(id)
    if (entry && entry.parent) visit(entry.parent)
    stack.pop()
    color.set(id, BLACK)
  }
  for (const m of models) visit(m.id)
  return cycles
}

/** 模型 ID 归一化：去命名空间前缀。 */
export function stripNamespace(id) {
  const i = id.indexOf(':')
  return i >= 0 ? id.slice(i + 1) : id
}

/** 取命名空间（缺省 'minecraft'）。 */
export function namespaceOf(id) {
  const i = id.indexOf(':')
  return i >= 0 ? id.slice(0, i) : 'minecraft'
}
