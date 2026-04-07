// JDH Woodworks — Automated API & Database Test Suite
// Run with: node test.js
// Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
// and TEST_EMAIL / TEST_PASSWORD for a valid account

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load .env manually
const __dir = dirname(fileURLToPath(import.meta.url))
let env = {}
try {
  const raw = readFileSync(join(__dir, '.env'), 'utf8')
  raw.split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) env[k.trim()] = v.join('=').trim()
  })
} catch {}

const SUPABASE_URL  = env.VITE_SUPABASE_URL  || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY  = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const TEST_EMAIL    = env.TEST_EMAIL    || process.env.TEST_EMAIL    || 'johnhyde23@gmail.com'
const TEST_PASSWORD = env.TEST_PASSWORD || process.env.TEST_PASSWORD || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}
if (!TEST_PASSWORD) {
  console.error('❌  Add TEST_PASSWORD=yourpassword to your .env file')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const uid = () => Math.random().toString(36).slice(2, 10)

let passed = 0, failed = 0, skipped = 0
const failures = []

async function test(name, fn, critical = false) {
  try {
    await fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (e) {
    const msg = e.message || String(e)
    console.log(`  ✗  ${name}`)
    console.log(`     → ${msg}`)
    failed++
    if (critical) failures.push({ name, msg, critical: true })
    else failures.push({ name, msg })
  }
}

function skip(name, reason) {
  console.log(`  –  ${name} (${reason})`)
  skipped++
}

function section(name) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 50 - name.length))}`)
}

async function run() {
  console.log('JDH Woodworks — Automated Test Suite')
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log(`User: ${TEST_EMAIL}\n`)

  let userId = null
  let testProjectId = null
  let testStepId = null
  let testCoatId = null
  let testStockId = null
  let testLocationId = null

  // ── Auth ────────────────────────────────────────────────────────────────────
  section('Auth')

  await test('Sign in with correct credentials', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL, password: TEST_PASSWORD
    })
    if (error) throw new Error(error.message)
    if (!data.session) throw new Error('No session returned')
    userId = data.user.id
  }, true)

  await test('Session has correct user ID', async () => {
    const { data } = await supabase.auth.getUser()
    if (!data.user) throw new Error('No user in session')
    if (data.user.id !== userId) throw new Error(`User ID mismatch: ${data.user.id}`)
  }, true)

  await test('Sign out clears session', async () => {
    await supabase.auth.signOut()
    const { data } = await supabase.auth.getSession()
    if (data.session) throw new Error('Session still active after sign out')
  })

  await test('RLS blocks unauthenticated reads on projects', async () => {
    const { data, error } = await supabase.from('projects').select('id').limit(1)
    // Should return empty array (RLS filters), not an error
    if (error) throw new Error(error.message)
    if (data && data.length > 0) throw new Error('Unauthenticated read returned data — RLS may be off')
  }, true)

  await test('Sign back in for remaining tests', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL, password: TEST_PASSWORD
    })
    if (error) throw new Error(error.message)
    userId = data.user.id
  }, true)

  // ── Data Load ───────────────────────────────────────────────────────────────
  section('Data Load')

  const TABLES = ['projects','steps','coats','maintenance','shopping','photos',
    'wood_stock','brainstorming','finish_products','resources','shop_improvements',
    'categories','wood_locations','project_wood_sources','species','finishes','moisture_log']

  for (const table of TABLES) {
    await test(`${table} — SELECT returns array`, async () => {
      const { data, error } = await supabase.from(table).select('*').limit(5)
      if (error) throw new Error(error.message)
      if (!Array.isArray(data)) throw new Error('Expected array, got: ' + typeof data)
    })
  }

  // ── RLS Integrity ───────────────────────────────────────────────────────────
  section('RLS Integrity')

  await test('All projects have user_id set', async () => {
    const { data, error } = await supabase.from('projects').select('id').is('user_id', null)
    if (error) throw new Error(error.message)
    if (data.length > 0) throw new Error(`${data.length} projects missing user_id`)
  }, true)

  await test('All photos have user_id set', async () => {
    const { data, error } = await supabase.from('photos').select('id').is('user_id', null)
    if (error) throw new Error(error.message)
    if (data.length > 0) throw new Error(`${data.length} photos missing user_id`)
  }, true)

  await test('All projects belong to current user', async () => {
    const { data, error } = await supabase.from('projects').select('id, user_id')
    if (error) throw new Error(error.message)
    const wrong = data.filter(p => p.user_id !== userId)
    if (wrong.length > 0) throw new Error(`${wrong.length} projects belong to wrong user`)
  }, true)

  // ── Projects CRUD ───────────────────────────────────────────────────────────
  section('Projects CRUD')

  await test('INSERT project', async () => {
    const { data, error } = await supabase.from('projects')
      .insert({ id: uid(), name: `_test_${uid()}`, status: 'planning', created_at: new Date().toISOString(), user_id: userId })
      .select().single()
    if (error) throw new Error(error.message)
    if (!data.id) throw new Error('No ID returned')
    testProjectId = data.id
  }, true)

  await test('SELECT project by id', async () => {
    const { data, error } = await supabase.from('projects').select('*').eq('id', testProjectId).single()
    if (error) throw new Error(error.message)
    if (data.id !== testProjectId) throw new Error('ID mismatch')
  })

  await test('UPDATE project name', async () => {
    const newName = `_test_updated_${uid()}`
    const { error } = await supabase.from('projects').update({ name: newName }).eq('id', testProjectId)
    if (error) throw new Error(error.message)
    const { data } = await supabase.from('projects').select('name').eq('id', testProjectId).single()
    if (data.name !== newName) throw new Error('Update did not persist')
  })

  // ── Steps CRUD ──────────────────────────────────────────────────────────────
  section('Steps CRUD')

  await test('INSERT step', async () => {
    const { data, error } = await supabase.from('steps')
      .insert({ id: uid(), project_id: testProjectId, title: '_test step', completed: false, sort_order: 1, user_id: userId })
      .select().single()
    if (error) throw new Error(error.message)
    testStepId = data.id
  })

  await test('UPDATE step completed', async () => {
    const { error } = await supabase.from('steps').update({ completed: true }).eq('id', testStepId)
    if (error) throw new Error(error.message)
  })

  await test('DELETE step', async () => {
    const { error } = await supabase.from('steps').delete().eq('id', testStepId)
    if (error) throw new Error(error.message)
  })

  // ── Coats CRUD ──────────────────────────────────────────────────────────────
  section('Coats CRUD')

  await test('INSERT coat', async () => {
    const { data, error } = await supabase.from('coats')
      .insert({ id: uid(), project_id: testProjectId, product: '_test coat', coat_number: 1, interval_value: 4, interval_unit: 'hours', user_id: userId })
      .select().single()
    if (error) throw new Error(error.message)
    testCoatId = data.id
  })

  await test('UPDATE coat applied_at', async () => {
    const { error } = await supabase.from('coats').update({ applied_at: new Date().toISOString() }).eq('id', testCoatId)
    if (error) throw new Error(error.message)
  })

  await test('DELETE coat', async () => {
    const { error } = await supabase.from('coats').delete().eq('id', testCoatId)
    if (error) throw new Error(error.message)
  })

  // ── Wood Stock CRUD ─────────────────────────────────────────────────────────
  section('Wood Stock CRUD')

  await test('INSERT wood location', async () => {
    const { data, error } = await supabase.from('wood_locations')
      .insert({ id: uid(), name: `_test_loc_${uid()}`, created_at: new Date().toISOString(), user_id: userId })
      .select().single()
    if (error) throw new Error(error.message)
    testLocationId = data.id
  })

  await test('INSERT wood stock', async () => {
    const { data, error } = await supabase.from('wood_stock')
      .insert({ id: uid(), species: '_test species', status: 'Drying', location_id: testLocationId, created_at: new Date().toISOString(), user_id: userId })
      .select().single()
    if (error) throw new Error(error.message)
    testStockId = data.id
  })

  await test('INSERT project_wood_source junction', async () => {
    const { error } = await supabase.from('project_wood_sources')
      .insert({ id: uid(), project_id: testProjectId, wood_stock_id: testStockId, created_at: new Date().toISOString(), user_id: userId })
    if (error) throw new Error(error.message)
  })

  await test('DELETE project_wood_sources by project_id', async () => {
    const { error } = await supabase.from('project_wood_sources').delete().eq('project_id', testProjectId)
    if (error) throw new Error(error.message)
  })

  await test('DELETE wood stock', async () => {
    const { error } = await supabase.from('wood_stock').delete().eq('id', testStockId)
    if (error) throw new Error(error.message)
  })

  await test('DELETE wood location', async () => {
    const { error } = await supabase.from('wood_locations').delete().eq('id', testLocationId)
    if (error) throw new Error(error.message)
  })

  // ── Shopping CRUD ───────────────────────────────────────────────────────────
  section('Shopping CRUD')

  await test('INSERT shopping items', async () => {
    const { error } = await supabase.from('shopping')
      .insert([{ id: uid(), item: '_test item', completed: false, created_at: new Date().toISOString(), user_id: userId }])
    if (error) throw new Error(error.message)
  })

  await test('DELETE completed shopping items', async () => {
    const { error } = await supabase.from('shopping').delete().like('item', '_test%')
    if (error) throw new Error(error.message)
  })

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  section('Cleanup')

  await test('DELETE test project', async () => {
    const { error } = await supabase.from('projects').delete().eq('id', testProjectId)
    if (error) throw new Error(error.message)
  }, true)

  // ── Public Portfolio ─────────────────────────────────────────────────────────
  section('Public Portfolio (anon access)')

  await test('Sign out for anon test', async () => {
    await supabase.auth.signOut()
  })

  await test('Anon can read photos (portfolio page)', async () => {
    const { data, error } = await supabase.from('photos').select('id, tags').limit(5)
    if (error) throw new Error(error.message)
    if (!Array.isArray(data)) throw new Error('Expected array')
  }, true)

  await test('Anon can read projects (portfolio page)', async () => {
    const { data, error } = await supabase.from('projects').select('id, name').limit(5)
    if (error) throw new Error(error.message)
    if (!Array.isArray(data)) throw new Error('Expected array')
  }, true)

  await test('Anon cannot INSERT projects', async () => {
    const { error } = await supabase.from('projects')
      .insert({ id: uid(), name: '_anon_test', status: 'planning', created_at: new Date().toISOString() })
    if (!error) throw new Error('Expected RLS to block anon insert — but it succeeded')
  }, true)

  // ── Summary ─────────────────────────────────────────────────────────────────
  const total = passed + failed + skipped
  const pct = Math.round((passed / (passed + failed)) * 100) || 0
  console.log('\n' + '═'.repeat(54))
  console.log(`  ${passed} passed · ${failed} failed · ${skipped} skipped  (${pct}%)`)
  if (failures.length > 0) {
    console.log('\n  Critical failures:')
    failures.filter(f => f.critical).forEach(f => console.log(`    ✗ ${f.name}`))
    if (failures.some(f => !f.critical)) {
      console.log('\n  Other failures:')
      failures.filter(f => !f.critical).forEach(f => console.log(`    ✗ ${f.name}`))
    }
  } else {
    console.log('  All tests passed ✓')
  }
  console.log('═'.repeat(54))

  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error('Test runner error:', e); process.exit(1) })
