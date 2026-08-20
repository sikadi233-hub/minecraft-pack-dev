import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseJson, hasBom, stripBom, collectDuplicateKeys, lineColOf } from '../lib/json.js'
import { checkPng, makePng, suspiciousSmall } from '../lib/png.js'
import { parseProperties, splitItems } from '../lib/properties.js'

test('json: 合法解析与 BOM', () => {
  assert.equal(parseJson('{"a":1}').ok, true)
  assert.equal(parseJson('{"a":1}').value.a, 1)
  assert.equal(hasBom('\uFEFF{}'), true)
  assert.equal(hasBom('{}'), false)
  assert.equal(parseJson('\uFEFF{"a":1}').ok, true)
  assert.equal(stripBom('\uFEFFx'), 'x')
})

test('json: 错误带行列定位', () => {
  const r = parseJson('{\n  "a": 1,\n}')
  assert.equal(r.ok, false)
  assert.equal(r.error.line, 3)
  assert.ok(r.error.column >= 1)
  const r2 = parseJson('{"a":1,}')
  assert.equal(r2.ok, false)
  assert.equal(r2.error.line, 1)
})

test('json: 重复键在文本层检测（JSON.parse 会折叠重复键）', () => {
  const dk = collectDuplicateKeys('{"a":1,"a":2,"b":{"c":1,"c":2,"d":[1,2]}}')
  assert.equal(dk.length, 2)
  assert.ok(dk.some(d => d.key === 'a' && d.path === '$'))
  assert.ok(dk.some(d => d.key === 'c' && d.path === '$.b'))
  assert.equal(collectDuplicateKeys('{"a":1,"b":2}').length, 0)
  assert.equal(collectDuplicateKeys('{"a":"x:y","b":1}').length, 0)
})

test('json: lineColOf', () => {
  assert.deepEqual(lineColOf('ab\ncd', 4), { line: 2, column: 2 })
})

test('png: makePng 生成合法 PNG 并可回读', () => {
  const buf = makePng(16, 16, () => [255, 0, 255, 255])
  const c = checkPng(buf)
  assert.equal(c.ok, true)
  assert.equal(c.width, 16)
  assert.equal(c.height, 16)
})

test('png: 损坏/截断检出', () => {
  assert.equal(checkPng(Buffer.alloc(10)).ok, false)
  const good = makePng(8, 8)
  assert.equal(checkPng(good.subarray(0, 20)).ok, false)
  const bad = Buffer.from(good)
  bad[0] = 0x00
  assert.equal(checkPng(bad).ok, false)
})

test('png: 残缺启发式', () => {
  assert.equal(suspiciousSmall(64, 64, 300), true)
  assert.equal(suspiciousSmall(16, 16, 300), false)
  assert.equal(suspiciousSmall(64, 64, 5000), false)
})

test('properties: CRLF / 注释 / 重复键 / 无分隔符', () => {
  const p = parseProperties('a=1\r\n# comment\r\n! bang\r\nb = 2\r\na=3\r\nnosep')
  assert.equal(p.crlf, true)
  assert.equal(p.entries.length, 4)
  assert.equal(p.entries[1].key, 'b')
  assert.equal(p.entries[1].value, '2')
  assert.ok(p.duplicateKeys.includes('a'))
  assert.equal(p.warnings.length, 1)
  assert.equal(p.warnings[0].message.includes('='), true)
})

test('properties: BOM 与 unicode 转义', () => {
  const p = parseProperties('\uFEFFname=\\u0041')
  assert.equal(p.bom, true)
  assert.equal(p.entries[0].value, 'A')
})

test('properties: items 逗号分隔检测', () => {
  assert.equal(splitItems('stone,dirt').commaSeparated, true)
  assert.deepEqual(splitItems('stone,dirt').items, ['stone', 'dirt'])
  assert.equal(splitItems('stone dirt').commaSeparated, false)
  assert.deepEqual(splitItems('stone dirt').items, ['stone', 'dirt'])
  assert.deepEqual(splitItems('').items, [])
})
