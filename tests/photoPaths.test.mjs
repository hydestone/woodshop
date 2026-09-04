// Derivative path helpers (src/supabase.js) and trash URL stripping (src/db.js)
// are pure; restore/delete correctness depends on them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sb = readFileSync(new URL('../src/supabase.js', import.meta.url), 'utf8')
const a = sb.indexOf('export const DERIV'); const b = sb.indexOf('export function photoUrls')
const paths = new Function(sb.slice(a, b).replaceAll('export ', '') + '\nreturn { DERIV, derivPath, allPhotoPaths }')()

const db = readFileSync(new URL('../src/db.js', import.meta.url), 'utf8')
const c = db.indexOf('const stripUrls'); const d = db.indexOf('\n', c)
const stripUrls = new Function(db.slice(c, d) + '\nreturn stripUrls')()

test('derivative paths are deterministic siblings of the original', () => {
  assert.equal(paths.derivPath('proj1/abc.jpg', 'thumb'),  'proj1/abc.jpg.t.jpg')
  assert.equal(paths.derivPath('proj1/abc.jpg', 'medium'), 'proj1/abc.jpg.m.jpg')
  assert.equal(paths.derivPath(null, 'thumb'), null)
})
test('allPhotoPaths covers original + both derivatives for delete', () => {
  assert.deepEqual(paths.allPhotoPaths('g/x.png'), ['g/x.png', 'g/x.png.t.jpg', 'g/x.png.m.jpg'])
})
test('derivative sizes are ordered thumb < medium and under the 2400px original', () => {
  assert.ok(paths.DERIV.thumb.maxPx < paths.DERIV.medium.maxPx && paths.DERIV.medium.maxPx < 2400)
})
test('stripUrls removes only client-side URL fields before DB upsert', () => {
  const row = stripUrls({ id: 'p1', storage_path: 's', url: 'u', thumbUrl: 't', mediumUrl: 'm', caption: 'c' })
  assert.deepEqual(row, { id: 'p1', storage_path: 's', caption: 'c' })
})
