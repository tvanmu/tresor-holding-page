import { useEffect, useRef } from "react";
import * as THREE from "three";

const TAU = Math.PI * 2;
const CAMERA_FOV = 38;
const MAX_PIXEL_RATIO = 2;
const CELL_INSET = 0.982;
const TITANIUM_HIGHLIGHT = new THREE.Color("#8a9491");
const EDGE_HOT_COLOR = new THREE.Color("#f0d79c");

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

const polygonCenter = (polygon) =>
  polygon.reduce(
    (sum, point) => ({
      x: sum.x + point.x / polygon.length,
      y: sum.y + point.y / polygon.length,
    }),
    { x: 0, y: 0 },
  );

const polygonArea = (polygon) => {
  let area = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
};

const cleanPolygon = (polygon) => {
  const cleaned = [];

  polygon.forEach((point) => {
    const previous = cleaned[cleaned.length - 1];

    if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > 0.6) {
      cleaned.push(point);
    }
  });

  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];

  if (first && last && Math.hypot(first.x - last.x, first.y - last.y) < 0.6) {
    cleaned.pop();
  }

  return cleaned.length >= 3 && Math.abs(polygonArea(cleaned)) > 20 ? cleaned : [];
};

const cellBounds = (polygon) =>
  polygon.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );

const isCellNearViewport = (polygon, width, height) => {
  const bounds = cellBounds(polygon);
  const pad = Math.min(width, height) * 0.12;

  return (
    bounds.maxX > -pad &&
    bounds.minX < width + pad &&
    bounds.maxY > -pad &&
    bounds.minY < height + pad
  );
};

const screenToWorld = (point, width, height) => ({
  x: point.x - width / 2,
  y: height / 2 - point.y,
});

const disposeObject = (object) => {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
};

const buildCellShape = (polygon, center, width, height, shrink) => {
  const shape = new THREE.Shape();

  polygon.forEach((point, index) => {
    const world = screenToWorld(point, width, height);
    const x = (world.x - center.x) * shrink;
    const y = (world.y - center.y) * shrink;

    if (index === 0) {
      shape.moveTo(x, y);
      return;
    }

    shape.lineTo(x, y);
  });

  shape.closePath();
  return shape;
};

const graphiteTitaniumColor = (random, screenBias) =>
  new THREE.Color().setHSL(
    0.57 + (random() - 0.5) * 0.06,
    0.07 + random() * 0.05,
    0.13 + random() * 0.035 + screenBias * 0.065,
  );

const spectralEdgeColor = (random, screenBias) => {
  const hues = [0.49, 0.57, 0.42, 0.13];
  const hue = hues[Math.floor(random() * hues.length)] + (random() - 0.5) * 0.025;

  return new THREE.Color().setHSL(
    hue,
    0.48 + random() * 0.22,
    0.5 + random() * 0.1 + screenBias * 0.16,
  );
};

const buildSceneCells = ({ cellRoot, rayTargets, states, width, height }) => {
  const random = seedFrom(Math.round(width * 17 + height * 31));
  const cells = buildCells(width, height, random);
  const centerTarget = { x: width * 0.57, y: height * 0.46 };

  cells.forEach((rawCell, index) => {
    const polygon = cleanPolygon(rawCell);

    if (polygon.length < 3 || !isCellNearViewport(polygon, width, height)) {
      return;
    }

    const screenCenter = polygonCenter(polygon);
    const worldCenter = screenToWorld(screenCenter, width, height);
    const centerDistance = Math.hypot(
      (screenCenter.x - centerTarget.x) / width,
      (screenCenter.y - centerTarget.y) / height,
    );
    const screenBias = clamp(1 - centerDistance / 0.54, 0, 1);
    const shrink = CELL_INSET + random() * 0.008;
    const depth = 7 + random() * 14 + screenBias * 5;
    const geometry = new THREE.ExtrudeGeometry(buildCellShape(polygon, worldCenter, width, height, shrink), {
      depth,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 1.2,
      bevelThickness: 1.2,
    });

    geometry.translate(0, 0, -depth / 2);
    geometry.computeVertexNormals();

    const faceColor = graphiteTitaniumColor(random, screenBias);
    const faceHighlightColor = faceColor.clone().lerp(TITANIUM_HIGHLIGHT, 0.42);
    const emissiveColor = new THREE.Color().setHSL(0.52 + random() * 0.08, 0.42, 0.035 + screenBias * 0.035);
    const edgeColor = spectralEdgeColor(random, screenBias);
    const edgeHotColor = edgeColor.clone().lerp(EDGE_HOT_COLOR, 0.36);
    const baseOpacity = 0.085 + random() * 0.025 + screenBias * 0.075;
    const edgeOpacity = 0.18 + random() * 0.06 + screenBias * 0.24;
    const material = new THREE.MeshPhysicalMaterial({
      color: faceColor,
      emissive: emissiveColor,
      emissiveIntensity: 0.16 + screenBias * 0.08,
      metalness: 0.76,
      opacity: baseOpacity,
      roughness: 0.31,
      clearcoat: 0.36,
      clearcoatRoughness: 0.2,
      iridescence: 0.28 + screenBias * 0.12,
      iridescenceIOR: 1.62,
      iridescenceThicknessRange: [160, 520],
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: edgeColor,
      opacity: edgeOpacity,
      transparent: true,
      depthWrite: false,
    });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 18), edgeMaterial);
    const group = new THREE.Group();
    const baseZ = -84 + random() * 132 + screenBias * 52;
    const baseRotation = new THREE.Euler(
      (random() - 0.5) * 0.07,
      (random() - 0.5) * 0.1,
      (random() - 0.5) * 0.018,
    );
    const state = {
      group,
      material,
      edgeMaterial,
      baseOpacity,
      edgeOpacity,
      baseEmissiveIntensity: material.emissiveIntensity,
      basePosition: new THREE.Vector3(worldCenter.x, worldCenter.y, baseZ),
      baseRotation,
      edgeColor,
      edgeHotColor,
      eject: 0,
      ejecting: false,
      faceColor,
      faceHighlightColor,
      hover: 0,
      hoverAmplitude: 7 + random() * 22 + screenBias * 16,
      hoverSpeed: 0.00034 + random() * 0.00034,
      phase: random() * TAU + index * 0.013,
      pushX: (worldCenter.x / Math.max(width, 1)) * (18 + random() * 22),
      pushY: (worldCenter.y / Math.max(height, 1)) * (18 + random() * 22),
      returnAt: 0,
      spinX: (random() - 0.5) * 0.7,
      spinY: (random() - 0.5) * 0.86,
      spinZ: (random() - 0.5) * 0.22,
    };

    mesh.userData.cellState = state;
    group.position.copy(state.basePosition);
    group.rotation.copy(state.baseRotation);
    group.add(mesh);
    group.add(edges);
    cellRoot.add(group);
    rayTargets.push(mesh);
    states.push(state);
  });
};

function LatentGeometry() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      powerPreference: "high-performance",
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 5000);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(0, 0);
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cellRoot = new THREE.Group();
    const states = [];
    const rayTargets = [];
    const ambientLight = new THREE.HemisphereLight(0xdcecff, 0x050505, 1.08);
    const keyLight = new THREE.DirectionalLight(0xffdfb0, 2.05);
    const fillLight = new THREE.PointLight(0x76d7ce, 1.42, 2400, 2);
    const rimLight = new THREE.PointLight(0x8ca2ff, 1.18, 1900, 2);
    let frame = 0;
    let hoveredState = null;
    let pointerActive = false;
    let width = 0;
    let height = 0;

    scene.add(cellRoot);
    scene.add(ambientLight);
    scene.add(keyLight);
    scene.add(fillLight);
    scene.add(rimLight);
    keyLight.position.set(-320, 360, 740);

    const clearCells = () => {
      cellRoot.children.forEach(disposeObject);
      cellRoot.clear();
      states.length = 0;
      rayTargets.length = 0;
      hoveredState = null;
    };

    const setPointerFromEvent = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      pointerActive = true;
    };

    const pickCell = () => {
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(rayTargets, false);
      return intersections[0]?.object.userData.cellState ?? null;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(320, rect.width);
      height = Math.max(420, rect.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const cameraZ = height / 2 / Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));

      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.set(0, 0, cameraZ);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      fillLight.position.set(width * 0.25, -height * 0.26, cameraZ * 0.58);
      rimLight.position.set(-width * 0.34, height * 0.28, cameraZ * 0.52);

      clearCells();
      buildSceneCells({ cellRoot, rayTargets, states, width, height });
    };

    const animate = (time = 0) => {
      const reducedMotion = motionQuery.matches;
      const canHover = hoverQuery.matches;

      if (pointerActive && canHover) {
        hoveredState = pickCell();
      } else {
        hoveredState = null;
      }

      states.forEach((state) => {
        if (state.ejecting && time > state.returnAt) {
          state.ejecting = false;
        }

        const targetHover = state === hoveredState ? 1 : 0;
        const targetEject = state.ejecting ? 1 : 0;
        const idle = reducedMotion ? 0 : Math.sin(time * state.hoverSpeed + state.phase);
        const drift = reducedMotion ? 0 : Math.cos(time * state.hoverSpeed * 0.74 + state.phase * 1.9);

        state.hover += (targetHover - state.hover) * (reducedMotion ? 0.28 : 0.09);
        state.eject += (targetEject - state.eject) * (reducedMotion ? 0.34 : targetEject ? 0.18 : 0.052);

        const hoverLift = state.hover * 42;
        const ejectLift = state.eject * (reducedMotion ? 210 : 540);
        const scale = 1 + state.hover * 0.025 + state.eject * 0.088;

        state.group.position.set(
          state.basePosition.x + state.hover * state.pushX * 0.65,
          state.basePosition.y + state.hover * state.pushY * 0.65,
          state.basePosition.z + idle * state.hoverAmplitude + hoverLift + ejectLift,
        );
        state.group.rotation.set(
          state.baseRotation.x + drift * 0.025 + state.eject * state.spinX,
          state.baseRotation.y + idle * 0.032 + state.eject * state.spinY,
          state.baseRotation.z + state.hover * 0.018 + state.eject * state.spinZ,
        );
        state.group.scale.setScalar(scale);
        const materialShift = clamp(state.hover * 0.3 + state.eject * 0.95, 0, 1);
        const edgeShift = clamp(state.hover * 0.46 + state.eject, 0, 1);

        state.material.color.lerpColors(state.faceColor, state.faceHighlightColor, materialShift);
        state.edgeMaterial.color.lerpColors(state.edgeColor, state.edgeHotColor, edgeShift);
        state.material.emissiveIntensity = state.baseEmissiveIntensity + state.hover * 0.08 + state.eject * 0.24;
        state.material.opacity = clamp(state.baseOpacity + state.hover * 0.11 + state.eject * 0.24, 0, 0.62);
        state.edgeMaterial.opacity = clamp(state.edgeOpacity + state.hover * 0.24 + state.eject * 0.42, 0, 0.88);
      });

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    const handlePointerMove = (event) => {
      setPointerFromEvent(event);
    };

    const handlePointerLeave = () => {
      pointerActive = false;
    };

    const handlePointerDown = (event) => {
      setPointerFromEvent(event);
      const picked = pickCell();

      if (!picked) {
        return;
      }

      picked.ejecting = true;
      picked.returnAt = performance.now() + (motionQuery.matches ? 760 : 1450);
      picked.spinX = (Math.random() - 0.5) * 0.78;
      picked.spinY = (Math.random() - 0.5) * 0.96;
      picked.spinZ = (Math.random() - 0.5) * 0.28;
    };

    const handleMotionChange = () => {
      states.forEach((state) => {
        state.ejecting = false;
        state.eject = 0;
        state.hover = 0;
      });
    };

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    resize();
    animate();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerleave", handlePointerLeave);
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerleave", handlePointerLeave);
      motionQuery.removeEventListener("change", handleMotionChange);
      clearCells();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="latent-geometry" aria-hidden="true" />;
}

export default LatentGeometry;
