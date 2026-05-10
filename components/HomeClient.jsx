'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { generateMeetCode, normalizeMeetCode } from '@/lib/meet-code';
const JOIN_SESSION_KEY = 'kreoMeetJoin';

export default function HomeClient() {
  const [user, setUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 15000);
    try {
      const res = await fetch('/api/auth/me', {
        signal: ac.signal,
        credentials: 'same-origin'
      });
      const data = await res.json().catch(() => ({ user: null }));
      setUser(data?.user ?? null);
      if (data?.user?.displayName) setDisplayName(data.user.displayName);
    } catch (e) {
      if (e?.name === 'AbortError') {
        setError('Could not verify your session in time. Check your connection and reload.');
      } else {
        setUser(null);
      }
    } finally {
      window.clearTimeout(t);
      setSessionReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      /* ignore */
    }
    window.location.assign('/');
  };

  const startInstantMeeting = () => {
    const name = displayName.trim();
    if (!name) {
      setError('Add your name before starting a meeting.');
      return;
    }
    const code = generateMeetCode();
    try {
      sessionStorage.setItem(JOIN_SESSION_KEY, JSON.stringify({ room: code, name, role: 'host' }));
    } catch {
      /* private mode */
    }
    window.location.assign(`${window.location.origin}/room/${encodeURIComponent(code)}`);
  };

  const joinWithCode = () => {
    const code = normalizeMeetCode(joinCode);
    if (code.length < 5) {
      setError('Enter a valid meeting code (e.g. abc-def-ghi).');
      return;
    }
    window.location.assign(`${window.location.origin}/room/${encodeURIComponent(code)}`);
  };

  if (!user) {
    return (
      <main className="landing">
        <div className="landing__bg" aria-hidden="true">
          <div className="landing__gradient" />
          <div className="landing__orb landing__orb--a" />
          <div className="landing__orb landing__orb--b" />
          <div className="landing__orb landing__orb--c" />
          <div className="landing__gridlines" />
          <div className="landing__noise" aria-hidden="true" />
        </div>

        <header className="landing-header">
          <div className="landing-header__inner">
            <Link href="/" className="landing-brand landing-brand--link">
              <span className="landing-brand__mark">KM</span>
              <div className="landing-brand__text">
                <span className="landing-brand__name">Kreo Meet</span>
                <span className="landing-brand__desc">Live video for teams</span>
              </div>
            </Link>
            <nav className="landing-nav" aria-label="Account">
              <Link href="/login" className="landing-nav__link">
                Sign in
              </Link>
              <Link href="/register" className="landing-nav__link landing-nav__link--accent">
                Get started
              </Link>
            </nav>
          </div>
        </header>

        <div className="landing-main">
          <div className="landing-main__inner landing-main__inner--hero">
            <section className="landing-hero-copy landing-reveal">
              {!sessionReady ? (
                <div className="landing-session-line" aria-live="polite">
                  <span className="landing-session-line__bar" />
                  <span>Checking your session…</span>
                </div>
              ) : null}
              {error ? (
                <p className="landing-alert landing-alert--inline" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="landing-live-pill">
                <span className="landing-live-pill__dot" aria-hidden="true" />
                <span>Broadcast-ready</span>
              </div>

              <h1 className="landing-hero-title">
                Go <span className="landing-hero-title__grad">live</span> in seconds — crystal-clear meetings for everyone.
              </h1>
              <p className="landing-hero-lede">
                HD WebRTC rooms, instant links, and a lobby built for hosts who stream, teach, and collaborate. Sign in,
                tap <strong>New meeting</strong>, and share your code.
              </p>

              <ul className="landing-chip-row" aria-label="Highlights">
                <li className="landing-chip">Live WebRTC</li>
                <li className="landing-chip">Screen share</li>
                <li className="landing-chip">Chat &amp; hand raise</li>
                <li className="landing-chip">Attendance export</li>
              </ul>

              <div className="landing-hero-actions">
                <Link href="/register" className="landing-btn landing-btn--primary landing-btn--inline">
                  <span className="landing-btn__shine" aria-hidden="true" />
                  Start for free
                </Link>
                <Link href="/login" className="landing-btn landing-btn--secondary landing-btn--inline">
                  Sign in
                </Link>
              </div>
            </section>

            <aside className="landing-hero-visual landing-reveal landing-reveal--delayed" aria-hidden="true">
              <div className="landing-stream-deck">
                <div className="landing-stream-deck__top">
                  <span className="landing-rec-badge">
                    <span className="landing-rec-badge__pulse" />
                    LIVE
                  </span>
                  <span className="landing-stream-deck__meta">Studio preview</span>
                </div>
                <div className="landing-stream-grid">
                  <div className="landing-stream-tile landing-stream-tile--main">
                    <span className="landing-stream-tile__label">Host · You</span>
                    <div className="landing-stream-tile__waves" />
                  </div>
                  <div className="landing-stream-tile">
                    <span className="landing-stream-tile__label">Guest 1</span>
                  </div>
                  <div className="landing-stream-tile">
                    <span className="landing-stream-tile__label">Guest 2</span>
                  </div>
                  <div className="landing-stream-tile landing-stream-tile--chat">
                    <span className="landing-stream-tile__label">Live chat</span>
                    <div className="landing-chat-fake">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
                <div className="landing-stream-deck__footer">
                  <span className="landing-level-meter" aria-hidden="true">
                    <span className="landing-level-meter__fill" />
                  </span>
                  <span>Signal · Excellent</span>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <footer className="landing-footer">
          <span>Kreo Meet</span>
          <span className="landing-footer__sep" aria-hidden="true" />
          <span>Next.js · WebRTC · Built for live sessions</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="landing">
      <div className="landing__bg" aria-hidden="true">
        <div className="landing__gradient" />
        <div className="landing__orb landing__orb--a" />
        <div className="landing__orb landing__orb--b" />
        <div className="landing__orb landing__orb--c" />
        <div className="landing__gridlines" />
        <div className="landing__noise" aria-hidden="true" />
      </div>

      <header className="landing-header">
        <div className="landing-header__inner">
          <Link href="/" className="landing-brand landing-brand--link">
            <span className="landing-brand__mark">KM</span>
            <div className="landing-brand__text">
              <span className="landing-brand__name">Kreo Meet</span>
              <span className="landing-brand__desc">{user.email}</span>
            </div>
          </Link>
          <div className="landing-header-actions">
            <span className="landing-live-pill landing-live-pill--compact">
              <span className="landing-live-pill__dot" aria-hidden="true" />
              Ready to stream
            </span>
            <button type="button" className="landing-header__skip" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="landing-main">
        <div className="landing-main__inner landing-main__inner--hero">
          <section className="landing-hero-copy landing-reveal">
            <div className="landing-live-pill">
              <span className="landing-live-pill__dot" aria-hidden="true" />
              <span>Signed in</span>
            </div>
            <h1 className="landing-hero-title">
              Your studio is <span className="landing-hero-title__grad">one tap</span> away.
            </h1>
            <p className="landing-hero-lede">
              Spin up a fresh meeting code, drop your display name, and you are on air. Guests use the same link after
              they sign in — built for predictable live sessions.
            </p>
            <ul className="landing-chip-row" aria-label="Session tools">
              <li className="landing-chip">Instant room codes</li>
              <li className="landing-chip">Cam &amp; mic</li>
              <li className="landing-chip">Share screen</li>
            </ul>
          </section>

          <div className="landing-aside landing-reveal landing-reveal--delayed">
            <div className="landing-form landing-form--dashboard">
              <div className="landing-form__glow" aria-hidden="true" />
              <div className="landing-form__head">
                <h2 className="landing-form__title">Go on air</h2>
                <p className="landing-form__subtitle">Name shown in the call. Change it anytime before you start.</p>
              </div>

              <div className="landing-form__group">
                <label className="landing-label" htmlFor="home-display">
                  Display name
                </label>
                <input
                  id="home-display"
                  className="landing-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your on-stream name"
                  autoComplete="name"
                />
              </div>

              {error ? (
                <p className="landing-alert" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="button" className="landing-btn landing-btn--primary" onClick={startInstantMeeting}>
                <span className="landing-btn__shine" aria-hidden="true" />
                New meeting
              </button>

              <div className="landing-form__head landing-form__head--spaced">
                <h2 className="landing-form__title landing-form__title--sm">Join with a code</h2>
                <p className="landing-form__subtitle">Paste the code from your invite, then join from the lobby.</p>
              </div>

              <div className="landing-form__group">
                <label className="landing-label" htmlFor="home-code">
                  Meeting code
                </label>
                <input
                  id="home-code"
                  className="landing-input"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  placeholder="abc-def-ghi"
                  autoCapitalize="none"
                />
              </div>

              <button type="button" className="landing-btn landing-btn--secondary landing-btn--block" onClick={joinWithCode}>
                Join meeting
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="landing-footer">
        <span>Kreo Meet</span>
        <span className="landing-footer__sep" aria-hidden="true" />
        <span>Next.js · WebRTC · Built for live sessions</span>
      </footer>
    </main>
  );
}
