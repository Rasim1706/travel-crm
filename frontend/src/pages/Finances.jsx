import { useState, useEffect, useMemo } from 'react'
import { api } from '../api'

const MONTH_NAMES_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
]

const CUR_SYMBOL = { USD: '$', EUR: '€', UZS: 'сум' }

function fmtUSD(n) {
  return Number(n || 0).toLocaleString('ru-RU') + ' $'
}
function fmtAmt(n, cur) {
  return Number(n || 0).toLocaleString('ru-RU') + ' ' + (CUR_SYMBOL[cur] || cur)
}

export default function Finances() {
  const [sales,    setSales]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [openMonth, setOpenMonth] = useState(null)

  useEffect(() => {
    api.getSales()
      .then(r => { if (r.success) setSales(r.sales); else setError(r.error) })
      .catch(() => setError('Ошибка соединения с сервером'))
      .finally(() => setLoading(false))
  }, [])

  // Записи с финансами
  const withFinance = useMemo(() =>
    sales.filter(s => s.commission != null || s.amount != null),
  [sales])

  // Общие итоги (комиссия всегда $)
  const totals = useMemo(() => {
    const t = { commission: 0, discount: 0, balance: 0, contracts: 0, amountByCur: {} }
    withFinance.forEach(s => {
      t.contracts++
      t.commission += s.commission || 0
      t.discount   += s.discount   || 0
      t.balance    += s.balance    || 0
      if (s.amount != null && s.currency) {
        t.amountByCur[s.currency] = (t.amountByCur[s.currency] || 0) + s.amount
      }
    })
    return t
  }, [withFinance])

  // По месяцам
  const monthly = useMemo(() => {
    const map = {}
    withFinance.forEach(s => {
      const d = s.bookingDate ? new Date(s.bookingDate) : new Date(s.date)
      if (isNaN(d)) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map[key]) {
        map[key] = {
          key, year: d.getFullYear(), month: d.getMonth(),
          contracts: 0, people: 0,
          commission: 0, discount: 0, balance: 0,
          amountByCur: {},
        }
      }
      const m = map[key]
      m.contracts++
      m.people     += s.salesCount || 0
      m.commission += s.commission || 0
      m.discount   += s.discount   || 0
      m.balance    += s.balance    || 0
      if (s.amount != null && s.currency) {
        m.amountByCur[s.currency] = (m.amountByCur[s.currency] || 0) + s.amount
      }
    })
    return Object.values(map).sort((a, b) => (b.year - a.year) || (b.month - a.month))
  }, [withFinance])

  if (loading) return <div className="loader">⏳ Загрузка данных...</div>
  if (error)   return <div className="loader">❌ {error}</div>

  return (
    <>
      {/* ── Общие итоги ── */}
      <div className="card">
        <div className="card-title">📊 Итого за всё время</div>
        {withFinance.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">💰</div>
            <p>Нет финансовых данных. Заполните сумму и комиссию в форме продажи.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {/* Суммы туров по валютам */}
            {Object.keys(totals.amountByCur).length > 0 && (
              <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 16px', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--muted)' }}>💳 Суммы туров</div>
                {Object.entries(totals.amountByCur).map(([cur, amt]) => (
                  <div key={cur} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>{cur}</span>
                    <span style={{ fontWeight: 700 }}>{fmtAmt(amt, cur)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Комиссия (всегда $) */}
            <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 16px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--muted)' }}>
                💰 Комиссия · {totals.contracts} заявок
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Комиссия</span>
                  <span style={{ fontWeight: 600 }}>{fmtUSD(totals.commission)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Скидки</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>− {fmtUSD(totals.discount)}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700 }}>Чистая комиссия</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: totals.balance >= 0 ? '#16a34a' : '#dc2626' }}>
                    {fmtUSD(totals.balance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── По месяцам ── */}
      <div className="card">
        <div className="card-title">📅 По месяцам</div>
        {monthly.length === 0 ? (
          <div className="empty"><div className="empty-icon">📭</div><p>Нет данных</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {monthly.map((m, idx) => {
              const isOpen = openMonth === m.key
              const label  = `${MONTH_NAMES_RU[m.month]} ${m.year}`
              return (
                <div key={m.key} style={{ borderBottom: idx < monthly.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div
                    onClick={() => setOpenMonth(isOpen ? null : m.key)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 0', cursor: 'pointer', gap: 12, flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, background: '#f0f7ff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, flexShrink: 0,
                      }}>📅</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {m.contracts} заявок · {m.people} людей
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontWeight: 800, fontSize: 15,
                          color: m.balance >= 0 ? '#16a34a' : '#dc2626',
                        }}>
                          {fmtUSD(m.balance)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>чистая комиссия</div>
                      </div>
                      <span style={{ color: 'var(--muted)', fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>

                        {/* Суммы туров по валютам */}
                        {Object.keys(m.amountByCur).length > 0 && (
                          <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>💳 Суммы туров</div>
                            {Object.entries(m.amountByCur).map(([cur, amt]) => (
                              <div key={cur} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                <span style={{ color: 'var(--muted)' }}>{cur}</span>
                                <span style={{ fontWeight: 600 }}>{fmtAmt(amt, cur)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Комиссия в $ */}
                        <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>💰 Комиссия ($)</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--muted)' }}>Комиссия</span>
                              <span style={{ fontWeight: 600 }}>{fmtUSD(m.commission)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--muted)' }}>Скидки</span>
                              <span style={{ fontWeight: 600, color: '#dc2626' }}>− {fmtUSD(m.discount)}</span>
                            </div>
                            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700 }}>Остаток</span>
                              <span style={{ fontWeight: 800, color: m.balance >= 0 ? '#16a34a' : '#dc2626' }}>
                                {fmtUSD(m.balance)}
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
