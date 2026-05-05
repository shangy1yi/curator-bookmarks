import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('shortcut settings do not expose the browser action activation command', () => {
  const manifest = JSON.parse(readProjectFile('src/manifest.json'))
  const optionsSource = readProjectFile('src/options/options.ts')

  assert.equal(Object.hasOwn(manifest.commands || {}, '_execute_action'), false)
  assert.doesNotMatch(optionsSource, /_execute_action|打开 Popup/)
})

test('manifest requests full site access at install time', () => {
  const manifest = JSON.parse(readProjectFile('src/manifest.json'))

  assert.deepEqual(manifest.host_permissions, ['http://*/*', 'https://*/*'])
  assert.equal(Object.hasOwn(manifest, 'optional_host_permissions'), false)
})
