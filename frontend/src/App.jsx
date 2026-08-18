import { useState, useRef, useEffect } from 'react'
import Login       from './pages/Login'
import Register    from './pages/Register'
import DevAdmin    from './pages/DevAdmin'
import SaleForm    from './pages/SaleForm'
import DoplatForm  from './pages/DoplatForm'
import Dashboard   from './pages/Dashboard'
import Clients     from './pages/Clients'
import Settings    from './pages/Settings'
import Finances    from './pages/Finances'

// Если URL начинается с /dev — показываем dev-панель
if (window.location.pathname.startsWith('/dev')) {
  // DevAdmin рендерится ниже через ветку
}

const ALL_TABS = [
  { id: 'form',     label: '📝 Новая запись' },
  { id: 'dash',     label: '📊 Дашборд'      },
  { id: 'finances', label: '💰 Финансы'      },
  { id: 'clients',  label: '👤 Клиенты'      },
  { id: 'settings', label: '⚙️ Настройки'    },
]

const MANAGER_TABS = new Set(['form', 'dash'])

function readSession() {
  const token         = sessionStorage.getItem('crm_token')
  const role          = sessionStorage.getItem('crm_role')
  const name          = sessionStorage.getItem('crm_name')
  const agencyId      = sessionStorage.getItem('crm_agency_id') || 'default'
  const spreadsheetId = sessionStorage.getItem('crm_spreadsheet') || ''
  const avatar        = sessionStorage.getItem('crm_avatar') || '🏢'
  if (token && role) return { token, role, name, agencyId, spreadsheetId, avatar }
  return null
}

// Аватарка пользователя с дропдауном
function UserMenu({ session, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isAdmin = session.role === 'admin'
  const spreadsheetUrl = session.spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${session.spreadsheetId}/edit`
    : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 14,
          padding: '6px 12px 6px 8px', color: '#fff', fontFamily: 'inherit',
          transition: 'background .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
      >
        {/* Аватарка агентства */}
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>
          {session.avatar || '🏢'}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{session.name}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>
            {isAdmin ? 'Владелец' : 'Менеджер'}
          </div>
        </div>
        <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          background: '#fff', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          border: '1px solid var(--border)', minWidth: 220, zIndex: 9999,
          overflow: 'hidden',
        }}>
          {/* Header дропдауна */}
          <div style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{session.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {isAdmin ? '👑 Владелец агентства' : '👤 Менеджер'}
            </div>
          </div>

          {/* Ссылка на таблицу */}
          {isAdmin && spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', textDecoration: 'none', color: 'var(--text)',
                fontSize: 14, borderBottom: '1px solid var(--border)',
                transition: 'background .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 18 }}>📊</span>
              <span>Моя таблица Google Sheets</span>
            </a>
          )}

          {/* Выход */}
          <button
            onClick={() => { setOpen(false); onLogout() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '12px 16px', border: 'none', background: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
              color: '#ef4444', fontWeight: 600, textAlign: 'left',
              transition: 'background .1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 18 }}>🚪</span>
            <span>Выйти из аккаунта</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  // Dev-панель — отдельный маршрут
  if (window.location.pathname.startsWith('/dev')) {
    return <DevAdmin />
  }

  const [session,   setSession]   = useState(readSession)
  const [active,    setActive]    = useState('form')
  const [formMode,  setFormMode]  = useState('sale') // 'sale' | 'doplat'
  const [dashKey,   setDashKey]   = useState(0)
  const [authPage,  setAuthPage]  = useState('login')

  function handleLogin(sess) {
    sessionStorage.setItem('crm_agency_id',   sess.agencyId || 'default')
    sessionStorage.setItem('crm_spreadsheet', sess.spreadsheetId || '')
    sessionStorage.setItem('crm_avatar',      sess.avatar || '🏢')
    setSession(sess)
    setActive('form')
    setAuthPage('login')
  }

  function handleLogout() {
    sessionStorage.clear()
    setSession(null)
    setActive('form')
    setAuthPage('login')
  }

  if (!session) {
    if (authPage === 'register') {
      return <Register onRegister={handleLogin} onBack={() => setAuthPage('login')} />
    }
    return <Login onLogin={handleLogin} onRegister={() => setAuthPage('register')} />
  }

  const isAdmin = session.role === 'admin'
  const tabs    = ALL_TABS.filter(t => isAdmin || MANAGER_TABS.has(t.id))

  function switchTab(id) {
    if (id === 'dash') setDashKey(k => k + 1)
    setActive(id)
  }

  return (
    <>
      <header className="header">
        <span className="header-logo">✈️</span>
        <div>
          <h1>Турагентство — Отдел продаж</h1>
          <span>CRM система</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <UserMenu session={session} onLogout={handleLogout} />
        </div>
      </header>

      <nav className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            data-tab={tab.id}
            className={`tab${active === tab.id ? ' tab--active' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className={`main${active === 'dash' ? ' main--wide' : ''}`}>
        {active === 'form' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'var(--card)', borderRadius: 14, padding: 6, width: 'fit-content', border: '1px solid var(--border)' }}>
              {[['sale', '📝 Продажа'], ['doplat', '💳 Доплата']].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setFormMode(mode)}
                  style={{
                    padding: '8px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 14, fontFamily: 'inherit', transition: 'all .15s',
                    background: formMode === mode ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : 'transparent',
                    color: formMode === mode ? '#fff' : 'var(--muted)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {formMode === 'sale'   && <SaleForm   session={session} />}
            {formMode === 'doplat' && <DoplatForm session={session} />}
          </>
        )}
        {active === 'dash'     && <Dashboard key={dashKey} session={session} />}
        {active === 'finances' && <Finances />}
        {active === 'clients'  && <Clients />}
        {active === 'settings' && <Settings  session={session} />}
      </main>
    </>
  )
}
