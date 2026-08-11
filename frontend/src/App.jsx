import { useState } from 'react'
import Login     from './pages/Login'
import Register  from './pages/Register'
import SaleForm  from './pages/SaleForm'
import Dashboard from './pages/Dashboard'
import Clients   from './pages/Clients'
import Settings  from './pages/Settings'
import Finances  from './pages/Finances'

const ALL_TABS = [
  { id: 'form',     label: '📝 Новая запись' },
  { id: 'dash',     label: '📊 Дашборд'      },
  { id: 'finances', label: '💰 Финансы'      },
  { id: 'clients',  label: '👤 Клиенты'      },
  { id: 'settings', label: '⚙️ Настройки'    },
]

// Менеджер видит только эти вкладки
const MANAGER_TABS = new Set(['form', 'dash'])

function readSession() {
  const token    = sessionStorage.getItem('crm_token')
  const role     = sessionStorage.getItem('crm_role')
  const name     = sessionStorage.getItem('crm_name')
  const agencyId = sessionStorage.getItem('crm_agency_id') || 'default'
  if (token && role) return { token, role, name, agencyId }
  return null
}

export default function App() {
  const [session,  setSession]  = useState(readSession)
  const [active,   setActive]   = useState('form')
  const [dashKey,  setDashKey]  = useState(0)
  const [authPage, setAuthPage] = useState('login') // 'login' | 'register'

  function handleLogin(sess) {
    sessionStorage.setItem('crm_agency_id', sess.agencyId || 'default')
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{session.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
              {isAdmin ? '👑 Администратор' : '👤 Менеджер'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10,
              padding: '6px 12px', color: '#fff', fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            Выйти
          </button>
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

      <main className="main">
        {active === 'form'     && <SaleForm  session={session} />}
        {active === 'dash'     && <Dashboard key={dashKey} session={session} />}
        {active === 'finances' && <Finances />}
        {active === 'clients'  && <Clients />}
        {active === 'settings' && <Settings  session={session} />}
      </main>
    </>
  )
}
