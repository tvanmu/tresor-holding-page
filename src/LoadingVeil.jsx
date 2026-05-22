import { useEffect, useMemo, useState } from "react";

const cells = [
  "0,0 13,0 17,10 10,18 0,14",
  "13,0 28,0 32,12 23,23 17,10",
  "28,0 45,0 48,11 40,21 32,12",
  "45,0 61,0 64,13 56,25 48,11",
  "61,0 78,0 81,12 74,23 64,13",
  "78,0 100,0 100,16 88,25 81,12",
  "0,14 10,18 14,31 5,41 0,37",
  "10,18 23,23 25,37 15,47 14,31",
  "23,23 40,21 43,36 33,49 25,37",
  "40,21 56,25 59,40 49,51 43,36",
  "56,25 74,23 76,38 67,50 59,40",
  "74,23 88,25 100,16 100,35 89,46 76,38",
  "0,37 5,41 13,56 5,70 0,66",
  "5,41 15,47 33,49 31,63 18,72 13,56",
  "33,49 49,51 51,66 39,78 31,63",
  "49,51 67,50 70,64 59,77 51,66",
  "67,50 89,46 92,61 80,75 70,64",
  "89,46 100,35 100,61 92,61",
  "0,66 5,70 16,83 8,100 0,100",
  "5,70 18,72 39,78 35,92 22,100 8,100 16,83",
  "39,78 59,77 63,91 51,100 35,100 35,92",
  "59,77 80,75 85,89 74,100 51,100 63,91",
  "80,75 92,61 100,61 100,84 85,89",
  "85,89 100,84 100,100 74,100",
];

function LoadingVeil() {
  const replayIntro =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("intro");
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return replayIntro || window.sessionStorage.getItem("tresor-intro-seen") !== "true";
  });
  const [exiting, setExiting] = useState(false);
  const cellData = useMemo(
    () =>
      cells.map((points, index) => ({
        delay: `${120 + index * 34}ms`,
        driftX: `${((index % 6) - 2.5) * 0.42}rem`,
        driftY: `${(Math.floor(index / 6) - 1.5) * 0.46}rem`,
        points,
      })),
    [],
  );

  useEffect(() => {
    if (!visible || exiting) {
      return undefined;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minimumDelay = reducedMotion ? 520 : 1860;
    const finishIntro = () => {
      if (!replayIntro) {
        window.sessionStorage.setItem("tresor-intro-seen", "true");
      }
      setExiting(true);
    };

    const minimumTimer = window.setTimeout(() => {
      finishIntro();
    }, minimumDelay);

    return () => {
      window.clearTimeout(minimumTimer);
    };
  }, [exiting, replayIntro, visible]);

  useEffect(() => {
    if (!exiting) {
      return undefined;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const removeTimer = window.setTimeout(() => {
      setVisible(false);
    }, reducedMotion ? 560 : 1280);

    return () => window.clearTimeout(removeTimer);
  }, [exiting]);

  if (!visible) {
    return null;
  }

  return (
    <div className={`loading-veil${exiting ? " is-exiting" : ""}`} aria-label="Entering Tresor Van Mulders">
      <svg className="loading-veil__cells" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {cellData.map((cell) => (
          <polygon
            className="loading-veil__cell"
            key={cell.points}
            points={cell.points}
            style={{
              "--cell-delay": cell.delay,
              "--drift-x": cell.driftX,
              "--drift-y": cell.driftY,
            }}
          />
        ))}
      </svg>
      <div className="loading-veil__mark" aria-hidden="true">
        <span>Tresor Van Mulders</span>
      </div>
    </div>
  );
}

export default LoadingVeil;
