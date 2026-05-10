'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authFetchInit, redirectAfterAuth, sanitizeInternalPath } from '@/lib/auth-client';

function LoginForm() {
  const searchParams = useSearchParams();
  const from = sanitizeInternalPath(searchParams.get('from') || '/');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        ...authFetchInit,
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Sign in failed');
        setPending(false);
        return;
      }
      redirectAfterAuth(from);
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
              <span className="landing-brand__desc">Sign in</span>
            </div>
          </Link>
          <nav className="landing-nav" aria-label="Account">
            <Link href="/register" className="landing-nav__link landing-nav__link--accent">
              Create account
            </Link>
          </nav>
        </div>
      </header>
      <div className="landing-main landing-main--auth">
        <div className="landing-main__inner landing-main__inner--narrow">
          <div className="landing-form landing-reveal">
            <div className="landing-form__glow" aria-hidden="true" />
            <div className="landing-form__head">
              <h1 className="landing-form__title landing-form__title--hero">Welcome back</h1>
              <p className="landing-form__subtitle">
                New here?{' '}
                <Link href="/register" className="landing-inline-link">
                  Create an account
                </Link>
              </p>
            </div>
            <form onSubmit={submit} noValidate>
              <div className="landing-form__group">
                <label className="landing-label" htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
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
                <label className="landing-label" htmlFor="login-password">
                  Password
                </label>
                <input
                  id="login-password"
                  className="landing-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={1}
                />
              </div>
              {error ? (
                <p className="landing-alert" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="landing-btn landing-btn--primary" disabled={pending}>
                <span className="landing-btn__shine" aria-hidden="true" />
                {pending ? 'Signing in…' : 'Sign in'}
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

function LoginFallback() {
  return (
    <main className="landing" style={{ minHeight: '100vh' }}>
      <div className="landing__bg" aria-hidden="true">
        <div className="landing__gradient" />
      </div>
      <p className="landing-sr-only">Loading sign-in…</p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
