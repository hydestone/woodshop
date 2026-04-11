import { useState, useMemo } from 'react'
import { useCtx } from '../App.jsx'
import * as db from '../db.js'
import { useToast } from '../components/Toast.jsx'

export default function Costs() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [tab, setTab] = useState('projects')

  // ── Project costs: sum shopping items tagged to each project ──────────────
  const projectCosts = useMemo(() => {
    return data.projects.map(p => {
      const items = data.shopping.filter(s => s.project_id === p.id && s.cost)
      const total = items.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0)
      return { ...p, total, itemCount: items.length, items }
    }).filter(p => p.total > 0 || p.itemCount > 0)
      .sort((a, b) => b.total - a.total)
  }, [data.projects, data.shopping])

  // ── General shop costs: shopping items with no project ────────────────────
  const shopItems = useMemo(() =>
    data.shopping.filter(s => !s.project_id && s.cost)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [data.shopping]
  )

  const totalProjectSpend = projectCosts.reduce((s, p) => s + p.total, 0)
  const totalShopSpend    = shopItems.reduce((s, i) => s + (parseFloat(i.cost) || 0), 0)
  const grandTotal        = totalProjectSpend + totalShopSpend

  const fmt = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">Costs</h1>
        </div>
        <p className="page-subtitle">Track spending by project and general shop expenses</p>
      </div>

      {/* Summary strip */}
      <div style={{ display:'flex', gap:12, padding:'0 16px 16px', flexWrap:'wrap' }}>
        {[
          { label: 'Project Spend', value: fmt(totalProjectSpend), color: 'var(--accent)' },
          { label: 'Shop Spend',    value: fmt(totalShopSpend),    color: 'var(--orange)' },
          { label: 'Total',         value: fmt(grandTotal),         color: 'var(--green)'  },
        ].map(s => (
          <div key={s.label} style={{ flex:1, minWidth:100, background:'var(--surface)', borderRadius:12, padding:'12px 16px', border:'1px solid var(--border-2)', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:11, color:'var(--text-4)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border-2)', padding:'0 16px', gap:0 }}>
        {[['projects','By Project'],['shop','General Shop']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding:'10px 16px', background:'none', border:'none', borderBottom: tab===id ? '2px solid var(--accent)' : '2px solid transparent', color: tab===id ? 'var(--accent)' : 'var(--text-3)', fontWeight: tab===id ? 700 : 400, fontSize:14, cursor:'pointer', fontFamily:'inherit', marginBottom:-1 }}>
            {label}
          </button>
        ))}
      </div>

      <div className="scroll-page">
        {tab === 'projects' && (
          projectCosts.length === 0 ? (
            <div className="empty" style={{ paddingTop:40 }}>
              <div className="empty-icon">💰</div>
              <div className="empty-title">No project costs yet</div>
              <p className="empty-sub">Add a cost field to shopping list items and tag them to a project</p>
            </div>
          ) : (
            <div className="group" style={{ marginTop:8 }}>
              {projectCosts.map((p, i) => (
                <div key={p.id} style={{ padding:'14px 16px', borderBottom: i < projectCosts.length-1 ? '1px solid var(--border-2)' : 'none' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:15 }}>{p.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-4)', marginTop:2 }}>{p.itemCount} item{p.itemCount!==1?'s':''} · {p.category || 'No category'} · {p.status}</div>
                    </div>
                    <div style={{ fontWeight:800, fontSize:16, color:'var(--accent)' }}>{fmt(p.total)}</div>
                  </div>
                  {p.items.length > 0 && (
                    <div style={{ marginTop:8, paddingLeft:8, borderLeft:'2px solid var(--border-2)' }}>
                      {p.items.map(item => (
                        <div key={item.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-3)', padding:'2px 0' }}>
                          <span>{item.name}</span>
                          <span>{fmt(parseFloat(item.cost)||0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'shop' && (
          shopItems.length === 0 ? (
            <div className="empty" style={{ paddingTop:40 }}>
              <div className="empty-icon">🛒</div>
              <div className="empty-title">No general shop costs yet</div>
              <p className="empty-sub">Add costs to shopping list items not tagged to a project</p>
            </div>
          ) : (
            <div className="group" style={{ marginTop:8 }}>
              {shopItems.map((item, i) => (
                <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderBottom: i < shopItems.length-1 ? '1px solid var(--border-2)' : 'none' }}>
                  <div>
                    <div style={{ fontWeight:500, fontSize:14 }}>{item.name}</div>
                    {item.store && <div style={{ fontSize:12, color:'var(--text-4)' }}>{item.store}</div>}
                  </div>
                  <div style={{ fontWeight:700, fontSize:15, color:'var(--orange)' }}>{fmt(parseFloat(item.cost)||0)}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
