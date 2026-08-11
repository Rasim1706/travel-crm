import { useState } from 'react'
import { api } from '../api'

export default function Register({ onRegister, onBack }) {
  const [agencyName,       setAgencyName]       = useState('')
  const [email,            setEmail]            = useState('')
  const [login,            setLogin]            = useState('')
  const [password,         setPassword]         = useState('')
  const [confirm,          setConfirm]          = useState('')
  const [existingSheetUrl, setExistingSheetUrl] = useState('')
  const [showRestore,      setShowRestore]      = useState(false)
  const [error,            setError]            = useState('')
  const [loading,          setLoading]          = useState(false)
  const [success,          setSuccess]          = useState(null)

  async function handleRegister() {
    if (!agencyName.trim() || !login.trim() || !password || !confirm) {
      setError('Заполните все обязательные поля'); return
    }
    if (password.length < 4) {
      setError('Пароль должен быть минимум 4 символа'); return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают'); return
    }
    setLoading(true); setError('')
    try {
      const r = await api.register({
        agencyName, login, password,
        email: email.trim() || undefined,
        existingSheetUrl: existingSheetUrl.trim() || undefined,
      })
      if (r.success) {
        setSuccess(r)
        sessionStorage.setItem('crm_token',        r.token)
        sessionStorage.setItem('crm_role',         r.role)
        sessionStorage.setItem('crm_name',         r.name)
        sessionStorage.setItem('crm_agency_id',    r.agencyId)
        sessionStorage.setItem('crm_spreadsheet',  r.spreadsheetId)
        // Небольшая задержка чтобы пользователь увидел ссылку на таблицу
        setTimeout(() => onRegister({ token: r.token, role: r.role, name: r.name, agencyId: r.agencyId, spreadsheetId: r.spreadsheetId }), 3000)
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

  if (success) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)', padding: 20,
      }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: '40px 32px', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Агентство создано!</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>Ваша таблица Google Sheets готова</p>

          <a
            href={success.spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block', padding: '14px 20px', background: '#f0fdf4',
              border: '1.5px solid #86efac', borderRadius: 14, textDecoration: 'none',
              color: '#166534', fontSize: 14, fontWeight: 600, marginBottom: 20,
            }}
          >
            📊 Открыть мою таблицу →
          </a>

          <div style={{ fontSize: 12, color: 'var(--muted)', background: '#f8fafc', borderRadius: 10, padding: '10px 14px', marginBottom: 20, textAlign: 'left' }}>
            <strong>Сохраните ссылку на таблицу!</strong><br />
            Если захотите перенести данные на другой хостинг — просто вставьте эту ссылку при регистрации и все данные восстановятся.<br /><br />
            <span style={{ fontSize: 11, wordBreak: 'break-all', color: '#64748b' }}>{success.spreadsheetUrl}</span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Входим в систему через 3 секунды…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '40px 32px',
        width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🏢</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#1e293b' }}>
            Регистрация агентства
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, marginBottom: 0 }}>
            Для каждого агентства создаётся отдельная Google Таблица
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Агентство */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Информация об агентстве
          </div>
          <input
            className="input"
            placeholder="Название агентства *"
            value={agencyName}
            onChange={e => { setAgencyName(e.target.value); setError('') }}
            style={{ marginBottom: 0 }}
          />
          <input
            className="input"
            type="email"
            placeholder="Email (получите доступ к таблице)"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            style={{ marginBottom: 0 }}
          />

          {/* Аккаунт */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 }}>
            Аккаунт администратора
          </div>
          <input
            className="input"
            placeholder="Логин *"
            value={login}
            autoComplete="username"
            onChange={e => { setLogin(e.target.value); setError('') }}
            style={{ marginBottom: 0 }}
          />
          <input
            className="input"
            type="password"
            placeholder="Пароль * (мин. 4 символа)"
            value={password}
            autoComplete="new-password"
            onChange={e => { setPassword(e.target.value); setError('') }}
            style={{ marginBottom: 0 }}
          />
          <input
            className="input"
            type="password"
            placeholder="Подтвердите пароль *"
            value={confirm}
            autoComplete="new-password"
            onChange={e => { setConfirm(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && !showRestore && handleRegister()}
            style={{ marginBottom: 0, borderColor: pwdMismatch ? '#ef4444' : undefined }}
          />
          {pwdMismatch && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: -4 }}>Пароли не совпадают</div>
          )}

          {/* Восстановление из существующей таблицы */}
          <button
            onClick={() => setShowRestore(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--primary)', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', textAlign: 'left', padding: '4px 0', marginTop: 4,
            }}
          >
            {showRestore ? '▼' : '▶'} Восстановить данные из существующей таблицы
          </button>

          {showRestore && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: '#0369a1', marginBottom: 8 }}>
                Если у вас уже есть Google Таблица с данными — вставьте её ссылку. Откройте доступ для: <strong>travel-crm-bot@travel-crm-497007.iam.gserviceaccount.com</strong>
              </div>
              <input
                className="input"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={existingSheetUrl}
                onChange={e => { setExistingSheetUrl(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
                style={{ marginBottom: 0, fontSize: 13 }}
              />
            </div>
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
          disabled={loading || !!pwdMismatch}
        >
          {loading ? '⏳ Создание таблицы и аккаунта...' : '🏢 Зарегистрировать агентство'}
        </button>

        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Уже есть аккаунт? </span>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--primary)', fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit', padding: 0,
            }}
          >
            Войти →
          </button>
        </div>
      </div>
    </div>
  )
}
