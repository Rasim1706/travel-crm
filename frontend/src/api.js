async function call(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  return res.json()
}

export const api = {
  getManagers:    ()              => call('/api/managers'),
  addManager:     (name)          => call('/api/managers', { method: 'POST', body: JSON.stringify({ name }) }),
  removeManager:  (name)          => call(`/api/managers/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  getSales:       ()              => call('/api/sales'),
  addSale:        (data)          => call('/api/sales', { method: 'POST', body: JSON.stringify(data) }),
  updateSale:     (id, salesCount)=> call(`/api/sales/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ salesCount }) }),
  deleteSale:     (id)            => call(`/api/sales/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getWeeklyStats: ()              => call('/api/stats/weekly'),
  getAllWeeks:     ()              => call('/api/stats/weeks'),
}
