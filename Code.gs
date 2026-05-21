// ======================================================
//  CRM Турагентство — Google Apps Script (Code.gs)
//
//  НАСТРОЙКА: вставьте ID вашей Google таблицы ниже.
//  Найти его можно в URL таблицы:
//  https://docs.google.com/spreadsheets/d/ВОТ_ЭТОТ_ID/edit
// ======================================================

const SPREADSHEET_ID  = '1EcmuWFgyBLp3BH5RxWC50iAmTarnz9dosFZnE7ZQQlY';
const SHEET_NAME      = 'Продажи';
const MANAGERS_SHEET  = 'Менеджеры';

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'ВСТАВЬТЕ_ID_ТАБЛИЦЫ_СЮДА') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  // Если скрипт открыт через Расширения → Apps Script внутри таблицы
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ── Точка входа ──────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CRM — Отдел продаж')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Вспомогательная: получить лист менеджеров ────────
function getManagersSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(MANAGERS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(MANAGERS_SHEET);
    sheet.appendRow(['Имя']);
    sheet.getRange(1, 1, 1, 1).setFontWeight('bold').setBackground('#4A90D9').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── Список менеджеров ─────────────────────────────────
function getManagers() {
  const sheet = getManagersSheet();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .flat()
    .filter(v => v !== '');
}

// ── Добавить менеджера ────────────────────────────────
function addManager(name) {
  name = name.trim();
  if (!name) return { success: false, error: 'Пустое имя' };

  const existing = getManagers().map(m => m.toLowerCase());
  if (existing.includes(name.toLowerCase())) {
    return { success: false, error: 'Менеджер уже существует' };
  }

  getManagersSheet().appendRow([name]);
  return { success: true, managers: getManagers() };
}

// ── Удалить менеджера ─────────────────────────────────
function removeManager(name) {
  const sheet = getManagersSheet();
  if (sheet.getLastRow() < 2) return { success: false, error: 'Список пуст' };

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === name) {
      sheet.deleteRow(i + 2);
      return { success: true, managers: getManagers() };
    }
  }
  return { success: false, error: 'Менеджер не найден' };
}

// ── Добавить запись продажи ───────────────────────────
function addSale(data) {
  try {
    const ss  = getSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['Дата', 'Номер договора', 'Менеджер', 'Кол-во продаж']);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#4A90D9').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      new Date(),
      data.contractNumber.trim(),
      data.manager,
      Number(data.salesCount)
    ]);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Статистика за текущую неделю ─────────────────────
function getWeeklyStats() {
  try {
    const ss    = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    const now       = new Date();
    const dayOfWeek = now.getDay();
    const monday    = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    if (!sheet || sheet.getLastRow() < 2) return emptyStats(monday, sunday);

    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    const stats = {};
    let totalContracts = 0;
    let totalSales     = 0;

    rows.forEach(row => {
      const date = new Date(row[0]);
      if (date < monday || date > sunday) return;
      const manager = row[2];
      const sales   = Number(row[3]) || 0;
      if (!stats[manager]) stats[manager] = { contracts: 0, sales: 0 };
      stats[manager].contracts++;
      stats[manager].sales += sales;
      totalContracts++;
      totalSales += sales;
    });

    return { success: true, stats, totalContracts, totalSales,
      weekStart: monday.toLocaleDateString('ru-RU'),
      weekEnd  : sunday.toLocaleDateString('ru-RU') };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Статистика за все недели (график) ────────────────
function getAllWeeksStats() {
  try {
    const ss    = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return { success: true, weeks: [] };

    const rows  = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    const weeks = {};

    rows.forEach(row => {
      const date = new Date(row[0]);
      const d    = date.getDay();
      const mon  = new Date(date);
      mon.setDate(date.getDate() - (d === 0 ? 6 : d - 1));
      mon.setHours(0, 0, 0, 0);
      const key = mon.toLocaleDateString('ru-RU');
      if (!weeks[key]) weeks[key] = { label: key, contracts: 0, sales: 0 };
      weeks[key].contracts++;
      weeks[key].sales += Number(row[3]) || 0;
    });

    return { success: true, weeks: Object.values(weeks).slice(-8) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function emptyStats(monday, sunday) {
  return { success: true, stats: {}, totalContracts: 0, totalSales: 0,
    weekStart: monday.toLocaleDateString('ru-RU'),
    weekEnd  : sunday.toLocaleDateString('ru-RU') };
}
