import { useState, useEffect } from 'react'
import { api } from '../api'
import { Toast, useToast } from '../components/Toast'
import SearchableSelect from '../components/SearchableSelect'
import { HOTELS_CATALOG } from '../data/hotelsCatalog'

const CURRENCIES = ['USD', 'EUR', 'UZS']

const PAYMENT_METHODS = [
  { id: 'cash_uzs',     icon: '💵', label: 'Наличные',     sub: 'в сумах'   },
  { id: 'transfer_uzs', icon: '📲', label: 'Перевод',      sub: 'в сумах'   },
  { id: 'qr_uzs',       icon: '📱', label: 'QR-код',       sub: 'в сумах'   },
  { id: 'bank',         icon: '🏦', label: 'Перечисление', sub: ''          },
  { id: 'requisites',   icon: '📋', label: 'По реквизитам',sub: ''          },
  { id: 'visa_usd',     icon: '💳', label: 'Visa карта',   sub: '$'         },
  { id: 'cash_usd',     icon: '💵', label: 'Наличные',     sub: '$'         },
  { id: 'mixed',        icon: '🔀', label: 'Смешанная',    sub: 'сум + $'   },
]

const UZS_METHODS = [
  { id: 'cash_uzs',     icon: '💵', label: 'Наличные сум'  },
  { id: 'transfer_uzs', icon: '📲', label: 'Перевод'        },
  { id: 'qr_uzs',       icon: '📱', label: 'QR-код'         },
  { id: 'bank',         icon: '🏦', label: 'Перечисление'   },
  { id: 'requisites',   icon: '📋', label: 'Реквизиты'      },
]

const USD_METHODS = [
  { id: 'visa_usd', icon: '💳', label: 'Visa карта' },
  { id: 'cash_usd', icon: '💵', label: 'Наличные $'  },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

const STEPS = [
  { id: 1, icon: '👤', label: 'Клиент'   },
  { id: 2, icon: '✈️', label: 'Тур'      },
  { id: 3, icon: '📄', label: 'Договор'  },
  { id: 4, icon: '💰', label: 'Финансы'  },
]

function StepBar({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
      {STEPS.map((s, i) => {
        const done    = current > s.id
        const active  = current === s.id
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: done ? 16 : 18,
                background: done ? '#22c55e' : active ? 'var(--primary)' : '#f1f5f9',
                color: done || active ? '#fff' : '#94a3b8',
                fontWeight: 700,
                boxShadow: active ? '0 0 0 4px rgba(0,122,255,0.15)' : 'none',
                transition: 'all .2s',
              }}>
                {done ? '✓' : s.icon}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--primary)' : done ? '#22c55e' : '#94a3b8', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#22c55e' : '#e2e8f0', margin: '0 6px', marginBottom: 20, transition: 'background .3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function SaleForm({ session }) {
  const isManager = session?.role === 'manager'
  const [step, setStep] = useState(1)

  // Справочники
  const [managers,   setManagers]   = useState([])
  const [directions, setDirections] = useState([])
  const [hotels,     setHotels]     = useState([])
  const [sources,    setSources]    = useState([])

  // Шаг 1 — Клиент
  const [clientName, setClientName] = useState('')
  const [phone,      setPhone]      = useState('')
  const [source,     setSource]     = useState('')

  // Шаг 2 — Тур
  const [direction,     setDirection]     = useState('')
  const [hotel,         setHotel]         = useState('')
  const [bookingDate,   setBookingDate]   = useState(today())
  const [departureDate, setDepartureDate] = useState('')
  const [arrivalDate,   setArrivalDate]   = useState('')

  // Шаг 3 — Договор (manager locked for managers)
  const [manager,        setManager]        = useState(isManager ? session.name : '')
  const [contractNumber, setContractNumber] = useState('')
  const [salesCount,     setSalesCount]     = useState(1)

  // Шаг 4 — Финансы
  const [amount,       setAmount]       = useState('')
  const [currency,     setCurrency]     = useState('USD')
  const [rate,         setRate]         = useState('')
  const [netto,        setNetto]        = useState('')
  const [prepayment,   setPrepayment]   = useState('')
  const [commission,   setCommission]   = useState('')
  const [discount,     setDiscount]     = useState('')
  const [dueDate,      setDueDate]      = useState('')
  const [paymentMethod,  setPaymentMethod]  = useState('')
  const [paymentUZS,    setPaymentUZS]    = useState('')
  const [paymentUSD,    setPaymentUSD]    = useState('')
  const [mixedMethod1,  setMixedMethod1]  = useState('cash_uzs')   // UZS part method
  const [mixedMethod2,  setMixedMethod2]  = useState('cash_usd')   // USD part method

  // Курс
  const [rateType,     setRateType]     = useState('')    // 'bank' | 'operator'
  const [fetchingRate, setFetchingRate] = useState(false)
  const [rateError,    setRateError]    = useState('')

  const [loading, setLoading] = useState(false)
  const { toast, show } = useToast()

  // Авто-расчёт комиссии = сумма − нетто
  useEffect(() => {
    if (amount && netto) {
      const auto = Math.round((Number(amount) - Number(netto)) * 100) / 100
      setCommission(auto >= 0 ? String(auto) : '')
    }
  }, [amount, netto])

  async function fetchBankRate() {
    setFetchingRate(true); setRateError('')
    try {
      const r = await api.getExchangeRate()
      if (r.success) setRate(String(Math.round(r.rate)))
      else setRateError('Не удалось загрузить курс')
    } catch { setRateError('Ошибка соединения') }
    finally { setFetchingRate(false) }
  }

  // Авто-расчёты
  const balance = commission ? Number(commission) - (Number(discount) || 0) : null
  const debt    = (amount && prepayment) ? Number(amount) - Number(prepayment) : null

  const currSymbol = { USD: '$', EUR: '€', UZS: 'сум' }[currency] || ''

  useEffect(() => {
    api.getManagers().then(r => r.success && setManagers(r.managers))
    api.getDirections().then(r => r.success && setDirections(r.items))
    api.getSources().then(r => r.success && setSources(r.items))
    const catalogNames = HOTELS_CATALOG.map(h => h.name)
    api.getHotels().then(r => {
      const custom = r.success ? r.items : []
      setHotels([...new Set([...catalogNames, ...custom])])
    }).catch(() => setHotels(catalogNames))
  }, [])

  function canNext() {
    if (step === 1) return true // всё необязательно
    if (step === 2) return true
    if (step === 3) return contractNumber.trim() && manager && salesCount >= 1
    return true
  }

  async function handleSubmit() {
    if (!contractNumber.trim()) return show('Введите номер договора', 'error')
    if (!manager)               return show('Выберите менеджера', 'error')

    setLoading(true)
    try {
      const res = await api.addSale({
        clientName, phone, source,
        direction, hotel, bookingDate,
        manager, contractNumber, salesCount,
        amount: amount || undefined,
        currency,
        rate: rate || undefined,
        netto: netto || undefined,
        prepayment: prepayment || undefined,
        commission: commission || undefined,
        discount: discount || undefined,
        dueDate: dueDate || undefined,
        paymentMethod: paymentMethod === 'mixed'
          ? `mixed:${mixedMethod1}:${mixedMethod2}`
          : (paymentMethod || undefined),
        paymentUZS: paymentUZS || undefined,
        paymentUSD: paymentUSD || undefined,
        departureDate: departureDate || undefined,
        arrivalDate: arrivalDate || undefined,
      })
      if (res.success) {
        show('✅ Запись сохранена!')
        setStep(1)
        setClientName(''); setPhone(''); setSource('')
        setDirection(''); setHotel(''); setBookingDate(today())
        if (!isManager) setManager('')
        setContractNumber(''); setSalesCount(1)
        setAmount(''); setRate(''); setNetto(''); setPrepayment('')
        setCommission(''); setDiscount(''); setDueDate('')
        setDepartureDate(''); setArrivalDate('')
        setPaymentMethod(''); setPaymentUZS(''); setPaymentUSD('')
        setMixedMethod1('cash_uzs'); setMixedMethod2('cash_usd')
        setRateType(''); setRateError('')
      } else {
        show('❌ ' + res.error, 'error')
      }
    } catch {
      show('❌ Ошибка соединения', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">✏️ Новая продажа</div>
      <Toast toast={toast} />
      <StepBar current={step} />

      {/* ── ШАГ 1: КЛИЕНТ ── */}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Информация о клиенте
          </div>

          <div className="form-group">
            <label className="label">Имя клиента</label>
            <input className="input" type="text" placeholder="Иванов Иван"
              value={clientName} onChange={e => setClientName(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">Телефон</label>
            <input className="input" type="tel" placeholder="+998 (99) 000-00-00"
              value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">Источник лида</label>
            <SearchableSelect
              value={source} onChange={setSource}
              items={sources} placeholder="— Откуда пришёл клиент —"
              onAdd={async name => {
                setSources(prev => [...prev, name])
                const r = await api.addSource(name)
                if (r.success) setSources(r.items)
              }}
              onDelete={async name => {
                setSources(prev => prev.filter(s => s !== name))
                const r = await api.removeSource(name)
                if (r.success) setSources(r.items)
              }}
            />
          </div>
        </div>
      )}

      {/* ── ШАГ 2: ТУР ── */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Детали тура
          </div>

          <div className="form-group">
            <label className="label">Направление</label>
            <SearchableSelect
              value={direction} onChange={setDirection}
              items={directions} placeholder="— Выберите направление —"
              onAdd={async name => {
                setDirections(prev => [...prev, name])
                const r = await api.addDirection(name)
                if (r.success) setDirections(r.items)
              }}
              onDelete={async name => {
                setDirections(prev => prev.filter(d => d !== name))
                const r = await api.removeDirection(name)
                if (r.success) setDirections(r.items)
              }}
            />
          </div>

          <div className="form-group">
            <label className="label">Отель</label>
            <SearchableSelect
              value={hotel} onChange={setHotel}
              items={hotels} placeholder="— Выберите отель —"
              onAdd={async name => {
                const r = await api.addHotel(name)
                const custom = r.success ? r.items : []
                setHotels([...new Set([...HOTELS_CATALOG.map(h => h.name), ...custom])])
              }}
              onDelete={async name => {
                if (HOTELS_CATALOG.some(h => h.name === name)) return
                const r = await api.removeHotel(name)
                const custom = r.success ? r.items : []
                setHotels([...new Set([...HOTELS_CATALOG.map(h => h.name), ...custom])])
              }}
            />
          </div>

          <div className="form-group">
            <label className="label">Дата брони</label>
            <input className="input" type="date"
              value={bookingDate} onChange={e => setBookingDate(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label">✈️ Дата вылета</label>
              <input className="input" type="date"
                value={departureDate} onChange={e => setDepartureDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label">🛬 Дата прилёта</label>
              <input className="input" type="date"
                value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* ── ШАГ 3: ДОГОВОР ── */}
      {step === 3 && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Данные договора
          </div>

          <div className="form-group">
            <label className="label">Менеджер *</label>
            {isManager ? (
              <div className="input" style={{ color: 'var(--text)', background: '#f1f5f9', cursor: 'default' }}>
                {session.name}
              </div>
            ) : (
              <select className="select" value={manager} onChange={e => setManager(e.target.value)}>
                <option value="">— Выберите менеджера —</option>
                {managers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="label">Номер договора *</label>
            <input className="input" type="text" placeholder="ДГВ-2026-001"
              value={contractNumber} onChange={e => setContractNumber(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">Количество людей в заявке</label>
            <input className="input" type="number" min="1"
              value={salesCount} onChange={e => setSalesCount(Number(e.target.value))} />
          </div>
        </div>
      )}

      {/* ── ШАГ 4: ФИНАНСЫ ── */}
      {step === 4 && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Финансовые детали
          </div>

          {/* Сумма + Валюта */}
          <div className="form-group">
            <label className="label">Сумма тур пакета</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input" type="number" min="0" placeholder="0"
                style={{ flex: 1, marginBottom: 0 }}
                value={amount} onChange={e => setAmount(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                {CURRENCIES.map(c => (
                  <button key={c} onClick={() => setCurrency(c)} type="button"
                    style={{
                      padding: '0 12px', height: 44, borderRadius: 10, border: '1.5px solid',
                      borderColor: currency === c ? 'var(--primary)' : 'var(--border)',
                      background: currency === c ? 'var(--primary)' : '#f8fafc',
                      color: currency === c ? '#fff' : 'var(--text)',
                      fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      transition: 'all .15s',
                    }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Курс доллара */}
          <div className="form-group">
            <label className="label">Курс доллара (1 $ = ? сум)</label>

            {/* Выбор источника курса */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button type="button"
                onClick={() => { setRateType('bank'); setRate(''); fetchBankRate() }}
                style={{
                  flex: 1, padding: '11px 8px', borderRadius: 12, border: '1.5px solid',
                  borderColor: rateType === 'bank' ? 'var(--primary)' : 'var(--border)',
                  background: rateType === 'bank' ? 'var(--primary)' : '#f8fafc',
                  color: rateType === 'bank' ? '#fff' : 'var(--text)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                🏦 Ipak Yuli Bank
              </button>
              <button type="button"
                onClick={() => { setRateType('operator'); setRate('') }}
                style={{
                  flex: 1, padding: '11px 8px', borderRadius: 12, border: '1.5px solid',
                  borderColor: rateType === 'operator' ? 'var(--primary)' : 'var(--border)',
                  background: rateType === 'operator' ? 'var(--primary)' : '#f8fafc',
                  color: rateType === 'operator' ? '#fff' : 'var(--text)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                👤 Курс оператора
              </button>
            </div>

            {/* Банковский курс — показываем загруженное значение */}
            {rateType === 'bank' && (
              <div style={{
                background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 13,
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {fetchingRate ? (
                  <span style={{ fontSize: 14, color: '#0369a1' }}>⏳ Загружаем курс...</span>
                ) : rateError ? (
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: '#dc2626' }}>❌ {rateError}</span>
                    <button type="button" onClick={fetchBankRate}
                      style={{ marginLeft: 10, fontSize: 12, color: '#0369a1', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                      Повторить
                    </button>
                  </div>
                ) : rate ? (
                  <>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0369a1' }}>
                        1 $ = {Number(rate).toLocaleString('ru-RU')} сум
                      </div>
                      <div style={{ fontSize: 11, color: '#0369a1', opacity: 0.7, marginTop: 2 }}>
                        Курс Ipak Yuli Bank
                      </div>
                    </div>
                    <button type="button" onClick={fetchBankRate}
                      style={{ background: '#bae6fd', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#0369a1', fontFamily: 'inherit' }}>
                      🔄 Обновить
                    </button>
                  </>
                ) : null}
              </div>
            )}

            {/* Ручной ввод курса оператора */}
            {rateType === 'operator' && (
              <input className="input" type="number" min="0" step="1" placeholder="Например: 12 800"
                value={rate} onChange={e => setRate(e.target.value)} />
            )}
          </div>

          {/* Цена нетто */}
          <div className="form-group">
            <label className="label">Цена нетто ({currSymbol}) — себестоимость тура</label>
            <input className="input" type="number" min="0" placeholder="0"
              value={netto} onChange={e => setNetto(e.target.value)} />
          </div>

          {/* Предоплата клиента */}
          <div className="form-group">
            <label className="label">Предоплата клиента ({currSymbol})</label>
            <input className="input" type="number" min="0" placeholder="0"
              value={prepayment} onChange={e => setPrepayment(e.target.value)} />
          </div>

          {/* Срок оплаты остатка */}
          <div className="form-group">
            <label className="label">📅 Срок оплаты остатка</label>
            <input className="input" type="date"
              value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          {/* Долг клиента = Сумма − Предоплата */}
          {debt !== null && (
            <div style={{
              background: debt > 0 ? 'linear-gradient(135deg, #fff7ed, #fff)' : 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
              border: `1.5px solid ${debt > 0 ? '#fed7aa' : '#86efac'}`,
              borderRadius: 14, padding: '12px 16px', marginBottom: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: debt > 0 ? '#9a3412' : '#15803d', marginBottom: 2 }}>
                Долг клиента (остаток оплаты)
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: debt > 0 ? '#ea580c' : '#16a34a' }}>
                {debt.toLocaleString('ru-RU')} {currSymbol}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {Number(amount).toLocaleString('ru-RU')} {currSymbol} − {Number(prepayment).toLocaleString('ru-RU')} {currSymbol} предоплата
              </div>
            </div>
          )}

          {/* ── Способ оплаты ── */}
          <div className="form-group">
            <label className="label">Способ оплаты</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {PAYMENT_METHODS.map(pm => {
                const selected = paymentMethod === pm.id
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(selected ? '' : pm.id)}
                    style={{
                      padding: '10px 6px', borderRadius: 12, border: '1.5px solid',
                      borderColor: selected ? 'var(--primary)' : 'var(--border)',
                      background: selected ? 'var(--primary)' : '#f8fafc',
                      color: selected ? '#fff' : 'var(--text)',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      transition: 'all .15s',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{pm.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, textAlign: 'center' }}>{pm.label}</span>
                    {pm.sub && <span style={{ fontSize: 10, opacity: selected ? 0.85 : 0.5, lineHeight: 1 }}>{pm.sub}</span>}
                  </button>
                )
              })}
            </div>

            {/* Смешанная оплата — выбор способа + суммы для каждой части */}
            {paymentMethod === 'mixed' && (
              <div style={{
                marginTop: 12, background: '#f0f9ff',
                border: '1.5px solid #bae6fd', borderRadius: 14,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 14px 0', fontSize: 13, fontWeight: 800, color: '#0369a1' }}>
                  🔀 Разбивка смешанной оплаты
                </div>

                {/* Часть 1 — UZS */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #bae6fd' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Часть 1 — в сумах (UZS)
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {UZS_METHODS.map(m => (
                      <button key={m.id} type="button"
                        onClick={() => setMixedMethod1(m.id)}
                        style={{
                          padding: '6px 10px', borderRadius: 8, border: '1.5px solid',
                          borderColor: mixedMethod1 === m.id ? '#0369a1' : '#bae6fd',
                          background: mixedMethod1 === m.id ? '#0369a1' : '#fff',
                          color: mixedMethod1 === m.id ? '#fff' : '#0369a1',
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 4,
                          transition: 'all .15s',
                        }}>
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                  <input className="input" type="number" min="0" placeholder="Сумма в UZS"
                    style={{ marginBottom: 0 }}
                    value={paymentUZS} onChange={e => setPaymentUZS(e.target.value)} />
                </div>

                {/* Часть 2 — USD */}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Часть 2 — в долларах ($)
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {USD_METHODS.map(m => (
                      <button key={m.id} type="button"
                        onClick={() => setMixedMethod2(m.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 8, border: '1.5px solid',
                          borderColor: mixedMethod2 === m.id ? '#0369a1' : '#bae6fd',
                          background: mixedMethod2 === m.id ? '#0369a1' : '#fff',
                          color: mixedMethod2 === m.id ? '#fff' : '#0369a1',
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 4,
                          transition: 'all .15s',
                        }}>
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                  <input className="input" type="number" min="0" placeholder="Сумма в $"
                    style={{ marginBottom: 0 }}
                    value={paymentUSD} onChange={e => setPaymentUSD(e.target.value)} />
                </div>

                {/* Итого */}
                {(paymentUZS || paymentUSD) && (
                  <div style={{ padding: '10px 14px', background: '#e0f2fe', borderTop: '1px solid #bae6fd', fontSize: 12, color: '#0369a1', fontWeight: 700 }}>
                    {[
                      paymentUZS && `${Number(paymentUZS).toLocaleString('ru-RU')} сум`,
                      paymentUSD && `${Number(paymentUSD).toLocaleString('ru-RU')} $`,
                    ].filter(Boolean).join(' + ')}
                    {paymentUZS && paymentUSD && rate && (
                      <span style={{ fontWeight: 400, marginLeft: 8, opacity: 0.8 }}>
                        ≈ {(Number(paymentUSD) + Number(paymentUZS) / Number(rate)).toFixed(0)} $ итого
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Комиссия — авто из amount−netto, редактируемая */}
          <div className="form-group">
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Комиссия агентства ($)
              {amount && netto && (
                <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 500, background: '#eef2ff', borderRadius: 6, padding: '1px 7px' }}>
                  авто
                </span>
              )}
            </label>
            <input className="input" type="number" min="0" placeholder="0"
              value={commission} onChange={e => setCommission(e.target.value)} />
          </div>

          {/* Скидка — всегда в $ */}
          <div className="form-group">
            <label className="label">Скидка клиенту ($)</label>
            <input className="input" type="number" min="0" placeholder="0"
              value={discount} onChange={e => setDiscount(e.target.value)} />
          </div>

          {/* Чистая комиссия */}
          {balance !== null && (
            <div style={{
              background: balance >= 0 ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : 'linear-gradient(135deg, #fef2f2, #fee2e2)',
              border: `1.5px solid ${balance >= 0 ? '#86efac' : '#fca5a5'}`,
              borderRadius: 14, padding: '14px 16px', marginTop: 4,
            }}>
              <div style={{ fontSize: 12, color: balance >= 0 ? '#15803d' : '#dc2626', fontWeight: 600, marginBottom: 4 }}>
                Чистая комиссия
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: balance >= 0 ? '#15803d' : '#dc2626' }}>
                {balance.toLocaleString('ru-RU')} $
              </div>
              <div style={{ fontSize: 11, color: balance >= 0 ? '#16a34a' : '#ef4444', marginTop: 4 }}>
                {Number(commission).toLocaleString('ru-RU')} $ − {(Number(discount) || 0).toLocaleString('ru-RU')} $ скидка
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Навигация ── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              border: '1.5px solid var(--border)', background: '#f8fafc',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', color: 'var(--text)',
            }}
          >
            ← Назад
          </button>
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={() => { if (canNext()) { setStep(s => s + 1) } else { show('Заполните обязательные поля', 'error') } }}
            className="btn"
            style={{ flex: 2 }}
          >
            Далее →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            className="btn"
            style={{ flex: 2 }}
            disabled={loading}
          >
            {loading ? '⏳ Сохраняем...' : '💾 Сохранить'}
          </button>
        )}
      </div>

      {/* Краткое резюме заполненного */}
      {(clientName || direction || contractNumber) && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {clientName    && <span>👤 {clientName}</span>}
          {phone         && <span>📱 {phone}</span>}
          {direction     && <span>✈️ {direction}</span>}
          {hotel         && <span>🏨 {hotel}</span>}
          {contractNumber && <span>📄 {contractNumber}</span>}
          {manager       && <span>👥 {manager}</span>}
          {amount        && <span>💰 {Number(amount).toLocaleString('ru-RU')} {currency}</span>}
        </div>
      )}
    </div>
  )
}
