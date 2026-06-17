const API_BASE = '/api';

// Get auth token from localStorage
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Auto-logout on 401 (only if user was logged in — avoids reload loop)
function handleUnauthorized(res) {
  if (res.status === 401 && localStorage.getItem('token')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }
}

async function fetchApi(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { ...getAuthHeaders() },
  });
  if (res.status === 401) { handleUnauthorized(res); return; }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function mutateApi(endpoint, method, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) { handleUnauthorized(res); return; }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// AUTH
export const loginApi = async (name, password) => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Login failed');
  }
  return res.json();
};

export const firebaseLoginApi = async (idToken) => {
  const res = await fetch(`${API_BASE}/auth/firebase-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Login failed');
  return data;
};

// GET
export const getInvoices = () => fetchApi('/invoices');
export const getInvoice = (id) => fetchApi(`/invoices/${id}`);
export const getSuppliers = () => fetchApi('/suppliers');
export const getUsers = () => fetchApi('/users');
export const getPaymentHistory = () => fetchApi('/payments/history');
export const getReportSuppliers = () => fetchApi('/payments/report-suppliers');
export const getStages = () => fetchApi('/stages');
export const getActivities = () => fetchApi('/activities');
export const getCompany = () => fetchApi('/company');

// CREATE
export const createInvoice = (data) => mutateApi('/invoices', 'POST', data);
export const createSupplier = (data) => mutateApi('/suppliers', 'POST', data);
export const createUser = (data) => mutateApi('/users', 'POST', data);

// UPDATE
export const updateInvoice = (id, data) => mutateApi(`/invoices/${id}`, 'PUT', data);
export const advanceInvoice = (id, userData = {}) => mutateApi(`/invoices/${id}/advance`, 'PUT', userData);
export const updateUser = (id, data) => mutateApi(`/users/${id}`, 'PUT', data);
export const updateCompany = (data) => mutateApi('/company', 'PUT', data);

// GRN SYNC
export const syncGRN = (fromDate, toDate) => mutateApi('/grn/sync', 'POST', { fromDate, toDate });

// ── FIXED PAYMENTS ────────────────────────────────────────────────────
export const getFixedForecasts = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return fetchApi(`/fixed-payments${qs ? '?' + qs : ''}`);
};
export const createFixedForecast = (data) => mutateApi('/fixed-payments', 'POST', data);
export const updateFixedForecast = (id, data) => mutateApi(`/fixed-payments/${id}`, 'PUT', data);
export const deleteFixedForecast = (id) => mutateApi(`/fixed-payments/${id}`, 'DELETE');
export const updateForecastMonth = (id, idx, data) => mutateApi(`/fixed-payments/${id}/months/${idx}`, 'PUT', data);

// ── PDC TRACKER ──────────────────────────────────────────────────────
export const getPdcDashboard = () => fetchApi('/pdc/dashboard');
export const getPdcs = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return fetchApi(`/pdc${qs ? '?' + qs : ''}`);
};
export const createPdc = (data) => mutateApi('/pdc', 'POST', data);
export const updatePdc = (id, data) => mutateApi(`/pdc/${id}`, 'PUT', data);
export const deletePdc = (id) => mutateApi(`/pdc/${id}`, 'DELETE');
export const changePdcStatus = (id, payload) => mutateApi(`/pdc/${id}/status`, 'PUT', payload);

export const getBankAccounts = () => fetchApi('/pdc/bank-accounts');
export const createBankAccount = (data) => mutateApi('/pdc/bank-accounts', 'POST', data);
export const deleteBankAccount = (id) => mutateApi(`/pdc/bank-accounts/${id}`, 'DELETE');

export const getParties = () => fetchApi('/pdc/parties');
export const createParty = (data) => mutateApi('/pdc/parties', 'POST', data);
export const deleteParty = (id) => mutateApi(`/pdc/parties/${id}`, 'DELETE');

export const getBranches = () => fetchApi('/pdc/branches');
export const createBranch = (data) => mutateApi('/pdc/branches', 'POST', data);
export const deleteBranch = (id) => mutateApi(`/pdc/branches/${id}`, 'DELETE');

// ── CHEQUE TRACKER (Outgoing payment cheques) ────────────────────────
export const getCheques = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return fetchApi(`/cheques${qs ? '?' + qs : ''}`);
};
export const createCheque = (data) => mutateApi('/cheques', 'POST', data);
export const updateCheque = (id, data) => mutateApi(`/cheques/${id}`, 'PUT', data);
export const deleteCheque = (id) => mutateApi(`/cheques/${id}`, 'DELETE');
export const changeChequeStatus = (id, payload) => mutateApi(`/cheques/${id}/status`, 'PUT', payload);
export const approveCheque = (id) => mutateApi(`/cheques/${id}/approve`, 'PUT', {});
export const rejectCheque = (id, note) => mutateApi(`/cheques/${id}/reject`, 'PUT', { note });

// ── SPEND ANALYTICS / VOUCHERS ───────────────────────────────────────
export const getSpendDashboard = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return fetchApi(`/spend-analytics/dashboard${qs ? '?' + qs : ''}`);
};
export const getVouchers = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return fetchApi(`/vouchers${qs ? '?' + qs : ''}`);
};
export const createVoucher = (data) => mutateApi('/vouchers', 'POST', data);
export const updateVoucher = (id, data) => mutateApi(`/vouchers/${id}`, 'PUT', data);
export const deleteVoucher = (id) => mutateApi(`/vouchers/${id}`, 'DELETE');

export const getBudgets = () => fetchApi('/vouchers/budgets');
export const createBudget = (data) => mutateApi('/vouchers/budgets', 'POST', data);
export const deleteBudget = (id) => mutateApi(`/vouchers/budgets/${id}`, 'DELETE');

// ── SUPPLIER LEDGER (derived from invoices + payments) ──────────────
export const getLedgerTransactions = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return fetchApi(`/supplier-ledger/transactions${qs ? '?' + qs : ''}`);
};
export const getLedgerKpis = () => fetchApi('/supplier-ledger/kpis');
export const getLedgerStatement = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return fetchApi(`/supplier-ledger/statement${qs ? '?' + qs : ''}`);
};

// ── ADVANCE PAYMENTS ────────────────────────────────────────────────
export const getAdvancePayments = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return fetchApi(`/advance-payments${qs ? '?' + qs : ''}`);
};
export const createAdvancePayment = (data) => mutateApi('/advance-payments', 'POST', data);
export const updateAdvancePayment = (id, data) => mutateApi(`/advance-payments/${id}`, 'PUT', data);
export const deleteAdvancePayment = (id) => mutateApi(`/advance-payments/${id}`, 'DELETE');
export const advanceAdvancePayment = (id) => mutateApi(`/advance-payments/${id}/advance`, 'PUT', {});
export const rejectAdvancePayment = (id, reason) => mutateApi(`/advance-payments/${id}/reject`, 'PUT', { reason });
