import { useState } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'

const WEBHOOK = 'https://script.google.com/macros/s/AKfycbzyB_ThPvl4xc8DDEwE7_QwjmGBlAsXwerQTnqw8N45pLAIgBsW3uBQ7RSkUZzz4E0/exec'

const QUESTIONS = [
  {
    id: 'overall',
    label: 'How would you rate JDH Woodworks overall?',
    type: 'rating',
  },
  {
    id: 'useful_features',
    label: 'Which features do you use most?',
    type: 'multi',
    options: ['Project tracking', 'Photo management', 'Construction calculator', 'Wood stock inventory', 'Shopping list', 'Finishing/coats tracking', 'Shop maintenance'],
  },
  {
    id: 'missing',
    label: 'What feature is most missing?',
    type: 'single',
    options: ['Cut list / materials calculator', 'Time tracking per project', 'Client invoicing / estimates', 'Tool inventory', 'Video uploads', 'Shared/team access', 'Mobile offline mode', 'Other (describe below)'],
  },
  {
    id: 'ease',
    label: 'How easy is the app to navigate?',
    type: 'rating',
  },
  {
    id: 'mobile',
    label: 'Do you use JDH Woodworks on your phone?',
    type: 'single',
    options: ['Yes, mostly phone', 'Yes, but mostly desktop', 'Desktop only', 'Haven\'t tried mobile'],
  },
  {
    id: 'recommend',
    label: 'How likely are you to recommend this to another woodworker?',
    type: 'rating',
  },
  {
    id: 'frustrations',
    label: 'What frustrates you most about the app?',
    type: 'text',
  },
  {
    id: 'love',
    label: 'What do you love about it?',
    type: 'text',
  },
  {
    id: 'anything',
    label: 'Anything else you want us to know?',
    type: 'text',
  },
]

function RatingInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, margin: '8px 0' }}>
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <button key={n} onClick={() => onChange(n)} style={{
          width: 36, height: 36, borderRadius: 8,
          border: value === n ? '2px solid var(--accent)' : '1px solid var(--border)',
          background: value === n ? 'var(--accent-dim)' : 'var(--surface)',
          color: value === n ? 'var(--accent)' : 'var(--text)',
          fontWeight: value === n ? 700 : 400,
          fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 120ms',
        }}>{n}</button>
      ))}
    </div>
  )
}

function MultiSelect({ options, value = [], onChange }) {
  const toggle = (opt) => {
    const next = value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]
    onChange(next)
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => toggle(opt)} style={{
          padding: '7px 14px', borderRadius: 99,
          border: value.includes(opt) ? '2px solid var(--accent)' : '1px solid var(--border)',
          background: value.includes(opt) ? 'var(--accent-dim)' : 'var(--surface)',
          color: value.includes(opt) ? 'var(--accent)' : 'var(--text)',
          fontWeight: value.includes(opt) ? 600 : 400,
          fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 120ms',
        }}>{opt}</button>
      ))}
    </div>
  )
}

function SingleSelect({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '8px 0' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: '10px 14px', borderRadius: 10, textAlign: 'left',
          border: value === opt ? '2px solid var(--accent)' : '1px solid var(--border)',
          background: value === opt ? 'var(--accent-dim)' : 'var(--surface)',
          color: value === opt ? 'var(--accent)' : 'var(--text)',
          fontWeight: value === opt ? 600 : 400,
          fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 120ms',
        }}>{opt}</button>
      ))}
    </div>
  )
}

export default function BetaQuestionnaire() {
  const { data } = useCtx()
  const toast = useToast()
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  const set = (id, val) => setAnswers(a => ({ ...a, [id]: val }))

  const submit = async () => {
    setSending(true)
    try {
      const payload = {
        type: 'beta_questionnaire',
        user: data?.session?.user?.email || 'anonymous',
        timestamp: new Date().toISOString(),
        projectCount: data?.projects?.length || 0,
        photoCount: data?.photos?.length || 0,
        ...answers,
        useful_features: (answers.useful_features || []).join(', '),
      }
      await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setSubmitted(true)
      toast('Thanks for your feedback!', 'success')
    } catch {
      toast('Failed to submit. Try again.', 'error')
    } finally {
      setSending(false)
    }
  }

  if (submitted) {
    return (
      <div className="scroll-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" />
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Thank you!</h2>
          <p style={{ color: 'var(--text-3)', fontSize: 15, maxWidth: 320, lineHeight: 1.6 }}>
            Your feedback directly shapes what we build next. We read every response.
          </p>
        </div>
      </div>
    )
  }

  const answered = Object.keys(answers).length
  const total = QUESTIONS.length
  const progress = Math.round((answered / total) * 100)

  return (
    <div className="scroll-page">
      <div className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">Beta Feedback</h1>
        </div>
        <p className="page-subtitle">Help shape the future of JDH Woodworks</p>
      </div>

      {/* Progress */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
          <span>{answered} of {total} answered</span>
          <span>{progress}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--fill)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${progress}%`, transition: 'width 300ms ease' }} />
        </div>
      </div>

      <div style={{ padding: '0 16px 100px' }}>
        {QUESTIONS.map((q, i) => (
          <div key={q.id} className="form-group" style={{ marginBottom: 20, padding: 16, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', minWidth: 20 }}>{i + 1}.</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{q.label}</span>
            </div>

            {q.type === 'rating' && (
              <div style={{ paddingLeft: 30 }}>
                <RatingInput value={answers[q.id]} onChange={v => set(q.id, v)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                  <span>Not great</span><span>Amazing</span>
                </div>
              </div>
            )}

            {q.type === 'multi' && (
              <div style={{ paddingLeft: 30 }}>
                <MultiSelect options={q.options} value={answers[q.id] || []} onChange={v => set(q.id, v)} />
              </div>
            )}

            {q.type === 'single' && (
              <div style={{ paddingLeft: 30 }}>
                <SingleSelect options={q.options} value={answers[q.id]} onChange={v => set(q.id, v)} />
              </div>
            )}

            {q.type === 'text' && (
              <div style={{ paddingLeft: 30, marginTop: 6 }}>
                <textarea
                  className="form-textarea"
                  style={{ width: '100%' }}
                  placeholder="Type your thoughts..."
                  value={answers[q.id] || ''}
                  onChange={e => set(q.id, e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
        ))}

        <button
          className="btn-primary"
          style={{ width: '100%', padding: 14, fontSize: 16 }}
          onClick={submit}
          disabled={sending || answered === 0}
        >
          {sending ? 'Submitting...' : 'Submit feedback'}
        </button>
      </div>
    </div>
  )
}
