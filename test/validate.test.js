import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { validatePack, findCaseDuplicates } from '../lib/validate.js'
import { makePng } from '../lib/png.js'

const ROOT = path.join(process.cwd(), 'test', '.tmp-validate')

function write(rel, data) {
  const abs = path.join(ROOT, ...rel.split('/'))
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  if (Buffer.isBuffer(data)) fs.writeFileSync(abs, data)
  else fs.writeFileSync(abs, data, 'utf8')
}

function buildFixture() {
  fs.rmSync(ROOT, { recursive: true, force: true })
  fs.mkdirSync(ROOT, { recursive: true })
  write('pack.config.json', JSON.stringify({ id: 'fixture', versions: ['26.2'], syncGroups: [['cit/a', 'cit/b']], names: ['Blue Diamond Boots'] }))
  write('pack.mcmeta', '{"pack":{"pack_format":63}}')
  // lang
  write('assets/minecraft/lang/en_us.json', '{"a":"A","b":"B"}')
  write('assets/minecraft/lang/zh_cn.json', '{"a":"A"}')
  write('assets/minecraft/lang/de_de.lang', 'x=1')
  // models
  write('assets/minecraft/models/item/bad_uv.json', JSON.stringify({ elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: { up: { uv: [32, 0, 48, 16], texture: '#all' } } }] }))
  write('assets/minecraft/models/item/cycle_a.json', JSON.stringify({ parent: 'minecraft:item/cycle_b' }))
  write('assets/minecraft/models/item/cycle_b.json', JSON.stringify({ parent: 'minecraft:item/cycle_a' }))
  write('assets/minecraft/models/item/ref_missing.json', JSON.stringify({ textures: { all: 'item/ghost' } }))
  write('assets/minecraft/models/item/exists.json', JSON.stringify({ parent: 'minecraft:block/cube_all', textures: { all: 'item/example' } }))
  // textures
  write('assets/minecraft/textures/item/example.png', makePng(16, 16, () => [255, 0, 255, 255]))
  write('assets/minecraft/textures/item/broken.png', Buffer.alloc(10))
  write('assets/minecraft/textures/item/tiny.png', makePng(64, 64, () => [0, 0, 0, 0]))
  // audio
  write('assets/minecraft/sounds.json', JSON.stringify({ 'my.event': { sounds: ['custom/missing'] } }))
  write('assets/mypack/sounds.json', JSON.stringify({ 'my.event': { sounds: ['custom/missing'] } }))
  // particles / atlas / font
  write('assets/minecraft/particles/dust.json', JSON.stringify({ textures: ['item/ghost2'] }))
  write('assets/minecraft/atlas/blocks.json', JSON.stringify({ sources: [{ type: 'directory', source: 'block' }] }))
  write('assets/minecraft/font/example.json', JSON.stringify({ providers: [{ type: 'bitmap', file: 'font/ghost', height: 8, ascent: 7, chars: ['x'] }] }))
  // cit
  write('cit/items_comma.properties', 'type=item\nitems=stone,dirt\n')
  write('cit/lore_dead.properties', 'type=item\nitems=paper\nnbt.display.Lore.0=ipattern:*X*\n')
  write('cit/damage.properties', 'type=item\nitems=diamond_sword\ndamage=50\n')
  write('cit/ref_custom.properties', 'type=item\nitems=paper\ntexture.0=mypack:item/x\n')
  write('cit/name_hint.properties', 'type=item\nitems=paper\ncomponents.minecraft\\:custom_name=ipattern:*Blue Biamond*\n')
  // 路径坑（注意：Windows 文件系统大小写不敏感，大小写重名无法在磁盘构造，
  // 该规则以纯函数 findCaseDuplicates 单独测试）
  write('knight items/x.properties', 'type=item\nitems=paper\n')
  // CRLF
  write('README.md', 'line1\r\nline2\r\n')
  // 双通道不同步
  write('cit/a/same.txt', 'AAA')
  write('cit/b/same.txt', 'BBB')
}

const rules = (report) => new Set(report.issues.map(i => i.rule))

test('validate: 多域夹具全部检出（26.2 时代）', () => {
  buildFixture()
  const report = validatePack({ packDir: ROOT, targetMc: '26.2' })
  const rs = rules(report)
  assert.equal(report.ok, false)
  // 打包
  assert.ok(rs.has('mcmeta-format'), [...rs].join(',')) // pf 63 vs 84
  assert.ok(rs.has('crlf'))
  assert.ok(rs.has('space-in-name'))
  // 模型
  assert.ok(rs.has('model-uv-bounds'))
  assert.ok(rs.has('model-parent-cycle'))
  assert.ok(rs.has('texture-missing')) // minecraft ns → WARN
  // 纹理
  assert.ok(rs.has('png-invalid'))
  assert.ok(rs.has('png-small'))
  assert.ok(rs.has('atlas-dir-missing'))
  // 音频
  assert.ok(rs.has('sound-missing'))
  const customSound = report.issues.find(i => i.rule === 'sound-missing' && i.severity === 'error')
  assert.ok(customSound && customSound.file.includes('mypack'), JSON.stringify(report.issues.filter(i => i.rule === 'sound-missing')))
  // 语言
  assert.ok(rs.has('lang-format-era'))
  assert.ok(rs.has('lang-missing-keys'))
  // CIT
  assert.ok(rs.has('items-comma'))
  assert.ok(rs.has('lore-dead'))
  assert.ok(rs.has('damage-unbreakable'))
  assert.ok(rs.has('sync-mismatch'))
  assert.ok(rs.has('name-dict-hint'))
  const customTex = report.issues.find(i => i.rule === 'texture-missing' && i.severity === 'error')
  assert.ok(customTex && customTex.message.includes('mypack:item/x'))
  // 时代
  assert.equal(report.era.format, 84)
  assert.equal(report.era.cit, 'citresewn')
  assert.equal(report.stats.citProperties >= 5, true)
})

test('validate: 无 targetMc 时 lore 降级为 WARN', () => {
  buildFixture()
  const report = validatePack({ packDir: ROOT })
  const lore = report.issues.find(i => i.rule === 'lore-era')
  assert.ok(lore && lore.severity === 'warn', JSON.stringify(report.issues.filter(i => i.rule.startsWith('lore'))))
  assert.ok(!report.issues.some(i => i.rule === 'lore-dead'))
})

test('findCaseDuplicates: 纯函数检测大小写重名', () => {
  const groups = findCaseDuplicates(['Textures/X.png', 'textures/x.png', 'assets/a.png', 'A/B.json'])
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].list.sort(), ['Textures/X.png', 'textures/x.png'])
  assert.equal(findCaseDuplicates(['a.png', 'b.png']).length, 0)
})

test('validate: 未知 targetMc 报错', () => {
  buildFixture()
  const report = validatePack({ packDir: ROOT, targetMc: '9.9' })
  assert.ok(report.issues.some(i => i.rule === 'target-mc'))
  assert.ok(report.eraError)
})

test('validate: analyze 统计形状', () => {
  buildFixture()
  const report = validatePack({ packDir: ROOT, mode: 'analyze' })
  const s = report.stats
  assert.equal(typeof s.files, 'number')
  assert.equal(typeof s.issuesBySeverity.error, 'number')
  assert.ok(s.citProperties >= 5)
  assert.ok(s.modelJsons >= 4)
  assert.ok(s.langFiles >= 3)
})

test('validate: log 模式把日志映射到包内文件', () => {
  buildFixture()
  const logText = [
    '[13:00:00] [Render thread/ERROR]: Missing model: minecraft:item/ghost_model',
    '[13:00:01] [Render thread/ERROR]: Missing texture: minecraft:item/ghost_texture',
    '[13:00:02] [Render thread/ERROR]: Cannot compute translucency out of bounds: [64,0,96,32] in 64x64',
    '[13:00:03] [Render thread/ERROR]: Missing model: minecraft:item/exists',
  ].join('\n')
  const report = validatePack({ packDir: ROOT, logText })
  assert.equal(report.stats.logMatches, 4)
  const missing = report.issues.find(i => i.rule === 'log-model' && i.severity === 'error')
  assert.ok(missing && missing.message.includes('ghost_model'))
  assert.ok(report.issues.some(i => i.rule === 'log-texture'))
  assert.ok(report.issues.some(i => i.rule === 'log-uv-bounds'))
  const exists = report.issues.find(i => i.rule === 'log-model' && i.severity === 'info')
  assert.ok(exists && exists.file.endsWith('models/item/exists.json'))
})
