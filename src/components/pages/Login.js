import React, { useState } from 'react';
import { loginApi } from '../../api';
import CircularProgress from '@mui/material/CircularProgress';

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const EyeIcon = ({ off }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const Login = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !password) { setError('Please enter name and password'); return; }
    setLoading(true);
    try {
      const data = await loginApi(name, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setName('');
    setPassword('');
    setError('');
  };

  return (
    <div className="login-page">
      <div className="sp-grid" />
      <div className="sp-particle" />
      <div className="sp-particle" />
      <div className="sp-particle" />
      <div className="sp-particle" />
      <div className="sp-particle" />
      <div className="sp-particle" />

      <div className="login-card">
        {/* Left brand panel */}
        <div className="login-left">
          <div className="sp-left-content">
            <img src="/login-logo.png?v=2" alt="LedgerTrace" className="login-hero-logo" />
            <div className="login-dots">
              <span /><span /><span /><span />
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <form className="login-right" onSubmit={handleSubmit}>
          <div className="lr-secure">
            <ShieldIcon />
            SECURE
          </div>

          <h1 className="lr-title">Sign <span>In</span></h1>
          <p className="lr-welcome">Welcome back. Enter your credentials to continue.</p>

          {error && <div className="lr-error">{error}</div>}

          <div className="lr-field">
            <label className="lr-label">Username</label>
            <div className="lr-input-wrap">
              <input
                className="lr-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your username"
                autoFocus
                autoComplete="username"
              />
              <span className="lr-icon"><UserIcon /></span>
            </div>
          </div>

          <div className="lr-field">
            <label className="lr-label">Password</label>
            <div className="lr-input-wrap">
              <input
                className="lr-input"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <span className="lr-icon"><LockIcon /></span>
              <button
                type="button"
                className="lr-eye"
                onClick={() => setShowPwd((s) => !s)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                <EyeIcon off={showPwd} />
              </button>
            </div>
          </div>

          <div className="lr-actions">
            <button type="submit" className="lr-btn lr-btn-primary" disabled={loading}>
              {loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Sign In'}
            </button>
            <button type="button" className="lr-btn lr-btn-ghost" onClick={handleClear} disabled={loading}>
              Clear
            </button>
          </div>

          <a href="#forgot" className="lr-forgot" onClick={(e) => e.preventDefault()}>
            Forgot Password?
          </a>

          <div className="lr-foot">
            <LockIcon />
            256-bit SSL encrypted &middot; Authorized access only
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
