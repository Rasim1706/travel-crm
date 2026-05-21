const express    = require('express');
const cors       = require('cors');
const { google } = require('googleapis');
const path       = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const SPREADSHEET_ID = '1EcmuWFgyBLp3BH5RxWC50iAmTarnz9dosFZnE7ZQQlY';
const SALES_SHEET    = 'Продажи';
const MANAGERS_SHEET = 'Менеджеры';

const MONTH_NAMES_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

function currentMonthSheet() {
  const d = new Date();
  return `${MONTH_NAMES_RU[d.getMonth()]} ${d.getFullYear()}`;
}

function isSalesSheet(title) {
  return title === SALES_SHEET ||
    MONTH_NAMES_RU.some(m => title.startsWith(m + ' '));
}

// ── Google Sheets auth ───────────────────────────────
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credentials.json'),
    scopes : ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// ── Создать лист если не существует ─────────────────
async function ensureSheet(sheets, title, headers) {
  const meta  = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const found = meta.data.sheets.find(s => s.properties.title === title);
  if (!found) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody : { requests: [{ addSheet: { properties: { title } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId  : SPREADSHEET_ID,
      range          : `${title}!A1`,
      valueInputOption: 'RAW',
      requestBody    : { values: [headers] },
    });
  }
}

// ── Парсинг дат из таблицы ───────────────────────────
function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d)) return d;
  const m = String(str).match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

// ════════════════════════════════════════════════════
//  МЕНЕДЖЕРЫ
// ════════════════════════════════════════════════════

app.get('/api/managers', async (req, res) => {
  try {
    const sheets = await getSheets();
    await ensureSheet(sheets, MANAGERS_SHEET, ['Имя']);
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range        : `${MANAGERS_SHEET}!A2:A`,
    });
    const managers = (r.data.values || []).flat().filter(Boolean);
    res.json({ success: true, managers });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.post('/api/managers', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.json({ success: false, error: 'Пустое имя' });

    const sheets = await getSheets();
    await ensureSheet(sheets, MANAGERS_SHEET, ['Имя']);

    const r        = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${MANAGERS_SHEET}!A2:A` });
    const existing = (r.data.values || []).flat().map(v => v.toLowerCase());
    if (existing.includes(name.toLowerCase())) {
      return res.json({ success: false, error: 'Менеджер уже существует' });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId   : SPREADSHEET_ID,
      range           : `${MANAGERS_SHEET}!A:A`,
      valueInputOption: 'RAW',
      requestBody     : { values: [[name]] },
    });

    const updated  = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${MANAGERS_SHEET}!A2:A` });
    const managers = (updated.data.values || []).flat().filter(Boolean);
    res.json({ success: true, managers });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.delete('/api/managers/:name', async (req, res) => {
  try {
    const name   = decodeURIComponent(req.params.name);
    const sheets = await getSheets();
    const meta   = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });

    // ── Удалить менеджера из листа Менеджеры ────────
    const mgrR    = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${MANAGERS_SHEET}!A2:A` });
    const mgrRows = mgrR.data.values || [];
    const mgrIdx  = mgrRows.findIndex(row => row[0] === name);
    if (mgrIdx === -1) return res.json({ success: false, error: 'Менеджер не найден' });

    const mgrSheet   = meta.data.sheets.find(s => s.properties.title === MANAGERS_SHEET);
    const mgrSheetId = mgrSheet.properties.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody  : { requests: [{ deleteDimension: { range: { sheetId: mgrSheetId, dimension: 'ROWS', startIndex: mgrIdx + 1, endIndex: mgrIdx + 2 } } }] },
    });

    // ── Удалить продажи этого менеджера из всех листов продаж ──
    const salesSheetTitles = meta.data.sheets
      .map(s => s.properties.title)
      .filter(isSalesSheet);

    for (const title of salesSheetTitles) {
      const sheetMeta = meta.data.sheets.find(s => s.properties.title === title);
      if (!sheetMeta) continue;
      const sheetId = sheetMeta.properties.sheetId;
      const sR = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${title}!A2:D` });
      const sRows = sR.data.values || [];
      const toDelete = sRows
        .map((row, i) => ({ row, i }))
        .filter(({ row }) => row[2] === name)
        .reverse();
      for (const { i } of toDelete) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody  : { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 } } }] },
        });
      }
    }

    const updated  = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${MANAGERS_SHEET}!A2:A` });
    const managers = (updated.data.values || []).flat().filter(Boolean);
    res.json({ success: true, managers });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ════════════════════════════════════════════════════
//  ПРОДАЖИ
// ════════════════════════════════════════════════════

app.post('/api/sales', async (req, res) => {
  try {
    const { contractNumber, manager, salesCount, bookingDate } = req.body;
    if (!contractNumber || !manager || !salesCount) {
      return res.json({ success: false, error: 'Заполните все поля' });
    }
    const sheets    = await getSheets();
    const sheetName = currentMonthSheet();
    await ensureSheet(sheets, sheetName, ['Дата', 'Номер договора', 'Менеджер', 'Кол-во продаж', 'Дата брони']);

    await sheets.spreadsheets.values.append({
      spreadsheetId   : SPREADSHEET_ID,
      range           : `${sheetName}!A:E`,
      valueInputOption: 'RAW',
      requestBody     : { values: [[new Date().toISOString(), contractNumber.trim(), manager, Number(salesCount), bookingDate || '']] },
    });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/api/sales', async (req, res) => {
  try {
    const sheets = await getSheets();
    const meta   = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });

    const salesSheetTitles = meta.data.sheets
      .map(s => s.properties.title)
      .filter(isSalesSheet);

    const allRows = [];
    for (const title of salesSheetTitles) {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range        : `${title}!A2:E`,
      });
      (r.data.values || []).forEach((row, i) => {
        allRows.push({
          id            : `${title}|${i + 2}`,
          date          : row[0] || '',
          contractNumber: row[1] || '',
          manager       : row[2] || '',
          salesCount    : Number(row[3]) || 0,
          bookingDate   : row[4] || '',
        });
      });
    }

    allRows.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, sales: allRows });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.put('/api/sales/:id', async (req, res) => {
  try {
    const rawId    = decodeURIComponent(req.params.id);
    const lastPipe = rawId.lastIndexOf('|');
    const sheetTitle = rawId.slice(0, lastPipe);
    const rowIndex   = parseInt(rawId.slice(lastPipe + 1));
    const { salesCount } = req.body;

    const sheets = await getSheets();
    await sheets.spreadsheets.values.update({
      spreadsheetId   : SPREADSHEET_ID,
      range           : `${sheetTitle}!D${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody     : { values: [[Number(salesCount)]] },
    });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.delete('/api/sales/:id', async (req, res) => {
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
      requestBody  : { requests: [{ deleteDimension: { range: {
        sheetId   : sheet.properties.sheetId,
        dimension : 'ROWS',
        startIndex: rowIndex - 1,
        endIndex  : rowIndex,
      } } }] },
    });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Backend: http://localhost:${PORT}`));
