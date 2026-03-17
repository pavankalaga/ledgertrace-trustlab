import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, getCompany, updateCompany, syncGRN } from '../../api';

const Toggle = ({ defaultOn = false }) => {
  const [on, setOn] = useState(defaultOn);
  return <div className={`toggle ${on ? 'on' : ''}`} onClick={() => setOn(!on)} />;
};

const Settings = ({ onShowToast }) => {
  const [activePanel, setActivePanel] = useState('profile');
  const [users, setUsers] = useState([]);
  const [profile, setProfile] = useState({ name: '', role: '', dept: '', initials: '' });
  const [company, setCompany] = useState({ name: '', gstin: '', pan: '', address: '', fyStart: '1 April', currency: 'INR (₹)' });
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', role: '', dept: '', contact: '', password: '', initials: '', color: '#3b6fd4', badge: 'role-fin' });
  const [saving, setSaving] = useState(false);
  const [grnFrom, setGrnFrom] = useState('2026-01-01');
  const [grnTo, setGrnTo] = useState(new Date().toISOString().split('T')[0]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const fetchUsers = () => getUsers().then(data => {
    setUsers(data);
    if (data.length > 0 && !profile.name) {
      const u = data[0];
      setProfile({ ...u, firstName: u.name.split(' ')[0] || '', lastName: u.name.split(' ').slice(1).join(' ') || '' });
    }
  }).catch(console.error);

  useEffect(() => {
    fetchUsers();
    getCompany().then(data => { if (data && data.name) setCompany(data); }).catch(console.error);
  }, []);

  const setP = (field) => (e) => setProfile({ ...profile, [field]: e.target.value });
  const setC = (field) => (e) => setCompany({ ...company, [field]: e.target.value });
  const setU = (field) => (e) => setUserForm({ ...userForm, [field]: e.target.value });

  const saveProfile = async () => {
    if (!profile._id) return;
    setSaving(true);
    try {
      await updateUser(profile._id, { name: `${profile.firstName} ${profile.lastName}`.trim(), role: profile.role, dept: profile.dept });
      fetchUsers();
      onShowToast('✓ Profile updated');
    } catch (err) { onShowToast('Error: ' + err.message); }
    setSaving(false);
  };

  const saveCompany = async () => {
    setSaving(true);
    try {
      await updateCompany(company);
      onShowToast('✓ Company info saved');
    } catch (err) { onShowToast('Error: ' + err.message); }
    setSaving(false);
  };

  const openUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserForm({ name: user.name, role: user.role, dept: user.dept, contact: user.contact, password: user.password, initials: user.initials, color: user.color || '#3b6fd4', badge: user.badge || 'role-fin' });
    } else {
      setEditingUser(null);
      setUserForm({ name: '', role: '', dept: '', contact: '', password: '', initials: '', color: '#3b6fd4', badge: 'role-fin' });
    }
    setShowUserModal(true);
  };

  const saveUser = async () => {
    if (!userForm.name) { onShowToast('Please enter user name'); return; }
    setSaving(true);
    try {
      const data = { ...userForm, initials: userForm.initials || userForm.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() };
      if (editingUser) {
        await updateUser(editingUser._id, data);
        onShowToast(`✓ ${data.name} updated`);
      } else {
        await createUser(data);
        onShowToast(`✓ ${data.name} added`);
      }
      fetchUsers();
      setShowUserModal(false);
    } catch (err) { onShowToast('Error: ' + err.message); }
    setSaving(false);
  };

  const navItems = [
    { key: 'profile', label: 'Profile', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { key: 'workflow', label: 'Workflow', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
    { key: 'users', label: 'Users & Roles', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
    { key: 'notifications', label: 'Notifications', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> },
    { key: 'company', label: 'Company Info', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    { key: 'datasync', label: 'Data Sync', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> },
  ];

  const workflowStages = [
    { num: '01', color: 'var(--s1)', name: 'Invoice Received', owner: 'Procurement Dept.', sla: ['1 day', '2 days', '3 days'], def: 2 },
    { num: '02', color: 'var(--s2)', name: 'Procurement Review', owner: 'Procurement Team', sla: ['2 days', '5 days', '7 days'], def: 1 },
    { num: '03', color: 'var(--s3)', name: 'Accounts Payable', owner: 'AP Desk', sla: ['1 day', '3 days', '5 days'], def: 1 },
    { num: '04', color: 'var(--s4)', name: 'Finance / CMD Approval', owner: 'Finance Manager + CMD', sla: ['2 days', '3 days', '5 days'], def: 0 },
    { num: '05', color: 'var(--s5)', name: 'Tally ERP Entry', owner: 'AP Team', sla: ['1 day', '2 days'], def: 0 },
    { num: '06', color: 'var(--s6)', name: 'Payment Authorisation', owner: 'CMD Office', sla: ['2 days', '3 days'], def: 0 },
    { num: '07', color: 'var(--s7)', name: 'Payment Made', owner: 'Finance Team', sla: ['Same day', '1 day'], def: 0 },
  ];

  return (
    <div>
      <div className="section-hd"><div className="sh-left"><h2>Settings</h2><p>Configure workflow, users and notification preferences</p></div></div>
      <div className="settings-layout">
        <div className="settings-nav">
          {navItems.map(item => (
            <div key={item.key} className={`sn-item ${activePanel === item.key ? 'active' : ''}`} onClick={() => setActivePanel(item.key)}>{item.icon}{item.label}</div>
          ))}
        </div>
        <div>
          {/* Profile */}
          <div className={`settings-panel ${activePanel === 'profile' ? 'active' : ''}`}>
            <div className="settings-section">
              <div className="ss-hd">Your Profile</div>
              <div className="ss-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--rule2)' }}>
                  <div className="avatar" style={{ width: '56px', height: '56px', fontSize: '18px', borderRadius: '12px' }}>{profile.initials || 'U'}</div>
                  <div><div style={{ fontSize: '16px', fontWeight: 700 }}>{profile.firstName} {profile.lastName}</div><div style={{ fontSize: '12px', color: 'var(--ink3)', marginTop: '2px' }}>{profile.role} · {profile.dept}</div></div>
                </div>
                <div className="form-grid">
                  <div className="ff"><label className="f-label">First Name</label><input className="f-input" value={profile.firstName || ''} onChange={setP('firstName')} /></div>
                  <div className="ff"><label className="f-label">Last Name</label><input className="f-input" value={profile.lastName || ''} onChange={setP('lastName')} /></div>
                  <div className="ff"><label className="f-label">Designation</label><input className="f-input" value={profile.role || ''} onChange={setP('role')} /></div>
                  <div className="ff"><label className="f-label">Department</label><select className="f-input" value={profile.dept || ''} onChange={setP('dept')}>
                    <option>CMD</option>
                    <option>Procurement</option>
                    <option>Accounts Payable</option>
                    <option>Biomedical Operations</option>
                    <option>CSD</option>
                    <option>Information Technology</option>
                    <option>Logistics</option>
                    <option>Finance</option>
                    <option>Facilities</option>
                  </select></div>
                </div>
                <div style={{ marginTop: '14px', textAlign: 'right' }}><button className="btn btn-primary" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button></div>
              </div>
            </div>
          </div>

          {/* Workflow */}
          <div className={`settings-panel ${activePanel === 'workflow' ? 'active' : ''}`}>
            <div className="settings-section">
              <div className="ss-hd">Invoice Lifecycle Configuration</div>
              <div className="ss-body">
                <p style={{ fontFamily: "'Crimson Pro',serif", fontSize: '14px', color: 'var(--ink3)', fontStyle: 'italic', marginBottom: '16px' }}>Define stage owners and SLA targets for each step in the invoice lifecycle</p>
                <div className="stage-config">
                  <div className="sc-row" style={{ background: 'var(--bg)', fontSize: '10px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--ink4)', letterSpacing: '1px' }}><div>#</div><div></div><div>STAGE</div><div>SLA TARGET</div></div>
                  {workflowStages.map(ws => (
                    <div className="sc-row" key={ws.num}><div className="sc-num">{ws.num}</div><div className="sc-dot" style={{ background: ws.color }} /><div><div className="sc-name">{ws.name}</div><div className="sc-owner">{ws.owner}</div></div><select className="f-input" style={{ padding: '5px 8px', fontSize: '12px' }} defaultValue={ws.sla[ws.def]}>{ws.sla.map(s => <option key={s}>{s}</option>)}</select></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Users */}
          <div className={`settings-panel ${activePanel === 'users' ? 'active' : ''}`}>
            <div className="settings-section">
              <div className="ss-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Users &amp; Roles <button className="btn btn-primary btn-sm" onClick={() => openUserModal()}>+ Invite User</button></div>
              <div className="ss-body">
                {users.map(u => (
                  <div className="user-card" key={u._id || u.initials}>
                    <div className="uc-left"><div className="uc-avatar" style={{ background: u.color }}>{u.initials}</div><div><div className="uc-name">{u.name}</div><div className="uc-role">{u.role} · {u.dept}</div></div></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span className={`uc-badge ${u.badge}`}>{u.role}</span><button className="btn btn-ghost btn-sm" onClick={() => openUserModal(u)}>Edit</button></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className={`settings-panel ${activePanel === 'notifications' ? 'active' : ''}`}>
            <div className="settings-section">
              <div className="ss-hd">Email Notifications</div>
              <div className="ss-body">
                <div className="ss-row"><div className="ss-row-left"><div className="ss-row-label">Invoice received</div><div className="ss-row-desc">When a new invoice is registered</div></div><Toggle defaultOn={true} /></div>
                <div className="ss-row"><div className="ss-row-left"><div className="ss-row-label">Approval required</div><div className="ss-row-desc">When an invoice reaches your approval stage</div></div><Toggle defaultOn={true} /></div>
                <div className="ss-row"><div className="ss-row-left"><div className="ss-row-label">Invoice overdue</div><div className="ss-row-desc">When payment due date is missed</div></div><Toggle defaultOn={true} /></div>
                <div className="ss-row"><div className="ss-row-left"><div className="ss-row-label">Payment made</div><div className="ss-row-desc">Confirmation when payment is recorded</div></div><Toggle defaultOn={false} /></div>
                <div className="ss-row"><div className="ss-row-left"><div className="ss-row-label">Weekly summary</div><div className="ss-row-desc">Weekly digest of invoice activity</div></div><Toggle defaultOn={true} /></div>
              </div>
            </div>
          </div>

          {/* Company */}
          <div className={`settings-panel ${activePanel === 'company' ? 'active' : ''}`}>
            <div className="settings-section">
              <div className="ss-hd">Company Information</div>
              <div className="ss-body">
                <div className="form-grid">
                  <div className="ff s2"><label className="f-label">Company Name</label><input className="f-input" value={company.name || ''} onChange={setC('name')} /></div>
                  <div className="ff"><label className="f-label">GSTIN</label><input className="f-input" value={company.gstin || ''} onChange={setC('gstin')} /></div>
                  <div className="ff"><label className="f-label">PAN</label><input className="f-input" value={company.pan || ''} onChange={setC('pan')} /></div>
                  <div className="ff s2"><label className="f-label">Registered Address</label><input className="f-input" value={company.address || ''} onChange={setC('address')} /></div>
                  <div className="ff"><label className="f-label">Financial Year Start</label><select className="f-input" value={company.fyStart || '1 April'} onChange={setC('fyStart')}><option>1 April</option><option>1 January</option></select></div>
                  <div className="ff"><label className="f-label">Default Currency</label><select className="f-input" value={company.currency || 'INR (₹)'} onChange={setC('currency')}><option>INR (₹)</option><option>USD ($)</option></select></div>
                </div>
                <div style={{ marginTop: '14px', textAlign: 'right' }}><button className="btn btn-primary" onClick={saveCompany} disabled={saving}>{saving ? 'Saving…' : 'Save Company Info'}</button></div>
              </div>
            </div>
          </div>

          {/* Data Sync Panel */}
          <div className={`settings-panel ${activePanel === 'datasync' ? 'active' : ''}`}>
            <div className="settings-section">
              <div className="ss-hd">Sync GRN Data from TrustLab</div>
              <div className="ss-sub" style={{ marginBottom: 16, color: 'var(--ink4)', fontSize: 12.5 }}>
                Fetch invoices and suppliers from TrustLab GRN system and import into LedgerTrace.
              </div>
              <div className="ss-body">
                <div className="form-grid">
                  <div className="ff">
                    <label className="f-label">From Date</label>
                    <input className="f-input" type="date" value={grnFrom} onChange={e => setGrnFrom(e.target.value)} />
                  </div>
                  <div className="ff">
                    <label className="f-label">To Date</label>
                    <input className="f-input" type="date" value={grnTo} onChange={e => setGrnTo(e.target.value)} />
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <button
                    className="btn btn-primary"
                    disabled={syncing}
                    onClick={async () => {
                      setSyncing(true);
                      setSyncResult(null);
                      try {
                        const result = await syncGRN(grnFrom, grnTo);
                        setSyncResult(result);
                        onShowToast(`Synced ${result.invoicesCreated} invoices, ${result.suppliersCreated} suppliers`);
                      } catch (err) {
                        setSyncResult({ error: err.message });
                        onShowToast('Sync failed: ' + err.message);
                      }
                      setSyncing(false);
                    }}
                  >
                    {syncing ? 'Syncing…' : 'Sync GRN Data'}
                  </button>
                </div>

                {syncResult && !syncResult.error && (
                  <div style={{ marginTop: 18, padding: 16, background: 'var(--bg)', borderRadius: 8, fontSize: 13 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--teal)' }}>Sync Complete</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>GRN Items Fetched: <strong>{syncResult.totalGRNItems}</strong></div>
                      <div>Unique Invoices: <strong>{syncResult.invoicesTotal}</strong></div>
                      <div>Invoices Created: <strong>{syncResult.invoicesCreated}</strong></div>
                      <div>Suppliers Created: <strong>{syncResult.suppliersCreated}</strong></div>
                    </div>
                  </div>
                )}

                {syncResult && syncResult.error && (
                  <div style={{ marginTop: 18, padding: 14, background: '#fef2f2', borderRadius: 8, fontSize: 13, color: 'var(--coral)' }}>
                    Error: {syncResult.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Modal (Add/Edit) */}
      <div className={`modal-back ${showUserModal ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setShowUserModal(false); }}>
        <div className="modal" style={{ width: 420 }}>
          <div className="modal-hd">
            <div><div className="modal-title">{editingUser ? 'Edit User' : 'Invite User'}</div></div>
            <button className="drawer-close" style={{ background: 'var(--bg)', color: 'var(--ink3)', border: '1px solid var(--rule)' }} onClick={() => setShowUserModal(false)}>✕</button>
          </div>
          <div className="modal-body">
            <div className="form-grid">
              <div className="ff s2"><label className="f-label">Full Name *</label><input className="f-input" placeholder="e.g. Priya Sharma" value={userForm.name} onChange={setU('name')} /></div>
              <div className="ff">
                <label className="f-label">Role</label>
                <input className="f-input" placeholder="e.g. AP Accountant" value={userForm.role} onChange={setU('role')} />
              </div>
              <div className="ff"><label className="f-label">Department</label><select className="f-input" value={userForm.dept} onChange={setU('dept')}><option value="">Select...</option>
                <option>CMD</option>
                <option>Procurement</option>
                <option>Accounts Payable</option>
                <option>Biomedical Operations</option>
                <option>CSD</option>
                <option>Information Technology</option>
                <option>Logistics</option>
                <option>Finance</option>
                <option>Facilities</option>

              </select></div>


              <div className="ff">
                <label className="f-label">Contact Number</label>
                <input className="f-input" placeholder="e.g. 123-456-7890" value={userForm.contact} onChange={setU('contact')} />
              </div>
              <div className="ff">
                <label className="f-label">Password</label>
                <input className="f-input" type="password" placeholder="......." value={userForm.password} onChange={setU('password')} />
              </div>

            </div>
          </div>
          <div className="modal-ft">
            <button className="btn btn-ghost" onClick={() => setShowUserModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveUser} disabled={saving}>{saving ? 'Saving…' : editingUser ? 'Save Changes' : 'Add User'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
