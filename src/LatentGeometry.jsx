import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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

const phaseFromPoint = (point, salt) => {
  const seed = Math.sin(point.x * (12.9898 + salt) + point.y * (78.233 - salt)) * 43758.5453;
  return (seed - Math.floor(seed)) * TAU;
};

const buildVertexDrift = (point) => ({
  xPhase: phaseFromPoint(point, 0.19),
  yPhase: phaseFromPoint(point, 0.47),
  slowPhase: phaseFromPoint(point, 0.83),
  scale: 0.64 + (phaseFromPoint(point, 1.31) / TAU) * 0.58,
});

const driftVertex = (point, drift, time, amount) => {
  if (amount === 0) {
    return point;
  }

  const breath = time * 0.000058;
  const slow = time * 0.000023 + drift.slowPhase;

  return {
    x:
      point.x +
      (Math.sin(breath + drift.xPhase) * 0.72 + Math.sin(slow) * 0.28) *
        amount *
        drift.scale,
    y:
      point.y +
      (Math.cos(breath * 0.92 + drift.yPhase) * 0.68 + Math.sin(slow * 1.17) * 0.32) *
        amount *
        drift.scale,
  };
};

const createVertexStore = (tolerance) => {
  const cellSize = tolerance;
  const cells = new Map();
  const vertices = [];

  const cellKey = (x, y) => `${x}:${y}`;

  const find = (point) => {
    const gridX = Math.round(point.x / cellSize);
    const gridY = Math.round(point.y / cellSize);
    let nearest = null;
    let nearestDistance = tolerance;

    for (let y = gridY - 1; y <= gridY + 1; y += 1) {
      for (let x = gridX - 1; x <= gridX + 1; x += 1) {
        const bucket = cells.get(cellKey(x, y));

        if (!bucket) {
          continue;
        }

        bucket.forEach((vertex) => {
          const distance = Math.hypot(point.x - vertex.x, point.y - vertex.y);

          if (distance < nearestDistance) {
            nearest = vertex;
            nearestDistance = distance;
          }
        });
      }
    }

    if (nearest) {
      nearest.x = (nearest.x * nearest.count + point.x) / (nearest.count + 1);
      nearest.y = (nearest.y * nearest.count + point.y) / (nearest.count + 1);
      nearest.count += 1;
      return nearest;
    }

    const vertex = {
      id: vertices.length,
      x: point.x,
      y: point.y,
      count: 1,
    };
    const key = cellKey(gridX, gridY);

    if (!cells.has(key)) {
      cells.set(key, []);
    }

    cells.get(key).push(vertex);
    vertices.push(vertex);

    return vertex;
  };

  return { find, vertices };
};

const edgeKey = (a, b) => (a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`);

const segmentLength = (segment) => Math.hypot(segment.a.x - segment.b.x, segment.a.y - segment.b.y);

const edgeScore = (edge) => segmentLength(edge) + (edge.samples > 1 ? 48 : 0);

const orientation = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const edgesCross = (first, second) => {
  if (
    first.a.id === second.a.id ||
    first.a.id === second.b.id ||
    first.b.id === second.a.id ||
    first.b.id === second.b.id
  ) {
    return false;
  }

  const epsilon = 0.001;
  const firstA = orientation(first.a, first.b, second.a);
  const firstB = orientation(first.a, first.b, second.b);
  const secondA = orientation(second.a, second.b, first.a);
  const secondB = orientation(second.a, second.b, first.b);

  return firstA * firstB < -epsilon && secondA * secondB < -epsilon;
};

const simplifyEdges = (edges, width, height) => {
  const minimumLength = clamp(Math.min(width, height) * 0.025, 16, 28);
  const kept = edges
    .map((edge, id) => ({ ...edge, id }))
    .filter((edge) => segmentLength(edge) >= minimumLength);
  const removed = new Set();
  let changed = true;

  while (changed) {
    changed = false;
    const incident = new Map();

    kept.forEach((edge) => {
      if (removed.has(edge.id)) {
        return;
      }

      [edge.a.id, edge.b.id].forEach((vertexId) => {
        if (!incident.has(vertexId)) {
          incident.set(vertexId, []);
        }

        incident.get(vertexId).push(edge);
      });
    });

    incident.forEach((vertexEdges) => {
      const activeEdges = vertexEdges.filter((edge) => !removed.has(edge.id));

      if (activeEdges.length <= 3) {
        return;
      }

      activeEdges
        .sort((a, b) => edgeScore(a) - edgeScore(b))
        .slice(0, activeEdges.length - 3)
        .forEach((edge) => {
          removed.add(edge.id);
          changed = true;
        });
    });
  }

  let crossingRemoved = true;

  while (crossingRemoved) {
    crossingRemoved = false;
    const active = kept.filter((edge) => !removed.has(edge.id));

    for (let firstIndex = 0; firstIndex < active.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < active.length; secondIndex += 1) {
        const first = active[firstIndex];
        const second = active[secondIndex];

        if (!edgesCross(first, second)) {
          continue;
        }

        removed.add(edgeScore(first) <= edgeScore(second) ? first.id : second.id);
        crossingRemoved = true;
        break;
      }

      if (crossingRemoved) {
        break;
      }
    }
  }

  return kept.filter((edge) => !removed.has(edge.id));
};

const fallbackRayOriginAt = (width, height) => ({
  x: width * (width <= 820 ? 0.5 : 0.58),
  y: height * (width <= 820 ? 0.62 : 0.57),
});

const farthestDistanceFrom = (origin, width, height) =>
  Math.max(
    Math.hypot(origin.x, origin.y),
    Math.hypot(width - origin.x, origin.y),
    Math.hypot(width - origin.x, height - origin.y),
    Math.hypot(origin.x, height - origin.y),
  );

const distanceToCanvasEdge = (origin, width, height, angle) => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const distances = [];

  if (Math.abs(dx) > 0.0001) {
    distances.push(((dx > 0 ? width : 0) - origin.x) / dx);
  }

  if (Math.abs(dy) > 0.0001) {
    distances.push(((dy > 0 ? height : 0) - origin.y) / dy);
  }

  return Math.max(0, Math.min(...distances.filter((distance) => distance > 0)));
};

const driftingFocusAt = (time, width, height, reducedMotion) => {
  if (reducedMotion) {
    return { x: width * 0.57, y: height * 0.43 };
  }

  const drift = time * 0.000036;
  const crossDrift = time * 0.000019;

  return {
    x:
      width *
      (0.5 +
        Math.sin(drift + 0.8) * 0.24 +
        Math.sin(crossDrift + 2.7) * 0.08),
    y:
      height *
      (0.48 +
        Math.cos(drift * 0.86 + 1.6) * 0.2 +
        Math.sin(crossDrift * 1.28 + 0.4) * 0.07),
  };
};

const networkLightAt = (point, origin, time, width, height, reducedMotion) => {
  if (reducedMotion) {
    return 0;
  }

  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const edgeDistance = distanceToCanvasEdge(origin, width, height, angle);

  if (distance < 6 || distance > edgeDistance) {
    return 0;
  }

  const maxDistance = farthestDistanceFrom(origin, width, height);
  const speed = clamp(Math.min(width, height) * 0.000072, 0.044, 0.068);
  const cycle = maxDistance + 220;
  const spacing = cycle / 2.45;
  const head = clamp(Math.min(width, height) * 0.035, 24, 42);
  const tail = clamp(Math.min(width, height) * 0.22, 120, 210);
  let wave = 0;

  for (let index = 0; index < 3; index += 1) {
    const front = ((time * speed - index * spacing) % cycle + cycle) % cycle;
    const delta = front - distance;

    if (delta < -head || delta > tail) {
      continue;
    }

    const strength = delta < 0 ? 1 + delta / head : Math.pow(1 - delta / tail, 1.8);
    wave = Math.max(wave, strength);
  }

  const edgeFade = clamp(
    (edgeDistance - distance) / clamp(Math.min(width, height) * 0.18, 110, 220),
    0,
    1,
  );
  const distanceRatio = clamp(distance / Math.max(edgeDistance, 1), 0, 1);
  const distanceStrength = 1 - Math.pow(distanceRatio, 1.65) * 0.46;
  const originLift =
    Math.pow(
      clamp(1 - distance / clamp(Math.min(width, height) * 0.26, 100, 180), 0, 1),
      1.7,
    ) * 0.34;

  return clamp((wave * distanceStrength + originLift) * edgeFade, 0, 1);
};

const drawNetworkLight = (context, a, b, origin, time, width, height, reducedMotion, lineWidth, darkness) => {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  const lights = stops.map((amount) =>
    networkLightAt(
      {
        x: a.x + (b.x - a.x) * amount,
        y: a.y + (b.y - a.y) * amount,
      },
      origin,
      time,
      width,
      height,
      reducedMotion,
    ),
  );
  const strongest = Math.max(...lights);

  if (strongest <= 0.018) {
    return;
  }

  const gradient = context.createLinearGradient(a.x, a.y, b.x, b.y);

  lights.forEach((light, index) => {
    gradient.addColorStop(stops[index], `rgba(253, 238, 202, ${light * (0.23 + darkness * 0.1)})`);
  });

  context.save();
  context.lineCap = "butt";
  context.lineJoin = "miter";
  context.shadowBlur = 0;
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.lineWidth = lineWidth + strongest * 0.18;
  context.strokeStyle = gradient;
  context.stroke();
  context.restore();
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
  const vertexStore = createVertexStore(1.8);
  const edges = new Map();

  cells.forEach((cell) => {
    const center = cell.reduce(
      (sum, point) => ({ x: sum.x + point.x / cell.length, y: sum.y + point.y / cell.length }),
      { x: 0, y: 0 },
    );
    const screenBias = 1 - Math.min(0.75, Math.hypot(center.x - width * 0.58, center.y - height * 0.46) / Math.max(width, height));

    for (let index = 0; index < cell.length; index += 1) {
      const a = cell[index];
      const b = cell[(index + 1) % cell.length];
      const rawLength = Math.hypot(a.x - b.x, a.y - b.y);

      if (rawLength < 2.5) {
        continue;
      }

      const start = vertexStore.find(a);
      const end = vertexStore.find(b);

      if (start.id === end.id || Math.hypot(start.x - end.x, start.y - end.y) < 2.5) {
        continue;
      }

      const key = edgeKey(start, end);
      const width = 0.54 + random() * 0.16;
      const base = 0.034 + random() * 0.018 + screenBias * 0.018;
      const existing = edges.get(key);

      if (existing) {
        existing.base += base;
        existing.width += width;
        existing.samples += 1;
        return;
      }

      edges.set(key, {
        a: start,
        b: end,
        phase: random() * TAU,
        width,
        base,
        samples: 1,
      });
    }
  });

  vertexStore.vertices.forEach((vertex) => {
    vertex.drift = buildVertexDrift(vertex);
  });

  return simplifyEdges([...edges.values()], width, height).map((edge) => {
    const boost = edge.samples > 1 ? 1.34 : 1;

    return {
      a: edge.a,
      b: edge.b,
      midpoint: {
        x: (edge.a.x + edge.b.x) / 2,
        y: (edge.a.y + edge.b.y) / 2,
      },
      aDrift: edge.a.drift,
      bDrift: edge.b.drift,
      phase: edge.phase,
      width: edge.width / edge.samples,
      base: clamp((edge.base / edge.samples) * boost, 0.032, 0.086),
    };
  });
};

function LatentGeometry() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { alpha: true });
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, active: false, energy: 0 };
    let frame = 0;
    let segments = [];
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let rayOrigin = fallbackRayOriginAt(width, height);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(320, rect.width);
      height = Math.max(420, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      segments = buildSegments(width, height);

      const statue = document.querySelector(".statue");

      if (statue) {
        const statueRect = statue.getBoundingClientRect();
        rayOrigin = {
          x: statueRect.left - rect.left + statueRect.width * 0.5,
          y: statueRect.top - rect.top + statueRect.height * 0.56,
        };
      } else {
        rayOrigin = fallbackRayOriginAt(width, height);
      }
    };

    const draw = (time = 0) => {
      const canHover = hoverQuery.matches;
      const reducedMotion = motionQuery.matches;
      const motionTime = reducedMotion ? 0 : time;
      const driftAmount = reducedMotion ? 0 : clamp(Math.min(width, height) * 0.0038, 1.4, 3.7);
      const autonomousFocus = driftingFocusAt(motionTime, width, height, reducedMotion);
      const autonomousRadius = Math.max(230, Math.min(width, height) * 0.56);
      const interactionRadius = Math.max(190, Math.min(width, height) * 0.36);

      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      context.lineJoin = "round";

      if (!reducedMotion && pointer.active) {
        pointer.x += (pointer.targetX - pointer.x) * 0.078;
        pointer.y += (pointer.targetY - pointer.y) * 0.078;
      }

      const pointerTarget = !reducedMotion && canHover && pointer.active ? 1 : 0;
      pointer.energy += (pointerTarget - pointer.energy) * 0.055;

      segments.forEach((segment) => {
        const a = driftVertex(segment.a, segment.aDrift, motionTime, driftAmount);
        const b = driftVertex(segment.b, segment.bDrift, motionTime, driftAmount);
        const drawableSegment = { a, b };
        const midpoint = {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        };
        const darkness = darknessAt(midpoint, width, height);
        const idle = reducedMotion ? 0.5 : 0.5 + Math.sin(motionTime * 0.00024 + segment.phase) * 0.5;
        const deepPulse = reducedMotion
          ? 0.5
          : 0.5 + Math.sin(motionTime * 0.00012 + segment.phase * 0.7) * 0.5;
        const autonomousDistance = distanceToSegment(autonomousFocus, drawableSegment);
        const autonomousProximity = Math.max(0, 1 - autonomousDistance / autonomousRadius);
        const autonomousActivation = autonomousProximity * autonomousProximity;
        const autonomousInfluence = canHover ? 1 - pointer.energy * 0.72 : 1;
        const distance =
          canHover && pointer.energy > 0.001 ? distanceToSegment(pointer, drawableSegment) : Infinity;
        const proximity = Math.max(0, 1 - distance / interactionRadius);
        const cursorActivation = proximity * proximity * pointer.energy;
        const activation = clamp(autonomousActivation * autonomousInfluence + cursorActivation, 0, 1);
        const baseAlpha = segment.base * (0.82 + idle * 0.13 + darkness * (0.14 + deepPulse * 0.16));
        const focalAlpha =
          autonomousActivation * autonomousInfluence * (0.036 + darkness * 0.075) +
          cursorActivation * (0.085 + darkness * 0.19);
        const activeWidth = segment.width + activation * (0.72 + darkness * 0.62);

        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.lineWidth = segment.width;
        context.strokeStyle = `rgba(218, 205, 176, ${baseAlpha})`;
        context.stroke();

        if (activation > 0.003) {
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.lineWidth = activeWidth;
          context.strokeStyle = `rgba(242, 225, 190, ${focalAlpha})`;
          context.shadowColor = `rgba(238, 214, 172, ${0.16 + darkness * 0.18})`;
          context.shadowBlur = 3 + autonomousActivation * 6 + cursorActivation * (8 + darkness * 12);
          context.stroke();
          context.shadowBlur = 0;
        }

        drawNetworkLight(context, a, b, rayOrigin, motionTime, width, height, reducedMotion, segment.width, darkness);
      });

      if (!reducedMotion) {
        frame = window.requestAnimationFrame(draw);
      }
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

    const handleMotionChange = () => {
      window.cancelAnimationFrame(frame);
      pointer.active = false;
      pointer.energy = 0;
      draw();
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("pointerleave", leave);
    window.addEventListener("mouseleave", leave);
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("pointerleave", leave);
      window.removeEventListener("mouseleave", leave);
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="latent-geometry" aria-hidden="true" />;
}

export default LatentGeometry;
