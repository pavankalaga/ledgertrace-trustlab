import React from 'react';
import { NavLink } from 'react-router-dom';
import routes from '../../routes';

const NAV_ICONS = {
  dashboard: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8M4 18h4" /></svg>,
  invoices: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  pending: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  approvals: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  payments: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  reports: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  suppliers: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  settings: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>,
};

const Sidebar = ({ isOpen, onClose, invoices = [], user }) => {
  // Compute badge counts from live invoice data
  const pendingCount = invoices.filter(i => i.stageIdx < 6 && (i.urgency === 'overdue' || i.urgency === 'soon')).length;
  const approvalCount = invoices.filter(i => i.stageIdx >= 2 && i.stageIdx <= 5).length;

  const badges = {
    invoices: { count: invoices.length, hot: false },
    pending: { count: pendingCount, hot: pendingCount > 0 },
    approvals: { count: approvalCount, hot: approvalCount > 0 },
  };

  const sections = [];
  let lastSection = null;

  routes.forEach((route) => {
    if (route.section !== lastSection) {
      sections.push({ type: 'header', label: route.section });
      lastSection = route.section;
    }
    sections.push({ type: 'link', ...route });
  });

  return (
    <>
      <div className={`sb-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="logo-block">
          <div className="logo-row">
            <div className="logo-gem">⬡</div>
            <div className="logo-name">LedgerTrace</div>
          </div>
          <div className="logo-tag">Invoice OS · FY 2026–27</div>
        </div>
        <nav className="nav">
          {sections.map((item, i) => {
            if (item.type === 'header') {
              return <div className="nav-sec" key={`sec-${i}`}>{item.label}</div>;
            }
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                {NAV_ICONS[item.icon]}
                {item.label}
                {badges[item.key] && badges[item.key].count > 0 && (
                  <span className={`nav-badge${badges[item.key].hot ? ' hot' : ''}`}>{badges[item.key].count}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="sb-foot">
          <div className="user-pill">
            <div className="avatar" style={user?.color ? { background: user.color } : {}}>{user?.initials || '??'}</div>
            <div>
              <div className="un">{user?.name || 'User'}</div>
              <div className="ur">{user?.role || 'Employee'}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
