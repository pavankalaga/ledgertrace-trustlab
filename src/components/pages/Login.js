import React, { useState, useRef, useEffect } from 'react';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import CircularProgress from '@mui/material/CircularProgress';
import { loginApi, firebaseLoginApi } from '../../api';
import { auth } from '../../firebase';

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
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const KeyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="15" r="4" />
    <path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2" />
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

// Map Firebase auth error codes to friendly messages.
const firebaseErrorMessage = (err) => {
  const code = err?.code || '';
  if (code === 'auth/invalid-phone-number') return 'Enter a valid mobile number';
  if (code === 'auth/missing-phone-number') return 'Enter your mobile number';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Try again in a few minutes.';
  if (code === 'auth/quota-exceeded') return 'SMS quota exceeded. Please use the password login instead.';
  if (code === 'auth/captcha-check-failed') return 'reCAPTCHA verification failed. Please refresh and try again.';
  if (code === 'auth/invalid-verification-code') return 'Invalid OTP';
  if (code === 'auth/code-expired') return 'OTP expired. Please request a new one.';
  if (code === 'auth/operation-not-allowed') return 'Phone sign-in is not enabled. Contact your administrator.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  return err?.message || 'Something went wrong. Please try again.';
};

const Login = ({ onLogin }) => {
  // Mode: 'otp' (primary) or 'password' (fallback)
  const [mode, setMode] = useState('otp');
  // OTP flow step: 'mobile' (enter number) or 'code' (enter OTP)
  const [otpStep, setOtpStep] = useState('mobile');

  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpInfo, setOtpInfo] = useState('');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const otpInputRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);
  const confirmationResultRef = useRef(null);

  useEffect(() => {
    if (otpStep === 'code' && otpInputRef.current) otpInputRef.current.focus();
  }, [otpStep]);

  // Clean up the reCAPTCHA verifier on unmount so subsequent mounts get a fresh one.
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear(); } catch (e) { /* noop */ }
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  // Lazy: create the invisible reCAPTCHA verifier the first time we send an OTP.
  const getRecaptchaVerifier = () => {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
    return recaptchaVerifierRef.current;
  };

  const resetAll = () => {
    setMobile('');
    setOtp('');
    setOtpInfo('');
    setName('');
    setPassword('');
    setError('');
    setOtpStep('mobile');
    confirmationResultRef.current = null;
  };

  const switchMode = (next) => {
    resetAll();
    setMode(next);
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    const digits = mobile.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const verifier = getRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(auth, '+91' + digits, verifier);
      confirmationResultRef.current = confirmation;
      setOtpInfo(`OTP sent to ${digits.slice(0, 2)}xxxxx${digits.slice(-3)}`);
      setOtpStep('code');
    } catch (err) {
      console.error('signInWithPhoneNumber error:', err);
      setError(firebaseErrorMessage(err));
      // Reset reCAPTCHA on failure so the next attempt isn't poisoned by a stale token.
      if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear(); } catch (e2) { /* noop */ }
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp || otp.length < 6) {
      setError('Enter the 6-digit OTP sent to your mobile');
      return;
    }
    if (!confirmationResultRef.current) {
      setError('Please request an OTP first');
      setOtpStep('mobile');
      return;
    }
    setLoading(true);
    try {
      const credential = await confirmationResultRef.current.confirm(otp);
      const idToken = await credential.user.getIdToken();
      const data = await firebaseLoginApi(idToken);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      console.error('Verify OTP error:', err);
      setError(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !password) { setError('Please enter username and password'); return; }
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
    <div className="login-page">
      <div className="sp-grid" />
      <div className="sp-particle" />
      <div className="sp-particle" />
      <div className="sp-particle" />
      <div className="sp-particle" />
      <div className="sp-particle" />
      <div className="sp-particle" />

      {/* Invisible reCAPTCHA mount point — required by Firebase, even for invisible mode. */}
      <div id="recaptcha-container" />

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
        {mode === 'otp' ? (
          <form className="login-right" onSubmit={otpStep === 'mobile' ? handleSendOtp : handleVerifyOtp}>
            <div className="lr-secure">
              <ShieldIcon />
              SECURE
            </div>

            <h1 className="lr-title">Sign <span>In</span></h1>
            <p className="lr-welcome">
              {otpStep === 'mobile'
                ? 'Enter your registered mobile number to receive a one-time password.'
                : 'Enter the 6-digit code we sent to your phone.'}
            </p>

            {error && <div className="lr-error">{error}</div>}
            {!error && otpStep === 'code' && otpInfo && (
              <div className="lr-error" style={{ background: 'rgba(46,160,67,0.10)', color: '#1f7a32', border: '1px solid rgba(46,160,67,0.25)' }}>
                {otpInfo}
              </div>
            )}

            {otpStep === 'mobile' ? (
              <div className="lr-field">
                <label className="lr-label">Mobile Number</label>
                <div className="lr-input-wrap">
                  <input
                    className="lr-input"
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit mobile number"
                    autoFocus
                    autoComplete="tel"
                    maxLength={15}
                  />
                  <span className="lr-icon"><PhoneIcon /></span>
                </div>
              </div>
            ) : (
              <div className="lr-field">
                <label className="lr-label">One-Time Password</label>
                <div className="lr-input-wrap">
                  <input
                    ref={otpInputRef}
                    className="lr-input"
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    autoComplete="one-time-code"
                    maxLength={6}
                    style={{ letterSpacing: '6px', fontSize: '18px', fontWeight: 600 }}
                  />
                  <span className="lr-icon"><KeyIcon /></span>
                </div>
              </div>
            )}

            <div className="lr-actions">
              <button type="submit" className="lr-btn lr-btn-primary" disabled={loading}>
                {loading
                  ? <CircularProgress size={18} sx={{ color: '#fff' }} />
                  : otpStep === 'mobile' ? 'Send OTP' : 'Verify & Sign In'}
              </button>
              {otpStep === 'code' ? (
                <button
                  type="button"
                  className="lr-btn lr-btn-ghost"
                  onClick={() => { setOtp(''); setOtpInfo(''); setError(''); setOtpStep('mobile'); confirmationResultRef.current = null; }}
                  disabled={loading}
                >
                  Change Number
                </button>
              ) : (
                <button type="button" className="lr-btn lr-btn-ghost" onClick={() => setMobile('')} disabled={loading}>
                  Clear
                </button>
              )}
            </div>

            {otpStep === 'code' && (
              <a
                href="#resend"
                className="lr-forgot"
                onClick={(e) => { e.preventDefault(); if (!loading) handleSendOtp(); }}
              >
                Didn't get it? Resend OTP
              </a>
            )}

            <div className="lr-alt">
              <span className="lr-alt-rule" />
              <span className="lr-alt-or">OR</span>
              <span className="lr-alt-rule" />
            </div>

            <button
              type="button"
              className="lr-btn lr-btn-ghost lr-btn-alt"
              onClick={() => switchMode('password')}
              disabled={loading}
            >
              <LockIcon />
              Login with Username & Password
            </button>

            <div className="lr-foot">
              <LockIcon />
              256-bit SSL encrypted &middot; Authorized access only
            </div>
          </form>
        ) : (
          <form className="login-right" onSubmit={handlePasswordLogin}>
            <div className="lr-secure">
              <ShieldIcon />
              SECURE
            </div>

            <h1 className="lr-title">Sign <span>In</span></h1>
            <p className="lr-welcome">Enter your username and password to continue.</p>

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
              <button type="button" className="lr-btn lr-btn-ghost" onClick={() => { setName(''); setPassword(''); setError(''); }} disabled={loading}>
                Clear
              </button>
            </div>

            <a href="#forgot" className="lr-forgot" onClick={(e) => e.preventDefault()}>
              Forgot Password?
            </a>

            <div className="lr-alt">
              <span className="lr-alt-rule" />
              <span className="lr-alt-or">OR</span>
              <span className="lr-alt-rule" />
            </div>

            <button
              type="button"
              className="lr-btn lr-btn-ghost lr-btn-alt"
              onClick={() => switchMode('otp')}
              disabled={loading}
            >
              <PhoneIcon />
              Login with OTP
            </button>

            <div className="lr-foot">
              <LockIcon />
              256-bit SSL encrypted &middot; Authorized access only
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
