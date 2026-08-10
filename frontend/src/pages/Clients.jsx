import { useState, useEffect, useMemo } from 'react'
import { api } from '../api'

const SORT_OPTIONS = [
  { value: 'contracts', label: 'По договорам' },
  { value: 'sales',     label: 'По продажам'  },
  { value: 'last',      label: 'По последней покупке' },
  { value: 'name',      label: 'По имени'     },
]

function LtvBadge({ count }) {
  const cfg =
    count >= 5 ? { bg: '#fef3c7', color: '#92400e', label: '⭐ VIP',      border: '#fcd34d' } :
    count >= 3 ? { bg: '#ede9fe', color: '#5b21b6', label: '💎 Постоянный', border: '#c4b5fd' } :
    count >= 2 ? { bg: '#dbeafe', color: '#1e40af', label: '🔄 Повторный',  border: '#93c5fd' } :
                 { bg: '#f1f5f9', color: '#64748b', label: '🆕 Новый',      border: '#e2e8f0' }
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '3px 9px',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function avatar(name) {
  return name ? name.trim().charAt(0).toUpperCase() : '?'
}

function formatDate(str) {
  if (!str) return '—'
  const d = new Date(str)
  return isNaN(d) ? '—' : d.toLocaleDateString('ru-RU')
}

function monthsDiff(date) {
  const m = Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60 * 24 * 30.4))
  return m
}

export default function Clients() {
  const [sales,   setSales]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [sortBy,  setSortBy]  = useState('contracts')
  const [opened,  setOpened]  = useState(null) // expanded client name

  useEffect(() => {
    api.getSales()
      .then(r => { if (r.success) setSales(r.sales); else setError(r.error) })
      .catch(() => setError('Ошибка соединения'))
      .finally(() => setLoading(false))
  }, [])

  const clients = useMemo(() => {
    const map = {}

    sales.forEach(s => {
      const name  = s.clientName?.trim()
      const phone = s.phone?.trim()
      if (!name && !phone) return

      // Ключ: телефон (если есть) иначе «name:ИМЯ»
      const key = phone ? `tel:${phone}` : `name:${name}`

      if (!map[key]) {
        map[key] = {
          phone,
          names:      [],          // все имена под этим ключом
          contracts:  0,
          totalSales: 0,
          firstDate:  null,
          lastDate:   null,
          directions: {},
          hotels:     {},
          managers:   {},
          records:    [],
          noPhone:    !phone,      // флаг — нет телефона
        }
      }
      const c = map[key]

      // Обновляем телефон если появился
      if (phone && !c.phone) c.phone = phone

      // Собираем уникальные имена
      if (name && !c.names.includes(name)) c.names.push(name)

      c.contracts++
      c.totalSales += s.salesCount || 0

      const d = s.bookingDate ? new Date(s.bookingDate) : (s.date ? new Date(s.date) : null)
      if (d && !isNaN(d)) {
        if (!c.firstDate || d < c.firstDate) c.firstDate = d
        if (!c.lastDate  || d > c.lastDate)  c.lastDate  = d
      }

      if (s.direction) c.directions[s.direction] = (c.directions[s.direction] || 0) + 1
      if (s.hotel)     c.hotels[s.hotel]         = (c.hotels[s.hotel]         || 0) + 1
      if (s.manager)   c.managers[s.manager]     = (c.managers[s.manager]     || 0) + 1

      c.records.push(s)
    })

    return Object.values(map).map(c => ({
      ...c,
      // Отображаемое имя — последнее встреченное, или «Без имени»
      name: c.names[c.names.length - 1] || '—',
    }))
  }, [sales])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return clients
      .filter(c => !q ||
        c.name.toLowerCase().includes(q) ||
        c.names.some(n => n.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      )
      .sort((a, b) => {
        if (sortBy === 'contracts') return b.contracts - a.contracts
        if (sortBy === 'sales')     return b.totalSales - a.totalSales
        if (sortBy === 'last')      return (b.lastDate || 0) - (a.lastDate || 0)
        if (sortBy === 'name')      return a.name.localeCompare(b.name, 'ru')
        return 0
      })
  }, [clients, search, sortBy])

  const totalClients   = clients.length
  const repeatClients  = clients.filter(c => c.contracts >= 2).length
  const vipClients     = clients.filter(c => c.contracts >= 5).length
  const avgContracts   = totalClients ? (clients.reduce((s,c) => s + c.contracts, 0) / totalClients).toFixed(1) : 0

  if (loading) return <div className="loader">⏳ Загрузка...</div>
  if (error)   return <div className="loader">❌ {error}</div>

  return (
    <>
      {/* Итого */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-number">{totalClients}</div>
          <div className="stat-label">👤 Всего клиентов</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{repeatClients}</div>
          <div className="stat-label">🔄 Повторные</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{vipClients}</div>
          <div className="stat-label">⭐ VIP (5+)</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{avgContracts}</div>
          <div className="stat-label">📈 Среднее LTV</div>
        </div>
      </div>

      {/* Поиск + сортировка */}
      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 180, marginBottom: 0 }}
            placeholder="🔍 Поиск по имени или телефону..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="select"
            style={{ width: 'auto', flex: '0 0 auto' }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Список клиентов */}
      <div className="card">
        <div className="card-title">👥 Клиенты ({filtered.length})</div>

        {filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">📭</div><p>Клиентов не найдено</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {filtered.map((c, idx) => {
              const topDir     = Object.entries(c.directions).sort((a,b) => b[1]-a[1])[0]?.[0]
              const topManager = Object.entries(c.managers).sort((a,b) => b[1]-a[1])[0]?.[0]
              const isOpen     = opened === c.name
              const months     = c.lastDate ? monthsDiff(c.lastDate) : null

              return (
                <div key={c.name} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {/* Основная строка */}
                  <div
                    onClick={() => setOpened(isOpen ? null : c.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 0', cursor: 'pointer',
                    }}
                  >
                    {/* Аватар */}
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: `hsl(${(c.name.charCodeAt(0) * 37) % 360}, 55%, 55%)`,
                      color: '#fff', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontWeight: 700, fontSize: 16,
                    }}>
                      {avatar(c.name)}
                    </div>

                    {/* Имя + телефон */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {c.name}
                        {c.names.length > 1 && (
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>
                            + {c.names.slice(0, -1).join(', ')}
                          </span>
                        )}
                        <LtvBadge count={c.contracts} />
                        {c.noPhone && (
                          <span style={{ fontSize: 10, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', borderRadius: 8, padding: '1px 6px' }}>
                            без телефона
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
                            style={{ color: '#007aff', textDecoration: 'none', fontWeight: 600 }}>
                            📱 {c.phone}
                          </a>
                        ) : (
                          <span style={{ color: '#f97316' }}>📵 телефон не указан</span>
                        )}
                        {topDir     && <span>✈️ {topDir}</span>}
                        {topManager && <span>👤 {topManager}</span>}
                      </div>
                    </div>

                    {/* Метрики */}
                    <div style={{ display: 'flex', gap: 16, flexShrink: 0, alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>{c.contracts}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>договоров</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: 18 }}>{c.totalSales}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>продаж</div>
                      </div>
                      {months !== null && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            fontWeight: 700, fontSize: 13,
                            color: months >= 3 ? '#ef4444' : months >= 1 ? '#f97316' : '#22c55e',
                          }}>
                            {months === 0 ? 'сейчас' : `${months} мес.`}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>назад</div>
                        </div>
                      )}
                      <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 4 }}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Раскрытая история */}
                  {isOpen && (
                    <div style={{
                      background: '#f8fafc', borderRadius: 12,
                      padding: '12px 14px', marginBottom: 12,
                    }}>
                      {/* Направления и отели */}
                      {(Object.keys(c.directions).length > 0 || Object.keys(c.hotels).length > 0) && (
                        <div style={{ display: 'flex', gap: 24, marginBottom: 10, flexWrap: 'wrap' }}>
                          {Object.keys(c.directions).length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>НАПРАВЛЕНИЯ</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {Object.entries(c.directions).sort((a,b) => b[1]-a[1]).map(([d, n]) => (
                                  <span key={d} style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 20, fontSize: 12, padding: '2px 10px', fontWeight: 600 }}>
                                    {d} ×{n}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {Object.keys(c.hotels).length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>ОТЕЛИ</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {Object.entries(c.hotels).sort((a,b) => b[1]-a[1]).map(([h, n]) => (
                                  <span key={h} style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: 20, fontSize: 12, padding: '2px 10px', fontWeight: 600 }}>
                                    {h} ×{n}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Все записи */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>ИСТОРИЯ ПОКУПОК</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {c.records
                          .slice()
                          .sort((a, b) => new Date(b.bookingDate || b.date) - new Date(a.bookingDate || a.date))
                          .map((r, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              background: '#fff', borderRadius: 8, padding: '8px 10px',
                              border: '1px solid var(--border)',
                            }}>
                              <div style={{ width: 22, height: 22, borderRadius: 6, background: '#f0f7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                                {i + 1}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.contractNumber}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                  {r.direction && `✈️ ${r.direction}`}
                                  {r.hotel && ` · 🏨 ${r.hotel}`}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                {r.bookingDate && (
                                  <div style={{ fontSize: 12, fontWeight: 600 }}>{formatDate(r.bookingDate)}</div>
                                )}
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.manager}</div>
                              </div>
                              <span className="badge">{r.salesCount}</span>
                            </div>
                          ))
                        }
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
