import { useState, useCallback, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'

// ── Bin-packing (First Fit Decreasing) ───────────────────────────────────────
function optimizeCuts(cuts, stockLengths, kerfIn) {
  const pieces = []
  cuts.forEach(c => { for (let i = 0; i < c.qty; i++) pieces.push(c.length) })
  if (!pieces.length || !stockLengths.length) return { boards: [], summary: {} }
  pieces.sort((a, b) => b - a)
  const stocks = [...stockLengths].sort((a, b) => a - b)
  const boards = []
  for (const piece of pieces) {
    let placed = false
    for (const board of boards) {
      if (piece + kerfIn <= board.stockLength - board.used + 0.0001) {
        board.cuts.push(piece); board.used += piece + kerfIn; placed = true; break
      }
    }
    if (!placed) {
      const stock = stocks.find(s => s >= piece + kerfIn)
      if (!stock) return null
      boards.push({ stockLength: stock, cuts: [piece], used: piece + kerfIn })
    }
  }
  const summary = {}
  boards.forEach(b => { summary[b.stockLength] = (summary[b.stockLength] || 0) + 1 })
  return { boards, summary }
}

// ── Fraction display ──────────────────────────────────────────────────────────
const FRACS = [[1,2],[1,4],[3,4],[1,8],[3,8],[5,8],[7,8],[1,16],[3,16],[5,16],[7,16],[9,16],[11,16],[13,16],[15,16]]
function toFraction(decimal) {
  if (decimal === 0) return '0'
  if (Number.isInteger(decimal)) return `${decimal}"`
  const whole = Math.floor(decimal)
  const frac = decimal - whole
  let best = FRACS[0], bestDiff = Infinity
  for (const f of FRACS) {
    const diff = Math.abs(frac - f[0]/f[1])
    if (diff < bestDiff) { bestDiff = diff; best = f }
  }
  if (bestDiff < 0.01) {
    const fracStr = `${best[0]}/${best[1]}"`
    return whole > 0 ? `${whole} ${fracStr}` : fracStr
  }
  return `${decimal.toFixed(3)}"`
}

function inToFtIn(inches) {
  const ft = Math.floor(inches / 12)
  const ins = inches % 12
  if (ft === 0) return toFraction(ins)
  if (ins < 0.001) return `${ft}'`
  return `${ft}' ${toFraction(ins)}`
}

function roundTo8th(v)  { return Math.round(v * 8)  / 8  }
function roundTo16th(v) { return Math.round(v * 16) / 16 }

// ── Parse a single value: handles decimals, fractions, whole numbers ──────────
// Input: "3/8", "1 3/8", "5.5", "42", ""
// Returns: inches as float, or null if invalid
function parseValue(str) {
  str = (str || '').trim()
  if (!str) return 0
  // Mixed: "1 3/8"
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3])
  // Fraction: "3/8"
  const frac = str.match(/^(\d+)\/(\d+)$/)
  if (frac) return parseInt(frac[1]) / parseInt(frac[2])
  // Decimal or integer
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

// ── Parse full length string into inches ─────────────────────────────────────
// Supports: "3ft6", "3'6", "42in", "42", "3.5ft", "96"
function parseLength(str) {
  str = (str || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!str) return null
  // "3'6" or "3' 6" or "3ft6" or "3ft 6in"
  const ftIn = str.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|')\s*(\d+(?:[/ ]\d+)?)(?:"|in)?$/)
  if (ftIn) return parseFloat(ftIn[1]) * 12 + (parseValue(ftIn[2]) || 0)
  // "42in" or "42\"" or bare number
  const inOnly = str.match(/^(\d+(?:[/ ]\d+)?)\s*(?:"|in|inch|inches)?$/)
  if (inOnly) return parseValue(inOnly[1])
  // "8ft" or "8'"
  const ftOnly = str.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|')$/)
  if (ftOnly) return parseFloat(ftOnly[1]) * 12
  return null
}

// ── Cut bar ───────────────────────────────────────────────────────────────────
const COLORS = ['#0F1E38','#2D5A3D','#1D4ED8','#92400E','#6B21A8','#065F46','#7C2D12']
function CutBar({ board, kerfIn }) {
  const waste = board.stockLength - board.used
  return (
    <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-2)', marginTop: 8 }}>
      {board.cuts.map((cut, i) => (
        <div key={i} title={inToFtIn(cut)} style={{
          width: `${(cut / board.stockLength) * 100}%`,
          background: COLORS[i % COLORS.length],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden',
          borderRight: i < board.cuts.length - 1 ? `${Math.max(1, (kerfIn / board.stockLength) * 100)}% solid rgba(255,255,255,.4)` : 'none',
        }}>
          {(cut / board.stockLength) > 0.1 ? inToFtIn(cut) : ''}
        </div>
      ))}
      {waste > 0.1 && (
        <div style={{
          flex: 1,
          background: 'repeating-linear-gradient(45deg,var(--fill),var(--fill) 4px,var(--border-2) 4px,var(--border-2) 8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: 'var(--text-4)',
        }}>
          {(waste / board.stockLength) > 0.1 ? `waste ${inToFtIn(waste)}` : ''}
        </div>
      )}
    </div>
  )
}

// ── ft + in split input ───────────────────────────────────────────────────────
// Stores as { ft: string, ins: string }
// Fractions allowed in inches: "3/8", "1 3/8", "5.5"
function FtInInput({ value, onChange, onTab, onEnter, inputRef, id }) {
  const insRef = useRef()
  const ftVal = value.ft || ''
  const insVal = value.ins || ''

  const preview = (() => {
    const ftNum = parseFloat(ftVal) || 0
    const insNum = parseValue(insVal) || 0
    const total = ftNum * 12 + insNum
    return total > 0 ? inToFtIn(total) : ''
  })()

  const handleFtKey = e => {
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); insRef.current?.focus() }
    if (e.key === 'Enter') { insRef.current?.focus() }
  }
  const handleInsKey = e => {
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); onTab?.() }
    if (e.key === 'Enter') onEnter?.()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        ref={inputRef}
        className="form-input"
        value={ftVal}
        onChange={e => onChange({ ft: e.target.value, ins: insVal })}
        onKeyDown={handleFtKey}
        placeholder="0"
        style={{ width: 52, fontSize: 14, textAlign: 'right' }}
      />
      <span style={{ fontSize: 13, color: 'var(--text-3)', flexShrink: 0 }}>ft</span>
      <input
        ref={insRef}
        className="form-input"
        value={insVal}
        onChange={e => onChange({ ft: ftVal, ins: e.target.value })}
        onKeyDown={handleInsKey}
        placeholder="0"
        style={{ width: 64, fontSize: 14, textAlign: 'right' }}
      />
      <span style={{ fontSize: 13, color: 'var(--text-3)', flexShrink: 0 }}>in</span>
      {preview && <span style={{ fontSize: 11, color: 'var(--text-4)', flexShrink: 0, marginLeft: 2 }}>= {preview}</span>}
    </div>
  )
}

function ftInToInches(val) {
  const ft = parseFloat(val.ft) || 0
  const ins = parseValue(val.ins) || 0
  return ft * 12 + ins
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CutCalculator() {
  const toast = useToast()
  const nextId = () => Date.now() + Math.random()

  const [cuts, setCuts] = useState([
    { id: 1, val: { ft: '', ins: '' }, qty: 1, label: '' },
    { id: 2, val: { ft: '', ins: '' }, qty: 1, label: '' },
    { id: 3, val: { ft: '', ins: '' }, qty: 1, label: '' },
  ])
  const [stockStr, setStockStr] = useState("8', 10', 12'")
  const [kerfStr, setKerfStr] = useState('0.125')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const firstRefs = useRef({})

  const addCut = () => {
    const id = nextId()
    setCuts(c => [...c, { id, val: { ft: '', ins: '' }, qty: 1, label: '' }])
    setTimeout(() => firstRefs.current[id]?.focus(), 30)
  }

  const removeCut = id => setCuts(c => c.filter(x => x.id !== id))
  const updateCut = (id, field, val) => setCuts(c => c.map(x => x.id === id ? { ...x, [field]: val } : x))

  const calculate = () => {
    setError(null); setResult(null)
    const parsedCuts = []
    for (const c of cuts) {
      const raw = ftInToInches(c.val)
      if (raw <= 0) continue
      const len = roundTo16th(raw)
      const qty = Math.max(1, parseInt(c.qty) || 1)
      parsedCuts.push({ length: len, qty, label: c.label.trim() })
    }
    if (!parsedCuts.length) { setError('Enter at least one cut length.'); return }

    const stockLengths = stockStr.split(/[,\s]+/).map(s => {
      const v = parseLength(s.trim())
      return v ? roundTo8th(v) : null
    }).filter(Boolean)
    if (!stockLengths.length) { setError("Enter stock lengths like: 8', 10', 12'"); return }

    const kerfIn = parseFloat(kerfStr) || 0.125
    const maxCut = Math.max(...parsedCuts.map(c => c.length))
    if (maxCut + kerfIn > Math.max(...stockLengths)) {
      setError(`Longest cut (${inToFtIn(maxCut)}) doesn't fit any stock length.`); return
    }

    const res = optimizeCuts(parsedCuts, stockLengths, kerfIn)
    if (!res) { setError('Could not fit all cuts. Check stock lengths are long enough.'); return }
    res.parsedCuts = parsedCuts
    res.kerfIn = kerfIn
    setResult(res)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1 className="page-title">Cut Calculator</h1>
        <p className="page-subtitle">Optimize trim &amp; moulding cuts to minimize waste.</p>
      </div>

      <div className="scroll-page" style={{ paddingBottom: 60 }}>
        <div style={{ padding: '0 20px' }}>

          {/* Cut list */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 }}>Cuts Needed</div>
          <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 10 }}>
            Inches field accepts fractions: <code style={{fontFamily:'monospace'}}>3/8</code>, <code style={{fontFamily:'monospace'}}>1 3/16</code>, <code style={{fontFamily:'monospace'}}>5.5</code>
          </p>

          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border-2)', overflow: 'hidden', marginBottom: 16 }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 1fr 28px', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-2)', background: 'var(--fill)' }}>
              {['Length', 'Qty', 'Label (optional)', ''].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</div>
              ))}
            </div>

            {cuts.map((cut, i) => (
              <div key={cut.id} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 1fr 28px', gap: 8, padding: '8px 12px', borderBottom: i < cuts.length - 1 ? '1px solid var(--border-2)' : 'none', alignItems: 'center' }}>
                <FtInInput
                  value={cut.val}
                  onChange={val => updateCut(cut.id, 'val', val)}
                  inputRef={el => firstRefs.current[cut.id] = el}
                  onTab={() => {
                    // Tab from inches → focus qty of same row
                  }}
                  onEnter={() => {
                    if (i === cuts.length - 1) addCut()
                    else firstRefs.current[cuts[i+1].id]?.focus()
                  }}
                />
                <input
                  className="form-input"
                  type="number" min="1" max="999"
                  value={cut.qty}
                  onChange={e => updateCut(cut.id, 'qty', e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { if (i === cuts.length - 1) addCut(); else firstRefs.current[cuts[i+1].id]?.focus() } }}
                  style={{ fontSize: 14, textAlign: 'center' }}
                />
                <input
                  className="form-input"
                  placeholder="e.g. Left rail"
                  value={cut.label}
                  onChange={e => updateCut(cut.id, 'label', e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { if (i === cuts.length - 1) addCut(); else firstRefs.current[cuts[i+1].id]?.focus() } }}
                  style={{ fontSize: 14 }}
                />
                <button onClick={() => removeCut(cut.id)} disabled={cuts.length === 1}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 18, padding: 0, opacity: cuts.length === 1 ? .3 : 1 }}>×</button>
              </div>
            ))}
            <div style={{ padding: '8px 12px' }}>
              <button className="btn-text" onClick={addCut} style={{ fontSize: 13 }}>+ Add cut</button>
            </div>
          </div>

          {/* Stock lengths */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>Available Stock Lengths</div>
          <input className="form-input" placeholder="8', 10', 12' or 96, 120, 144" value={stockStr} onChange={e => setStockStr(e.target.value)} style={{ marginBottom: 4, fontSize: 14 }} />
          <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 16 }}>
            Separate with commas. Accepts feet (8ft, 8', 10') or inches (96, 120, 144).
          </p>

          {/* Kerf */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>Kerf Width</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input className="form-input" type="number" step="0.0625" min="0" max="1" value={kerfStr} onChange={e => setKerfStr(e.target.value)} style={{ width: 80, fontSize: 14 }} />
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>inches</span>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-4)', flex: 1, marginTop: 20 }}>Standard blade = 0.125" (1/8") · Thin kerf = 0.0625" (1/16")</p>
          </div>

          {error && <div style={{ background: 'var(--red-dim)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '12px' }} onClick={calculate}>
            Calculate
          </button>
        </div>

        {/* Results */}
        {result && (
          <div style={{ padding: '24px 20px 0' }}>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>What to Buy</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {Object.entries(result.summary).sort(([a],[b]) => Number(a)-Number(b)).map(([len, count]) => (
                <div key={len} style={{ background: '#0F1E38', borderRadius: 10, padding: '12px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>{count}</div>
                  <div style={{ fontSize: 13, color: '#8BA8D0', marginTop: 2 }}>× {inToFtIn(Number(len))}</div>
                </div>
              ))}
            </div>

            {/* Stats */}
            {(() => {
              const totalStock = result.boards.reduce((s,b) => s + b.stockLength, 0)
              const totalUsed  = result.boards.reduce((s,b) => s + b.used, 0)
              const waste = totalStock - totalUsed
              const pct = Math.round((waste / totalStock) * 100)
              return (
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <div style={{ flex:1, background:'var(--surface)', borderRadius:10, padding:'12px', border:'1px solid var(--border-2)', textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>{result.boards.length}</div>
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>boards total</div>
                  </div>
                  <div style={{ flex:1, background:'var(--surface)', borderRadius:10, padding:'12px', border:'1px solid var(--border-2)', textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:700, color: pct > 25 ? 'var(--orange)' : 'var(--forest)' }}>{pct}%</div>
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>waste</div>
                  </div>
                  <div style={{ flex:1, background:'var(--surface)', borderRadius:10, padding:'12px', border:'1px solid var(--border-2)', textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>{inToFtIn(Math.max(0, waste))}</div>
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>cutoff total</div>
                  </div>
                </div>
              )
            })()}

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>Cut Plan — Board by Board</div>
            {result.boards.map((board, bi) => {
              const waste = board.stockLength - board.used
              return (
                <div key={bi} style={{ background:'var(--surface)', borderRadius:10, border:'1px solid var(--border-2)', padding:'14px 16px', marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>
                      Board {bi+1} &nbsp;·&nbsp; <span style={{ color:'var(--accent)', fontWeight:600 }}>{inToFtIn(board.stockLength)}</span>
                    </span>
                    <span style={{ fontSize:12, color:'var(--text-4)' }}>waste {inToFtIn(Math.max(0, waste))}</span>
                  </div>

                  <CutBar board={board} kerfIn={result.kerfIn} />

                  <div style={{ marginTop: 10, display:'flex', flexWrap:'wrap', gap:6 }}>
                    {board.cuts.map((cut, ci) => {
                      const matched = result.parsedCuts?.find(c => Math.abs(c.length - cut) < 0.01)
                      const displayLabel = matched?.label || inToFtIn(cut)
                      return (
                        <span key={ci} style={{
                          fontSize:12, padding:'3px 10px', borderRadius:99, fontWeight:600,
                          background: COLORS[ci % COLORS.length] + '18',
                          color: COLORS[ci % COLORS.length],
                          border: `1px solid ${COLORS[ci % COLORS.length]}40`,
                        }}>
                          {displayLabel}
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
