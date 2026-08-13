const express    = require('express');
const cors       = require('cors');
const crypto     = require('crypto');
const { google } = require('googleapis');
const path       = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Мастер-таблица: хранит список агентств + глобальные аккаунты
const MASTER_SPREADSHEET_ID = '1EcmuWFgyBLp3BH5RxWC50iAmTarnz9dosFZnE7ZQQlY';

// Пароль разработчика (суперадмин-панель)
const DEV_SECRET = process.env.DEV_SECRET || 'rasim-dev-2026';

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

const SALE_HEADERS = [
  'Дата','Номер договора','Менеджер','Кол-во продаж','Дата брони',
  'Клиент','Направление','Отель','Телефон','Источник',
  'Сумма','Валюта','Комиссия ($)','Скидка ($)','Остаток ($)',
  'Курс','Нетто','Предоплата','Долг клиента',
  'Способ оплаты','Сумма UZS','Сумма USD ($)',
  'Дата вылета','Дата прилета','Срок оплаты остатка',
];

function currentMonthSheet() {
  const d = new Date();
  return `${MONTH_NAMES_RU[d.getMonth()]} ${d.getFullYear()}`;
}
function isSalesSheet(title) {
  return title === SALES_SHEET || MONTH_NAMES_RU.some(m => title.startsWith(m + ' '));
}

// ── Google API auth ──────────────────────────────────
async function getAuth() {
  const authConfig = process.env.GOOGLE_CREDENTIALS_JSON
    ? { credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON) }
    : { keyFile: path.join(__dirname, 'credentials.json') };
  return new google.auth.GoogleAuth({
    ...authConfig,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}
async function getSheets() {
  return google.sheets({ version: 'v4', auth: await getAuth() });
}

// ── Убедиться что лист существует ───────────────────
async function ensureSheet(sheets, spreadsheetId, title, headers) {
  const meta  = await sheets.spreadsheets.get({ spreadsheetId });
  const found = meta.data.sheets.find(s => s.properties.title === title);
  if (!found) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `${title}!A1`,
      valueInputOption: 'RAW', requestBody: { values: [headers] },
    });
  }
}

// ── Настроить шаблон в новой таблице агентства ───────
async function setupAgencySheet(sheets, spreadsheetId, agencyName) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet1 = meta.data.sheets[0];

    // Переименовываем Sheet1 → шаблон импорта
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{
        updateSheetProperties: {
          properties: { sheetId: sheet1.properties.sheetId, title: '📋 Шаблон импорта' },
          fields: 'title',
        },
      }] },
    });

    // Записываем заголовки + примеры
    const today = new Date().toISOString().slice(0, 10);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: '📋 Шаблон импорта!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [
        SALE_HEADERS,
        [today, 'ДОГ-001', 'Менеджер Имя', '2', today, 'Иванов Иван', 'Турция', 'Rixos Premium Belek', '+7 777 123 4567', 'Instagram', '2500', 'USD', '300', '0', '300', '490', '2200', '1250', '1250'],
        [today, 'ДОГ-002', 'Менеджер Имя', '1', today, 'Петрова Мария', 'ОАЭ', 'Atlantis The Palm', '+7 701 987 6543', 'Сарафанка', '3000', 'USD', '350', '100', '250', '490', '2650', '1500', '1500'],
        ['⬆️ Это примеры. Удалите строки 2-3, вставьте свои данные. Не удаляйте строку 1 (заголовки). Таблица создана CRM-системой для агентства: ' + agencyName],
      ] },
    });
  } catch (e) {
    console.log('setupAgencySheet error (non-fatal):', e.message);
  }
}

// Агентства: A=AgencyID B=Название C=Email D=SpreadsheetID E=SpreadsheetURL F=Дата G=Avatar
const AGENCIES_HEADERS = ['AgencyID', 'Название', 'Email', 'SpreadsheetID', 'SpreadsheetURL', 'Дата', 'Avatar'];

// ── Получить spreadsheetId агентства ─────────────────
async function getAgencySpreadsheetId(sheets, agencyId) {
  if (!agencyId || agencyId === 'default') return MASTER_SPREADSHEET_ID;
  try {
    await ensureSheet(sheets, MASTER_SPREADSHEET_ID, AGENCIES_SHEET, AGENCIES_HEADERS);
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${AGENCIES_SHEET}!A2:G` });
    const row = (r.data.values || []).find(row => row[0] === agencyId);
    return row ? (row[3] || MASTER_SPREADSHEET_ID) : MASTER_SPREADSHEET_ID;
  } catch {
    return MASTER_SPREADSHEET_ID;
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

// helper: получить spreadsheetId из сессии (перс-агентство или мастер)
function sessionSpreadsheetId(req) {
  return req.session?.spreadsheetId || MASTER_SPREADSHEET_ID;
}

// ════════════════════════════════════════════════════
//  РЕГИСТРАЦИЯ АГЕНТСТВА
// ════════════════════════════════════════════════════

app.post('/api/register', async (req, res) => {
  try {
    const { agencyName, login, password, email, sheetUrl, avatar = '🏢' } = req.body;
    if (!agencyName?.trim() || !login?.trim() || !password)
      return res.json({ success: false, error: 'Заполните все поля' });
    if (!sheetUrl?.trim())
      return res.json({ success: false, error: 'Вставьте ссылку на вашу Google Таблицу' });

    const sheets = await getSheets();
    await ensureSheet(sheets, MASTER_SPREADSHEET_ID, AGENCIES_SHEET, AGENCIES_HEADERS);
    await ensureSheet(sheets, MASTER_SPREADSHEET_ID, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID']);

    // Проверяем уникальность логина глобально
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:A` });
    if ((r.data.values || []).flat().includes(login.trim()))
      return res.json({ success: false, error: 'Этот логин уже занят' });

    const agencyId = 'ag_' + Date.now().toString(36);
    const now = new Date().toISOString();

    // Извлекаем spreadsheetId из ссылки
    const match = sheetUrl.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match)
      return res.json({ success: false, error: 'Неверная ссылка. Скопируйте полную ссылку из браузера' });

    const spreadsheetId  = match[1];
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // Проверяем что таблица доступна (сервисный аккаунт имеет доступ)
    try {
      await sheets.spreadsheets.get({ spreadsheetId });
    } catch {
      return res.json({
        success: false,
        error: 'Таблица недоступна. Убедитесь что вы открыли доступ (Редактор) для: travel-crm-bot@travel-crm-497007.iam.gserviceaccount.com',
      });
    }

    // Настраиваем структуру листов в таблице агентства
    await setupAgencySheet(sheets, spreadsheetId, agencyName.trim());

    // Записываем агентство в мастер-таблицу
    await sheets.spreadsheets.values.append({
      spreadsheetId: MASTER_SPREADSHEET_ID, range: `${AGENCIES_SHEET}!A:G`, valueInputOption: 'RAW',
      requestBody: { values: [[agencyId, agencyName.trim(), email?.trim() || '', spreadsheetId, spreadsheetUrl, now, avatar]] },
    });

    // Записываем аккаунт администратора в мастер-таблицу
    await sheets.spreadsheets.values.append({
      spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A:E`, valueInputOption: 'RAW',
      requestBody: { values: [[login.trim(), hashPwd(password), 'Администратор', 'admin', agencyId]] },
    });

    const token = signToken({ login: login.trim(), role: 'admin', name: 'Администратор', agencyId, spreadsheetId, avatar });
    res.json({
      success: true, token, role: 'admin', name: 'Администратор',
      agencyId, spreadsheetId, spreadsheetUrl, agencyName: agencyName.trim(), avatar,
    });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login?.trim() || !password) return res.json({ success: false, error: 'Заполните поля' });
    const sheets = await getSheets();
    await ensureSheet(sheets, MASTER_SPREADSHEET_ID, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID']);
    const r    = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const rows = r.data.values || [];
    const hash = hashPwd(password);

    // Fallback admin если таблица пуста
    if (rows.length === 0 && login.trim() === 'admin' && hash === hashPwd('1234')) {
      const token = signToken({ login: 'admin', role: 'admin', name: 'Администратор', agencyId: 'default', spreadsheetId: MASTER_SPREADSHEET_ID });
      return res.json({ success: true, token, role: 'admin', name: 'Администратор', agencyId: 'default', spreadsheetId: MASTER_SPREADSHEET_ID });
    }

    const found = rows.find(row => row[0] === login.trim() && row[1] === hash);
    if (!found) return res.json({ success: false, error: 'Неверный логин или пароль' });

    const role     = found[3] || 'manager';
    const name     = found[2] || login.trim();
    const agencyId = found[4] || 'default';

    // Получаем spreadsheetId и аватарку агентства
    const spreadsheetId = await getAgencySpreadsheetId(sheets, agencyId);
    let avatar = '🏢';
    if (agencyId !== 'default') {
      try {
        const ar = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${AGENCIES_SHEET}!A2:G` });
        const agRow = (ar.data.values || []).find(r => r[0] === agencyId);
        if (agRow?.[6]) avatar = agRow[6];
      } catch {}
    }

    const token = signToken({ login: login.trim(), role, name, agencyId, spreadsheetId, avatar });
    res.json({ success: true, token, role, name, agencyId, spreadsheetId, avatar });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ════════════════════════════════════════════════════
//  АККАУНТЫ (всегда в мастер-таблице, фильтр по agencyId)
// ════════════════════════════════════════════════════

app.get('/api/accounts', async (req, res) => {
  if (req.session?.role !== 'admin') return res.json({ success: false, error: 'Доступ запрещён' });
  const agencyId = req.session.agencyId || 'default';
  try {
    const sheets = await getSheets();
    await ensureSheet(sheets, MASTER_SPREADSHEET_ID, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID']);
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
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
    await ensureSheet(sheets, MASTER_SPREADSHEET_ID, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID']);
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:A` });
    if ((r.data.values || []).flat().includes(login.trim()))
      return res.json({ success: false, error: 'Логин уже существует' });
    await sheets.spreadsheets.values.append({
      spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A:E`, valueInputOption: 'RAW',
      requestBody: { values: [[login.trim(), hashPwd(password), manager || '', role, agencyId]] },
    });
    const updated = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
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
    const meta   = await sheets.spreadsheets.get({ spreadsheetId: MASTER_SPREADSHEET_ID });
    const sheet  = meta.data.sheets.find(s => s.properties.title === ACCOUNTS_SHEET);
    if (!sheet) return res.json({ success: false, error: 'Не найдено' });
    const r   = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const idx = (r.data.values || []).findIndex(row => row[0] === login && (row[4] || 'default') === agencyId);
    if (idx < 0) return res.json({ success: false, error: 'Аккаунт не найден' });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: MASTER_SPREADSHEET_ID,
      requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }] },
    });
    const updated = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const rows = (updated.data.values || []).filter(row => (row[4] || 'default') === agencyId);
    res.json({ success: true, accounts: rows.map(row => ({ login: row[0], manager: row[2], role: row[3] })) });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.put('/api/accounts/:login', async (req, res) => {
  if (req.session?.role !== 'admin') return res.json({ success: false, error: 'Доступ запрещён' });
  const agencyId   = req.session.agencyId || 'default';
  const loginParam = decodeURIComponent(req.params.login);
  try {
    const { manager, role, newLogin } = req.body;
    const sheets = await getSheets();
    const r   = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const rows = r.data.values || [];
    const idx  = rows.findIndex(row => row[0] === loginParam && (row[4] || 'default') === agencyId);
    if (idx < 0) return res.json({ success: false, error: 'Аккаунт не найден' });

    // Проверяем уникальность нового логина (если меняется)
    if (newLogin && newLogin.trim() !== loginParam) {
      if (rows.some(row => row[0] === newLogin.trim()))
        return res.json({ success: false, error: 'Логин уже занят' });
    }

    const rowNum = idx + 2;
    const batchData = [];
    if (newLogin && newLogin.trim()) batchData.push({ range: `${ACCOUNTS_SHEET}!A${rowNum}`, values: [[newLogin.trim()]] });
    if (manager !== undefined)       batchData.push({ range: `${ACCOUNTS_SHEET}!C${rowNum}`, values: [[manager]] });
    if (role    !== undefined)       batchData.push({ range: `${ACCOUNTS_SHEET}!D${rowNum}`, values: [[role]] });

    if (batchData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: MASTER_SPREADSHEET_ID,
        requestBody: { valueInputOption: 'RAW', data: batchData },
      });
    }

    const updated = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const agRows  = (updated.data.values || []).filter(row => (row[4] || 'default') === agencyId);
    res.json({ success: true, accounts: agRows.map(row => ({ login: row[0], manager: row[2], role: row[3] })) });
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
    const r   = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
    const idx = (r.data.values || []).findIndex(row => row[0] === login && (row[4] || 'default') === agencyId);
    if (idx < 0) return res.json({ success: false, error: 'Аккаунт не найден' });
    await sheets.spreadsheets.values.update({
      spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!B${idx + 2}`,
      valueInputOption: 'RAW', requestBody: { values: [[hashPwd(password)]] },
    });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ════════════════════════════════════════════════════
//  МЕНЕДЖЕРЫ (из мастер Аккаунтов, фильтр по agencyId)
// ════════════════════════════════════════════════════

app.get('/api/managers', async (req, res) => {
  try {
    const agencyId = req.session?.agencyId || 'default';
    const sheets = await getSheets();
    await ensureSheet(sheets, MASTER_SPREADSHEET_ID, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID']);
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
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

// ── Информация об агентстве ────────────────────────
app.get('/api/agency', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' });
  const agencyId = req.session.agencyId || 'default';
  const spreadsheetId = req.session.spreadsheetId || MASTER_SPREADSHEET_ID;
  try {
    if (agencyId === 'default') {
      return res.json({ success: true, agency: { name: 'Основное агентство', spreadsheetId, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` } });
    }
    const sheets = await getSheets();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${AGENCIES_SHEET}!A2:F` });
    const row = (r.data.values || []).find(row => row[0] === agencyId);
    if (!row) return res.json({ success: true, agency: { name: 'Агентство', spreadsheetId, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` } });
    res.json({ success: true, agency: { name: row[1], email: row[2], spreadsheetId: row[3], spreadsheetUrl: row[4] } });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ════════════════════════════════════════════════════
//  СПРАВОЧНИКИ (в таблице агентства)
// ════════════════════════════════════════════════════

function makeListRouter(sheetName) {
  // Для мастер-таблицы: фильтрация по agencyId (колонка B)
  // Для отдельной таблицы: просто читаем/пишем колонку A
  return {
    async getAll(req, res) {
      try {
        const spreadsheetId = sessionSpreadsheetId(req);
        const agencyId      = req.session?.agencyId || 'default';
        const isMaster      = spreadsheetId === MASTER_SPREADSHEET_ID;
        const sheets        = await getSheets();

        if (isMaster) {
          await ensureSheet(sheets, spreadsheetId, sheetName, ['Название', 'AgencyID']);
          const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A2:B` });
          const items = (r.data.values || [])
            .filter(row => (row[1] || 'default') === agencyId)
            .map(row => row[0]).filter(Boolean);
          return res.json({ success: true, items });
        } else {
          await ensureSheet(sheets, spreadsheetId, sheetName, ['Название']);
          const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A2:A` });
          return res.json({ success: true, items: (r.data.values || []).flat().filter(Boolean) });
        }
      } catch (e) { res.json({ success: false, error: e.message }); }
    },

    async add(req, res) {
      try {
        const spreadsheetId = sessionSpreadsheetId(req);
        const agencyId      = req.session?.agencyId || 'default';
        const isMaster      = spreadsheetId === MASTER_SPREADSHEET_ID;
        const name          = String(req.body.name || '').trim();
        if (!name) return res.json({ success: false, error: 'Пустое название' });
        const sheets = await getSheets();

        if (isMaster) {
          await ensureSheet(sheets, spreadsheetId, sheetName, ['Название', 'AgencyID']);
          const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A2:B` });
          const existing = (r.data.values || []).filter(row => (row[1] || 'default') === agencyId).map(row => row[0]);
          if (existing.map(v => v.toLowerCase()).includes(name.toLowerCase()))
            return res.json({ success: false, error: 'Уже существует' });
          await sheets.spreadsheets.values.append({ spreadsheetId, range: `${sheetName}!A:B`, valueInputOption: 'RAW', requestBody: { values: [[name, agencyId]] } });
          const updated = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A2:B` });
          const items = (updated.data.values || []).filter(row => (row[1] || 'default') === agencyId).map(row => row[0]).filter(Boolean);
          return res.json({ success: true, items });
        } else {
          await ensureSheet(sheets, spreadsheetId, sheetName, ['Название']);
          const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A2:A` });
          if ((r.data.values || []).flat().map(v => v.toLowerCase()).includes(name.toLowerCase()))
            return res.json({ success: false, error: 'Уже существует' });
          await sheets.spreadsheets.values.append({ spreadsheetId, range: `${sheetName}!A:A`, valueInputOption: 'RAW', requestBody: { values: [[name]] } });
          const updated = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A2:A` });
          return res.json({ success: true, items: (updated.data.values || []).flat().filter(Boolean) });
        }
      } catch (e) { res.json({ success: false, error: e.message }); }
    },

    async remove(req, res) {
      try {
        const spreadsheetId = sessionSpreadsheetId(req);
        const agencyId      = req.session?.agencyId || 'default';
        const isMaster      = spreadsheetId === MASTER_SPREADSHEET_ID;
        const name          = decodeURIComponent(req.params.name);
        const sheets        = await getSheets();
        const meta          = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet         = meta.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) return res.json({ success: false, error: 'Не найдено' });

        let idx;
        if (isMaster) {
          const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A2:B` });
          idx = (r.data.values || []).findIndex(row => row[0] === name && (row[1] || 'default') === agencyId);
        } else {
          const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A2:A` });
          idx = (r.data.values || []).findIndex(row => row[0] === name);
        }
        if (idx === -1) return res.json({ success: false, error: 'Не найдено' });

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }] },
        });

        if (isMaster) {
          const updated = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A2:B` });
          const items = (updated.data.values || []).filter(row => (row[1] || 'default') === agencyId).map(row => row[0]).filter(Boolean);
          return res.json({ success: true, items });
        } else {
          const updated = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A2:A` });
          return res.json({ success: true, items: (updated.data.values || []).flat().filter(Boolean) });
        }
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
//  ПРОДАЖИ (в таблице агентства)
// ════════════════════════════════════════════════════

app.post('/api/sales', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' });
  const spreadsheetId = sessionSpreadsheetId(req);
  try {
    const { contractNumber, salesCount, bookingDate, clientName, direction, hotel, phone, source, amount, currency, commission, discount, rate, netto, prepayment, paymentMethod, paymentUZS, paymentUSD, departureDate, arrivalDate, dueDate } = req.body;
    const manager = req.session.role === 'manager' ? req.session.name : (req.body.manager || '');
    if (!contractNumber || !manager || !salesCount)
      return res.json({ success: false, error: 'Заполните обязательные поля' });
    const sheets    = await getSheets();
    const sheetName = currentMonthSheet();
    await ensureSheet(sheets, spreadsheetId, sheetName, SALE_HEADERS);
    const debt = (amount && prepayment) ? Math.round((Number(amount) - Number(prepayment)) * 100) / 100 : '';
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: `${sheetName}!A:Y`, valueInputOption: 'RAW',
      requestBody: { values: [[
        new Date().toISOString(), contractNumber.trim(), manager, Number(salesCount),
        bookingDate || '', clientName || '', direction || '', hotel || '', phone || '', source || '',
        amount ? Number(amount) : '', currency || '',
        commission ? Number(commission) : '', discount ? Number(discount) : '',
        commission ? Math.round((Number(commission) - (Number(discount) || 0)) * 100) / 100 : '',
        rate ? Number(rate) : '',
        netto ? Number(netto) : '', prepayment ? Number(prepayment) : '', debt,
        paymentMethod || '',
        paymentUZS ? Number(paymentUZS) : '',
        paymentUSD ? Number(paymentUSD) : '',
        departureDate || '', arrivalDate || '', dueDate || '',
      ]] },
    });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/sales', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' });
  const spreadsheetId = sessionSpreadsheetId(req);
  try {
    const sheets = await getSheets();
    const meta   = await sheets.spreadsheets.get({ spreadsheetId });
    const titles = meta.data.sheets.map(s => s.properties.title).filter(isSalesSheet);
    const allRows = [];
    for (const title of titles) {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:Y` });
      (r.data.values || []).forEach((row, i) => {
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
          paymentMethod : row[19] || '',
          paymentUZS    : row[20] ? Number(row[20]) : null,
          paymentUSD    : row[21] ? Number(row[21]) : null,
          departureDate : row[22] || '',
          arrivalDate   : row[23] || '',
          dueDate       : row[24] || '',
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
  const spreadsheetId = sessionSpreadsheetId(req);
  try {
    const rawId      = decodeURIComponent(req.params.id);
    const lastPipe   = rawId.lastIndexOf('|');
    const sheetTitle = rawId.slice(0, lastPipe);
    const rowIndex   = parseInt(rawId.slice(lastPipe + 1));
    const sheets = await getSheets();
    // Поддерживаем обновление нескольких полей
    // col + type для каждого редактируемого поля
    const UPDATABLE = {
      contractNumber: { col: 'B', type: 'str' },
      manager:        { col: 'C', type: 'str' },
      salesCount:     { col: 'D', type: 'num' },
      bookingDate:    { col: 'E', type: 'str' },
      clientName:     { col: 'F', type: 'str' },
      direction:      { col: 'G', type: 'str' },
      hotel:          { col: 'H', type: 'str' },
      phone:          { col: 'I', type: 'str' },
      source:         { col: 'J', type: 'str' },
      amount:         { col: 'K', type: 'num' },
      currency:       { col: 'L', type: 'str' },
      commission:     { col: 'M', type: 'num' },
      discount:       { col: 'N', type: 'num' },
      balance:        { col: 'O', type: 'num' },
      prepayment:     { col: 'R', type: 'num' },
      debt:           { col: 'S', type: 'num' },
      paymentMethod:  { col: 'T', type: 'str' },
      departureDate:  { col: 'W', type: 'str' },
      arrivalDate:    { col: 'X', type: 'str' },
      dueDate:        { col: 'Y', type: 'str' },
    };
    const batchData = [];
    for (const [field, { col, type }] of Object.entries(UPDATABLE)) {
      if (req.body[field] !== undefined) {
        const raw = req.body[field];
        const val = (raw === '' || raw === null) ? '' : (type === 'num' ? Number(raw) : String(raw));
        batchData.push({ range: `${sheetTitle}!${col}${rowIndex}`, values: [[val]] });
      }
    }
    if (batchData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'RAW', data: batchData },
      });
    }
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.delete('/api/sales/:id', async (req, res) => {
  if (!req.session) return res.json({ success: false, error: 'Не авторизован' });
  const spreadsheetId = sessionSpreadsheetId(req);
  try {
    const rawId      = decodeURIComponent(req.params.id);
    const lastPipe   = rawId.lastIndexOf('|');
    const sheetTitle = rawId.slice(0, lastPipe);
    const rowIndex   = parseInt(rawId.slice(lastPipe + 1));
    const sheets = await getSheets();
    const meta   = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet  = meta.data.sheets.find(s => s.properties.title === sheetTitle);
    if (!sheet) return res.json({ success: false, error: 'Лист не найден' });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }] },
    });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ════════════════════════════════════════════════════
//  DEV ADMIN (суперадмин разработчика)
// ════════════════════════════════════════════════════

function devAuth(req, res, next) {
  const token = verifyToken((req.headers.authorization || '').replace('Bearer ', ''));
  if (!token || token.role !== 'superadmin') return res.status(403).json({ success: false, error: 'Нет доступа' });
  next();
}

app.post('/api/dev/login', (req, res) => {
  const { password } = req.body;
  if (password !== DEV_SECRET) return res.json({ success: false, error: 'Неверный пароль' });
  const token = signToken({ role: 'superadmin', name: 'Developer' });
  res.json({ success: true, token });
});

app.get('/api/dev/agencies', devAuth, async (req, res) => {
  try {
    const sheets = await getSheets();
    await ensureSheet(sheets, MASTER_SPREADSHEET_ID, AGENCIES_SHEET, AGENCIES_HEADERS);
    await ensureSheet(sheets, MASTER_SPREADSHEET_ID, ACCOUNTS_SHEET, ['Логин', 'Пароль', 'Менеджер', 'Роль', 'AgencyID']);

    const [agR, acR] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${AGENCIES_SHEET}!A2:G` }),
      sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` }),
    ]);

    const accounts = acR.data.values || [];
    const agencies = (agR.data.values || []).map(row => ({
      id:            row[0] || '',
      name:          row[1] || '',
      email:         row[2] || '',
      spreadsheetId: row[3] || '',
      spreadsheetUrl:row[4] || '',
      createdAt:     row[5] || '',
      avatar:        row[6] || '🏢',
      accountCount:  accounts.filter(a => (a[4] || 'default') === (row[0] || '')).length,
    }));

    // Добавляем «default» агентство (старые данные)
    const defaultAccounts = accounts.filter(a => !a[4] || a[4] === 'default');
    if (defaultAccounts.length > 0) {
      agencies.unshift({
        id: 'default', name: '(Основное / без регистрации)', email: '', avatar: '🏠',
        spreadsheetId: MASTER_SPREADSHEET_ID,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${MASTER_SPREADSHEET_ID}/edit`,
        createdAt: '', accountCount: defaultAccounts.length,
      });
    }

    res.json({ success: true, agencies });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.delete('/api/dev/agencies/:agencyId', devAuth, async (req, res) => {
  const agencyId = req.params.agencyId;
  if (agencyId === 'default') return res.json({ success: false, error: 'Нельзя удалить основное агентство' });
  try {
    const sheets = await getSheets();
    const meta   = await sheets.spreadsheets.get({ spreadsheetId: MASTER_SPREADSHEET_ID });

    // Удаляем из Агентства
    const agSheet = meta.data.sheets.find(s => s.properties.title === AGENCIES_SHEET);
    if (agSheet) {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${AGENCIES_SHEET}!A2:A` });
      const idx = (r.data.values || []).findIndex(row => row[0] === agencyId);
      if (idx >= 0) {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: MASTER_SPREADSHEET_ID, requestBody: { requests: [{
          deleteDimension: { range: { sheetId: agSheet.properties.sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } }
        }] } });
      }
    }

    // Удаляем аккаунты этого агентства из Аккаунты (с конца, чтобы не сбивались индексы)
    const acSheet = meta.data.sheets.find(s => s.properties.title === ACCOUNTS_SHEET);
    if (acSheet) {
      const r2 = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SPREADSHEET_ID, range: `${ACCOUNTS_SHEET}!A2:E` });
      const rows = r2.data.values || [];
      const toDelete = rows.map((row, i) => i).filter(i => (rows[i][4] || 'default') === agencyId).reverse();
      for (const i of toDelete) {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: MASTER_SPREADSHEET_ID, requestBody: { requests: [{
          deleteDimension: { range: { sheetId: acSheet.properties.sheetId, dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 } }
        }] } });
      }
    }

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
