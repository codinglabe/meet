'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authFetchInit, redirectAfterAuth } from '@/lib/auth-client';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (password !== password2) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        ...authFetchInit,
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setPending(false);
        return;
      }
      redirectAfterAuth('/');
    } catch {
      setError('Network error');
      setPending(false);
    }
  };

  return (
    <main className="landing">
      <div className="landing__bg" aria-hidden="true">
        <div className="landing__gradient" />
        <div className="landing__orb landing__orb--a" />
        <div className="landing__orb landing__orb--b" />
        <div className="landing__orb landing__orb--c" />
        <div className="landing__gridlines" />
      </div>
      <header className="landing-header">
        <div className="landing-header__inner">
          <Link href="/" className="landing-brand landing-brand--link">
            <span className="landing-brand__mark">KM</span>
            <div className="landing-brand__text">
              <span className="landing-brand__name">Kreo Meet</span>
              <span className="landing-brand__desc">Create account</span>
            </div>
          </Link>
          <nav className="landing-nav" aria-label="Account">
            <Link href="/login" className="landing-nav__link">
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <div className="landing-main landing-main--auth">
        <div className="landing-main__inner landing-main__inner--narrow">
          <div className="landing-form landing-reveal">
            <div className="landing-form__glow" aria-hidden="true" />
            <div className="landing-form__head">
              <h1 className="landing-form__title landing-form__title--hero">Create your account</h1>
              <p className="landing-form__subtitle">
                Already registered?{' '}
                <Link href="/login" className="landing-inline-link">
                  Sign in
                </Link>
              </p>
            </div>
            <form onSubmit={submit} noValidate>
              <div className="landing-form__group">
                <label className="landing-label" htmlFor="reg-name">
                  Display name
                </label>
                <input
                  id="reg-name"
                  className="landing-input"
                  autoComplete="name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="How you appear on stream"
                  required
                />
              </div>
              <div className="landing-form__group">
                <label className="landing-label" htmlFor="reg-email">
                  Email
                </label>
                <input
                  id="reg-email"
                  className="landing-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="landing-form__group">
                <label className="landing-label" htmlFor="reg-password">
                  Password
                </label>
                <input
                  id="reg-password"
                  className="landing-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <p className="landing-hint">At least 8 characters.</p>
              </div>
              <div className="landing-form__group">
                <label className="landing-label" htmlFor="reg-password2">
                  Confirm password
                </label>
                <input
                  id="reg-password2"
                  className="landing-input"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {error ? (
                <p className="landing-alert" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="landing-btn landing-btn--primary" disabled={pending}>
                <span className="landing-btn__shine" aria-hidden="true" />
                {pending ? 'Creating account…' : 'Create account'}
              </button>
            </form>
            <p className="landing-form__foot">
              <Link href="/" className="landing-inline-link landing-inline-link--muted">
                ← Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>
      <footer className="landing-footer">
        <span>Kreo Meet</span>
        <span className="landing-footer__sep" aria-hidden="true" />
        <span>Live video · WebRTC</span>
      </footer>
    </main>
  );
}
