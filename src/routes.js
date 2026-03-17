import Dashboard from './components/pages/Dashboard';
import Invoices from './components/pages/Invoices';
import Pending from './components/pages/Pending';
import Approvals from './components/pages/Approvals';
import Payments from './components/pages/Payments';
import Reports from './components/pages/Reports';
import Suppliers from './components/pages/Suppliers';
import Settings from './components/pages/Settings';

const routes = [
  { path: '/', key: 'dashboard', label: 'Dashboard', section: 'Overview', component: Dashboard, icon: 'dashboard' },
  { path: '/invoices', key: 'invoices', label: 'All Invoices', section: 'Overview', component: Invoices, icon: 'invoices' },
  { path: '/pending', key: 'pending', label: 'Pending Action', section: 'Workflow', component: Pending, icon: 'pending' },
  { path: '/approvals', key: 'approvals', label: 'Approvals', section: 'Workflow', component: Approvals, icon: 'approvals' },
  { path: '/payments', key: 'payments', label: 'Payments', section: 'Workflow', component: Payments, icon: 'payments' },
  { path: '/reports', key: 'reports', label: 'Reports', section: 'Finance', component: Reports, icon: 'reports' },
  { path: '/suppliers', key: 'suppliers', label: 'Suppliers', section: 'Finance', component: Suppliers, icon: 'suppliers' },
  { path: '/settings', key: 'settings', label: 'Settings', section: 'Finance', component: Settings, icon: 'settings' },
];

export default routes;
