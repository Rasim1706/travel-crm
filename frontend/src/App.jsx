import { useState } from 'react'
import SaleForm  from './pages/SaleForm'
import Dashboard from './pages/Dashboard'
import Managers  from './pages/Managers'

const TABS = [
  { id: 'form', label: '📝 Новая запись' },
  { id: 'dash', label: '📊 Дашборд'     },
  { id: 'mgr',  label: '👥 Менеджеры'   },
]

export default function App() {
  const [active,     setActive]     = useState('form')
  const [dashKey,    setDashKey]    = useState(0)

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
      </header>

      <nav className="tabs">
        {TABS.map(tab => (
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
        {active === 'form' && <SaleForm  />}
        {active === 'dash' && <Dashboard key={dashKey} />}
        {active === 'mgr'  && <Managers  />}
      </main>
    </>
  )
}
