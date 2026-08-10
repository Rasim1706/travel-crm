import { useState } from 'react'
import { api } from '../api'

export default function Login({ onLogin }) {
  const [login,    setLogin]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin() {
    if (!login.trim() || !password) { setError('Заполните все поля'); return }
    setLoading(true)
    setError('')
    try {
      const r = await api.login(login.trim(), password)
      if (r.success) {
        sessionStorage.setItem('crm_token', r.token)
        sessionStorage.setItem('crm_role',  r.role)
        sessionStorage.setItem('crm_name',  r.name)
        onLogin({ token: r.token, role: r.role, name: r.name })
      } else {
        setError(r.error || 'Неверный логин или пароль')
      }
    } catch {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
      padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '40px 32px',
        width: '100%', maxWidth: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>✈️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#1e293b' }}>
            Турагентство CRM
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, marginBottom: 0 }}>
            Войдите в свой аккаунт
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="input"
            type="text"
            placeholder="Логин"
            value={login}
            autoComplete="username"
            onChange={e => { setLogin(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && document.getElementById('pwd-input')?.focus()}
            style={{ marginBottom: 0 }}
          />
          <input
            id="pwd-input"
            className="input"
            type="password"
            placeholder="Пароль"
            value={password}
            autoComplete="current-password"
            onChange={e => { setPassword(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ marginBottom: 0, borderColor: error ? '#ef4444' : undefined }}
          />
        </div>

        {error && (
          <div style={{
            marginTop: 10, padding: '8px 12px', background: '#fef2f2',
            border: '1px solid #fca5a5', borderRadius: 10,
            fontSize: 13, color: '#dc2626', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <button
          className="btn"
          style={{ marginTop: 16 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? '⏳ Вход...' : 'Войти'}
        </button>

        <div style={{ marginTop: 20, padding: '12px', background: '#f8fafc', borderRadius: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
          Первый вход: <strong>admin / 1234</strong>
        </div>
      </div>
    </div>
  )
}
