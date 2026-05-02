import { useEffect, useRef } from "react";

const seedFrom = (value) => {
  let state = value >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const clipPolygon = (polygon, point, normal) => {
  if (polygon.length === 0) {
    return polygon;
  }

  const clipped = [];
  const inside = (vertex) =>
    (vertex.x - point.x) * normal.x + (vertex.y - point.y) * normal.y <= 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);

    if (currentInside !== previousInside) {
      const direction = {
        x: current.x - previous.x,
        y: current.y - previous.y,
      };
      const denominator = direction.x * normal.x + direction.y * normal.y;

      if (Math.abs(denominator) > 0.0001) {
        const amount =
          -((previous.x - point.x) * normal.x + (previous.y - point.y) * normal.y) /
          denominator;
        clipped.push({
          x: previous.x + direction.x * amount,
          y: previous.y + direction.y * amount,
        });
      }
    }

    if (currentInside) {
      clipped.push(current);
    }
  }

  return clipped;
};

const distanceToSegment = (point, segment) => {
  const vx = segment.b.x - segment.a.x;
  const vy = segment.b.y - segment.a.y;
  const wx = point.x - segment.a.x;
  const wy = point.y - segment.a.y;
  const lengthSquared = vx * vx + vy * vy;
  const amount = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / lengthSquared));
  const x = segment.a.x + amount * vx;
  const y = segment.a.y + amount * vy;

  return Math.hypot(point.x - x, point.y - y);
};

const darknessAt = (point, width, height) => {
  const centerX = width * 0.61;
  const centerY = height * 0.46;
  const centerDistance = Math.hypot((point.x - centerX) / width, (point.y - centerY) / height);
  const centerLight = Math.max(0, 1 - centerDistance / 0.52);
  const edgeShade = Math.max(
    Math.abs(point.x / width - 0.5) * 1.55,
    Math.abs(point.y / height - 0.5) * 1.15,
  );

  return Math.max(0, Math.min(1, 0.22 + edgeShade * 0.72 - centerLight * 0.38));
};

const buildCells = (width, height, random) => {
  const margin = Math.max(180, Math.min(width, height) * 0.2);
  const spacing = Math.max(124, Math.min(260, Math.sqrt((width * height) / 60)));
  const rowHeight = spacing * 0.82;
  const points = [];

  for (let y = -margin, row = 0; y <= height + margin; y += rowHeight, row += 1) {
    for (let x = -margin; x <= width + margin; x += spacing) {
      if (random() < 0.16) {
        continue;
      }

      points.push({
        x: x + (row % 2) * spacing * 0.5 + (random() - 0.5) * spacing * 0.38,
        y: y + (random() - 0.5) * spacing * 0.34,
      });
    }
  }

  const bounds = [
    { x: -margin, y: -margin },
    { x: width + margin, y: -margin },
    { x: width + margin, y: height + margin },
    { x: -margin, y: height + margin },
  ];

  return points
    .map((site, siteIndex) => {
      let polygon = bounds;

      for (let index = 0; index < points.length; index += 1) {
        if (index === siteIndex) {
          continue;
        }

        const other = points[index];
        const midpoint = {
          x: (site.x + other.x) / 2,
          y: (site.y + other.y) / 2,
        };
        const normal = {
          x: other.x - site.x,
          y: other.y - site.y,
        };

        polygon = clipPolygon(polygon, midpoint, normal);

        if (polygon.length === 0) {
          break;
        }
      }

      return polygon;
    })
    .filter((polygon) => polygon.length > 2);
};

const buildSegments = (width, height) => {
  const random = seedFrom(Math.round(width * 17 + height * 31));
  const cells = buildCells(width, height, random);
  const segments = [];

  cells.forEach((cell) => {
    const center = cell.reduce(
      (sum, point) => ({ x: sum.x + point.x / cell.length, y: sum.y + point.y / cell.length }),
      { x: 0, y: 0 },
    );
    const screenBias = 1 - Math.min(0.75, Math.hypot(center.x - width * 0.58, center.y - height * 0.46) / Math.max(width, height));

    for (let index = 0; index < cell.length; index += 1) {
      const a = cell[index];
      const b = cell[(index + 1) % cell.length];
      const length = Math.hypot(a.x - b.x, a.y - b.y);

      if (length < 18) {
        continue;
      }

      segments.push({
        a,
        b,
        midpoint: {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        },
        phase: random() * Math.PI * 2,
        base: 0.012 + random() * 0.017 + screenBias * 0.015,
      });
    }
  });

  return segments;
};

function LatentGeometry() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { alpha: true });
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, active: false, energy: 0 };
    let frame = 0;
    let segments = [];
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(320, rect.width);
      height = Math.max(420, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      segments = buildSegments(width, height);
    };

    const draw = (time = 0) => {
      const canHover = hoverQuery.matches;
      const interactionRadius = Math.max(190, Math.min(width, height) * 0.34);

      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      context.lineJoin = "round";

      if (pointer.active) {
        pointer.x += (pointer.targetX - pointer.x) * 0.078;
        pointer.y += (pointer.targetY - pointer.y) * 0.078;
      }

      pointer.energy += (Number(pointer.active) - pointer.energy) * 0.055;

      segments.forEach((segment) => {
        const darkness = darknessAt(segment.midpoint, width, height);
        const idle = 0.5 + Math.sin(time * 0.00042 + segment.phase) * 0.5;
        const deepPulse = 0.5 + Math.sin(time * 0.00018 + segment.phase * 0.7) * 0.5;
        const distance = canHover && pointer.energy > 0.001 ? distanceToSegment(pointer, segment) : Infinity;
        const proximity = Math.max(0, 1 - distance / interactionRadius);
        const activation = proximity * proximity * pointer.energy;
        const baseAlpha = segment.base * (0.76 + idle * 0.34 + darkness * (0.42 + deepPulse * 0.62));
        const activeAlpha = activation * (0.2 + darkness * 0.78);
        const activeWidth = 0.78 + activation * (1.2 + darkness * 2.2);

        context.beginPath();
        context.moveTo(segment.a.x, segment.a.y);
        context.lineTo(segment.b.x, segment.b.y);
        context.lineWidth = 0.62;
        context.strokeStyle = `rgba(218, 205, 176, ${baseAlpha})`;
        context.stroke();

        if (activation > 0.002) {
          context.beginPath();
          context.moveTo(segment.a.x, segment.a.y);
          context.lineTo(segment.b.x, segment.b.y);
          context.lineWidth = activeWidth;
          context.strokeStyle = `rgba(242, 225, 190, ${activeAlpha})`;
          context.shadowColor = `rgba(238, 214, 172, ${0.38 + darkness * 0.42})`;
          context.shadowBlur = 9 + activation * (18 + darkness * 30);
          context.stroke();
          context.shadowBlur = 0;
        }
      });

      frame = window.requestAnimationFrame(draw);
    };

    const move = (event) => {
      if (!pointer.active) {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
      }

      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      pointer.active = true;
    };

    const leave = () => {
      pointer.active = false;
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("pointerleave", leave);
    window.addEventListener("mouseleave", leave);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("pointerleave", leave);
      window.removeEventListener("mouseleave", leave);
    };
  }, []);

  return <canvas ref={canvasRef} className="latent-geometry" aria-hidden="true" />;
}

export default LatentGeometry;
