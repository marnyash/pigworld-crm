export function Login({ auth, setAuth, onSubmit, notice }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="login-screen">
      <div className="login-art">
        <div className="art-label">PIG WORLD / CRM</div>
        <div className="art-copy">
          <h1>
            Better conversations.
            <br />
            <em>Stronger herds.</em>
          </h1>
          <p>Keep buyers, partners, and opportunities moving with the farm.</p>
        </div>
        <div className="art-footer">
          Customer relationships, thoughtfully managed.
        </div>
      </div>
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand-block">
          <div className="brand-mark">P</div>
          <div>
            <strong>Pig World</strong>
            <span>Customer desk</span>
          </div>
        </div>
        <div>
          <div className="eyebrow">Welcome back</div>
          <h2>Sign in to your workspace</h2>
          <p className="muted-copy">Use your Pig World account to continue.</p>
        </div>
        {notice && (
          <div className={`notice ${notice.tone}`}>{notice.message}</div>
        )}
        <label>
          Email address
          <input
            type="email"
            required
            value={auth.email}
            onChange={(event) =>
              setAuth((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <span className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={auth.password}
              onChange={(event) =>
                setAuth((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Your password"
            />
            <button
              className="password-toggle"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((current) => !current)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {showPassword ? (
                  <>
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                    <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a16 16 0 0 1-3.1 4.4M6.2 6.2C4.3 7.5 3 9.5 2.5 12c1 2.5 4.5 7 9.5 7 1.1 0 2.1-.2 3-.6" />
                  </>
                ) : (
                  <>
                    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </>
                )}
              </svg>
            </button>
          </span>
        </label>
        <button className="primary-button" type="submit">
          Continue <span>→</span>
        </button>
        <small className="login-help">
          Protected by your Pig World account
        </small>
      </form>
    </div>
  );
}
