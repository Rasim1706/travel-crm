import { useState } from 'react'
import { api } from '../api'

const SERVICE_ACCOUNT = 'travel-crm-bot@travel-crm-497007.iam.gserviceaccount.com'

export default function Register({ onRegister, onBack }) {
  const AVATARS = ['🏢','✈️','🌴','🌊','🏖️','🌍','🧳','🗺️','🛫','🏝️','⛵','🌅']

  const [agencyName, setAgencyName] = useState('')
  const [avatar,     setAvatar]     = useState('🏢')
  const [email,      setEmail]      = useState('')
  const [login,      setLogin]      = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [sheetUrl,    setSheetUrl]    = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(null)
  const [copied,      setCopied]      = useState(false)
  const [copiedSlug,  setCopiedSlug]  = useState(false)

  function copyEmail() {
    navigator.clipboard.writeText(SERVICE_ACCOUNT).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function copySlug(slug) {
    navigator.clipboard.writeText(slug).then(() => {
      setCopiedSlug(true)
      setTimeout(() => setCopiedSlug(false), 2000)
    })
  }

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
    if (!sheetUrl.trim()) {
      setError('Вставьте ссылку на Google Таблицу'); return
    }
    setLoading(true); setError('')
    try {
      const r = await api.register({
        agencyName, login, password, avatar,
        email: email.trim() || undefined,
        sheetUrl: sheetUrl.trim(),
      })
      if (r.success) {
        setSuccess(r)
        sessionStorage.setItem('crm_token',       r.token)
        sessionStorage.setItem('crm_role',        r.role)
        sessionStorage.setItem('crm_name',        r.name)
        sessionStorage.setItem('crm_agency_id',   r.agencyId)
        sessionStorage.setItem('crm_spreadsheet', r.spreadsheetId)
        setTimeout(() => onRegister({
          token: r.token, role: r.role, name: r.name,
          agencyId: r.agencyId, spreadsheetId: r.spreadsheetId,
        }), 3000)
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
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Агентство зарегистрировано!</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>Таблица подключена и готова к работе</p>

          {success.slug && (
            <div style={{ background: '#f0f9ff', border: '2px solid #007aff', borderRadius: 16, padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Ваш код компании для входа
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#1e293b', flex: 1, letterSpacing: 1 }}>
                  {success.slug}
                </span>
                <button
                  onClick={() => copySlug(success.slug)}
                  style={{ background: copiedSlug ? '#22c55e' : '#007aff', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'background .2s', flexShrink: 0 }}
                >
                  {copiedSlug ? '✓ Скопировано' : 'Копировать'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: '#0369a1', marginTop: 8 }}>
                Сохраните этот код — он нужен при каждом входе в систему
              </div>
            </div>
          )}

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
        width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🏢</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#1e293b' }}>
            Регистрация агентства
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
            Ваши данные хранятся в вашей Google Таблице
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Шаг 1: Таблица ── */}
          <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 16, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0369a1', marginBottom: 10 }}>
              📋 Шаг 1 — Подготовьте Google Таблицу
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ background: '#007aff', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>1</span>
                <div style={{ fontSize: 13, color: '#0c4a6e' }}>
                  Откройте{' '}
                  <a href="https://sheets.google.com" target="_blank" rel="noreferrer"
                    style={{ color: '#007aff', fontWeight: 700 }}>
                    sheets.google.com
                  </a>{' '}
                  и создайте новую таблицу (любое название)
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ background: '#007aff', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>2</span>
                <div style={{ fontSize: 13, color: '#0c4a6e' }}>
                  Нажмите <strong>«Настройки доступа»</strong> → добавьте этот email как <strong>Редактор</strong>:
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, background: '#fff', borderRadius: 8, padding: '7px 10px', border: '1px solid #bae6fd' }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', flex: 1, wordBreak: 'break-all', color: '#0369a1' }}>
                      {SERVICE_ACCOUNT}
                    </span>
                    <button onClick={copyEmail}
                      style={{ background: copied ? '#22c55e' : '#007aff', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700, flexShrink: 0, fontFamily: 'inherit', transition: 'background .2s' }}>
                      {copied ? '✓' : 'Копировать'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ background: '#007aff', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>3</span>
                <div style={{ fontSize: 13, color: '#0c4a6e' }}>
                  Скопируйте ссылку из адресной строки браузера и вставьте ниже
                </div>
              </div>
            </div>

            <input
              className="input"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={e => { setSheetUrl(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              style={{ marginTop: 10, marginBottom: 0, fontSize: 13,
                borderColor: sheetUrl.trim() && !sheetUrl.includes('/spreadsheets/') ? '#ef4444' : undefined }}
            />
            {sheetUrl.trim() && !sheetUrl.includes('/spreadsheets/') && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                Неверная ссылка — скопируйте полный URL из браузера
              </div>
            )}
          </div>

          {/* ── Шаг 2: Данные агентства ── */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 }}>
            📋 Шаг 2 — Данные агентства
          </div>

          {/* Аватарка */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Логотип-эмодзи</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AVATARS.map(em => (
                <button key={em} type="button" onClick={() => setAvatar(em)}
                  style={{
                    width: 42, height: 42, borderRadius: 12, border: 'none',
                    fontSize: 22, cursor: 'pointer', transition: 'all .15s',
                    background: avatar === em ? 'var(--primary)' : '#f1f5f9',
                    boxShadow: avatar === em ? '0 2px 8px rgba(0,122,255,0.4)' : 'none',
                    transform: avatar === em ? 'scale(1.12)' : 'scale(1)',
                  }}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          <input className="input" placeholder="Название агентства *"
            value={agencyName} onChange={e => { setAgencyName(e.target.value); setError('') }}
            style={{ marginBottom: 0 }} />

          <input className="input" type="email" placeholder="Email (необязательно)"
            value={email} onChange={e => { setEmail(e.target.value); setError('') }}
            style={{ marginBottom: 0 }} />

          {/* ── Шаг 3: Аккаунт ── */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 }}>
            🔐 Шаг 3 — Аккаунт администратора
          </div>

          <input className="input" placeholder="Логин *"
            value={login} autoComplete="username"
            onChange={e => { setLogin(e.target.value); setError('') }}
            style={{ marginBottom: 0 }} />

          <input className="input" type="password" placeholder="Пароль * (мин. 4 символа)"
            value={password} autoComplete="new-password"
            onChange={e => { setPassword(e.target.value); setError('') }}
            style={{ marginBottom: 0 }} />

          <input className="input" type="password" placeholder="Подтвердите пароль *"
            value={confirm} autoComplete="new-password"
            onChange={e => { setConfirm(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            style={{ marginBottom: 0, borderColor: pwdMismatch ? '#ef4444' : undefined }} />
          {pwdMismatch && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: -4 }}>Пароли не совпадают</div>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 14px', background: '#fef2f2',
            border: '1px solid #fca5a5', borderRadius: 10,
            fontSize: 13, color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        <button className="btn" style={{ marginTop: 16 }}
          onClick={handleRegister} disabled={loading || !!pwdMismatch}>
          {loading ? '⏳ Проверка таблицы...' : '🚀 Зарегистрировать агентство'}
        </button>

        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Уже есть аккаунт? </span>
          <button onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>
            Войти →
          </button>
        </div>
      </div>
    </div>
  )
}
