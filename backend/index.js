const express    = require('express');
const cors       = require('cors');
const crypto     = require('crypto');
const { google } = require('googleapis');
const path       = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const SPREADSHEET_ID   = '1EcmuWFgyBLp3BH5RxWC50iAmTarnz9dosFZnE7ZQQlY';
const SALES_SHEET      = 'Продажи';
const DIRECTIONS_SHEET = 'Направления';
const HOTELS_SHEET     = 'Отели';
const SOURCES_SHEET    = 'Источники';
const ACCOUNTS_SHEET   = 'Аккаунты';
const AGENCIES_SHEET   = 'Агентства';

const MONTH_NAMES_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

function currentMonthSheet() {
  const d = new Date();
  return `${MONTH_NAMES_RU[d.getMonth()]} ${d.getFullYear()}`;
}
function isSalesSheet(title) {
  return title === SALES_SHEET || MONTH_NAMES_RU.some(m => title.startsWith(m + ' '));
}

// ── Google Sheets auth ───────────────────────────────
async function getSheets() {
  const authConfig = process.env.GOOGLE_CREDENTIALS_JSON
    ? { credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON) }
    : { keyFile: path.join(__dirname, 'credentials.json') };
  const auth = new google.auth.GoogleAuth({
    ...authConfig,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureSheet(sheets, title, headers) {
  const meta  = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const found = meta.data.sheets.find(s => s.properties.title === title);
  if (!found) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody : { requests: [{ addSheet: { properties: { title } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `${title}!A1`,
      valueInputOption: 'RAW', requestBody: { values: [headers] },
    });
  }
}

// ── JWT Auth ─────────────────────────────────────────
const AUTH_SECRET = process.env.AUTH_SECRET || 'crm-2026-secret-key';
const hashPwd = p => crypto.createHash('sha256').update(String(p)).digest('hex');

function signToken(payload) {
  const d = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 12 * 3600_000 })).toString('base64url');
  const s = crypto.createHmac('sha256', AUTH_SECRET).update(d).digest('base64url');
  return `${d}.${s}`;
}
function verifyToken(token) {
  if (!token) return null;
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const d = token.slice(0, i), s = token.slice(i + 1);
  if (crypto.createHmac('sha256', AUTH_SECRET).update(d).digest('base64url') !== s) return null;
  try {
    const p = JSON.parse(Buffer.from(d, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}
app.use((req, res, next) => {
  req.session = verifyToken((req.headers.authorization || '').replace('Bearer ', ''));
  next();
});

// ════════════════════════════════════════════════════
//  РЕГИСТРАЦИЯ АГЕНТСТВА
// ════════════════════════════════════════════════════

app.post('/api/register', async (req, res) => {
  try {
    const { agencyName, login, password } = req.body;
    if (!agencyName?.trim() || !login?.trim() || !password)
      return res.json({ success: false, error: 'Заполните все поля' });

    const sheets = await getSheets();
    await ensureSheet(sheets, AGENCIES_SHEET, ['ID агентства', 'Название', 'Дата регистрации']);
    await ensureSheet(sheets, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID']);

    // Проверяем что логин не занят глобально
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:A` });
    if ((r.data.values || []).flat().includes(login.trim()))
      return res.json({ success: false, error: 'Этот логин уже занят' });

    const agencyId = 'ag_' + Date.now().toString(36);
    const now = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${AGENCIES_SHEET}!A:C`, valueInputOption: 'RAW',
      requestBody: { values: [[agencyId, agencyName.trim(), now]] },
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A:E`, valueInputOption: 'RAW',
      requestBody: { values: [[login.trim(), hashPwd(password), 'Администратор', 'admin', agencyId]] },
    });

    const token = signToken({ login: login.trim(), role: 'admin', name: 'Администратор', agencyId });
    res.json({ success: true, token, role: 'admin', name: 'Администратор', agencyId, agencyName: agencyName.trim() });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ════════════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login?.trim() || !password) return res.json({ success: false, error: 'Заполните поля' });
    const sheets = await getSheets();
    await ensureSheet(sheets, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID']);
    const r    = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const rows = r.data.values || [];
    const hash = hashPwd(password);
    // Fallback admin если таблица пуста
    if (rows.length === 0 && login.trim() === 'admin' && hash === hashPwd('1234')) {
      const token = signToken({ login: 'admin', role: 'admin', name: 'Администратор', agencyId: 'default' });
      return res.json({ success: true, token, role: 'admin', name: 'Администратор', agencyId: 'default' });
    }
    const found = rows.find(row => row[0] === login.trim() && row[1] === hash);
    if (!found) return res.json({ success: false, error: 'Неверный логин или пароль' });
    const role     = found[3] || 'manager';
    const name     = found[2] || login.trim();
    const agencyId = found[4] || 'default';
    const token    = signToken({ login: login.trim(), role, name, agencyId });
    res.json({ success: true, token, role, name, agencyId });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ════════════════════════════════════════════════════
//  АККАУНТЫ (только в рамках своего агентства)
// ════════════════════════════════════════════════════

app.get('/api/accounts', async (req, res) => {
  if (req.session?.role !== 'admin') return res.json({ success: false, error: 'Доступ запрещён' });
  const agencyId = req.session.agencyId || 'default';
  try {
    const sheets = await getSheets();
    await ensureSheet(sheets, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID']);
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const rows = (r.data.values || []).filter(row => (row[4] || 'default') === agencyId);
    res.json({ success: true, accounts: rows.map(row => ({ login: row[0] || '', manager: row[2] || '', role: row[3] || 'manager' })) });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/accounts', async (req, res) => {
  if (req.session?.role !== 'admin') return res.json({ success: false, error: 'Доступ запрещён' });
  const agencyId = req.session.agencyId || 'default';
  try {
    const { login, password, manager, role = 'manager' } = req.body;
    if (!login?.trim() || !password) return res.json({ success: false, error: 'Заполните поля' });
    const sheets = await getSheets();
    await ensureSheet(sheets, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID']);
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:A` });
    if ((r.data.values || []).flat().includes(login.trim()))
      return res.json({ success: false, error: 'Логин уже существует' });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A:E`, valueInputOption: 'RAW',
      requestBody: { values: [[login.trim(), hashPwd(password), manager || '', role, agencyId]] },
    });
    const updated = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const rows = (updated.data.values || []).filter(row => (row[4] || 'default') === agencyId);
    res.json({ success: true, accounts: rows.map(row => ({ login: row[0], manager: row[2], role: row[3] })) });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.delete('/api/accounts/:login', async (req, res) => {
  if (req.session?.role !== 'admin') return res.json({ success: false, error: 'Доступ запрещён' });
  const agencyId = req.session.agencyId || 'default';
  try {
    const login  = decodeURIComponent(req.params.login);
    const sheets = await getSheets();
    const meta   = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet  = meta.data.sheets.find(s => s.properties.title === ACCOUNTS_SHEET);
    if (!sheet) return res.json({ success: false, error: 'Не найдено' });
    const r   = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const idx = (r.data.values || []).findIndex(row => row[0] === login && (row[4] || 'default') === agencyId);
    if (idx < 0) return res.json({ success: false, error: 'Аккаунт не найден' });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }] },
    });
    const updated = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const rows = (updated.data.values || []).filter(row => (row[4] || 'default') === agencyId);
    res.json({ success: true, accounts: rows.map(row => ({ login: row[0], manager: row[2], role: row[3] })) });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.put('/api/accounts/:login/password', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' });
  const login    = decodeURIComponent(req.params.login);
  const agencyId = req.session.agencyId || 'default';
  if (req.session.role !== 'admin' && req.session.login !== login)
    return res.json({ success: false, error: 'Доступ запрещён' });
  try {
    const { password } = req.body;
    if (!password) return res.json({ success: false, error: 'Введите пароль' });
    const sheets = await getSheets();
    const r   = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const idx = (r.data.values || []).findIndex(row => row[0] === login && (row[4] || 'default') === agencyId);
    if (idx < 0) return res.json({ success: false, error: 'Аккаунт не найден' });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!B${idx + 2}`,
      valueInputOption: 'RAW', requestBody: { values: [[hashPwd(password)]] },
    });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ════════════════════════════════════════════════════
//  МЕНЕДЖЕРЫ (из Аккаунтов, только своего агентства)
// ════════════════════════════════════════════════════

app.get('/api/managers', async (req, res) => {
  try {
    const agencyId = req.session?.agencyId || 'default';
    const sheets = await getSheets();
    await ensureSheet(sheets, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID']);
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const rows = r.data.values || [];
    const names = [...new Set(
      rows
        .filter(row => (row[4] || 'default') === agencyId)
        .map(row => (row[2] || '').trim())
        .filter(Boolean)
    )];
    res.json({ success: true, managers: names });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ════════════════════════════════════════════════════
//  УНИВЕРСАЛЬНЫЙ CRUD ДЛЯ СПРАВОЧНИКОВ
//  Колонки: A=Название, B=AgencyID
// ════════════════════════════════════════════════════

function makeListRouter(sheetName) {
  return {
    async getAll(req, res) {
      try {
        const agencyId = req.session?.agencyId || 'default';
        const sheets = await getSheets();
        await ensureSheet(sheets, sheetName, ['Название', 'AgencyID']);
        const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A2:B` });
        const items = (r.data.values || [])
          .filter(row => (row[1] || 'default') === agencyId)
          .map(row => row[0])
          .filter(Boolean);
        res.json({ success: true, items });
      } catch (e) { res.json({ success: false, error: e.message }); }
    },
    async add(req, res) {
      try {
        const agencyId = req.session?.agencyId || 'default';
        const name = String(req.body.name || '').trim();
        if (!name) return res.json({ success: false, error: 'Пустое название' });
        const sheets = await getSheets();
        await ensureSheet(sheets, sheetName, ['Название', 'AgencyID']);
        const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A2:B` });
        const agencyItems = (r.data.values || [])
          .filter(row => (row[1] || 'default') === agencyId)
          .map(row => row[0]);
        if (agencyItems.map(v => v.toLowerCase()).includes(name.toLowerCase()))
          return res.json({ success: false, error: 'Уже существует' });
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A:B`, valueInputOption: 'RAW',
          requestBody: { values: [[name, agencyId]] },
        });
        const updated = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A2:B` });
        const items = (updated.data.values || [])
          .filter(row => (row[1] || 'default') === agencyId)
          .map(row => row[0]).filter(Boolean);
        res.json({ success: true, items });
      } catch (e) { res.json({ success: false, error: e.message }); }
    },
    async remove(req, res) {
      try {
        const agencyId = req.session?.agencyId || 'default';
        const name   = decodeURIComponent(req.params.name);
        const sheets = await getSheets();
        const meta   = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheet  = meta.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) return res.json({ success: false, error: 'Не найдено' });
        const r   = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A2:B` });
        const idx = (r.data.values || []).findIndex(row => row[0] === name && (row[1] || 'default') === agencyId);
        if (idx === -1) return res.json({ success: false, error: 'Не найдено' });
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }] },
        });
        const updated = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A2:B` });
        const items = (updated.data.values || [])
          .filter(row => (row[1] || 'default') === agencyId)
          .map(row => row[0]).filter(Boolean);
        res.json({ success: true, items });
      } catch (e) { res.json({ success: false, error: e.message }); }
    },
  };
}

const directionsRouter = makeListRouter(DIRECTIONS_SHEET);
app.get('/api/directions',          directionsRouter.getAll);
app.post('/api/directions',         directionsRouter.add);
app.delete('/api/directions/:name', directionsRouter.remove);

const hotelsRouter = makeListRouter(HOTELS_SHEET);
app.get('/api/hotels',          hotelsRouter.getAll);
app.post('/api/hotels',         hotelsRouter.add);
app.delete('/api/hotels/:name', hotelsRouter.remove);

const sourcesRouter = makeListRouter(SOURCES_SHEET);
app.get('/api/sources',          sourcesRouter.getAll);
app.post('/api/sources',         sourcesRouter.add);
app.delete('/api/sources/:name', sourcesRouter.remove);

// ════════════════════════════════════════════════════
//  ПРОДАЖИ
//  A–S (19 колонок) + T=AgencyID
// ════════════════════════════════════════════════════

const SALE_HEADERS = [
  'Дата','Номер договора','Менеджер','Кол-во продаж','Дата брони',
  'Клиент','Направление','Отель','Телефон','Источник',
  'Сумма','Валюта','Комиссия ($)','Скидка ($)','Остаток ($)',
  'Курс','Нетто','Предоплата','Долг клиента','AgencyID',
];

app.post('/api/sales', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' });
  const agencyId = req.session.agencyId || 'default';
  try {
    const { contractNumber, salesCount, bookingDate, clientName, direction, hotel, phone, source, amount, currency, commission, discount, rate, netto, prepayment } = req.body;
    const manager = req.session.role === 'manager' ? req.session.name : (req.body.manager || '');
    if (!contractNumber || !manager || !salesCount)
      return res.json({ success: false, error: 'Заполните обязательные поля' });
    const sheets    = await getSheets();
    const sheetName = currentMonthSheet();
    await ensureSheet(sheets, sheetName, SALE_HEADERS);
    const debt = (amount && prepayment) ? Math.round((Number(amount) - Number(prepayment)) * 100) / 100 : '';
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A:T`, valueInputOption: 'RAW',
      requestBody: { values: [[
        new Date().toISOString(), contractNumber.trim(), manager, Number(salesCount),
        bookingDate || '', clientName || '', direction || '', hotel || '', phone || '', source || '',
        amount ? Number(amount) : '', currency || '',
        commission ? Number(commission) : '', discount ? Number(discount) : '',
        commission ? Math.round((Number(commission) - (Number(discount) || 0)) * 100) / 100 : '',
        rate ? Number(rate) : '',
        netto ? Number(netto) : '', prepayment ? Number(prepayment) : '', debt,
        agencyId,
      ]] },
    });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/sales', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' });
  const agencyId = req.session.agencyId || 'default';
  try {
    const sheets = await getSheets();
    const meta   = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const titles = meta.data.sheets.map(s => s.properties.title).filter(isSalesSheet);
    const allRows = [];
    for (const title of titles) {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${title}!A2:T` });
      (r.data.values || []).forEach((row, i) => {
        const rowAgencyId = row[19] || 'default';
        if (rowAgencyId !== agencyId) return; // изоляция по агентству
        allRows.push({
          id            : `${title}|${i + 2}`,
          date          : row[0]  || '',
          contractNumber: row[1]  || '',
          manager       : row[2]  || '',
          salesCount    : Number(row[3])  || 0,
          bookingDate   : row[4]  || '',
          clientName    : row[5]  || '',
          direction     : row[6]  || '',
          hotel         : row[7]  || '',
          phone         : row[8]  || '',
          source        : row[9]  || '',
          amount        : row[10] ? Number(row[10]) : null,
          currency      : row[11] || '',
          commission    : row[12] ? Number(row[12]) : null,
          discount      : row[13] ? Number(row[13]) : null,
          balance       : row[14] ? Number(row[14]) : null,
          rate          : row[15] ? Number(row[15]) : null,
          netto         : row[16] ? Number(row[16]) : null,
          prepayment    : row[17] ? Number(row[17]) : null,
          debt          : row[18] ? Number(row[18]) : null,
        });
      });
    }
    const result = req.session.role === 'manager'
      ? allRows.filter(s => s.manager === req.session.name)
      : allRows;
    result.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, sales: result });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.put('/api/sales/:id', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' });
  try {
    const rawId      = decodeURIComponent(req.params.id);
    const lastPipe   = rawId.lastIndexOf('|');
    const sheetTitle = rawId.slice(0, lastPipe);
    const rowIndex   = parseInt(rawId.slice(lastPipe + 1));
    const sheets = await getSheets();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `${sheetTitle}!D${rowIndex}`,
      valueInputOption: 'RAW', requestBody: { values: [[Number(req.body.salesCount)]] },
    });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.delete('/api/sales/:id', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' });
  try {
    const rawId      = decodeURIComponent(req.params.id);
    const lastPipe   = rawId.lastIndexOf('|');
    const sheetTitle = rawId.slice(0, lastPipe);
    const rowIndex   = parseInt(rawId.slice(lastPipe + 1));
    const sheets = await getSheets();
    const meta   = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet  = meta.data.sheets.find(s => s.properties.title === sheetTitle);
    if (!sheet) return res.json({ success: false, error: 'Лист не найден' });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody  : { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }] },
    });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── Фронтенд (в продакшене) ──────────────────────────
const DIST = path.join(__dirname, '../frontend/dist');
if (require('fs').existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Backend: http://localhost:${PORT}`));
