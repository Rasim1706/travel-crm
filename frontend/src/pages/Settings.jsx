import { useState, useEffect } from 'react'
import { api } from '../api'
import { Toast, useToast } from '../components/Toast'

const DEFAULT_SOURCES = [
  'Реклама', 'Сарафанка', 'Родственники', 'Знакомые',
  'Instagram', 'Facebook', 'Telegram', 'WhatsApp', 'TikTok',
  'Сайт', 'Google', 'Повторный клиент',
]

function ListManager({ icon, items, onAdd, onDelete, onRename, placeholder }) {
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editValue,  setEditValue]  = useState('')
  const [renaming,   setRenaming]   = useState(false)

  async function handleAdd() {
    const name = input.trim()
    if (!name) return
    setLoading(true)
    await onAdd(name)
    setInput('')
    setLoading(false)
  }

  function startEdit(item) {
    setEditingItem(item)
    setEditValue(item)
  }

  function cancelEdit() {
    setEditingItem(null)
    setEditValue('')
  }

  async function commitEdit(item) {
    const newName = editValue.trim()
    if (!newName || newName === item) { cancelEdit(); return }
    setRenaming(true)
    await onRename(item, newName)
    setRenaming(false)
    setEditingItem(null)
    setEditValue('')
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
              display: 'flex', alignItems: 'center', padding: '8px 12px',
              background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)',
            }}>
              {editingItem === item ? (
                <>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEdit(item)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    onBlur={() => commitEdit(item)}
                    disabled={renaming}
                    style={{
                      flex: 1, border: '1.5px solid #6366f1', borderRadius: 7,
                      padding: '4px 8px', fontSize: 14, fontWeight: 500,
                      outline: 'none', background: '#fff',
                    }}
                  />
                  <button onClick={cancelEdit} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
                    fontSize: 18, padding: '0 6px', marginLeft: 4,
                  }} title="Отмена">✕</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{item}</span>
                  <button onClick={() => startEdit(item)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1',
                    fontSize: 15, padding: '0 5px', borderRadius: 6, transition: 'color .15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.color = '#6366f1'}
                    onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                    title="Переименовать">✏️</button>
                  <button onClick={() => onDelete(item)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1',
                    fontSize: 20, lineHeight: 1, padding: '0 4px', borderRadius: 6, transition: 'color .15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                    title="Удалить">×</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AccountsManager({ show }) {
  const [accounts,    setAccounts]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [form,        setForm]        = useState({ login: '', password: '', manager: '', role: 'manager' })
  const [adding,      setAdding]      = useState(false)
  const [changingPwd, setChangingPwd] = useState(null)
  const [newPwd,      setNewPwd]      = useState('')
  const [editingAcc,  setEditingAcc]  = useState(null)   // login being edited
  const [editForm,    setEditForm]    = useState({})
  const [saving,      setSaving]      = useState(false)
  const [delConfirm,  setDelConfirm]  = useState(null)   // login pending delete

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
    if (r.success) { setAccounts(r.accounts); show('✅ Аккаунт удалён'); setDelConfirm(null) }
    else show('❌ ' + r.error, 'error')
  }

  async function handleChangePassword(login) {
    if (!newPwd.trim()) return show('❌ Введите новый пароль', 'error')
    const r = await api.changePassword(login, newPwd.trim())
    if (r.success) { show('✅ Пароль изменён'); setChangingPwd(null); setNewPwd('') }
    else show('❌ ' + r.error, 'error')
  }

  function startEdit(acc) {
    setEditingAcc(acc.login)
    setEditForm({ newLogin: acc.login, manager: acc.manager, role: acc.role })
    setChangingPwd(null)
  }

  async function handleSaveEdit(origLogin) {
    if (!editForm.newLogin.trim() || !editForm.manager.trim())
      return show('❌ Логин и имя обязательны', 'error')
    setSaving(true)
    const r = await api.updateAccount(origLogin, {
      newLogin: editForm.newLogin.trim() !== origLogin ? editForm.newLogin.trim() : undefined,
      manager: editForm.manager,
      role: editForm.role,
    })
    if (r.success) {
      setAccounts(r.accounts)
      setEditingAcc(null)
      show('✅ Данные обновлены')
    } else {
      show('❌ ' + r.error, 'error')
    }
    setSaving(false)
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
              border: `1.5px solid ${editingAcc === acc.login ? 'var(--primary)' : 'var(--border)'}`,
              transition: 'border-color .2s',
            }}>
              {editingAcc === acc.login ? (
                /* ── Режим редактирования ── */
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 12 }}>
                    ✏️ Редактирование аккаунта
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Логин</label>
                      <input className="input" value={editForm.newLogin}
                        onChange={e => setEditForm(f => ({ ...f, newLogin: e.target.value }))}
                        style={{ marginBottom: 0 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Имя менеджера</label>
                      <input className="input" placeholder="Отображается в записях" value={editForm.manager}
                        onChange={e => setEditForm(f => ({ ...f, manager: e.target.value }))}
                        style={{ marginBottom: 0 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Роль</label>
                      <select className="input" value={editForm.role}
                        onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                        style={{ marginBottom: 0 }}>
                        <option value="manager">👤 Менеджер</option>
                        <option value="admin">👑 Администратор</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button onClick={() => setEditingAcc(null)}
                        style={{ flex: 1, padding: '11px', background: '#f1f5f9', border: 'none', borderRadius: 980, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Отмена
                      </button>
                      <button onClick={() => handleSaveEdit(acc.login)} disabled={saving}
                        className="btn" style={{ flex: 2, padding: '11px' }}>
                        {saving ? '⏳ Сохранение...' : '💾 Сохранить'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Режим просмотра ── */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{acc.login}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                        {acc.role === 'admin' ? '👑 Администратор' : '👤 Менеджер'} · {acc.manager}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button onClick={() => startEdit(acc)}
                        style={{ background: '#f0f4ff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#4338ca' }}>
                        ✏️ Изменить
                      </button>
                      <button
                        onClick={() => { setChangingPwd(changingPwd === acc.login ? null : acc.login); setNewPwd('') }}
                        style={{ background: '#e0e7ff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#3730a3' }}>
                        🔑 Пароль
                      </button>
                      <button onClick={() => setDelConfirm(acc.login)}
                        style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                        🗑 Удалить
                      </button>
                    </div>
                  </div>

                  {/* Смена пароля */}
                  {changingPwd === acc.login && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <input className="input" type="password" placeholder="Новый пароль" value={newPwd}
                        onChange={e => setNewPwd(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleChangePassword(acc.login)}
                        autoFocus
                        style={{ marginBottom: 0, flex: 1 }} />
                      <button onClick={() => handleChangePassword(acc.login)}
                        style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        Сохранить
                      </button>
                    </div>
                  )}

                  {/* Подтверждение удаления */}
                  {delConfirm === acc.login && (
                    <div style={{ marginTop: 10, background: '#fef2f2', borderRadius: 10, padding: '12px 14px', border: '1px solid #fca5a5' }}>
                      <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600, marginBottom: 10 }}>
                        Удалить аккаунт «{acc.login}»? Действие необратимо.
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setDelConfirm(null)}
                          style={{ flex: 1, padding: '8px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Отмена
                        </button>
                        <button onClick={() => handleDelete(acc.login)}
                          style={{ flex: 1, padding: '8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const AVATARS = ['🏢','✈️','🌴','🌊','🏖️','🌍','🧳','🗺️','🛫','🏝️','⛵','🌅','🌺','🐬','🦋','🎯','🌈','🏄','🎪','🌻']
const SERVICE_ACCOUNT = 'travel-crm-bot@travel-crm-497007.iam.gserviceaccount.com'

function AgencySettings({ show }) {
  const [info,       setInfo]       = useState(null)
  const [form,       setForm]       = useState({ name: '', email: '', avatar: '🏢', sheetUrl: '' })
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [copiedSA,   setCopiedSA]   = useState(false)
  const [changeSheet, setChangeSheet] = useState(false)

  useEffect(() => {
    api.getAgencyInfo().then(r => {
      if (r.success) {
        setInfo(r)
        setForm({ name: r.name || '', email: r.email || '', avatar: r.avatar || '🏢', sheetUrl: '' })
      }
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    if (!form.name.trim()) return show('❌ Введите название агентства', 'error')
    setSaving(true)
    const payload = { name: form.name.trim(), email: form.email.trim(), avatar: form.avatar }
    if (changeSheet && form.sheetUrl.trim()) payload.sheetUrl = form.sheetUrl.trim()
    const r = await api.updateAgencyInfo(payload)
    if (r.success) {
      setInfo(r)
      setForm(f => ({ ...f, sheetUrl: '' }))
      setChangeSheet(false)
      show('✅ Данные агентства обновлены')
    } else {
      show('❌ ' + r.error, 'error')
    }
    setSaving(false)
  }

  function copySlug() {
    if (!info?.slug) return
    navigator.clipboard.writeText(info.slug).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  function copySA() {
    navigator.clipboard.writeText(SERVICE_ACCOUNT).then(() => { setCopiedSA(true); setTimeout(() => setCopiedSA(false), 2000) })
  }

  if (loading) return <div className="loader">⏳ Загрузка...</div>
  if (!info)   return <div style={{ color: '#ef4444', padding: 16 }}>Не удалось загрузить данные</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Код компании */}
      {info.slug && (
        <div style={{ background: '#f0f9ff', border: '2px solid #007aff', borderRadius: 16, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Код компании для входа
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#1e293b', letterSpacing: 2, flex: 1 }}>
              {info.slug}
            </span>
            <button onClick={copySlug} style={{
              background: copied ? '#22c55e' : '#007aff', color: '#fff', border: 'none',
              borderRadius: 10, padding: '8px 18px', cursor: 'pointer', fontSize: 13,
              fontWeight: 700, fontFamily: 'inherit', transition: 'background .2s',
            }}>
              {copied ? '✓ Скопировано' : 'Копировать'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#0369a1', marginTop: 6 }}>
            Сообщите код менеджерам — они вводят его при каждом входе
          </div>
        </div>
      )}

      {/* Форма */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>✏️ Данные агентства</div>

        {/* Аватар */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>Логотип-эмодзи</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AVATARS.map(em => (
              <button key={em} type="button" onClick={() => setForm(f => ({ ...f, avatar: em }))} style={{
                width: 44, height: 44, borderRadius: 12, border: 'none', fontSize: 22, cursor: 'pointer',
                transition: 'all .15s',
                background: form.avatar === em ? 'var(--primary)' : '#f1f5f9',
                boxShadow: form.avatar === em ? '0 2px 8px rgba(0,122,255,0.4)' : 'none',
                transform: form.avatar === em ? 'scale(1.12)' : 'scale(1)',
              }}>{em}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>Название агентства *</div>
            <input className="input" style={{ marginBottom: 0 }}
              value={form.name} placeholder="Название вашего агентства"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>Email</div>
            <input className="input" type="email" style={{ marginBottom: 0 }}
              value={form.email} placeholder="email@example.com"
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </div>

        <button className="btn" style={{ marginTop: 16 }} onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Сохранение...' : '💾 Сохранить'}
        </button>
      </div>

      {/* Таблица */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📊 Google Таблица</div>
        {info.spreadsheetUrl ? (
          <a href={info.spreadsheetUrl} target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', fontSize: 13, color: '#007aff', fontWeight: 600, marginBottom: 12, wordBreak: 'break-all' }}>
            🔗 Открыть таблицу →
          </a>
        ) : (
          <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>⚠️ Таблица не привязана</div>
        )}

        {!changeSheet ? (
          <button onClick={() => setChangeSheet(true)}
            style={{ background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
            🔄 Изменить таблицу
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#92400e' }}>
              <strong>Важно:</strong> Убедитесь что новая таблица доступна сервисному аккаунту как Редактор:
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, background: '#fff', borderRadius: 6, padding: '6px 8px', border: '1px solid #fcd34d' }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', flex: 1, wordBreak: 'break-all', color: '#0369a1' }}>{SERVICE_ACCOUNT}</span>
                <button onClick={copySA}
                  style={{ background: copiedSA ? '#22c55e' : '#007aff', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', flexShrink: 0 }}>
                  {copiedSA ? '✓' : 'Копировать'}
                </button>
              </div>
            </div>
            <input className="input" style={{ marginBottom: 0, fontSize: 13 }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={form.sheetUrl}
              onChange={e => setForm(f => ({ ...f, sheetUrl: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setChangeSheet(false); setForm(f => ({ ...f, sheetUrl: '' })) }}
                style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                Отмена
              </button>
              <button className="btn" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Проверка...' : '🔗 Привязать таблицу'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Settings({ session }) {
  const isAdmin = session?.role === 'admin'
  const [tab, setTab] = useState(isAdmin ? 'agency' : 'directions')
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
  async function renameDirection(oldName, newName) {
    const r = await api.renameDirection(oldName, newName)
    if (r.success) { setDirections(r.items); show(`✅ Переименовано`) }
    else show('❌ ' + r.error, 'error')
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
  async function renameHotel(oldName, newName) {
    const r = await api.renameHotel(oldName, newName)
    if (r.success) { setHotels(r.items); show(`✅ Переименовано`) }
    else show('❌ ' + r.error, 'error')
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
  async function renameSource(oldName, newName) {
    const r = await api.renameSource(oldName, newName)
    if (r.success) { setSources(r.items); show(`✅ Переименовано`) }
    else show('❌ ' + r.error, 'error')
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
    ...(isAdmin ? [{ id: 'agency',     label: '🏢 Агентство',  count: null }] : []),
    { id: 'directions', label: '🌍 Направления', count: directions.length },
    { id: 'hotels',     label: '🏨 Отели',       count: hotels.length     },
    { id: 'sources',    label: '📣 Источники',   count: sources.length    },
    ...(isAdmin ? [{ id: 'accounts',   label: '👤 Аккаунты',   count: null }] : []),
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

      {tab === 'agency' && isAdmin && (
        <div className="card">
          <div className="card-title">🏢 Настройки агентства</div>
          <AgencySettings show={show} />
        </div>
      )}

      {tab === 'directions' && (
        <div className="card">
          <div className="card-title">🌍 Управление направлениями</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Направления отображаются в форме добавления продажи как выпадающий список.
          </p>
          <ListManager icon="🌍" items={directions} onAdd={addDirection} onDelete={deleteDirection} onRename={renameDirection}
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
          <ListManager icon="📣" items={sources} onAdd={addSource} onDelete={deleteSource} onRename={renameSource}
            placeholder="Например: Instagram, Telegram..." />
        </div>
      )}

      {tab === 'hotels' && (
        <div className="card">
          <div className="card-title">🏨 Свои отели</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            160+ популярных отелей уже встроены в форму. Здесь добавляйте любые отели, которых нет в списке.
          </p>
          <ListManager icon="🏨" items={hotels} onAdd={addHotel} onDelete={deleteHotel} onRename={renameHotel}
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
