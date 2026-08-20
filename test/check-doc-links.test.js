import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractLinks, classify } from '../scripts/check-doc-links.mjs'

test('extractLinks: 基本提取与裁剪', () => {
  const links = extractLinks('看 https://example.com/a 和 https://example.com/b(1)，以及 https://example.com/c。')
  assert.deepEqual(links.map(l => l.value), ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'])
  assert.equal(links[0].line, 1)
})

test('extractLinks: 跳过占位符与行号', () => {
  const links = extractLinks('line1 https://x.com/<slug>\nline2 https://y.com/z')
  assert.deepEqual(links.map(l => l.value), ['https://y.com/z'])
  assert.equal(links[0].line, 2)
})

test('classify: 状态分级', () => {
  assert.equal(classify(200), 'ok')
  assert.equal(classify(301), 'ok')
  assert.equal(classify(404), 'broken')
  assert.equal(classify(410), 'broken')
  assert.equal(classify(500), 'broken')
  assert.equal(classify(403), 'unverifiable')
  assert.equal(classify(429), 'unverifiable')
  assert.equal(classify(undefined), 'broken')
})
