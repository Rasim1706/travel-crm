import { useState, useEffect } from 'react'
import { api } from '../api'
import { Toast, useToast } from '../components/Toast'

const DEFAULT_SOURCES = [
  'Реклама', 'Сарафанка', 'Родственники', 'Знакомые',
  'Instagram', 'Facebook', 'Telegram', 'WhatsApp', 'TikTok',
  'Сайт', 'Google', 'Повторный клиент',
]

function ListManager({ icon, items, onAdd, onDelete, placeholder }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    const name = input.trim()
    if (!name) return
    setLoading(true)
    await onAdd(name)
    setInput('')
    setLoading(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="input" style={{ flex: 1, marginBottom: 0 }} placeholder={placeholder}
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <button className="btn" style={{ width: 'auto', padding: '0 18px', flexShrink: 0 }}
          onClick={handleAdd} disabled={loading || !input.trim()}>
          {loading ? '…' : '+ Добавить'}
        </button>
      </div>
      {items.length === 0 ? (
        <div className="empty" style={{ padding: '20px 0' }}>
          <div className="empty-icon">{icon}</div>
          <p>Список пуст — добавьте первый пункт</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(item => (
            <div key={item} style={{
              display: 'flex', alignItems: 'center', padding: '10px 12px',
              background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)',
            }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{item}</span>
              <button onClick={() => onDelete(item)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1',
                fontSize: 20, lineHeight: 1, padding: '0 4px', borderRadius: 6, transition: 'color .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                title="Удалить">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AccountsManager({ show }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ login: '', password: '', manager: '', role: 'manager' })
  const [adding, setAdding] = useState(false)
  const [changingPwd, setChangingPwd] = useState(null)
  const [newPwd, setNewPwd] = useState('')

  useEffect(() => {
    api.getAccounts()
      .then(r => { if (r.success) setAccounts(r.accounts) })
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    if (!form.login.trim() || !form.password.trim() || !form.manager.trim())
      return show('❌ Заполните все поля', 'error')
    setAdding(true)
    const r = await api.addAccount(form)
    if (r.success) {
      setAccounts(r.accounts)
      setForm({ login: '', password: '', manager: '', role: 'manager' })
      show('✅ Аккаунт создан')
    } else {
      show('❌ ' + r.error, 'error')
    }
    setAdding(false)
  }

  async function handleDelete(login) {
    const r = await api.deleteAccount(login)
    if (r.success) { setAccounts(r.accounts); show('✅ Аккаунт удалён') }
    else show('❌ ' + r.error, 'error')
  }

  async function handleChangePassword(login) {
    if (!newPwd.trim()) return show('❌ Введите новый пароль', 'error')
    const r = await api.changePassword(login, newPwd.trim())
    if (r.success) { show('✅ Пароль изменён'); setChangingPwd(null); setNewPwd('') }
    else show('❌ ' + r.error, 'error')
  }

  if (loading) return <div className="loader">⏳ Загрузка...</div>

  return (
    <div>
      {/* Форма добавления */}
      <div style={{ background: '#f8fafc', borderRadius: 16, padding: '16px', marginBottom: 20, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>➕ Новый аккаунт</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="input" placeholder="Логин (уникальный)" value={form.login}
            onChange={e => setForm(f => ({ ...f, login: e.target.value }))} style={{ marginBottom: 0 }} />
          <input className="input" type="password" placeholder="Пароль" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ marginBottom: 0 }} />
          <input className="input" placeholder="Имя менеджера (отображается в записях)" value={form.manager}
            onChange={e => setForm(f => ({ ...f, manager: e.target.value }))} style={{ marginBottom: 0 }} />
          <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ marginBottom: 0 }}>
            <option value="manager">👤 Менеджер (только форма + дашборд)</option>
            <option value="admin">👑 Администратор (полный доступ)</option>
          </select>
          <button className="btn" onClick={handleAdd} disabled={adding}>
            {adding ? '⏳ Создание...' : '+ Создать аккаунт'}
          </button>
        </div>
      </div>

      {/* Список аккаунтов */}
      {accounts.length === 0 ? (
        <div className="empty"><div className="empty-icon">👤</div><p>Аккаунтов пока нет</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {accounts.map(acc => (
            <div key={acc.login} style={{
              background: '#fff', borderRadius: 14, padding: '14px 16px',
              border: '1.5px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{acc.login}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    {acc.role === 'admin' ? '👑 Администратор' : '👤 Менеджер'} · {acc.manager}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { setChangingPwd(changingPwd === acc.login ? null : acc.login); setNewPwd('') }}
                    style={{ background: '#e0e7ff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#3730a3' }}
                  >🔑 Пароль</button>
                  <button
                    onClick={() => handleDelete(acc.login)}
                    style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#dc2626' }}
                  >✕ Удалить</button>
                </div>
              </div>
              {changingPwd === acc.login && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <input className="input" type="password" placeholder="Новый пароль" value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleChangePassword(acc.login)}
                    style={{ marginBottom: 0, flex: 1 }} />
                  <button onClick={() => handleChangePassword(acc.login)}
                    style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                    Сохранить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Settings({ session }) {
  const isAdmin = session?.role === 'admin'
  const [tab, setTab] = useState('directions')
  const [directions, setDirections] = useState([])
  const [hotels, setHotels] = useState([])
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast, show } = useToast()

  useEffect(() => {
    Promise.all([api.getDirections(), api.getHotels(), api.getSources()])
      .then(([d, h, s]) => {
        if (d.success) setDirections(d.items)
        if (h.success) setHotels(h.items)
        if (s.success) setSources(s.items)
      })
      .finally(() => setLoading(false))
  }, [])

  async function addDirection(name) {
    const r = await api.addDirection(name)
    if (r.success) { setDirections(r.items); show(`✅ «${name}» добавлено`) }
    else show('❌ ' + r.error, 'error')
  }
  async function deleteDirection(name) {
    const r = await api.removeDirection(name)
    if (r.success) setDirections(r.items)
  }
  async function addHotel(name) {
    const r = await api.addHotel(name)
    if (r.success) { setHotels(r.items); show(`✅ «${name}» добавлен`) }
    else show('❌ ' + r.error, 'error')
  }
  async function deleteHotel(name) {
    const r = await api.removeHotel(name)
    if (r.success) setHotels(r.items)
  }
  async function addSource(name) {
    const r = await api.addSource(name)
    if (r.success) { setSources(r.items); show(`✅ «${name}» добавлен`) }
    else show('❌ ' + r.error, 'error')
  }
  async function deleteSource(name) {
    const r = await api.removeSource(name)
    if (r.success) setSources(r.items)
  }
  async function addDefaultSources() {
    const existing = new Set(sources.map(s => s.toLowerCase()))
    const toAdd = DEFAULT_SOURCES.filter(s => !existing.has(s.toLowerCase()))
    for (const name of toAdd) {
      const r = await api.addSource(name)
      if (r.success) setSources(r.items)
    }
    show(`✅ Добавлено ${toAdd.length} источников`)
  }

  if (loading) return <div className="loader">⏳ Загрузка...</div>

  const tabList = [
    { id: 'directions', label: '🌍 Направления', count: directions.length },
    { id: 'hotels',     label: '🏨 Отели',       count: hotels.length     },
    { id: 'sources',    label: '📣 Источники',   count: sources.length    },
    ...(isAdmin ? [{ id: 'accounts', label: '👤 Аккаунты', count: null }] : []),
  ]

  return (
    <>
      <Toast toast={toast} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabList.map(s => (
          <button key={s.id} onClick={() => setTab(s.id)} style={{
            flex: 1, padding: '12px 16px', borderRadius: 14, border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
            background: tab === s.id ? 'var(--primary)' : '#f1f5f9',
            color: tab === s.id ? '#fff' : 'var(--text)',
            transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {s.label}
            {s.count !== null && (
              <span style={{
                background: tab === s.id ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                borderRadius: 20, padding: '1px 8px', fontSize: 12,
              }}>{s.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'directions' && (
        <div className="card">
          <div className="card-title">🌍 Управление направлениями</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Направления отображаются в форме добавления продажи как выпадающий список.
          </p>
          <ListManager icon="🌍" items={directions} onAdd={addDirection} onDelete={deleteDirection}
            placeholder="Например: Турция, Египет, ОАЭ..." />
        </div>
      )}

      {tab === 'sources' && (
        <div className="card">
          <div className="card-title">📣 Источники лидов</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            Откуда приходят клиенты — Instagram, Telegram, рекомендации и т.д.
          </p>
          {sources.length === 0 && (
            <button className="btn" style={{ marginBottom: 16 }} onClick={addDefaultSources}>
              ⚡ Добавить стандартные источники
            </button>
          )}
          <ListManager icon="📣" items={sources} onAdd={addSource} onDelete={deleteSource}
            placeholder="Например: Instagram, Telegram..." />
        </div>
      )}

      {tab === 'hotels' && (
        <div className="card">
          <div className="card-title">🏨 Свои отели</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            160+ популярных отелей уже встроены в форму. Здесь добавляйте любые отели, которых нет в списке.
          </p>
          <ListManager icon="🏨" items={hotels} onAdd={addHotel} onDelete={deleteHotel}
            placeholder="Название отеля которого нет в списке..." />
        </div>
      )}

      {tab === 'accounts' && isAdmin && (
        <div className="card">
          <div className="card-title">👤 Управление аккаунтами</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Менеджеры видят только форму и дашборд, и только свои продажи. Администраторы — полный доступ ко всем данным.
          </p>
          <AccountsManager show={show} />
        </div>
      )}
    </>
  )
}
