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
export const advanceInvoice = (id) => mutateApi(`/invoices/${id}/advance`, 'PUT', {});
export const updateUser = (id, data) => mutateApi(`/users/${id}`, 'PUT', data);
export const updateCompany = (data) => mutateApi('/company', 'PUT', data);

// GRN SYNC
export const syncGRN = (fromDate, toDate) => mutateApi('/grn/sync', 'POST', { fromDate, toDate });
