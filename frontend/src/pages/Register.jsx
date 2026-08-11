import { useState } from 'react'
import { api } from '../api'

export default function Register({ onRegister, onBack }) {
  const [agencyName, setAgencyName] = useState('')
  const [login,      setLogin]      = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)

  async function handleRegister() {
    if (!agencyName.trim() || !login.trim() || !password || !confirm) {
      setError('Заполните все поля'); return
    }
    if (password.length < 4) {
      setError('Пароль должен быть минимум 4 символа'); return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают'); return
    }
    setLoading(true); setError('')
    try {
      const r = await api.register({ agencyName, login, password })
      if (r.success) {
        sessionStorage.setItem('crm_token',     r.token)
        sessionStorage.setItem('crm_role',      r.role)
        sessionStorage.setItem('crm_name',      r.name)
        sessionStorage.setItem('crm_agency_id', r.agencyId)
        onRegister({ token: r.token, role: r.role, name: r.name, agencyId: r.agencyId })
      } else {
        setError(r.error || 'Ошибка регистрации')
      }
    } catch {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const pwdMismatch = confirm && confirm !== password

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
      padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '40px 32px',
        width: '100%', maxWidth: 400,
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🏢</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#1e293b' }}>
            Регистрация агентства
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, marginBottom: 0 }}>
            Создайте аккаунт для своего турагентства
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>
              Название агентства
            </label>
            <input
              className="input"
              placeholder="Например: Sunny Travel"
              value={agencyName}
              onChange={e => { setAgencyName(e.target.value); setError('') }}
              style={{ marginBottom: 0 }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>
              Аккаунт администратора
            </label>
          </div>

          <input
            className="input"
            placeholder="Логин (уникальный)"
            value={login}
            autoComplete="username"
            onChange={e => { setLogin(e.target.value); setError('') }}
            style={{ marginBottom: 0 }}
          />
          <input
            className="input"
            type="password"
            placeholder="Пароль"
            value={password}
            autoComplete="new-password"
            onChange={e => { setPassword(e.target.value); setError('') }}
            style={{ marginBottom: 0 }}
          />
          <input
            className="input"
            type="password"
            placeholder="Подтвердите пароль"
            value={confirm}
            autoComplete="new-password"
            onChange={e => { setConfirm(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            style={{ marginBottom: 0, borderColor: pwdMismatch ? '#ef4444' : undefined }}
          />
          {pwdMismatch && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: -4 }}>Пароли не совпадают</div>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: 12, padding: '8px 12px', background: '#fef2f2',
            border: '1px solid #fca5a5', borderRadius: 10,
            fontSize: 13, color: '#dc2626', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <button
          className="btn"
          style={{ marginTop: 16 }}
          onClick={handleRegister}
          disabled={loading || pwdMismatch}
        >
          {loading ? '⏳ Создание агентства...' : '🏢 Зарегистрировать агентство'}
        </button>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--primary)', fontSize: 14, fontWeight: 600,
              fontFamily: 'inherit', padding: '4px 8px',
            }}
          >
            ← Войти в существующий аккаунт
          </button>
        </div>

        <div style={{
          marginTop: 16, padding: '10px 14px', background: '#f0fdf4',
          border: '1px solid #bbf7d0', borderRadius: 10,
          fontSize: 12, color: '#166534',
        }}>
          После регистрации вы автоматически войдёте как администратор и сможете добавить менеджеров в Настройках → Аккаунты.
        </div>
      </div>
    </div>
  )
}
