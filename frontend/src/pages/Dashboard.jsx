import { useState, useEffect } from 'react'
import { api } from '../api'

const PIE_COLORS = ['#4f6ef7','#f97316','#22c55e','#a855f7','#ec4899','#14b8a6','#f59e0b','#ef4444']

function DonutChart({ data }) {
  const [hovered, setHovered] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0 || data.length === 0) return null

  const R = 62, r = 38, cx = 80, cy = 80

  function arcPath(startPct, pct) {
    if (pct >= 0.9999) {
      return [
        `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.001} ${cy - R} Z`,
        `M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx - 0.001} ${cy - r} Z`,
      ].join(' ')
    }
    const a1 = startPct * 2 * Math.PI - Math.PI / 2
    const a2 = (startPct + pct) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1)
    const x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2)
    const ix1 = cx + r * Math.cos(a2), iy1 = cy + r * Math.sin(a2)
    const ix2 = cx + r * Math.cos(a1), iy2 = cy + r * Math.sin(a1)
    const large = pct > 0.5 ? 1 : 0
    return `M${x1},${y1} A${R},${R},0,${large},1,${x2},${y2} L${ix1},${iy1} A${r},${r},0,${large},0,${ix2},${iy2} Z`
  }

  let offset = 0
  const slices = data.map((d, i) => {
    const pct = d.value / total
    const s = { ...d, pct, offset, color: PIE_COLORS[i % PIE_COLORS.length] }
    offset += pct
    return s
  })

  function handleMouseMove(e, slice) {
    const rect = e.currentTarget.closest('svg').getBoundingClientRect()
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setHovered(slice)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={160} height={160}
          onMouseLeave={() => setHovered(null)}>
          {slices.map((s, i) => (
            <path
              key={i}
              d={arcPath(s.offset, s.pct)}
              fill={s.color}
              opacity={hovered && hovered.label !== s.label ? 0.55 : 1}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseMove={e => handleMouseMove(e, s)}
            />
          ))}
          <text x={cx} y={cy - 7} textAnchor="middle" fontSize={11} fill="#94a3b8">
            {hovered ? hovered.label : 'Продаж'}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={20} fontWeight="700" fill="#1e293b">
            {hovered ? hovered.value : total}
          </text>
        </svg>
        {hovered && (
          <div style={{
            position: 'absolute',
            left: tooltipPos.x + 10,
            top: tooltipPos.y - 36,
            background: '#1e293b',
            color: '#fff',
            padding: '5px 10px',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}>
            {hovered.label}: {hovered.value} прод. · {Math.round(hovered.pct * 100)}%
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{s.value}</span>
            <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 32, textAlign: 'right' }}>{Math.round(s.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function getMonthBounds(year, month) {
  const from = new Date(year, month, 1)
  const to   = new Date(year, month + 1, 0)
  return { from, to }
}

function getWeekBounds() {
  const now = new Date()
  const dow = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { monday: mon, sunday: sun }
}

function toInputDate(d) {
  return d.toISOString().slice(0, 10)
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('ru-RU') + ' ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard() {
  const { monday, sunday } = getWeekBounds()
  const now = new Date()

  const [dateFrom,   setDateFrom]  = useState(toInputDate(monday))
  const [dateTo,     setDateTo]    = useState(toInputDate(sunday))
  const [pieYear,    setPieYear]   = useState(now.getFullYear())
  const [pieMonth,   setPieMonth]  = useState(now.getMonth())
  const [sales,     setSales]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [editingId,  setEditingId]  = useState(null)
  const [editVal,    setEditVal]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    api.getSales()
      .then(r => { if (r.success) setSales(r.sales); else setError(r.error) })
      .catch(() => setError('Ошибка соединения с сервером'))
      .finally(() => setLoading(false))
  }, [])

  // ── Фильтрация по диапазону ───────────────────────
  const from = new Date(dateFrom + 'T00:00:00')
  const to   = new Date(dateTo   + 'T23:59:59')

  const filtered = sales.filter(s => {
    const d = new Date(s.date)
    return !isNaN(d) && d >= from && d <= to
  })

  // ── Статистика по выбранному периоду ─────────────
  let totalContracts = 0, totalSales = 0
  filtered.forEach(s => {
    totalContracts++
    totalSales += s.salesCount
  })

  // ── Данные для кругового графика (выбранный месяц) ──
  const { from: monthFrom, to: monthTo } = getMonthBounds(pieYear, pieMonth)
  const monthSalesMap = {}
  sales.forEach(s => {
    const d = new Date(s.date)
    if (isNaN(d) || d < monthFrom || d > monthTo) return
    if (!monthSalesMap[s.manager]) monthSalesMap[s.manager] = 0
    monthSalesMap[s.manager] += s.salesCount
  })
  const pieData = Object.entries(monthSalesMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }))

  function prevMonth() {
    if (pieMonth === 0) { setPieMonth(11); setPieYear(y => y - 1) }
    else setPieMonth(m => m - 1)
  }
  function nextMonth() {
    const isCurrentMonth = pieYear === now.getFullYear() && pieMonth === now.getMonth()
    if (isCurrentMonth) return
    if (pieMonth === 11) { setPieMonth(0); setPieYear(y => y + 1) }
    else setPieMonth(m => m + 1)
  }
  const isCurrentMonth = pieYear === now.getFullYear() && pieMonth === now.getMonth()

  // ── Удаление ──────────────────────────────────────
  async function confirmDelete(id) {
    const res = await api.deleteSale(id)
    if (res.success) setSales(prev => prev.filter(s => s.id !== id))
    setDeletingId(null)
  }

  // ── Редактирование ────────────────────────────────
  async function saveEdit(id) {
    const val = parseInt(editVal)
    if (isNaN(val) || val < 1) { setEditingId(null); return }
    setSaving(true)
    try {
      const res = await api.updateSale(id, val)
      if (res.success)
        setSales(prev => prev.map(s => s.id === id ? { ...s, salesCount: val } : s))
    } finally {
      setSaving(false)
      setEditingId(null)
    }
  }

  if (loading) return <div className="loader">⏳ Загрузка данных...</div>
  if (error)   return <div className="loader">❌ {error}</div>

  const monthLabel = monthFrom.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <>
      {/* ── Диапазон дат ── */}
      <div className="card">
        <div className="card-title">📅 Период</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label className="label">С</label>
            <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label className="label">По</label>
            <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button
            className="btn"
            style={{ width: 'auto', padding: '11px 16px', flexShrink: 0 }}
            onClick={() => { setDateFrom(toInputDate(monday)); setDateTo(toInputDate(sunday)) }}
          >
            Эта неделя
          </button>
        </div>
      </div>

      {/* ── Итого ── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-number">{totalContracts}</div>
          <div className="stat-label">📄 Договоров</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{totalSales}</div>
          <div className="stat-label">🛒 Продаж</div>
        </div>
      </div>

      {/* ── Круговой график по месяцам ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>🥧 Продажи по менеджерам</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={prevMonth}
              style={{ background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ‹
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 110, textAlign: 'center' }}>{monthLabel}</span>
            <button onClick={nextMonth} disabled={isCurrentMonth}
              style={{ background: isCurrentMonth ? '#f8fafc' : '#f1f5f9', border: '1px solid var(--border)', borderRadius: 6, width: 32, height: 32, cursor: isCurrentMonth ? 'default' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isCurrentMonth ? 0.4 : 1 }}>
              ›
            </button>
          </div>
        </div>
        {pieData.length === 0 ? (
          <div className="empty"><div className="empty-icon">📭</div><p>Нет данных за {monthLabel}</p></div>
        ) : (
          <DonutChart data={pieData} />
        )}
      </div>

      {/* ── По менеджерам ── */}
      <div className="card">
        <div className="card-title">👥 По менеджерам</div>
        {filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">📭</div><p>Нет данных за выбранный период</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Менеджер</th><th>Номер договора</th><th>Продаж</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id}>
                    <td><strong>{i + 1}</strong></td>
                    <td>{s.manager}</td>
                    <td>{s.contractNumber}</td>
                    <td><span className="badge">{s.salesCount}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Записи за период ── */}
      <div className="card">
        <div className="card-title">📋 Записи за период</div>
        {filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">📭</div><p>Нет записей за выбранный период</p></div>
        ) : (
          <div>
            {filtered.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: '1px solid var(--border)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.contractNumber}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{s.manager}</div>
                  {s.bookingDate && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>📅 Бронь: {new Date(s.bookingDate).toLocaleDateString('ru-RU')}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>🕐 {formatDateTime(s.date)}</div>
                </div>

                {editingId === s.id ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="number" min="1" value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditingId(null) }}
                      autoFocus
                      style={{ width: 56, padding: '4px 8px', fontSize: 14, border: '1.5px solid var(--primary)', borderRadius: 6, outline: 'none' }}
                    />
                    <button onClick={() => saveEdit(s.id)} disabled={saving}
                      style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                      {saving ? '…' : '✓'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      style={{ background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 13 }}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span className="badge" style={{ fontSize: 14 }}>{s.salesCount}</span>
                    <button onClick={() => { setEditingId(s.id); setEditVal(String(s.salesCount)) }}
                      style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 14 }}
                      title="Изменить">
                      ✏️
                    </button>
                    <button onClick={() => setDeletingId(s.id)}
                      style={{ background: 'none', border: '1.5px solid rgba(255,59,48,0.3)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 14, color: 'var(--danger)' }}
                      title="Удалить">
                      🗑
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* ── Диалог удаления записи ── */}
      {deletingId && (() => {
        const s = sales.find(x => x.id === deletingId)
        return (
          <div className="overlay" onClick={() => setDeletingId(null)}>
            <div className="dialog" onClick={e => e.stopPropagation()}>
              <h3>Удалить запись?</h3>
              <p>Договор <strong>{s?.contractNumber}</strong> ({s?.manager}) будет удалён из Google Sheets. Это действие нельзя отменить.</p>
              <div className="dialog-btns">
                <button className="btn-cancel" onClick={() => setDeletingId(null)}>Отмена</button>
                <button className="btn-confirm" onClick={() => confirmDelete(deletingId)}>Удалить</button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
