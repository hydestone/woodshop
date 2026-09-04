// Node built-in test runner: `node --test tests/`
// Proves the paging loop in src/db.js fetchAll(): concatenates full pages,
// stops on a short page, propagates errors instead of returning partial data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Extract fetchAll + PAGE from db.js without importing Supabase
const src = readFileSync(new URL('../src/db.js', import.meta.url), 'utf8')
const start = src.indexOf('const PAGE = 1000')
const end = src.indexOf('export async function loadAll')
const fetchAll = new Function(src.slice(start, end) + '\nreturn fetchAll')()

const mockQuery = (rowsByPage, errorAtPage = -1) => () => ({
  range: async (from, to) => {
    const page = from / 1000
    if (page === errorAtPage) return { data: null, error: new Error('boom') }
    return { data: rowsByPage[page] || [], error: null }
  },
})
const rows = n => Array.from({ length: n }, (_, i) => ({ i }))

test('single short page returns all rows', async () => {
  const r = await fetchAll(mockQuery([rows(246)]))
  assert.equal(r.error, null); assert.equal(r.data.length, 246)
})
test('exact-page boundary fetches the empty next page and stops', async () => {
  const r = await fetchAll(mockQuery([rows(1000), []]))
  assert.equal(r.data.length, 1000)
})
test('multi-page concatenation beyond old 500/1000 caps', async () => {
  const r = await fetchAll(mockQuery([rows(1000), rows(1000), rows(337)]))
  assert.equal(r.data.length, 2337)
})
test('error on a later page propagates — never returns partial data as complete', async () => {
  const r = await fetchAll(mockQuery([rows(1000), rows(1000)], 1))
  assert.equal(r.data, null); assert.ok(r.error)
})
