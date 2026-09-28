export function SplashScreen() {
  return (
    <div className="splash-screen" style={{ background: "#fff" }}>
      <img
        src="./pig-world-logo.jpeg"
        alt="Pig World Smart"
        style={{
          width: "min(72vw, 320px)",
          height: "min(72vw, 320px)",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
