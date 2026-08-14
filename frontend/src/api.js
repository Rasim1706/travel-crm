function getToken() {
  return sessionStorage.getItem('crm_token') || ''
}

async function call(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    ...options,
  })
  return res.json()
}

export const api = {
  // Auth
  login:    (login, password) => call('/api/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  register: (data)            => call('/api/register',   { method: 'POST', body: JSON.stringify(data) }),

  // Accounts (admin only)
  getAccounts:    ()                        => call('/api/accounts'),
  addAccount:     (data)                    => call('/api/accounts', { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount:  (login)                   => call(`/api/accounts/${encodeURIComponent(login)}`, { method: 'DELETE' }),
  changePassword: (login, password)         => call(`/api/accounts/${encodeURIComponent(login)}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  updateAccount:  (login, data)             => call(`/api/accounts/${encodeURIComponent(login)}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Managers (read-only — names come from Accounts sheet)
  getManagers: () => call('/api/managers'),

  // Exchange rate proxy
  getExchangeRate: () => call('/api/exchange-rate'),

  // Sales
  getSales:    ()                  => call('/api/sales'),
  addSale:     (data)              => call('/api/sales', { method: 'POST', body: JSON.stringify(data) }),
  updateSale:  (id, data)          => call(`/api/sales/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSale:  (id)                => call(`/api/sales/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Reference lists
  getSources:       ()     => call('/api/sources'),
  addSource:        (name) => call('/api/sources',    { method: 'POST',   body: JSON.stringify({ name }) }),
  removeSource:     (name) => call(`/api/sources/${encodeURIComponent(name)}`,    { method: 'DELETE' }),
  getDirections:    ()     => call('/api/directions'),
  addDirection:     (name) => call('/api/directions', { method: 'POST',   body: JSON.stringify({ name }) }),
  removeDirection:  (name) => call(`/api/directions/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  getHotels:        ()     => call('/api/hotels'),
  addHotel:         (name) => call('/api/hotels',     { method: 'POST',   body: JSON.stringify({ name }) }),
  removeHotel:      (name) => call(`/api/hotels/${encodeURIComponent(name)}`,     { method: 'DELETE' }),
}
