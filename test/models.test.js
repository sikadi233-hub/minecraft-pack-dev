import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkModelStructure, checkItemModelJson, checkBlockModelJson, checkBlockstateJson,
  detectParentCycles, stripNamespace, namespaceOf,
} from '../lib/models.js'

test('模型结构：合法 cube_all 无问题', () => {
  const res = checkModelStructure({ parent: 'minecraft:block/cube_all', textures: { all: 'item/example' } })
  assert.equal(res.issues.length, 0)
  assert.deepEqual(res.textureRefs, ['item/example'])
  assert.deepEqual(res.modelRefs, ['minecraft:block/cube_all'])
})

test('UV 越出 0-16 网格被检出（v14 马赛克案）', () => {
  const res = checkModelStructure({
    elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: { up: { uv: [32, 0, 48, 16], texture: '#all' } } }],
  })
  const uv = res.issues.find(i => i.rule === 'model-uv-bounds')
  assert.ok(uv, JSON.stringify(res.issues))
  assert.match(uv.message, /0-16/)
})

test('UV 边界值 0/16 合法', () => {
  const res = checkModelStructure({
    elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: { up: { uv: [0, 0, 16, 16], texture: '#all' } } }],
  })
  assert.equal(res.issues.filter(i => i.rule === 'model-uv-bounds').length, 0)
})

test('模型结构：faces/textures 类型错误', () => {
  const res = checkModelStructure({ textures: { all: 42 }, elements: 'nope' })
  assert.ok(res.issues.some(i => i.rule === 'model-elements'))
  assert.ok(res.issues.some(i => i.rule === 'model-textures'))
})

test('parent 循环检测', () => {
  const cycles = detectParentCycles([
    { id: 'item/a', parent: 'item/b' },
    { id: 'item/b', parent: 'item/a' },
  ])
  assert.equal(cycles.length, 1)
  assert.deepEqual(cycles[0].chain, ['item/a', 'item/b', 'item/a'])
  const ok = detectParentCycles([
    { id: 'item/a', parent: 'block/stone' },
    { id: 'item/b', parent: 'item/a' },
  ])
  assert.equal(ok.length, 0)
})

test('items/*.json 结构（1.21.4+）', () => {
  const good = checkItemModelJson({ model: { type: 'model', model: 'minecraft:item/example' } })
  assert.equal(good.issues.length, 0)
  assert.deepEqual(good.modelRefs, ['minecraft:item/example'])
  const rd = checkItemModelJson({
    model: {
      type: 'range_dispatch', property: 'custom_model_data',
      entries: [{ threshold: 1, model: { type: 'model', model: 'minecraft:item/x' } }],
    },
  })
  assert.deepEqual(rd.modelRefs, ['minecraft:item/x'])
  assert.equal(checkItemModelJson({}).issues.some(i => i.rule === 'items-model'), true)
})

test('blocks/*.json 与 blockstates 结构', () => {
  const b = checkBlockModelJson([{ when: {}, apply: { model: 'minecraft:block/x' } }])
  assert.deepEqual(b.modelRefs, ['minecraft:block/x'])
  const bs = checkBlockstateJson({ variants: { '': { model: 'minecraft:block/y' }, 'a=1': [{ model: 'minecraft:block/z' }] } })
  assert.deepEqual(bs.modelRefs, ['minecraft:block/y', 'minecraft:block/z'])
  const mp = checkBlockstateJson({ multipart: [{ apply: { model: 'minecraft:block/w' } }] })
  assert.deepEqual(mp.modelRefs, ['minecraft:block/w'])
  assert.equal(checkBlockstateJson({}).issues.some(i => i.rule === 'blockstate-empty'), true)
})

test('命名空间工具', () => {
  assert.equal(stripNamespace('minecraft:item/foo'), 'item/foo')
  assert.equal(stripNamespace('item/foo'), 'item/foo')
  assert.equal(namespaceOf('minecraft:item/foo'), 'minecraft')
  assert.equal(namespaceOf('item/foo'), 'minecraft')
  assert.equal(namespaceOf('mypack:item/foo'), 'mypack')
})
