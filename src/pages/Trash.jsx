import { useState } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import { ConfirmSheet } from '../components/Shared.jsx'
import * as db from '../db.js'
import { photoUrl } from '../supabase.js'

const TYPE_LABELS = {
  project: 'Project', photo: 'Photo', shopping: 'Shopping', brainstorm: 'Brainstorm',
  maintenance: 'Maintenance', finish: 'Finish', resource: 'Resource',
  shop_improvement: 'Shop Improvement', wood_stock: 'Wood Stock',
}

const TYPE_ICONS = {
  project: '📁', photo: '📷', shopping: '🛒', brainstorm: '💡',
  maintenance: '🔧', finish: '🎨', resource: '📚',
  shop_improvement: '🏠', wood_stock: '🪵',
}

function itemName(t) {
  const d = t.item_data
  if (t.item_type === 'project') return d.name
  if (t.item_type === 'photo') return d.caption || 'Photo'
  if (t.item_type === 'shopping') return d.name
  if (t.item_type === 'brainstorm') return (d.content || '').slice(0, 60) + (d.content?.length > 60 ? '…' : '')
  if (t.item_type === 'maintenance') return d.name
  if (t.item_type === 'finish') return d.name
  if (t.item_type === 'resource') return d.title
  if (t.item_type === 'shop_improvement') return d.title
  if (t.item_type === 'wood_stock') return d.species
  return 'Item'
}

function daysAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d} days ago`
}

function daysLeft(iso) {
  const d = 30 - Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d <= 0) return 'Expiring soon'
  if (d === 1) return '1 day left'
  return `${d} days left`
}

export default function Trash() {
  const { data, mutate, reload } = useCtx()
  const toast = useToast()
  const [filter, setFilter] = useState('all')
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  const trash = data.trash || []
  const types = [...new Set(trash.map(t => t.item_type))]

  const filtered = filter === 'all' ? trash : trash.filter(t => t.item_type === filter)

  const restore = async (t) => {
    try {
      await db.restoreFromTrash(t.id, t)
      mutate(d => ({ ...d, trash: d.trash.filter(x => x.id !== t.id) }))
      await reload()
      toast(`${itemName(t)} restored`, 'success')
    } catch (e) { toast('Restore failed: ' + e.message, 'error') }
  }

  const permDelete = async (t) => {
    try {
      await db.permanentDeleteTrash(t.id, t)
      mutate(d => ({ ...d, trash: d.trash.filter(x => x.id !== t.id) }))
      toast('Permanently deleted', 'success')
    } catch (e) { toast(e.message, 'error') }
  }

  const emptyAll = async () => {
    try {
      await db.emptyTrash()
      mutate(d => ({ ...d, trash: [] }))
      toast('Recycling bin emptied', 'success')
      setConfirmEmpty(false)
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">Recycling Bin</h1>
          {trash.length > 0 && (
            <button className="btn-text" style={{ color: 'var(--red)' }} onClick={() => setConfirmEmpty(true)}>
              Empty Recycling Bin
            </button>
          )}
        </div>
        <p className="page-subtitle">
          {trash.length} item{trash.length !== 1 ? 's' : ''} · items auto-delete after 30 days
        </p>
      </div>

      {types.length > 1 && (
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              background: filter === 'all' ? 'var(--accent)' : 'var(--fill)',
              color: filter === 'all' ? '#fff' : 'var(--text-3)',
            }}>All ({trash.length})</button>
          {types.map(type => {
            const count = trash.filter(t => t.item_type === type).length
            return (
              <button key={type} onClick={() => setFilter(type)}
                style={{
                  padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  background: filter === type ? 'var(--accent)' : 'var(--fill)',
                  color: filter === type ? '#fff' : 'var(--text-3)',
                }}>{TYPE_ICONS[type]} {TYPE_LABELS[type]} ({count})</button>
            )
          })}
        </div>
      )}

      <div className="scroll-page" style={{ paddingBottom: 40 }}>
        {filtered.length === 0 ? (
          <div className="empty" style={{ paddingTop: 60 }}>
            <div className="empty-icon">🗑️</div>
            <div className="empty-title">{trash.length === 0 ? 'Recycling bin is empty' : 'No items in this filter'}</div>
            <p className="empty-sub">{trash.length === 0 ? 'Deleted items appear here for 30 days before being permanently removed' : 'Try a different filter'}</p>
          </div>
        ) : (
          <div className="group">
            {filtered.map((t, i) => {
              const isPhoto = t.item_type === 'photo'
              const thumbUrl = isPhoto && t.item_data?.storage_path ? photoUrl(t.item_data.storage_path) : null
              return (
                <div key={t.id} style={{
                  padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border-2)' : 'none',
                }}>
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  ) : (
                    <span style={{ fontSize: 24, flexShrink: 0, width: 44, textAlign: 'center' }}>{TYPE_ICONS[t.item_type] || '📄'}</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {itemName(t)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      {TYPE_LABELS[t.item_type]} · deleted {daysAgo(t.deleted_at)} · {daysLeft(t.deleted_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => restore(t)}>
                      Restore
                    </button>
                    <button className="btn-text" style={{ color: 'var(--red)', fontSize: 13 }} onClick={() => permDelete(t)}>
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirmEmpty && (
        <ConfirmSheet
          message={`Permanently delete all ${trash.length} item${trash.length !== 1 ? 's' : ''} in the recycling bin? This cannot be undone.`}
          confirmLabel="Empty Recycling Bin"
          onConfirm={emptyAll}
          onClose={() => setConfirmEmpty(false)}
        />
      )}
    </div>
  )
}
