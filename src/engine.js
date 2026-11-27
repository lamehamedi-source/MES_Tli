// Procedural, simplified model of a LEAP-style high-bypass turbofan.
// Built in "lathe space": the engine axis is +Y (intake at y=0, exhaust at y≈4),
// radial direction is X/Z. The caller rotates the returned group into place.
import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';

const v2 = (r, y) => new THREE.Vector2(r, y);
const lerp = THREE.MathUtils.lerp;
const deg = THREE.MathUtils.degToRad;

// Piecewise-linear radius lookup over a profile of [r, y] pairs sorted by y.
function radiusAt(profile, y) {
  if (y <= profile[0][1]) return profile[0][0];
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    if (y <= y1) return lerp(r0, r1, (y - y0) / (y1 - y0));
  }
  return profile[profile.length - 1][0];
}

// Core flow path: outer wall (casing) and inner wall (hub), as [r, y].
const CASING = [
  [0.475, 0.85], [0.47, 1.15], [0.345, 1.4], [0.295, 2.15], [0.355, 2.22],
  [0.355, 2.5], [0.33, 2.55], [0.345, 2.75], [0.405, 3.3], [0.395, 3.45],
];
const HUB = [
  [0.27, 0.55], [0.31, 0.75], [0.32, 0.9], [0.33, 1.15], [0.225, 1.4],
  [0.25, 2.15], [0.25, 2.5], [0.26, 2.55], [0.27, 2.75], [0.27, 3.3],
];
const COWL_OUTER = [
  [0.49, 0.85], [0.55, 1.05], [0.585, 1.4], [0.58, 2.2], [0.52, 2.9],
  [0.42, 3.43], [0.40, 3.45],
];
const NACELLE_INNER = [
  [0.93, 0.02], [0.89, 0.12], [0.885, 0.3], [0.9, 0.45], [0.9, 0.95],
  [0.87, 1.8], [0.82, 2.6],
];

// Twisted, cambered blade surface. Local frame: radial = +X, axial = +Y,
// tangential = +Z. Stagger angle beta is measured from the engine axis.
function bladeGeometry({ r0, r1, chord0, chord1, beta0, beta1, camber = 0.08, sweep = 0, lean = 0 }) {
  return new ParametricGeometry((u, v, target) => {
    const c = u - 0.5;
    const r = lerp(r0, r1, v);
    const ch = lerp(chord0, chord1, v);
    const b = lerp(beta0, beta1, v);
    const k = camber * ch * (0.25 - c * c);
    const y = sweep * v + c * ch * -Math.cos(b) + k * Math.sin(b);
    const z = lean * v + c * ch * Math.sin(b) + k * Math.cos(b);
    target.set(r, y, z);
  }, 6, 12);
}

// A ring of identical blades around the axis at axial station y.
function bladeRing(geometry, count, y, material, phase = 0) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeRotationY(phase + (i / count) * Math.PI * 2).setPosition(0, y, 0);
    mesh.setMatrixAt(i, m);
  }
  return mesh;
}

// Rotor or stator stage sized to fit the core flow path at station y.
function coreStage(y, { count, chord, beta, material, camber = 0.1 }) {
  const r0 = radiusAt(HUB, y) + 0.003;
  const r1 = radiusAt(CASING, y) - 0.004;
  const geom = bladeGeometry({
    r0, r1, chord0: chord, chord1: chord * 0.9,
    beta0: beta * 0.8, beta1: beta, camber,
  });
  return bladeRing(geom, count, y, material);
}

function spiralTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = 14;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = t * size;
    const yy = size * (0.15 + 0.85 * Math.pow(t, 0.8));
    i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
  }
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createEngine() {
  const engine = new THREE.Group();
  const lp = new THREE.Group(); // low-pressure spool: fan, booster, LPT
  const hp = new THREE.Group(); // high-pressure spool: HPC, HPT
  engine.add(lp, hp);

  const mat = {
    nacelle: new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide }),
    cowl: new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.3, metalness: 0.6, side: THREE.DoubleSide }),
    hub: new THREE.MeshStandardMaterial({ color: 0x6d737b, roughness: 0.4, metalness: 0.8 }),
    fan: new THREE.MeshStandardMaterial({ color: 0x3a4350, roughness: 0.25, metalness: 0.5, side: THREE.DoubleSide }),
    vane: new THREE.MeshStandardMaterial({ color: 0x9aa1aa, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide }),
    compressor: new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.25, metalness: 0.9, side: THREE.DoubleSide }),
    turbine: new THREE.MeshStandardMaterial({ color: 0x8a6e52, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide }),
    combustor: new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0xff6a1a, emissiveIntensity: 1.6, side: THREE.DoubleSide }),
    spinner: new THREE.MeshStandardMaterial({ map: spiralTexture(), roughness: 0.3, metalness: 0.4 }),
    plug: new THREE.MeshStandardMaterial({ color: 0x7a6650, roughness: 0.5, metalness: 0.7 }),
  };

  // Nacelle: closed profile (inner duct wall, then outer skin back to the lip).
  const nacellePts = [
    ...NACELLE_INNER.map(([r, y]) => v2(r, y)),
    v2(0.835, 2.62), v2(0.95, 2.2), v2(1.04, 1.4), v2(1.08, 0.7),
    v2(1.07, 0.35), v2(1.03, 0.12), v2(0.98, 0.03), v2(0.95, 0.0), v2(0.93, 0.02),
  ];
  engine.add(new THREE.Mesh(new THREE.LatheGeometry(nacellePts, 128), mat.nacelle));

  // Core cowl: flow-path casing (inside) and cowl skin (outside).
  const cowlPts = [
    ...CASING.map(([r, y]) => v2(r, y)),
    ...[...COWL_OUTER].reverse().map(([r, y]) => v2(r, y)),
    v2(0.48, 0.84), v2(0.475, 0.85),
  ];
  engine.add(new THREE.Mesh(new THREE.LatheGeometry(cowlPts, 96), mat.cowl));

  // Inner flow-path hub and exhaust plug.
  const hubPts = [v2(0, 0.55), ...HUB.map(([r, y]) => v2(r, y)),
    v2(0.26, 3.4), v2(0.2, 3.7), v2(0.1, 3.95), v2(0.02, 4.03), v2(0, 4.04)];
  engine.add(new THREE.Mesh(new THREE.LatheGeometry(hubPts, 64), mat.hub));
  const plug = new THREE.Mesh(
    new THREE.LatheGeometry([v2(0.2605, 3.4), v2(0.2005, 3.7), v2(0.1005, 3.95), v2(0.0205, 4.03), v2(0, 4.041)], 64),
    mat.plug,
  );
  engine.add(plug);

  // Spinner (rotates with the fan).
  const spinnerPts = [v2(0, 0.1), v2(0.07, 0.18), v2(0.15, 0.3), v2(0.22, 0.43), v2(0.27, 0.54), v2(0.272, 0.56)];
  lp.add(new THREE.Mesh(new THREE.LatheGeometry(spinnerPts, 64), mat.spinner));

  // Fan: 18 wide-chord, swept blades.
  const fanBlade = bladeGeometry({
    r0: 0.26, r1: 0.885, chord0: 0.3, chord1: 0.46,
    beta0: deg(22), beta1: deg(62), camber: 0.12, sweep: -0.05, lean: 0.04,
  });
  lp.add(bladeRing(fanBlade, 18, 0.66, mat.fan));

  // Outlet guide vanes in the bypass duct.
  const ogvY = 1.3;
  const ogv = bladeGeometry({
    r0: radiusAt(COWL_OUTER, ogvY) - 0.005, r1: radiusAt(NACELLE_INNER, ogvY) + 0.005,
    chord0: 0.14, chord1: 0.16, beta0: deg(-12), beta1: deg(-8), camber: 0.08,
  });
  engine.add(bladeRing(ogv, 40, ogvY, mat.vane));

  // Booster (LP compressor): 3 stages.
  for (let i = 0; i < 3; i++) {
    const y = 0.92 + i * 0.075;
    lp.add(coreStage(y, { count: 52, chord: 0.045, beta: deg(48), material: mat.compressor }));
    engine.add(coreStage(y + 0.037, { count: 60, chord: 0.035, beta: deg(-22), material: mat.vane }));
  }

  // HP compressor: 10 stages.
  for (let i = 0; i < 10; i++) {
    const y = 1.44 + i * 0.07;
    hp.add(coreStage(y, { count: 40 + i * 3, chord: 0.032 - i * 0.001, beta: deg(50), material: mat.compressor }));
    engine.add(coreStage(y + 0.035, { count: 48 + i * 3, chord: 0.026 - i * 0.001, beta: deg(-25), material: mat.vane }));
  }

  // Combustor: glowing annulus.
  const combustor = new THREE.LatheGeometry(
    [v2(0.268, 2.2), v2(0.34, 2.2), v2(0.345, 2.35), v2(0.335, 2.5), v2(0.27, 2.5), v2(0.262, 2.35), v2(0.268, 2.2)], 64,
  );
  engine.add(new THREE.Mesh(combustor, mat.combustor));

  // HP turbine: 2 stages.
  for (let i = 0; i < 2; i++) {
    const y = 2.56 + i * 0.09;
    engine.add(coreStage(y - 0.03, { count: 38, chord: 0.04, beta: deg(-40), material: mat.turbine }));
    hp.add(coreStage(y, { count: 64, chord: 0.035, beta: deg(55), material: mat.turbine }));
  }

  // LP turbine: 7 stages.
  for (let i = 0; i < 7; i++) {
    const y = 2.8 + i * 0.07;
    engine.add(coreStage(y, { count: 70, chord: 0.03, beta: deg(-35), material: mat.turbine }));
    lp.add(coreStage(y + 0.035, { count: 80, chord: 0.03, beta: deg(50), material: mat.turbine }));
  }

  engine.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return {
    group: engine,
    lp,
    hp,
    // Shells that get sliced open in cutaway mode.
    shellMaterials: [mat.nacelle, mat.cowl],
  };
}
