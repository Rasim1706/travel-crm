import { useState, useEffect } from 'react'

const DEV_TOKEN_KEY = 'dev_crm_token'

function devCall(url, options = {}) {
  const token = sessionStorage.getItem(DEV_TOKEN_KEY) || ''
  return fetch(url, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    ...options,
  }).then(r => r.json())
}

function DevLogin({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin() {
    if (!password) return
    setLoading(true); setError('')
    const r = await fetch('/api/dev/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).then(r => r.json())
    if (r.success) {
      sessionStorage.setItem(DEV_TOKEN_KEY, r.token)
      onLogin()
    } else {
      setError(r.error || 'Неверный пароль')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: 20,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 20, padding: '40px 32px',
        width: '100%', maxWidth: 360, border: '1px solid #334155',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🛠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>
            Dev Panel
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
            Только для разработчика
          </p>
        </div>

        <input
          type="password"
          placeholder="Пароль разработчика"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 12,
            border: `1.5px solid ${error ? '#ef4444' : '#334155'}`,
            background: '#0f172a', color: '#f1f5f9', fontSize: 15,
            fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12,
            outline: 'none',
          }}
        />

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, fontSize: 13, color: '#fca5a5', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none',
            background: loading ? '#334155' : '#3b82f6', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <a href="/" style={{ color: '#64748b', fontSize: 13, textDecoration: 'none' }}>
            ← Обычный вход
          </a>
        </div>
      </div>
    </div>
  )
}

function AgencyCard({ agency, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const [confirm,  setConfirm]  = useState(false)

  async function handleDelete() {
    if (!confirm) { setConfirm(true); return }
    setDeleting(true)
    const r = await devCall(`/api/dev/agencies/${encodeURIComponent(agency.id)}`, { method: 'DELETE' })
    if (r.success) onDelete(agency.id)
    setDeleting(false)
  }

  const date = agency.createdAt ? new Date(agency.createdAt).toLocaleDateString('ru-RU') : '—'

  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
      padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      {/* Avatar */}
      <div style={{
        width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, flexShrink: 0,
      }}>
        {agency.avatar}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9', marginBottom: 4 }}>
          {agency.name}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {agency.email && <span>📧 {agency.email}</span>}
          <span>👤 {agency.accountCount} аккаунтов</span>
          <span>📅 {date}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {agency.spreadsheetUrl && (
          <a
            href={agency.spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '8px 14px', borderRadius: 10, background: '#0f172a',
              border: '1px solid #334155', color: '#94a3b8', fontSize: 13,
              fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            📊 Таблица
          </a>
        )}
        {agency.id !== 'default' && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: confirm ? '#7f1d1d' : '#0f172a',
              borderColor: confirm ? '#ef4444' : '#334155',
              borderWidth: 1, borderStyle: 'solid',
              color: confirm ? '#fca5a5' : '#94a3b8',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            {deleting ? '...' : confirm ? '⚠️ Подтвердить' : '✕ Удалить'}
          </button>
        )}
        {confirm && !deleting && (
          <button
            onClick={() => setConfirm(false)}
            style={{
              padding: '8px 14px', borderRadius: 10, border: '1px solid #334155',
              background: '#0f172a', color: '#94a3b8', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Отмена
          </button>
        )}
      </div>
    </div>
  )
}

function DevDashboard({ onLogout }) {
  const [agencies, setAgencies] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    devCall('/api/dev/agencies')
      .then(r => {
        if (r.success) setAgencies(r.agencies)
        else setError(r.error)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 28 }}>🛠️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#f1f5f9' }}>Dev Admin Panel</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Управление всеми агентствами</div>
        </div>
        <a href="/" style={{ color: '#64748b', fontSize: 13, textDecoration: 'none', marginRight: 8 }}>
          ← CRM
        </a>
        <button
          onClick={onLogout}
          style={{
            padding: '8px 16px', borderRadius: 10, border: '1px solid #334155',
            background: '#0f172a', color: '#94a3b8', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Выйти
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Агентств', value: agencies.filter(a => a.id !== 'default').length, icon: '🏢' },
            { label: 'Аккаунтов', value: agencies.reduce((s, a) => s + a.accountCount, 0), icon: '👤' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: 14,
              padding: '16px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{stat.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9' }}>{stat.value}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Agencies list */}
        <div style={{ marginBottom: 16, fontWeight: 700, fontSize: 15, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 }}>
          Зарегистрированные агентства
        </div>

        {loading && <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>Загрузка...</div>}
        {error   && <div style={{ color: '#fca5a5', textAlign: 'center', padding: 40 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agencies.map(agency => (
            <AgencyCard
              key={agency.id}
              agency={agency}
              onDelete={id => setAgencies(prev => prev.filter(a => a.id !== id))}
            />
          ))}
          {!loading && agencies.length === 0 && (
            <div style={{ color: '#64748b', textAlign: 'center', padding: 60 }}>
              Нет зарегистрированных агентств
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DevAdmin() {
  const [loggedIn, setLoggedIn] = useState(!!sessionStorage.getItem(DEV_TOKEN_KEY))

  function handleLogout() {
    sessionStorage.removeItem(DEV_TOKEN_KEY)
    setLoggedIn(false)
  }

  if (!loggedIn) return <DevLogin onLogin={() => setLoggedIn(true)} />
  return <DevDashboard onLogout={handleLogout} />
}
