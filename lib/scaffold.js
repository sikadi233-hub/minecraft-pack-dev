/**
 * mc_pack_scaffold 实现：从 assets/templates/pack/ 复制分版资源包骨架。
 * 产出 pack.config.json + source/（cit/models/lang/sounds）+ overlays/<版本>/。
 * 纹理示例（example.png）由代码生成（makePng），模板不携带二进制。
 * @module minecraft-pack-dev/lib/scaffold
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SUPPORTED_VERSIONS, isKnownVersion } from './pack-format.js'
import { makePng } from './png.js'

const TEMPLATE_DIR = fileURLToPath(new URL('../assets/templates/pack/', import.meta.url))

const PACK_ID_RE = /^[a-z0-9][a-z0-9_-]*$/i

function render(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => (key in vars ? String(vars[key]) : `{{${key}}}`))
}

function walk(dir, base = '') {
  const out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${ent.name}` : ent.name
    const abs = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(abs, rel))
    else if (ent.isFile()) out.push({ rel, abs })
  }
  return out
}

/**
 * 创建分版资源包项目骨架。
 * @param {{ targetDir: string, packId: string, versions?: string[], description?: string|null }} opts
 * @returns {{ projectDir: string, filesCreated: string[], versions: string[] }}
 */
export function scaffoldPack({ targetDir, packId, versions = SUPPORTED_VERSIONS, description = null }) {
  if (!PACK_ID_RE.test(packId)) {
    throw new Error(`packId ${JSON.stringify(packId)} 不合法：须为小写 kebab-case（字母/数字/下划线/连字符）`)
  }
  for (const v of versions) {
    if (!isKnownVersion(v)) {
      throw new Error(`不支持的版本 ${JSON.stringify(v)}；支持: ${SUPPORTED_VERSIONS.join(', ')}`)
    }
  }
  if (fs.existsSync(targetDir)) {
    const existing = fs.readdirSync(targetDir)
    if (existing.length > 0) throw new Error(`targetDir 必须不存在或为空（现有 ${existing.length} 项）`)
  } else {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const desc = description || `${packId} resource pack`
  const vars = { packId, description: desc, versionsJson: JSON.stringify(versions) }
  const filesCreated = []

  for (const t of walk(TEMPLATE_DIR)) {
    const rel = t.rel.endsWith('.tpl') ? t.rel.slice(0, -4) : t.rel
    const outAbs = path.join(targetDir, ...rel.split('/'))
    fs.mkdirSync(path.dirname(outAbs), { recursive: true })
    fs.writeFileSync(outAbs, render(fs.readFileSync(t.abs, 'utf8'), vars), 'utf8')
    filesCreated.push(rel)
  }

  // 示例纹理（代码生成，避免模板携带二进制）
  const gen = [
    ['source/assets/minecraft/textures/item/example.png', makePng(16, 16, () => [255, 0, 255, 255])],
    ['source/assets/minecraft/textures/font/example.png', makePng(16, 16, (x, y) => (x < 8 ? [255, 255, 255, 255] : [0, 0, 0, 0]))],
  ]
  for (const [rel, buf] of gen) {
    const outAbs = path.join(targetDir, ...rel.split('/'))
    fs.mkdirSync(path.dirname(outAbs), { recursive: true })
    fs.writeFileSync(outAbs, buf)
    filesCreated.push(rel)
  }

  // 分版 overlay 目录
  for (const v of versions) {
    const rel = `overlays/${v}/.gitkeep`
    const outAbs = path.join(targetDir, ...rel.split('/'))
    fs.mkdirSync(path.dirname(outAbs), { recursive: true })
    fs.writeFileSync(outAbs, '')
    filesCreated.push(rel)
  }

  filesCreated.sort()
  return { projectDir: targetDir, filesCreated, versions: [...versions] }
}
