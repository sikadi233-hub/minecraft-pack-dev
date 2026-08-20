import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { writeZip, readZip } from '../lib/zip.js'

test('zip 往返：deflate + 嵌套路径 + 中文名 + 空文件', () => {
  const entries = [
    { path: 'pack.mcmeta', data: Buffer.from('{"pack":{"pack_format":84}}', 'utf8') },
    { path: 'assets/minecraft/lang/zh_cn.json', data: Buffer.from('{"item.diamond":"钻石"}', 'utf8') },
    { path: 'assets/minecraft/textures/empty.png', data: Buffer.alloc(0) },
  ]
  const buf = writeZip(entries)
  const back = readZip(buf)
  assert.equal(back.length, 3)
  assert.deepEqual(back.map(e => e.path).sort(), ['assets/minecraft/lang/zh_cn.json', 'assets/minecraft/textures/empty.png', 'pack.mcmeta'])
  assert.equal(back.find(e => e.path === 'pack.mcmeta').data.toString('utf8').includes('84'), true)
  assert.equal(back.find(e => e.path.endsWith('zh_cn.json')).data.toString('utf8').includes('钻石'), true)
  assert.equal(back.find(e => e.path.endsWith('empty.png')).data.length, 0)
})

test('zip 写入磁盘后可读', () => {
  const dir = fs.mkdtempSync(path.join(process.cwd(), 'test', '.tmp-zip-'))
  try {
    const zipPath = path.join(dir, 'x.zip')
    fs.writeFileSync(zipPath, writeZip([{ path: 'a.txt', data: Buffer.from('hello') }]))
    const back = readZip(fs.readFileSync(zipPath))
    assert.equal(back[0].path, 'a.txt')
    assert.equal(back[0].data.toString('utf8'), 'hello')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('zip: 损坏输入抛错', () => {
  assert.throws(() => readZip(Buffer.alloc(64)), /EOCD/)
})
