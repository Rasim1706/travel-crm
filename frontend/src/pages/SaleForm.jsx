import { useState, useEffect } from 'react'
import { api } from '../api'
import { Toast, useToast } from '../components/Toast'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function SaleForm() {
  const [managers,       setManagers]       = useState([])
  const [contractNumber, setContractNumber] = useState('')
  const [manager,        setManager]        = useState('')
  const [salesCount,     setSalesCount]     = useState(1)
  const [bookingDate,    setBookingDate]    = useState(today())
  const [loading,        setLoading]        = useState(false)
  const { toast, show } = useToast()

  useEffect(() => {
    api.getManagers().then(r => r.success && setManagers(r.managers))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!contractNumber.trim()) return show('Введите номер договора', 'error')
    if (!manager)               return show('Выберите менеджера', 'error')
    if (salesCount < 1)         return show('Укажите количество продаж', 'error')
    if (!bookingDate)           return show('Укажите дату брони', 'error')

    setLoading(true)
    try {
      const res = await api.addSale({ contractNumber, manager, salesCount, bookingDate })
      if (res.success) {
        show('✅ Запись сохранена в таблицу!')
        setContractNumber('')
        setManager('')
        setSalesCount(1)
        setBookingDate(today())
      } else {
        show('❌ ' + res.error, 'error')
      }
    } catch {
      show('❌ Ошибка соединения с сервером', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">✏️ Добавить продажу</div>

      <Toast toast={toast} />

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="label">Номер договора</label>
          <input
            className="input"
            type="text"
            placeholder="Например: ДГВ-2024-001"
            value={contractNumber}
            onChange={e => setContractNumber(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="label">Менеджер</label>
          <select
            className="select"
            value={manager}
            onChange={e => setManager(e.target.value)}
          >
            <option value="">— Выберите менеджера —</option>
            {managers.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="label">Дата брони</label>
          <input
            className="input"
            type="date"
            value={bookingDate}
            onChange={e => setBookingDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="label">Количество продаж</label>
          <input
            className="input"
            type="number"
            min="1"
            value={salesCount}
            onChange={e => setSalesCount(Number(e.target.value))}
          />
        </div>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? '⏳ Сохраняем...' : '💾 Сохранить запись'}
        </button>
      </form>
    </div>
  )
}
