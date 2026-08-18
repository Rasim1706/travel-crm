import { useState, useEffect } from 'react'
import { api } from '../api'

const CSYM = { USD: '$', EUR: '€', UZS: 'сум' }

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function DoplatForm({ session }) {
  const [sales,    setSales]    = useState([])
  const [payments, setPayments] = useState([])
  const [query,    setQuery]    = useState('')
  const [found,    setFound]    = useState(null)   // найденная заявка
  const [notFound, setNotFound] = useState(false)
  const [form,     setForm]     = useState({ date: today(), amount: '', currency: 'USD', note: '' })
  const [saving,   setSaving]   = useState(false)
  const [ok,       setOk]       = useState(false)
  const [err,      setErr]      = useState('')

  useEffect(() => {
    api.getSales().then(sr => { if (sr.sales) setSales(sr.sales) }).catch(() => {})
    api.getPayments().then(pr => { if (pr.payments) setPayments(pr.payments) }).catch(() => {})
  }, [])

  function search() {
    const q = query.trim()
    if (!q) return
    const sale = sales.find(s => String(s.contractNumber).trim() === q)
    if (sale) {
      setFound(sale)
      setNotFound(false)
      setForm(f => ({ ...f, currency: sale.currency || 'USD' }))
    } else {
      setFound(null)
      setNotFound(true)
    }
    setOk(false)
    setErr('')
  }

  function saleDoplats(sale) {
    return payments.filter(p => p.contractNumber === sale.contractNumber)
  }

  function dopTotal(sale) {
    return saleDoplats(sale).reduce((acc, p) => acc + (p.amount || 0), 0)
  }

  function remaining(sale) {
    const baseDebt = sale.debt !== null && sale.debt !== undefined ? sale.debt : 0
    return baseDebt - dopTotal(sale)
  }

  async function submit(e) {
    e.preventDefault()
    if (!found) return
    if (!form.amount || Number(form.amount) <= 0) { setErr('Введите сумму'); return }
    setSaving(true); setErr('')
    const res = await api.addPayment({
      date:           form.date,
      contractNumber: found.contractNumber,
      amount:         Number(form.amount),
      currency:       form.currency,
      note:           form.note,
    })
    setSaving(false)
    if (res.success) {
      const newP = { date: form.date, contractNumber: found.contractNumber, amount: Number(form.amount), currency: form.currency, note: form.note }
      setPayments(prev => [...prev, newP])
      setForm(f => ({ ...f, amount: '', note: '' }))
      setOk(true)
    } else {
      setErr(res.error || 'Ошибка')
    }
  }

  const INP = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--border)', background: 'var(--input-bg)',
    color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box',
  }
  const LBL = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }

  const doplats  = found ? saleDoplats(found) : []
  const dopSum   = found ? dopTotal(found) : 0
  const rem      = found ? remaining(found) : null
  const sym      = found ? (CSYM[found.currency] || found.currency) : ''
  const baseDebt = found ? (found.debt !== null && found.debt !== undefined ? found.debt : 0) : 0

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ background: 'var(--card)', borderRadius: 20, padding: '28px 32px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid var(--border)' }}>
        <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 800 }}>💳 Внести доплату</h2>

        {/* Поиск по номеру договора */}
        <div style={{ marginBottom: 20 }}>
          <label style={LBL}>Номер договора</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              style={{ ...INP, flex: 1 }}
              placeholder="Например: 2024-001"
              value={query}
              onChange={e => { setQuery(e.target.value); setFound(null); setNotFound(false); setOk(false) }}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
            <button
              type="button"
              onClick={search}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
            >
              Найти
            </button>
          </div>
          {notFound && <div style={{ marginTop: 8, color: '#ef4444', fontSize: 13 }}>Договор не найден</div>}
        </div>

        {/* Карточка найденной заявки */}
        {found && (
          <div style={{ background: 'var(--bg)', borderRadius: 14, padding: '16px 18px', marginBottom: 22, border: '1.5px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
              {found.clientName || '—'} · {found.direction || '—'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
              <Row label="Сумма тура"    value={found.amount ? `${found.amount.toLocaleString('ru-RU')} ${sym}` : '—'} />
              <Row label="Долг по договору" value={`${baseDebt.toLocaleString('ru-RU')} ${sym}`} />
              {doplats.map((p, i) => (
                <Row key={i} label={`Доплата ${i + 1} (${p.date})`} value={`${(p.amount || 0).toLocaleString('ru-RU')} ${CSYM[p.currency] || p.currency}`} />
              ))}
              {doplats.length > 0 && (
                <Row label="Внесено доплат" value={`${dopSum.toLocaleString('ru-RU')} ${sym}`} color="#16a34a" bold />
              )}
              <Row label="Остаток к оплате" value={`${rem.toLocaleString('ru-RU')} ${sym}`} color={rem > 0 ? '#ea580c' : '#16a34a'} bold />
            </div>
          </div>
        )}

        {/* Форма доплаты — только когда заявка найдена */}
        {found && (
          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={LBL}>Дата доплаты</label>
                <input type="date" style={INP} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label style={LBL}>Валюта</label>
                <select style={{ ...INP }} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                  <option value="UZS">сум UZS</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={LBL}>Сумма доплаты ({CSYM[form.currency] || form.currency})</label>
              <input
                type="number"
                style={INP}
                placeholder="0"
                min="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={LBL}>Примечание (необязательно)</label>
              <input
                style={INP}
                placeholder="Например: наличные, карта..."
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>

            {err && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{err}</div>}
            {ok  && <div style={{ color: '#16a34a', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>✓ Доплата сохранена</div>}

            <button
              type="submit"
              disabled={saving}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: saving ? '#94a3b8' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
                color: '#fff', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Сохранение…' : '💳 Сохранить доплату'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, color, bold }) {
  return (
    <>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: bold ? 700 : 500, color: color || 'var(--text)', fontSize: 13 }}>{value}</div>
    </>
  )
}
