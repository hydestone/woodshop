// ─── Shared utilities — status, dates, computed fields ──────────────────────
// ─── Status palettes ──────────────────────────────────────────────────────────
export const STATUS = {
  planning: { bg: '#F0EFFE', color: '#5B4EBE' },
  active:   { bg: '#ECFDF5', color: '#15803D' },
  paused:   { bg: '#FFFBEB', color: '#92400E' },
  complete: { bg: '#F0FDF4', color: '#166534' },
}

export const STOCK_STATUS = {
  'Freshly cut': { bg: '#ECFDF5', color: '#15803D' },
  'Drying':      { bg: '#FFFBEB', color: '#92400E' },
  'Ready to use':{ bg: '#EFF6FF', color: '#1D4ED8' },
  'Used up':     { bg: '#F9FAFB', color: '#6B7280' },
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
export const fmt = iso => iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—'

export const fmtShort = iso => iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  : '—'

export const localDt = () => {
  const off = new Date().getTimezoneOffset() * 60000
  return new Date(Date.now() - off).toISOString().slice(0, 16)
}

// ─── Status computers ─────────────────────────────────────────────────────────
export function coatStatus(coat) {
  if (!coat.applied_at) return { label: 'Not applied', color: 'var(--c-text-muted)', urgent: false }
  const ms = coat.interval_unit === 'hours'
    ? coat.interval_value * 3_600_000
    : coat.interval_value * 86_400_000
  const diff = new Date(coat.applied_at).getTime() + ms - Date.now()
  if (diff <= 0)           return { label: 'Ready now',                         color: 'var(--orange)', urgent: true  }
  if (diff < 3_600_000)   return { label: `${Math.ceil(diff / 60_000)}m`,       color: '#D97706',       urgent: false }
  if (diff < 86_400_000)  return { label: `In ${Math.ceil(diff / 3_600_000)}h`, color: 'var(--c-text-muted)', urgent: false }
  return                          { label: `In ${Math.ceil(diff / 86_400_000)}d`,color: 'var(--green)',  urgent: false }
}

export function maintStatus(m) {
  if (!m.last_done) return { label: 'Never done', color: 'var(--red)', urgent: true }
  const diff = new Date(m.last_done).getTime() + m.interval_days * 86_400_000 - Date.now()
  if (diff < 0)               return { label: `${Math.ceil(-diff / 86_400_000)}d overdue`, color: 'var(--red)',    urgent: true  }
  if (diff < 3 * 86_400_000) return { label: `Due in ${Math.ceil(diff / 86_400_000)}d`,   color: 'var(--orange)', urgent: true  }
  return                              { label: `Due in ${Math.ceil(diff / 86_400_000)}d`,   color: 'var(--green)',  urgent: false }
}
