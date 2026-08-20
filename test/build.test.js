import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { scaffoldPack } from '../lib/scaffold.js'
import { buildPack, convertLangJsonToLang, planCaseDuplicates } from '../lib/build.js'
import { readZip } from '../lib/zip.js'

const ROOT = path.join(process.cwd(), 'test', '.tmp-build')
const OUT = path.join(ROOT, 'dist')

function makeProject() {
  fs.rmSync(ROOT, { recursive: true, force: true })
  scaffoldPack({ targetDir: ROOT, packId: 'mypack', versions: ['1.7.10', '1.21.8', '26.2'] })
}

test('build: 三时代 zip 产出与内容核对', () => {
  makeProject()
  const res = buildPack({ packDir: ROOT, outDir: OUT })
  assert.equal(res.ok, true, JSON.stringify(res.errors))
  assert.equal(res.built.length, 3)
  const byVer = Object.fromEntries(res.built.map(b => [b.version, b]))

  // 1.7.10：pf 1、lang 转 .lang 且带 .name 后缀、无 items json、cit 保留
  const z1710 = readZip(fs.readFileSync(byVer['1.7.10'].zipPath))
  const files1710 = new Set(z1710.map(e => e.path))
  assert.ok(files1710.has('pack.mcmeta'))
  assert.match(z1710.find(e => e.path === 'pack.mcmeta').data.toString('utf8'), /"pack_format": 1/)
  assert.ok(files1710.has('assets/minecraft/lang/en_US.lang'), [...files1710].join('\n'))
  assert.ok(files1710.has('assets/minecraft/lang/zh_CN.lang'))
  assert.ok(!files1710.has('assets/minecraft/lang/zh_cn.json'))
  const lang = z1710.find(e => e.path === 'assets/minecraft/lang/zh_CN.lang').data.toString('utf8')
  assert.match(lang, /^item\.diamond\.name=钻石$/m)
  assert.ok(![...files1710].some(f => f.includes('/items/')), '1.7.10 不应有 items json')
  assert.ok(files1710.has('cit/example_modern.properties'))

  // 1.21.8：pf 80、lang json 保留、overlay 的 items/font 合并
  const z1218 = readZip(fs.readFileSync(byVer['1.21.8'].zipPath))
  const files1218 = new Set(z1218.map(e => e.path))
  assert.match(z1218.find(e => e.path === 'pack.mcmeta').data.toString('utf8'), /"pack_format": 80/)
  assert.ok(files1218.has('assets/minecraft/lang/zh_cn.json'))
  assert.ok(files1218.has('assets/minecraft/items/example.json'), [...files1218].join('\n'))
  assert.ok(files1218.has('assets/minecraft/font/example.json'))

  // 26.2：pf 84
  const z262 = readZip(fs.readFileSync(byVer['26.2'].zipPath))
  assert.match(z262.find(e => e.path === 'pack.mcmeta').data.toString('utf8'), /"pack_format": 84/)
})

test('build: CRLF 源文件被规范化为 LF', () => {
  makeProject()
  const target = path.join(ROOT, 'source', 'cit', 'example_modern.properties')
  fs.writeFileSync(target, 'type=item\r\nitems=paper\r\n', 'utf8')
  const res = buildPack({ packDir: ROOT, outDir: OUT, versions: ['1.21.8'] })
  const zip = readZip(fs.readFileSync(res.built[0].zipPath))
  const data = zip.find(e => e.path === 'cit/example_modern.properties').data.toString('utf8')
  assert.ok(!data.includes('\r'), JSON.stringify(data))
})

test('planCaseDuplicates: fix 重命名方案（Windows 磁盘无法构造大小写重名，纯函数测试）', () => {
  const rels = ['Textures/A.png', 'Textures/a.png', 'Textures/b.png', 'x.json']
  const noFix = planCaseDuplicates(rels, false)
  assert.equal(noFix.renamed.size, 0)
  assert.ok(noFix.warnings.some(w => w.includes('大小写')))
  const fix = planCaseDuplicates(rels, true)
  assert.deepEqual([...fix.renamed.keys()].sort(), ['Textures/a.png'])
  assert.equal(fix.renamed.get('Textures/a.png'), 'Textures/a.png.dup')
  assert.ok(fix.warnings.some(w => w.includes('Textures/a.png → Textures/a.png.dup')))
})

test('build: failOnError 拦截 ERROR 级问题', () => {
  makeProject()
  fs.writeFileSync(path.join(ROOT, 'source', 'assets', 'minecraft', 'sounds.json'), '{broken', 'utf8')
  const res = buildPack({ packDir: ROOT, outDir: OUT, failOnError: true })
  assert.equal(res.ok, false)
  assert.ok(res.errors.some(e => e.includes('failOnError')))
})

test('lang 转换：json → .lang 键后缀', () => {
  const text = convertLangJsonToLang({ 'item.diamond': '钻石', 'block.diamond_block': '钻石块', 'enchantment.test': '测试' }, 'x.json')
  assert.match(text, /item\.diamond\.name=钻石/)
  assert.match(text, /block\.diamond_block\.name=钻石块/)
  assert.match(text, /enchantment\.test=测试/)
})
