import { useEffect, useMemo, useRef, useState } from "react";

// ============================================================
// CONSTANTS
// ============================================================

// The spiral path runs INNER → OUTER. The visible stroke is animated
// to draw itself starting from the seed and unfurling outward. The plane
// reuses this same path but rides it backwards (using keyPoints) so it
// travels from the outer edge toward the centre.
const SPIRAL_D = `M 400 240
  A 10 10 0 0 0 390 250
  A 10 10 0 0 0 400 260
  A 20 20 0 0 0 420 240
  A 30 30 0 0 0 390 210
  A 50 50 0 0 0 340 260
  A 80 80 0 0 0 420 340
  A 130 130 0 0 0 550 210
  A 210 210 0 0 0 340 0
  A 340 340 0 0 0 0 340
  A 550 550 0 0 0 550 890`;

const PHI_ANGLE = Math.PI * (3 - Math.sqrt(5)); // golden angle ≈ 137.5°

const GRID_LINES = [
  { x1: 0,   y1: 340, x2: 550, y2: 340, sections: ["projects", "education", "micro"] },
  { x1: 340, y1: 0,   x2: 340, y2: 340, sections: ["education", "contact", "micro"] },
  { x1: 340, y1: 210, x2: 550, y2: 210, sections: ["contact", "micro"] },
  { x1: 420, y1: 210, x2: 420, y2: 340, sections: ["micro"] },
  { x1: 340, y1: 260, x2: 420, y2: 260, sections: ["micro"] },
  { x1: 390, y1: 210, x2: 390, y2: 260, sections: ["micro"] },
  { x1: 390, y1: 240, x2: 420, y2: 240, sections: ["micro"] },
  { x1: 400, y1: 240, x2: 400, y2: 260, sections: ["micro"] },
  { x1: 390, y1: 250, x2: 400, y2: 250, sections: ["micro"] },
];

// Phyllotaxis (golden-angle) constellations — one per content square.
// data-square names match the SECTION now living in that square,
// so hovering a numeral lights up the matching constellation.
// Counts are Fibonacci numbers (a quiet joke).
// `depth` drives parallax — bigger squares behave as if closer to the viewer,
// so they shift more when the cursor moves (fake 2D depth via differential).
const PHYLLOTAXIS_SQUARES = [
  { id: "projects",  cx: 275, cy: 580, radius: 200, count: 89, depth: 1.00 },  // Hero (550)
  { id: "education", cx: 170, cy: 170, radius: 148, count: 55, depth: 0.74 },  // Education (340)
  { id: "contact",   cx: 445, cy: 105, radius: 92,  count: 34, depth: 0.52 },  // Projects (210)
  { id: "decor",     cx: 485, cy: 275, radius: 56,  count: 21, depth: 0.34 },  // Contact (130) — decoration
];

// Roman numerals, shifted outward — each numeral now sits in the margin
// outside the next-bigger square. I/II/III map to the three biggest
// rectangles: Hero → Projects, Education → Education, Projects → Contact.
const NUMERALS = [
  { section: "projects",  label: "I",   x: -14, y: 615, textY: 621, pos: "bl" },
  { section: "education", label: "II",  x: -14, y: -14, textY: -8,  pos: "tl", quirk: "rotate" },
  { section: "contact",   label: "III", x: 564, y: -14, textY: -8,  pos: "tr" },
];

// Each section's spiral arc pivot point (in SVG coords).
// The radial reveal expands FROM this point — so each panel opens from
// the geometric hinge of the spiral for that section.
const ARC_CENTERS = {
  projects:  { x: 0,   y: 890 },  // Hero arc pivot (bottom-left of canvas)
  education: { x: 340, y: 340 },  // Education arc pivot
  contact:   { x: 550, y: 0   },  // Projects arc pivot (top-right of canvas)
  micro:     { x: 340, y: 340 },
};

// Top-down plane silhouette: nose at +X, wings at ±Y, tail at the back.
const PLANE_PATH =
  "M 12,0 L -1.3,-0.95 L -5.5,-9.5 L -6.8,-9.5 L -4,-0.95 L -8.7,-0.95 " +
  "L -10,-4 L -11.5,-4 L -10.8,-0.95 L -12.2,-0.95 L -12.2,0.95 L -10.8,0.95 " +
  "L -11.5,4 L -10,4 L -8.7,0.95 L -4,0.95 L -6.8,9.5 L -5.5,9.5 L -1.3,0.95 Z";

// ============================================================
// HELPERS
// ============================================================

// Each constellation has a warmer core: the innermost dots carry a brass
// tint that fades to cream by the time you've moved ~10 dots outward.
// Smoothstep across a small band so the transition is felt, not seen.
function dotFill(i) {
  const t = Math.max(0, Math.min(1, (i - 2) / 8));
  const s = t * t * (3 - 2 * t);
  const r = Math.round(156 + (243 - 156) * s);
  const g = Math.round(122 + (242 - 122) * s);
  const b = Math.round(62  + (235 - 62)  * s);
  return `rgb(${r}, ${g}, ${b})`;
}

function generateDots(cx, cy, maxR, count) {
  const dots = new Array(count);
  for (let i = 0; i < count; i++) {
    const r = maxR * Math.sqrt((i + 0.5) / count);
    const a = i * PHI_ANGLE;
    dots[i] = {
      cx:    +(cx + r * Math.cos(a)).toFixed(2),
      cy:    +(cy + r * Math.sin(a)).toFixed(2),
      r:     +(0.5 + 0.55 * (i / count)).toFixed(2),
      fill:  dotFill(i),
      // negative animation-delay spreads twinkle phase across the cluster
      delay: +(-(i * 0.137)).toFixed(2),
    };
  }
  return dots;
}

// ============================================================
// COMPONENT
// ============================================================

export default function Hero() {
  const [isBuilt, setIsBuilt]               = useState(false);
  const [hoveredSection, setHoveredSection] = useState(null);
  const [openSection, setOpenSection]       = useState(null);
  const [origin, setOrigin]                 = useState({ x: 0, y: 0 });
  const [easterActive, setEasterActive]     = useState(false);

  const svgRef    = useRef(null);
  const spiralRef = useRef(null);

  // Pre-compute the dot constellations once
  const squares = useMemo(
    () => PHYLLOTAXIS_SQUARES.map((sq) => ({
      ...sq,
      dots: generateDots(sq.cx, sq.cy, sq.radius, sq.count),
    })),
    []
  );

  // Background starfield — 89 dim stars distributed via jittered grid across
  // the whole viewport, each with its own twinkle phase. Generated once.
  // Fibonacci count, mirroring the projects constellation as a quiet rhyme.
  const bgStars = useMemo(() => {
    const cols = 11, rows = 9;
    const cells = Array.from({ length: cols * rows }, (_, i) => i);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return cells.slice(0, 89).map((cellIdx, i) => {
      const col = cellIdx % cols;
      const row = Math.floor(cellIdx / cols);
      return {
        x: +(((col + Math.random()) / cols) * 100).toFixed(2),
        y: +(((row + Math.random()) / rows) * 100).toFixed(2),
        delay: +(-(i * 0.213)).toFixed(2),
      };
    });
  }, []);

  // Time-aware cream — warmer at dawn, cooler at night
  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 9) {
      document.documentElement.style.setProperty("--tvm-cream", "#f3eee0");
    } else if (h >= 22 || h < 5) {
      document.documentElement.style.setProperty("--tvm-cream", "#e8ebf2");
    }
    return () => document.documentElement.style.removeProperty("--tvm-cream");
  }, []);

  // Mouse parallax — write a smoothed cursor position to two CSS variables
  // on the document root. Constellations and the background starfield each
  // read them with their own depth multiplier, so the same input drives
  // different magnitudes of motion (foreground moves more, background less).
  // Touch devices never fire mousemove, so the vars stay at 0 and nothing
  // visible parallaxes — twinkle + drift carry the "alive" feel for touch.
  useEffect(() => {
    const root = document.documentElement;
    const target  = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let rafId;

    const onMove = (e) => {
      target.x = (e.clientX / window.innerWidth)  * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const tick = () => {
      current.x += (target.x - current.x) * 0.06;
      current.y += (target.y - current.y) * 0.06;
      root.style.setProperty("--tvm-px", current.x.toFixed(3));
      root.style.setProperty("--tvm-py", current.y.toFixed(3));
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafId) cancelAnimationFrame(rafId);
      root.style.removeProperty("--tvm-px");
      root.style.removeProperty("--tvm-py");
    };
  }, []);

  // Easter egg — when triggered, schedule a clear after the full 11s
  // life cycle (2s fade-in + 7s hold + 2s fade-out, see keyframes).
  useEffect(() => {
    if (!easterActive) return undefined;
    const t = setTimeout(() => setEasterActive(false), 11000);
    return () => clearTimeout(t);
  }, [easterActive]);

  // Draw the spiral: inner end first, unfurling outward
  useEffect(() => {
    const spiral = spiralRef.current;
    if (!spiral || typeof spiral.getTotalLength !== "function") return;

    const length = spiral.getTotalLength();
    spiral.style.strokeDasharray  = length;
    spiral.style.strokeDashoffset = length;

    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setIsBuilt(true);
        spiral.style.transition =
          "stroke-dashoffset 2.0s cubic-bezier(0.65, 0, 0.35, 1) 0.6s";
        spiral.style.strokeDashoffset = "0";
      });
    });
    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, []);

  // Escape closes any open panel
  useEffect(() => {
    if (!openSection) return undefined;
    const handler = (e) => { if (e.key === "Escape") setOpenSection(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openSection]);

  // Compute the radial-reveal origin in viewport coords from the arc pivot
  function arcOriginInViewport(section) {
    const arc = ARC_CENTERS[section];
    const svg = svgRef.current;
    if (!arc || !svg || typeof svg.getScreenCTM !== "function") {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    const pt = svg.createSVGPoint();
    pt.x = arc.x;
    pt.y = arc.y;
    const screen = pt.matrixTransform(ctm);
    return { x: screen.x, y: screen.y };
  }

  function openPanel(section) {
    setOrigin(arcOriginInViewport(section));
    setOpenSection(section);
  }

  function closePanel() {
    setOpenSection(null);
  }

  // Shared handler set for any element that opens a section
  const sectionHandlers = (section) => ({
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); openPanel(section); },
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPanel(section);
      }
    },
    onMouseEnter: () => setHoveredSection(section),
    onMouseLeave: () => setHoveredSection(null),
    onFocus:      () => setHoveredSection(section),
    onBlur:       () => setHoveredSection(null),
    tabIndex: 0,
    role: "button",
  });

  const isActive = (section) =>
    hoveredSection === section || openSection === section;
  const activeLineSection = openSection || hoveredSection;

  return (
    <>
      <style>{`
        /* ============================================================
           TOKENS
           ============================================================ */
        .tvm-root {
          --tvm-ink:           #050505;
          --tvm-ink-deeper:    #030303;
          --tvm-cream:         #f3f2eb;
          --tvm-cream-cool:    #e8ebe5;
          --tvm-cream-warm:    #f3eee0;
          --tvm-muted:         #6b6b66;
          --tvm-muted-deep:    #4a4a45;
          --tvm-hairline:        rgba(243, 242, 235, 0.12);
          --tvm-hairline-faint:  rgba(243, 242, 235, 0.055);
          --tvm-hairline-strong: rgba(243, 242, 235, 0.22);
          --tvm-accent:        #9c7a3e;

          --tvm-serif: 'Cormorant Garamond', 'EB Garamond', Georgia, serif;
          --tvm-mono:  ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;

          --tvm-ease-soft:      cubic-bezier(0.16, 1, 0.3, 1);
          --tvm-ease-overshoot: cubic-bezier(0.34, 1.28, 0.46, 1);
          --tvm-ease-still:     cubic-bezier(0.4, 0, 0.2, 1);
          --tvm-ease-line:      cubic-bezier(0.65, 0, 0.35, 1);

          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          background: var(--tvm-ink);
          color: var(--tvm-cream);
          font-family: var(--tvm-serif);
          font-feature-settings: "kern", "liga", "calt", "onum";
          font-variant-numeric: oldstyle-nums;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          overflow: hidden;
        }

        .tvm-root *,
        .tvm-root *::before,
        .tvm-root *::after { box-sizing: border-box; }

        .tvm-root ::selection {
          background: var(--tvm-accent);
          color: var(--tvm-ink);
        }

        /* very quiet vertical guides drifting in the background */
        .tvm-quiet-drift {
          position: absolute;
          inset: -1px;
          z-index: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg, transparent 49.75%, rgba(243,242,235,0.018) 49.9% 50.1%, transparent 50.25%),
            repeating-linear-gradient(90deg, transparent 0 9rem, rgba(243,242,235,0.006) 9rem calc(9rem + 1px), transparent calc(9rem + 1px) 18rem);
          opacity: 0.22;
          transform: translateX(-3%);
          animation: tvm-quiet-drift 38s linear infinite alternate;
        }
        @keyframes tvm-quiet-drift {
          to { transform: translateX(3%); opacity: 0.3; }
        }

        /* ============================================================
           STAGE
           ============================================================ */
        .tvm-stage {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 1.25rem;
          z-index: 1;
          transition:
            transform 0.95s var(--tvm-ease-soft),
            filter 0.85s ease,
            opacity 0.85s ease;
        }
        .tvm-stage[data-panel="true"] {
          transform: scale(0.968);
          filter: blur(1.3px) brightness(0.42);
          opacity: 0.78;
        }

        .tvm-canvas-wrap {
          position: relative;
          height: 100%;
          aspect-ratio: 550 / 890;
          max-width: 100%;
          max-height: 100%;
        }

        .tvm-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          overflow: visible;
        }

        /* ============================================================
           GEOMETRY
           ============================================================ */
        .tvm-grid-line {
          stroke: rgba(243, 242, 235, 0.09);
          stroke-width: 0.65;
          stroke-linecap: round;
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          stroke-opacity: 0.82;
          fill: none;
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          transition:
            opacity 1.4s var(--tvm-ease-soft) 2.35s,
            stroke-dashoffset 1.9s var(--tvm-ease-line) calc(2.35s + var(--tvm-line-delay, 0s)),
            stroke 0.75s var(--tvm-ease-soft),
            stroke-width 0.75s var(--tvm-ease-soft),
            stroke-opacity 0.75s var(--tvm-ease-soft),
            filter 0.75s var(--tvm-ease-soft);
        }
        .tvm-stage[data-built="true"] .tvm-grid-line {
          opacity: 1;
          stroke-dashoffset: 0;
          animation: tvm-grid-breathe 8.5s ease-in-out calc(4.4s + var(--tvm-line-delay, 0s)) infinite alternate;
        }
        .tvm-stage[data-built="true"] .tvm-grid-line[data-active="true"] {
          stroke: rgba(243, 242, 235, 0.24);
          stroke-width: 0.86;
          stroke-opacity: 1;
          filter: drop-shadow(0 0 4px rgba(243, 242, 235, 0.16));
        }
        @keyframes tvm-grid-breathe {
          from { stroke-opacity: 0.72; }
          to   { stroke-opacity: 0.96; }
        }

        .tvm-spiral {
          fill: none;
          stroke: var(--tvm-cream);
          stroke-width: 1.05;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .tvm-spiral-dash {
          fill: none;
          stroke: var(--tvm-cream);
          stroke-width: 0.45;
          stroke-dasharray: 1 11;
          stroke-linecap: round;
          opacity: 0;
          transition: opacity 1.6s var(--tvm-ease-soft) 5.8s;
        }
        .tvm-stage[data-built="true"] .tvm-spiral-dash {
          opacity: 0.34;
          animation: tvm-dash-drift 26s linear infinite;
        }
        @keyframes tvm-dash-drift {
          to { stroke-dashoffset: -240; }
        }

        /* the seed — first thing to appear */
        .tvm-seed-mark {
          fill: var(--tvm-accent);
          opacity: 0;
          transform: scale(0);
          transform-origin: 400px 240px;
          transform-box: fill-box;
          transition:
            opacity 1.0s ease 0.2s,
            transform 1.6s var(--tvm-ease-overshoot) 0.2s;
        }
        .tvm-stage[data-built="true"] .tvm-seed-mark {
          opacity: 0.9;
          transform: scale(1);
        }

        .tvm-seed-halo {
          fill: none;
          stroke: var(--tvm-accent);
          stroke-width: 0.5;
          opacity: 0;
          transform: scale(0);
          transform-origin: 400px 240px;
          transform-box: fill-box;
          transition:
            opacity 1.2s ease 0.6s,
            transform 2s var(--tvm-ease-overshoot) 0.6s;
        }
        .tvm-stage[data-built="true"] .tvm-seed-halo {
          opacity: 0.32;
          transform: scale(1);
        }

        /* seed click target — invisible, no cursor change. The brass dot
           is the easter-egg trigger; finding it is the egg itself. */
        .tvm-seed-hit {
          fill: transparent;
          pointer-events: all;
        }

        /* easter-egg quote — Inception, riding the spiral path from ~55%
           along its length outward. Cormorant italic, very small, very
           quiet — meant to read as something the page mumbled to itself. */
        .tvm-easter-text {
          font-family: var(--tvm-serif);
          font-style: italic;
          font-weight: 400;
          font-size: 11px;
          letter-spacing: 0.14em;
          fill: var(--tvm-cream);
          opacity: 0;
          pointer-events: none;
          user-select: none;
        }
        .tvm-easter-text[data-active="true"] {
          animation: tvm-easter-life 11s var(--tvm-ease-soft) forwards;
        }
        @keyframes tvm-easter-life {
          0%   { opacity: 0;    }
          18%  { opacity: 0.5;  }
          80%  { opacity: 0.5;  }
          100% { opacity: 0;    }
        }

        /* DOT CONSTELLATIONS — five nested transform layers, each owning ONE
           transform concern, so the slow drift, the orbit, the hover-morph,
           and the mouse parallax never fight for the same property. From
           outside in:
             1. tvm-dots-parallax   translate, driven by mouse via CSS var
             2. tvm-dots-active     scale+rotate on hover (transform-origin = cx,cy)
             3. tvm-dots-drift      sub-pixel slow drift on alternate loop
             4. tvm-dots-orbit      continuous slow rotation (decor only)
             5. tvm-dots            opacity, entrance fade, glow filter
                  └ circle           per-dot twinkle on its own phase                                                                  */

        /* outermost: parallax driven by --tvm-px / --tvm-py (range ~[-1, 1])
           multiplied by the constellation's depth (foreground moves more) */
        .tvm-dots-parallax {
          transform: translate(
            calc(var(--tvm-px, 0) * var(--tvm-depth, 1) * 4.5px),
            calc(var(--tvm-py, 0) * var(--tvm-depth, 1) * 4.5px)
          );
        }

        /* hover/open morph — constellation expands and tilts toward the user.
           Inline transform-origin is set per-constellation to its cx,cy in
           SVG user units so the rotation pivots on the cluster's center. */
        .tvm-dots-active {
          transition: transform 0.7s var(--tvm-ease-overshoot);
        }
        .tvm-dots-parallax[data-active="true"] .tvm-dots-active {
          transform: scale(1.06) rotate(6deg);
        }

        /* slow drift — kept from prior pass, now isolated to its own layer */
        .tvm-stage[data-built="true"] .tvm-dots-drift[data-square="projects"]  { animation: tvm-dots-drift-1 22s ease-in-out -8s  infinite alternate; }
        .tvm-stage[data-built="true"] .tvm-dots-drift[data-square="education"] { animation: tvm-dots-drift-2 18s ease-in-out -14s infinite alternate; }
        .tvm-stage[data-built="true"] .tvm-dots-drift[data-square="contact"]   { animation: tvm-dots-drift-3 26s ease-in-out -3s  infinite alternate; }
        .tvm-stage[data-built="true"] .tvm-dots-drift[data-square="decor"]     { animation: tvm-dots-drift-4 30s ease-in-out -19s infinite alternate; }
        @keyframes tvm-dots-drift-1 { from { transform: translate(0, 0); } to { transform: translate(-1.4px,  0.7px); } }
        @keyframes tvm-dots-drift-2 { from { transform: translate(0, 0); } to { transform: translate( 1.1px, -1.3px); } }
        @keyframes tvm-dots-drift-3 { from { transform: translate(0, 0); } to { transform: translate(-0.6px, -1.1px); } }
        @keyframes tvm-dots-drift-4 { from { transform: translate(0, 0); } to { transform: translate( 0.8px,  1.0px); } }

        /* orbit — Saturn-rings move on the smallest (decor) constellation.
           One revolution every 96s; barely perceptible by direct gaze, only
           noticeable if you look away and back. */
        .tvm-stage[data-built="true"] .tvm-dots-orbit {
          animation: tvm-dots-orbit 96s linear infinite;
        }
        @keyframes tvm-dots-orbit {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* innermost wrapper — opacity, entrance fade, glow filter.
           Active-state brightening is keyed off the OUTER parallax wrapper's
           data-active so all four layers above can react together. */
        .tvm-dots {
          opacity: 0;
          transition: opacity 0.55s var(--tvm-ease-soft);
        }
        .tvm-stage[data-built="true"] .tvm-dots {
          opacity: 0.45;
          animation: tvm-dots-entrance 1.4s var(--tvm-ease-soft) 5.0s backwards;
        }
        .tvm-stage[data-built="true"] .tvm-dots-parallax[data-active="true"] .tvm-dots {
          opacity: 0.95;
        }
        @keyframes tvm-dots-entrance {
          from { opacity: 0; }
          to   { opacity: 0.45; }
        }

        /* per-star pulse — one keyframe, delay set inline per circle */
        .tvm-dots circle {
          animation: tvm-dot-twinkle 6.2s ease-in-out infinite;
        }
        @keyframes tvm-dot-twinkle {
          0%, 100% { opacity: 0.5;  }
          50%      { opacity: 0.95; }
        }

        /* ============================================================
           BACKGROUND STARFIELD — 89 dim points filling the dark margins
                                   beyond the spiral canvas. Each star
                                   twinkles on its own phase; the whole
                                   field parallaxes at lower depth than
                                   the constellations (further away).
           ============================================================ */
        .tvm-starfield {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0;
          transition: opacity 1.8s var(--tvm-ease-soft) 4.4s;
          transform: translate(
            calc(var(--tvm-px, 0) * 1.6px),
            calc(var(--tvm-py, 0) * 1.6px)
          );
        }
        .tvm-stage[data-built="true"] .tvm-starfield {
          opacity: 1;
        }
        .tvm-bgstar {
          position: absolute;
          width: 1.4px;
          height: 1.4px;
          background: var(--tvm-cream);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.04;
          animation: tvm-bgstar-twinkle 9.4s ease-in-out infinite;
        }
        @keyframes tvm-bgstar-twinkle {
          0%, 100% { opacity: 0.04; }
          50%      { opacity: 0.18; }
        }

        /* ============================================================
           PLANE — the easter egg.
                   Starts the moment the spiral begins drawing, moves slowly,
                   vanishes just slightly later than the spiral completes.
                   Small, faint, single appearance per page load.
                   "Wait — was that a bird?"
           ============================================================ */
        .tvm-plane-wrap { opacity: 0; }

        .tvm-stage[data-built="true"] .tvm-plane-wrap {
          animation: tvm-plane-life 3.6s ease-out 0.6s forwards;
        }

        @keyframes tvm-plane-life {
          0%   { opacity: 0; }
          14%  { opacity: 0.22; }   /* fade in over first ~0.5s */
          55%  { opacity: 0.22; }   /* faintly visible for ~1.5s */
          100% { opacity: 0; }      /* fade out over last ~1.6s */
        }

        .tvm-plane { fill: var(--tvm-cream); }

        /* ============================================================
           NUMERALS
           ============================================================ */
        .tvm-numerals {
          opacity: 0;
          transition: opacity 1.2s var(--tvm-ease-soft) 4.4s;
        }
        .tvm-stage[data-built="true"] .tvm-numerals { opacity: 1; }

        .tvm-numeral-group { outline: none; }
        .tvm-numeral-group:focus-visible .tvm-numeral-text { fill: var(--tvm-cream); }

        .tvm-numeral-hit {
          fill: transparent;
          cursor: pointer;
          pointer-events: all;
        }

        .tvm-numeral-text {
          font-family: var(--tvm-serif);
          font-style: italic;
          font-weight: 400;
          font-size: 24px;
          fill: var(--tvm-muted);
          pointer-events: none;
          transition:
            fill 0.55s ease,
            filter 0.55s ease,
            transform 0.7s var(--tvm-ease-soft);
        }

        .tvm-numeral-group[data-active="true"] .tvm-numeral-text {
          fill: var(--tvm-cream);
          filter:
            drop-shadow(0 0 6px rgba(243, 242, 235, 0.42))
            drop-shadow(0 0 18px rgba(243, 242, 235, 0.20));
        }

        /* position-aware nudges */
        .tvm-numeral-group[data-pos="tl"][data-active="true"] .tvm-numeral-text { transform: translate(-2px, -2px); }
        .tvm-numeral-group[data-pos="tr"][data-active="true"] .tvm-numeral-text { transform: translate(2px, -2px); }
        .tvm-numeral-group[data-pos="br"][data-active="true"] .tvm-numeral-text { transform: translate(2px, 2px); }
        .tvm-numeral-group[data-pos="bl"][data-active="true"] .tvm-numeral-text { transform: translate(-2px, 2px); }

        /* deliberate quirk — numeral II tilts 1.5° off-axis */
        .tvm-numeral-text[data-quirk="rotate"] {
          transform-box: fill-box;
          transform-origin: center;
          transform: rotate(1.5deg);
        }
        .tvm-numeral-group[data-pos="tl"][data-active="true"] .tvm-numeral-text[data-quirk="rotate"] {
          transform: translate(-2px, -2px) rotate(1.5deg);
        }

        /* ============================================================
           NAV WRAPPERS (foreignObject children)
           ============================================================ */
        .tvm-nav-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          display: block;
          cursor: pointer;
          background: transparent;
          transition: background-color 0.55s ease;
          outline: none;
        }
        .tvm-nav-wrapper:hover { background-color: rgba(243, 242, 235, 0.016); }
        .tvm-nav-wrapper:focus-visible .tvm-nav-marginale { color: var(--tvm-cream); }

        .tvm-nav-marginale {
          position: absolute;
          bottom: 14px;
          right: 18px;
          font-family: var(--tvm-serif);
          font-style: italic;
          font-weight: 400;
          font-size: 12px;
          color: var(--tvm-muted);
          letter-spacing: 0.05em;
          opacity: 0;
          transform: translateX(-6px);
          transition:
            opacity 0.6s var(--tvm-ease-soft),
            transform 0.75s var(--tvm-ease-soft),
            color 0.4s ease;
        }
        .tvm-nav-wrapper:hover .tvm-nav-marginale,
        .tvm-nav-wrapper:focus-visible .tvm-nav-marginale {
          opacity: 0.86;
          transform: translateX(0);
        }
        .tvm-nav-wrapper.tvm-tiny .tvm-nav-marginale {
          bottom: 6px;
          right: 9px;
          font-size: 12px;
          color: var(--tvm-accent);
          letter-spacing: 0;
        }
        .tvm-nav-wrapper.tvm-tiny:hover .tvm-nav-marginale,
        .tvm-nav-wrapper.tvm-tiny:focus-visible .tvm-nav-marginale {
          opacity: 0.95;
        }

        .tvm-hero-frame {
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        /* ============================================================
           PANEL — radial reveal from arc pivot
           ============================================================ */
        .tvm-panel-shell {
          position: fixed;
          inset: 0;
          z-index: 100;
          pointer-events: none;
        }

        .tvm-panel-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at var(--tvm-origin-x, 50%) var(--tvm-origin-y, 50%),
              rgba(243,242,235,0.045), transparent 14rem),
            radial-gradient(circle at var(--tvm-origin-x, 50%) var(--tvm-origin-y, 50%),
              rgba(3,3,3,0.62), rgba(3,3,3,0.84) 50%, rgba(3,3,3,0.94) 100%);
          clip-path: circle(0 at var(--tvm-origin-x, 50%) var(--tvm-origin-y, 50%));
          opacity: 0;
          transition:
            clip-path 1.18s var(--tvm-ease-soft),
            opacity 0.85s ease;
        }
        .tvm-panel-shell::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%,
            rgba(243,242,235,0.022), transparent 18rem);
          clip-path: circle(0 at var(--tvm-origin-x, 50%) var(--tvm-origin-y, 50%));
          opacity: 0;
          pointer-events: none;
          transition:
            clip-path 1.4s var(--tvm-ease-soft),
            opacity 1s ease;
        }
        .tvm-panel-shell[data-open="true"] { pointer-events: auto; }
        .tvm-panel-shell[data-open="true"]::before,
        .tvm-panel-shell[data-open="true"]::after {
          clip-path: circle(180vmax at var(--tvm-origin-x, 50%) var(--tvm-origin-y, 50%));
          opacity: 1;
        }

        .tvm-panel {
          position: absolute;
          top: 50%;
          left: 50%;
          width: min(660px, 88vw);
          max-height: 86vh;
          padding: clamp(2.6rem, 5vw, 3.8rem) clamp(1.6rem, 5vw, 3.4rem) clamp(2.2rem, 4vw, 3rem);
          color: var(--tvm-cream);
          opacity: 0;
          transform: translate(-50%, calc(-50% + 28px)) scale(0.985);
          pointer-events: none;
          transition:
            opacity 0.78s ease,
            transform 0.95s var(--tvm-ease-soft);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--tvm-hairline) transparent;
        }
        .tvm-panel::-webkit-scrollbar { width: 6px; }
        .tvm-panel::-webkit-scrollbar-thumb { background: var(--tvm-hairline); border-radius: 3px; }

        .tvm-panel-shell[data-open="true"] .tvm-panel--active {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
          pointer-events: auto;
          transition-delay: 0.18s, 0.18s;
        }
        .tvm-panel-close {
          position: absolute;
          top: 1.1rem;
          right: 1.4rem;
          width: 1.8rem;
          height: 1.8rem;
          padding: 0;
          background: none;
          border: 0;
          color: var(--tvm-muted);
          cursor: pointer;
          z-index: 4;
          transition: color 0.3s ease, transform 0.45s var(--tvm-ease-soft);
        }
        .tvm-panel-close::before, .tvm-panel-close::after {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          width: 0.95rem;
          height: 0.5px;
          background: currentColor;
          transform-origin: center;
        }
        .tvm-panel-close::before { transform: translate(-50%, -50%) rotate(45deg); }
        .tvm-panel-close::after  { transform: translate(-50%, -50%) rotate(-45deg); }
        .tvm-panel-close:hover { color: var(--tvm-cream); transform: scale(1.1); }

        /* section seal */
        .tvm-seal {
          position: absolute;
          top: 1.6rem;
          left: 50%;
          width: 3.6rem;
          aspect-ratio: 1;
          transform: translateX(-50%) rotate(var(--tvm-seal-angle, 0deg)) scale(0.92);
          opacity: 0;
          transition:
            opacity 0.95s ease 0.4s,
            transform 1.2s var(--tvm-ease-soft) 0.32s;
          pointer-events: none;
        }
        .tvm-panel-shell[data-open="true"] .tvm-seal {
          opacity: 1;
          transform: translateX(-50%) rotate(var(--tvm-seal-angle, 0deg)) scale(1);
        }
        .tvm-seal-ring {
          position: absolute;
          inset: 0;
          border: 0.5px solid var(--tvm-hairline);
          border-radius: 50%;
        }
        .tvm-seal-ring-inner {
          inset: 18%;
          border-style: dashed;
          border-color: var(--tvm-hairline-faint);
        }
        .tvm-seal-axis {
          position: absolute;
          top: 50%; left: -8%;
          width: 116%;
          height: 0.5px;
          background: var(--tvm-hairline);
          transform-origin: center;
          transform: translateY(-50%) rotate(var(--tvm-axis-angle, 0deg));
        }
        .tvm-seal-dot {
          position: absolute;
          top: 50%; left: 50%;
          width: 3px; height: 3px;
          background: var(--tvm-accent);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.7;
        }

        .tvm-panel--education { --tvm-seal-angle: -14deg; --tvm-axis-angle:  18deg; }
        .tvm-panel--projects  { --tvm-seal-angle:  14deg; --tvm-axis-angle: -22deg; }
        .tvm-panel--contact   { --tvm-seal-angle:  -4deg; --tvm-axis-angle:  36deg; }
        .tvm-panel--micro     { --tvm-seal-angle:   8deg; --tvm-axis-angle: -12deg; }

        .tvm-panel-space {
          min-height: clamp(8.5rem, 24vh, 12rem);
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .tvm-panel-rule {
          width: 2.6rem;
          height: 0.5px;
          background: var(--tvm-hairline-strong);
        }

        .tvm-guide-block {
          margin: 2rem auto 0;
          padding: 1.3rem 1.6rem;
          max-width: 34rem;
          border-top: 0.5px solid var(--tvm-hairline);
          border-bottom: 0.5px solid var(--tvm-hairline);
          min-height: 5.4rem;
        }

        .tvm-footnote-space {
          margin: 1.85rem auto 0;
          max-width: 28rem;
          min-height: 3.25rem;
          text-align: center;
        }
        .tvm-footnote-symbol {
          display: inline-block;
          color: var(--tvm-muted);
          font-family: var(--tvm-serif);
          font-style: italic;
          font-size: 13px;
          line-height: 1;
          opacity: 0.78;
        }

        @media (max-width: 720px) {
          .tvm-nav-marginale { font-size: 10px; bottom: 8px; right: 10px; }
          .tvm-panel { padding: 2.4rem 1.4rem 2rem; }
          .tvm-panel-space { min-height: 7.25rem; }
          .tvm-guide-block { min-height: 4.8rem; padding: 1rem 1.2rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .tvm-root *,
          .tvm-root *::before,
          .tvm-root *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div className="tvm-root">
        <div className="tvm-quiet-drift" aria-hidden="true" />

        <div
          className="tvm-stage"
          data-built={isBuilt ? "true" : "false"}
          data-panel={openSection ? "true" : "false"}
        >
          {/* background starfield — dim, sparse, behind everything in the stage.
              Parallaxes at lower depth than the constellations. */}
          <div className="tvm-starfield" aria-hidden="true">
            {bgStars.map((s, i) => (
              <span
                key={i}
                className="tvm-bgstar"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  animationDelay: `${s.delay}s`,
                }}
              />
            ))}
          </div>

          <div className="tvm-canvas-wrap">
            <svg
              ref={svgRef}
              className="tvm-svg"
              viewBox="-30 -30 610 950"
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <path id="tvm-spiral-mpath" d={SPIRAL_D} />
                {/* soft halo for the dots — one filter, reused across all four
                    constellations. Blurs the source and merges it back behind
                    the sharp dot, so each star carries its own colored haze. */}
                <filter
                  id="tvm-dot-glow"
                  x="-20%" y="-20%" width="140%" height="140%"
                >
                  <feGaussianBlur stdDeviation="1.2" result="tvm-dot-blur" />
                  <feMerge>
                    <feMergeNode in="tvm-dot-blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* square divisions */}
              <g>
                {GRID_LINES.map(({ sections, ...line }, i) => (
                  <line
                    key={i}
                    className="tvm-grid-line"
                    data-active={activeLineSection && sections.includes(activeLineSection) ? "true" : "false"}
                    pathLength="1"
                    style={{ "--tvm-line-delay": `${i * 0.11}s` }}
                    {...line}
                  />
                ))}
              </g>

              {/* phyllotaxis constellations — nested transform layers so the
                  parallax, hover-morph, slow drift, and orbit never collide.
                  See the CSS block "DOT CONSTELLATIONS" for the layer map. */}
              {squares.map((sq) => {
                const dotsBody = (
                  <g className="tvm-dots" data-square={sq.id} filter="url(#tvm-dot-glow)">
                    {sq.dots.map((d, i) => (
                      <circle
                        key={i}
                        cx={d.cx}
                        cy={d.cy}
                        r={d.r}
                        fill={d.fill}
                        style={{ animationDelay: `${d.delay}s` }}
                      />
                    ))}
                  </g>
                );
                const driftLayer = (
                  <g className="tvm-dots-drift" data-square={sq.id}>
                    {sq.id === "decor" ? (
                      <g
                        className="tvm-dots-orbit"
                        style={{ transformOrigin: `${sq.cx}px ${sq.cy}px` }}
                      >
                        {dotsBody}
                      </g>
                    ) : (
                      dotsBody
                    )}
                  </g>
                );
                return (
                  <g
                    key={sq.id}
                    className="tvm-dots-parallax"
                    data-square={sq.id}
                    data-active={isActive(sq.id) ? "true" : "false"}
                    style={{ "--tvm-depth": sq.depth }}
                  >
                    <g
                      className="tvm-dots-active"
                      style={{ transformOrigin: `${sq.cx}px ${sq.cy}px` }}
                    >
                      {driftLayer}
                    </g>
                  </g>
                );
              })}

              {/* seed at the centre */}
              <circle className="tvm-seed-halo" cx="400" cy="240" r="6" />
              <circle className="tvm-seed-mark" cx="400" cy="240" r="1.8" />

              {/* the spiral itself */}
              <path ref={spiralRef} className="tvm-spiral" d={SPIRAL_D} />
              <path className="tvm-spiral-dash" d={SPIRAL_D} />

              {/* easter egg — a quote that spirals out from the seed along
                  the path itself when the brass seed dot is clicked. Italic
                  Cormorant, ~0.5 opacity at peak, auto-fades after 11s. */}
              <text
                className="tvm-easter-text"
                data-active={easterActive ? "true" : "false"}
                aria-hidden="true"
              >
                <textPath href="#tvm-spiral-mpath" startOffset="72%">
                  You mustn’t be afraid to dream a little bigger, darling.
                </textPath>
              </text>

              {/* invisible click target around the seed — unsignposted,
                  no cursor change. Only those who find it summon the quote. */}
              <circle
                className="tvm-seed-hit"
                cx="400"
                cy="240"
                r="18"
                onClick={(e) => { e.stopPropagation(); setEasterActive(true); }}
              />

              {/* the plane — easter egg. Starts at the same instant
                  the spiral begins drawing, moves slowly, then is gone
                  for the rest of the session. Refresh to see it again. */}
              <g className="tvm-plane-wrap">
                <g className="tvm-plane">
                  <path d={PLANE_PATH} transform="scale(0.55)" />
                </g>
                <animateMotion
                  dur="30s"
                  begin="0.6s"
                  fill="freeze"
                  rotate="auto-reverse"
                  calcMode="linear"
                  keyTimes="0; 1"
                  keyPoints="1; 0"
                >
                  <mpath href="#tvm-spiral-mpath" />
                </animateMotion>
              </g>

              {/* Hero — 550×550 — Section I: PROJECTS / RESEARCH */}
              <foreignObject x="0" y="340" width="550" height="550">
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  className="tvm-nav-wrapper"
                  data-section="projects"
                  data-active={isActive("projects") ? "true" : "false"}
                  aria-label="Open section I"
                  {...sectionHandlers("projects")}
                >
                  <span className="tvm-nav-marginale">— i</span>
                </div>
              </foreignObject>

              {/* Education — 340×340 — Section II: EDUCATION */}
              <foreignObject x="0" y="0" width="340" height="340">
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  className="tvm-nav-wrapper"
                  data-section="education"
                  data-active={isActive("education") ? "true" : "false"}
                  aria-label="Open section II"
                  {...sectionHandlers("education")}
                >
                  <span className="tvm-nav-marginale">— ii</span>
                </div>
              </foreignObject>

              {/* Projects (the 210) — Section III: CONTACT */}
              <foreignObject x="340" y="0" width="210" height="210">
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  className="tvm-nav-wrapper"
                  data-section="contact"
                  data-active={isActive("contact") ? "true" : "false"}
                  aria-label="Open section III"
                  {...sectionHandlers("contact")}
                >
                  <span className="tvm-nav-marginale">— iii</span>
                </div>
              </foreignObject>

              {/* Contact (the 130) — decoration only, no section */}
              <foreignObject x="420" y="210" width="130" height="130">
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  className="tvm-hero-frame"
                />
              </foreignObject>

              {/* Micro 80×80 — the easter egg slot */}
              <foreignObject x="340" y="260" width="80" height="80">
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  className="tvm-nav-wrapper tvm-tiny"
                  data-section="micro"
                  data-active={isActive("micro") ? "true" : "false"}
                  aria-label="Open micro panel"
                  {...sectionHandlers("micro")}
                >
                  <span className="tvm-nav-marginale">∗</span>
                </div>
              </foreignObject>

              {/* Roman numerals */}
              <g className="tvm-numerals">
                {NUMERALS.map((n) => (
                  <g
                    key={n.section}
                    className="tvm-numeral-group"
                    data-section={n.section}
                    data-pos={n.pos}
                    data-active={isActive(n.section) ? "true" : "false"}
                    aria-label={`Open ${n.section}`}
                    {...sectionHandlers(n.section)}
                  >
                    <circle
                      className="tvm-numeral-hit"
                      cx={n.x}
                      cy={n.y}
                      r="22"
                    />
                    <text
                      className="tvm-numeral-text"
                      x={n.x}
                      y={n.textY}
                      textAnchor="middle"
                      data-quirk={n.quirk}
                    >
                      {n.label}
                    </text>
                  </g>
                ))}
              </g>
            </svg>
          </div>
        </div>

        {/* ============================================
             PANEL SHELL — sits above the stage
             ============================================ */}
        <div
          className="tvm-panel-shell"
          data-open={openSection ? "true" : "false"}
          aria-hidden={openSection ? "false" : "true"}
          style={{
            "--tvm-origin-x": `${origin.x}px`,
            "--tvm-origin-y": `${origin.y}px`,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closePanel();
          }}
        >
          <PanelEducation visible={openSection === "education"} onClose={closePanel} />
          <PanelProjects  visible={openSection === "projects"}  onClose={closePanel} />
          <PanelContact   visible={openSection === "contact"}   onClose={closePanel} />
          <PanelMicro     visible={openSection === "micro"}     onClose={closePanel} />
        </div>
      </div>
    </>
  );
}

// ============================================================
// PANELS — empty until real content is ready
// ============================================================

function Seal() {
  return (
    <div className="tvm-seal" aria-hidden="true">
      <span className="tvm-seal-ring" />
      <span className="tvm-seal-ring tvm-seal-ring-inner" />
      <span className="tvm-seal-axis" />
      <span className="tvm-seal-dot" />
    </div>
  );
}

function CloseBtn({ onClose }) {
  return (
    <button
      className="tvm-panel-close"
      type="button"
      aria-label="Close"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    />
  );
}

function PanelEducation({ visible, onClose }) {
  return (
    <section
      className={`tvm-panel tvm-panel--education${visible ? " tvm-panel--active" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Education"
      aria-hidden={!visible}
      onClick={(e) => e.stopPropagation()}
    >
      <CloseBtn onClose={onClose} />
      <Seal />
      <div className="tvm-panel-space" aria-hidden="true">
        <div className="tvm-panel-rule" />
      </div>
      <div className="tvm-guide-block" aria-hidden="true" />
      <div className="tvm-footnote-space" aria-hidden="true">
        <span className="tvm-footnote-symbol">¹</span>
      </div>
    </section>
  );
}

function PanelProjects({ visible, onClose }) {
  return (
    <section
      className={`tvm-panel tvm-panel--projects${visible ? " tvm-panel--active" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Projects"
      aria-hidden={!visible}
      onClick={(e) => e.stopPropagation()}
    >
      <CloseBtn onClose={onClose} />
      <Seal />
      <div className="tvm-panel-space" aria-hidden="true">
        <div className="tvm-panel-rule" />
      </div>
      <div className="tvm-guide-block" aria-hidden="true" />
      <div className="tvm-footnote-space" aria-hidden="true">
        <span className="tvm-footnote-symbol">†</span>
      </div>
    </section>
  );
}

function PanelContact({ visible, onClose }) {
  return (
    <section
      className={`tvm-panel tvm-panel--contact${visible ? " tvm-panel--active" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Contact"
      aria-hidden={!visible}
      onClick={(e) => e.stopPropagation()}
    >
      <CloseBtn onClose={onClose} />
      <Seal />
      <div className="tvm-panel-space" aria-hidden="true">
        <div className="tvm-panel-rule" />
      </div>
      <div className="tvm-guide-block" aria-hidden="true" />
      <div className="tvm-footnote-space" aria-hidden="true">
        <span className="tvm-footnote-symbol">‡</span>
      </div>
    </section>
  );
}

function PanelMicro({ visible, onClose }) {
  return (
    <section
      className={`tvm-panel tvm-panel--micro${visible ? " tvm-panel--active" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Micro panel"
      aria-hidden={!visible}
      onClick={(e) => e.stopPropagation()}
    >
      <CloseBtn onClose={onClose} />
      <Seal />
      <div className="tvm-panel-space" aria-hidden="true">
        <div className="tvm-panel-rule" />
      </div>
      <div className="tvm-guide-block" aria-hidden="true" />
      <div className="tvm-footnote-space" aria-hidden="true">
        <span className="tvm-footnote-symbol">§</span>
      </div>
    </section>
  );
}
