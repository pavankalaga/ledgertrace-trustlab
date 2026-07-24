import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import { getInvoices, getStages, getActivities } from './api';
import { isCMD } from './utils';
import routes from './routes';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Drawer from './components/shared/Drawer';
import InvoiceModal from './components/shared/InvoiceModal';
import Toast from './components/shared/Toast';
import Login from './components/pages/Login';

function App() {
  const navigate = useNavigate();

  // Auth state — check localStorage on mount
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const [invoices, setInvoices] = useState([]);
  const [stages, setStages] = useState([]);
  const [activities, setActivities] = useState([]);
  const [drawerInvoice, setDrawerInvoice] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null); // null = create mode, invoice obj = edit mode
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Re-fetch all data from backend
  const refreshData = useCallback(() => {
    getInvoices().then(setInvoices).catch(console.error);
    getStages().then(setStages).catch(console.error);
    getActivities().then(setActivities).catch(console.error);
  }, []);

  // Fetch on mount — only if logged in
  useEffect(() => {
    if (user) refreshData();
  }, [user, refreshData]);

  // A data page (currently Invoices) registers an export handler here; the
  // Topbar Export button invokes it. Pages clear it on unmount, so on pages
  // with nothing to export the button shows a hint instead.
  const exportHandlerRef = useRef(null);
  const registerExporter = useCallback((fn) => { exportHandlerRef.current = fn; }, []);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setToastVisible(true);
  }, []);

  const handleExport = useCallback(() => {
    if (exportHandlerRef.current) exportHandlerRef.current();
    else showToast('Export is available on the All Invoices page.');
  }, [showToast]);

  const hideToast = useCallback(() => {
    setToastVisible(false);
  }, []);

  const openDrawer = useCallback((invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId || i._id === invoiceId);
    if (inv) {
      setDrawerInvoice(inv);
      setIsDrawerOpen(true);
    } else {
      console.log('Drawer: invoice not found for', invoiceId, 'in', invoices.length, 'invoices');
    }
  }, [invoices]);

  const openEditModal = useCallback((invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId || i._id === invoiceId);
    if (inv) {
      setEditInvoice(inv);
      setIsModalOpen(true);
    }
  }, [invoices]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const handleNavigate = useCallback((pageKey) => {
    const route = routes.find(r => r.key === pageKey);
    if (route) navigate(route.path);
  }, [navigate]);

  // If not logged in, show Login page only
  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} invoices={invoices} user={user} />
      <div className="main">
        <Topbar
          onShowToast={showToast}
          onOpenModal={() => setIsModalOpen(true)}
          onToggleSidebar={() => setSidebarOpen(true)}
          onLogout={handleLogout}
          user={user}
          invoices={invoices}
          onOpenDrawer={openDrawer}
          onExport={handleExport}
        />
        <div className="content">
          <Routes>
            {routes
              // Non-CMD users cannot access the Settings section or any
              // adminOnly Loan Management modules (deep-links 404 too).
              .filter(r => isCMD(user) || (r.section !== 'Settings' && !r.adminOnly))
              .map(({ path, key, component: Component }) => (
                <Route
                  key={key}
                  path={path}
                  element={
                    <Component
                      invoices={invoices}
                      stages={stages}
                      activities={activities}
                      user={user}
                      onOpenDrawer={openDrawer}
                      onShowToast={showToast}
                      onNavigate={handleNavigate}
                      onRefresh={refreshData}
                      onRegisterExport={registerExporter}
                    />
                  }
                />
              ))}
          </Routes>
        </div>
      </div>
      <Drawer
        invoice={drawerInvoice}
        stages={stages}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onShowToast={showToast}
        onRefresh={refreshData}
        onOpenEdit={openEditModal}
        user={user}
      />
      <InvoiceModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditInvoice(null); }}
        onShowToast={showToast}
        onRefresh={refreshData}
        invoice={editInvoice}
      />
      <Toast message={toastMessage} isVisible={toastVisible} onHide={hideToast} />
    </>
  );
}

export default App;
