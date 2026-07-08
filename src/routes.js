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

// LoanDesk (TL-FIN-BLM-001) — bank loan / borrowings management.
import LoanAnalysis from './components/pages/loans/LoanAnalysis';
import LoanRegister from './components/pages/loans/LoanRegister';
import LoanAmortisation from './components/pages/loans/LoanAmortisation';
import LoanRepayments from './components/pages/loans/LoanRepayments';
import LoanDocuments from './components/pages/loans/LoanDocuments';
import MortgagedProperties from './components/pages/loans/MortgagedProperties';
import ChargesCompliance from './components/pages/loans/ChargesCompliance';

// `hideFromSidebar` keeps the route registered (deep links still work) but
// hides the item from the sidebar navigation.
const routes = [
  // ── MLD ──────────────────────────────────────────────────────────────
  { path: '/mld', key: 'mld', label: 'MLD', section: 'MLD', component: MLD, icon: 'mld' },

  // ── Overview ─────────────────────────────────────────────────────────
  { path: '/', key: 'dashboard', label: 'Dashboard', section: 'Overview', component: Dashboard, icon: 'dashboard' },
  { path: '/loans/analysis', key: 'loan-analysis', label: 'Loan Analysis', section: 'Overview', component: LoanAnalysis, icon: 'loan-analysis' },
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

  // ── Loan Management (LoanDesk) ───────────────────────────────────────
  { path: '/loans/register', key: 'loan-register', label: 'Loan Register', section: 'Loan Management', component: LoanRegister, icon: 'loan-register' },
  { path: '/loans/amortisation', key: 'loan-amortisation', label: 'Amortisation', section: 'Loan Management', component: LoanAmortisation, icon: 'loan-amort' },
  { path: '/loans/repayments', key: 'loan-repayments', label: 'Repayments', section: 'Loan Management', component: LoanRepayments, icon: 'loan-repay' },
  { path: '/loans/documents', key: 'loan-documents', label: 'Loan Documents', section: 'Loan Management', component: LoanDocuments, icon: 'loan-docs' },
  { path: '/loans/properties', key: 'loan-properties', label: 'Mortgaged Properties', section: 'Loan Management', component: MortgagedProperties, icon: 'loan-property' },
  { path: '/loans/charges', key: 'loan-charges', label: 'Charges & Compliance', section: 'Loan Management', component: ChargesCompliance, icon: 'loan-charges' },

  // ── Settings (CMD-only) ──────────────────────────────────────────────
  // Every entry mounts the same Settings page; the page reads the URL to
  // switch between panels, so each sidebar link deep-links into its tab.
  { path: '/settings/profile',        key: 'settings-profile',       label: 'Profile',        section: 'Settings', component: Settings, icon: 'set-profile' },
  { path: '/settings/workflow',       key: 'settings-workflow',      label: 'Workflow',       section: 'Settings', component: Settings, icon: 'set-workflow' },
  { path: '/settings/users',          key: 'settings-users',         label: 'Users & Roles',  section: 'Settings', component: Settings, icon: 'set-users' },
  { path: '/settings/notifications',  key: 'settings-notifications', label: 'Notifications',  section: 'Settings', component: Settings, icon: 'set-notify' },
  { path: '/settings/company',        key: 'settings-company',       label: 'Company Info',   section: 'Settings', component: Settings, icon: 'set-company' },
  { path: '/settings/datasync',       key: 'settings-datasync',      label: 'Data Sync',      section: 'Settings', component: Settings, icon: 'set-sync' },
  { path: '/settings/bank-config',    key: 'settings-bank-config',   label: 'Bank Config',    section: 'Settings', component: Settings, icon: 'set-bank' },
  { path: '/settings',                key: 'settings',               label: 'Settings',       section: 'Settings', component: Settings, icon: 'set-profile', hideFromSidebar: true },

  // ── Hidden from sidebar but still routable ───────────────────────────
  { path: '/pending', key: 'pending', label: 'Pending Action', section: 'Invoice Management', component: Pending, icon: 'pending', hideFromSidebar: true },
  { path: '/approvals', key: 'approvals', label: 'Approvals', section: 'Invoice Management', component: Approvals, icon: 'approvals', hideFromSidebar: true },
];

export default routes;
