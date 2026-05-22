import { useRef, useState, useEffect } from "react";

const CENTER = { x: 800, y: 450 };

const CONTENT_EXIT_MS = 900;

// Roman numerals sit OUTSIDE the triangle and act as nav anchors.
// (x, y) is the visual center of each glyph — used as the orbit anchor;
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
    ...NAV_ANCHORS[0],
    x: 640,
    y: 256,
    textY: 264,
    originX: "24vw",
    originY: "24vh",
  },
  {
    ...NAV_ANCHORS[1],
    x: 958,
    y: 256,
    textY: 264,
    originX: "76vw",
    originY: "24vh",
  },
  {
    ...NAV_ANCHORS[2],
    x: 800,
    y: 744,
    textY: 752,
    originY: "76vh",
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
  { x: 800, y: 680 },
];

const PROXIMITY_BAND = 110;
const RIPPLE_LIFETIME = 2400;

// Future copy guidance:
// Education: current focus, practice style, and evidence such as school details,
// courses, certificates, and notes.
// Projects: portfolio shell, experiments, case studies, live links, repository
// links, screenshots, and short reflections.
// Contact: collaboration use cases, public links, and whether a backend-backed
// form should be added later.
// The live panes currently render only the Roman numerals.
const SECTION_CONTENT = {
  education: {
    eyebrow: "I",
    title: "Education",
  },
  projects: {
    eyebrow: "II",
    title: "Projects",
  },
  contact: {
    eyebrow: "III",
    title: "Contact",
  },
};

const baseRadiusFor = (anchor) =>
  Math.hypot(anchor.x - CENTER.x, anchor.y - CENTER.y);

export default function Hero() {
  const [active, setActive] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [isContentOpen, setIsContentOpen] = useState(false);
  const [ripples, setRipples] = useState([]);
  const [isCompact, setIsCompact] = useState(false);
  const [tapOrigin, setTapOrigin] = useState(null);
  const svgRef = useRef(null);
  const closeTimerRef = useRef(null);
  const openFrameRef = useRef(null);
  const rippleIdRef = useRef(0);
  const suppressBackdropUntilRef = useRef(0);

  const activeAnchor = NAV_ANCHORS.find((anchor) => anchor.id === activeSection);
  const activeContent = activeSection ? SECTION_CONTENT[activeSection] : null;
  const geometryActive = isContentOpen ? activeSection : active;
  const layoutAnchors = isCompact ? COMPACT_NAV_ANCHORS : NAV_ANCHORS;
  const triangleVertices = isCompact ? COMPACT_TRIANGLE_VERTICES : TRIANGLE_VERTICES;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(max-width: 820px), (orientation: portrait) and (max-width: 960px), (pointer: coarse) and (orientation: portrait)");
    const update = () => {
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const isTouchPortrait =
        (navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches) &&
        height > width;

      setIsCompact(mq.matches || isTouchPortrait);
    };

    update();
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
    } else {
      mq.addListener(update);
    }

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", update);
      } else {
        mq.removeListener(update);
      }
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  const closeContent = () => {
    if (openFrameRef.current) {
      window.cancelAnimationFrame(openFrameRef.current);
      openFrameRef.current = null;
    }

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
      if (openFrameRef.current) {
        window.cancelAnimationFrame(openFrameRef.current);
      }
    };
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

  const openContent = (anchor, event) => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    if (openFrameRef.current) {
      window.cancelAnimationFrame(openFrameRef.current);
    }
    if (isCompact) {
      suppressBackdropUntilRef.current = window.performance.now() + 650;
    }

    if (!isCompact && event && typeof event.clientX === "number" && typeof event.clientY === "number") {
      setTapOrigin({ x: event.clientX, y: event.clientY });
    } else {
      setTapOrigin(null);
    }

    const wasOpen = isContentOpen;

    setActive(anchor.id);
    setActiveSection(anchor.id);
    if (!isCompact) {
      triggerRipple(anchor);
    }

    if (wasOpen) {
      setIsContentOpen(false);
      openFrameRef.current = window.requestAnimationFrame(() => {
        openFrameRef.current = window.requestAnimationFrame(() => {
          setIsContentOpen(true);
          openFrameRef.current = null;
        });
      });
    } else {
      setIsContentOpen(true);
    }
  };

  const handleBackdropClick = () => {
    if (isCompact && window.performance.now() < suppressBackdropUntilRef.current) {
      return;
    }

    closeContent();
  };

  const handlePointerMove = (event) => {
    if (isContentOpen) return;
    if (event.pointerType && event.pointerType !== "mouse") return;

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
    for (const anchor of layoutAnchors) {
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
    if (geometryActive === null) return 0.2;
    if (geometryActive === id) return 0.52;
    return 0.07;
  };

  const apexOpacity = (id) => {
    if (geometryActive === null) return 0.55;
    if (geometryActive === id) return 0.95;
    return 0.22;
  };

  const idleOpacity = (id) => {
    if (geometryActive === null) return 0.09;
    if (geometryActive === id) return 0.22;
    return 0.035;
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
          height: 100dvh;
          background: #000;
          overflow: hidden;
          color: #f3f2eb;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
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
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 0.8; }
        }
        @keyframes tvm-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes tvm-fade-in-soft {
          from { opacity: 0; }
          to   { opacity: 0.55; }
        }
        @keyframes tvm-dash-drift {
          to { stroke-dashoffset: -32; }
        }
        @keyframes tvm-ripple-grow {
          0%   { r: 0;   stroke-opacity: 0.55; }
          80%  { stroke-opacity: 0.06; }
          100% { r: 360; stroke-opacity: 0; }
        }

        /* ----- Loading sequence: geometry first, atmosphere after ----- */

        .tvm-triangle {
          opacity: 0;
          animation: tvm-fade-in 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.35s forwards;
        }
        .tvm-vertex-orbits {
          opacity: 0;
          animation: tvm-fade-in 1.3s cubic-bezier(0.22, 1, 0.36, 1) 0.55s forwards;
        }
        .tvm-idle-traces {
          opacity: 0;
          animation: tvm-fade-in 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.75s forwards;
        }
        .tvm-apex-lights {
          opacity: 0;
          animation: tvm-fade-in 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.95s forwards;
        }
        .tvm-numerals {
          opacity: 0;
          animation: tvm-fade-in 1.2s cubic-bezier(0.22, 1, 0.36, 1) 1.1s forwards;
        }
        .tvm-wordmark {
          opacity: 0;
          animation: tvm-fade-in 1.3s cubic-bezier(0.22, 1, 0.36, 1) 1.3s forwards;
        }
        .tvm-fan {
          opacity: 0;
          animation:
            tvm-fade-in-soft 1.6s cubic-bezier(0.22, 1, 0.36, 1) 1.6s forwards,
            tvm-breathe-a 8s ease-in-out 3.2s infinite;
        }
        .tvm-flightpath {
          opacity: 0;
          animation: tvm-fade-in 1.4s cubic-bezier(0.22, 1, 0.36, 1) 2s forwards;
        }
        .tvm-plane {
          opacity: 0;
          animation: tvm-fade-in 0.7s ease-out 2.5s forwards;
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
          transition:
            fill 0.45s ease,
            filter 0.5s ease,
            transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tvm-numeral-group[data-active="true"] .tvm-numeral {
          fill: #f3f2eb;
          filter:
            drop-shadow(0 0 6px rgba(243, 242, 235, 0.65))
            drop-shadow(0 0 16px rgba(243, 242, 235, 0.35))
            drop-shadow(0 0 32px rgba(243, 242, 235, 0.18));
        }

        .tvm-numeral-group.tvm-pos-tl[data-active="true"] .tvm-numeral {
          transform: translate(3px, -2px);
        }
        .tvm-numeral-group.tvm-pos-tr[data-active="true"] .tvm-numeral {
          transform: translate(-3px, -2px);
        }
        .tvm-numeral-group.tvm-pos-b[data-active="true"] .tvm-numeral {
          transform: translate(0, 3px);
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
            radial-gradient(circle at var(--panel-origin-x, 50vw) var(--panel-origin-y, 50vh), rgba(243,242,235,0.045), transparent 12rem),
            radial-gradient(circle at var(--panel-origin-x, 50vw) var(--panel-origin-y, 50vh), rgba(3,3,3,0.56), rgba(3,3,3,0.78) 48%, rgba(3,3,3,0.9) 100%);
          clip-path: circle(0 at var(--panel-origin-x, 50vw) var(--panel-origin-y, 50vh));
          opacity: 0;
          transition:
            clip-path 1.25s cubic-bezier(0.16, 1, 0.3, 1),
            opacity 0.85s ease;
        }

        .tvm-content-shell::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, rgba(243,242,235,0.018), transparent 18rem);
          clip-path: circle(0 at var(--panel-origin-x, 50vw) var(--panel-origin-y, 50vh));
          opacity: 0;
          pointer-events: none;
          transform: rotate(0.001deg);
          transition:
            clip-path 1.45s cubic-bezier(0.16, 1, 0.3, 1),
            opacity 1s ease;
        }

        .tvm-content-shell[data-open="true"] {
          pointer-events: auto;
        }

        .tvm-content-shell[data-open="true"]::before {
          clip-path: circle(155vmax at var(--panel-origin-x, 50vw) var(--panel-origin-y, 50vh));
          opacity: 1;
        }

        .tvm-content-shell[data-open="true"]::after {
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
          transform-origin: var(--panel-origin-x, 50vw) var(--panel-origin-y, 50vh);
          transition:
            opacity 0.85s ease,
            transform 1.05s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tvm-content-shell[data-open="true"] .tvm-content-panel {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }

        .tvm-content-panel--education {
          --panel-angle: -14deg;
          --panel-dash-angle: 20deg;
        }

        .tvm-content-panel--projects {
          --panel-angle: 14deg;
          --panel-dash-angle: -20deg;
        }

        .tvm-content-panel--contact {
          --panel-angle: -4deg;
          --panel-dash-angle: 32deg;
        }

        .tvm-content-panel::before,
        .tvm-content-panel::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: clamp(13rem, 36vmin, 27rem);
          aspect-ratio: 1;
          border: 1px solid rgba(243,242,235,0.12);
          border-radius: 50%;
          pointer-events: none;
          opacity: 0;
          transform: translate(-50%, -50%) rotate(var(--panel-angle, 0deg)) scale(0.74);
          transition:
            opacity 1s ease,
            transform 1.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tvm-content-panel::after {
          width: clamp(8.5rem, 23vmin, 18rem);
          border-color: rgba(243,242,235,0.085);
          border-style: dashed;
          transform: translate(-50%, -50%) rotate(var(--panel-dash-angle, 0deg)) scale(0.84);
        }

        .tvm-content-shell[data-open="true"] .tvm-content-panel::before,
        .tvm-content-shell[data-open="true"] .tvm-content-panel::after {
          opacity: 1;
          transform: translate(-50%, -50%) rotate(var(--panel-angle, 0deg)) scale(1);
        }

        .tvm-content-shell[data-open="true"] .tvm-content-panel::after {
          opacity: 0.72;
          transform: translate(-50%, -50%) rotate(var(--panel-dash-angle, 0deg)) scale(1);
        }

        .tvm-section-seal {
          position: absolute;
          top: 50%;
          left: 50%;
          z-index: 1;
          width: clamp(9.5rem, 28vmin, 21rem);
          aspect-ratio: 1;
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, -50%) rotate(var(--panel-angle, 0deg)) scale(0.86);
          transition:
            opacity 1s ease 0.18s,
            transform 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.08s;
        }

        .tvm-seal-orbit,
        .tvm-seal-axis,
        .tvm-seal-pin {
          position: absolute;
          display: block;
          pointer-events: none;
        }

        .tvm-seal-orbit {
          inset: 0;
          border: 1px solid rgba(243,242,235,0.13);
          border-radius: 50%;
          transform-origin: center;
        }

        .tvm-seal-orbit-a {
          transform: scale(0.98);
        }

        .tvm-seal-orbit-b {
          border-color: rgba(243,242,235,0.09);
          border-style: dashed;
          transform: scale(0.64);
        }

        .tvm-seal-axis {
          top: 50%;
          left: 50%;
          width: 112%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(243,242,235,0.14), transparent);
          transform-origin: center;
        }

        .tvm-seal-axis-a {
          transform: translate(-50%, -50%) rotate(0deg);
        }

        .tvm-seal-axis-b {
          transform: translate(-50%, -50%) rotate(90deg);
        }

        .tvm-seal-pin {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(243,242,235,0.38);
        }

        .tvm-seal-pin-a {
          top: 50%;
          left: -1px;
          transform: translate(-50%, -50%);
        }

        .tvm-seal-pin-b {
          right: -1px;
          bottom: 50%;
          transform: translate(50%, 50%);
        }

        .tvm-section-seal--education .tvm-seal-orbit-a {
          transform: rotate(-18deg) scaleX(0.78) scaleY(1.08);
        }

        .tvm-section-seal--education .tvm-seal-orbit-b {
          transform: rotate(24deg) scaleX(0.62) scaleY(1.16);
        }

        .tvm-section-seal--education .tvm-seal-axis-a {
          transform: translate(-50%, -50%) rotate(-18deg);
        }

        .tvm-section-seal--education .tvm-seal-axis-b {
          transform: translate(-50%, -50%) rotate(72deg);
        }

        .tvm-section-seal--projects .tvm-seal-orbit-a {
          transform: rotate(18deg) scaleX(0.78) scaleY(1.08);
        }

        .tvm-section-seal--projects .tvm-seal-orbit-b {
          transform: rotate(-24deg) scaleX(0.62) scaleY(1.16);
        }

        .tvm-section-seal--projects .tvm-seal-axis-a {
          transform: translate(-50%, -50%) rotate(18deg);
        }

        .tvm-section-seal--projects .tvm-seal-axis-b {
          transform: translate(-50%, -50%) rotate(108deg);
        }

        .tvm-section-seal--contact .tvm-seal-orbit-a {
          transform: rotate(90deg) scaleX(0.76) scaleY(1.1);
        }

        .tvm-section-seal--contact .tvm-seal-orbit-b {
          transform: rotate(-32deg) scaleX(0.64) scaleY(1.18);
        }

        .tvm-section-seal--contact .tvm-seal-axis-a {
          transform: translate(-50%, -50%) rotate(-8deg);
        }

        .tvm-section-seal--contact .tvm-seal-axis-b {
          transform: translate(-50%, -50%) rotate(82deg);
        }

        .tvm-content-shell[data-open="true"] .tvm-section-seal {
          opacity: 1;
          transform: translate(-50%, -50%) rotate(var(--panel-angle, 0deg)) scale(1);
        }

        .tvm-panel-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.15rem;
        }

        .tvm-panel-content--minimal {
          justify-content: center;
          min-height: clamp(13rem, 28vmin, 19rem);
        }

        .tvm-panel-content > * {
          opacity: 0;
          transform: translateY(-6px) scale(0.92);
          transition:
            opacity 0.7s ease,
            transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tvm-content-shell[data-open="true"] .tvm-panel-content > *,
        .tvm-content-shell[data-open="true"] .tvm-close {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .tvm-content-shell[data-open="true"] .tvm-close {
          transition-delay: 0.62s;
          transform: translateX(-50%);
        }

        .tvm-content-shell[data-open="true"] .tvm-section-mark {
          transition-delay: 0.42s;
        }

        .tvm-content-shell[data-open="true"] .tvm-panel-title {
          transition-delay: 0.5s;
        }

        .tvm-content-shell[data-open="true"] .tvm-panel-intro {
          transition-delay: 0.58s;
        }

        .tvm-content-shell[data-open="true"] .tvm-detail-list {
          transition-delay: 0.66s;
        }

        .tvm-section-mark {
          margin: 0;
          color: #6b6b66;
          font-size: clamp(1.15rem, 3vw, 1.65rem);
          font-style: italic;
          line-height: 1;
        }

        .tvm-section-mark--solo {
          color: rgba(243,242,235,0.82);
          font-size: clamp(4rem, 12vw, 8rem);
          letter-spacing: 0.02em;
          text-shadow: 0 0 22px rgba(243,242,235,0.1);
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
          opacity: 0;
          transform: translateX(-50%) translateY(-6px) scale(0.92);
          transition:
            color 0.3s ease,
            opacity 1s cubic-bezier(0.16, 1, 0.3, 1),
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

        .tvm-content-shell[data-open="true"] .tvm-close:hover {
          transform: translateX(-50%) scale(1.08);
        }

        .tvm-close:focus-visible {
          outline: 1px solid rgba(243,242,235,0.32);
          outline-offset: 6px;
        }

        .tvm-numeral-group,
        .tvm-numeral-group:focus,
        .tvm-numeral-group:focus-visible,
        .tvm-numeral-hit,
        .tvm-numeral-hit:focus,
        .tvm-numeral-hit:focus-visible {
          outline: none;
        }

          @media (max-width: 700px) {
          .tvm-content-panel {
            width: min(90vw, 430px);
            min-height: min(58dvh, 440px);
          }

          .tvm-panel-content--minimal {
            min-height: min(42dvh, 20rem);
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

        /* ----- Touch / compact viewport (mobile portrait) ----- */

        .tvm-hero[data-compact="true"] .tvm-numeral {
          font-size: 56px;
          transition:
            fill 0.18s ease,
            filter 0.18s ease;
        }

        .tvm-hero[data-compact="true"] {
          height: 100svh;
          min-height: 100svh;
        }

        .tvm-hero[data-compact="true"]::before,
        .tvm-hero[data-compact="true"] .tvm-fan,
        .tvm-hero[data-compact="true"] .tvm-orbit-dashed,
        .tvm-hero[data-compact="true"] .tvm-flightpath,
        .tvm-hero[data-compact="true"] .tvm-plane {
          animation: none;
        }

        .tvm-hero[data-compact="true"]::before {
          opacity: 0.2;
        }

        .tvm-hero[data-compact="true"] .tvm-fan {
          opacity: 0.48;
        }

        .tvm-hero[data-compact="true"] .tvm-flightpath {
          opacity: 0.16;
        }

        .tvm-hero[data-compact="true"] .tvm-plane {
          display: none;
        }

        .tvm-hero[data-compact="true"] .tvm-ripple {
          display: none;
        }

        .tvm-hero[data-compact="true"] .tvm-numeral-group[data-active="true"] .tvm-numeral {
          filter: drop-shadow(0 0 8px rgba(243, 242, 235, 0.38));
        }

        .tvm-hero[data-compact="true"] .tvm-orbit-group {
          transition:
            opacity 0.22s ease,
            transform 0.22s ease;
        }

        .tvm-hero[data-compact="true"][data-panel-open="true"] .tvm-svg {
          opacity: 0.32;
          filter: none;
        }

        .tvm-hero[data-compact="true"] .tvm-content-shell::after {
          display: none;
        }

        .tvm-hero[data-compact="true"] .tvm-content-shell::before {
          background: rgba(0,0,0,0.9);
          clip-path: none;
          transition:
            opacity 0.28s ease;
        }

        .tvm-hero[data-compact="true"] .tvm-content-shell[data-open="true"]::before {
          clip-path: none;
        }

        .tvm-hero[data-compact="true"] .tvm-content-panel {
          transition:
            opacity 0.26s ease,
            transform 0.32s ease;
        }

        .tvm-hero[data-compact="true"] .tvm-content-panel::before,
        .tvm-hero[data-compact="true"] .tvm-content-panel::after,
        .tvm-hero[data-compact="true"] .tvm-section-seal,
        .tvm-hero[data-compact="true"] .tvm-panel-content > *,
        .tvm-hero[data-compact="true"] .tvm-close {
          transition-duration: 0.24s;
        }

        @media (hover: none) {
          .tvm-numeral-group[data-active="true"] .tvm-numeral,
          .tvm-numeral-group.tvm-pos-tl[data-active="true"] .tvm-numeral,
          .tvm-numeral-group.tvm-pos-tr[data-active="true"] .tvm-numeral,
          .tvm-numeral-group.tvm-pos-b[data-active="true"] .tvm-numeral {
            transform: none;
          }

          .tvm-hero::before {
            animation-duration: 48s;
          }

          .tvm-fan {
            animation: none;
            opacity: 0.55;
          }

          .tvm-orbit-dashed {
            animation: none;
          }
        }

        /* ----- Reduced motion ----- */

        @media (prefers-reduced-motion: reduce) {
          .tvm-hero::before,
          .tvm-fan,
          .tvm-orbit-dashed {
            animation: none;
          }
          .tvm-flightpath,
          .tvm-plane,
          .tvm-triangle,
          .tvm-numerals,
          .tvm-wordmark,
          .tvm-vertex-orbits,
          .tvm-apex-lights,
          .tvm-idle-traces {
            opacity: 1;
            animation: none;
          }
          .tvm-svg,
          .tvm-content-shell::before,
          .tvm-content-shell::after,
          .tvm-content-panel,
          .tvm-content-panel::before,
          .tvm-content-panel::after,
          .tvm-section-seal,
          .tvm-panel-content > *,
          .tvm-close {
            transition-duration: 0.01ms;
          }
        }
      `}</style>

      <div
        className="tvm-hero"
        data-active={geometryActive !== null}
        data-panel-open={isContentOpen}
        data-compact={isCompact}
        style={{
          "--panel-origin-x": tapOrigin ? `${tapOrigin.x}px` : activeAnchor?.originX ?? "50vw",
          "--panel-origin-y": tapOrigin ? `${tapOrigin.y}px` : activeAnchor?.originY ?? "50vh",
          "--entry-x": isCompact ? "0px" : activeAnchor?.entryX ?? "0px",
          "--entry-y": isCompact ? "18px" : activeAnchor?.entryY ?? "32px",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={isCompact ? "560 140 480 760" : "0 0 1600 900"}
          className="tvm-svg"
          preserveAspectRatio="xMidYMid slice"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 0. Cruising plane (background layer — behind every other mark) */}
          <g id="trajectory">
            <path
              id="tvm-plane-path"
              d="M -200,100 Q 800,460 1800,100"
              fill="none"
              stroke="#ece8de"
              strokeWidth="0.6"
              strokeOpacity="0.16"
              strokeDasharray="2 6"
              strokeLinecap="round"
              className="tvm-flightpath"
            />
            <g className="tvm-plane">
              <path
                d="M 12,0 L -1.3,-0.95 L -5.5,-9.5 L -6.8,-9.5 L -4,-0.95 L -8.7,-0.95 L -10,-4 L -11.5,-4 L -10.8,-0.95 L -12.2,-0.95 L -12.2,0.95 L -10.8,0.95 L -11.5,4 L -10,4 L -8.7,0.95 L -4,0.95 L -6.8,9.5 L -5.5,9.5 L -1.3,0.95 Z"
                fill="#ece8de"
                fillOpacity="0.32"
              />
              {!isCompact && (
                <animateMotion
                  dur="24s"
                  begin="2.5s"
                  repeatCount="indefinite"
                  rotate="auto"
                  calcMode="linear"
                  keyTimes="0; 0.42; 1"
                  keyPoints="0; 1; 1"
                >
                  <mpath href="#tvm-plane-path" />
                </animateMotion>
              )}
            </g>
          </g>

          {/* 1. Right fan & left feather */}
          <g id="rightFan" className="tvm-fan" stroke="white" fill="none" strokeWidth="0.7" strokeOpacity="0.6">
            {Array.from({ length: 10 }).map((_, i) => (
              <path
                key={`fan-${i}`}
                d={`M 1760,${478 - i * 1.4} C 1460,${398 - i * 4.5} ${1130 - i * 6},${520 + i * 5.5} ${760 - i * 22},${640 + i * 9}`}
              />
            ))}
          </g>

          {/* 4. Vertex orbits — proximity-driven concentric circles */}
          <g id="vertexOrbits" className="tvm-vertex-orbits">
            {layoutAnchors.map((anchor) => {
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
                    strokeOpacity="0.82"
                    strokeDasharray="2 6"
                  />
                </g>
              );
            })}
          </g>

          {/* 5. Idle traces — slow rotating arcs around each anchor */}
          {!isCompact && (
            <g id="idleTraces" className="tvm-idle-traces">
              {layoutAnchors.map((anchor, i) => {
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
          )}

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
              strokeWidth={isCompact ? "1.34" : "1.5"}
              strokeOpacity={isCompact ? "0.78" : "0.85"}
              strokeLinejoin={isCompact ? "round" : "miter"}
              strokeLinecap={isCompact ? "round" : "butt"}
            />
          </g>

          {/* 9. Apex lights at each triangle vertex */}
          <g id="apexLights" className="tvm-apex-lights">
            {triangleVertices.map((v, i) => {
              const anchorId = layoutAnchors[i].id;
              return (
                <g
                  key={`apex-${i}`}
                  className="tvm-apex"
                  style={{ opacity: apexOpacity(anchorId) }}
                >
                  <circle
                    cx={v.x}
                    cy={v.y}
                    r={isCompact ? "2.6" : "3.4"}
                    fill={isCompact ? "rgba(243,242,235,0.11)" : "rgba(243,242,235,0.16)"}
                  />
                  <circle
                    cx={v.x}
                    cy={v.y}
                    r={isCompact ? "1.1" : "1.5"}
                    fill={isCompact ? "rgba(243,242,235,0.58)" : "rgba(243,242,235,0.78)"}
                  />
                </g>
              );
            })}
          </g>

          {/* 11. Roman numerals — interactive nav */}
          <g id="romanNumerals" className="tvm-numerals tvm-serif">
            {layoutAnchors.map((anchor) => {
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
                  onPointerUp={(event) => {
                    if (!isCompact) return;
                    event.preventDefault();
                    event.stopPropagation();
                    openContent(anchor, event);
                  }}
                  onMouseEnter={() => {
                    if (!isContentOpen) setActive(anchor.id);
                  }}
                  onMouseLeave={() => {
                    if (!isContentOpen) setActive(null);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isCompact) return;
                    openContent(anchor, event);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    openContent(anchor);
                  }}
                >
                  <title>{anchor.title}</title>
                  {/* Invisible hit target — generous click/hover area */}
                  <circle
                    className="tvm-numeral-hit"
                    cx={anchor.x}
                    cy={anchor.y}
                    r={isCompact ? 96 : 34}
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
              y="456"
              textAnchor="middle"
              fill="#ece8de"
              fontSize="15"
              fontWeight="400"
              style={{ letterSpacing: "0.32em" }}
            >
              I'm Tresor
            </text>
          </g>
        </svg>

        <div
          className="tvm-content-shell"
          data-open={isContentOpen}
          aria-hidden={!isContentOpen}
          onClick={handleBackdropClick}
        >
          {activeContent && (
            <section
              className={`tvm-content-panel tvm-content-panel--${activeSection} tvm-serif`}
              role="dialog"
              aria-modal="true"
              aria-label={`${activeContent.title} section`}
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className={`tvm-section-seal tvm-section-seal--${activeSection}`}
                aria-hidden="true"
              >
                <span className="tvm-seal-orbit tvm-seal-orbit-a" />
                <span className="tvm-seal-orbit tvm-seal-orbit-b" />
                <span className="tvm-seal-axis tvm-seal-axis-a" />
                <span className="tvm-seal-axis tvm-seal-axis-b" />
                <span className="tvm-seal-pin tvm-seal-pin-a" />
                <span className="tvm-seal-pin tvm-seal-pin-b" />
              </div>

              <button
                className="tvm-close"
                type="button"
                aria-label="Close section"
                onClick={closeContent}
              />

              <div className="tvm-panel-content tvm-panel-content--minimal">
                <p className="tvm-section-mark tvm-section-mark--solo">
                  {activeContent.eyebrow}
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
