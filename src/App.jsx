import { useEffect, useRef, useState } from "react";

const NAV_ITEMS = [
  {
    id: "education",
    label: "I",
    positionClass: "pos-top-left",
    entryX: "-34px",
    entryY: "-28px",
  },
  {
    id: "projects",
    label: "II",
    positionClass: "pos-top-right",
    entryX: "34px",
    entryY: "-28px",
  },
  {
    id: "contact",
    label: "III",
    positionClass: "pos-bottom-mid",
    entryX: "0px",
    entryY: "34px",
  },
];

const CONTENT_EXIT_MS = 1300;
const CIRCLE_HIT_BAND = 82;
const MOBILE_CIRCLE_HIT_BAND = 118;
const TRIANGLE_WORD_GAP = 28;
const MOBILE_TRIANGLE_WORD_GAP = 18;

const createAnchors = () => ({
  education: {
    x: 0,
    y: 0,
    triangleX: 0,
    triangleY: 0,
    baseR: 0,
    rScale: 1,
    targetRScale: 1,
    targetOp: 0.1,
    op: 0.1,
  },
  projects: {
    x: 0,
    y: 0,
    triangleX: 0,
    triangleY: 0,
    baseR: 0,
    rScale: 1,
    targetRScale: 1,
    targetOp: 0.1,
    op: 0.1,
  },
  contact: {
    x: 0,
    y: 0,
    triangleX: 0,
    triangleY: 0,
    baseR: 0,
    rScale: 1,
    targetRScale: 1,
    targetOp: 0.1,
    op: 0.1,
  },
});

function App() {
  const [activeState, setActiveState] = useState(null);
  const [hoveredSection, setHoveredSection] = useState(null);
  const [isContentOpen, setIsContentOpen] = useState(false);
  const [entryOffset, setEntryOffset] = useState({ x: "0px", y: "40px" });
  const [contentOrigin, setContentOrigin] = useState({ x: "50vw", y: "50vh" });
  const anchorsRef = useRef(null);
  const canvasRef = useRef(null);
  const centerCoreRef = useRef(null);
  const closeTimerRef = useRef(null);
  const hoveredSectionRef = useRef(null);
  const navRefs = useRef({});
  const ripplesRef = useRef([]);

  if (!anchorsRef.current) {
    anchorsRef.current = createAnchors();
  }

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext("2d", { alpha: false });
    const anchors = anchorsRef.current;
    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let animationFrame = 0;
    let isMounted = true;

    const updateAnchorMetrics = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cx = width / 2;
      cy = height / 2;

      Object.entries(anchors).forEach(([id, anchor]) => {
        const element = navRefs.current[id];

        if (!element) {
          return;
        }

        const anchorElement = element.querySelector(".nav-link") ?? element;
        const rect = anchorElement.getBoundingClientRect();
        const triangleGap = width <= 768 ? MOBILE_TRIANGLE_WORD_GAP : TRIANGLE_WORD_GAP;

        anchor.x = rect.left + rect.width / 2;
        anchor.y = rect.top + rect.height / 2;
        anchor.triangleX = anchor.x;
        anchor.triangleY = id === "contact" ? rect.top - triangleGap : rect.bottom + triangleGap;
        anchor.baseR = Math.hypot(cx - anchor.x, cy - anchor.y);
      });
    };

    const drawFadingLine = (from, to, reach, intensity, lineWidth) => {
      const endX = from.x + (to.x - from.x) * reach;
      const endY = from.y + (to.y - from.y) * reach;
      const gradient = ctx.createLinearGradient(from.x, from.y, endX, endY);

      gradient.addColorStop(0, `rgba(243, 242, 235, ${intensity})`);
      gradient.addColorStop(0.45, `rgba(243, 242, 235, ${intensity * 0.36})`);
      gradient.addColorStop(1, "rgba(243, 242, 235, 0)");

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    const drawApexLight = (points) => {
      const edgeReach = width <= 768 ? 0.12 : 0.15;
      const centerReach = width <= 768 ? 0.08 : 0.1;
      const coreRadius = width <= 768 ? 1.1 : 1.35;
      const pinRadius = width <= 768 ? 2.4 : 3;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      points.forEach((point, index) => {
        const previousPoint = points[(index + points.length - 1) % points.length];
        const nextPoint = points[(index + 1) % points.length];
        const centerPoint = { x: cx, y: cy };

        drawFadingLine(point, previousPoint, edgeReach, 0.16, 0.95);
        drawFadingLine(point, nextPoint, edgeReach, 0.16, 0.95);
        drawFadingLine(point, centerPoint, centerReach, 0.06, 0.65);

        ctx.beginPath();
        ctx.arc(point.x, point.y, pinRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(243, 242, 235, 0.08)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(point.x, point.y, coreRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(243, 242, 235, 0.38)";
        ctx.fill();
      });

      ctx.restore();
    };

    const drawGeometry = () => {
      ctx.fillStyle = "#030303";
      ctx.fillRect(0, 0, width, height);

      const anchorList = Object.values(anchors);
      const measuredAnchors = anchorList.filter((anchor) => anchor.baseR > 0);

      if (measuredAnchors.length === 3) {
        const trianglePoints = measuredAnchors.map((anchor) => ({
          x: anchor.triangleX,
          y: anchor.triangleY,
        }));

        ctx.beginPath();
        ctx.moveTo(trianglePoints[0].x, trianglePoints[0].y);
        trianglePoints.slice(1).forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.strokeStyle = "rgba(243, 242, 235, 0.035)";
        ctx.lineWidth = 1;
        ctx.stroke();

        trianglePoints.forEach((point) => {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(point.x, point.y);
          ctx.strokeStyle = "rgba(243, 242, 235, 0.018)";
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        drawApexLight(trianglePoints);
      }

      anchorList.forEach((anchor) => {
        anchor.op += (anchor.targetOp - anchor.op) * 0.05;
        anchor.rScale += (anchor.targetRScale - anchor.rScale) * 0.04;

        const r = Math.max(0, anchor.baseR * anchor.rScale);

        if (r > 1 && anchor.op > 0.005) {
          ctx.beginPath();
          ctx.arc(anchor.x, anchor.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(243, 242, 235, ${anchor.op})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(anchor.x, anchor.y, Math.max(0, r - 24), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(243, 242, 235, ${anchor.op * 0.5})`;
          ctx.setLineDash([2, 6]);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      for (let index = ripplesRef.current.length - 1; index >= 0; index -= 1) {
        const ripple = ripplesRef.current[index];
        ripple.r += ripple.dr;
        ripple.dr *= 0.94;
        ripple.op -= 0.012;

        if (ripple.op <= 0) {
          ripplesRef.current.splice(index, 1);
        } else {
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ripple.r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(243, 242, 235, ${ripple.op})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      animationFrame = window.requestAnimationFrame(drawGeometry);
    };

    updateAnchorMetrics();

    const metricRefreshTimers = [120, 800, 2300].map((delay) => window.setTimeout(updateAnchorMetrics, delay));

    drawGeometry();

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (isMounted) {
          updateAnchorMetrics();
        }
      });
    }

    window.addEventListener("resize", updateAnchorMetrics);

    return () => {
      isMounted = false;
      window.cancelAnimationFrame(animationFrame);
      metricRefreshTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", updateAnchorMetrics);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const openContent = (item) => {
    const selectedAnchor = anchorsRef.current[item.id];
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    setActiveState(item.id);
    setIsContentOpen(true);
    setHoveredSection(null);
    hoveredSectionRef.current = null;
    setEntryOffset({ x: item.entryX, y: item.entryY });
    setContentOrigin({
      x: `${selectedAnchor.triangleX || selectedAnchor.x}px`,
      y: `${selectedAnchor.triangleY || selectedAnchor.y}px`,
    });

    ripplesRef.current.push({
      x: selectedAnchor.x,
      y: selectedAnchor.y,
      r: selectedAnchor.baseR,
      op: 0.32,
      dr: 7,
    });

    Object.entries(anchorsRef.current).forEach(([id, anchor]) => {
      anchor.targetOp = id === item.id ? 0.3 : 0.02;
      anchor.targetRScale = id === item.id ? 1 : 0.94;
    });
  };

  const highlightSection = (id) => {
    if (isContentOpen) {
      return;
    }

    Object.entries(anchorsRef.current).forEach(([key, anchor]) => {
      anchor.targetOp = key === id ? 0.28 : 0.045;
      anchor.targetRScale = key === id ? 1.025 : 0.985;
    });
  };

  const resetGeometry = () => {
    if (isContentOpen) {
      return;
    }

    Object.values(anchorsRef.current).forEach((anchor) => {
      anchor.targetOp = 0.1;
      anchor.targetRScale = 1;
    });
  };

  const setGeometryTarget = (id) => {
    if (hoveredSectionRef.current === id) {
      return;
    }

    hoveredSectionRef.current = id;
    setHoveredSection(id);

    if (id) {
      highlightSection(id);
    } else {
      resetGeometry();
    }
  };

  const getCircleTarget = ({ clientX, clientY }) => {
    if (isContentOpen) {
      return null;
    }

    const centerRect = centerCoreRef.current?.getBoundingClientRect();
    if (
      centerRect &&
      clientX >= centerRect.left - 28 &&
      clientX <= centerRect.right + 28 &&
      clientY >= centerRect.top - 28 &&
      clientY <= centerRect.bottom + 28
    ) {
      return null;
    }

    const hitBand = window.innerWidth <= 768 ? MOBILE_CIRCLE_HIT_BAND : CIRCLE_HIT_BAND;
    const circleHits = NAV_ITEMS.map((item) => {
      const anchor = anchorsRef.current[item.id];
      const radius = anchor.baseR * anchor.rScale;
      const distance = Math.hypot(clientX - anchor.x, clientY - anchor.y);
      const boundaryDistance = Math.abs(distance - radius);
      const isInside = distance <= radius;

      return {
        id: item.id,
        distance,
        radius,
        score: isInside ? distance / radius : 1 + boundaryDistance / hitBand,
        boundaryDistance,
      };
    });

    const interiorHits = circleHits.filter((candidate) => candidate.distance <= candidate.radius);
    if (interiorHits.length > 1) {
      return null;
    }

    if (interiorHits.length === 1) {
      return interiorHits[0].id;
    }

    const boundaryHits = circleHits
      .filter((candidate) => candidate.boundaryDistance <= hitBand)
      .sort((a, b) => a.score - b.score);

    if (boundaryHits.length > 1) {
      return null;
    }

    return boundaryHits[0]?.id ?? null;
  };

  const handlePagePointerMove = (event) => {
    if (event.target.closest?.(".nav-item")) {
      return;
    }

    setGeometryTarget(getCircleTarget(event));
  };

  const handlePagePointerLeave = () => {
    setGeometryTarget(null);
  };

  const handlePageClick = (event) => {
    if (isContentOpen) {
      return;
    }

    const targetId = hoveredSectionRef.current ?? getCircleTarget(event);
    if (!targetId) {
      return;
    }

    const item = NAV_ITEMS.find((navItem) => navItem.id === targetId);
    if (item) {
      openContent(item);
    }
  };

  const closeContent = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    setIsContentOpen(false);

    Object.values(anchorsRef.current).forEach((anchor) => {
      anchor.targetOp = 0.1;
      anchor.targetRScale = 1;
    });

    closeTimerRef.current = window.setTimeout(() => {
      setActiveState(null);
    }, CONTENT_EXIT_MS);
  };

  return (
    <main
      className={`euclidean-page${isContentOpen ? " is-viewing-content" : ""}${hoveredSection ? " is-geometry-targeted" : ""}`}
      onClick={handlePageClick}
      onPointerLeave={handlePagePointerLeave}
      onPointerMove={handlePagePointerMove}
      style={{
        "--content-origin-x": contentOrigin.x,
        "--content-origin-y": contentOrigin.y,
        "--entry-x": entryOffset.x,
        "--entry-y": entryOffset.y,
      }}
    >
      <div id="canvas-container">
        <canvas id="geometry-canvas" ref={canvasRef} />
      </div>

      <div className="ui-layer">
        <div className="center-core fade-in-up" id="center-core" ref={centerCoreRef} style={{ animationDelay: "0.2s" }}>
          <h1 className="name font-serif">
            Tresor
            <br />
            Van Mulders
          </h1>
        </div>

        <div className="nav-system fade-in-up" id="nav-system" style={{ animationDelay: "0.6s" }}>
          {NAV_ITEMS.map((item) => (
            <button
              className={`nav-item ${item.positionClass}${hoveredSection === item.id ? " is-targeted" : ""}`}
              data-entry-x={item.entryX}
              data-entry-y={item.entryY}
              data-id={item.id}
              id={`nav-${item.id}`}
              key={item.id}
              onBlur={() => setGeometryTarget(null)}
              onClick={(event) => {
                event.stopPropagation();
                openContent(item);
              }}
              onFocus={() => setGeometryTarget(item.id)}
              onMouseEnter={() => setGeometryTarget(item.id)}
              onMouseLeave={() => setGeometryTarget(null)}
              ref={(element) => {
                navRefs.current[item.id] = element;
              }}
              type="button"
            >
              <span className="nav-link">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        id="content-pane"
        className="content-pane"
        onClick={(event) => {
          event.stopPropagation();
          closeContent();
        }}
      >
        <div className="content-inner" onClick={(event) => event.stopPropagation()}>
          <button id="btn-close" className="btn-close" type="button" aria-label="Close section" onClick={closeContent} />
        </div>
      </div>
    </main>
  );
}

export default App;
