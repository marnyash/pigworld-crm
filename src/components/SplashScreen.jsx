import "../splash.css";

export function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-label="Loading Pig World Smart">
      <div className="splash-card">
        <img className="splash-logo" src="./pig-world-logo.jpeg" alt="Pig World Smart" />
        <div className="splash-copy">
          <span className="eyebrow">Pig World Smart</span>
          <h1>Smart farm management</h1>
        </div>
        <span className="splash-progress" aria-hidden="true" />
      </div>
    </div>
  );
}
