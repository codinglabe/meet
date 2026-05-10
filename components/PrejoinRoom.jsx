'use client';

export default function PrejoinRoom({ roomCode, displayName, onDisplayNameChange, secureHint, onJoin }) {
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
          <div className="landing-brand" aria-label="Kreo Meet">
            <span className="landing-brand__mark" aria-hidden="true">KM</span>
            <div className="landing-brand__text">
              <span className="landing-brand__name">Kreo Meet</span>
              <span className="landing-brand__desc">Join meeting</span>
            </div>
          </div>
        </div>
      </header>

      <div className="landing-main">
        <div className="landing-main__inner" style={{ gridTemplateColumns: '1fr', maxWidth: '440px' }}>
          <section className="landing-aside landing-reveal" style={{ width: '100%', margin: '0 auto' }}>
            <form
              className="landing-form"
              onSubmit={e => {
                e.preventDefault();
                onJoin();
              }}
            >
              <div className="landing-form__glow" aria-hidden="true" />
              <div className="landing-form__head">
                <p className="landing-kicker" style={{ marginBottom: '12px' }}>
                  <span className="landing-kicker__dot" aria-hidden="true" />
                  Meeting code
                </p>
                <h2 className="landing-form__title" style={{ fontSize: '1.5rem', letterSpacing: '0.08em' }}>
                  {roomCode}
                </h2>
                <p className="landing-form__subtitle">Check your camera and mic, then join when you are ready.</p>
              </div>

              <div className="landing-form__group">
                <label className="landing-label" htmlFor="prejoin-name">Your name in this call</label>
                <input
                  id="prejoin-name"
                  className="landing-input"
                  value={displayName}
                  onChange={e => onDisplayNameChange(e.target.value)}
                  placeholder="How you appear to others"
                  autoComplete="name"
                  required
                />
              </div>

              <p className="landing-note" style={{ marginTop: 0, marginBottom: '16px' }}>
                {secureHint}
              </p>

              <button type="submit" className="landing-btn landing-btn--primary">
                <span className="landing-btn__shine" aria-hidden="true" />
                Join now
              </button>
            </form>
          </section>
        </div>
      </div>

      <footer className="landing-footer">
        <span>Kreo Meet</span>
        <span className="landing-footer__sep" aria-hidden="true" />
        <span>Next.js · WebRTC</span>
      </footer>
    </main>
  );
}
