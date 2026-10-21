import { useState } from 'react';
import { ArrowRight, CircleAlert, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import Logo from './Logo.jsx';
import { login } from '../lib/auth.js';

// Sign-in card: username + password, checked by the app's server. `notice`: a problem found before the form
// was used (e.g. the login isn't set up on the server).
export default function AuthScreen({ onSignedIn, notice = '' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onSignedIn(await login(username.trim(), password));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const shown = error || notice;

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo className="auth-logo" />
          <span>Landing Page Assistant</span>
        </div>

        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-sub">Sign in to open the dashboard.</p>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field">
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <div className="auth-password">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </label>

          {shown && (
            <div className="auth-notice auth-notice-error" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              <p>{shown}</p>
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
            <span>Sign in</span>
            {!busy && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </form>
      </div>
    </div>
  );
}
