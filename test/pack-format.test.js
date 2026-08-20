import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveEra, packFormatFor, isKnownVersion, normalizeMcLine, SUPPORTED_VERSIONS } from '../lib/pack-format.js'

test('normalizeMcLine', () => {
  assert.equal(normalizeMcLine('1.21.8'), '1.21')
  assert.equal(normalizeMcLine('1.21.x'), '1.21')
  assert.equal(normalizeMcLine('26.2'), '26.2')
  assert.equal(normalizeMcLine('1.7.10'), '1.7')
})

test('pack_format 时代表（2026-08 核对）', () => {
  assert.equal(packFormatFor('1.7.10'), 1)
  assert.equal(packFormatFor('1.12.2'), 3)
  assert.equal(packFormatFor('1.16.5'), 6)
  assert.equal(packFormatFor('1.20.1'), 15)
  assert.equal(packFormatFor('1.20.2'), 18)
  assert.equal(packFormatFor('1.20.5'), 34)
  assert.equal(packFormatFor('1.21'), 48)
  assert.equal(packFormatFor('1.21.2'), 57)
  assert.equal(packFormatFor('1.21.4'), 63)
  assert.equal(packFormatFor('1.21.5'), 71)
  assert.equal(packFormatFor('1.21.6'), 75)
  assert.equal(packFormatFor('1.21.7'), 77)
  assert.equal(packFormatFor('1.21.8'), 80)
  assert.equal(packFormatFor('26.2'), 84)
})

test('时代字段：组件断代与 cit 引擎', () => {
  const legacy = resolveEra('1.12.2')
  assert.equal(legacy.components, false)
  assert.equal(legacy.lore, true)
  assert.equal(legacy.langFormat, 'lang')
  const modern = resolveEra('1.21.8')
  assert.equal(modern.components, true)
  assert.equal(modern.lore, false)
  assert.equal(modern.langFormat, 'json')
  assert.equal(modern.itemModels, 'items-json')
  const latest = resolveEra('26.2')
  assert.equal(latest.cit, 'citresewn')
  assert.equal(latest.components, true)
})

test('行默认值：通配/取整语义', () => {
  assert.equal(packFormatFor('1.21.x'), 80) // 通配 = 行最新 1.21.8
  assert.equal(packFormatFor('26.x'), 84)
  assert.equal(packFormatFor('1.21'), 48) // 精确 1.21–1.21.1
  assert.equal(packFormatFor('1.21.1'), 48)
  assert.equal(packFormatFor('1.21.3'), 57) // 向下取整到 1.21.2 条目
})

test('未知版本抛错', () => {
  assert.throws(() => resolveEra('1.9'), /不支持的 MC 版本/)
  assert.equal(isKnownVersion('26.2'), true)
  assert.equal(isKnownVersion('1.5.2'), false)
})

test('SUPPORTED_VERSIONS 全部可解析', () => {
  for (const v of SUPPORTED_VERSIONS) assert.equal(isKnownVersion(v), true, v)
})
