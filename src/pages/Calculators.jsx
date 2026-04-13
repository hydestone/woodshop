import { useState, useCallback, useMemo, useEffect, useRef } from 'react'

// ─── Math utilities ────────────────────────────────────────────────────────────
function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a) }
function fracReduce(n, d) {
  if (d === 0) return { n: 0, d: 1 }
  const g = gcd(Math.abs(n), Math.abs(d))
  return { n: (d < 0 ? -1 : 1) * n / g, d: Math.abs(d) / g }
}
function fracAdd(a, b) { return fracReduce(a.n * b.d + b.n * a.d, a.d * b.d) }
function fracSub(a, b) { return fracReduce(a.n * b.d - b.n * a.d, a.d * b.d) }
function fracMul(a, b) { return fracReduce(a.n * b.n, a.d * b.d) }
function fracDiv(a, b) { return fracReduce(a.n * b.d, a.d * b.n) }
function fracToDecimal({ n, d }) { return d === 0 ? 0 : n / d }
function fracToStr({ n, d }) {
  if (d === 1) return `${n}`
  const w = Math.floor(Math.abs(n) / d) * Math.sign(n)
  const rem = Math.abs(n) % d
  if (w && rem) return `${w} ${rem}/${d}`
  if (w) return `${w}`
  return `${n}/${d}`
}

function parseFracObj(s) {
  s = (s || '').trim()
  const m = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (m) { const sign = +m[1] < 0 ? -1 : 1; return fracReduce(+m[1] * +m[3] + sign * +m[2], +m[3]) }
  const f = s.match(/^(-?\d+)\/(\d+)$/)
  if (f) return fracReduce(+f[1], +f[2])
  const dv = parseFloat(s)
  if (!isNaN(dv)) return fracReduce(Math.round(dv * 64), 64)
  return null
}

function fracToHTML({ n, d }, style = {}) {
  if (d === 1) return <span style={style}>{n}</span>
  const w = Math.trunc(n / d), r = Math.abs(n % d)
  const fontSize = style.fontSize || 22
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, ...style }}>
      {w !== 0 && <span style={{ fontSize }}>{w}</span>}
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: fontSize * 0.6, lineHeight: 1 }}>
        <span style={{ borderBottom: '1.5px solid currentColor', paddingBottom: 1 }}>{Math.abs(r)}</span>
        <span style={{ paddingTop: 1 }}>{d}</span>
      </span>
    </span>
  )
}

function inchToFrac(dec, den = 16) {
  const w = Math.floor(dec), f = dec - w
  const n = Math.round(f * den)
  if (n === 0) return { w, n: 0, d: den }
  if (n === den) return { w: w + 1, n: 0, d: den }
  const g = gcd(n, den)
  return { w, n: n / g, d: den / g }
}

function decToFracStr(dec, den = 16) {
  const { w, n, d } = inchToFrac(Math.abs(dec), den)
  const sign = dec < 0 ? '-' : ''
  if (n === 0) return `${sign}${w}"`
  if (w === 0) return `${sign}${n}/${d}"`
  return `${sign}${w} ${n}/${d}"`
}

function parseLenIn(s) {
  s = (s || '').trim().toLowerCase()
  if (!s) return null
  const ftIn = s.match(/^(\d+(?:\.\d+)?)['']\s*(\d+(?:[/ ]\d+)?)\"?$/)
  if (ftIn) { const f = parseFracObj(ftIn[2]); return parseFloat(ftIn[1]) * 12 + (f ? fracToDecimal(f) : 0) }
  const ft = s.match(/^(\d+(?:\.\d+)?)[''f]$/)
  if (ft) return parseFloat(ft[1]) * 12
  const inM = s.match(/^(\d+(?:\.\d+)?(?:[/ ]\d+)?)\s*(?:"|in)?$/)
  if (inM) { const f = parseFracObj(inM[1]); return f ? fracToDecimal(f) : null }
  return null
}

function inToFtInStr(inches) {
  const neg = inches < 0; inches = Math.abs(inches)
  const ft = Math.floor(inches / 12), ins = inches % 12
  const pref = neg ? '-' : ''
  if (ft === 0) return pref + decToFracStr(ins)
  if (ins < 0.002) return `${pref}${ft}'`
  return `${pref}${ft}' ${decToFracStr(ins)}`
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────
function SectionCard({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)', padding: '16px', marginBottom: 12 }}>
      {title && <div className="label-caps" style={{ marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  )
}

function ResultRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--border-2)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: accent ? 'var(--forest)' : 'var(--text)', fontSize: 15 }}>{value}</span>
    </div>
  )
}

function LenInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ flex: 1 }}>
      {label && <div className="calc-label">{label}</div>}
      <input
        className="calc-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || '0'}
        inputMode="decimal"
        autoComplete="off"
        style={{ width: '100%', textAlign: 'center' }}
      />
    </div>
  )
}

// ─── Tab: Board Foot ───────────────────────────────────────────────────────────
function BoardFoot() {
  const [t, setT] = useState(() => { try { return localStorage.getItem('bf-t') || '' } catch { return '' } })
  const [w, setW] = useState(() => { try { return localStorage.getItem('bf-w') || '' } catch { return '' } })
  const [l, setL] = useState('')
  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState(() => { try { return localStorage.getItem('bf-cost') || '' } catch { return '' } })
  const [tally, setTally] = useState([])
  const [memory, setMemory] = useState(null)
  const [showHelp, setShowHelp] = useState(false)

  // Persist commonly reused values
  useEffect(() => { try { localStorage.setItem('bf-t', t) } catch {} }, [t])
  useEffect(() => { try { localStorage.setItem('bf-w', w) } catch {} }, [w])
  useEffect(() => { try { localStorage.setItem('bf-cost', cost) } catch {} }, [cost])

  const pf = v => { const o = parseFracObj(v); return o ? fracToDecimal(o) : null }
  const tv = pf(t), wv = pf(w), lv = parseFloat(l) || 0
  const bf = tv && wv && lv ? Math.round(tv * wv * lv / 144 * 1000) / 1000 : null
  const q = Math.max(1, parseInt(qty) || 1)
  const bfQty = bf ? Math.round(bf * q * 1000) / 1000 : null
  const estCost = bfQty && cost ? (bfQty * (parseFloat(cost) || 0)).toFixed(2) : null

  // History
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('bf-history')) || [] } catch { return [] } })
  const saveHistory = h => { setHistory(h); try { localStorage.setItem('bf-history', JSON.stringify(h)) } catch {} }

  const addTally = () => {
    if (!bfQty) return
    const entry = { desc: `${t||'?'}" × ${w||'?'}" × ${l||'?'}" ×${q}`, bf: bfQty, cost: estCost ? parseFloat(estCost) : 0 }
    setTally(p => [...p, entry])
    saveHistory([{ ...entry, ts: Date.now() }, ...history].slice(0, 10))
  }

  return (
    <div style={{ padding: '0 20px 40px', maxWidth: 640, margin: '0 auto' }}>
      {/* Help toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px' }}>
        <span style={{ fontSize: 12, color: 'var(--text-4)' }}>BF = T × W × L ÷ 144</span>
        <button className="calc-help-btn" onClick={() => setShowHelp(!showHelp)} title="Help">?</button>
      </div>
      {showHelp && (
        <div className="calc-help-tip">
          <strong>Board Feet</strong> measures lumber volume. Enter thickness and width in inches (fractions OK: 3/4, 1 3/8). Length in inches. Qty multiplies the result. $/BF estimates cost per board foot.
        </div>
      )}

      {/* Premium display */}
      <div className="calc-display">
        {memory !== null && <div className="calc-memory-badge">M = {memory}</div>}
        <div className="calc-display-row">
          <div>
            <div key={bfQty} className={`calc-display-value${bfQty ? ' result-pop' : ''}`}>
              {bfQty ?? '—'}
            </div>
            <div className="calc-display-sub">
              board feet{bf && bfQty !== bf ? ` (${q}× ${bf} BF)` : ''}
            </div>
          </div>
          {estCost && (
            <div>
              <div className="calc-display-cost">${estCost}</div>
              <div className="calc-display-cost-sub">est. cost</div>
            </div>
          )}
        </div>
      </div>

      {/* Memory bar */}
      <div className="calc-memory-bar">
        <button className="calc-mem-btn" onClick={() => bfQty && setMemory(m => m !== null ? Math.round((m + bfQty)*1000)/1000 : bfQty)} disabled={!bfQty}>M+</button>
        <button className="calc-mem-btn" onClick={() => bfQty && setMemory(m => m !== null ? Math.round((m - bfQty)*1000)/1000 : -bfQty)} disabled={!bfQty}>M−</button>
        <button className="calc-mem-btn" onClick={() => { if (memory !== null) { setT(''); setW(''); setL(''); setQty('1') } }} disabled={memory === null}>MR</button>
        <button className="calc-mem-btn" onClick={() => setMemory(null)} disabled={memory === null}>MC</button>
      </div>
      {memory !== null && (
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 12 }}>
          Memory: {memory} BF
        </div>
      )}

      {/* Inputs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <LenInput label="Thickness (in)" value={t} onChange={setT} placeholder="3/4" />
        <LenInput label="Width (in)" value={w} onChange={setW} placeholder="6" />
        <LenInput label="Length (in)" value={l} onChange={setL} placeholder="96" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <LenInput label="Qty" value={qty} onChange={setQty} placeholder="1" />
        <LenInput label="$/BF (optional)" value={cost} onChange={setCost} placeholder="5.00" />
      </div>

      <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 20 }} onClick={addTally} disabled={!bfQty}>
        + Add to tally
      </button>

      {tally.length > 0 && (
        <SectionCard title="Running Tally">
          <div className="tally-table">
            {tally.map((r, i) => (
              <div key={i} className="tally-row">
                <span style={{ color: 'var(--text-3)' }}>{r.desc}</span>
                <span style={{ fontWeight: 700 }}>{r.bf} BF{r.cost > 0 ? ` · $${r.cost.toFixed(2)}` : ''}</span>
              </div>
            ))}
            <div className="tally-row total">
              <span>Total</span>
              <span>{Math.round(tally.reduce((s,r) => s+r.bf, 0)*1000)/1000} BF{tally.some(r=>r.cost>0) ? ` · $${tally.reduce((s,r)=>s+r.cost,0).toFixed(2)}` : ''}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn-text" style={{ color: 'var(--red)' }} onClick={() => setTally([])}>Clear tally</button>
            <button className="btn-text" style={{ color: 'var(--accent)' }} onClick={() => {
              const lines = tally.map(r => `${r.desc} → ${r.bf} BF${r.cost > 0 ? ` ($${r.cost.toFixed(2)})` : ''}`)
              const total = Math.round(tally.reduce((s,r) => s+r.bf, 0)*1000)/1000
              const totalCost = tally.reduce((s,r) => s+r.cost, 0)
              lines.push(`\nTotal: ${total} BF${totalCost > 0 ? ` · $${totalCost.toFixed(2)}` : ''}`)
              const text = `Board Feet Tally\n${'─'.repeat(24)}\n${lines.join('\n')}\n\n— JDH Woodworks`
              if (navigator.share) navigator.share({ text }).catch(() => {})
              else { navigator.clipboard?.writeText(text); }
            }}>Share tally</button>
          </div>
        </SectionCard>
      )}

      {/* History */}
      {history.length > 0 && (
        <SectionCard title="Recent Calculations">
          <div className="tally-table">
            {history.map((h, i) => (
              <div key={i} className="tally-row" style={{ cursor: 'pointer' }} onClick={() => {
                const m = h.desc.match(/^(.+)" × (.+)" × (.+)" ×(\d+)$/)
                if (m) { setT(m[1]); setW(m[2]); setL(m[3]); setQty(m[4]) }
              }}>
                <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{h.desc}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{h.bf} BF</span>
              </div>
            ))}
          </div>
          <button className="btn-text" style={{ marginTop: 6, fontSize: 12, color: 'var(--text-4)' }} onClick={() => saveHistory([])}>Clear history</button>
        </SectionCard>
      )}
    </div>
  )
}

// ─── Tab: Fraction Calculator ─────────────────────────────────────────────────
// Single unified keypad. Model: left op right = result.
// Entry flows naturally: type a number (whole or fractional), hit operator, type second number, hit =.
function FractionCalc() {
  // Calculator state machine
  const [display, setDisplay] = useState('')   // what the user is currently typing
  const [left, setLeft]       = useState(null) // stored left operand (fracObj)
  const [op, setOp]           = useState(null) // '+' '-' '×' '÷'
  const [result, setResult]   = useState(null) // computed result (fracObj)
  const [justEvaled, setJustEvaled] = useState(false) // after = was pressed

  // History
  const [fracHistory, setFracHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('frac-history')) || [] } catch { return [] } })
  const saveFracHistory = h => { setFracHistory(h); try { localStorage.setItem('frac-history', JSON.stringify(h)) } catch {} }

  // Parse current display string to fracObj
  const parsedDisplay = useMemo(() => {
    if (!display) return null
    return parseFracObj(display)
  }, [display])

  const appendDigit = d => {
    setResult(null)
    if (justEvaled) { setDisplay(d); setJustEvaled(false); return }
    setDisplay(prev => {
      if (d === '.' && prev.includes('.')) return prev
      return prev + d
    })
  }

  const appendFrac = (num, den) => {
    // Insert "num/den" — if display is non-empty add as fractional part
    setResult(null)
    setJustEvaled(false)
    setDisplay(prev => {
      if (!prev || prev === '0') return `${num}/${den}`
      if (prev.includes('/')) return prev // already has fraction
      return `${prev} ${num}/${den}`
    })
  }

  const setDenominator = den => {
    // Quick denominator: sets denominator for current numerator in display
    setResult(null)
    setJustEvaled(false)
    setDisplay(prev => {
      if (!prev) return `1/${den}`
      // If display is "X Y/Z", replace denominator
      const mixedMatch = prev.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
      if (mixedMatch) return `${mixedMatch[1]} ${mixedMatch[2]}/${den}`
      // If display is "X/Y", replace denominator
      const fracMatch = prev.match(/^(\d+)\/(\d+)$/)
      if (fracMatch) return `${fracMatch[1]}/${den}`
      // If display is a whole number, make it "X/den"... wait that's ambiguous.
      // Better: treat as numerator
      const wholeMatch = prev.match(/^(-?\d+)$/)
      if (wholeMatch) return `${prev}/${den}`
      return prev
    })
  }

  const pressOp = newOp => {
    setResult(null)
    setJustEvaled(false)
    const val = result || parsedDisplay
    if (val) {
      setLeft(val)
      setOp(newOp)
      setDisplay('')
    } else if (left) {
      setOp(newOp) // change operator without clearing
    }
  }

  const pressEquals = () => {
    const rhs = parsedDisplay
    const lhs = left
    if (!rhs || !lhs || !op) return
    let res
    if (op === '+') res = fracAdd(lhs, rhs)
    else if (op === '-') res = fracSub(lhs, rhs)
    else if (op === '×') res = fracMul(lhs, rhs)
    else if (op === '÷') res = fracDiv(lhs, rhs)
    if (res) {
      setResult(res)
      setLeft(res)
      setOp(null)
      setDisplay('')
      setJustEvaled(true)
      saveFracHistory([{ expr: `${fracToStr(lhs)} ${op} ${fracToStr(rhs)}`, result: fracToStr(res), decimal: fracToDecimal(res).toFixed(4), ts: Date.now() }, ...fracHistory].slice(0, 10))
    }
  }

  const pressAC = () => {
    setDisplay(''); setLeft(null); setOp(null); setResult(null); setJustEvaled(false)
  }

  const pressBackspace = () => {
    setResult(null)
    setJustEvaled(false)
    setDisplay(prev => prev.slice(0, -1))
  }

  const activeVal = result || parsedDisplay

  // Display string
  const eqLine = [
    left ? fracToHTML(left, { fontSize: 18, color: 'rgba(255,255,255,.6)' }) : null,
    op   ? <span key="op" style={{ fontSize: 20, color: '#F59E0B', fontWeight: 700, margin: '0 4px' }}>{op}</span> : null,
    !result && parsedDisplay && op
      ? fracToHTML(parsedDisplay, { fontSize: 18, color: 'rgba(255,255,255,.6)' })
      : null,
  ].filter(Boolean)

  const DENS = [2, 4, 8, 16, 32, 64]

  return (
    <div style={{ padding: '0 16px 40px', maxWidth: 480, margin: '0 auto' }}>
      {/* Display */}
      <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-md)', padding: '14px 18px', marginBottom: 12, minHeight: 96 }}>
        {/* Equation line */}
        {eqLine.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginBottom: 6, minHeight: 28 }}>
            {eqLine}
          </div>
        )}
        {/* Main value */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          {result
            ? <span key={`${result.n}/${result.d}`} className="result-pop">
                {fracToHTML(result, { fontSize: 36, color: '#4ADE80', fontWeight: 800 })}
              </span>
            : display
              ? <span style={{ fontSize: 28, color: '#fff', fontWeight: 700 }}>{display}</span>
              : <span style={{ fontSize: 28, color: 'rgba(255,255,255,.25)' }}>0</span>
          }
          {result && (
            <span className="result-appear" style={{ fontSize: 13, color: '#8BA8D0' }}>
              {fracToDecimal(result).toFixed(4)}" · {(fracToDecimal(result) * 25.4).toFixed(2)} mm
            </span>
          )}
        </div>
      </div>

      {/* Keypad — single unified grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {/* Row 1: 7 8 9 ÷ AC */}
        {[7,8,9].map(n => <button key={n} className="key-btn" onClick={() => appendDigit(String(n))}>{n}</button>)}
        <button className="key-btn amber" onClick={() => pressOp('÷')}>÷</button>
        <button className="key-btn red" style={{ fontSize: 13 }} onClick={pressAC}>AC</button>

        {/* Row 2: 4 5 6 × ⌫ */}
        {[4,5,6].map(n => <button key={n} className="key-btn" onClick={() => appendDigit(String(n))}>{n}</button>)}
        <button className="key-btn amber" onClick={() => pressOp('×')}>×</button>
        <button className="key-btn gray" style={{ fontSize: 18 }} onClick={pressBackspace}>⌫</button>

        {/* Row 3: 1 2 3 - /2 */}
        {[1,2,3].map(n => <button key={n} className="key-btn" onClick={() => appendDigit(String(n))}>{n}</button>)}
        <button className="key-btn amber" onClick={() => pressOp('-')}>−</button>
        <button className={`key-btn den`} onClick={() => setDenominator(2)}>/2</button>

        {/* Row 4: 0 / + /4 /8 */}
        <button className="key-btn" onClick={() => appendDigit('0')}>0</button>
        <button className="key-btn gray" onClick={() => appendDigit('/')} style={{ fontSize: 20 }}>/</button>
        <button className="key-btn amber" onClick={() => pressOp('+')}>+</button>
        <button className={`key-btn den`} onClick={() => setDenominator(4)}>/4</button>
        <button className={`key-btn den`} onClick={() => setDenominator(8)}>/8</button>

        {/* Row 5: /16 /32 /64 . = */}
        <button className={`key-btn den`} onClick={() => setDenominator(16)}>/16</button>
        <button className={`key-btn den`} onClick={() => setDenominator(32)}>/32</button>
        <button className={`key-btn den`} onClick={() => setDenominator(64)}>/64</button>
        <button className="key-btn" onClick={() => appendDigit('.')} style={{ fontSize: 20 }}>.</button>
        <button className="key-btn forest" style={{ gridColumn: 'span 1', fontSize: 20 }} onClick={pressEquals}>=</button>
      </div>

      {/* Conversions */}
      {activeVal && (
        <div style={{ marginTop: 14, background: 'var(--fill)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
          <div className="label-caps" style={{ marginBottom: 8 }}>Conversions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
            {[16, 32, 64].map(den => {
              const dec = fracToDecimal(activeVal)
              const { w, n, d } = inchToFrac(dec, den)
              return (
                <div key={den} style={{ background: 'var(--surface)', borderRadius: 6, padding: '6px 10px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', marginBottom: 2 }}>nearest 1/{den}"</div>
                  <strong>{n === 0 ? `${w}"` : `${w > 0 ? w + ' ' : ''}${n}/${d}"`}</strong>
                </div>
              )
            })}
            <div style={{ background: 'var(--surface)', borderRadius: 6, padding: '6px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-4)', marginBottom: 2 }}>decimal</div>
              <strong>{fracToDecimal(activeVal).toFixed(5)}"</strong>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 6, padding: '6px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-4)', marginBottom: 2 }}>millimeters</div>
              <strong>{(fracToDecimal(activeVal) * 25.4).toFixed(3)} mm</strong>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {fracHistory.length > 0 && (
        <div style={{ marginTop: 14, background: 'var(--fill)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
          <div className="label-caps" style={{ marginBottom: 8 }}>Recent</div>
          {fracHistory.map((h, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < fracHistory.length - 1 ? '1px solid var(--border-2)' : 'none', fontSize: 13 }}>
              <span style={{ color: 'var(--text-3)' }}>{h.expr}</span>
              <span style={{ fontWeight: 700 }}>= {h.result}</span>
            </div>
          ))}
          <button className="btn-text" style={{ marginTop: 6, fontSize: 12, color: 'var(--text-4)' }} onClick={() => saveFracHistory([])}>Clear</button>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Converter (4 columns, all on one tab) ────────────────────────────────
const CONV = {
  Length: {
    units: ['in', 'ft', 'yd', 'mm', 'cm', 'm'],
    toBase: { in:1, ft:12, yd:36, mm:1/25.4, cm:1/2.54, m:39.3701 },
  },
  Temperature: { units: ['°F', '°C', 'K'], special: true },
  Weight: {
    units: ['lb', 'oz', 'kg', 'g'],
    toBase: { lb:1, oz:1/16, kg:2.20462, g:0.00220462 },
  },
  Area: {
    units: ['in²', 'ft²', 'mm²', 'cm²', 'm²'],
    toBase: { 'in²':1, 'ft²':144, 'mm²':1/645.16, 'cm²':1/6.4516, 'm²':1550.003 },
  },
}

function convertTemp(v, from, to) {
  let c = from === '°F' ? (v-32)*5/9 : from === 'K' ? v-273.15 : v
  return to === '°F' ? c*9/5+32 : to === 'K' ? c+273.15 : c
}

function convertVal(v, from, to, cfg) {
  if (!cfg || isNaN(v)) return ''
  if (cfg.special) return convertTemp(v, from, to).toFixed(4)
  const base = v * (cfg.toBase[from] || 1)
  return (base / (cfg.toBase[to] || 1)).toFixed(6).replace(/\.?0+$/, '')
}

function ConverterColumn({ title, cfg, catKey }) {
  const [from, setFrom] = useState(cfg.units[0])
  const [to, setTo]     = useState(cfg.units[1] || cfg.units[0])
  const [val, setVal]   = useState('')

  const result = val !== '' ? convertVal(parseFloat(val), from, to, cfg) : ''

  const selectStyle = {
    background: 'transparent', border: '1px solid var(--border-2)', borderRadius: 8,
    fontFamily: 'inherit', fontSize: 14, fontWeight: 600, outline: 'none',
    width: '100%', padding: '8px 10px', color: 'var(--text)',
    appearance: 'none', WebkitAppearance: 'none',
  }

  return (
    <ProSection title={title}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <select value={from} onChange={e => setFrom(e.target.value)} style={selectStyle}>
          {cfg.units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button
          onClick={() => { setFrom(to); setTo(from) }}
          style={{ background: 'var(--fill)', border: 'none', borderRadius: 99, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: 'var(--text-3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Swap units"
        >⇄</button>
        <select value={to} onChange={e => setTo(e.target.value)} style={selectStyle}>
          {cfg.units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <input
        className="calc-input"
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="Enter value"
        inputMode="decimal"
        style={{ width: '100%', marginBottom: 10 }}
      />
      {result && (
        <div className="calc-display" style={{ marginBottom: 0, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span key={result} className="calc-display-value result-pop" style={{ fontSize: 28 }}>{result}</span>
            <span style={{ fontSize: 16, color: 'rgba(240,244,248,.5)', fontWeight: 600 }}>{to}</span>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(240,244,248,.35)', marginTop: 6 }}>
            {val} {from}
          </div>
        </div>
      )}
    </ProSection>
  )
}

function UnitConverter() {
  const [showHelp, setShowHelp] = useState(false)
  return (
    <div style={{ padding: '0 20px 40px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px' }}>
        <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Convert between imperial and metric units</span>
        <button className="calc-help-btn" onClick={() => setShowHelp(!showHelp)} title="Help">?</button>
      </div>
      {showHelp && (
        <div className="calc-help-tip">
          <strong>Unit Converter</strong> handles length, temperature, weight, and area conversions. Select your units, enter a value, and the result appears instantly. Tap the ⇄ button to swap from/to units.
        </div>
      )}
      <div className="converter-grid">
        {Object.entries(CONV).map(([title, cfg]) => (
          <ConverterColumn key={title} title={title} cfg={cfg} catKey={title} />
        ))}
      </div>
    </div>
  )
}

// ─── Tab: Trim / Linear cuts (FFD) ────────────────────────────────────────────
const CUT_COLS = ['#2563EB','#16A34A','#D97706','#DC2626','#7C3AED','#0891B2','#C026D3','#EA580C']

function ffd(cuts, stockLengths, kerf) {
  const pieces = []; cuts.forEach(c => { for (let i=0;i<c.qty;i++) pieces.push(c.length) })
  pieces.sort((a,b) => b-a)
  const stocks = [...stockLengths].sort((a,b) => a-b)
  const boards = []
  for (const p of pieces) {
    let placed = false
    for (const b of boards) { if (p+kerf <= b.sl-b.used+0.0001) { b.cuts.push(p); b.used+=p+kerf; placed=true; break } }
    if (!placed) { const s=stocks.find(s=>s>=p+kerf); if(!s) return null; boards.push({sl:s,cuts:[p],used:p+kerf}) }
  }
  const summary={}; boards.forEach(b=>{summary[b.sl]=(summary[b.sl]||0)+1})
  return {boards,summary}
}

function TrimCuts() {
  const [cuts, setCuts] = useState([
    { id:1, len:'', qty:1, label:'' },
    { id:2, len:'', qty:1, label:'' },
  ])
  const [stock, setStock] = useState(() => { try { return localStorage.getItem('tc-stock') || "8', 10', 12'" } catch { return "8', 10', 12'" } })
  const [kerf, setKerf]   = useState(() => { try { return localStorage.getItem('tc-kerf') || '0.125' } catch { return '0.125' } })
  const [result, setResult] = useState(null)
  const [error, setError]   = useState(null)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => { try { localStorage.setItem('tc-stock', stock) } catch {} }, [stock])
  useEffect(() => { try { localStorage.setItem('tc-kerf', kerf) } catch {} }, [kerf])

  const upd = (id, f, v) => setCuts(c => c.map(x => x.id===id ? {...x,[f]:v} : x))
  const cutListRef = useRef(null)
  const addRow = () => setCuts(c => [...c, { id:Date.now(), len:'', qty:1, label:'' }])

  // Focus the last length input after adding a row
  useEffect(() => {
    if (cuts.length < 2) return
    const inputs = cutListRef.current?.querySelectorAll('input[placeholder*="48"]')
    if (inputs?.length) inputs[inputs.length - 1].focus()
  }, [cuts.length])

  const calc = () => {
    setError(null); setResult(null)
    const pc = cuts.map(c => {
      const v = parseLenIn(c.len)
      return v > 0 ? { length: Math.round(v*16)/16, qty: Math.max(1,parseInt(c.qty)||1), label: c.label.trim() } : null
    }).filter(Boolean)
    if (!pc.length) { setError('Enter at least one cut.'); return }
    const sl = stock.split(/[,\s]+/).map(s => { const v=parseLenIn(s); return v?Math.round(v*8)/8:null }).filter(Boolean)
    if (!sl.length) { setError("Enter stock lengths e.g. 8', 10', 12' or 96"); return }
    const k = parseFloat(kerf)||0.125
    if (Math.max(...pc.map(c=>c.length))+k > Math.max(...sl)) { setError('A cut is longer than all stock lengths.'); return }
    const r = ffd(pc, sl, k)
    if (!r) { setError('Could not fit all cuts.'); return }
    r.pc = pc; setResult(r)
  }

  return (
    <div style={{ padding: '0 20px 40px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px' }}>
        <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Optimize linear cuts from standard lumber</span>
        <button className="calc-help-btn" onClick={() => setShowHelp(!showHelp)} title="Help">?</button>
      </div>
      {showHelp && (
        <div className="calc-help-tip">
          <strong>Trim Cut Optimizer</strong> finds the most efficient way to cut pieces from standard lumber lengths. Enter each piece you need (length, quantity, optional label), your available stock lengths, and blade kerf. The optimizer minimizes waste by fitting pieces onto the fewest boards possible. Lengths accept inches (48), feet (4'), or feet-inches (4'6"). Fractions work too: 3 7/8.
        </div>
      )}

      {/* Cut list */}
      <ProSection title="Cut List">
        <div ref={cutListRef}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) 56px minmax(0,2fr) 28px', gap: 5, marginBottom: 6 }}>
            {['Length', 'Qty', 'Label', ''].map(h => (
              <div key={h} className="calc-label" style={{ marginBottom: 0, textAlign: 'center' }}>{h}</div>
            ))}
          </div>
          {cuts.map((c, i) => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) 56px minmax(0,2fr) 28px', gap: 5, marginBottom: 6, alignItems: 'center' }}>
              <input className="calc-input" value={c.len} onChange={e => upd(c.id,'len',e.target.value)} placeholder="48 or 4'6&quot;" onKeyDown={e => e.key==='Enter' && addRow()} />
              <input className="calc-input" type="number" min="1" value={c.qty} onChange={e => upd(c.id,'qty',e.target.value)} style={{ textAlign: 'center' }} />
              <input className="calc-input" value={c.label} onChange={e => upd(c.id,'label',e.target.value)} placeholder="optional" />
              <button onClick={() => setCuts(cc => cc.filter(x => x.id!==c.id))} disabled={cuts.length===1} className="icon-btn" style={{ color: 'var(--red)', opacity: cuts.length===1 ? .3 : 1, justifySelf: 'center' }}>×</button>
            </div>
          ))}
        </div>
        <button className="btn-text" onClick={addRow} style={{ fontSize: 13 }}>+ Add cut</button>
      </ProSection>

      {/* Stock + kerf */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <LenInput label="Available stock lengths" value={stock} onChange={setStock} placeholder="8', 10', 12'" />
        <div style={{ width: 88 }}>
          <div className="calc-label">Kerf (in)</div>
          <input className="calc-input" type="number" step="0.0625" value={kerf} onChange={e => setKerf(e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>

      {error && <div className="warn-box">{error}</div>}
      <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 20 }} onClick={calc}>
        Calculate Cuts
      </button>

      {result && (
        <>
          {/* Premium summary display */}
          <div className="calc-display">
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              {Object.entries(result.summary).sort(([a],[b])=>+a-+b).map(([len,cnt]) => (
                <div key={len}>
                  <div className="calc-display-value result-pop" style={{ fontSize: 32 }}>{cnt}</div>
                  <div className="calc-display-sub">× {inToFtInStr(+len)}</div>
                </div>
              ))}
              <div>
                <div className="calc-display-value result-pop" style={{ fontSize: 32, color: result.boards.reduce((s,b)=>s+b.used,0)/result.boards.reduce((s,b)=>s+b.sl,0) > 0.85 ? '#4ADE80' : '#F59E0B' }}>
                  {Math.round((1-result.boards.reduce((s,b)=>s+b.used,0)/result.boards.reduce((s,b)=>s+b.sl,0))*100)}%
                </div>
                <div className="calc-display-sub">waste</div>
              </div>
            </div>
          </div>

          {/* Share */}
          <button className="btn-text" style={{ color: 'var(--accent)', marginBottom: 12, fontSize: 13 }} onClick={() => {
            const summary = Object.entries(result.summary).sort(([a],[b])=>+a-+b).map(([len,cnt]) => `${cnt}× ${inToFtInStr(+len)}`).join(', ')
            const waste = Math.round((1-result.boards.reduce((s,b)=>s+b.used,0)/result.boards.reduce((s,b)=>s+b.sl,0))*100)
            const cutList = result.boards.map((b,i) => `Board ${i+1} (${inToFtInStr(b.sl)}): ${b.cuts.map(c => inToFtInStr(c)).join(' + ')}`).join('\n')
            const text = `Cut List Optimization\n${'─'.repeat(24)}\nStock needed: ${summary}\nWaste: ${waste}%\n\n${cutList}\n\n— JDH Woodworks`
            if (navigator.share) navigator.share({ text }).catch(() => {})
            else navigator.clipboard?.writeText(text)
          }}>Share cut list</button>

          {/* Board diagrams */}
          {result.boards.map((b, bi) => (
            <div key={bi} style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}>
                <span style={{ fontWeight:700 }}>Board {bi+1} · <span style={{ color:'var(--accent)' }}>{inToFtInStr(b.sl)}</span></span>
                <span style={{ color:'var(--orange)', fontWeight: 600 }}>waste {inToFtInStr(Math.max(0,b.sl-b.used))}</span>
              </div>
              <div style={{ display:'flex', height:32, borderRadius:8, overflow:'hidden', border:'2px solid rgba(255,255,255,.25)' }}>
                {b.cuts.map((cut,ci) => (
                  <div key={ci} title={inToFtInStr(cut)} style={{
                    width:`${(cut/b.sl)*100}%`,
                    background:CUT_COLS[ci%CUT_COLS.length],
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10, fontWeight:700, color:'#fff', overflow:'hidden',
                    borderRight:ci<b.cuts.length-1?'1px solid rgba(255,255,255,.4)':'none',
                  }}>
                    {(cut/b.sl)>0.12?inToFtInStr(cut):''}
                  </div>
                ))}
                {b.sl-b.used>0.05&&(
                  <div style={{ flex:1, background:'repeating-linear-gradient(45deg,rgba(239,68,68,.15),rgba(239,68,68,.15) 4px,rgba(239,68,68,.08) 4px,rgba(239,68,68,.08) 8px)', border:'none' }} title={`Waste: ${inToFtInStr(Math.max(0,b.sl-b.used))}`} />
                )}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:8 }}>
                {b.cuts.map((cut,ci) => {
                  const m = result.pc?.find(p=>Math.abs(p.length-cut)<0.01)
                  return (
                    <span key={ci} style={{ fontSize:11, padding:'2px 8px', borderRadius:99, fontWeight:600, background:CUT_COLS[ci%CUT_COLS.length]+'22', color:CUT_COLS[ci%CUT_COLS.length], border:`1px solid ${CUT_COLS[ci%CUT_COLS.length]}44` }}>
                      {m?.label||inToFtInStr(cut)}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Tab: Sheet Goods ──────────────────────────────────────────────────────────
const SHEET_COLS = ['#2563EB','#16A34A','#D97706','#DC2626','#7C3AED','#0891B2','#C026D3','#EA580C','#0D9488','#4F46E5']

function packSheets(pieces, sw, sh, kerf) {
  const sheets = []
  for (const piece of pieces) {
    const pw = piece.w+kerf, ph = piece.h+kerf
    if (pw>sw||ph>sh) return null
    let placed = false
    for (const sheet of sheets) {
      for (const shelf of sheet.shelves) {
        if (ph<=shelf.h+0.01&&pw<=sw-shelf.usedW+0.01) {
          shelf.pieces.push({...piece,x:shelf.usedW,y:shelf.y})
          sheet.pieces.push({...piece,x:shelf.usedW,y:shelf.y})
          shelf.usedW+=pw; placed=true; break
        }
      }
      if (placed) break
      if (ph<=sh-sheet.usedH+0.01) {
        const shelf={h:ph,y:sheet.usedH,usedW:0,pieces:[]}
        shelf.pieces.push({...piece,x:0,y:sheet.usedH})
        sheet.pieces.push({...piece,x:0,y:sheet.usedH})
        shelf.usedW=pw; sheet.usedH+=ph; sheet.shelves.push(shelf); placed=true; break
      }
    }
    if (!placed) {
      const sheet={w:sw,h:sh,shelves:[],usedH:0,pieces:[]}
      const shelf={h:ph,y:0,usedW:0,pieces:[]}
      shelf.pieces.push({...piece,x:0,y:0}); sheet.pieces.push({...piece,x:0,y:0})
      shelf.usedW=pw; sheet.usedH=ph; sheet.shelves.push(shelf); sheets.push(sheet)
    }
  }
  return sheets
}

function SheetGoods() {
  const [sheetW, setSheetW] = useState(() => { try { return localStorage.getItem('sg-w') || '48' } catch { return '48' } })
  const [sheetH, setSheetH] = useState(() => { try { return localStorage.getItem('sg-h') || '96' } catch { return '96' } })
  const [kerf, setKerf]     = useState(() => { try { return localStorage.getItem('sg-kerf') || '0.125' } catch { return '0.125' } })

  useEffect(() => { try { localStorage.setItem('sg-w', sheetW) } catch {} }, [sheetW])
  useEffect(() => { try { localStorage.setItem('sg-h', sheetH) } catch {} }, [sheetH])
  useEffect(() => { try { localStorage.setItem('sg-kerf', kerf) } catch {} }, [kerf])
  const [cuts, setCuts]     = useState([
    { id:1, w:'', h:'', qty:1, label:'' },
    { id:2, w:'', h:'', qty:1, label:'' },
  ])
  const [result, setResult] = useState(null)
  const [error, setError]   = useState(null)
  const [showHelp, setShowHelp] = useState(false)

  const upd = (id, f, v) => setCuts(c => c.map(x => x.id===id?{...x,[f]:v}:x))
  const addRow = () => setCuts(c => [...c, { id:Date.now(),w:'',h:'',qty:1,label:'' }])

  const calc = () => {
    setError(null); setResult(null)
    const sw=parseFloat(sheetW), sh=parseFloat(sheetH), k=parseFloat(kerf)||0.125
    if (!sw||!sh) { setError('Enter sheet dimensions.'); return }
    const pieces = []
    for (const c of cuts) {
      const w=parseFloat(c.w), h=parseFloat(c.h)
      if (!w||!h) continue
      const qty=Math.max(1,parseInt(c.qty)||1)
      for (let i=0;i<qty;i++) pieces.push({w,h,label:c.label||`${w}"×${h}"`,origW:w,origH:h})
    }
    if (!pieces.length) { setError('Enter at least one piece.'); return }
    if (pieces.some(p=>p.w>sw||p.h>sh)) { setError('A piece is larger than the sheet.'); return }
    pieces.sort((a,b)=>b.h-a.h||(b.w-a.w))
    const sheets = packSheets(pieces,sw,sh,k)
    if (!sheets) { setError('Could not pack.'); return }
    const usedArea=pieces.reduce((s,p)=>s+p.origW*p.origH,0)
    setResult({ sheets, sw, sh, wastePct: Math.round((1-usedArea/(sw*sh*sheets.length))*100), usedSqFt: (usedArea/144).toFixed(1) })
  }

  const SheetDiagram = ({ sheet, sw, sh, idx }) => {
    const SCALE = 200/Math.max(sw,sh)
    const vw=sw*SCALE, vh=sh*SCALE
    const labelColors={}; let ci=0
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
        <div style={{ fontSize:13,fontWeight:700,marginBottom:8 }}>Sheet {idx+1}</div>
        <svg width={vw} height={vh} style={{ border:'1px solid var(--border-2)',borderRadius:8,background:'var(--fill-2)',display:'block' }}>
          {sheet.pieces.map((p,i) => {
            if (!labelColors[p.label]) { labelColors[p.label]=SHEET_COLS[ci++%SHEET_COLS.length] }
            const color=labelColors[p.label]
            const x=p.x*SCALE,y=p.y*SCALE,w=p.origW*SCALE,h=p.origH*SCALE
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={0.75} stroke={color} strokeWidth={1} rx={3}/>
                {w>18&&h>12&&<text x={x+w/2} y={y+h/2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={Math.min(10,w/5)} fontWeight="700" fontFamily="system-ui">{p.label.length>7?p.label.slice(0,6)+'…':p.label}</text>}
              </g>
            )
          })}
        </svg>
        <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginTop:8 }}>
          {[...new Set(sheet.pieces.map(p=>p.label))].map(label => (
            <span key={label} style={{ fontSize:11,padding:'2px 8px',borderRadius:99,fontWeight:600,background:(labelColors[label]||'#999')+'22',color:labelColors[label]||'#999',border:`1px solid ${labelColors[label]||'#999'}44` }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 20px 40px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px' }}>
        <span style={{ fontSize: 12, color: 'var(--text-4)' }}>Optimize rectangular cuts from sheet stock</span>
        <button className="calc-help-btn" onClick={() => setShowHelp(!showHelp)} title="Help">?</button>
      </div>
      {showHelp && (
        <div className="calc-help-tip">
          <strong>Sheet Goods Optimizer</strong> fits rectangular pieces onto full sheets (plywood, MDF, etc.) with minimal waste. Default is a standard 4×8 sheet (48"×96"). Enter each piece width, height, quantity, and optional label. The optimizer packs pieces efficiently and shows a visual diagram of each sheet with color-coded pieces.
        </div>
      )}

      <ProSection title="Sheet Size">
        <div style={{ display:'flex', gap:10 }}>
          <LenInput label='Width (in)' value={sheetW} onChange={setSheetW} placeholder="48" />
          <LenInput label='Height (in)' value={sheetH} onChange={setSheetH} placeholder="96" />
          <div style={{ width:80 }}>
            <div className="calc-label">Kerf</div>
            <input className="calc-input" type="number" step="0.0625" value={kerf} onChange={e=>setKerf(e.target.value)} style={{ width:'100%' }} />
          </div>
        </div>
      </ProSection>

      <ProSection title="Pieces to Cut">
        <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr) 56px minmax(0,1fr) 28px', gap:5, marginBottom:6 }}>
          {['Width','Height','Qty','Label',''].map(h => <div key={h} className="calc-label" style={{ marginBottom:0, textAlign:'center' }}>{h}</div>)}
        </div>
        {cuts.map((c,i) => (
          <div key={c.id} style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr) 56px minmax(0,1fr) 28px', gap:5, marginBottom:6, alignItems:'center' }}>
            <input className="calc-input" value={c.w} onChange={e=>upd(c.id,'w',e.target.value)} placeholder='12"' />
            <input className="calc-input" value={c.h} onChange={e=>upd(c.id,'h',e.target.value)} placeholder='24"' />
            <input className="calc-input" type="number" min="1" value={c.qty} onChange={e=>upd(c.id,'qty',e.target.value)} style={{ textAlign:'center' }} />
            <input className="calc-input" value={c.label} onChange={e=>upd(c.id,'label',e.target.value)} placeholder="optional" />
            <button onClick={()=>setCuts(cc=>cc.filter(x=>x.id!==c.id))} disabled={cuts.length===1} className="icon-btn" style={{ color:'var(--red)',opacity:cuts.length===1?.3:1,justifySelf:'center' }}>×</button>
          </div>
        ))}
        <button className="btn-text" onClick={addRow} style={{ fontSize:13 }}>+ Add piece</button>
      </ProSection>

      {error && <div className="warn-box">{error}</div>}
      <button className="btn-primary" style={{ width:'100%',justifyContent:'center',marginBottom:20 }} onClick={calc}>
        Optimize Sheets
      </button>

      {result && (
        <>
          <div className="calc-display">
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div className="calc-display-value result-pop" style={{ fontSize: 36 }}>{result.sheets.length}</div>
                <div className="calc-display-sub">sheet{result.sheets.length!==1?'s':''} needed</div>
              </div>
              <div>
                <div className="calc-display-value result-pop" style={{ fontSize: 36, color: result.wastePct < 20 ? '#4ADE80' : '#F59E0B' }}>{result.wastePct}%</div>
                <div className="calc-display-sub">waste</div>
              </div>
              <div>
                <div className="calc-display-value result-pop" style={{ fontSize: 28 }}>{result.usedSqFt}</div>
                <div className="calc-display-sub">sq ft used</div>
              </div>
            </div>
          </div>
          <button className="btn-text" style={{ color: 'var(--accent)', marginBottom: 12, fontSize: 13 }} onClick={() => {
            const pieces = cuts.filter(c => parseFloat(c.w) && parseFloat(c.h)).map(c => `${c.qty}× ${c.w}"×${c.h}"${c.label ? ` (${c.label})` : ''}`).join(', ')
            const text = `Sheet Goods Layout\n${'─'.repeat(24)}\nSheet: ${sheetW}"×${sheetH}"\nPieces: ${pieces}\nSheets needed: ${result.sheets.length}\nWaste: ${result.wastePct}%\nUsed: ${result.usedSqFt} sq ft\n\n— JDH Woodworks`
            if (navigator.share) navigator.share({ text }).catch(() => {})
            else navigator.clipboard?.writeText(text)
          }}>Share layout</button>
          {result.sheets.map((sheet,i) => <SheetDiagram key={i} sheet={sheet} sw={result.sw} sh={result.sh} idx={i}/>)}
        </>
      )}
    </div>
  )
}

// ─── Tab: Advanced (all 5 modes on one scrollable tab) ────────────────────────
function CalcInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="calc-label">{label}</div>
      <input className="calc-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || '—'} autoComplete="off" inputMode="decimal" style={{ width: '100%' }} />
    </div>
  )
}

function ProDisplay({ items }) {
  const active = items.filter(i => i.v)
  if (!active.length) return null
  return (
    <div className="calc-display" style={{ marginTop: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: active.length <= 2 ? '1fr '.repeat(active.length) : 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px 16px' }}>
        {active.map(i => (
          <div key={i.label}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'rgba(240,244,248,.4)', marginBottom: 4 }}>{i.label}</div>
            <div key={i.v} className="calc-display-value result-pop" style={{ fontSize: active.length > 3 ? 20 : 28 }}>{i.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProSection({ title, help, children, badge }) {
  const [showHelp, setShowHelp] = useState(false)
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '16px 20px', marginBottom: 12, border: '1px solid var(--border-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
          {badge && <span style={{ fontSize: 11, background: 'var(--accent)', color: '#fff', borderRadius: 6, padding: '1px 8px', fontWeight: 600 }}>{badge}</span>}
        </div>
        {help && <button className="calc-help-btn" onClick={() => setShowHelp(!showHelp)} title="Help">?</button>}
      </div>
      {showHelp && <div className="calc-help-tip">{help}</div>}
      {children}
    </div>
  )
}

function AdvancedCalc() {
  // Pitch/Rise/Run
  const [pitch, setPitch] = useState(''), [rise, setRise] = useState(''), [run, setRun] = useState('')
  const pv = parseFloat(pitch), riv = parseLenIn(rise), ruv = parseLenIn(run)
  const calcPitch = riv && ruv ? +(riv/ruv*12).toFixed(3) : null
  const calcRise  = pv && ruv  ? inToFtInStr(pv*ruv/12) : null
  const calcRun   = pv && riv  ? inToFtInStr(riv*12/pv) : null
  const calcHyp   = riv && ruv ? inToFtInStr(Math.sqrt(riv*riv+ruv*ruv)) : null
  const calcAngle = riv && ruv ? (Math.atan(riv/ruv)*180/Math.PI).toFixed(2)+'°' : null

  // Diagonal
  const [dw, setDw] = useState(''), [dh, setDh] = useState('')
  const dwv = parseLenIn(dw), dhv = parseLenIn(dh)
  const diagVal  = dwv && dhv ? inToFtInStr(Math.sqrt(dwv*dwv+dhv*dhv)) : null
  const diagAngle= dwv && dhv ? (Math.atan(dhv/dwv)*180/Math.PI).toFixed(2)+'°' : null

  // Stairs
  const [totalRise, setTotalRise] = useState(''), [numRisers, setNumRisers] = useState(''), [treadW, setTreadW] = useState('10')
  const trv = parseLenIn(totalRise), nrv = parseInt(numRisers)||0, twv = parseFloat(treadW)||10
  const riserH   = trv && nrv ? inToFtInStr(trv/nrv) : null
  const riserDec = trv && nrv ? trv/nrv : null
  const stairRun = nrv && twv  ? inToFtInStr((nrv-1)*twv) : null
  const stairAng = riserDec && twv ? (Math.atan(riserDec/twv)*180/Math.PI).toFixed(1)+'°' : null
  const riserOk  = riserDec ? riserDec>=4&&riserDec<=7.75 : null

  // Circle
  const [circInput, setCircInput] = useState(''), [circType, setCircType] = useState('diameter')
  const cv = parseLenIn(circInput)
  const cr = cv ? (circType==='radius'?cv:circType==='diameter'?cv/2:circType==='circumference'?cv/(2*Math.PI):Math.sqrt(cv/Math.PI)) : null
  const circDiam = cr ? inToFtInStr(cr*2) : null
  const circRad  = cr ? inToFtInStr(cr) : null
  const circPerim= cr ? inToFtInStr(cr*2*Math.PI) : null
  const circArea = cr ? (cr*cr*Math.PI).toFixed(3)+' in²' : null

  // Compound miter
  const [corner, setCorner] = useState(''), [bladeTilt, setBladeTilt] = useState('')
  const cv2 = parseFloat(corner), btv = parseFloat(bladeTilt)
  const halfCorner = cv2 ? cv2/2 : null
  const flatMiter  = halfCorner ? (90-halfCorner).toFixed(2)+'°' : null
  const compMiter  = halfCorner && btv ? (Math.atan(Math.cos(btv*Math.PI/180)*Math.tan(halfCorner*Math.PI/180))*180/Math.PI).toFixed(2)+'°' : null
  const compBevel  = halfCorner && btv ? (Math.atan(Math.sin(halfCorner*Math.PI/180)*Math.sin(btv*Math.PI/180))*180/Math.PI).toFixed(2)+'°' : null

  return (
    <div style={{ padding: '0 20px 40px', maxWidth: 640, margin: '0 auto' }}>

      <ProSection title="Pitch · Rise · Run" badge="ROOF" help="Enter any two values to calculate the rest. Lengths accept feet-inches: 48, 4', 3'6&quot;. Pitch is rise per 12&quot; of run. Rafter length is the hypotenuse (actual lumber length needed).">
        <div style={{ display:'flex', gap:8 }}>
          <CalcInput label="Pitch (in 12)" value={pitch} onChange={setPitch} placeholder="6" />
          <CalcInput label="Rise" value={rise} onChange={setRise} placeholder={`4'6"`}  />
          <CalcInput label="Run" value={run} onChange={setRun} placeholder="9'" />
        </div>
        <ProDisplay items={[
          { label:'Pitch', v: calcPitch && !pitch ? String(calcPitch) : null },
          { label:'Rise',  v: calcRise  && !rise  ? calcRise  : null },
          { label:'Run',   v: calcRun   && !run   ? calcRun   : null },
          { label:'Rafter Length', v: calcHyp },
          { label:'Angle', v: calcAngle },
        ]}/>
      </ProSection>

      <ProSection title="Diagonal · Squaring" badge="LAYOUT" help="Enter width and height to find the diagonal. If both diagonals of a rectangle are equal, the corners are square. Essential for framing, cabinet carcasses, and drawer squaring.">
        <div style={{ display:'flex', gap:8 }}>
          <CalcInput label="Width" value={dw} onChange={setDw} placeholder="8'" />
          <CalcInput label="Height" value={dh} onChange={setDh} placeholder="10'" />
        </div>
        <ProDisplay items={[
          { label:'Diagonal', v: diagVal },
          { label:'Angle',    v: diagAngle },
        ]}/>
      </ProSection>

      <ProSection title="Stair Layout" badge="STAIRS" help="Enter total rise (floor-to-floor height) and number of risers. Code requires 4&quot;–7¾&quot; riser height and 10–11&quot; tread depth. The rule of thumb: riser + tread ≈ 17–18&quot;.">
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <CalcInput label="Total rise" value={totalRise} onChange={setTotalRise} placeholder={`8'4"`} />
          <CalcInput label="# risers" value={numRisers} onChange={setNumRisers} placeholder="14" />
          <CalcInput label="Tread (in)" value={treadW} onChange={setTreadW} placeholder="10" />
        </div>
        <ProDisplay items={[
          { label:'Riser Height', v: riserH },
          { label:'Total Run',   v: stairRun },
          { label:'Stair Angle', v: stairAng },
        ]}/>
        {riserOk !== null && (
          <div style={{ marginTop:10, background:riserOk?'var(--green-dim)':'var(--orange-dim)', borderRadius:8, padding:'8px 12px', fontSize:13, fontWeight:600, color:riserOk?'var(--green)':'var(--orange)' }}>
            {riserOk ? '✓ Riser within code (4"–7¾")' : `⚠ Riser ${riserH} is outside typical code range`}
          </div>
        )}
      </ProSection>

      <ProSection title="Circle · Arc" help="Enter any one measurement to calculate the rest. Works for turning bowls, roundovers, arc calculations, and circular saw jigs.">
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
          {['diameter','radius','circumference','area'].map(t => (
            <button key={t} onClick={() => setCircType(t)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              fontFamily: 'inherit', border: 'none', cursor: 'pointer',
              background: circType===t ? 'var(--accent)' : 'var(--fill)',
              color: circType===t ? '#fff' : 'var(--text-3)',
              transition: 'all 120ms',
            }}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        <CalcInput label={`Enter ${circType}`} value={circInput} onChange={setCircInput} placeholder={circType==='area'?'100 in²':'12"'} />
        <ProDisplay items={[
          { label:'Diameter',      v: circType!=='diameter'      ? circDiam  : null },
          { label:'Radius',        v: circType!=='radius'        ? circRad   : null },
          { label:'Circumference', v: circType!=='circumference' ? circPerim : null },
          { label:'Area',          v: circType!=='area'          ? circArea  : null },
        ]}/>
      </ProSection>

      <ProSection title="Compound Miter" badge="SAW" help="Corner angle: total joint angle (90° for a standard box, 72° for a pentagon). Blade tilt: degrees from vertical. Calculates the miter angle and bevel angle for your saw settings.">
        <div style={{ display:'flex', gap:8 }}>
          <CalcInput label="Corner angle (°)" value={corner} onChange={setCorner} placeholder="90" />
          <CalcInput label="Blade tilt (°)" value={bladeTilt} onChange={setBladeTilt} placeholder="0 for flat" />
        </div>
        <ProDisplay items={[
          { label:'Flat Miter',   v: flatMiter },
          { label:'Comp. Miter', v: compMiter },
          { label:'Blade Bevel', v: compBevel },
        ]}/>
      </ProSection>

    </div>
  )
}

// ─── Tab: Notes ───────────────────────────────────────────────────────────────
function CalcNotes() {
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem('calc-notes') || '' } catch { return '' }
  })
  const save = v => { setNotes(v); try { localStorage.setItem('calc-notes', v) } catch {} }
  return (
    <div style={{ padding: '4px 20px 40px', maxWidth: 640, margin: '0 auto' }}>
      <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>Scratch pad — saves locally.</p>
      <textarea
        className="form-textarea"
        value={notes}
        onChange={e => save(e.target.value)}
        placeholder={"Measurements, cut lists, reminders…\n\nActual sizes:\n  2×4 = 1.5\" × 3.5\"\n  2×6 = 1.5\" × 5.5\"\n  1×4 = 0.75\" × 3.5\""}
        style={{ width: '100%', minHeight: 320, fontSize: 14, lineHeight: 1.7 }}
      />
      {notes && (
        <button className="btn-text" style={{ marginTop: 8, color: 'var(--red)' }} onClick={() => { if (window.confirm('Clear notes?')) save('') }}>
          Clear notes
        </button>
      )}
    </div>
  )
}

// ─── Main Calculators page ────────────────────────────────────────────────────
const ALL_TABS = [
  { id:'boardfoot', label:'Board Foot', icon: '📐' },
  { id:'fractions', label:'Fractions',  icon: '⅝' },
  { id:'converter', label:'Converter',  icon: '🔄' },
  { id:'trim',      label:'Trim Cuts',  icon: '✂️' },
  { id:'sheet',     label:'Sheet Goods', icon: '📦' },
  { id:'advanced',  label:'Advanced',   icon: '📊' },
  { id:'notes',     label:'Notes',      icon: '📝' },
]

export default function Calculators() {
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('calc-tab') || 'boardfoot' } catch { return 'boardfoot' }
  })

  const switchTab = t => {
    setTab(t)
    try { localStorage.setItem('calc-tab', t) } catch {}
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ paddingBottom: 0 }}>
        <h1 className="page-title">Calculators</h1>
        {/* Mobile: dropdown */}
        <div className="calc-tab-select-wrap">
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
            <select
              className="filter-select"
              value={tab}
              onChange={e => switchTab(e.target.value)}
              style={{ width: '100%' }}
            >
              {ALL_TABS.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
            <span className="filter-select-chevron" aria-hidden="true">▾</span>
          </div>
        </div>
        {/* Desktop: tabs */}
        <div className="page-tabs" style={{ marginTop: 12 }}>
          {ALL_TABS.map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)} className={`page-tab${tab === t.id ? ' active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="scroll-page" style={{ paddingTop: 16 }}>
        {tab === 'boardfoot' && <BoardFoot />}
        {tab === 'fractions' && <FractionCalc />}
        {tab === 'converter' && <UnitConverter />}
        {tab === 'trim'      && <TrimCuts />}
        {tab === 'sheet'     && <SheetGoods />}
        {tab === 'advanced'  && <AdvancedCalc />}
        {tab === 'notes'     && <CalcNotes />}
      </div>
    </div>
  )
}
