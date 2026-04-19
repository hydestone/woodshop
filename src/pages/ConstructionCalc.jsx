import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

// ─── Math utilities (unchanged from original) ─────────────────────────────────
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

function parseFracObj(s) {
  s = (s || '').trim()
  // feet-inch: 4'6" or 4' 6 1/2"
  const ftIn = s.match(/^(-?\d+(?:\.\d+)?)['']\s*(\d+(?:\s+\d+\/\d+|\s*\d*\/?\d*)?)\s*"?\s*$/)
  if (ftIn) {
    const ft = parseFloat(ftIn[1])
    const inPart = parseFracObj(ftIn[2].trim())
    if (inPart) return fracReduce(Math.round((ft * 12 + fracToDecimal(inPart)) * 64), 64)
    return fracReduce(Math.round(ft * 12 * 64), 64)
  }
  // feet only: 4'
  const ftOnly = s.match(/^(-?\d+(?:\.\d+)?)['']\s*$/)
  if (ftOnly) return fracReduce(Math.round(parseFloat(ftOnly[1]) * 12 * 64), 64)
  // mixed: 3 1/2
  const m = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (m) { const sign = +m[1] < 0 ? -1 : 1; return fracReduce(+m[1] * +m[3] + sign * +m[2], +m[3]) }
  // fraction: 3/4
  const f = s.match(/^(-?\d+)\/(\d+)$/)
  if (f) return fracReduce(+f[1], +f[2])
  // decimal
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
      {(w === 0 || r !== 0) && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: fontSize * 0.6, lineHeight: 1 }}>
          <span style={{ borderBottom: '1.5px solid currentColor', paddingBottom: 1 }}>{w === 0 && n < 0 ? '-' : ''}{r || Math.abs(n)}</span>
          <span style={{ paddingTop: 1 }}>{d}</span>
        </span>
      )}
    </span>
  )
}

function inchToFrac(dec, den = 16) {
  const neg = dec < 0; dec = Math.abs(dec)
  const w = Math.floor(dec), f = dec - w
  const n = Math.round(f * den)
  if (n === 0) return { w: neg ? -w : w, n: 0, d: den }
  if (n === den) return { w: neg ? -(w + 1) : w + 1, n: 0, d: den }
  const g = gcd(n, den)
  return { w: neg ? -w : w, n: n / g, d: den / g }
}

function decToFracStr(dec, den = 16) {
  const { w, n, d } = inchToFrac(Math.abs(dec), den)
  const sign = dec < 0 ? '-' : ''
  if (n === 0) return `${sign}${w}"`
  if (w === 0) return `${sign}${n}/${d}"`
  return `${sign}${w} ${n}/${d}"`
}

function inToFtInStr(inches) {
  const neg = inches < 0; inches = Math.abs(inches)
  const ft = Math.floor(inches / 12), ins = inches % 12
  const pref = neg ? '-' : ''
  if (ft === 0) return pref + decToFracStr(ins)
  if (ins < 0.002) return `${pref}${ft}'`
  return `${pref}${ft}' ${decToFracStr(ins)}`
}

function parseLenIn(s) {
  const f = parseFracObj(s)
  return f ? fracToDecimal(f) : null
}

// ─── Construction Calculator ─────────────────────────────────────────────────

const HISTORY_KEY = 'calc-cm-history'
const MEMORY_KEY = 'calc-cm-memory'

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] } catch { return [] }
}
function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20))) } catch {}
}
function loadMemory() {
  try { const m = localStorage.getItem(MEMORY_KEY); return m ? JSON.parse(m) : null } catch { return null }
}
function saveMemory(m) {
  try { if (m) localStorage.setItem(MEMORY_KEY, JSON.stringify(m)); else localStorage.removeItem(MEMORY_KEY) } catch {}
}

export default function ConstructionCalc() {
  // ── Calculator state ────────────────────────────────────────────────────
  const [display, setDisplay]     = useState('')
  const [left, setLeft]           = useState(null)
  const [op, setOp]               = useState(null)
  const [result, setResult]       = useState(null)
  const [justEvaled, setJustEvaled] = useState(false)

  // Memory
  const [memory, setMemoryState]  = useState(() => loadMemory())
  const setMemory = v => { setMemoryState(v); saveMemory(v) }

  // History
  const [history, setHistoryState] = useState(() => loadHistory())
  const [showHistory, setShowHistory] = useState(false)
  const setHistory = h => { setHistoryState(h); saveHistory(h) }

  // Mode
  const [mode, setMode] = useState('basic') // 'basic' | 'enhanced'

  // Construction function state
  const [conState, setConState] = useState({})
  const [conMode, setConMode]   = useState(null) // 'pitch'|'diag'|'stairs'|'circle'|'miter'|null
  const [showHelp, setShowHelp] = useState(false)

  // ── Parsing ─────────────────────────────────────────────────────────────
  const parsedDisplay = useMemo(() => display ? parseFracObj(display) : null, [display])
  const activeVal = result || parsedDisplay

  // ── Keypad handlers ─────────────────────────────────────────────────────
  const appendDigit = d => {
    setResult(null)
    if (justEvaled) { setDisplay(d); setJustEvaled(false); return }
    setDisplay(prev => {
      if (d === '.' && prev.includes('.') && !prev.includes("'")) return prev
      return prev + d
    })
  }

  const appendChar = c => {
    setResult(null)
    setJustEvaled(false)
    setDisplay(prev => prev + c)
  }

  const setDenominator = den => {
    setResult(null)
    setJustEvaled(false)
    setDisplay(prev => {
      if (!prev) return `1/${den}`
      const mixedMatch = prev.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
      if (mixedMatch) return `${mixedMatch[1]} ${mixedMatch[2]}/${den}`
      const fracMatch = prev.match(/^(\d+)\/(\d+)$/)
      if (fracMatch) return `${fracMatch[1]}/${den}`
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
      setOp(newOp)
    }
  }

  const pressEquals = () => {
    const rhs = parsedDisplay
    const lhs = left
    if (!rhs || !lhs || !op) return
    let res
    if (op === '+') res = fracAdd(lhs, rhs)
    else if (op === '−') res = fracSub(lhs, rhs)
    else if (op === '×') res = fracMul(lhs, rhs)
    else if (op === '÷') res = fracDiv(lhs, rhs)
    if (res) {
      // Add to history
      const entry = { left: lhs, op, right: rhs, result: res, ts: Date.now() }
      setHistory([entry, ...history].slice(0, 20))
      setResult(res)
      setLeft(res)
      setOp(null)
      setDisplay('')
      setJustEvaled(true)
    }
  }

  const pressAC = () => {
    setDisplay(''); setLeft(null); setOp(null); setResult(null); setJustEvaled(false)
  }

  const pressBackspace = () => {
    setResult(null); setJustEvaled(false)
    setDisplay(prev => prev.slice(0, -1))
  }

  // ── Memory handlers ─────────────────────────────────────────────────────
  const memAdd = () => {
    const v = activeVal; if (!v) return
    if (memory) setMemory(fracAdd(memory, v))
    else setMemory(v)
  }
  const memSub = () => {
    const v = activeVal; if (!v) return
    if (memory) setMemory(fracSub(memory, v))
    else setMemory({ n: -v.n, d: v.d })
  }
  const memRecall = () => {
    if (!memory) return
    setResult(memory)
    setJustEvaled(true)
  }
  const memClear = () => setMemory(null)

  // ── Recall from history ─────────────────────────────────────────────────
  const recallHistory = entry => {
    setResult(entry.result)
    setLeft(entry.result)
    setOp(null)
    setDisplay('')
    setJustEvaled(true)
    setShowHistory(false)
  }

  // ── Construction function handlers ──────────────────────────────────────
  const setConVal = (mode, key) => {
    const v = activeVal
    if (!v) return
    const dec = fracToDecimal(v)
    setConState(prev => ({ ...prev, [`${mode}_${key}`]: dec }))
    pressAC()
  }

  // Construction computed results
  const conResults = useMemo(() => {
    const s = conState
    const r = {}

    // Pitch/Rise/Run
    const pitch = s.pitch_pitch, rise = s.pitch_rise, run = s.pitch_run
    if (rise && run) {
      r.pitch_pitch = +(rise / run * 12).toFixed(3)
      r.pitch_rafter = Math.sqrt(rise * rise + run * run)
      r.pitch_angle = (Math.atan(rise / run) * 180 / Math.PI).toFixed(1) + '°'
    }
    if (pitch && run && !rise) r.pitch_rise = pitch * run / 12
    if (pitch && rise && !run) r.pitch_run = rise * 12 / pitch
    if (pitch && run) r.pitch_rafter = Math.sqrt(Math.pow(pitch * run / 12, 2) + run * run)
    if (pitch) r.pitch_angle = (Math.atan(pitch / 12) * 180 / Math.PI).toFixed(1) + '°'

    // Diagonal
    const dw = s.diag_width, dh = s.diag_height
    if (dw && dh) {
      r.diag_diagonal = Math.sqrt(dw * dw + dh * dh)
      r.diag_angle = (Math.atan(dh / dw) * 180 / Math.PI).toFixed(1) + '°'
    }

    // Stairs
    const totalRise = s.stairs_rise, numRisers = s.stairs_risers, treadW = s.stairs_tread || 10
    if (totalRise && numRisers) {
      const riserH = totalRise / numRisers
      r.stairs_riserH = riserH
      r.stairs_run = (numRisers - 1) * treadW
      r.stairs_angle = (Math.atan(riserH / treadW) * 180 / Math.PI).toFixed(1) + '°'
      r.stairs_ok = riserH >= 4 && riserH <= 7.75
    }

    // Circle
    const circR = s.circle_radius, circD = s.circle_diameter, circC = s.circle_circ
    let cr = null
    if (circR) cr = circR
    else if (circD) cr = circD / 2
    else if (circC) cr = circC / (2 * Math.PI)
    if (cr) {
      r.circle_radius = cr
      r.circle_diameter = cr * 2
      r.circle_circ = cr * 2 * Math.PI
      r.circle_area = (cr * cr * Math.PI).toFixed(2) + ' in²'
    }

    // Compound miter
    const corner = s.miter_corner, tilt = s.miter_tilt
    if (corner) {
      const half = corner / 2
      r.miter_flat = (90 - half).toFixed(2) + '°'
      if (tilt !== undefined && tilt !== null) {
        r.miter_comp = (Math.atan(Math.cos(tilt * Math.PI / 180) * Math.tan(half * Math.PI / 180)) * 180 / Math.PI).toFixed(2) + '°'
        r.miter_bevel = (Math.atan(Math.sin(half * Math.PI / 180) * Math.sin(tilt * Math.PI / 180)) * 180 / Math.PI).toFixed(2) + '°'
      }
    }

    return r
  }, [conState])

  // ── Display string ──────────────────────────────────────────────────────
  const eqLine = [
    left ? fracToHTML(left, { fontSize: 16, color: 'rgba(255,255,255,.5)' }) : null,
    op ? <span key="op" style={{ fontSize: 18, color: '#F59E0B', fontWeight: 700, margin: '0 4px' }}>{op}</span> : null,
    !result && parsedDisplay && op
      ? fracToHTML(parsedDisplay, { fontSize: 16, color: 'rgba(255,255,255,.5)' })
      : null,
  ].filter(Boolean)

  // ── Render ──────────────────────────────────────────────────────────────
  const Btn = ({ children, onClick, className = '', style = {}, ...rest }) => (
    <button className={`cm-key ${className}`} onClick={onClick} style={style} {...rest}>{children}</button>
  )

  return (
    <div style={{ padding: '0 12px 40px', maxWidth: 480, margin: '0 auto' }}>

      {/* ── Mode toggle ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <div className="cm-mode-toggle">
          <button className={mode === 'basic' ? 'active' : ''} onClick={() => setMode('basic')}>Basic</button>
          <button className={mode === 'enhanced' ? 'active' : ''} onClick={() => setMode('enhanced')}>Enhanced</button>
        </div>
      </div>

      {/* ── Display ── */}
      <div className="cm-display">
        {/* Status bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, minHeight: 18 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {memory && <span className="cm-indicator">M</span>}
            {mode === 'enhanced' && <span className="cm-indicator" style={{ background: 'rgba(45,90,61,.4)', color: '#4ADE80' }}>ENH</span>}
          </div>
          {conMode && <span style={{ fontSize: 11, color: '#8BA8D0', textTransform: 'uppercase' }}>{conMode}</span>}
        </div>

        {/* Equation line */}
        {eqLine.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4, minHeight: 22 }}>
            {eqLine}
          </div>
        )}

        {/* Main value */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', minHeight: 44 }}>
          {result
            ? <span key={`${result.n}/${result.d}`} className="result-pop">
                {fracToHTML(result, { fontSize: 36, color: '#4ADE80', fontWeight: 800 })}
              </span>
            : display
              ? <span style={{ fontSize: 28, color: '#fff', fontWeight: 700, wordBreak: 'break-all' }}>{display}</span>
              : <span style={{ fontSize: 28, color: 'rgba(255,255,255,.2)' }}>0</span>
          }
        </div>

        {/* Conversions line */}
        {activeVal && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#8BA8D0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>{fracToDecimal(activeVal).toFixed(4)}"</span>
            <span>{(fracToDecimal(activeVal) * 25.4).toFixed(2)} mm</span>
            <span>{inToFtInStr(fracToDecimal(activeVal))}</span>
          </div>
        )}
      </div>

      {/* ── History tape (collapsible) ── */}
      {showHistory && history.length > 0 && (
        <div className="cm-history">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>History</span>
            <button onClick={() => { setHistory([]); setShowHistory(false) }} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
          </div>
          {history.map((h, i) => (
            <button key={h.ts} onClick={() => recallHistory(h)} className="cm-history-item">
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                {fracToHTML(h.left, { fontSize: 12 })} {h.op} {fracToHTML(h.right, { fontSize: 12 })}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>= {fracToHTML(h.result, { fontSize: 13 })}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Memory bar ── */}
      <div className="cm-memory-bar">
        <button onClick={memAdd} className="cm-mem-btn">M+</button>
        <button onClick={memSub} className="cm-mem-btn">M−</button>
        <button onClick={memRecall} className="cm-mem-btn" disabled={!memory}>MR</button>
        <button onClick={memClear} className="cm-mem-btn" disabled={!memory}>MC</button>
        <button onClick={() => setShowHistory(h => !h)} className={`cm-mem-btn${showHistory ? ' active' : ''}`}>
          {showHistory ? '▲' : '▼'} {history.length || ''}
        </button>
      </div>

      {/* ── Main keypad (5×5) ── */}
      <div className="cm-keypad">
        {/* Row 1 */}
        {[7,8,9].map(n => <Btn key={n} onClick={() => appendDigit(String(n))}>{n}</Btn>)}
        <Btn className="amber" onClick={() => pressOp('÷')}>÷</Btn>
        <Btn className="red" onClick={pressAC}>AC</Btn>

        {/* Row 2 */}
        {[4,5,6].map(n => <Btn key={n} onClick={() => appendDigit(String(n))}>{n}</Btn>)}
        <Btn className="amber" onClick={() => pressOp('×')}>×</Btn>
        <Btn className="gray" onClick={pressBackspace}>⌫</Btn>

        {/* Row 3 */}
        {[1,2,3].map(n => <Btn key={n} onClick={() => appendDigit(String(n))}>{n}</Btn>)}
        <Btn className="amber" onClick={() => pressOp('−')}>−</Btn>
        <Btn className="gray" onClick={() => appendChar('/')}>/</Btn>

        {/* Row 4 */}
        <Btn onClick={() => appendDigit('0')}>0</Btn>
        <Btn onClick={() => appendDigit('.')}>.</Btn>
        <Btn className="unit" onClick={() => appendChar("'")}>ft '</Btn>
        <Btn className="amber" onClick={() => pressOp('+')}>+</Btn>
        <Btn className="unit" onClick={() => appendChar('"')}>in "</Btn>

        {/* Row 5 — denominators + equals */}
        <Btn className="den" onClick={() => setDenominator(2)}>/2</Btn>
        <Btn className="den" onClick={() => setDenominator(4)}>/4</Btn>
        <Btn className="den" onClick={() => setDenominator(8)}>/8</Btn>
        <Btn className="den" onClick={() => setDenominator(16)}>/16</Btn>
        <Btn className="forest" onClick={pressEquals}>=</Btn>
      </div>

      {/* ── Enhanced: Construction functions ── */}
      {mode === 'enhanced' && (
        <div style={{ marginTop: 8 }}>
          <div className="cm-con-grid">
            <button className={`cm-con-btn${conMode === 'pitch' ? ' active' : ''}`} onClick={() => setConMode(conMode === 'pitch' ? null : 'pitch')}>
              <span className="cm-con-icon">△</span>Pitch
            </button>
            <button className={`cm-con-btn${conMode === 'diag' ? ' active' : ''}`} onClick={() => setConMode(conMode === 'diag' ? null : 'diag')}>
              <span className="cm-con-icon">⬜</span>Diagonal
            </button>
            <button className={`cm-con-btn${conMode === 'stairs' ? ' active' : ''}`} onClick={() => setConMode(conMode === 'stairs' ? null : 'stairs')}>
              <span className="cm-con-icon">▤</span>Stairs
            </button>
            <button className={`cm-con-btn${conMode === 'circle' ? ' active' : ''}`} onClick={() => setConMode(conMode === 'circle' ? null : 'circle')}>
              <span className="cm-con-icon">○</span>Circle
            </button>
            <button className={`cm-con-btn${conMode === 'miter' ? ' active' : ''}`} onClick={() => setConMode(conMode === 'miter' ? null : 'miter')}>
              <span className="cm-con-icon">∠</span>Miter
            </button>
            <button className={`cm-con-btn help`} onClick={() => setShowHelp(h => !h)}>
              <span className="cm-con-icon">?</span>Help
            </button>
          </div>

          {/* ── Construction input panel ── */}
          {conMode === 'pitch' && (
            <ConPanel title="Pitch · Rise · Run" hint="Enter a value, then press the dimension button. Enter any two to solve.">
              <div className="cm-con-inputs">
                <ConInput label="Pitch (in 12)" value={conState.pitch_pitch} onSet={() => setConVal('pitch', 'pitch')} computed={!conState.pitch_pitch && conResults.pitch_pitch} />
                <ConInput label="Rise" value={conState.pitch_rise} onSet={() => setConVal('pitch', 'rise')} computed={!conState.pitch_rise && conResults.pitch_rise} isLen />
                <ConInput label="Run" value={conState.pitch_run} onSet={() => setConVal('pitch', 'run')} computed={!conState.pitch_run && conResults.pitch_run} isLen />
              </div>
              {(conResults.pitch_rafter || conResults.pitch_angle) && (
                <div className="cm-con-results">
                  {conResults.pitch_rafter && <ConResult label="Rafter" value={inToFtInStr(conResults.pitch_rafter)} />}
                  {conResults.pitch_angle && <ConResult label="Angle" value={conResults.pitch_angle} />}
                </div>
              )}
              {conState.pitch_rise && conState.pitch_run && <PitchViz rise={conState.pitch_rise} run={conState.pitch_run} />}
              <button className="cm-con-clear" onClick={() => setConState(s => { const n = {...s}; delete n.pitch_pitch; delete n.pitch_rise; delete n.pitch_run; return n })}>Clear pitch values</button>
            </ConPanel>
          )}

          {conMode === 'diag' && (
            <ConPanel title="Diagonal · Squaring" hint="Enter width and height. Measure both diagonals — if equal, it's square.">
              <div className="cm-con-inputs">
                <ConInput label="Width" value={conState.diag_width} onSet={() => setConVal('diag', 'width')} />
                <ConInput label="Height" value={conState.diag_height} onSet={() => setConVal('diag', 'height')} />
              </div>
              {(conResults.diag_diagonal || conResults.diag_angle) && (
                <div className="cm-con-results">
                  {conResults.diag_diagonal && <ConResult label="Diagonal" value={inToFtInStr(conResults.diag_diagonal)} />}
                  {conResults.diag_angle && <ConResult label="Angle" value={conResults.diag_angle} />}
                </div>
              )}
              {conState.diag_width && conState.diag_height && <DiagViz w={conState.diag_width} h={conState.diag_height} />}
              <button className="cm-con-clear" onClick={() => setConState(s => { const n = {...s}; delete n.diag_width; delete n.diag_height; return n })}>Clear diagonal values</button>
            </ConPanel>
          )}

          {conMode === 'stairs' && (
            <ConPanel title="Stairs" hint="Code: 4&quot;–7¾&quot; riser, 10–11&quot; tread. Enter total rise, # risers, and tread width.">
              <div className="cm-con-inputs">
                <ConInput label="Total rise" value={conState.stairs_rise} onSet={() => setConVal('stairs', 'rise')} isLen />
                <ConInput label="# Risers" value={conState.stairs_risers} onSet={() => setConVal('stairs', 'risers')} />
                <ConInput label="Tread (in)" value={conState.stairs_tread} onSet={() => setConVal('stairs', 'tread')} />
              </div>
              {conResults.stairs_riserH && (
                <div className="cm-con-results">
                  <ConResult label="Riser height" value={inToFtInStr(conResults.stairs_riserH)} />
                  {conResults.stairs_run && <ConResult label="Total run" value={inToFtInStr(conResults.stairs_run)} />}
                  {conResults.stairs_angle && <ConResult label="Angle" value={conResults.stairs_angle} />}
                </div>
              )}
              {conResults.stairs_ok !== undefined && (
                <div style={{ marginTop: 8, background: conResults.stairs_ok ? 'var(--green-dim)' : 'var(--orange-dim)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: conResults.stairs_ok ? 'var(--green)' : 'var(--orange)' }}>
                  {conResults.stairs_ok ? '✓ Riser within code (4"–7¾")' : '⚠ Riser outside typical code range (4"–7¾")'}
                </div>
              )}
              {conResults.stairs_riserH && conState.stairs_risers && <StairsViz riserH={conResults.stairs_riserH} tread={conState.stairs_tread || 10} numRisers={Math.min(conState.stairs_risers, 8)} />}
              <button className="cm-con-clear" onClick={() => setConState(s => { const n = {...s}; delete n.stairs_rise; delete n.stairs_risers; delete n.stairs_tread; return n })}>Clear stair values</button>
            </ConPanel>
          )}

          {conMode === 'circle' && (
            <ConPanel title="Circle · Arc" hint="Enter radius, diameter, or circumference.">
              <div className="cm-con-inputs">
                <ConInput label="Radius" value={conState.circle_radius} onSet={() => setConVal('circle', 'radius')} computed={!conState.circle_radius && conResults.circle_radius} isLen />
                <ConInput label="Diameter" value={conState.circle_diameter} onSet={() => setConVal('circle', 'diameter')} computed={!conState.circle_diameter && conResults.circle_diameter} isLen />
                <ConInput label="Circumference" value={conState.circle_circ} onSet={() => setConVal('circle', 'circ')} computed={!conState.circle_circ && conResults.circle_circ} isLen />
              </div>
              {conResults.circle_area && (
                <div className="cm-con-results">
                  <ConResult label="Area" value={conResults.circle_area} />
                </div>
              )}
              <button className="cm-con-clear" onClick={() => setConState(s => { const n = {...s}; delete n.circle_radius; delete n.circle_diameter; delete n.circle_circ; return n })}>Clear circle values</button>
            </ConPanel>
          )}

          {conMode === 'miter' && (
            <ConPanel title="Compound Miter" hint="Corner angle: total joint angle (90° for a box). Blade tilt: degrees from vertical.">
              <div className="cm-con-inputs">
                <ConInput label="Corner (°)" value={conState.miter_corner} onSet={() => setConVal('miter', 'corner')} />
                <ConInput label="Tilt (°)" value={conState.miter_tilt} onSet={() => setConVal('miter', 'tilt')} />
              </div>
              {(conResults.miter_flat || conResults.miter_comp) && (
                <div className="cm-con-results">
                  {conResults.miter_flat && <ConResult label="Flat miter" value={conResults.miter_flat} />}
                  {conResults.miter_comp && <ConResult label="Comp. miter" value={conResults.miter_comp} />}
                  {conResults.miter_bevel && <ConResult label="Blade bevel" value={conResults.miter_bevel} />}
                </div>
              )}
              <button className="cm-con-clear" onClick={() => setConState(s => { const n = {...s}; delete n.miter_corner; delete n.miter_tilt; return n })}>Clear miter values</button>
            </ConPanel>
          )}

          {/* ── Help panel ── */}
          {showHelp && (
            <ConPanel title="Construction Functions — Help">
              <div className="cm-help-grid">
                <HelpItem title="Pitch · Rise · Run" desc="Enter any two values to solve a right triangle. Pitch is rise per 12 inches of run (e.g., 6/12 pitch). Calculates rafter length and angle." />
                <HelpItem title="Diagonal · Squaring" desc="Enter width and height to find the diagonal. Use this to check if a frame is square — both diagonals should be equal." />
                <HelpItem title="Stairs" desc="Enter total rise and number of risers to calculate individual riser height. Building code requires 4&quot;–7¾&quot; risers with 10–11&quot; treads." />
                <HelpItem title="Circle · Arc" desc="Enter any one dimension (radius, diameter, or circumference) to calculate all others plus area." />
                <HelpItem title="Compound Miter" desc="For angled joints: enter the corner angle (90° for a box) and blade tilt. Calculates the miter and bevel angles for your saw." />
                <HelpItem title="Fractions &amp; Feet-Inch" desc="Type fractions with /: 3/4, 1 3/8. Use ' for feet and &quot; for inches: 4'6&quot;. Denominator buttons (/2, /4, /8, /16) set the fraction denominator." />
                <HelpItem title="Memory" desc="M+ adds current value to memory. M− subtracts. MR recalls. MC clears. Memory persists between sessions." />
              </div>
            </ConPanel>
          )}
        </div>
      )}

      {/* ── Quick conversions (always visible when there's a value) ── */}
      {activeVal && (
        <div className="cm-conversions">
          <div className="label-caps" style={{ marginBottom: 6 }}>Nearest fractions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
            {[2, 4, 8, 16].map(den => {
              const dec = fracToDecimal(activeVal)
              const { w, n, d } = inchToFrac(dec, den)
              return (
                <div key={den} className="cm-conv-cell">
                  <div style={{ fontSize: 9, color: 'var(--text-4)' }}>1/{den}"</div>
                  <strong style={{ fontSize: 12 }}>{n === 0 ? `${w}"` : `${w > 0 ? w + ' ' : ''}${n}/${d}"`}</strong>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConPanel({ title, hint, children }) {
  return (
    <div className="cm-con-panel">
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      {hint && <p style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 10, lineHeight: 1.5 }}>{hint}</p>}
      {children}
    </div>
  )
}

function ConInput({ label, value, onSet, computed, isLen }) {
  const displayVal = computed
    ? (isLen ? inToFtInStr(computed) : String(computed))
    : value != null
      ? (isLen ? inToFtInStr(value) : String(value))
      : null
  const isComputed = computed && !value

  return (
    <div className="cm-con-input-wrap">
      <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div className={`cm-con-value${isComputed ? ' computed' : ''}${displayVal ? ' has-value' : ''}`}>
          {displayVal || '—'}
        </div>
        <button className="cm-con-set-btn" onClick={onSet}>Set</button>
      </div>
    </div>
  )
}

function ConResult({ label, value }) {
  return (
    <div className="cm-con-result-item">
      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--forest)' }}>{value}</span>
    </div>
  )
}

function HelpItem({ title, desc }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, margin: 0 }}>{desc}</p>
    </div>
  )
}

// ─── Visualizations (SVG) ─────────────────────────────────────────────────────

function PitchViz({ rise, run }) {
  const scale = 120 / Math.max(rise, run)
  const rW = Math.round(run * scale), rH = Math.round(rise * scale)
  const pad = 30
  return (
    <svg viewBox={`0 0 ${rW + pad * 2} ${rH + pad * 2}`} style={{ width: '100%', maxHeight: 120, margin: '10px 0' }}>
      {/* Triangle */}
      <polygon points={`${pad},${rH + pad} ${rW + pad},${rH + pad} ${pad},${pad}`} fill="rgba(74,222,128,.08)" stroke="rgba(74,222,128,.6)" strokeWidth="1.5" />
      {/* Labels */}
      <text x={pad + rW / 2} y={rH + pad + 16} textAnchor="middle" fill="var(--text-3)" fontSize="10" fontFamily="system-ui">Run: {inToFtInStr(run)}</text>
      <text x={pad - 14} y={pad + rH / 2} textAnchor="middle" fill="var(--text-3)" fontSize="10" fontFamily="system-ui" transform={`rotate(-90,${pad - 14},${pad + rH / 2})`}>Rise: {inToFtInStr(rise)}</text>
      <text x={pad + rW / 2 + 8} y={pad + rH / 2 - 4} textAnchor="middle" fill="#4ADE80" fontSize="10" fontWeight="700" fontFamily="system-ui" transform={`rotate(${-Math.atan(rise / run) * 180 / Math.PI},${pad + rW / 2 + 8},${pad + rH / 2 - 4})`}>
        Rafter: {inToFtInStr(Math.sqrt(rise * rise + run * run))}
      </text>
      {/* Right angle marker */}
      <polyline points={`${pad + 12},${rH + pad} ${pad + 12},${rH + pad - 12} ${pad},${rH + pad - 12}`} fill="none" stroke="var(--text-4)" strokeWidth="1" />
    </svg>
  )
}

function DiagViz({ w, h }) {
  const scale = 100 / Math.max(w, h)
  const rW = Math.round(w * scale), rH = Math.round(h * scale)
  const pad = 24
  return (
    <svg viewBox={`0 0 ${rW + pad * 2} ${rH + pad * 2}`} style={{ width: '100%', maxHeight: 100, margin: '10px 0' }}>
      <rect x={pad} y={pad} width={rW} height={rH} fill="none" stroke="var(--text-4)" strokeWidth="1" strokeDasharray="4,3" />
      <line x1={pad} y1={rH + pad} x2={rW + pad} y2={pad} stroke="#4ADE80" strokeWidth="1.5" />
      <text x={pad + rW / 2} y={rH + pad + 14} textAnchor="middle" fill="var(--text-3)" fontSize="10" fontFamily="system-ui">{inToFtInStr(w)}</text>
      <text x={pad + rW / 2 + 6} y={pad + rH / 2 - 4} textAnchor="middle" fill="#4ADE80" fontSize="10" fontWeight="700" fontFamily="system-ui">
        {inToFtInStr(Math.sqrt(w * w + h * h))}
      </text>
    </svg>
  )
}

function StairsViz({ riserH, tread, numRisers }) {
  const n = Math.min(numRisers, 8)
  const stepW = 22, stepH = 16
  const w = n * stepW + 40, h = n * stepH + 40
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxHeight: 120, margin: '10px 0' }}>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={20 + i * stepW} y={h - 20 - (i + 1) * stepH} width={stepW} height={stepH}
            fill="rgba(74,222,128,.08)" stroke="rgba(74,222,128,.5)" strokeWidth="1" />
        </g>
      ))}
      {/* Riser label */}
      <text x={12} y={h - 20 - stepH / 2} textAnchor="middle" fill="var(--text-4)" fontSize="8" fontFamily="system-ui" transform={`rotate(-90,12,${h - 20 - stepH / 2})`}>
        {decToFracStr(riserH)}
      </text>
      {/* Tread label */}
      <text x={20 + stepW / 2} y={h - 10} textAnchor="middle" fill="var(--text-4)" fontSize="8" fontFamily="system-ui">
        {tread}"
      </text>
    </svg>
  )
}
