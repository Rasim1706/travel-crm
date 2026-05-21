// Mock-сервер для тестирования без Google credentials
const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── In-memory данные ─────────────────────────────────
let managers = ['Алия', 'Дамир', 'Гульнара'];
let nextId   = 4;

let sales = [
  { id: 0, date: new Date().toISOString(), contractNumber: 'ДГВ-001', manager: 'Алия',     salesCount: 2 },
  { id: 1, date: new Date().toISOString(), contractNumber: 'ДГВ-002', manager: 'Дамир',    salesCount: 1 },
  { id: 2, date: new Date().toISOString(), contractNumber: 'ДГВ-003', manager: 'Алия',     salesCount: 3 },
  { id: 3, date: new Date().toISOString(), contractNumber: 'ДГВ-004', manager: 'Гульнара', salesCount: 1 },
];

// ── Менеджеры ────────────────────────────────────────
app.get('/api/managers', (req, res) => {
  res.json({ success: true, managers });
});

app.post('/api/managers', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.json({ success: false, error: 'Пустое имя' });
  if (managers.map(m => m.toLowerCase()).includes(name.toLowerCase())) {
    return res.json({ success: false, error: 'Менеджер уже существует' });
  }
  managers.push(name);
  res.json({ success: true, managers });
});

app.delete('/api/managers/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const idx  = managers.indexOf(name);
  if (idx === -1) return res.json({ success: false, error: 'Менеджер не найден' });
  managers.splice(idx, 1);
  // Удаляем все продажи этого менеджера
  sales = sales.filter(s => s.manager !== name);
  res.json({ success: true, managers });
});

// ── Продажи ──────────────────────────────────────────
app.get('/api/sales', (req, res) => {
  res.json({ success: true, sales: [...sales].reverse() });
});

app.post('/api/sales', (req, res) => {
  const { contractNumber, manager, salesCount } = req.body;
  if (!contractNumber || !manager || !salesCount) {
    return res.json({ success: false, error: 'Заполните все поля' });
  }
  const sale = { id: nextId++, date: new Date().toISOString(), contractNumber, manager, salesCount: Number(salesCount) };
  sales.push(sale);
  res.json({ success: true });
});

app.put('/api/sales/:id', (req, res) => {
  const id   = parseInt(req.params.id);
  const sale = sales.find(s => s.id === id);
  if (!sale) return res.json({ success: false, error: 'Запись не найдена' });
  sale.salesCount = Number(req.body.salesCount);
  res.json({ success: true });
});

// ── Статистика за неделю ─────────────────────────────
app.get('/api/stats/weekly', (req, res) => {
  const { monday, sunday } = getWeekBounds();
  const stats = {};
  let totalContracts = 0, totalSales = 0;

  sales.forEach(s => {
    const d = new Date(s.date);
    if (d < monday || d > sunday) return;
    if (!stats[s.manager]) stats[s.manager] = { contracts: 0, sales: 0 };
    stats[s.manager].contracts++;
    stats[s.manager].sales += s.salesCount;
    totalContracts++;
    totalSales += s.salesCount;
  });

  res.json({
    success: true, stats, totalContracts, totalSales,
    weekStart: monday.toLocaleDateString('ru-RU'),
    weekEnd  : sunday.toLocaleDateString('ru-RU'),
  });
});

// ── График по неделям ────────────────────────────────
app.get('/api/stats/weeks', (req, res) => {
  const weeks = {};
  sales.forEach(s => {
    const d   = new Date(s.date);
    const dow = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    mon.setHours(0, 0, 0, 0);
    const key = mon.toLocaleDateString('ru-RU');
    if (!weeks[key]) weeks[key] = { label: key, contracts: 0, sales: 0 };
    weeks[key].contracts++;
    weeks[key].sales += s.salesCount;
  });
  res.json({ success: true, weeks: Object.values(weeks).slice(-8) });
});

function getWeekBounds() {
  const now    = new Date();
  const dow    = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

app.listen(3001, () => console.log('✅ Mock backend: http://localhost:3001'));
