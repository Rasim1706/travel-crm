import { useState, useEffect } from 'react'
import { api } from '../api'

const PIE_COLORS = ['#4f6ef7','#f97316','#22c55e','#a855f7','#ec4899','#14b8a6','#f59e0b','#ef4444']

const PAYMENT_LABELS = {
  cash_uzs:     '💵 Нал. сум',
  transfer_uzs: '📲 Перевод',
  qr_uzs:       '📱 QR-код',
  bank:         '🏦 Перечисл.',
  requisites:   '📋 Реквизиты',
  visa_usd:     '💳 Visa $',
  cash_usd:     '💵 Нал. $',
  mixed:        '🔀 Смешанная',
}

function formatPayment(method) {
  if (!method) return null
  if (method.startsWith('mixed:')) {
    const [, m1, m2] = method.split(':')
    const l1 = PAYMENT_LABELS[m1] || m1
    const l2 = PAYMENT_LABELS[m2] || m2
    return `🔀 ${l1} + ${l2}`
  }
  return PAYMENT_LABELS[method] || method
}

function DonutChart({ data }) {
  const [hovered, setHovered] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0 || data.length === 0) return null
  const R = 62, r = 38, cx = 80, cy = 80
  function arcPath(startPct, pct) {
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
  const isSingle = slices.length === 1
  function handleMouseMove(e, slice) {
    const rect = e.currentTarget.closest('svg').getBoundingClientRect()
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setHovered(slice)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={160} height={160} onMouseLeave={() => setHovered(null)}>
          {isSingle ? (
            <g style={{ cursor: 'pointer' }} onMouseMove={e => handleMouseMove(e, slices[0])}>
              <circle cx={cx} cy={cy} r={R} fill={slices[0].color} />
              <circle cx={cx} cy={cy} r={r} fill="#fff" />
            </g>
          ) : slices.map((s, i) => (
            <path key={i} d={arcPath(s.offset, s.pct)} fill={s.color}
              opacity={hovered && hovered.label !== s.label ? 0.55 : 1}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseMove={e => handleMouseMove(e, s)} />
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
            position: 'absolute', left: tooltipPos.x + 10, top: tooltipPos.y - 36,
            background: '#1e293b', color: '#fff', padding: '5px 10px', borderRadius: 7,
            fontSize: 12, fontWeight: 600, pointerEvents: 'none', whiteSpace: 'nowrap',
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

function TopList({ items, color }) {
  if (!items.length) return (
    <div className="empty"><div className="empty-icon">📭</div><p>Нет данных за выбранный период</p></div>
  )
  const max = items[0].count
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? color : 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? '#fff' : 'var(--muted)', flexShrink: 0 }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
            <div style={{ marginTop: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 999, height: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, background: color, width: `${Math.round(item.count / max * 100)}%`, transition: 'width .5s' }} />
            </div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color, flexShrink: 0 }}>{item.count}</span>
        </div>
      ))}
    </div>
  )
}

function getMonthBounds(year, month) {
  return { from: new Date(year, month, 1), to: new Date(year, month + 1, 0) }
}
function getWeekBounds() {
  const now = new Date(), dow = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { monday: mon, sunday: sun }
}
function toInputDate(d) { return d.toISOString().slice(0, 10) }
function formatDate(str) {
  if (!str) return '—'
  const d = new Date(str)
  return isNaN(d) ? '—' : d.toLocaleDateString('ru-RU')
}
function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? '—' : d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const LBL = { fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }
const INP = { marginBottom: 0 }

export default function Dashboard() {
  const { monday, sunday } = getWeekBounds()
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
  const in20days   = new Date(todayStart); in20days.setDate(todayStart.getDate() + 20)

  const [dateFrom,  setDateFrom]  = useState(toInputDate(monday))
  const [dateTo,    setDateTo]    = useState(toInputDate(sunday))
  const [pieYear,   setPieYear]   = useState(now.getFullYear())
  const [pieMonth,  setPieMonth]  = useState(now.getMonth())
  const [sales,     setSales]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  // Inline предоплата
  const [editPrepId,  setEditPrepId]  = useState(null)
  const [editPrepVal, setEditPrepVal] = useState('')
  const [savingPrep,  setSavingPrep]  = useState(false)

  // Inline долг
  const [editDebtId,  setEditDebtId]  = useState(null)
  const [editDebtVal, setEditDebtVal] = useState('')
  const [savingDebt,  setSavingDebt]  = useState(false)

  // Модальное редактирование заявки
  const [editModalSale,  setEditModalSale]  = useState(null)
  const [editModalData,  setEditModalData]  = useState({})
  const [savingModal,    setSavingModal]    = useState(false)
  const [modalError,     setModalError]     = useState('')

  const [deletingId,     setDeletingId]     = useState(null)
  const [callListOpen,   setCallListOpen]   = useState(true)
  const [paymentDueOpen, setPaymentDueOpen] = useState(true)

  useEffect(() => {
    api.getSales()
      .then(r => { if (r.success) setSales(r.sales); else setError(r.error) })
      .catch(() => setError('Ошибка соединения с сервером'))
      .finally(() => setLoading(false))
  }, [])

  const from = new Date(dateFrom + 'T00:00:00')
  const to   = new Date(dateTo   + 'T23:59:59')
  const filtered = sales.filter(s => {
    const d  = new Date(s.date)
    const bd = s.bookingDate ? new Date(s.bookingDate) : null
    return (!isNaN(d) && d >= from && d <= to) ||
           (bd && !isNaN(bd) && bd >= from && bd <= to)
  })

  let totalContracts = 0, totalSales = 0, totalPrepayment = 0, totalDebt = 0
  let hasPrepayment = false
  const commissionByCurrency = {}
  filtered.forEach(s => {
    totalContracts++
    totalSales += s.salesCount
    if (s.balance != null) {
      const cur = s.commissionCurrency || s.currency || 'USD'
      commissionByCurrency[cur] = (commissionByCurrency[cur] || 0) + s.balance
    }
    if (s.prepayment != null) { totalPrepayment += s.prepayment; hasPrepayment = true }
    if (s.debt       != null) totalDebt += s.debt
  })
  const CURR_SYM = { USD: '$', EUR: '€', UZS: 'сум' }
  const commissionEntries = Object.entries(commissionByCurrency).filter(([, v]) => v !== 0)

  // Напоминания: кому позвонить
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const clientLastSale = {}
  sales.forEach(s => {
    if (!s.clientName) return
    const d = s.bookingDate ? new Date(s.bookingDate) : new Date(s.date)
    if (isNaN(d)) return
    if (!clientLastSale[s.clientName] || d > clientLastSale[s.clientName].date)
      clientLastSale[s.clientName] = { date: d, direction: s.direction, manager: s.manager, phone: s.phone || '' }
  })
  const callReminders = Object.entries(clientLastSale)
    .filter(([, v]) => v.date < threeMonthsAgo)
    .sort((a, b) => a[1].date - b[1].date)
    .map(([name, v]) => ({ name, ...v }))

  // Напоминания: долги
  const overdueReminders = sales.filter(s => {
    if (!s.dueDate || !s.debt || s.debt <= 0) return false
    return new Date(s.dueDate) < todayStart
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  const paymentDueReminders = sales.filter(s => {
    if (!s.dueDate || !s.debt || s.debt <= 0) return false
    const due = new Date(s.dueDate)
    return !isNaN(due) && due >= todayStart && due <= in20days
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  const allDueReminders = [...overdueReminders, ...paymentDueReminders]

  // Топ направлений/отелей
  const dirMap = {}, hotelMap = {}
  filtered.forEach(s => {
    if (s.direction) dirMap[s.direction] = (dirMap[s.direction] || 0) + 1
    if (s.hotel)     hotelMap[s.hotel]   = (hotelMap[s.hotel]   || 0) + 1
  })
  const topDirections = Object.entries(dirMap).sort((a,b) => b[1]-a[1]).slice(0,8).map(([label,count]) => ({ label, count }))
  const topHotels     = Object.entries(hotelMap).sort((a,b) => b[1]-a[1]).slice(0,8).map(([label,count]) => ({ label, count }))

  // Круговой график
  const { from: monthFrom, to: monthTo } = getMonthBounds(pieYear, pieMonth)
  const monthSalesMap = {}
  sales.forEach(s => {
    const d = s.bookingDate ? new Date(s.bookingDate) : new Date(s.date)
    if (isNaN(d) || d < monthFrom || d > monthTo) return
    if (!monthSalesMap[s.manager]) monthSalesMap[s.manager] = 0
    monthSalesMap[s.manager] += s.salesCount
  })
  const pieData = Object.entries(monthSalesMap).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))

  function prevMonth() {
    if (pieMonth === 0) { setPieMonth(11); setPieYear(y => y - 1) }
    else setPieMonth(m => m - 1)
  }
  function nextMonth() {
    const isCurrent = pieYear === now.getFullYear() && pieMonth === now.getMonth()
    if (isCurrent) return
    if (pieMonth === 11) { setPieMonth(0); setPieYear(y => y + 1) }
    else setPieMonth(m => m + 1)
  }
  const isCurrentMonth = pieYear === now.getFullYear() && pieMonth === now.getMonth()

  async function confirmDelete(id) {
    const res = await api.deleteSale(id)
    if (res.success) setSales(prev => prev.filter(s => s.id !== id))
    setDeletingId(null)
  }

  // ── Inline предоплата ─────────────────────────────
  async function savePrepayment(id) {
    const val = Number(editPrepVal)
    if (isNaN(val) || val < 0) { setEditPrepId(null); return }
    setSavingPrep(true)
    try {
      const sale = sales.find(s => s.id === id)
      const newDebt = (sale?.amount != null) ? Math.round((sale.amount - val) * 100) / 100 : null
      const res = await api.updateSale(id, { prepayment: val, debt: newDebt !== null ? newDebt : '' })
      if (res.success)
        setSales(prev => prev.map(s => s.id === id ? { ...s, prepayment: val, debt: newDebt } : s))
    } finally { setSavingPrep(false); setEditPrepId(null) }
  }

  // ── Inline долг ───────────────────────────────────
  async function saveDebt(id) {
    const val = Number(editDebtVal)
    if (isNaN(val) || val < 0) { setEditDebtId(null); return }
    setSavingDebt(true)
    try {
      const res = await api.updateSale(id, { debt: val })
      if (res.success)
        setSales(prev => prev.map(s => s.id === id ? { ...s, debt: val } : s))
    } finally { setSavingDebt(false); setEditDebtId(null) }
  }

  // ── Модальное редактирование ──────────────────────
  function openEditModal(sale) {
    setEditModalSale(sale)
    setEditModalData({
      clientName:     sale.clientName     || '',
      phone:          sale.phone          || '',
      direction:      sale.direction      || '',
      hotel:          sale.hotel          || '',
      bookingDate:    sale.bookingDate    || '',
      departureDate:  sale.departureDate  || '',
      arrivalDate:    sale.arrivalDate    || '',
      contractNumber: sale.contractNumber || '',
      manager:        sale.manager        || '',
      salesCount:     sale.salesCount     || 1,
      amount:         sale.amount         ?? '',
      currency:       sale.currency       || 'USD',
      prepayment:     sale.prepayment     ?? '',
      debt:           sale.debt           ?? '',
      dueDate:        sale.dueDate        || '',
      paymentMethod:  sale.paymentMethod  || '',
      commission:         sale.commission         ?? '',
      commissionCurrency: sale.commissionCurrency || sale.currency || 'USD',
      discount:           sale.discount           ?? '',
    })
  }

  async function saveModal() {
    if (!editModalSale) return
    setSavingModal(true)
    setModalError('')
    try {
      const d = editModalData
      const payload = {
        clientName:     d.clientName,
        phone:          d.phone,
        direction:      d.direction,
        hotel:          d.hotel,
        bookingDate:    d.bookingDate,
        departureDate:  d.departureDate,
        arrivalDate:    d.arrivalDate,
        contractNumber: d.contractNumber,
        manager:        d.manager,
        salesCount:     Number(d.salesCount) || 1,
        amount:         d.amount     === '' ? '' : Number(d.amount),
        currency:       d.currency,
        prepayment:     d.prepayment === '' ? '' : Number(d.prepayment),
        debt:           d.debt       === '' ? '' : Number(d.debt),
        dueDate:        d.dueDate,
        paymentMethod:  d.paymentMethod,
        commission:         d.commission === '' ? '' : Number(d.commission),
        commissionCurrency: d.commissionCurrency || d.currency || 'USD',
        discount:           d.discount   === '' ? '' : Number(d.discount),
      }
      if (payload.commission !== '' && payload.discount !== '')
        payload.balance = Math.round((Number(payload.commission) - (Number(payload.discount) || 0)) * 100) / 100

      const res = await api.updateSale(editModalSale.id, payload)
      if (res.success) {
        setSales(prev => prev.map(s => s.id === editModalSale.id ? {
          ...s, ...payload,
          amount:     payload.amount     === '' ? null : Number(payload.amount),
          prepayment: payload.prepayment === '' ? null : Number(payload.prepayment),
          debt:       payload.debt       === '' ? null : Number(payload.debt),
          commission: payload.commission === '' ? null : Number(payload.commission),
          salesCount: Number(payload.salesCount),
        } : s))
        setEditModalSale(null)
        setModalError('')
      } else {
        setModalError(res.error || 'Ошибка сохранения')
      }
    } catch (e) {
      setModalError('Ошибка соединения с сервером')
    } finally { setSavingModal(false) }
  }

  if (loading) return <div className="loader">⏳ Загрузка данных...</div>
  if (error)   return <div className="loader">❌ {error}</div>

  const monthLabel = monthFrom.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <>
      {/* ── Кому позвонить ── */}
      {callReminders.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #fff7ed, #fff)', border: '1.5px solid #fed7aa', borderRadius: 20, marginBottom: 16, overflow: 'hidden' }}>
          <button onClick={() => setCallListOpen(o => !o)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit' }}>
            <span style={{ fontSize: 20 }}>📞</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#9a3412', flex: 1, textAlign: 'left' }}>Нужно позвонить</span>
            <span style={{ background: '#f97316', color: '#fff', borderRadius: 980, fontSize: 12, fontWeight: 700, padding: '2px 10px' }}>{callReminders.length}</span>
            <span style={{ color: '#f97316', fontSize: 18, marginLeft: 4 }}>{callListOpen ? '▲' : '▼'}</span>
          </button>
          {callListOpen && (
            <div style={{ padding: '0 20px 16px' }}>
              <p style={{ fontSize: 12, color: '#c2410c', marginBottom: 12 }}>Клиенты не покупавшие более 3 месяцев</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {callReminders.map((c, i) => {
                  const months = Math.floor((Date.now() - c.date) / (1000 * 60 * 60 * 24 * 30))
                  return (
                    <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #f97316, #ef4444)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: '#9a3412', marginTop: 2 }}>{c.direction && `✈️ ${c.direction} · `}менеджер: {c.manager}</div>
                        {c.phone && <a href={`tel:${c.phone}`} style={{ fontSize: 12, color: '#007aff', textDecoration: 'none' }}>📱 {c.phone}</a>}
                      </div>
                      <div style={{ background: '#ffedd5', color: '#c2410c', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '3px 8px' }}>{months} мес. назад</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Долги ── */}
      {allDueReminders.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #fef2f2, #fff)', border: '1.5px solid #fca5a5', borderRadius: 20, marginBottom: 16, overflow: 'hidden' }}>
          <button onClick={() => setPaymentDueOpen(o => !o)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit' }}>
            <span style={{ fontSize: 20 }}>🔴</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#991b1b', flex: 1, textAlign: 'left' }}>Долги по оплате</span>
            <span style={{ background: '#ef4444', color: '#fff', borderRadius: 980, fontSize: 12, fontWeight: 700, padding: '2px 10px' }}>{allDueReminders.length}</span>
            <span style={{ color: '#ef4444', fontSize: 18, marginLeft: 4 }}>{paymentDueOpen ? '▲' : '▼'}</span>
          </button>
          {paymentDueOpen && (
            <div style={{ padding: '0 20px 16px' }}>
              <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>Клиенты с непогашенным долгом (просроченные и в течение 20 дней)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allDueReminders.map((s, i) => {
                  const due = new Date(s.dueDate)
                  const daysLeft = Math.ceil((due - todayStart) / 86400000)
                  const isOverdue = daysLeft < 0
                  return (
                    <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: `1px solid ${isOverdue ? '#fca5a5' : '#fed7aa'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: isOverdue ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                        {isOverdue ? '⚠️' : '⏰'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.clientName || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>📄 {s.contractNumber} · {s.direction || ''} · {s.manager}</div>
                        {s.phone && <a href={`tel:${s.phone}`} style={{ fontSize: 12, color: '#007aff', textDecoration: 'none' }}>📱 {s.phone}</a>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: isOverdue ? '#dc2626' : '#ea580c' }}>{s.debt?.toLocaleString('ru-RU')} {s.currency || ''}</div>
                        <div style={{ background: isOverdue ? '#fef2f2' : '#fff7ed', color: isOverdue ? '#dc2626' : '#c2410c', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '3px 8px', marginTop: 4 }}>
                          {isOverdue ? `Просрочен ${Math.abs(daysLeft)} дн.` : `через ${daysLeft} дн.`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Период ── */}
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
          <button className="btn" style={{ width: 'auto', padding: '11px 16px', flexShrink: 0 }}
            onClick={() => { setDateFrom(toInputDate(monday)); setDateTo(toInputDate(sunday)) }}>
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
          <div className="stat-label">👥 Туристы</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1.5px solid #86efac' }}>
          {commissionEntries.length === 0 ? (
            <div className="stat-number" style={{ color: '#15803d', fontSize: 20 }}>0 $</div>
          ) : commissionEntries.map(([cur, val]) => (
            <div key={cur} className="stat-number" style={{ color: '#15803d', fontSize: commissionEntries.length > 1 ? 16 : 20 }}>
              {val.toLocaleString('ru-RU')} {CURR_SYM[cur] || cur}
            </div>
          ))}
          <div className="stat-label">💵 Комиссия</div>
        </div>
        {hasPrepayment && (
          <>
            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1.5px solid #93c5fd' }}>
              <div className="stat-number" style={{ color: '#1d4ed8', fontSize: 20 }}>{totalPrepayment.toLocaleString('ru-RU')}</div>
              <div className="stat-label">💳 Предоплата</div>
            </div>
            <div className="stat-card" style={{ background: totalDebt > 0 ? 'linear-gradient(135deg, #fff7ed, #fff)' : 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: `1.5px solid ${totalDebt > 0 ? '#fed7aa' : '#86efac'}` }}>
              <div className="stat-number" style={{ color: totalDebt > 0 ? '#ea580c' : '#15803d', fontSize: 20 }}>{totalDebt.toLocaleString('ru-RU')}</div>
              <div className="stat-label">⏳ Долг клиентов</div>
            </div>
          </>
        )}
      </div>

      {/* ── Топ направлений и отелей ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">🌍 Топ направлений</div>
          <TopList items={topDirections} color="#007aff" />
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">🏨 Топ отелей</div>
          <TopList items={topHotels} color="#5856d6" />
        </div>
      </div>

      {/* ── Круговой график ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>🥧 Продажи по менеджерам</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={prevMonth} style={{ background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 110, textAlign: 'center' }}>{monthLabel}</span>
            <button onClick={nextMonth} disabled={isCurrentMonth} style={{ background: isCurrentMonth ? '#f8fafc' : '#f1f5f9', border: '1px solid var(--border)', borderRadius: 6, width: 32, height: 32, cursor: isCurrentMonth ? 'default' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isCurrentMonth ? 0.4 : 1 }}>›</button>
          </div>
        </div>
        {pieData.length === 0
          ? <div className="empty"><div className="empty-icon">📭</div><p>Нет данных за {monthLabel}</p></div>
          : <DonutChart data={pieData} />}
      </div>

      {/* ── По менеджерам ── */}
      <div className="card">
        <div className="card-title">👥 По менеджерам</div>
        {filtered.length === 0
          ? <div className="empty"><div className="empty-icon">📭</div><p>Нет данных за выбранный период</p></div>
          : (() => {
            const mgrMap = {}
            filtered.forEach(s => {
              if (!s.manager) return
              if (!mgrMap[s.manager]) mgrMap[s.manager] = { contracts: 0, people: 0, balance: null, prepayment: null, debt: null }
              const m = mgrMap[s.manager]
              m.contracts++; m.people += s.salesCount || 0
              if (s.balance    != null) m.balance    = (m.balance    || 0) + s.balance
              if (s.prepayment != null) m.prepayment = (m.prepayment || 0) + s.prepayment
              if (s.debt       != null) m.debt       = (m.debt       || 0) + s.debt
            })
            const rows = Object.entries(mgrMap).sort((a, b) => b[1].contracts - a[1].contracts)
            const showFinance = rows.some(([, m]) => m.prepayment !== null)
            return (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Менеджер</th>
                      <th style={{ textAlign: 'center' }}>Заявок</th>
                      <th style={{ textAlign: 'center' }}>Туристов</th>
                      <th>Комиссия</th>
                      {showFinance && <th>Предоплата</th>}
                      {showFinance && <th>Долг</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([name, m], i) => (
                      <tr key={name}>
                        <td><strong>{i + 1}</strong></td>
                        <td style={{ fontWeight: 600 }}>{name}</td>
                        <td style={{ textAlign: 'center' }}><span className="badge">{m.contracts}</span></td>
                        <td style={{ textAlign: 'center' }}><span className="badge">{m.people}</span></td>
                        <td>{m.balance == null ? <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span> : <span style={{ fontWeight: 700, fontSize: 13, color: m.balance >= 0 ? '#16a34a' : '#dc2626' }}>{m.balance.toLocaleString('ru-RU')}</span>}</td>
                        {showFinance && <td style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>{m.prepayment != null ? m.prepayment.toLocaleString('ru-RU') : '—'}</td>}
                        {showFinance && <td style={{ fontSize: 13, fontWeight: 600, color: m.debt > 0 ? '#ea580c' : '#16a34a' }}>{m.debt != null ? m.debt.toLocaleString('ru-RU') : '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
      </div>

      {/* ── Записи за период ── */}
      <div className="card">
        <div className="card-title">📋 Записи за период ({filtered.length})</div>
        {filtered.length === 0
          ? <div className="empty"><div className="empty-icon">📭</div><p>Нет записей за выбранный период</p></div>
          : (
            <div className="table-wrap">
              <table style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 10 }}></th>
                    <th>Договор</th>
                    <th>Клиент</th>
                    <th>Направление</th>
                    <th>Вылет / Прилёт</th>
                    <th>Сумма</th>
                    <th>Предоплата</th>
                    <th>Долг</th>
                    <th>Срок оплаты</th>
                    <th>Оплата</th>
                    <th>Менеджер</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const dueD = s.dueDate ? new Date(s.dueDate) : null
                    const daysLeft  = dueD ? Math.ceil((dueD - todayStart) / 86400000) : null
                    const isOverdue = daysLeft !== null && daysLeft < 0 && s.debt > 0
                    const isDueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 20 && s.debt > 0
                    const statusColor = (!s.debt || s.debt <= 0) ? '#22c55e' : isOverdue ? '#ef4444' : isDueSoon ? '#f97316' : '#ef4444'

                    return (
                      <tr key={s.id}>
                        <td><div style={{ width: 9, height: 9, borderRadius: '50%', background: statusColor, margin: '0 auto' }} /></td>

                        <td>
                          <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{s.contractNumber}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDateTime(s.date)}</div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.clientName || '—'}</div>
                          {s.phone && <a href={`tel:${s.phone}`} style={{ fontSize: 11, color: '#007aff', textDecoration: 'none' }}>{s.phone}</a>}
                        </td>

                        <td>
                          {s.direction && <div style={{ whiteSpace: 'nowrap' }}>{s.direction}</div>}
                          {s.hotel && <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.hotel}</div>}
                          {!s.direction && !s.hotel && <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          {s.departureDate && <div style={{ fontSize: 12 }}>✈️ {formatDate(s.departureDate)}</div>}
                          {s.arrivalDate   && <div style={{ fontSize: 12, color: 'var(--muted)' }}>🛬 {formatDate(s.arrivalDate)}</div>}
                          {!s.departureDate && !s.arrivalDate && <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          {s.amount != null ? <span style={{ fontWeight: 700 }}>{s.amount.toLocaleString('ru-RU')} {s.currency}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                          {s.salesCount > 1 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.salesCount} чел.</div>}
                        </td>

                        {/* Предоплата inline */}
                        <td style={{ minWidth: 110 }}>
                          {editPrepId === s.id ? (
                            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                              <input type="number" min="0" value={editPrepVal}
                                onChange={e => setEditPrepVal(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') savePrepayment(s.id); if (e.key === 'Escape') setEditPrepId(null) }}
                                autoFocus
                                style={{ width: 80, padding: '3px 6px', fontSize: 13, border: '1.5px solid var(--primary)', borderRadius: 6, outline: 'none' }} />
                              <button onClick={() => savePrepayment(s.id)} disabled={savingPrep}
                                style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                                {savingPrep ? '…' : '✓'}
                              </button>
                              <button onClick={() => setEditPrepId(null)}
                                style={{ background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 5px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', width: 'fit-content' }}
                              onClick={() => { setEditPrepId(s.id); setEditPrepVal(String(s.prepayment ?? '')) }}
                              title="Нажмите чтобы изменить предоплату">
                              <span style={{ fontWeight: 600, color: '#1d4ed8' }}>{s.prepayment != null ? s.prepayment.toLocaleString('ru-RU') : '—'}</span>
                              <span style={{ fontSize: 11, opacity: 0.35 }}>✏️</span>
                            </div>
                          )}
                        </td>

                        {/* Долг inline */}
                        <td style={{ minWidth: 110 }}>
                          {editDebtId === s.id ? (
                            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                              <input type="number" min="0" value={editDebtVal}
                                onChange={e => setEditDebtVal(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveDebt(s.id); if (e.key === 'Escape') setEditDebtId(null) }}
                                autoFocus
                                style={{ width: 80, padding: '3px 6px', fontSize: 13, border: '1.5px solid #f97316', borderRadius: 6, outline: 'none' }} />
                              <button onClick={() => saveDebt(s.id)} disabled={savingDebt}
                                style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                                {savingDebt ? '…' : '✓'}
                              </button>
                              <button onClick={() => setEditDebtId(null)}
                                style={{ background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 5px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', width: 'fit-content' }}
                              onClick={() => { setEditDebtId(s.id); setEditDebtVal(String(s.debt ?? '')) }}
                              title="Нажмите чтобы изменить долг">
                              <span style={{ fontWeight: 700, color: s.debt > 0 ? '#ea580c' : s.debt === 0 ? '#16a34a' : 'var(--muted)' }}>
                                {s.debt != null ? s.debt.toLocaleString('ru-RU') : '—'}
                              </span>
                              <span style={{ fontSize: 11, opacity: 0.35 }}>✏️</span>
                            </div>
                          )}
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          {s.dueDate ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 12, color: isOverdue ? '#dc2626' : isDueSoon ? '#f97316' : 'var(--text)' }}>{formatDate(s.dueDate)}</div>
                              {isOverdue && <div style={{ fontSize: 10, color: '#dc2626' }}>просрочен {Math.abs(daysLeft)} дн.</div>}
                              {isDueSoon && <div style={{ fontSize: 10, color: '#f97316' }}>через {daysLeft} дн.</div>}
                            </div>
                          ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>

                        <td>
                          {formatPayment(s.paymentMethod)
                            ? <span style={{ fontSize: 11, background: '#f0f4ff', borderRadius: 6, padding: '2px 7px', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatPayment(s.paymentMethod)}</span>
                            : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>

                        <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12 }}>{s.manager || '—'}</td>

                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => openEditModal(s)}
                              style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#4338ca', whiteSpace: 'nowrap' }}>
                              ✏️ Изменить
                            </button>
                            <button onClick={() => setDeletingId(s.id)}
                              style={{ background: 'none', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* ── Диалог удаления ── */}
      {deletingId && (() => {
        const s = sales.find(x => x.id === deletingId)
        return (
          <div className="overlay" onClick={() => setDeletingId(null)}>
            <div className="dialog" onClick={e => e.stopPropagation()}>
              <h3>Удалить запись?</h3>
              <p>Договор <strong>{s?.contractNumber}</strong> ({s?.manager}) будет удалён из Google Sheets.</p>
              <div className="dialog-btns">
                <button className="btn-cancel" onClick={() => setDeletingId(null)}>Отмена</button>
                <button className="btn-confirm" onClick={() => confirmDelete(deletingId)}>Удалить</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Модальное окно редактирования заявки ── */}
      {editModalSale && (
        <div className="overlay" onClick={() => !savingModal && setEditModalSale(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 24, padding: '28px 28px 24px',
            maxWidth: 640, width: '95%', maxHeight: '92vh', overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
            animation: 'slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {/* Заголовок */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>✏️ Редактировать заявку</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
                {editModalSale.contractNumber} · {editModalSale.clientName || '—'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              <div><label style={LBL}>Клиент</label>
                <input className="input" style={INP} value={editModalData.clientName}
                  onChange={e => setEditModalData(d => ({ ...d, clientName: e.target.value }))} /></div>

              <div><label style={LBL}>Телефон</label>
                <input className="input" style={INP} value={editModalData.phone}
                  onChange={e => setEditModalData(d => ({ ...d, phone: e.target.value }))} /></div>

              <div><label style={LBL}>✈️ Направление</label>
                <input className="input" style={INP} value={editModalData.direction}
                  onChange={e => setEditModalData(d => ({ ...d, direction: e.target.value }))} /></div>

              <div><label style={LBL}>🏨 Отель</label>
                <input className="input" style={INP} value={editModalData.hotel}
                  onChange={e => setEditModalData(d => ({ ...d, hotel: e.target.value }))} /></div>

              <div><label style={LBL}>📄 Номер договора</label>
                <input className="input" style={INP} value={editModalData.contractNumber}
                  onChange={e => setEditModalData(d => ({ ...d, contractNumber: e.target.value }))} /></div>

              <div><label style={LBL}>👤 Менеджер</label>
                <input className="input" style={INP} value={editModalData.manager}
                  onChange={e => setEditModalData(d => ({ ...d, manager: e.target.value }))} /></div>

              <div><label style={LBL}>📅 Дата брони</label>
                <input className="input" type="date" style={INP} value={editModalData.bookingDate}
                  onChange={e => setEditModalData(d => ({ ...d, bookingDate: e.target.value }))} /></div>

              <div><label style={LBL}>👥 Туристов</label>
                <input className="input" type="number" min="1" style={INP} value={editModalData.salesCount}
                  onChange={e => setEditModalData(d => ({ ...d, salesCount: e.target.value }))} /></div>

              <div><label style={LBL}>✈️ Дата вылета</label>
                <input className="input" type="date" style={INP} value={editModalData.departureDate}
                  onChange={e => setEditModalData(d => ({ ...d, departureDate: e.target.value }))} /></div>

              <div><label style={LBL}>🛬 Дата прилёта</label>
                <input className="input" type="date" style={INP} value={editModalData.arrivalDate}
                  onChange={e => setEditModalData(d => ({ ...d, arrivalDate: e.target.value }))} /></div>

              <div>
                <label style={LBL}>💰 Сумма</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" type="number" min="0" style={{ ...INP, flex: 1 }} value={editModalData.amount}
                    onChange={e => setEditModalData(d => ({ ...d, amount: e.target.value }))} />
                  <select className="select" style={{ ...INP, width: 84 }} value={editModalData.currency}
                    onChange={e => setEditModalData(d => ({ ...d, currency: e.target.value }))}>
                    {['USD','EUR','UZS'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div><label style={LBL}>💳 Предоплата</label>
                <input className="input" type="number" min="0" style={INP} value={editModalData.prepayment}
                  onChange={e => setEditModalData(d => ({ ...d, prepayment: e.target.value }))} /></div>

              <div><label style={LBL}>🔴 Долг</label>
                <input className="input" type="number" min="0" style={INP} value={editModalData.debt}
                  onChange={e => setEditModalData(d => ({ ...d, debt: e.target.value }))} /></div>

              <div><label style={LBL}>📅 Срок оплаты остатка</label>
                <input className="input" type="date" style={INP} value={editModalData.dueDate}
                  onChange={e => setEditModalData(d => ({ ...d, dueDate: e.target.value }))} /></div>

              <div>
                <label style={LBL}>💵 Комиссия ({['USD','EUR','UZS'].includes(editModalData.commissionCurrency) ? { USD: '$', EUR: '€', UZS: 'сум' }[editModalData.commissionCurrency] : '$'})</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" type="number" min="0" style={{ ...INP, flex: 1 }} value={editModalData.commission}
                    onChange={e => setEditModalData(d => ({ ...d, commission: e.target.value }))} />
                  <select className="select" style={{ ...INP, width: 84 }} value={editModalData.commissionCurrency}
                    onChange={e => setEditModalData(d => ({ ...d, commissionCurrency: e.target.value }))}>
                    {['USD','EUR','UZS'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={LBL}>🏷 Скидка ({['USD','EUR','UZS'].includes(editModalData.commissionCurrency) ? { USD: '$', EUR: '€', UZS: 'сум' }[editModalData.commissionCurrency] : '$'})</label>
                <input className="input" type="number" min="0" style={INP} value={editModalData.discount}
                  onChange={e => setEditModalData(d => ({ ...d, discount: e.target.value }))} />
              </div>
            </div>

            {/* Способ оплаты */}
            <div style={{ marginTop: 14 }}>
              <label style={LBL}>💳 Способ оплаты</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
                {Object.entries(PAYMENT_LABELS).map(([id, label]) => {
                  const curBase = (editModalData.paymentMethod || '').split(':')[0]
                  const isActive = curBase === id
                  return (
                    <button key={id} type="button"
                      onClick={() => setEditModalData(d => ({ ...d, paymentMethod: isActive ? '' : id }))}
                      style={{
                        padding: '8px 4px', borderRadius: 10, border: '1.5px solid',
                        borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                        background: isActive ? 'var(--primary)' : '#f8fafc',
                        color: isActive ? '#fff' : 'var(--text)',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                        transition: 'all .15s',
                      }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Ошибка сохранения */}
            {modalError && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
                ❌ {modalError}
              </div>
            )}

            {/* Кнопки */}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={() => { setEditModalSale(null); setModalError('') }}
                style={{ flex: 1, padding: '13px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 980, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Отмена
              </button>
              <button onClick={saveModal} disabled={savingModal} className="btn" style={{ flex: 2 }}>
                {savingModal ? '⏳ Сохранение...' : '💾 Сохранить изменения'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
