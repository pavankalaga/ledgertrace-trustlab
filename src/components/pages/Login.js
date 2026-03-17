import React, { useState } from 'react';
import { loginApi } from '../../api';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

const Login = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.card}>
        {/* Logo */}
        <div style={styles.logoSection}>
          <img src="/login-logo.png" alt="LedgerTrace" style={styles.logo} />
          <div style={styles.appName}>LedgerTrace</div>
          <div style={styles.tagline}>Invoice Tracking & Workflow</div>
        </div>

        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Name field */}
        <div className="ff" style={{ marginBottom: 14 }}>
          <label className="f-label">Username</label>
          <input
            className="f-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your name"
            autoFocus
          />
        </div>

        {/* Password field */}
        <div className="ff" style={{ marginBottom: 24 }}>
          <label className="f-label">Password</label>
          <input
            className="f-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
          />
        </div>

        {/* Sign In button */}
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading}
          sx={{
            textTransform: 'none',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "'Syne', sans-serif",
            backgroundColor: '#0a7c6e',
            borderRadius: '8px',
            padding: '11px',
            boxShadow: 'none',
            '&:hover': { backgroundColor: '#086358', boxShadow: 'none' },
          }}
        >
          {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Sign In'}
        </Button>

        <div style={styles.footer}>Secure access to your invoice workflow</div>
      </form>
    </div>
  );
};

const styles = {
  wrapper: {
    minHeight: '100vh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0e1117 0%, #1a2332 50%, #0e1117 100%)',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    padding: '44px 40px 36px',
    width: 400,
    boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: 28,
  },
  logo: {
    height: 64,
    marginBottom: 10,
  },
  appName: {
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: -0.5,
    color: '#0e1117',
    fontFamily: "'Syne', sans-serif",
  },
  tagline: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: 13.5,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 3,
  },
  error: {
    background: '#fef2f2',
    color: '#e84040',
    padding: '9px 14px',
    borderRadius: 7,
    fontSize: 12.5,
    fontWeight: 600,
    marginBottom: 18,
    textAlign: 'center',
    border: '1px solid #fecaca',
  },
  footer: {
    textAlign: 'center',
    fontSize: 11.5,
    color: '#aaa',
    marginTop: 20,
    fontFamily: "'Crimson Pro', serif",
    fontStyle: 'italic',
  },
};

export default Login;
