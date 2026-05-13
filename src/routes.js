import Dashboard from './components/pages/Dashboard';
import Invoices from './components/pages/Invoices';
import Pending from './components/pages/Pending';
import Approvals from './components/pages/Approvals';
import Payments from './components/pages/Payments';
import FixedPayments from './components/pages/FixedPayments';
import AdvancePayments from './components/pages/AdvancePayments';
import SpendAnalytics from './components/pages/SpendAnalytics';
import PDCTracker from './components/pages/PDCTracker';
import TransactionsRegister from './components/pages/TransactionsRegister';
import SupplierLedger from './components/pages/SupplierLedger';
import Reports from './components/pages/Reports';
import Suppliers from './components/pages/Suppliers';
import Settings from './components/pages/Settings';

const routes = [
  { path: '/', key: 'dashboard', label: 'Dashboard', section: 'Overview', component: Dashboard, icon: 'dashboard' },
  { path: '/invoices', key: 'invoices', label: 'All Invoices', section: 'Overview', component: Invoices, icon: 'invoices' },
  { path: '/pending', key: 'pending', label: 'Pending Action', section: 'Workflow', component: Pending, icon: 'pending' },
  { path: '/approvals', key: 'approvals', label: 'Approvals', section: 'Workflow', component: Approvals, icon: 'approvals' },
  { path: '/payments', key: 'payments', label: 'Payments', section: 'Workflow', component: Payments, icon: 'payments' },
  { path: '/fixed-payments', key: 'fixed-payments', label: 'Fixed Payments', section: 'Workflow', component: FixedPayments, icon: 'fixed' },
  { path: '/advance-payments', key: 'advance-payments', label: 'Advance Payments', section: 'Workflow', component: AdvancePayments, icon: 'advance' },
  { path: '/pdc-tracker', key: 'pdc-tracker', label: 'PDC Tracker', section: 'Workflow', component: PDCTracker, icon: 'pdc' },
  { path: '/transactions-register', key: 'transactions-register', label: 'Transactions', section: 'Ledger', component: TransactionsRegister, icon: 'register' },
  { path: '/supplier-ledger', key: 'supplier-ledger', label: 'Supplier Ledger', section: 'Ledger', component: SupplierLedger, icon: 'ledger' },
  { path: '/spend-analytics', key: 'spend-analytics', label: 'Spend Analytics', section: 'Finance', component: SpendAnalytics, icon: 'analytics' },
  { path: '/reports', key: 'reports', label: 'Reports', section: 'Finance', component: Reports, icon: 'reports' },
  { path: '/suppliers', key: 'suppliers', label: 'Suppliers', section: 'Finance', component: Suppliers, icon: 'suppliers' },
  { path: '/settings', key: 'settings', label: 'Settings', section: 'Finance', component: Settings, icon: 'settings' },
];

export default routes;
