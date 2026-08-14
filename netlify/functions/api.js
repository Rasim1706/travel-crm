const serverless = require('serverless-http')
const express    = require('express')
const crypto     = require('crypto')

const app = express()
app.use(express.json())

const MASTER_SPREADSHEET_ID = '1EcmuWFgyBLp3BH5RxWC50iAmTarnz9dosFZnE7ZQQlY'
const DEV_SECRET     = process.env.DEV_SECRET || 'rasim-dev-2026'
const AUTH_SECRET    = process.env.AUTH_SECRET || 'crm-2026-secret-key'

const SALES_SHEET      = 'Продажи'
const DIRECTIONS_SHEET = 'Направления'
const HOTELS_SHEET     = 'Отели'
const SOURCES_SHEET    = 'Источники'
const ACCOUNTS_SHEET   = 'Аккаунты'
const AGENCIES_SHEET   = 'Агентства'
const AGENCIES_HEADERS = ['AgencyID', 'Название', 'Email', 'SpreadsheetID', 'SpreadsheetURL', 'Дата', 'Avatar', 'Slug']

const MONTH_NAMES_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const SALE_HEADERS = [
  'Дата','Номер договора','Менеджер','Кол-во продаж','Дата брони',
  'Клиент','Направление','Отель','Телефон','Источник',
  'Сумма','Валюта','Комиссия ($)','Скидка ($)','Остаток ($)',
  'Курс','Нетто','Предоплата','Долг клиента',
  'Способ оплаты','Сумма UZS','Сумма USD ($)',
  'Дата вылета','Дата прилета','Срок оплаты остатка',
]

function currentMonthSheet() {
  const d = new Date()
  return `${MONTH_NAMES_RU[d.getMonth()]} ${d.getFullYear()}`
}
function isSalesSheet(title) {
  return title === SALES_SHEET || MONTH_NAMES_RU.some(m => title.startsWith(m + ' '))
}

// ── Google Auth (raw JWT + fetch, no googleapis) ──────
function loadCreds() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
  try { return require('../../backend/credentials.json') } catch {}
  throw new Error('Google credentials not configured')
}

let _tokenCache = null
async function getGoogleToken() {
  if (_tokenCache && _tokenCache.exp > Date.now() + 60000) return _tokenCache.token
  const creds = loadCreds()
  const now   = Math.floor(Date.now() / 1000)
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  })).toString('base64url')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const sig = sign.sign(creds.private_key, 'base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${payload}.${sig}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Google auth failed: ' + JSON.stringify(data))
  _tokenCache = { token: data.access_token, exp: (now + 3500) * 1000 }
  return data.access_token
}

// ── Sheets REST helpers (dynamic spreadsheetId) ──────
function sheetsBase(spreadsheetId) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`
}
async function sheetsMeta(tok, spreadsheetId) {
  const r = await fetch(sheetsBase(spreadsheetId), { headers: { Authorization: `Bearer ${tok}` } })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error))
  return d
}
async function sheetsGet(tok, spreadsheetId, range) {
  const r = await fetch(`${sheetsBase(spreadsheetId)}/values/${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${tok}` },
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error))
  return d
}
async function sheetsAppend(tok, spreadsheetId, range, values) {
  const r = await fetch(`${sheetsBase(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error))
  return d
}
async function sheetsUpdate(tok, spreadsheetId, range, values) {
  const r = await fetch(`${sheetsBase(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error))
  return d
}
async function sheetsBatchUpdate(tok, spreadsheetId, requests) {
  const r = await fetch(`${sheetsBase(spreadsheetId)}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error))
  return d
}
async function sheetsBatchGetValues(tok, spreadsheetId, data) {
  const r = await fetch(`${sheetsBase(spreadsheetId)}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error))
  return d
}

async function ensureSheet(tok, meta, spreadsheetId, title, headers) {
  const exists = meta.sheets.find(s => s.properties.title === title)
  if (!exists) {
    await sheetsBatchUpdate(tok, spreadsheetId, [{ addSheet: { properties: { title } } }])
    await sheetsUpdate(tok, spreadsheetId, `${title}!A1`, [headers])
  }
}

// ── JWT auth ─────────────────────────────────────────
const hashPwd = p => crypto.createHash('sha256').update(String(p)).digest('hex')

function signToken(payload) {
  const d = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 12 * 3600_000 })).toString('base64url')
  const s = crypto.createHmac('sha256', AUTH_SECRET).update(d).digest('base64url')
  return `${d}.${s}`
}
function verifyToken(token) {
  if (!token) return null
  const i = token.lastIndexOf('.')
  if (i < 0) return null
  const d = token.slice(0, i), s = token.slice(i + 1)
  if (crypto.createHmac('sha256', AUTH_SECRET).update(d).digest('base64url') !== s) return null
  try {
    const p = JSON.parse(Buffer.from(d, 'base64url').toString())
    return p.exp > Date.now() ? p : null
  } catch { return null }
}
app.use((req, res, next) => {
  req.session = verifyToken((req.headers.authorization || '').replace('Bearer ', ''))
  next()
})
function sessionSpreadsheetId(req) {
  return req.session?.spreadsheetId || MASTER_SPREADSHEET_ID
}

// ── Slug helpers ──────────────────────────────────────
function toSlug(name) {
  const tr = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'j','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'}
  return name.toLowerCase().split('').map(c => tr[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'agency'
}
async function generateSlug(tok, name) {
  const base = toSlug(name)
  try {
    const r = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${AGENCIES_SHEET}!H2:H`)
    const existing = (r.values || []).flat()
    let slug = base, i = 2
    while (existing.includes(slug)) slug = `${base}-${i++}`
    return slug
  } catch { return base }
}

// ════════════════════════════════════════════════════
//  РЕГИСТРАЦИЯ
// ════════════════════════════════════════════════════

app.post('/api/register', async (req, res) => {
  try {
    const { agencyName, login, password, email, sheetUrl, avatar = '🏢' } = req.body
    if (!agencyName?.trim() || !login?.trim() || !password)
      return res.json({ success: false, error: 'Заполните все поля' })
    if (!sheetUrl?.trim())
      return res.json({ success: false, error: 'Вставьте ссылку на вашу Google Таблицу' })

    const match = sheetUrl.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) return res.json({ success: false, error: 'Неверная ссылка. Скопируйте полную ссылку из браузера' })

    const spreadsheetId  = match[1]
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    const tok = await getGoogleToken()

    // Проверяем доступ сервисного аккаунта к таблице
    try { await sheetsMeta(tok, spreadsheetId) } catch {
      return res.json({
        success: false,
        error: 'Таблица недоступна. Откройте доступ (Редактор) для: travel-crm-bot@travel-crm-497007.iam.gserviceaccount.com',
      })
    }

    const masterMeta = await sheetsMeta(tok, MASTER_SPREADSHEET_ID)

    // Ensure sheets exist
    await ensureSheet(tok, masterMeta, MASTER_SPREADSHEET_ID, AGENCIES_SHEET, AGENCIES_HEADERS)
    // Re-fetch meta after possible sheet creation
    const masterMeta2 = await sheetsMeta(tok, MASTER_SPREADSHEET_ID)
    await ensureSheet(tok, masterMeta2, MASTER_SPREADSHEET_ID, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID'])

    const agencyId = 'ag_' + Date.now().toString(36)
    const now = new Date().toISOString()
    const slug = await generateSlug(tok, agencyName.trim())

    // Setup template sheet in agency spreadsheet
    try {
      const agMeta = await sheetsMeta(tok, spreadsheetId)
      const sheet1 = agMeta.sheets[0]
      await sheetsBatchUpdate(tok, spreadsheetId, [{
        updateSheetProperties: {
          properties: { sheetId: sheet1.properties.sheetId, title: '📋 Шаблон импорта' },
          fields: 'title',
        },
      }])
      await sheetsUpdate(tok, spreadsheetId, '📋 Шаблон импорта!A1', [SALE_HEADERS])
    } catch(e) { console.log('template setup non-fatal:', e.message) }

    await sheetsAppend(tok, MASTER_SPREADSHEET_ID, `${AGENCIES_SHEET}!A:H`,
      [[agencyId, agencyName.trim(), email?.trim() || '', spreadsheetId, spreadsheetUrl, now, avatar, slug]])

    await sheetsAppend(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A:E`,
      [[login.trim(), hashPwd(password), 'Администратор', 'admin', agencyId]])

    const token = signToken({ login: login.trim(), role: 'admin', name: 'Администратор', agencyId, spreadsheetId, avatar })
    res.json({ success: true, token, role: 'admin', name: 'Администратор', agencyId, spreadsheetId, spreadsheetUrl, agencyName: agencyName.trim(), avatar, slug })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

// ════════════════════════════════════════════════════
//  LOGIN
// ════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password, agencyCode } = req.body
    if (!login?.trim() || !password) return res.json({ success: false, error: 'Заполните поля' })
    if (!agencyCode?.trim()) return res.json({ success: false, error: 'Введите код компании' })

    const tok = await getGoogleToken()
    const masterMeta = await sheetsMeta(tok, MASTER_SPREADSHEET_ID)
    await ensureSheet(tok, masterMeta, MASTER_SPREADSHEET_ID, AGENCIES_SHEET, AGENCIES_HEADERS)
    const masterMeta2 = await sheetsMeta(tok, MASTER_SPREADSHEET_ID)
    await ensureSheet(tok, masterMeta2, MASTER_SPREADSHEET_ID, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID'])

    const arData = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${AGENCIES_SHEET}!A2:H`)
    const agencyRows = arData.values || []
    const code = agencyCode.trim().toLowerCase()
    let agencyRow = agencyRows.find(r => r[7] === code)
    if (!agencyRow) agencyRow = agencyRows.find(r => toSlug(r[1] || '') === code)
    if (!agencyRow) return res.json({ success: false, error: 'Агентство с таким кодом не найдено' })

    // Backfill slug if missing
    if (!agencyRow[7]) {
      const newSlug = await generateSlug(tok, agencyRow[1] || 'agency')
      const idx = agencyRows.findIndex(r => r[0] === agencyRow[0])
      if (idx >= 0) {
        await sheetsUpdate(tok, MASTER_SPREADSHEET_ID, `${AGENCIES_SHEET}!H${idx + 2}`, [[newSlug]]).catch(() => {})
        agencyRow[7] = newSlug
      }
    }

    const agencyId      = agencyRow[0]
    const spreadsheetId = agencyRow[3] || MASTER_SPREADSHEET_ID
    const avatar        = agencyRow[6] || '🏢'
    const hash          = hashPwd(password)

    const acData = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`)
    const found  = (acData.values || []).find(row =>
      row[0] === login.trim() && row[1] === hash && (row[4] || 'default') === agencyId
    )
    if (!found) return res.json({ success: false, error: 'Неверный логин или пароль' })

    const role = found[3] || 'manager'
    const name = found[2] || login.trim()
    const token = signToken({ login: login.trim(), role, name, agencyId, spreadsheetId, avatar })
    res.json({ success: true, token, role, name, agencyId, spreadsheetId, avatar })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

// ════════════════════════════════════════════════════
//  АККАУНТЫ
// ════════════════════════════════════════════════════

app.get('/api/accounts', async (req, res) => {
  if (req.session?.role !== 'admin') return res.json({ success: false, error: 'Доступ запрещён' })
  const agencyId = req.session.agencyId || 'default'
  try {
    const tok  = await getGoogleToken()
    const r    = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`)
    const rows = (r.values || []).filter(row => (row[4] || 'default') === agencyId)
    res.json({ success: true, accounts: rows.map(row => ({ login: row[0] || '', manager: row[2] || '', role: row[3] || 'manager' })) })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.post('/api/accounts', async (req, res) => {
  if (req.session?.role !== 'admin') return res.json({ success: false, error: 'Доступ запрещён' })
  const agencyId = req.session.agencyId || 'default'
  try {
    const { login, password, manager, role = 'manager' } = req.body
    if (!login?.trim() || !password) return res.json({ success: false, error: 'Заполните поля' })
    const tok = await getGoogleToken()
    const r   = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`)
    if ((r.values || []).some(row => row[0] === login.trim() && (row[4] || 'default') === agencyId))
      return res.json({ success: false, error: 'Логин уже существует' })
    await sheetsAppend(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A:E`,
      [[login.trim(), hashPwd(password), manager?.trim() || login.trim(), role, agencyId]])
    const updated = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`)
    const rows = (updated.values || []).filter(row => (row[4] || 'default') === agencyId)
    res.json({ success: true, accounts: rows.map(row => ({ login: row[0], manager: row[2], role: row[3] })) })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.delete('/api/accounts/:login', async (req, res) => {
  if (req.session?.role !== 'admin') return res.json({ success: false, error: 'Доступ запрещён' })
  const agencyId = req.session.agencyId || 'default'
  try {
    const login = decodeURIComponent(req.params.login)
    const tok   = await getGoogleToken()
    const meta  = await sheetsMeta(tok, MASTER_SPREADSHEET_ID)
    const sheet = meta.sheets.find(s => s.properties.title === ACCOUNTS_SHEET)
    if (!sheet) return res.json({ success: false, error: 'Таблица не найдена' })
    const r   = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`)
    const idx = (r.values || []).findIndex(row => row[0] === login && (row[4] || 'default') === agencyId)
    if (idx === -1) return res.json({ success: false, error: 'Аккаунт не найден' })
    await sheetsBatchUpdate(tok, MASTER_SPREADSHEET_ID, [{ deleteDimension: {
      range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 },
    } }])
    const updated = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`)
    const rows = (updated.values || []).filter(row => (row[4] || 'default') === agencyId)
    res.json({ success: true, accounts: rows.map(row => ({ login: row[0], manager: row[2], role: row[3] })) })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.put('/api/accounts/:login', async (req, res) => {
  if (req.session?.role !== 'admin') return res.json({ success: false, error: 'Доступ запрещён' })
  const agencyId = req.session.agencyId || 'default'
  try {
    const login = decodeURIComponent(req.params.login)
    const { newLogin, manager, role } = req.body
    const tok  = await getGoogleToken()
    const r    = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`)
    const rows = r.values || []
    const idx  = rows.findIndex(row => row[0] === login && (row[4] || 'default') === agencyId)
    if (idx === -1) return res.json({ success: false, error: 'Аккаунт не найден' })
    const rowNum = idx + 2
    if (newLogin?.trim() && newLogin.trim() !== login) {
      if (rows.some(row => row[0] === newLogin.trim() && (row[4] || 'default') === agencyId))
        return res.json({ success: false, error: 'Логин уже занят' })
    }
    const data = []
    if (newLogin?.trim()) data.push({ range: `${ACCOUNTS_SHEET}!A${rowNum}`, values: [[newLogin.trim()]] })
    if (manager !== undefined) data.push({ range: `${ACCOUNTS_SHEET}!C${rowNum}`, values: [[manager]] })
    if (role    !== undefined) data.push({ range: `${ACCOUNTS_SHEET}!D${rowNum}`, values: [[role]] })
    if (data.length > 0) await sheetsBatchGetValues(tok, MASTER_SPREADSHEET_ID, data)
    const updated = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`)
    const agRows  = (updated.values || []).filter(row => (row[4] || 'default') === agencyId)
    res.json({ success: true, accounts: agRows.map(row => ({ login: row[0], manager: row[2], role: row[3] })) })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.put('/api/accounts/:login/password', async (req, res) => {
  if (req.session?.role !== 'admin') return res.json({ success: false, error: 'Доступ запрещён' })
  const agencyId = req.session.agencyId || 'default'
  try {
    const login = decodeURIComponent(req.params.login)
    const { password } = req.body
    if (!password) return res.json({ success: false, error: 'Укажите пароль' })
    const tok = await getGoogleToken()
    const r   = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`)
    const idx = (r.values || []).findIndex(row => row[0] === login && (row[4] || 'default') === agencyId)
    if (idx === -1) return res.json({ success: false, error: 'Аккаунт не найден' })
    await sheetsUpdate(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!B${idx + 2}`, [[hashPwd(password)]])
    res.json({ success: true })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

// ════════════════════════════════════════════════════
//  АГЕНТСТВО
// ════════════════════════════════════════════════════

app.get('/api/agency/info', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' })
  const agencyId = req.session.agencyId
  if (!agencyId || agencyId === 'default') return res.json({ success: true, slug: null })
  try {
    const tok  = await getGoogleToken()
    const r    = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${AGENCIES_SHEET}!A2:H`)
    const rows = r.values || []
    const idx  = rows.findIndex(row => row[0] === agencyId)
    if (idx < 0) return res.json({ success: false, error: 'Агентство не найдено' })
    const row = rows[idx]
    let slug = row[7] || ''
    if (!slug) {
      slug = await generateSlug(tok, row[1] || 'agency')
      await sheetsUpdate(tok, MASTER_SPREADSHEET_ID, `${AGENCIES_SHEET}!H${idx + 2}`, [[slug]])
    }
    res.json({ success: true, slug, name: row[1]||'', email: row[2]||'', spreadsheetId: row[3]||'', spreadsheetUrl: row[4]||'', avatar: row[6]||'🏢' })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.put('/api/agency/info', async (req, res) => {
  if (req.session?.role !== 'admin') return res.json({ success: false, error: 'Доступ запрещён' })
  const agencyId = req.session.agencyId
  if (!agencyId || agencyId === 'default') return res.json({ success: false, error: 'Нет агентства' })
  try {
    const { name, email, avatar, sheetUrl } = req.body
    const tok  = await getGoogleToken()
    const r    = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${AGENCIES_SHEET}!A2:H`)
    const rows = r.values || []
    const idx  = rows.findIndex(row => row[0] === agencyId)
    if (idx < 0) return res.json({ success: false, error: 'Агентство не найдено' })
    const rowNum = idx + 2
    const data = []
    if (name   !== undefined) data.push({ range: `${AGENCIES_SHEET}!B${rowNum}`, values: [[name.trim()]] })
    if (email  !== undefined) data.push({ range: `${AGENCIES_SHEET}!C${rowNum}`, values: [[email.trim()]] })
    if (avatar !== undefined) data.push({ range: `${AGENCIES_SHEET}!G${rowNum}`, values: [[avatar]] })
    if (sheetUrl?.trim()) {
      const m = sheetUrl.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
      if (!m) return res.json({ success: false, error: 'Неверная ссылка' })
      try { await sheetsMeta(tok, m[1]) } catch { return res.json({ success: false, error: 'Таблица недоступна' }) }
      data.push({ range: `${AGENCIES_SHEET}!D${rowNum}`, values: [[m[1]]] })
      data.push({ range: `${AGENCIES_SHEET}!E${rowNum}`, values: [[`https://docs.google.com/spreadsheets/d/${m[1]}/edit`]] })
    }
    if (data.length > 0) await sheetsBatchGetValues(tok, MASTER_SPREADSHEET_ID, data)
    const r2  = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${AGENCIES_SHEET}!A2:H`)
    const row = (r2.values || []).find(r => r[0] === agencyId) || []
    res.json({ success: true, name: row[1]||'', email: row[2]||'', spreadsheetId: row[3]||'', spreadsheetUrl: row[4]||'', avatar: row[6]||'🏢', slug: row[7]||'' })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

// ════════════════════════════════════════════════════
//  МЕНЕДЖЕРЫ
// ════════════════════════════════════════════════════

app.get('/api/managers', async (req, res) => {
  try {
    const agencyId = req.session?.agencyId || 'default'
    const tok  = await getGoogleToken()
    const r    = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`)
    const rows = r.values || []
    const names = [...new Set(rows.filter(row => (row[4]||'default') === agencyId).map(row => (row[2]||'').trim()).filter(Boolean))]
    res.json({ success: true, managers: names })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

// ════════════════════════════════════════════════════
//  СПРАВОЧНИКИ
// ════════════════════════════════════════════════════

function makeListRouter(sheetName) {
  return {
    async getAll(req, res) {
      try {
        const spreadsheetId = sessionSpreadsheetId(req)
        const agencyId      = req.session?.agencyId || 'default'
        const isMaster      = spreadsheetId === MASTER_SPREADSHEET_ID
        const tok  = await getGoogleToken()
        const meta = await sheetsMeta(tok, spreadsheetId)
        await ensureSheet(tok, meta, spreadsheetId, sheetName, isMaster ? ['Название','AgencyID'] : ['Название'])
        if (isMaster) {
          const r = await sheetsGet(tok, spreadsheetId, `${sheetName}!A2:B`)
          const items = (r.values||[]).filter(row=>(row[1]||'default')===agencyId).map(row=>row[0]).filter(Boolean)
          return res.json({ success: true, items })
        } else {
          const r = await sheetsGet(tok, spreadsheetId, `${sheetName}!A2:A`)
          return res.json({ success: true, items: (r.values||[]).flat().filter(Boolean) })
        }
      } catch (e) { res.json({ success: false, error: e.message }) }
    },
    async add(req, res) {
      try {
        const spreadsheetId = sessionSpreadsheetId(req)
        const agencyId      = req.session?.agencyId || 'default'
        const isMaster      = spreadsheetId === MASTER_SPREADSHEET_ID
        const name = String(req.body.name||'').trim()
        if (!name) return res.json({ success: false, error: 'Пустое название' })
        const tok  = await getGoogleToken()
        const meta = await sheetsMeta(tok, spreadsheetId)
        await ensureSheet(tok, meta, spreadsheetId, sheetName, isMaster ? ['Название','AgencyID'] : ['Название'])
        if (isMaster) {
          const r = await sheetsGet(tok, spreadsheetId, `${sheetName}!A2:B`)
          const existing = (r.values||[]).filter(row=>(row[1]||'default')===agencyId).map(row=>row[0])
          if (existing.map(v=>v.toLowerCase()).includes(name.toLowerCase())) return res.json({ success: false, error: 'Уже существует' })
          await sheetsAppend(tok, spreadsheetId, `${sheetName}!A:B`, [[name, agencyId]])
          const updated = await sheetsGet(tok, spreadsheetId, `${sheetName}!A2:B`)
          return res.json({ success: true, items: (updated.values||[]).filter(row=>(row[1]||'default')===agencyId).map(row=>row[0]).filter(Boolean) })
        } else {
          const r = await sheetsGet(tok, spreadsheetId, `${sheetName}!A2:A`)
          if ((r.values||[]).flat().map(v=>v.toLowerCase()).includes(name.toLowerCase())) return res.json({ success: false, error: 'Уже существует' })
          await sheetsAppend(tok, spreadsheetId, `${sheetName}!A:A`, [[name]])
          const updated = await sheetsGet(tok, spreadsheetId, `${sheetName}!A2:A`)
          return res.json({ success: true, items: (updated.values||[]).flat().filter(Boolean) })
        }
      } catch (e) { res.json({ success: false, error: e.message }) }
    },
    async remove(req, res) {
      try {
        const spreadsheetId = sessionSpreadsheetId(req)
        const agencyId      = req.session?.agencyId || 'default'
        const isMaster      = spreadsheetId === MASTER_SPREADSHEET_ID
        const name = decodeURIComponent(req.params.name)
        const tok  = await getGoogleToken()
        const meta = await sheetsMeta(tok, spreadsheetId)
        const sheet = meta.sheets.find(s=>s.properties.title===sheetName)
        if (!sheet) return res.json({ success: false, error: 'Не найдено' })
        let idx
        if (isMaster) {
          const r = await sheetsGet(tok, spreadsheetId, `${sheetName}!A2:B`)
          idx = (r.values||[]).findIndex(row=>row[0]===name&&(row[1]||'default')===agencyId)
        } else {
          const r = await sheetsGet(tok, spreadsheetId, `${sheetName}!A2:A`)
          idx = (r.values||[]).findIndex(row=>row[0]===name)
        }
        if (idx===-1) return res.json({ success: false, error: 'Не найдено' })
        await sheetsBatchUpdate(tok, spreadsheetId, [{ deleteDimension: {
          range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: idx+1, endIndex: idx+2 },
        } }])
        if (isMaster) {
          const updated = await sheetsGet(tok, spreadsheetId, `${sheetName}!A2:B`)
          return res.json({ success: true, items: (updated.values||[]).filter(row=>(row[1]||'default')===agencyId).map(row=>row[0]).filter(Boolean) })
        } else {
          const updated = await sheetsGet(tok, spreadsheetId, `${sheetName}!A2:A`)
          return res.json({ success: true, items: (updated.values||[]).flat().filter(Boolean) })
        }
      } catch (e) { res.json({ success: false, error: e.message }) }
    },
  }
}

const dirR = makeListRouter(DIRECTIONS_SHEET)
app.get('/api/directions',          dirR.getAll)
app.post('/api/directions',         dirR.add)
app.delete('/api/directions/:name', dirR.remove)

const hotR = makeListRouter(HOTELS_SHEET)
app.get('/api/hotels',          hotR.getAll)
app.post('/api/hotels',         hotR.add)
app.delete('/api/hotels/:name', hotR.remove)

const srcR = makeListRouter(SOURCES_SHEET)
app.get('/api/sources',          srcR.getAll)
app.post('/api/sources',         srcR.add)
app.delete('/api/sources/:name', srcR.remove)

// ════════════════════════════════════════════════════
//  ПРОДАЖИ
// ════════════════════════════════════════════════════

app.post('/api/sales', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован — войдите снова' })
  const spreadsheetId = sessionSpreadsheetId(req)
  try {
    const { contractNumber, salesCount, bookingDate, clientName, direction, hotel,
            phone, source, amount, currency, commission, discount, rate, netto,
            prepayment, paymentMethod, paymentUZS, paymentUSD, departureDate, arrivalDate, dueDate } = req.body
    const manager = req.session.role === 'manager' ? req.session.name : (req.body.manager || '')
    if (!contractNumber?.trim()) return res.json({ success: false, error: 'Укажите номер договора' })
    if (!manager)                return res.json({ success: false, error: 'Не указан менеджер' })
    if (!salesCount)             return res.json({ success: false, error: 'Укажите количество человек' })

    const tok       = await getGoogleToken()
    const sheetName = currentMonthSheet()
    const meta      = await sheetsMeta(tok, spreadsheetId)
    await ensureSheet(tok, meta, spreadsheetId, sheetName, SALE_HEADERS)

    const debt = (amount && prepayment) ? Math.round((Number(amount) - Number(prepayment)) * 100) / 100 : ''
    await sheetsAppend(tok, spreadsheetId, `${sheetName}!A:Y`, [[
      new Date().toISOString(), contractNumber.trim(), manager, Number(salesCount),
      bookingDate||'', clientName||'', direction||'', hotel||'', phone||'', source||'',
      amount ? Number(amount) : '', currency||'',
      commission ? Number(commission) : '', discount ? Number(discount) : '',
      commission ? Math.round((Number(commission)-(Number(discount)||0))*100)/100 : '',
      rate ? Number(rate) : '',
      netto ? Number(netto) : '', prepayment ? Number(prepayment) : '', debt,
      paymentMethod||'',
      paymentUZS ? Number(paymentUZS) : '',
      paymentUSD ? Number(paymentUSD) : '',
      departureDate||'', arrivalDate||'', dueDate||'',
    ]])
    res.json({ success: true })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.get('/api/exchange-rate', async (req, res) => {
  try {
    let rate = null
    try {
      const r = await fetch('https://ipak-yuli.uz/api/currency/rates', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) })
      if (r.ok) {
        const d = await r.json()
        const usd = Array.isArray(d) ? d.find(x=>(x.code||x.currency||'').toUpperCase()==='USD') : null
        if (usd) rate = Number(usd.sell||usd.rate||usd.saleRate)
      }
    } catch {}
    if (!rate) {
      const r = await fetch('https://cbu.uz/en/arkhiv-kursov-valyut/json/USD/', { signal: AbortSignal.timeout(5000) })
      const d = await r.json()
      rate = Number(d[0]?.Rate)
    }
    if (!rate||isNaN(rate)) return res.json({ success: false, error: 'Не удалось получить курс' })
    res.json({ success: true, rate })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.get('/api/sales', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' })
  const spreadsheetId = sessionSpreadsheetId(req)
  try {
    const tok    = await getGoogleToken()
    const meta   = await sheetsMeta(tok, spreadsheetId)
    const titles = meta.sheets.map(s=>s.properties.title).filter(isSalesSheet)
    const allRows = []
    for (const title of titles) {
      const r = await sheetsGet(tok, spreadsheetId, `${title}!A2:Y`)
      ;(r.values||[]).forEach((row, i) => allRows.push({
        id: `${title}|${i+2}`, date: row[0]||'', contractNumber: row[1]||'',
        manager: row[2]||'', salesCount: Number(row[3])||0, bookingDate: row[4]||'',
        clientName: row[5]||'', direction: row[6]||'', hotel: row[7]||'',
        phone: row[8]||'', source: row[9]||'',
        amount: row[10]?Number(row[10]):null, currency: row[11]||'',
        commission: row[12]?Number(row[12]):null, discount: row[13]?Number(row[13]):null,
        balance: row[14]?Number(row[14]):null, rate: row[15]?Number(row[15]):null,
        netto: row[16]?Number(row[16]):null, prepayment: row[17]?Number(row[17]):null,
        debt: row[18]?Number(row[18]):null, paymentMethod: row[19]||'',
        paymentUZS: row[20]?Number(row[20]):null, paymentUSD: row[21]?Number(row[21]):null,
        departureDate: row[22]||'', arrivalDate: row[23]||'', dueDate: row[24]||'',
      }))
    }
    const result = req.session.role==='manager' ? allRows.filter(s=>s.manager===req.session.name) : allRows
    result.sort((a,b)=>new Date(b.date)-new Date(a.date))
    res.json({ success: true, sales: result })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.put('/api/sales/:id', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' })
  const spreadsheetId = sessionSpreadsheetId(req)
  try {
    const rawId = decodeURIComponent(req.params.id)
    const pipe  = rawId.lastIndexOf('|')
    const sheetTitle = rawId.slice(0, pipe)
    const rowIndex   = parseInt(rawId.slice(pipe + 1))
    const tok = await getGoogleToken()
    const COLS = {
      contractNumber:{col:'B',num:false}, manager:{col:'C',num:false}, salesCount:{col:'D',num:true},
      bookingDate:{col:'E',num:false}, clientName:{col:'F',num:false}, direction:{col:'G',num:false},
      hotel:{col:'H',num:false}, phone:{col:'I',num:false}, source:{col:'J',num:false},
      amount:{col:'K',num:true}, currency:{col:'L',num:false}, commission:{col:'M',num:true},
      discount:{col:'N',num:true}, balance:{col:'O',num:true}, prepayment:{col:'R',num:true},
      debt:{col:'S',num:true}, paymentMethod:{col:'T',num:false},
      departureDate:{col:'W',num:false}, arrivalDate:{col:'X',num:false}, dueDate:{col:'Y',num:false},
    }
    const data = []
    for (const [field, {col, num}] of Object.entries(COLS)) {
      if (req.body[field] !== undefined) {
        const raw = req.body[field]
        const val = (raw===''||raw===null) ? '' : (num ? Number(raw) : String(raw))
        data.push({ range: `${sheetTitle}!${col}${rowIndex}`, values: [[val]] })
      }
    }
    if (data.length > 0) await sheetsBatchGetValues(tok, spreadsheetId, data)
    res.json({ success: true })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.delete('/api/sales/:id', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' })
  const spreadsheetId = sessionSpreadsheetId(req)
  try {
    const rawId = decodeURIComponent(req.params.id)
    const pipe  = rawId.lastIndexOf('|')
    const sheetTitle = rawId.slice(0, pipe)
    const rowIndex   = parseInt(rawId.slice(pipe + 1))
    const tok  = await getGoogleToken()
    const meta = await sheetsMeta(tok, spreadsheetId)
    const sheet = meta.sheets.find(s=>s.properties.title===sheetTitle)
    if (!sheet) return res.json({ success: false, error: 'Лист не найден' })
    await sheetsBatchUpdate(tok, spreadsheetId, [{ deleteDimension: {
      range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex-1, endIndex: rowIndex },
    } }])
    res.json({ success: true })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

// ════════════════════════════════════════════════════
//  DEV ADMIN
// ════════════════════════════════════════════════════

function devAuth(req, res, next) {
  const token = verifyToken((req.headers.authorization||'').replace('Bearer ',''))
  if (!token||token.role!=='superadmin') return res.status(403).json({ success: false, error: 'Нет доступа' })
  next()
}
app.post('/api/dev/login', (req, res) => {
  if (req.body.password !== DEV_SECRET) return res.json({ success: false, error: 'Неверный пароль' })
  res.json({ success: true, token: signToken({ role: 'superadmin', name: 'Developer' }) })
})
app.get('/api/dev/agencies', devAuth, async (req, res) => {
  try {
    const tok = await getGoogleToken()
    const [agR, acR] = await Promise.all([
      sheetsGet(tok, MASTER_SPREADSHEET_ID, `${AGENCIES_SHEET}!A2:G`),
      sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`),
    ])
    const accounts = acR.values||[]
    const agencies = (agR.values||[]).map(row=>({
      id:row[0]||'', name:row[1]||'', email:row[2]||'', spreadsheetId:row[3]||'',
      spreadsheetUrl:row[4]||'', createdAt:row[5]||'', avatar:row[6]||'🏢',
      accountCount: accounts.filter(a=>(a[4]||'default')===(row[0]||'')).length,
    }))
    const def = accounts.filter(a=>!a[4]||a[4]==='default')
    if (def.length>0) agencies.unshift({ id:'default', name:'(Основное)', avatar:'🏠',
      spreadsheetId: MASTER_SPREADSHEET_ID, spreadsheetUrl:`https://docs.google.com/spreadsheets/d/${MASTER_SPREADSHEET_ID}/edit`,
      email:'', createdAt:'', accountCount: def.length })
    res.json({ success: true, agencies })
  } catch (e) { res.json({ success: false, error: e.message }) }
})
app.delete('/api/dev/agencies/:agencyId', devAuth, async (req, res) => {
  const agencyId = req.params.agencyId
  if (agencyId==='default') return res.json({ success: false, error: 'Нельзя удалить основное' })
  try {
    const tok  = await getGoogleToken()
    const meta = await sheetsMeta(tok, MASTER_SPREADSHEET_ID)
    const agSheet = meta.sheets.find(s=>s.properties.title===AGENCIES_SHEET)
    if (agSheet) {
      const r   = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${AGENCIES_SHEET}!A2:A`)
      const idx = (r.values||[]).findIndex(row=>row[0]===agencyId)
      if (idx>=0) await sheetsBatchUpdate(tok, MASTER_SPREADSHEET_ID, [{ deleteDimension:{
        range:{ sheetId: agSheet.properties.sheetId, dimension:'ROWS', startIndex:idx+1, endIndex:idx+2 }
      } }])
    }
    const acSheet = meta.sheets.find(s=>s.properties.title===ACCOUNTS_SHEET)
    if (acSheet) {
      const r2 = await sheetsGet(tok, MASTER_SPREADSHEET_ID, `${ACCOUNTS_SHEET}!A2:E`)
      const rows = r2.values||[]
      const toDelete = rows.map((_,i)=>i).filter(i=>(rows[i][4]||'default')===agencyId).reverse()
      for (const i of toDelete) {
        await sheetsBatchUpdate(tok, MASTER_SPREADSHEET_ID, [{ deleteDimension:{
          range:{ sheetId:acSheet.properties.sheetId, dimension:'ROWS', startIndex:i+1, endIndex:i+2 }
        } }])
      }
    }
    res.json({ success: true })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

module.exports.handler = serverless(app)
