import { useRef, useState, useEffect } from "react";

const CENTER = { x: 800, y: 450 };

const CONTENT_EXIT_MS = 900;

// Roman numerals sit OUTSIDE the triangle and act as nav anchors.
// (x, y) is the visual center of each glyph and is used as the orbit anchor;
// textY is the SVG <text> baseline used for rendering.
const NAV_ANCHORS = [
  {
    id: "education",
    label: "I",
    title: "Education",
    x: 560,
    y: 250,
    textY: 258,
    position: "tl",
    originX: "35vw",
    originY: "31vh",
    entryX: "-32px",
    entryY: "-24px",
  },
  {
    id: "projects",
    label: "II",
    title: "Projects",
    x: 1040,
    y: 250,
    textY: 258,
    position: "tr",
    originX: "65vw",
    originY: "31vh",
    entryX: "32px",
    entryY: "-24px",
  },
  {
    id: "contact",
    label: "III",
    title: "Contact",
    x: 800,
    y: 724,
    textY: 732,
    position: "b",
    originX: "50vw",
    originY: "78vh",
    entryX: "0px",
    entryY: "34px",
  },
];

const COMPACT_NAV_ANCHORS = [
  {
    id: "education",
    label: "I",
    title: "Education",
    x: 640,
    y: 250,
    textY: 258,
    position: "tl",
    originX: "22vw",
    originY: "31vh",
    entryX: "-24px",
    entryY: "-22px",
  },
  {
    id: "projects",
    label: "II",
    title: "Projects",
    x: 960,
    y: 250,
    textY: 258,
    position: "tr",
    originX: "78vw",
    originY: "31vh",
    entryX: "24px",
    entryY: "-22px",
  },
  {
    id: "contact",
    label: "III",
    title: "Contact",
    x: 800,
    y: 724,
    textY: 732,
    position: "b",
    originX: "50vw",
    originY: "78vh",
    entryX: "0px",
    entryY: "34px",
  },
];

const TRIANGLE_VERTICES = [
  { x: 560,  y: 280 },
  { x: 1040, y: 280 },
  { x: 800,  y: 696 },
];

const COMPACT_TRIANGLE_VERTICES = [
  { x: 640, y: 280 },
  { x: 960, y: 280 },
  { x: 800, y: 696 },
];

const PROXIMITY_BAND = 110;
const RIPPLE_LIFETIME = 2400;

const SECTION_CONTENT = {
  education: {
    eyebrow: "I",
    title: "Education",
    intro:
      "A focused record of the skills, study paths, and technical ideas being turned into real projects.",
    rows: [
      ["Current focus", "Frontend structure, React components, responsive CSS, Git, and deployment."],
      ["Practice style", "Build a visible piece, test it locally, then refine the interaction and layout."],
      ["Evidence", "School details, courses, certificates, and notes can be added here as the record grows."],
    ],
  },
  projects: {
    eyebrow: "II",
    title: "Projects",
    intro:
      "A quiet project index for finished builds, experiments, and case studies as the portfolio grows.",
    rows: [
      ["Portfolio shell", "SVG geometry, hover targeting, ripple feedback, and modal-style sections."],
      ["Experiments", "A place for smaller UI sketches, learning projects, and deployed prototypes."],
      ["Case studies", "Each finished build can carry a live link, repository link, screenshot, and short reflection."],
    ],
  },
  contact: {
    eyebrow: "III",
    title: "Contact",
    intro:
      "A simple contact surface ready for real links once the public contact details are confirmed.",
    rows: [
      ["Use for", "Collaboration, feedback, internships, project conversations, or introductions."],
      ["Public links", "Email, LinkedIn, GitHub, or a form can live here once you choose what to share."],
      ["Implementation", "This is front-end only, so it does not send messages until a backend is connected."],
    ],
  },
};

const baseRadiusFor = (anchor) =>
  Math.hypot(anchor.x - CENTER.x, anchor.y - CENTER.y);

export default function App() {
  const [active, setActive] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [isContentOpen, setIsContentOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [ripples, setRipples] = useState([]);
  const svgRef = useRef(null);
  const closeTimerRef = useRef(null);
  const rippleIdRef = useRef(0);

  const anchors = isCompact ? COMPACT_NAV_ANCHORS : NAV_ANCHORS;
  const triangleVertices = isCompact ? COMPACT_TRIANGLE_VERTICES : TRIANGLE_VERTICES;
  const activeAnchor = anchors.find((anchor) => anchor.id === activeSection);
  const activeContent = activeSection ? SECTION_CONTENT[activeSection] : null;
  const geometryActive = isContentOpen ? activeSection : active;

  const closeContent = () => {
    setIsContentOpen(false);
    setActive(null);

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setActiveSection(null);
    }, CONTENT_EXIT_MS);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const compactQuery = window.matchMedia("(max-width: 700px)");
    const updateCompactMode = () => setIsCompact(compactQuery.matches);

    updateCompactMode();
    compactQuery.addEventListener("change", updateCompactMode);

    return () => compactQuery.removeEventListener("change", updateCompactMode);
  }, []);

  useEffect(() => {
    if (!isContentOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeContent();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isContentOpen]);

  const triggerRipple = (anchor) => {
    rippleIdRef.current += 1;
    const id = rippleIdRef.current;
    setRipples((rs) => [...rs, { id, x: anchor.x, y: anchor.y }]);
    window.setTimeout(() => {
      setRipples((rs) => rs.filter((r) => r.id !== id));
    }, RIPPLE_LIFETIME);
  };

  const openContent = (anchor) => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    setActive(anchor.id);
    setActiveSection(anchor.id);
    setIsContentOpen(true);
    triggerRipple(anchor);
  };

  const handlePointerMove = (event) => {
    if (isContentOpen) return;

    const svg = svgRef.current;
    if (!svg || typeof svg.getScreenCTM !== "function") return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const local = pt.matrixTransform(ctm.inverse());

    let best = null;
    let bestDist = Infinity;
    for (const anchor of anchors) {
      const d = Math.hypot(local.x - anchor.x, local.y - anchor.y);
      if (d < PROXIMITY_BAND && d < bestDist) {
        best = anchor.id;
        bestDist = d;
      }
    }
    setActive(best);
  };

  const handlePointerLeave = () => {
    if (!isContentOpen) {
      setActive(null);
    }
  };

  const orbitOpacity = (id) => {
    if (geometryActive === null) return 0.14;
    if (geometryActive === id) return 0.42;
    return 0.045;
  };

  const apexOpacity = (id) => {
    if (geometryActive === null) return 0.55;
    if (geometryActive === id) return 0.95;
    return 0.22;
  };

  const idleOpacity = (id) => {
    if (geometryActive === null) return 0.06;
    if (geometryActive === id) return 0.16;
    return 0.02;
  };

  const orbitScale = (id) => {
    if (geometryActive === null) return 1;
    if (geometryActive === id) return 1.018;
    return 0.984;
  };

  return (
    <>
      <style>{`
        .tvm-serif {
          font-family: 'Cormorant Garamond', 'EB Garamond', Georgia, serif;
        }

        .tvm-hero {
          position: relative;
          width: 100%;
          height: 100vh;
          background: #000;
          overflow: hidden;
          color: #f3f2eb;
        }

        /* Soft vertical center line + repeating vertical guides, drifting */
        .tvm-hero::before {
          content: "";
          position: absolute;
          inset: -1px;
          z-index: 1;
          pointer-events: none;
          background:
            linear-gradient(90deg, transparent 49.75%, rgba(243,242,235,0.022) 49.9% 50.1%, transparent 50.25%),
            repeating-linear-gradient(90deg, transparent 0 9rem, rgba(243,242,235,0.009) 9rem calc(9rem + 1px), transparent calc(9rem + 1px) 18rem);
          opacity: 0.24;
          transform: translateX(-3%);
          animation: tvm-quiet-drift 32s linear infinite alternate;
        }

        .tvm-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          cursor: default;
          z-index: 2;
          transition:
            opacity 1s ease,
            filter 1s ease;
        }

        .tvm-hero[data-active="true"] .tvm-svg {
          cursor: pointer;
        }

        .tvm-hero[data-panel-open="true"] .tvm-svg {
          opacity: 0.42;
          filter: blur(0.45px);
        }

        /* ----- Animation primitives ----- */

        @keyframes tvm-quiet-drift {
          to { transform: translateX(3%); opacity: 0.32; }
        }
        @keyframes tvm-breathe-a {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 0.8; }
        }
        @keyframes tvm-breathe-b {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 0.8; }
        }
        @keyframes tvm-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes tvm-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes tvm-dash-drift {
          to { stroke-dashoffset: -32; }
        }
        @keyframes tvm-ripple-grow {
          0%   { r: 0;   stroke-opacity: 0.55; }
          80%  { stroke-opacity: 0.06; }
          100% { r: 360; stroke-opacity: 0; }
        }

        /* ----- Static decorative groups ----- */

        .tvm-fan     { animation: tvm-breathe-a 8s ease-in-out infinite; }
        .tvm-feather { animation: tvm-breathe-b 9s ease-in-out -2s infinite; }

        .tvm-arc-solid {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: tvm-draw 2s ease-out 0.3s forwards;
        }
        .tvm-arc-dashed {
          opacity: 0;
          animation: tvm-fade-in 1.4s ease-out 1.4s forwards;
        }
        .tvm-plane {
          opacity: 0;
          animation: tvm-fade-in 0.3s ease-out 0.3s forwards;
        }
        .tvm-triangle {
          opacity: 0;
          animation: tvm-fade-in 1.5s ease-out 1.9s forwards;
        }
        .tvm-numerals {
          opacity: 0;
          animation: tvm-fade-in 1.5s ease-out 2.1s forwards;
        }
        .tvm-wordmark {
          opacity: 0;
          animation: tvm-fade-in 1.5s ease-out 2.5s forwards;
        }
        .tvm-vertex-orbits {
          opacity: 0;
          animation: tvm-fade-in 1.8s ease-out 2.3s forwards;
        }
        .tvm-apex-lights {
          opacity: 0;
          animation: tvm-fade-in 1.2s ease-out 2.5s forwards;
        }
        .tvm-idle-traces {
          opacity: 0;
          animation: tvm-fade-in 1.5s ease-out 2.6s forwards;
        }
        .tvm-center-cross {
          opacity: 0;
          animation: tvm-fade-in 1.2s ease-out 2.7s forwards;
        }

        /* ----- Interactive vertex orbits ----- */

        .tvm-orbit-group {
          transition:
            opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1),
            transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
          transform-box: fill-box;
        }

        .tvm-orbit-dashed {
          animation: tvm-dash-drift 6s linear infinite;
        }

        .tvm-idle-trace {
          transition: opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tvm-apex {
          transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* ----- Ripple ----- */

        .tvm-ripple {
          animation: tvm-ripple-grow 2.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* ----- Numerals (italic, hover-aware) ----- */

        .tvm-numeral-hit {
          fill: transparent;
          cursor: pointer;
          pointer-events: all;
        }

        .tvm-numeral {
          fill: #6b6b66;
          font-style: italic;
          font-weight: 400;
          font-size: 28px;
          pointer-events: none;
          transition: fill 0.45s ease;
        }

        .tvm-numeral-group[data-active="true"] .tvm-numeral {
          fill: #f3f2eb;
        }

        /* ----- Content panels ----- */

        .tvm-content-shell {
          position: absolute;
          inset: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          padding:
            max(1.25rem, env(safe-area-inset-top))
            max(1.25rem, env(safe-area-inset-right))
            max(1.25rem, env(safe-area-inset-bottom))
            max(1.25rem, env(safe-area-inset-left));
          pointer-events: none;
        }

        .tvm-content-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at var(--panel-origin-x, 50vw) var(--panel-origin-y, 50vh), rgba(243,242,235,0.055), transparent 12rem),
            radial-gradient(circle at var(--panel-origin-x, 50vw) var(--panel-origin-y, 50vh), rgba(0,0,0,0.48), rgba(0,0,0,0.78) 52%, rgba(0,0,0,0.92) 100%);
          clip-path: circle(0 at var(--panel-origin-x, 50vw) var(--panel-origin-y, 50vh));
          opacity: 0;
          transition:
            clip-path 1.1s cubic-bezier(0.16, 1, 0.3, 1),
            opacity 0.75s ease;
        }

        .tvm-content-shell[data-open="true"] {
          pointer-events: auto;
        }

        .tvm-content-shell[data-open="true"]::before {
          clip-path: circle(155vmax at var(--panel-origin-x, 50vw) var(--panel-origin-y, 50vh));
          opacity: 1;
        }

        .tvm-content-panel {
          position: relative;
          width: min(660px, 88vw);
          min-height: clamp(340px, 48vh, 460px);
          padding: clamp(3.4rem, 7vw, 4.8rem) clamp(1.35rem, 6vw, 3.5rem) clamp(2.4rem, 5vw, 3.2rem);
          color: #f3f2eb;
          text-align: center;
          opacity: 0;
          transform: translate(var(--entry-x, 0), var(--entry-y, 32px)) scale(0.965);
          transition:
            opacity 0.8s ease,
            transform 1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tvm-content-shell[data-open="true"] .tvm-content-panel {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }

        .tvm-content-panel::before,
        .tvm-content-panel::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: clamp(13rem, 36vmin, 27rem);
          aspect-ratio: 1;
          border: 1px solid rgba(243,242,235,0.08);
          border-radius: 50%;
          pointer-events: none;
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.78);
          transition:
            opacity 0.9s ease 0.08s,
            transform 1.25s cubic-bezier(0.16, 1, 0.3, 1) 0.08s;
        }

        .tvm-content-panel::after {
          width: clamp(8.5rem, 23vmin, 18rem);
          border-color: rgba(243,242,235,0.052);
          border-style: dashed;
          transform: translate(-50%, -50%) rotate(34deg) scale(0.82);
        }

        .tvm-content-shell[data-open="true"] .tvm-content-panel::before,
        .tvm-content-shell[data-open="true"] .tvm-content-panel::after {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }

        .tvm-content-shell[data-open="true"] .tvm-content-panel::after {
          opacity: 0.72;
          transform: translate(-50%, -50%) rotate(34deg) scale(1);
        }

        .tvm-panel-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.15rem;
        }

        .tvm-section-mark {
          margin: 0;
          color: #6b6b66;
          font-size: clamp(1.15rem, 3vw, 1.65rem);
          font-style: italic;
          line-height: 1;
        }

        .tvm-panel-title {
          margin: 0;
          font-size: clamp(2.2rem, 7vw, 4.35rem);
          font-weight: 300;
          letter-spacing: 0.08em;
          line-height: 1;
          text-transform: uppercase;
        }

        .tvm-panel-intro {
          width: min(34rem, 100%);
          margin: 0;
          color: rgba(243,242,235,0.78);
          font-size: clamp(1.02rem, 2.4vw, 1.2rem);
          font-weight: 300;
          line-height: 1.55;
        }

        .tvm-detail-list {
          display: grid;
          width: min(35rem, 100%);
          margin: 0.6rem 0 0;
          padding: 0;
          text-align: left;
          border-top: 1px solid rgba(243,242,235,0.12);
        }

        .tvm-detail-row {
          display: grid;
          grid-template-columns: minmax(7.5rem, 0.65fr) minmax(0, 1.35fr);
          gap: clamp(0.75rem, 3vw, 1.5rem);
          padding: 0.9rem 0;
          border-bottom: 1px solid rgba(243,242,235,0.095);
        }

        .tvm-detail-row dt {
          color: #f3f2eb;
          font-size: 0.78rem;
          letter-spacing: 0.16em;
          line-height: 1.45;
          text-transform: uppercase;
        }

        .tvm-detail-row dd {
          margin: 0;
          color: rgba(243,242,235,0.66);
          font-size: clamp(0.95rem, 2vw, 1.05rem);
          font-weight: 300;
          line-height: 1.45;
        }

        .tvm-close {
          position: absolute;
          top: clamp(1.15rem, 3vw, 2rem);
          left: 50%;
          z-index: 3;
          width: 2rem;
          height: 2rem;
          margin: 0;
          padding: 0;
          color: #6b6b66;
          cursor: pointer;
          background: transparent;
          border: 0;
          transform: translateX(-50%);
          transition:
            color 0.3s ease,
            transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tvm-close::before,
        .tvm-close::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0.95rem;
          height: 1px;
          background: currentColor;
          transform-origin: center;
        }

        .tvm-close::before {
          transform: translate(-50%, -50%) rotate(45deg);
        }

        .tvm-close::after {
          transform: translate(-50%, -50%) rotate(-45deg);
        }

        .tvm-close:hover {
          color: #f3f2eb;
          transform: translateX(-50%) scale(1.08);
        }

        .tvm-close:focus-visible,
        .tvm-numeral-group:focus-visible .tvm-numeral-hit {
          outline: 1px solid rgba(243,242,235,0.32);
          outline-offset: 6px;
        }

        @media (max-width: 700px) {
          .tvm-content-panel {
            width: min(90vw, 430px);
            min-height: min(58dvh, 440px);
          }

          .tvm-panel-title {
            letter-spacing: 0.045em;
          }

          .tvm-detail-row {
            grid-template-columns: 1fr;
            gap: 0.35rem;
            text-align: center;
          }

          .tvm-detail-row dt {
            font-size: 0.72rem;
          }
        }

        /* ----- Reduced motion ----- */

        @media (prefers-reduced-motion: reduce) {
          .tvm-hero::before,
          .tvm-fan,
          .tvm-feather,
          .tvm-orbit-dashed {
            animation: none;
          }
          .tvm-arc-solid,
          .tvm-arc-dashed,
          .tvm-plane,
          .tvm-triangle,
          .tvm-numerals,
          .tvm-wordmark,
          .tvm-vertex-orbits,
          .tvm-apex-lights,
          .tvm-idle-traces,
          .tvm-center-cross {
            opacity: 1;
            animation: none;
          }
          .tvm-svg,
          .tvm-content-shell::before,
          .tvm-content-panel,
          .tvm-content-panel::before,
          .tvm-content-panel::after,
          .tvm-close {
            transition-duration: 0.01ms;
          }
        }
      `}</style>

      <div
        className="tvm-hero"
        data-active={geometryActive !== null}
        data-panel-open={isContentOpen}
        style={{
          "--panel-origin-x": activeAnchor?.originX ?? "50vw",
          "--panel-origin-y": activeAnchor?.originY ?? "50vh",
          "--entry-x": activeAnchor?.entryX ?? "0px",
          "--entry-y": activeAnchor?.entryY ?? "32px",
        }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 1600 900"
          className="tvm-svg"
          preserveAspectRatio="xMidYMid slice"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 1. Background dashed/dotted orbital arcs */}
          <g id="orbits" stroke="white" fill="none" strokeWidth="0.8">
            <path d="M -40,430 A 520,330 -16 0 1 420,70"    strokeDasharray="2 5" strokeOpacity="0.45" />
            <path d="M 80,260 A 280,170 -6 0 1 360,180"     strokeDasharray="1 4" strokeOpacity="0.4"  />
            <path d="M -60,730 A 740,260 4 0 1 640,820"     strokeDasharray="2 6" strokeOpacity="0.4"  />
            <path d="M 1490,200 A 580,540 -10 0 1 1660,820" strokeDasharray="1 5" strokeOpacity="0.45" />
            <path d="M 340,810 C 700,760 960,830 1260,790"  strokeDasharray="1 4" strokeOpacity="0.35" />
            <path d="M 120,850 C 500,880 880,840 1230,870"  strokeDasharray="1 5" strokeOpacity="0.3"  />
            <path d="M 1080,840 C 1260,865 1430,835 1590,860" strokeDasharray="1 4" strokeOpacity="0.35" />
          </g>

          {/* 2. Right fan & left feather */}
          <g id="rightFan" className="tvm-fan" stroke="white" fill="none" strokeWidth="0.7" strokeOpacity="0.6">
            {Array.from({ length: 10 }).map((_, i) => (
              <path
                key={`fan-${i}`}
                d={`M 1562,${438 - i * 1.6} C 1400,${380 - i * 4.5} ${1130 - i * 6},${520 + i * 5.5} ${760 - i * 22},${640 + i * 9}`}
              />
            ))}
          </g>

          <g id="leftFeather" className="tvm-feather" stroke="white" fill="none" strokeWidth="0.7" strokeOpacity="0.65">
            {Array.from({ length: 8 }).map((_, i) => {
              const t = i - 3.5;
              return (
                <path
                  key={`feather-${i}`}
                  d={`M 80,${618 + t * 1.6} Q 260,${578 + t * 4.5} 450,${608 + t * 2}`}
                />
              );
            })}
          </g>

          {/* 3. Trajectory + airplane */}
          <g id="trajectory">
            <path
              id="tvm-plane-path"
              d="M 790,275 Q 1260,140 1540,75"
              fill="none"
              stroke="white"
              strokeWidth="1.2"
              strokeOpacity="0.85"
              pathLength="1"
              className="tvm-arc-solid"
            />
            <path
              d="M 820,320 Q 1265,185 1525,115"
              fill="none"
              stroke="white"
              strokeWidth="0.9"
              strokeOpacity="0.55"
              strokeDasharray="3 5"
              className="tvm-arc-dashed"
            />
            <g className="tvm-plane">
              <path
                d="M 10,0 L -2,-1 L -4,-6 L -6,-6 L -4,-1 L -8,-1 L -8,1 L -4,1 L -6,6 L -4,6 L -2,1 Z"
                fill="white"
              />
              <animateMotion dur="2s" begin="0.3s" fill="freeze" rotate="auto">
                <mpath href="#tvm-plane-path" />
              </animateMotion>
            </g>
          </g>

          {/* 4. Vertex orbits - proximity-driven concentric circles */}
          <g id="vertexOrbits" className="tvm-vertex-orbits">
            {anchors.map((anchor) => {
              const r = baseRadiusFor(anchor);
              const op = orbitOpacity(anchor.id);
              const scale = orbitScale(anchor.id);
              return (
                <g
                  key={`orbit-${anchor.id}`}
                  className="tvm-orbit-group"
                  style={{
                    opacity: op,
                    transform: `translate(${anchor.x}px, ${anchor.y}px) scale(${scale}) translate(${-anchor.x}px, ${-anchor.y}px)`,
                  }}
                >
                  <circle
                    cx={anchor.x}
                    cy={anchor.y}
                    r={r}
                    fill="none"
                    stroke="white"
                    strokeWidth="1.1"
                  />
                  <circle
                    className="tvm-orbit-dashed"
                    cx={anchor.x}
                    cy={anchor.y}
                    r={r - 24}
                    fill="none"
                    stroke="white"
                    strokeWidth="1"
                    strokeOpacity="0.68"
                    strokeDasharray="2 6"
                  />
                </g>
              );
            })}
          </g>

          {/* 5. Idle traces - slow rotating arcs around each anchor */}
          <g id="idleTraces" className="tvm-idle-traces">
            {anchors.map((anchor, i) => {
              const r = baseRadiusFor(anchor);
              const dur = 22 + i * 4;
              return (
                <g
                  key={`trace-${anchor.id}`}
                  className="tvm-idle-trace"
                  style={{ opacity: idleOpacity(anchor.id) }}
                >
                  <circle
                    cx={anchor.x}
                    cy={anchor.y}
                    r={r * 1.012}
                    fill="none"
                    stroke="white"
                    strokeWidth="0.8"
                    strokeDasharray={`${r * 0.48} ${r * 6}`}
                  >
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from={`${i * 90} ${anchor.x} ${anchor.y}`}
                      to={`${i * 90 + 360} ${anchor.x} ${anchor.y}`}
                      dur={`${dur}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              );
            })}
          </g>

          {/* 6. Center crosshair + faint spokes to vertices */}
          <g id="centerCross" className="tvm-center-cross">
            <g stroke="white" fill="none" strokeOpacity="0.045" strokeWidth="0.8">
              {anchors.map((anchor) => (
                <line
                  key={`spoke-${anchor.id}`}
                  x1={CENTER.x}
                  y1={CENTER.y}
                  x2={anchor.x}
                  y2={anchor.y}
                />
              ))}
            </g>
            <line x1={CENTER.x - 5.5} y1={CENTER.y} x2={CENTER.x + 5.5} y2={CENTER.y} stroke="#6b6b66" strokeWidth="0.9" />
            <line x1={CENTER.x} y1={CENTER.y - 5.5} x2={CENTER.x} y2={CENTER.y + 5.5} stroke="#6b6b66" strokeWidth="0.9" />
            <circle cx={CENTER.x} cy={CENTER.y} r="1.4" fill="#6b6b66" />
          </g>

          {/* 7. Click ripples */}
          <g id="ripples">
            {ripples.map((r) => (
              <circle
                key={r.id}
                cx={r.x}
                cy={r.y}
                r="0"
                fill="none"
                stroke="white"
                strokeWidth="1.1"
                className="tvm-ripple"
              />
            ))}
          </g>

          {/* 8. Inverted equilateral triangle */}
          <g id="triangle" className="tvm-triangle">
            <polygon
              points={triangleVertices.map((v) => `${v.x},${v.y}`).join(" ")}
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeOpacity="0.85"
              strokeLinejoin="miter"
            />
          </g>

          {/* 9. Apex lights at each triangle vertex */}
          <g id="apexLights" className="tvm-apex-lights">
            {triangleVertices.map((v, i) => {
              const anchorId = anchors[i].id;
              return (
                <g
                  key={`apex-${i}`}
                  className="tvm-apex"
                  style={{ opacity: apexOpacity(anchorId) }}
                >
                  <circle cx={v.x} cy={v.y} r="3.4" fill="rgba(243,242,235,0.16)" />
                  <circle cx={v.x} cy={v.y} r="1.5" fill="rgba(243,242,235,0.78)" />
                </g>
              );
            })}
          </g>

          {/* 10. Corner registration marks */}
          <g id="registrationMarks" stroke="white" fill="none" strokeWidth="1" strokeOpacity="0.7">
            <g transform="translate(115, 790)">
              <line x1="-14" y1="0" x2="14" y2="0" />
              <line x1="0" y1="-14" x2="0" y2="14" />
              <circle cx="0" cy="0" r="4" />
            </g>
            <g transform="translate(1490, 785)">
              <line x1="-14" y1="0" x2="14" y2="0" />
              <line x1="0" y1="-14" x2="0" y2="14" />
              <circle cx="0" cy="0" r="4" />
            </g>
          </g>

          {/* 11. Roman numerals - interactive nav */}
          <g id="romanNumerals" className="tvm-numerals tvm-serif">
            {anchors.map((anchor) => {
              const isActive = geometryActive === anchor.id;
              return (
                <g
                  key={anchor.id}
                  className={`tvm-numeral-group tvm-pos-${anchor.position}`}
                  data-active={isActive}
                  role="button"
                  tabIndex={isContentOpen ? -1 : 0}
                  aria-label={`Open ${anchor.title}`}
                  aria-pressed={isContentOpen && activeSection === anchor.id}
                  onMouseEnter={() => {
                    if (!isContentOpen) setActive(anchor.id);
                  }}
                  onMouseLeave={() => {
                    if (!isContentOpen) setActive(null);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    openContent(anchor);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    openContent(anchor);
                  }}
                >
                  <title>{anchor.title}</title>
                  {/* Invisible hit target - generous click/hover area */}
                  <circle
                    className="tvm-numeral-hit"
                    cx={anchor.x}
                    cy={anchor.y}
                    r="34"
                  />
                  <text
                    className="tvm-numeral tvm-serif"
                    x={anchor.x}
                    y={anchor.textY}
                    textAnchor="middle"
                  >
                    {anchor.label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* 12. Wordmark inside the triangle */}
          <g id="wordmark" className="tvm-wordmark tvm-serif">
            <text
              x="800"
              y="478"
              textAnchor="middle"
              fill="#ece8de"
              fontSize="15"
              fontWeight="400"
              style={{ letterSpacing: "0.32em" }}
            >
              TRESOR VAN MULDERS
            </text>
            <line
              x1="700"
              y1="495"
              x2="900"
              y2="495"
              stroke="#6b6b66"
              strokeOpacity="0.35"
              strokeWidth="0.5"
            />
          </g>
        </svg>

        <div
          className="tvm-content-shell"
          data-open={isContentOpen}
          aria-hidden={!isContentOpen}
          onClick={closeContent}
        >
          {activeContent && (
            <section
              className="tvm-content-panel tvm-serif"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tvm-panel-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="tvm-close"
                type="button"
                aria-label="Close section"
                onClick={closeContent}
              />

              <div className="tvm-panel-content">
                <p className="tvm-section-mark">{activeContent.eyebrow}</p>
                <h2 className="tvm-panel-title" id="tvm-panel-title">
                  {activeContent.title}
                </h2>
                <p className="tvm-panel-intro">{activeContent.intro}</p>
                <dl className="tvm-detail-list">
                  {activeContent.rows.map(([term, description]) => (
                    <div className="tvm-detail-row" key={term}>
                      <dt>{term}</dt>
                      <dd>{description}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
