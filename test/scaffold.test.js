import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { scaffoldPack } from '../lib/scaffold.js'
import { checkPng } from '../lib/png.js'

const ROOT = path.join(process.cwd(), 'test', '.tmp-scaffold')
const packId = 'mypack'

test('scaffold: 骨架结构完整', () => {
  fs.rmSync(ROOT, { recursive: true, force: true })
  const res = scaffoldPack({ targetDir: ROOT, packId, versions: ['1.7.10', '26.2'], description: '测试包' })
  assert.ok(res.filesCreated.length >= 15)
  for (const rel of [
    'pack.config.json',
    'README.md',
    'source/cit/example_modern.properties',
    'source/cit/example_legacy.properties',
    'source/assets/minecraft/lang/en_us.json',
    'source/assets/minecraft/lang/zh_cn.json',
    'source/assets/minecraft/models/item/example.json',
    'source/assets/minecraft/sounds.json',
    'overlays/1.7.10/.gitkeep',
    'overlays/26.2/.gitkeep',
    'source/assets/minecraft/textures/item/example.png',
    'source/assets/minecraft/textures/font/example.png',
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, ...rel.split('/'))), rel)
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'pack.config.json'), 'utf8'))
  assert.equal(cfg.id, packId)
  assert.deepEqual(cfg.versions, ['1.7.10', '26.2'])
  assert.equal(cfg.description, '测试包')
  // 生成的示例 PNG 合法
  assert.equal(checkPng(fs.readFileSync(path.join(ROOT, 'source', 'assets', 'minecraft', 'textures', 'item', 'example.png'))).ok, true)
})

test('scaffold: 默认全版本 + 校验参数', () => {
  fs.rmSync(ROOT, { recursive: true, force: true })
  const res = scaffoldPack({ targetDir: ROOT, packId })
  assert.equal(res.versions.length, 6)
  assert.throws(() => scaffoldPack({ targetDir: ROOT, packId: 'Bad Name!' }), /packId/)
  assert.throws(() => scaffoldPack({ targetDir: ROOT, packId, versions: ['1.9'] }), /不支持的版本/)
  assert.throws(() => scaffoldPack({ targetDir: ROOT, packId: 'x' }), /必须不存在或为空/)
})
