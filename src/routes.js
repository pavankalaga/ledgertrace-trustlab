import Dashboard from './components/pages/Dashboard';
import Invoices from './components/pages/Invoices';
import Pending from './components/pages/Pending';
import Approvals from './components/pages/Approvals';
import Payments from './components/pages/Payments';
import FixedPayments from './components/pages/FixedPayments';
import AdvancePayments from './components/pages/AdvancePayments';
import SpendAnalytics from './components/pages/SpendAnalytics';
import PDCTracker from './components/pages/PDCTracker';
import ChequeTracker from './components/pages/ChequeTracker';
import TransactionsRegister from './components/pages/TransactionsRegister';
import SupplierLedger from './components/pages/SupplierLedger';
import Reports from './components/pages/Reports';
import Suppliers from './components/pages/Suppliers';
import Settings from './components/pages/Settings';
import MLD from './components/pages/MLD';

// `hideFromSidebar` keeps the route registered (deep links still work) but
// hides the item from the sidebar navigation.
const routes = [
  // ── MLD ──────────────────────────────────────────────────────────────
  { path: '/mld', key: 'mld', label: 'MLD', section: 'MLD', component: MLD, icon: 'mld' },

  // ── Overview ─────────────────────────────────────────────────────────
  { path: '/', key: 'dashboard', label: 'Dashboard', section: 'Overview', component: Dashboard, icon: 'dashboard' },
  { path: '/spend-analytics', key: 'spend-analytics', label: 'Spend Analytics', section: 'Overview', component: SpendAnalytics, icon: 'analytics' },
  { path: '/reports', key: 'reports', label: 'Reports & Analytics', section: 'Overview', component: Reports, icon: 'reports' },

  // ── Supplier Management ──────────────────────────────────────────────
  { path: '/suppliers', key: 'suppliers', label: 'Suppliers', section: 'Supplier Management', component: Suppliers, icon: 'suppliers' },
  { path: '/supplier-ledger', key: 'supplier-ledger', label: 'Supplier Ledger', section: 'Supplier Management', component: SupplierLedger, icon: 'ledger' },

  // ── Invoice Management ───────────────────────────────────────────────
  { path: '/invoices', key: 'invoices', label: 'All Invoices', section: 'Invoice Management', component: Invoices, icon: 'invoices' },
  { path: '/transactions-register', key: 'transactions-register', label: 'Transactions', section: 'Invoice Management', component: TransactionsRegister, icon: 'register' },

  // ── Cheque Management ────────────────────────────────────────────────
  { path: '/pdc-tracker', key: 'pdc-tracker', label: 'PDC Tracker', section: 'Cheque Management', component: PDCTracker, icon: 'pdc' },
  { path: '/cheque-tracker', key: 'cheque-tracker', label: 'Cheque Tracker', section: 'Cheque Management', component: ChequeTracker, icon: 'cheque' },

  // ── Payment Management ───────────────────────────────────────────────
  { path: '/payments', key: 'payments', label: 'Payments', section: 'Payment Management', component: Payments, icon: 'payments' },
  { path: '/fixed-payments', key: 'fixed-payments', label: 'Fixed Payments', section: 'Payment Management', component: FixedPayments, icon: 'fixed' },
  { path: '/advance-payments', key: 'advance-payments', label: 'Advance Payments', section: 'Payment Management', component: AdvancePayments, icon: 'advance' },

  // ── System (CMD-only) ────────────────────────────────────────────────
  { path: '/settings', key: 'settings', label: 'Settings', section: 'System', component: Settings, icon: 'settings' },

  // ── Hidden from sidebar but still routable ───────────────────────────
  { path: '/pending', key: 'pending', label: 'Pending Action', section: 'Invoice Management', component: Pending, icon: 'pending', hideFromSidebar: true },
  { path: '/approvals', key: 'approvals', label: 'Approvals', section: 'Invoice Management', component: Approvals, icon: 'approvals', hideFromSidebar: true },
];

export default routes;
