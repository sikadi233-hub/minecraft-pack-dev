import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * The dsh compatibility contract, mirroring the sibling repo's `test/peers.test.js`.
 *
 * dsh 0.2.0 added a hard gate (`dsh-app-boot` `evaluatePluginCompatibility`):
 * a plugin whose `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer ranges do not
 * match the running runtime version is **refused** — installation rejected, or
 * the whole package skipped at boot, with no partial behaviour to notice.
 *
 * node-semver cannot express "any prerelease of these lines" in one range
 * (`^0.1.5-rc.1` does not match `0.2.0-rc.2` even with `includePrerelease`), so
 * the lines are enumerated and this test pins the enumeration. Add a row to
 * RUNTIME_LINES when dsh ships a line.
 */

const RUNTIME_LINES = [
  { line: '0.1.5', declared: '^0.1.5-rc.1' },
  { line: '0.1.7', declared: '^0.1.7-rc.1' },
  { line: '0.2.0', declared: '^0.2.0-rc.2' },
]

const pkg = JSON.parse(await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'))

test('the dsh peers enumerate exactly the supported runtime lines', () => {
  const expected = RUNTIME_LINES.map(entry => entry.declared).join(' || ')
  for (const dependency of ['@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-skill']) {
    assert.equal(pkg.peerDependencies[dependency], expected, `${dependency} must enumerate every supported line`)
  }
})

test('cordis and schemastery stay outside the runtime line gate', () => {
  assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'], '^4.0.1')
  assert.equal(pkg.peerDependencies['@deepseek-ai/schemastery'], '^3.18.1')
})
