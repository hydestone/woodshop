import { useState, useCallback } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'

// ── Bin-packing algorithm (First Fit Decreasing) ──────────────────────────────
// Returns: { boards: [{ stockLength, cuts: [length], waste }], summary: {[len]: count} }
function optimizeCuts(cuts, stockLengths, kerfIn) {
  // Expand cuts by quantity into individual pieces
  const pieces = []
  cuts.forEach(c => {
    for (let i = 0; i < c.qty; i++) pieces.push(c.length)
  })

  if (!pieces.length || !stockLengths.length) return { boards: [], summary: {} }

  // Sort pieces longest first (FFD)
  pieces.sort((a, b) => b - a)

  // Available stock lengths sorted shortest first
  const stocks = [...stockLengths].sort((a, b) => a - b)

  const boards = [] // { stockLength, cuts: [], used }

  for (const piece of pieces) {
    let placed = false

    // Try to fit in an existing board
    for (const board of boards) {
      const remaining = board.stockLength - board.used
      if (piece + kerfIn <= remaining + 0.0001) {
        board.cuts.push(piece)
        board.used += piece + kerfIn
        placed = true
        break
      }
    }

    if (!placed) {
      // Start a new board — pick smallest stock length that fits this piece
      const stock = stocks.find(s => s >= piece + kerfIn)
      if (!stock) return null // piece too long for any stock length

      const board = { stockLength: stock, cuts: [piece], used: piece + kerfIn }
      boards.push(board)
    }
  }

  // After initial placement, try to consolidate — replace multiple short boards
  // with fewer longer ones if it saves money (optional pass)

  // Build summary
  const summary = {}
  boards.forEach(b => {
    summary[b.stockLength] = (summary[b.stockLength] || 0) + 1
  })

  return { boards, summary }
}

// ── Fraction display helper ───────────────────────────────────────────────────
function toFraction(decimal) {
  if (Number.isInteger(decimal)) return `${decimal}"`
  const whole = Math.floor(decimal)
  const frac = decimal - whole
  const fracs = [[1,2],[1,4],[3,4],[1,8],[3,8],[5,8],[7,8],[1,16],[3,16],[5,16],[7,16],[9,16],[11,16],[13,16],[15,16]]
  let best = fracs[0], bestDiff = Math.abs(frac - fracs[0][0]/fracs[0][1])
  for (const f of fracs) {
    const diff = Math.abs(frac - f[0]/f[1])
    if (diff < bestDiff) { bestDiff = diff; best = f }
  }
  if (bestDiff < 0.01) {
    return whole > 0 ? `${whole} ${best[0]}/${best[1]}"` : `${best[0]}/${best[1]}"`
  }
  return `${decimal.toFixed(2)}"`
}

function inToFtIn(inches) {
  const ft = Math.floor(inches / 12)
  const ins = inches % 12
  if (ft === 0) return toFraction(ins)
  if (ins === 0) return `${ft}'`
  return `${ft}' ${toFraction(ins)}`
}

// ── Round to nearest 1/8" or 1/16" ──────────────────────────────────────────
function roundTo8th(inches)  { return Math.round(inches * 8)  / 8  }
function roundTo16th(inches) { return Math.round(inches * 16) / 16 }

// ── Parse input like "3'6", "42", "3.5ft" into inches ───────────────────────
function parseLength(str) {
  str = str.trim().toLowerCase().replace(/\s+/g, ' ')
  // e.g. "3'6\"" or "3' 6" or "3'6"
  const ftIn = str.match(/^(\d+(?:\.\d+)?)'(?:\s*(\d+(?:\.\d+)?)(?:"|in)?)?$/)
  if (ftIn) return parseFloat(ftIn[1]) * 12 + (ftIn[2] ? parseFloat(ftIn[2]) : 0)
  // e.g. "42in" or "42"" or "42"
  const inMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?$/)
  if (inMatch) return parseFloat(inMatch[1])
  // e.g. "3.5ft" or "3.5'"
  const ftOnly = str.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|')$/)
  if (ftOnly) return parseFloat(ftOnly[1]) * 12
  return null
}

// ── Accepted format cheat sheet ──────────────────────────────────────────────
function CheatSheet() {
  const [open, setOpen] = useState(false)
  const examples = [
    ['96', '96 inches = 8 feet'],
    ['8ft', '8 feet'],
    ['3ft6', '3 feet 6 inches'],
    ['3ft6in', '3 feet 6 inches'],
    ['42in', '42 inches'],
    ['42', '42 inches (bare number = inches)'],
    ['10.5ft', '10.5 feet'],
    ['120', '120 inches = 10 feet'],
  ]
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        fontSize: 12, color: 'var(--accent)', fontFamily: 'inherit', fontWeight: 600,
      }}>
        {open ? '▾' : '▸'} Accepted length formats
      </button>
      {open && (
        <div style={{ marginTop: 8, background: 'var(--fill)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px', fontSize: 12 }}>
            {examples.map(([ex, desc]) => (
              <>
                <code key={ex} style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>{ex}</code>
                <span key={ex+'d'} style={{ color: 'var(--text-3)' }}>{desc}</span>
              </>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 8, marginBottom: 0 }}>
            Cuts rounded to nearest 1/16" · Stock lengths rounded to nearest 1/8"
          </p>
        </div>
      )}
    </div>
  )
}

// ── Cut bar visualization ─────────────────────────────────────────────────────
function CutBar({ board, kerfIn }) {
  const colors = ['#0F1E38','#2D5A3D','#1D4ED8','#92400E','#6B21A8','#065F46','#7C2D12']
  const waste = board.stockLength - board.used
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-2)' }}>
        {board.cuts.map((cut, i) => (
          <div key={i} title={inToFtIn(cut)}
            style={{
              width: `${(cut / board.stockLength) * 100}%`,
              background: colors[i % colors.length],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden',
              borderRight: i < board.cuts.length - 1 ? `${Math.max(1, (kerfIn / board.stockLength) * 100)}% solid rgba(255,255,255,.5)` : 'none',
            }}>
            {(cut / board.stockLength) > 0.08 ? inToFtIn(cut) : ''}
          </div>
        ))}
        {waste > 0.1 && (
          <div style={{
            flex: 1, background: 'repeating-linear-gradient(45deg,var(--fill),var(--fill) 4px,var(--border-2) 4px,var(--border-2) 8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: 'var(--text-4)',
          }}>
            {(waste / board.stockLength) > 0.08 ? `waste ${inToFtIn(waste)}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CutCalculator() {
  const { data } = useCtx()
  const toast = useToast()

  const [cuts, setCuts] = useState([
    { id: 1, lengthStr: '', qty: 1, label: '' },
    { id: 2, lengthStr: '', qty: 1, label: '' },
  ])
  const [stockLengthStr, setStockLengthStr] = useState('96, 120, 144')
  const [kerfStr, setKerfStr] = useState('0.125')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [calcName, setCalcName] = useState('')

  const nextId = useCallback(() => Date.now(), [])

  const addCut = () => setCuts(c => [...c, { id: nextId(), lengthStr: '', qty: 1, label: '' }])
  const removeCut = id => setCuts(c => c.filter(x => x.id !== id))
  const updateCut = (id, field, val) => setCuts(c => c.map(x => x.id === id ? { ...x, [field]: val } : x))

  const calculate = () => {
    setError(null)
    setResult(null)

    // Parse cuts
    const parsedCuts = []
    for (const c of cuts) {
      if (!c.lengthStr.trim()) continue
      const raw = parseLength(c.lengthStr)
      if (!raw || raw <= 0) { setError(`Can't read "${c.lengthStr}". Try: 42, 3ft6, 3'6, 8ft, 96`); return }
      const len = roundTo16th(raw) // cuts to 1/16" precision
      const qty = Math.max(1, parseInt(c.qty) || 1)
      parsedCuts.push({ length: len, qty, label: c.label || inToFtIn(len) })
    }
    if (!parsedCuts.length) { setError('Enter at least one cut length.'); return }

    // Parse stock lengths
    const stockLengths = stockLengthStr.split(/[,\s]+/).map(s => {
      const v = parseLength(s.trim())
      return v ? roundTo8th(v) : null // stock lengths to 1/8" precision
    }).filter(Boolean)
    if (!stockLengths.length) { setError('Enter at least one stock length.'); return }

    // Parse kerf
    const kerfIn = parseFloat(kerfStr) || 0.125

    // Check all cuts fit in at least one stock length
    const maxCut = Math.max(...parsedCuts.map(c => c.length))
    const maxStock = Math.max(...stockLengths)
    if (maxCut + kerfIn > maxStock) {
      setError(`Longest cut (${inToFtIn(maxCut)}) doesn't fit in any stock length.`)
      return
    }

    const res = optimizeCuts(parsedCuts, stockLengths, kerfIn)
    if (!res) { setError('Could not fit all cuts. Check that stock lengths are long enough.'); return }

    // Annotate boards with cut labels
    res.parsedCuts = parsedCuts
    res.kerfIn = kerfIn
    setResult(res)
  }

  const projects = data?.projects || []

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1 className="page-title">Cut Calculator</h1>
        <p className="page-subtitle">Optimize trim and moulding cut lists to minimize waste.</p>
      </div>

      <div className="scroll-page" style={{ paddingBottom: 60 }}>

        {/* Inputs */}
        <div style={{ padding: '0 20px' }}>

          {/* Calculator name */}
          <input
            className="form-input"
            placeholder="Name this calc (optional)"
            value={calcName}
            onChange={e => setCalcName(e.target.value)}
            style={{ marginBottom: 16, fontSize: 14 }}
          />

          {/* Cuts needed */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 }}>
            Cuts Needed
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border-2)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 1fr 32px', gap: 0, padding: '8px 12px', borderBottom: '1px solid var(--border-2)', background: 'var(--fill)' }}>
              {['Length', 'Qty', 'Label (optional)', ''].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</div>
              ))}
            </div>
            {cuts.map((cut, i) => (
              <div key={cut.id} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 1fr 32px', gap: 8, padding: '8px 12px', borderBottom: i < cuts.length - 1 ? '1px solid var(--border-2)' : 'none', alignItems: 'center' }}>
                <input
                  className="form-input"
                  placeholder="42 or 3ft6in"
                  value={cut.lengthStr}
                  onChange={e => updateCut(cut.id, 'lengthStr', e.target.value)}
                  style={{ fontSize: 14 }}
                />
                <input
                  className="form-input"
                  type="number" min="1" max="999"
                  value={cut.qty}
                  onChange={e => updateCut(cut.id, 'qty', e.target.value)}
                  style={{ fontSize: 14, textAlign: 'center' }}
                />
                <input
                  className="form-input"
                  placeholder="e.g. Left side"
                  value={cut.label}
                  onChange={e => updateCut(cut.id, 'label', e.target.value)}
                  style={{ fontSize: 14 }}
                />
                <button
                  onClick={() => removeCut(cut.id)}
                  disabled={cuts.length === 1}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 18, padding: 0, opacity: cuts.length === 1 ? .3 : 1 }}
                >×</button>
              </div>
            ))}
            <div style={{ padding: '8px 12px' }}>
              <button className="btn-text" onClick={addCut} style={{ fontSize: 13 }}>+ Add cut</button>
            </div>
          </div>

          {/* Stock lengths */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 }}>
            Available Stock Lengths
          </div>
          <input
            className="form-input"
            placeholder='e.g. 96, 120, 144 (inches) or 8ft, 10ft, 12ft'
            value={stockLengthStr}
            onChange={e => setStockLengthStr(e.target.value)}
            style={{ marginBottom: 4, fontSize: 14 }}
          />
          <CheatSheet />

          {/* Kerf */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>Kerf Width (inches)</div>
              <input
                className="form-input"
                type="number" step="0.0625" min="0" max="1"
                value={kerfStr}
                onChange={e => setKerfStr(e.target.value)}
                style={{ width: 100, fontSize: 14 }}
              />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 20, flex: 1 }}>
              Standard saw blade = 0.125" (1/8"). Thin kerf = 0.0625" (1/16").
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'var(--red-dim)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Calculate */}
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '12px' }} onClick={calculate}>
            Calculate
          </button>
        </div>

        {/* Results */}
        {result && (
          <div style={{ padding: '24px 20px 0' }}>

            {/* Summary */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>
              What to Buy
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {Object.entries(result.summary).sort(([a],[b]) => Number(a)-Number(b)).map(([len, count]) => (
                <div key={len} style={{ background: '#0F1E38', borderRadius: 10, padding: '12px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>{count}</div>
                  <div style={{ fontSize: 13, color: '#8BA8D0', marginTop: 2 }}>× {inToFtIn(Number(len))}</div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {(() => {
                const totalStock = result.boards.reduce((s,b) => s + b.stockLength, 0)
                const totalUsed = result.boards.reduce((s,b) => s + b.used, 0)
                const waste = totalStock - totalUsed
                const pct = Math.round((waste / totalStock) * 100)
                return (
                  <>
                    <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 10, padding: '12px', border: '1px solid var(--border-2)', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{result.boards.length}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>boards total</div>
                    </div>
                    <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 10, padding: '12px', border: '1px solid var(--border-2)', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: pct > 25 ? 'var(--orange)' : 'var(--forest)' }}>{pct}%</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>waste</div>
                    </div>
                    <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 10, padding: '12px', border: '1px solid var(--border-2)', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{inToFtIn(Math.round(waste))}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>cutoff waste</div>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Per board breakdown */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>
              Cut Plan — Board by Board
            </div>
            {result.boards.map((board, bi) => {
              const waste = board.stockLength - board.used
              return (
                <div key={bi} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border-2)', padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                      Board {bi + 1} &nbsp;·&nbsp; <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{inToFtIn(board.stockLength)}</span>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
                      waste {inToFtIn(Math.max(0, waste))}
                    </span>
                  </div>

                  <CutBar board={board} kerfIn={result.kerfIn} />

                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {board.cuts.map((cut, ci) => {
                      const colors = ['#0F1E38','#2D5A3D','#1D4ED8','#92400E','#6B21A8','#065F46','#7C2D12']
                      const matchedCut = result.parsedCuts?.find(c => Math.abs(c.length - cut) < 0.01)
                      return (
                        <span key={ci} style={{
                          fontSize: 12, padding: '3px 10px', borderRadius: 99, fontWeight: 600,
                          background: colors[ci % colors.length] + '18',
                          color: colors[ci % colors.length],
                          border: `1px solid ${colors[ci % colors.length]}40`,
                        }}>
                          {inToFtIn(cut)}{matchedCut?.label ? ` — ${matchedCut.label}` : ''}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
