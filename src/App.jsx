import LatentGeometry from "./LatentGeometry.jsx";
import LoadingVeil from "./LoadingVeil.jsx";

function App() {
  return (
    <main className="atelier-page" aria-label="Tresor Van Mulders">
      <div className="marble-field" aria-hidden="true" />
      <div className="ambient ambient-left" aria-hidden="true" />
      <div className="ambient ambient-right" aria-hidden="true" />
      <LatentGeometry />
      <div className="grain" aria-hidden="true" />

      <header className="site-mark">
        <p>Tresor Van Mulders</p>
        <p>2026</p>
      </header>

      <LoadingVeil />
    </main>
  );
}

export default App;
