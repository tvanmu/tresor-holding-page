import LatentGeometry from "./LatentGeometry.jsx";

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

      <section className="statue-stage" aria-hidden="true">
        <div className="halo" />
        <img className="statue" src="/statue.png" alt="" />
        <div className="ground-shadow" />
      </section>

      <p className="quarry-line">Still in the quarry.</p>
    </main>
  );
}

export default App;
