const serverless = require('serverless-http')
const express    = require('express')
const crypto     = require('crypto')

const app = express()
app.use(express.json())

const SPREADSHEET_ID   = '1EcmuWFgyBLp3BH5RxWC50iAmTarnz9dosFZnE7ZQQlY'
const SALES_SHEET      = 'Продажи'
const MANAGERS_SHEET   = 'Менеджеры'
const DIRECTIONS_SHEET = 'Направления'
const HOTELS_SHEET     = 'Отели'
const SOURCES_SHEET    = 'Источники'

const MONTH_NAMES_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
]

function currentMonthSheet() {
  const d = new Date()
  return `${MONTH_NAMES_RU[d.getMonth()]} ${d.getFullYear()}`
}

function isSalesSheet(title) {
  return title === SALES_SHEET || MONTH_NAMES_RU.some(m => title.startsWith(m + ' '))
}

// ── Google Auth via JWT (без googleapis) ─────────────
function loadCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_JSON)
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
  try { return require('./credentials.json') } catch {}
  return require('../../backend/credentials.json')
}

async function getAccessToken() {
  const creds = loadCredentials()
  const now   = Math.floor(Date.now() / 1000)

  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss  : creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud  : 'https://oauth2.googleapis.com/token',
    exp  : now + 3600,
    iat  : now,
  })).toString('base64url')

  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const sig = sign.sign(creds.private_key, 'base64url')
  const jwt = `${header}.${payload}.${sig}`

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body   : `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Auth failed: ' + JSON.stringify(data))
  return data.access_token
}

// ── Sheets REST helpers ───────────────────────────────
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`

async function sheetsMeta(token) {
  const r = await fetch(`${BASE}`, { headers: { Authorization: `Bearer ${token}` } })
  return r.json()
}

async function sheetsGet(token, range) {
  const r = await fetch(`${BASE}/values/${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return r.json()
}

async function sheetsAppend(token, range, values) {
  const r = await fetch(`${BASE}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`, {
    method : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body   : JSON.stringify({ values }),
  })
  return r.json()
}

async function sheetsUpdate(token, range, values) {
  const r = await fetch(`${BASE}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method : 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body   : JSON.stringify({ values }),
  })
  return r.json()
}

async function batchUpdate(token, requests) {
  const r = await fetch(`${BASE}:batchUpdate`, {
    method : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body   : JSON.stringify({ requests }),
  })
  return r.json()
}

async function ensureSheet(token, meta, title, headers) {
  const exists = meta.sheets.find(s => s.properties.title === title)
  if (!exists) {
    await batchUpdate(token, [{ addSheet: { properties: { title } } }])
    await sheetsUpdate(token, `${title}!A1`, [headers])
  }
}

// ════════════════════════════════════════════════════
//  МЕНЕДЖЕРЫ
// ════════════════════════════════════════════════════

app.get('/api/managers', async (req, res) => {
  try {
    const token = await getAccessToken()
    const meta  = await sheetsMeta(token)
    await ensureSheet(token, meta, MANAGERS_SHEET, ['Имя'])
    const r = await sheetsGet(token, `${MANAGERS_SHEET}!A2:A`)
    res.json({ success: true, managers: (r.values || []).flat().filter(Boolean) })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.post('/api/managers', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    if (!name) return res.json({ success: false, error: 'Пустое имя' })
    const token    = await getAccessToken()
    const meta     = await sheetsMeta(token)
    await ensureSheet(token, meta, MANAGERS_SHEET, ['Имя'])
    const r        = await sheetsGet(token, `${MANAGERS_SHEET}!A2:A`)
    const existing = (r.values || []).flat().map(v => v.toLowerCase())
    if (existing.includes(name.toLowerCase()))
      return res.json({ success: false, error: 'Менеджер уже существует' })
    await sheetsAppend(token, `${MANAGERS_SHEET}!A:A`, [[name]])
    const updated  = await sheetsGet(token, `${MANAGERS_SHEET}!A2:A`)
    res.json({ success: true, managers: (updated.values || []).flat().filter(Boolean) })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.delete('/api/managers/:name', async (req, res) => {
  try {
    const name  = decodeURIComponent(req.params.name)
    const token = await getAccessToken()
    const meta  = await sheetsMeta(token)

    const mgrSheet = meta.sheets.find(s => s.properties.title === MANAGERS_SHEET)
    if (!mgrSheet) return res.json({ success: false, error: 'Менеджер не найден' })

    const mgrR  = await sheetsGet(token, `${MANAGERS_SHEET}!A2:A`)
    const rows  = mgrR.values || []
    const idx   = rows.findIndex(r => r[0] === name)
    if (idx === -1) return res.json({ success: false, error: 'Менеджер не найден' })

    await batchUpdate(token, [{ deleteDimension: { range: {
      sheetId: mgrSheet.properties.sheetId, dimension: 'ROWS',
      startIndex: idx + 1, endIndex: idx + 2,
    } } }])

    for (const sheet of meta.sheets.filter(s => isSalesSheet(s.properties.title))) {
      const sR = await sheetsGet(token, `${sheet.properties.title}!A2:H`)
      const toDelete = (sR.values || []).map((r, i) => ({ r, i })).filter(({ r }) => r[2] === name).reverse()
      for (const { i } of toDelete) {
        await batchUpdate(token, [{ deleteDimension: { range: {
          sheetId: sheet.properties.sheetId, dimension: 'ROWS',
          startIndex: i + 1, endIndex: i + 2,
        } } }])
      }
    }

    const updated = await sheetsGet(token, `${MANAGERS_SHEET}!A2:A`)
    res.json({ success: true, managers: (updated.values || []).flat().filter(Boolean) })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

// ════════════════════════════════════════════════════
//  УНИВЕРСАЛЬНЫЙ CRUD ДЛЯ СПРАВОЧНИКОВ
// ════════════════════════════════════════════════════

function makeListHandlers(sheetName) {
  return {
    async getAll(req, res) {
      try {
        const token = await getAccessToken(); const meta = await sheetsMeta(token);
        await ensureSheet(token, meta, sheetName, ['Название']);
        const r = await sheetsGet(token, `${sheetName}!A2:A`);
        res.json({ success: true, items: (r.values || []).flat().filter(Boolean) });
      } catch (e) { res.json({ success: false, error: e.message }); }
    },
    async add(req, res) {
      try {
        const name = String(req.body.name || '').trim();
        if (!name) return res.json({ success: false, error: 'Пустое название' });
        const token = await getAccessToken(); const meta = await sheetsMeta(token);
        await ensureSheet(token, meta, sheetName, ['Название']);
        const r = await sheetsGet(token, `${sheetName}!A2:A`);
        const existing = (r.values || []).flat().map(v => v.toLowerCase());
        if (existing.includes(name.toLowerCase())) return res.json({ success: false, error: 'Уже существует' });
        await sheetsAppend(token, `${sheetName}!A:A`, [[name]]);
        const updated = await sheetsGet(token, `${sheetName}!A2:A`);
        res.json({ success: true, items: (updated.values || []).flat().filter(Boolean) });
      } catch (e) { res.json({ success: false, error: e.message }); }
    },
    async remove(req, res) {
      try {
        const name = decodeURIComponent(req.params.name);
        const token = await getAccessToken(); const meta = await sheetsMeta(token);
        const sheet = meta.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) return res.json({ success: false, error: 'Не найдено' });
        const r = await sheetsGet(token, `${sheetName}!A2:A`);
        const idx = (r.values || []).findIndex(row => row[0] === name);
        if (idx === -1) return res.json({ success: false, error: 'Не найдено' });
        await batchUpdate(token, [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }]);
        const updated = await sheetsGet(token, `${sheetName}!A2:A`);
        res.json({ success: true, items: (updated.values || []).flat().filter(Boolean) });
      } catch (e) { res.json({ success: false, error: e.message }); }
    },
  };
}

const dirH = makeListHandlers(DIRECTIONS_SHEET);
app.get('/api/directions',          dirH.getAll);
app.post('/api/directions',         dirH.add);
app.delete('/api/directions/:name', dirH.remove);

const hotH = makeListHandlers(HOTELS_SHEET);
app.get('/api/hotels',          hotH.getAll);
app.post('/api/hotels',         hotH.add);
app.delete('/api/hotels/:name', hotH.remove);

const srcH = makeListHandlers(SOURCES_SHEET);
app.get('/api/sources',          srcH.getAll);
app.post('/api/sources',         srcH.add);
app.delete('/api/sources/:name', srcH.remove);

// ════════════════════════════════════════════════════
//  ПРОДАЖИ
// ════════════════════════════════════════════════════

app.post('/api/sales', async (req, res) => {
  try {
    const { contractNumber, manager, salesCount, bookingDate, clientName, direction, hotel, phone, source, amount, currency, commission, discount, rate } = req.body
    if (!contractNumber || !manager || !salesCount)
      return res.json({ success: false, error: 'Заполните все поля' })
    const token     = await getAccessToken()
    const meta      = await sheetsMeta(token)
    const sheetName = currentMonthSheet()
    await ensureSheet(token, meta, sheetName, ['Дата','Номер договора','Менеджер','Кол-во продаж','Дата брони','Клиент','Направление','Отель','Телефон','Источник','Сумма','Валюта','Комиссия ($)','Скидка ($)','Остаток ($)','Курс'])
    await sheetsAppend(token, `${sheetName}!A:P`, [[
      new Date().toISOString(), contractNumber.trim(), manager, Number(salesCount),
      bookingDate || '', clientName || '', direction || '', hotel || '', phone || '', source || '',
      amount ? Number(amount) : '', currency || '', commission ? Number(commission) : '', discount ? Number(discount) : '',
      commission ? Math.round((Number(commission) - (Number(discount) || 0)) * 100) / 100 : '',
      rate ? Number(rate) : '',
    ]])
    res.json({ success: true })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.get('/api/sales', async (req, res) => {
  try {
    const token  = await getAccessToken()
    const meta   = await sheetsMeta(token)
    const titles = meta.sheets.map(s => s.properties.title).filter(isSalesSheet)
    const allRows = []
    for (const title of titles) {
      const r = await sheetsGet(token, `${title}!A2:P`)
      ;(r.values || []).forEach((row, i) => allRows.push({
        id: `${title}|${i + 2}`, date: row[0] || '',
        contractNumber: row[1] || '', manager: row[2] || '',
        salesCount: Number(row[3]) || 0, bookingDate: row[4] || '',
        clientName: row[5] || '', direction: row[6] || '', hotel: row[7] || '',
        phone: row[8] || '', source: row[9] || '',
        amount: row[10] ? Number(row[10]) : null, currency: row[11] || '',
        commission: row[12] ? Number(row[12]) : null, discount: row[13] ? Number(row[13]) : null,
        balance: row[14] ? Number(row[14]) : null,
        rate: row[15] ? Number(row[15]) : null,
      }))
    }
    allRows.sort((a, b) => new Date(b.date) - new Date(a.date))
    res.json({ success: true, sales: allRows })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.put('/api/sales/:id', async (req, res) => {
  try {
    const raw        = decodeURIComponent(req.params.id)
    const pipe       = raw.lastIndexOf('|')
    const sheetTitle = raw.slice(0, pipe)
    const rowIndex   = parseInt(raw.slice(pipe + 1))
    const token      = await getAccessToken()
    await sheetsUpdate(token, `${sheetTitle}!D${rowIndex}`, [[Number(req.body.salesCount)]])
    res.json({ success: true })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

app.delete('/api/sales/:id', async (req, res) => {
  try {
    const raw        = decodeURIComponent(req.params.id)
    const pipe       = raw.lastIndexOf('|')
    const sheetTitle = raw.slice(0, pipe)
    const rowIndex   = parseInt(raw.slice(pipe + 1))
    const token      = await getAccessToken()
    const meta       = await sheetsMeta(token)
    const sheet      = meta.sheets.find(s => s.properties.title === sheetTitle)
    if (!sheet) return res.json({ success: false, error: 'Лист не найден' })
    await batchUpdate(token, [{ deleteDimension: { range: {
      sheetId: sheet.properties.sheetId, dimension: 'ROWS',
      startIndex: rowIndex - 1, endIndex: rowIndex,
    } } }])
    res.json({ success: true })
  } catch (e) { res.json({ success: false, error: e.message }) }
})

module.exports.handler = serverless(app)
