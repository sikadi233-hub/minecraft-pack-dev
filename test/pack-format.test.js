import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveEra, packFormatFor, isKnownVersion, normalizeMcLine, SUPPORTED_VERSIONS, LINE_DEFAULTS, citRuntimeMissingFor } from '../lib/pack-format.js'

test('normalizeMcLine', () => {
  assert.equal(normalizeMcLine('1.21.8'), '1.21')
  assert.equal(normalizeMcLine('1.21.x'), '1.21')
  assert.equal(normalizeMcLine('26.2'), '26.2')
  assert.equal(normalizeMcLine('1.7.10'), '1.7')
})

// 数值来源：client.jar 内顶层 version.json 的 pack_version.resource / resource_major
// （26.x）。核对日期 2026-09，方法见 lib/pack-format.js 头部与
// scripts/derive-pack-format.mjs。注意：这不是数据包格式（data/data_major）。
test('pack_format 时代表（2026-09 依 client.jar 核对）', () => {
  assert.equal(packFormatFor('1.7.10'), 1)
  assert.equal(packFormatFor('1.12.2'), 3)
  assert.equal(packFormatFor('1.16.5'), 6) // jar 内根 pack.mcmeta 确认（pack_version 为裸整数 6）
  assert.equal(packFormatFor('1.20.1'), 15)
  assert.equal(packFormatFor('1.20.2'), 18)
  assert.equal(packFormatFor('1.20.3'), 22)
  assert.equal(packFormatFor('1.20.5'), 32) // data=41，勿混用
  assert.equal(packFormatFor('1.21'), 34) // data=48
  assert.equal(packFormatFor('1.21.2'), 42) // data=57
  assert.equal(packFormatFor('1.21.4'), 46) // SharedConstants i=46 j=61
  assert.equal(packFormatFor('1.21.5'), 55) // data=71
  assert.equal(packFormatFor('1.21.6'), 63) // SharedConstants i=63 j=80
  assert.equal(packFormatFor('1.21.7'), 64)
  assert.equal(packFormatFor('1.21.8'), 64) // SharedConstants i=64 j=81
  assert.equal(packFormatFor('1.21.11'), 75)
  assert.equal(packFormatFor('26.2'), 88) // RESOURCE_PACK_FORMAT_MAJOR=88, MINOR=0
  assert.equal(packFormatFor('26.3'), 97) // RESOURCE_PACK_FORMAT_MAJOR=97, MINOR=1
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
  const latest = resolveEra('26.3')
  assert.equal(latest.cit, 'citresewn')
  assert.equal(latest.components, true)
})

test('行默认值：通配/取整语义', () => {
  assert.equal(packFormatFor('1.21.x'), 64) // 通配 = 行最新 1.21.8
  assert.equal(packFormatFor('26.x'), 97) // 通配 = 行最新 26.3
  assert.equal(LINE_DEFAULTS['26'], '26.3')
  assert.equal(packFormatFor('1.21'), 34) // 精确 1.21–1.21.1
  assert.equal(packFormatFor('1.21.1'), 34)
  assert.equal(packFormatFor('1.21.3'), 42) // 向下取整到 1.21.2 条目
  assert.equal(packFormatFor('1.21.9'), 64) // 1.21.9 无条目 → 向下取整 1.21.8
})

test('未知版本抛错', () => {
  assert.throws(() => resolveEra('1.9'), /不支持的 MC 版本/)
  assert.equal(isKnownVersion('26.3'), true)
  assert.equal(isKnownVersion('1.5.2'), false)
})

test('SUPPORTED_VERSIONS 全部可解析', () => {
  for (const v of SUPPORTED_VERSIONS) assert.equal(isKnownVersion(v), true, v)
  assert.deepEqual(SUPPORTED_VERSIONS, ['1.7.10', '1.12.2', '1.16.5', '1.20.1', '1.21.8', '26.2', '26.3'])
})

// CIT 前端（citresewn continuation / fork）截至 2026-09 没有 26.3 版本，
// 26.3 上 CIT 没有运行时——这是非阻塞提示（warn），不是包的错误。
test('CIT 运行时缺失版本集合', () => {
  assert.equal(citRuntimeMissingFor('26.3'), true)
  assert.equal(citRuntimeMissingFor('26.2'), false)
  assert.equal(citRuntimeMissingFor('26.x'), true) // 通配到 26.3
  assert.equal(citRuntimeMissingFor('1.21.8'), false)
  assert.equal(citRuntimeMissingFor('9.9'), false) // 未知版本不抛错
})
