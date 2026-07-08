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
  // ── Overview ─────────────────────────────────────────────────────────
  { path: '/', key: 'dashboard', label: 'Dashboard', section: 'Overview', component: Dashboard, icon: 'dashboard' },
  { path: '/mld', key: 'mld', label: 'MLD', section: 'Overview', component: MLD, icon: 'mld' },

  // ── Workflow ─────────────────────────────────────────────────────────
  { path: '/invoices', key: 'invoices', label: 'All Invoices', section: 'Workflow', component: Invoices, icon: 'invoices' },
  { path: '/payments', key: 'payments', label: 'Payments', section: 'Workflow', component: Payments, icon: 'payments' },
  { path: '/fixed-payments', key: 'fixed-payments', label: 'Fixed Payments', section: 'Workflow', component: FixedPayments, icon: 'fixed' },
  { path: '/advance-payments', key: 'advance-payments', label: 'Advance Payments', section: 'Workflow', component: AdvancePayments, icon: 'advance' },
  { path: '/pdc-tracker', key: 'pdc-tracker', label: 'PDC Tracker', section: 'Workflow', component: PDCTracker, icon: 'pdc' },
  { path: '/cheque-tracker', key: 'cheque-tracker', label: 'Cheque Tracker', section: 'Workflow', component: ChequeTracker, icon: 'cheque' },
  { path: '/transactions-register', key: 'transactions-register', label: 'Transactions', section: 'Workflow', component: TransactionsRegister, icon: 'register' },
  { path: '/supplier-ledger', key: 'supplier-ledger', label: 'Supplier Ledger', section: 'Workflow', component: SupplierLedger, icon: 'ledger' },
  { path: '/spend-analytics', key: 'spend-analytics', label: 'Spend Analytics', section: 'Workflow', component: SpendAnalytics, icon: 'analytics' },
  { path: '/reports', key: 'reports', label: 'Reports', section: 'Workflow', component: Reports, icon: 'reports' },
  { path: '/suppliers', key: 'suppliers', label: 'Suppliers', section: 'Workflow', component: Suppliers, icon: 'suppliers' },

  // ── System (CMD-only) ────────────────────────────────────────────────
  { path: '/settings', key: 'settings', label: 'Settings', section: 'System', component: Settings, icon: 'settings' },

  // ── Hidden from sidebar but still routable ───────────────────────────
  { path: '/pending', key: 'pending', label: 'Pending Action', section: 'Workflow', component: Pending, icon: 'pending', hideFromSidebar: true },
  { path: '/approvals', key: 'approvals', label: 'Approvals', section: 'Workflow', component: Approvals, icon: 'approvals', hideFromSidebar: true },
];

export default routes;
