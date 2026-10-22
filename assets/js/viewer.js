/* 3D viewer: one real TEMPO scan over Austin, with an illustrative aerosol layer.
   Exposes window.VIZ (applyScene etc.) for assets/js/sections.js. Data come from data/tempo-data.js. */
(function () {
"use strict";
if (!window.THREE || !THREE.OrbitControls || !THREE.CSS2DRenderer || !window.TEMPO_DATA) {
  document.getElementById("viewport").innerHTML = '<p class="err">The 3D library did not load. Reload the page to try again.</p>';
  return;
}
const DATA = window.TEMPO_DATA;  // set by data/tempo-data.js
const META = DATA.meta, PIX = DATA.pixels, OZ = DATA.ozone;

// ---------- helpers ----------
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
function sci(v, d = 2) {
  if (v === null || v === undefined || !isFinite(v)) return "n/a";
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e);
  return `${m.toFixed(d - 1)} × 10${String(e).split("").map(c => SUP[c]).join("")}`;
}
const fmt = (v, d = 1) => (v === null || !isFinite(v)) ? "n/a" : v.toFixed(d);
const pct = (arr, p) => { const a = arr.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return 0; const i = (a.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const median = arr => pct(arr, 0.5);
const QF = { 0: "normal", 1: "suspicious", 2: "bad" };
const localTime = t => {  // t: seconds since 1980-01-06 (GPS epoch); leap seconds ignored (~18 s)
  const d = new Date(Date.UTC(1980, 0, 6) + t * 1000);
  return d.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", second: "2-digit" }) + " CDT";
};

// Color maps (perceptually ordered)
const MAPS = {
  viridis: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
  plasma: ["#0d0887", "#7e03a8", "#cc4778", "#f89540", "#f0f921"],
  cloud: ["#2c3e50", "#5d7286", "#93a6b8", "#c9d6e2", "#ffffff"],
  gap: ["#2f9e73", "#2f9e73", "#2f9e73", "#aab4bf", "#aab4bf"],
};
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
function cmap(name, t) {
  const s = MAPS[name].map(hex); t = Math.min(1, Math.max(0, isFinite(t) ? t : 0));
  const x = t * (s.length - 1), i = Math.min(s.length - 2, Math.floor(x)), f = x - i;
  return [0, 1, 2].map(k => s[i][k] + (s[i + 1][k] - s[i][k]) * f);
}
const gradientCss = name => `linear-gradient(90deg, ${MAPS[name].join(", ")})`;

// ---------- geography: km east (x) / north (-z) of the area's center ----------
// Scene origin: between St. Edward's University and downtown Austin. The area shown is a radius around it.
const LAT0 = 30.25, LON0 = -97.75;
const KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KY = 110.574;
const px = lon => (lon - LON0) * KX, pz = lat => -(lat - LAT0) * KY;
const FULL_R = Math.max(...PIX.map(p => Math.hypot((p.lon - LON0) * KX, (p.lat - LAT0) * KY)));
let W = 50, D = 50, VPIX = PIX, VOZ = OZ;  // set by setRadius()
function setRadius(r) {
  state.radius = r; W = D = 2 * r;
  const inR = (la, lo) => Math.hypot(px(lo), pz(la)) <= r;
  VPIX = PIX.filter(p => inR(p.lat, p.lon));
  VOZ = OZ.filter(o => inR(o.c.reduce((a, c) => a + c[0], 0) / 4, o.c.reduce((a, c) => a + c[1], 0) / 4));
}

// ---------- variables for the ground map ----------
const VARS = {
  hcho: { label: "Formaldehyde column", unit: "molecules/cm²", get: p => p.hcho, map: "viridis", sci: true, clampNote: "Negative values (noise) are drawn at the low end." },
  no2_trop: { label: "NO₂ column, troposphere", unit: "molecules/cm²", get: p => p.no2_trop, map: "viridis", sci: true },
  no2_strat: { label: "NO₂ column, stratosphere", unit: "molecules/cm²", get: p => p.no2_strat, map: "viridis", sci: true, fixedLo: true },
  cloud: { label: "Effective cloud fraction", unit: "0 = clear, 1 = overcast", get: p => p.cloud, map: "cloud", range: [0, 1] },
  pbl: { label: "Boundary-layer height", unit: "km", get: p => p.pbl / 1000, map: "viridis" },
  aodgap: { label: "Where clouds would block AOD", unit: "", get: p => (p.cloud >= 0.5 ? 1 : 0), map: "gap", range: [0, 1],
    cats: [["#2f9e73", "AOD could be retrieved (cloud fraction below 0.5)"], ["#aab4bf", "Likely blocked by cloud (0.5 or more)"]],
    clampNote: "Illustrative cutoff; the real products use a cloud mask." },
};
for (const v of Object.values(VARS)) {
  if (!v.range) {
    const vals = PIX.map(v.get);
    v.range = [Math.max(0, pct(vals, 0.02)), pct(vals, 0.98)];
    if (v.fixedLo) v.range = [pct(vals, 0.02), pct(vals, 0.98)];
  }
}
const OZ_LOG = [-1.5, 1.35];  // log10 DU/km, about 0.03 to 22

// ---------- three.js setup ----------
const viewport = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
viewport.prepend(renderer.domElement);
const labelRenderer = new THREE.CSS2DRenderer({ element: document.getElementById("labels") });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 5000);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
controls.maxPolarAngle = Math.PI * 0.499;
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const sunLight = new THREE.DirectionalLight(0xffffff, 0.45); sunLight.position.set(-80, 120, 60); scene.add(sunLight);

const state = { ground: "cloud", bars: false, ozone: false, cut: false, ozMin: 0, ozMax: 66, ozOpacity: 1, pbl: true, rays: true, vex: 5, about: "intro", city: true, aerBox: false,
  aer: true, aerType: "smoke", aod: 0.8, alh: 0.9, thick: 1.2, radius: 25, tgrid: false, abi: false, plane: false, lidar: false, fp: "none", scan: false, sunOv: null };
setRadius(state.radius);
const groups = {};
function setGroup(name, obj) {
  if (groups[name]) { scene.remove(groups[name]); groups[name].traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); if (o.element && o.element.remove) o.element.remove(); }); }
  groups[name] = obj; if (obj) scene.add(obj);
}
function lod(obj, kind) { obj.userData.lod = kind; obj.visible = false; return obj; }
function label(text, cls, pos) {
  const el = document.createElement("div"); el.className = "lbl " + (cls || ""); el.textContent = text;
  const o = new THREE.CSS2DObject(el); o.position.copy(pos); return o;
}

// Build prisms (columns with a top and four sides) as one mesh; remember which item owns each triangle.
function prisms(items, cornersOf, bottomOf, topOf, colorOf, matOpts, sides = true) {
  const pos = [], col = [], owner = [];
  items.forEach((it, idx) => {
    const c = cornersOf(it); if (!c) return;
    const b = bottomOf(it), t = topOf(it), rgb = colorOf(it); if (!isFinite(b) || !isFinite(t) || !rgb) return;
    const P = c.map(([la, lo]) => [px(lo), pz(la)]);
    const tri = (a, bb, cc) => { pos.push(...a, ...bb, ...cc); for (let k = 0; k < 3; k++) col.push(...rgb); owner.push(idx); };
    const T = P.map(([x, z]) => [x, t, z]), B = P.map(([x, z]) => [x, b, z]);
    tri(T[0], T[1], T[2]); tri(T[0], T[2], T[3]);
    if (sides && t - b > 1e-3) for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; tri(B[k], B[n], T[n]); tri(B[k], T[n], T[k]); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true, side: THREE.DoubleSide }, matOpts || {})));
  m.userData.owner = owner; m.userData.items = items;
  return m;
}

// ---------- scene pieces ----------
function buildGround() {
  const grp = new THREE.Group();
  const pad = Math.max(1.5, W * 0.06);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * pad, D + 2 * pad), new THREE.MeshBasicMaterial({ color: new THREE.Color(css("--ground")) }));
  plane.rotation.x = -Math.PI / 2; plane.position.y = -0.02; grp.add(plane);
  const gridMat = new THREE.LineBasicMaterial({ color: new THREE.Color(css("--grid")) });
  const xL = -W / 2 - pad, xR = W / 2 + pad, zN = -D / 2 - pad, zS = D / 2 + pad, off = Math.max(1.5, W * 0.04);
  const span = W / KX, step = span > 0.7 ? 0.25 : span > 0.3 ? 0.1 : 0.05;
  const laMin = LAT0 + zS / -KY, laMax = LAT0 - zN / KY, loMin = LON0 + xL / KX, loMax = LON0 + xR / KX;
  for (let la = Math.ceil(laMin / step) * step; la <= laMax; la += step) {
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xL, 0, pz(la)), new THREE.Vector3(xR, 0, pz(la))]), gridMat));
    grp.add(label(la.toFixed(2) + "°N", "", new THREE.Vector3(xL - off, 0, pz(la))));
  }
  for (let lo = Math.ceil(loMin / step) * step; lo <= loMax; lo += step) {
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px(lo), 0, zN), new THREE.Vector3(px(lo), 0, zS)]), gridMat));
    grp.add(label(Math.abs(lo).toFixed(2) + "°W", "", new THREE.Vector3(px(lo), 0, zS + off)));
  }
  grp.add(label("N ↑", "strong", new THREE.Vector3(0, 0, zN - off)));
  // scale bar along the south edge
  const sbKm = W > 60 ? 20 : W > 25 ? 10 : W > 10 ? 5 : 2;
  const sb = [new THREE.Vector3(xL, 0.05, zS + 2.2 * off), new THREE.Vector3(xL + sbKm, 0.05, zS + 2.2 * off)];
  grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(sb), new THREE.LineBasicMaterial({ color: new THREE.Color(css("--fg")) })));
  grp.add(label(sbKm + " km", "", new THREE.Vector3(xL + sbKm / 2, 0, zS + 3 * off)));
  // Pandora site
  const s = META.pandora, sx = px(s.lon), sz = pz(s.lat);
  // The marker is a symbol, not a to-scale object: it is sized from the camera distance each frame
  // (see updateMarker), small next to downtown's towers up close and still findable from far away.
  const marker = new THREE.Group(); marker.position.set(sx, 0, sz);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(css("--fg")) }));
  pin.position.y = 0.5; marker.add(pin);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(css("--sun")) }));
  knob.position.y = 1.15; marker.add(knob);
  [pin, knob].forEach(o => { o.userData.info = { kind: "pandora" }; });
  marker.userData.isPandoraMarker = true;
  grp.add(marker);
  return grp;
}

// Height (km) of the tallest thing currently shown, rounded up to a tidy axis top.
function contentTop() {
  let top = 0.5;
  if (state.ozone) top = Math.max(top, state.ozMax);
  if (state.aer) top = Math.max(top, aerBounds()[1]);
  if (state.pbl) top = Math.max(top, M.pblMax);
  if (state.city) top = Math.max(top, M.tallest);
  if (state.plane) top = Math.max(top, PLANE_TOP);
  const want = top * 1.2;
  return [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 70].find(t => t >= want) || 70;
}
function tickStep(top) { return [0.25, 0.5, 1, 2, 5, 10, 20].find(st => top / st <= 6) || 20; }
function buildAxis() {
  const grp = new THREE.Group(), v = state.vex, topKm = contentTop();
  const edge = Math.max(1.5, W * 0.06), x = -W / 2 - edge, z = D / 2 + edge, top = topKm * v, tick = Math.max(0.6, W * 0.02);
  const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(css("--muted")) });
  grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, z), new THREE.Vector3(x, top, z)]), mat));
  const st = tickStep(topKm);
  for (let km = 0; km <= topKm + 1e-9; km += st) {
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, km * v, z), new THREE.Vector3(x + tick, km * v, z)]), mat));
    grp.add(label(+km.toFixed(2) + " km", "", new THREE.Vector3(x - 2.5 * tick, km * v, z)));
  }
  grp.add(label("altitude" + (v > 1 ? ` (heights ×${v})` : ""), "", new THREE.Vector3(x - 2.5 * tick, top + Math.max(1, top * 0.06), z)));
  return grp;
}

function buildSurface() {
  if (state.ground === "off") return null;
  const v = VARS[state.ground], [lo, hi] = v.range;
  const norm = p => (v.get(p) - lo) / (hi - lo);
  const BAR = 14;  // km of bar height for the top of the color range
  const top = state.bars ? (p => 0.05 + Math.max(0, Math.min(1.15, norm(p))) * BAR) : (() => 0.06);
  const m = prisms(VPIX, p => p.c, () => 0.03, top, p => { const x = v.get(p); return x === null ? null : cmap(v.map, norm(p)); }, {}, state.bars);
  m.userData.kind = "surface";
  return m;
}

function buildOzone() {
  if (!state.ozone) return null;
  const items = [];
  VOZ.forEach((o, i) => { if (state.cut && o.c.reduce((a, c) => a + c[0], 0) / 4 < LAT0) return; o.layers.forEach(([b, t, du], k) => { if (t > state.ozMin && b < state.ozMax) items.push({ o, i, k, b, t, du, dens: du / (t - b) }); }); });
  const op = state.ozOpacity;
  const m = prisms(items, it => it.o.c, it => Math.max(it.b, state.ozMin) * state.vex, it => Math.min(it.t, state.ozMax) * state.vex,
    it => cmap("plasma", (Math.log10(Math.max(it.dens, 0.03)) - OZ_LOG[0]) / (OZ_LOG[1] - OZ_LOG[0])),
    { transparent: op < 0.999, opacity: op, depthWrite: true });
  m.userData.kind = "ozone";
  return m;
}

function buildPbl() {
  if (!state.pbl) return null;
  const c = hex(css("--pbl"));
  const m = prisms(VPIX, p => p.c, p => p.pbl / 1000 * state.vex, p => p.pbl / 1000 * state.vex, () => c,
    { transparent: true, opacity: 0.26, depthWrite: false }, false);
  m.userData.kind = "pbl"; m.renderOrder = 2;
  return m;
}

const SCAN_AZ = 0, SCAN_ELEV = [1, 2, 4, 8, 15, 30, 90];   // sky scans: fixed azimuth (north, per the L2 files), low-to-high elevation angles
function dirFrom(azDeg, zenDeg) {  // azimuth clockwise from north; returns a unit vector in scene axes (before height stretch)
  const az = azDeg * Math.PI / 180, el = (90 - zenDeg) * Math.PI / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}
function buildRays() {
  if (!state.rays) return null;
  const grp = new THREE.Group(), a = state.sunOv ? { ...META.angles, ...state.sunOv } : META.angles, s = META.pandora;
  const o = new THREE.Vector3(px(s.lon), 0.05, pz(s.lat));
  const topKm = contentTop();
  // each line rises to the top of the altitude axis (capped at 45 km sideways), so it never stretches the scene
  const ray = (dir, _len, color, text, cls) => {
    const d = dir.clone(); const len = Math.min(topKm / d.y, 0.9 * W / 2 / Math.hypot(d.x, d.z));
    const end = o.clone().add(new THREE.Vector3(d.x * len, d.y * len * state.vex, d.z * len));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([o, end]), new THREE.LineBasicMaterial({ color: new THREE.Color(color) }));
    grp.add(line);
    const head = new THREE.Mesh(new THREE.ConeGeometry(Math.max(0.12, W * 0.01), Math.max(0.36, W * 0.03), 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }));
    head.position.copy(end); head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(o).normalize()); grp.add(head);
  };
  const sunAz = (a.saa + 360) % 360;
  const sunTxt = `Sun ${fmt(90 - a.sza)}° up, ${compass(sunAz)}` + (state.aer ? ` · ${pctTxt(Math.exp(-state.aod / Math.cos(a.sza * Math.PI / 180)))} of direct light gets through` : "");
  if (a.sza < 89.5) ray(dirFrom(sunAz, a.sza), 55, css("--sun"), sunTxt, "sun");
  if (state.scan) SCAN_ELEV.forEach(el => ray(dirFrom(SCAN_AZ, 90 - el), 0, css("--laser"), "", "scan"));
  const satAz = (a.vaa + 360) % 360;
  ray(dirFrom(satAz, a.vza), 75, css("--sat"), `TEMPO: ${fmt(90 - a.vza, 0)}° up, ${compass(satAz)}, ~36,000 km away`, "sat");
  return grp;
}
function pctTxt(f) { const v = 100 * f; return v < 1 ? (v < 0.1 ? "under 0.1%" : v.toFixed(1) + "%") : Math.round(v) + "%"; }
function compass(az) { return ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(az / 22.5) % 16]; }

const AER_PRESETS = {
  near: { type: "smoke", aod: 0.8, alh: 0.9, thick: 1.2 },
  aloft: { type: "smoke", aod: 0.6, alh: 4.5, thick: 1.5 },
  dust: { type: "dust", aod: 0.7, alh: 3.4, thick: 2.0 },
  haze: { type: "smoke", aod: 0.12, alh: 1.0, thick: 1.0 },
};
function aerBounds() {
  const lo = Math.max(0, state.alh - state.thick / 2);
  return [lo, lo + state.thick];
}
let HAZE_TEX = null;
function hazeTexture() {
  if (HAZE_TEX) return HAZE_TEX;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.45, "rgba(255,255,255,.55)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); HAZE_TEX = new THREE.CanvasTexture(c); return HAZE_TEX;
}
function buildHaze(lo, hi, v, color) {
  // soft puffs at random places in the layer; a slowly varying "density" field makes some patches thicker than others
  const n = Math.max(40, Math.round(420 * VPIX.length / PIX.length)), pos = [], col = [];
  let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dens = (x, z) => 0.5 + 0.28 * Math.sin(x / 6.5 + 1.3) * Math.cos(z / 8.2 - 0.4) + 0.22 * Math.sin((x + z) / 4.1);
  const base = Math.min(0.5, 0.18 + 1.1 * state.aod);
  for (let i = 0; i < n; i++) {
    const p = VPIX[Math.floor(rnd() * VPIX.length)], x = px(p.lon) + (rnd() - 0.5) * 4, z = pz(p.lat) + (rnd() - 0.5) * 2;
    pos.push(x, (lo + rnd() * (hi - lo)) * v, z);
    col.push(color.r, color.g, color.b, base * Math.max(0.08, dens(x, z)) * (0.6 + 0.4 * rnd()));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: Math.max(2.5, W * 0.16), map: hazeTexture(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }));
  pts.renderOrder = 5; return pts;
}
function buildAerosol() {
  if (!state.aer) return null;
  const grp = new THREE.Group(), v = state.vex, color = new THREE.Color(css(state.aerType === "dust" ? "--dust" : "--smoke"));
  const [lo, hi] = aerBounds(), xs = VPIX.map(p => px(p.lon)), zs = VPIX.map(p => pz(p.lat));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const retrievable = state.aod >= 0.2;
  if (state.aerBox) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, (hi - lo) * v, z1 - z0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: Math.min(0.6, 0.08 + 0.45 * (1 - Math.exp(-state.aod))), depthWrite: false }));
    slab.position.set((x0 + x1) / 2, (lo + hi) / 2 * v, (z0 + z1) / 2); slab.renderOrder = 3; grp.add(slab);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry),
      retrievable ? new THREE.LineBasicMaterial({ color }) : new THREE.LineDashedMaterial({ color, dashSize: 2, gapSize: 2 }));
    edges.position.copy(slab.position); if (!retrievable) edges.computeLineDistances(); grp.add(edges);
  }
  if (state.aod < 0.3) { grp.add(buildHaze(lo, hi, v, color)); return grp; }
  // particles: random positions over real pixel centers, count grows with AOD
  // particles: small shaded spheres at random positions over the real pixel area; more of them as AOD rises
  // same particle density whatever the area: scale the count by the share of pixels shown
  const n = Math.max(50, Math.round((400 + 3200 * Math.min(state.aod, 2) / 2) * VPIX.length / PIX.length));
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshLambertMaterial({ color }), n);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const p = VPIX[Math.floor(rnd() * VPIX.length)];
    mtx.makeTranslation(px(p.lon) + (rnd() - 0.5) * 4, (lo + rnd() * (hi - lo)) * v, pz(p.lat) + (rnd() - 0.5) * 2);
    balls.setMatrixAt(i, mtx);
  }
  balls.instanceMatrix.needsUpdate = true; grp.add(balls);
  return grp;
}

const CITY = DATA.city;
function extrude(g, h, mat) {
  const pts = g.map(([la, lo]) => new THREE.Vector2(px(lo), -pz(la)));
  if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: Math.max(h, 0.002), bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}
function buildCity() {
  if (!state.city) return null;
  const grp = new THREE.Group(), v = state.vex;
  const pd = Math.max(1.5, W * 0.06), lim = [-W / 2 - pd, W / 2 + pd, -D / 2 - pd, D / 2 + pd];
  const inBox = (x, z) => x >= lim[0] && x <= lim[1] && z >= lim[2] && z <= lim[3];
  // river: a ribbon (width exaggerated so it shows at this scale) plus a centerline
  const waterMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(css("--water")), side: THREE.DoubleSide });
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(css("--water")) });
  const half = 0.18, y = 0.1, pos = [];
  CITY.river.forEach(w => {
    const P = w.map(([la, lo]) => [px(lo), pz(la)]);
    const N = P.map((_, i) => {  // averaged normal at each vertex, so segments join without gaps
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [-dz / L * half, dx / L * half];
    });
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, z0] = P[i], [x1, z1] = P[i + 1];
      if (!inBox(x0, z0) && !inBox(x1, z1)) continue;
      const [n0x, n0z] = N[i], [n1x, n1z] = N[i + 1];
      pos.push(x0 + n0x, y, z0 + n0z, x0 - n0x, y, z0 - n0z, x1 + n1x, y, z1 + n1z, x1 + n1x, y, z1 + n1z, x0 - n0x, y, z0 - n0z, x1 - n1x, y, z1 - n1z);
    }
    const seg = P.filter(([x, z]) => inBox(x, z)).map(([x, z]) => new THREE.Vector3(x, y + 0.01, z));
    if (seg.length > 1) grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(seg), lineMat));
  });
  const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  grp.add(new THREE.Mesh(rg, waterMat));
  // downtown towers (heights stretched like everything else)
  const bMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(css("--building")) });
  const eMat = new THREE.LineBasicMaterial({ color: new THREE.Color(css("--building-edge")), transparent: true, opacity: 0.6 });
  const pick = [];
  CITY.downtown.forEach(b => {
    const m = extrude(b.g, b.h / 1000 * v, bMat); m.position.y = 0.08; m.userData.info = { kind: "building", n: b.n, h: b.h }; grp.add(m); pick.push(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), eMat); e.position.y = 0.08; grp.add(e);
  });
  // St. Edward's: campus outline and buildings
  const cMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(css("--campus")) });
  const campus = CITY.campus.g.map(([la, lo]) => new THREE.Vector3(px(lo), 0.12, pz(la)));
  grp.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(campus), new THREE.LineBasicMaterial({ color: new THREE.Color(css("--campus")) })));
  const fill = extrude(CITY.campus.g, 0.001, new THREE.MeshBasicMaterial({ color: new THREE.Color(css("--campus")), transparent: true, opacity: 0.25, depthWrite: false }));
  fill.position.y = 0.09; grp.add(fill);
  CITY.campus_buildings.forEach(b => {
    const h = b.h || 9;
    const m = extrude(b.g, h / 1000 * v, cMat); m.position.y = 0.08; m.userData.info = { kind: "campus", n: b.n, h: b.h }; grp.add(m); pick.push(m);
  });
  const cen = g => [g.reduce((a, p) => a + p[0], 0) / g.length, g.reduce((a, p) => a + p[1], 0) / g.length];
  const [cla, clo] = cen(CITY.campus.g);

  grp.userData.pick = pick;
  return grp;
}

const PLANE_TOP = 5.5, PLANE_BOT = 0.3;
// A research aircraft flying a descending spiral over the Pandora site, sampling the air it flies through.
function buildPlane() {
  if (!state.plane) return null;
  const grp = new THREE.Group(), v = state.vex, s0 = META.pandora, cx = px(s0.lon), cz = pz(s0.lat);
  const R = Math.max(2.5, Math.min(3.5, W * 0.1)), turns = 5, N = 360, [lo, hi] = aerBounds();
  const clean = new THREE.Color(css("--clean")), aer = new THREE.Color(css(state.aerType === "dust" ? "--dust" : "--smoke"));
  const conc = h => (state.aer && h >= lo && h <= hi) ? Math.min(1, 0.4 + 0.6 * state.aod / 1.2) : 0;
  const P = i => { const s = i / (N - 1), a = turns * 2 * Math.PI * s, h = PLANE_TOP - (PLANE_TOP - PLANE_BOT) * s; return [cx + R * Math.cos(a), h, cz + R * Math.sin(a)]; };
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(Math.max(0.16, W * 0.005), 8, 6), new THREE.MeshBasicMaterial(), N);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < N; i++) { const [x, h, z] = P(i); m4.makeTranslation(x, h * v, z); dots.setMatrixAt(i, m4); col.copy(clean).lerp(aer, conc(h)); dots.setColorAt(i, col); }
  dots.instanceMatrix.needsUpdate = true; dots.instanceColor.needsUpdate = true; grp.add(dots);
  const pts = []; for (let i = 0; i < N; i++) { const [x, h, z] = P(i); pts.push(new THREE.Vector3(x, h * v, z)); }
  grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(css("--muted")), transparent: true, opacity: 0.3 })));
  // symbolic aircraft (not to scale), nose along +x
  const L = Math.max(1.3, W * 0.045), pm = new THREE.MeshLambertMaterial({ color: new THREE.Color(css("--plane")) });
  const plane = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.06, L * 0.045, L, 10), pm); body.rotation.z = Math.PI / 2; plane.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(L * 0.22, L * 0.02, L * 0.95), pm); wing.position.x = L * 0.05; plane.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(L * 0.12, L * 0.02, L * 0.36), pm); tail.position.x = -L * 0.45; plane.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.14, L * 0.2, L * 0.02), pm); fin.position.set(-L * 0.45, L * 0.1, 0); plane.add(fin);
  grp.add(plane);
  const DUR = 12000, HOLD = 2500;
  grp.userData.tick = now => {
    const f = reduceMotion.matches ? 1 : Math.min(1, (now % (DUR + HOLD)) / DUR), k = Math.round(f * (N - 1));
    dots.count = k + 1;
    const [x, h, z] = P(k), [x2, , z2] = P(Math.min(N - 1, k + 1)), [x0, , z0] = P(Math.max(0, k - 1));
    plane.position.set(x, h * v + L * 0.08, z); plane.rotation.set(0, Math.atan2(-(z2 - z0), x2 - x0), -0.25);
  };
  return grp;
}
// A space lidar (like CALIPSO) passing over: it fires its own laser and records a vertical "curtain" of returns.
function buildLidar() {
  if (!state.lidar) return null;
  const grp = new THREE.Group(), v = state.vex, topKm = contentTop(), [lo, hi] = aerBounds();
  const ang = -13 * Math.PI / 180, d = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)), c0 = new THREE.Vector3(-W * 0.14, 0, 0);
  const Lh = 0.9 * W / 2, dk = Math.max(0.4, W / 70), cols = Math.round(2 * Lh / dk), dh = topKm / 36, rows = Math.ceil(topKm / dh);
  const pos = [], colr = []; let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P = (a, h) => c0.clone().addScaledVector(d, a).setY(h * v);
  for (let c = 0; c < cols; c++) {
    const a0 = -Lh + c * dk, a1 = a0 + dk;
    for (let r = 0; r < rows; r++) {
      const h0 = r * dh, h1 = h0 + dh, hm = (h0 + h1) / 2;
      let val, al;
      if (r === 0) { val = 0.97; al = 0.95; }
      else if (state.aer && hm >= lo && hm <= hi) { val = Math.min(0.92, 0.45 + 0.35 * Math.min(1, state.aod / 1.2) + 0.12 * rnd()); al = 0.85; }
      else { val = 0.06 + 0.08 * rnd() * Math.max(0, 1 - hm / 10); al = 0.1; }
      const [cr, cg, cb] = cmap("viridis", val), q = [P(a0, h0), P(a1, h0), P(a1, h1), P(a0, h1)];
      [[0, 1, 2], [0, 2, 3]].forEach(t => t.forEach(i => { pos.push(q[i].x, q[i].y, q[i].z); colr.push(cr, cg, cb, al); }));
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(colr, 4));
  const curtain = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  curtain.renderOrder = 4; grp.add(curtain);
  const lc = new THREE.Color(css("--laser"));
  const track = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(-Lh, 0.03), P(Lh, 0.03)]), new THREE.LineDashedMaterial({ color: lc, dashSize: 1, gapSize: 0.8 }));
  track.computeLineDistances(); grp.add(track);
  const satH = topKm * 1.15 * v, S = Math.max(0.8, W * 0.035), sm = new THREE.MeshLambertMaterial({ color: new THREE.Color(css("--plane")) });
  const sat = new THREE.Group(); sat.add(new THREE.Mesh(new THREE.BoxGeometry(S * 0.5, S * 0.5, S * 0.5), sm));
  const panel = new THREE.Mesh(new THREE.BoxGeometry(S * 2.2, S * 0.04, S * 0.6), new THREE.MeshLambertMaterial({ color: new THREE.Color(css("--water")) })); sat.add(panel);
  grp.add(sat);
  const beamG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const beam = new THREE.Line(beamG, new THREE.LineBasicMaterial({ color: lc })); grp.add(beam);
  const per = rows * 6, DUR = 7000, HOLD = 2500;
  grp.userData.tick = now => {
    const f = reduceMotion.matches ? 1 : Math.min(1, (now % (DUR + HOLD)) / DUR), n = Math.round(f * cols);
    g.setDrawRange(0, n * per);
    const p = P(-Lh + f * 2 * Lh, 0); sat.position.set(p.x, satH, p.z); sat.rotation.y = -ang;
    const a = beamG.attributes.position; a.setXYZ(0, p.x, satH, p.z); a.setXYZ(1, p.x, 0, p.z); a.needsUpdate = true;
    beam.visible = f < 1;
  };
  return grp;
}
const FP = { omi: [24, 13, "OMI pixels, about 13 × 24 km"], modis: [1, 1, "MODIS pixels, 1 km"], viirs: [0.375, 0.375, "VIIRS imagery pixels, 375 m"] };
function buildFp() {
  const f = FP[state.fp]; if (!f) return null;
  const [ex, nz] = f, r = W / 2, y = 0.22, pts = [];
  for (let x = -Math.floor(r / ex) * ex; x <= r + 1e-6; x += ex) pts.push(x, y, -r, x, y, r);
  for (let z = -Math.floor(r / nz) * nz; z <= r + 1e-6; z += nz) pts.push(-r, y, z, r, y, z);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(css("--fp")) }));
}
function buildTgrid() {
  if (!state.tgrid) return null;
  const pts = [];
  VPIX.forEach(p => { const c = p.c.map(([la, lo]) => [px(lo), pz(la)]); for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; pts.push(a[0], 0.14, a[1], b[0], 0.14, b[1]); } });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(css("--sat")) }));
}
function buildAbi() {
  if (!state.abi) return null;
  // ABI's aerosol products sit on 2 km cells at the satellite's nadir (larger over Texas); drawn as 2 km squares for scale
  const pts = [], r = W / 2, y = 0.18, step = 2, n = Math.floor(r / step);
  for (let i = -n; i <= n; i++) { const c = i * step; pts.push(-n * step, y, c, n * step, y, c, c, y, -n * step, c, y, n * step); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(css("--abi")), transparent: true, opacity: 0.85 }));
}

function rebuild(which) {
  const all = !which;
  if (all || which.includes("ground")) setGroup("ground", buildGround());
  if (all || which.includes("axis")) setGroup("axis", buildAxis());
  if (all || which.includes("surface")) setGroup("surface", buildSurface());
  if (all || which.includes("ozone")) setGroup("ozone", buildOzone());
  if (all || which.includes("pbl")) setGroup("pbl", buildPbl());
  if (all || which.includes("rays")) setGroup("rays", buildRays());
  if (all || which.includes("aerosol")) setGroup("aerosol", buildAerosol());
  if (all || which.includes("city")) setGroup("city", buildCity());
  if (all || which.includes("tgrid")) setGroup("tgrid", buildTgrid());
  if (all || which.includes("abi")) setGroup("abi", buildAbi());
  if (all || which.includes("fp")) setGroup("fp", buildFp());
  setGroup("plane", buildPlane()); setGroup("lidar", buildLidar());
  if (!all && !which.includes("axis")) setGroup("axis", buildAxis());
  if (!all && !which.includes("rays")) setGroup("rays", buildRays());
  renderLegend(); renderReadout();
}

// ---------- legend ----------
function renderLegend() {
  const el = document.getElementById("legend"); const parts = [];
  if (state.ground !== "off" && VARS[state.ground].cats) {
    const v = VARS[state.ground];
    parts.push(`<div class="legend-item"><div class="legend-title">${v.label}</div>${v.cats.map(([c, t]) => `<div class="legend-cat"><span class="swatch" style="background:${c}"></span>${t}</div>`).join("")}<div class="legend-note">${v.clampNote}</div></div>`);
  } else if (state.ground !== "off" && state.ground !== "cloud") {
    const v = VARS[state.ground], [lo, hi] = v.range, f = x => v.sci ? sci(x) : fmt(x, v.range[1] <= 1 ? 1 : 1);
    parts.push(`<div class="legend-item"><div class="legend-title">${v.label}${state.bars ? " (bar height too)" : ""}</div>
      <div class="legend-bar" style="background:${gradientCss(v.map)}"></div>
      <div class="legend-ticks"><span>${f(lo)}</span><span>${f((lo + hi) / 2)}</span><span>${f(hi)}</span></div>
      <div class="legend-note">${v.unit}${v.clampNote ? ". " + v.clampNote : ""}${state.bars ? " Bar height shows the value, not altitude." : ""}</div></div>`);
  }
  if (state.lidar) parts.push(`<div class="legend-item"><div class="legend-title">Lidar return strength</div><div class="legend-bar" style="background:${gradientCss("viridis")}"></div><div class="legend-ticks"><span>weak: clear air</span><span>strong: aerosol, ground</span></div></div>`);
  if (state.ozone) {
    parts.push(`<div class="legend-item"><div class="legend-title">Ozone density</div>
      <div class="legend-bar" style="background:${gradientCss("plasma")}"></div>
      <div class="legend-ticks"><span>0.03</span><span>0.3</span><span>3</span><span>20</span></div>
      <div class="legend-note">Dobson Units per km of height (log scale)</div></div>`);
  }
  const keys = [];
  if (state.tgrid) keys.push(`<div class="legend-key"><i style="border-color:${css("--sat")}"></i>TEMPO pixel edges (about ${NS} × ${EW} km here)</div>`);
  if (state.abi) keys.push(`<div class="legend-key"><i style="border-color:${css("--abi")}"></i>2 km squares, ABI's finest aerosol grid spacing</div>`);
  if (state.fp !== "none" && FP[state.fp]) keys.push(`<div class="legend-key"><i style="border-color:${css("--fp")}"></i>${FP[state.fp][2]}</div>`);
  if (false && state.plane) keys.push(`<div class="legend-cat"><span class="swatch" style="background:${css("--clean")}"></span>Aircraft samples in clean air</div><div class="legend-cat"><span class="swatch" style="background:${css(state.aerType === "dust" ? "--dust" : "--smoke")}"></span>Samples inside the aerosol layer</div>`);
  if (keys.length) parts.push(`<div class="legend-item">${keys.join("")}</div>`);
  el.innerHTML = parts.join("");
}

// ---------- tooltip ----------
const tip = document.getElementById("tip");
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let pending = null;
renderer.domElement.addEventListener("pointermove", e => { pending = e; });
renderer.domElement.addEventListener("pointerleave", () => { pending = null; tip.hidden = true; });
function doPick() {
  if (!pending) return; const e = pending; pending = null;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const cityPick = groups.city && groups.city.userData.pick ? groups.city.userData.pick.slice() : [];
  const mk = groups.ground && groups.ground.children.find(c => c.userData.isPandoraMarker);
  if (mk) cityPick.push(...mk.children.filter(c => c.userData.info));
  const targets = [groups.ozone, ...cityPick, groups.surface].filter(Boolean);
  const hit = ray.intersectObjects(targets, false)[0];
  if (!hit) { tip.hidden = true; return; }
  const m = hit.object;
  if (m.userData.info) {
    const b = m.userData.info;
    tip.innerHTML = b.kind === "pandora" ? `<b>Pandora 257</b><div class="k">NASA/PGN Pandora spectrometer at St. Edward's University</div>` : `<b>${b.n || (b.kind === "campus" ? "St. Edward's building" : "Downtown building")}</b>` +
      `<div><span class="k">height</span> <span class="v">${b.h ? Math.round(b.h) + " m" : "not recorded (drawn at 9 m)"}</span></div>` +
      `<div class="k" style="margin-top:4px">${b.kind === "campus" ? "St. Edward's University" : "Downtown Austin"} · OpenStreetMap</div>`;
    tip.hidden = false; const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14; if (x + tw > r.width - 8) x = e.clientX - r.left - tw - 14; if (y + th > r.height - 8) y = r.height - th - 8;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px"; return;
  }
  const it = m.userData.items[m.userData.owner[hit.faceIndex]];
  const row = (k, v) => `<div><span class="k">${k}</span> <span class="v">${v}</span></div>`;
  let html;
  if (m.userData.kind === "ozone") {
    html = `<b>Ozone, ${fmt(it.b)}–${fmt(it.t)} km</b>` + row("in this layer", `${fmt(it.du, 2)} DU`) + row("density", `${fmt(it.dens, 2)} DU/km`) +
      row("whole column", `${fmt(it.o.total, 0)} DU`) + row("troposphere", `${fmt(it.o.trop, 0)} DU`) + row("stratosphere", `${fmt(it.o.strat, 0)} DU`);
  } else {
    const p = it;
    html = `<b>TEMPO pixel, ${p.lat.toFixed(3)}°N ${Math.abs(p.lon).toFixed(3)}°W</b>` + row("measured", localTime(p.t)) +
      row("HCHO", `${sci(p.hcho)} ± ${sci(p.hcho_unc)}`) + row("NO₂ trop.", `${sci(p.no2_trop)} ± ${sci(p.no2_trop_unc)}`) +
      row("NO₂ strat.", sci(p.no2_strat)) + row("cloud fraction", fmt(p.cloud, 2)) + row("boundary layer", `${fmt(p.pbl / 1000, 2)} km`) +
      row("sun angle", `${fmt(90 - p.sza)}° above horizon`) + row("quality", `HCHO ${QF[p.hcho_q]}, NO₂ ${QF[p.no2_q]}`) +
      `<div class="k" style="margin-top:4px">columns in molecules/cm²</div>`;
  }
  tip.innerHTML = html; tip.hidden = false;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
  if (x + tw > r.width - 8) x = e.clientX - r.left - tw - 14;
  if (y + th > r.height - 8) y = r.height - th - 8;
  tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
}

// ---------- explanations ----------
const M = {
  hcho: median(PIX.map(p => p.hcho)), hchoUnc: median(PIX.map(p => p.hcho_unc)),
  hchoNeg: PIX.filter(p => p.hcho < 0).length / PIX.length,
  no2: median(PIX.map(p => p.no2_trop)), no2Strat: median(PIX.map(p => p.no2_strat)),
  cloud: median(PIX.map(p => p.cloud)), pbl: median(PIX.map(p => p.pbl)) / 1000,
  ozTot: median(OZ.map(o => o.total)), ozTrop: median(OZ.map(o => o.trop)),
};
const near = (p, la, lo) => Math.hypot((p.lat - la) * KY, (p.lon - lo) * KX);
M.no2Down = median(PIX.filter(p => near(p, 30.2672, -97.7431) < 10).map(p => p.no2_trop));
M.no2Far = median(PIX.filter(p => near(p, 30.2672, -97.7431) > 30).map(p => p.no2_trop));
M.no2Clear = median(PIX.filter(p => p.cloud < 0.5).map(p => p.no2_trop));
M.no2Cloudy = median(PIX.filter(p => p.cloud >= 0.9).map(p => p.no2_trop));
M.nClear = PIX.filter(p => p.cloud < 0.5).length; M.nCloudy = PIX.filter(p => p.cloud >= 0.9).length;
M.cloudy50 = PIX.filter(p => p.cloud >= 0.5).length / PIX.length;
M.pblMax = Math.max(...PIX.map(p => p.pbl)) / 1000;
M.tallest = Math.max(...DATA.city.downtown.map(b => b.h)) / 1000;
const sunEl = 90 - META.angles.sza, airmass = 1 / Math.cos(META.angles.sza * Math.PI / 180);

const ABOUT = {
  city: { t: "Austin: downtown, river, St. Edward's", b: `
    <h3>What it is</h3><p>Real map geometry from OpenStreetMap, so you can tell where TEMPO's pixels fall: downtown's buildings 45 m and taller (${CITY.downtown.length} of them, led by Waterline at 315 m), the Colorado River through Lady Bird Lake, and St. Edward's University with its buildings and campus outline. Click <b>Downtown</b> above the view to fly in.</p>
    <h3>Scale</h3><p>Footprints are true to scale. Heights use the same height stretch as everything else. At ×1, Waterline is about 0.3 km tall, beside a boundary layer about ${fmt(M.pbl, 1)} km deep and pixels about 2 × 5 km. All of downtown fits inside a handful of TEMPO pixels. The river is drawn wider than it really is so it stays visible from afar. Hover a building for its name and height.</p>
    <h3>How it relates</h3><p>This is why a single TEMPO pixel can't resolve one building or street: each pixel averages over roughly 10 km². It also explains why the Pandora on campus and a TEMPO pixel over it see somewhat different air.</p>
    <h3>Data notes</h3><p>Heights come from OpenStreetMap's height or floor-count tags (floors × 3.6 m). Campus buildings without a recorded height are drawn at 9 m. Map data © OpenStreetMap contributors.</p>` },
  aerosol: { t: "Aerosol layer (illustrative)", b: `
    <h3>What it is</h3><p>A layer of smoke or dust you can place over Austin. These TEMPO files contain no aerosol data, so this is a model, not a measurement. Its purpose is to show how TEMPO's aerosol products describe a layer, and why its height matters for the air people breathe.</p>
    <h3>Three views of the same aerosol</h3><p><b>AOD</b> says how much aerosol is in the whole column. <b>Aerosol layer height</b> says how high it sits. <b>Surface PM2.5</b> says what reaches the ground. A thick layer can mean poor air at the surface, or almost none, depending on whether it sits inside the boundary layer (the green sheet).</p>
    <h3>What to try</h3><p>Switch between <b>Smoke near the surface</b> and <b>Smoke aloft</b> and watch the summary below the controls change. Drag <b>AOD</b> below 0.2 to see when TEMPO can no longer estimate the height. Raise the height above 3 km to see how the PM2.5 product treats aerosol aloft.</p>
    <h3>From the training's case studies</h3><p>In the July 14, 2026 Ontario smoke event, smoke near the fires stayed in the boundary layer all day and exceeded daily PM2.5 standards. Downwind, the smoke was aloft in the morning and mixed to the surface in the afternoon. In the May 14, 2026 Northern Plains dust storm, the storm's leading edge was lofted aloft by about 21 UTC. The scenarios here are loosely modeled on these; their numbers are illustrative, not from the case studies.</p>` },
  intro: { t: "What you're looking at", b: `
    <p>TEMPO is a NASA instrument in geostationary orbit, about 36,000 km above the equator. Once an hour in daylight it sweeps a mirror east to west across North America and records the spectrum of sunlight bouncing back up from each small patch of ground. Different gases absorb light at different colors, so each spectrum can be turned into amounts of each gas.</p>
    <p>The colored tiles are TEMPO's pixels over Austin, about 1.9 × 4.8 km each, showing this evening's cloud cover. The green sheet is the top of the boundary layer. The brown layer is smoke you can adjust: it isn't in these files, but it shows how TEMPO's aerosol products work. The <b>Aerosol notes</b> tab summarizes NASA's training on them. Switch on <b>Ozone, layer by layer</b> to see the atmosphere above them split into 24 layers by height. Use <b>About this</b> next to any layer for what it is and how it relates to the rest.</p>` },
  hcho: { t: "Formaldehyde (HCHO) column", b: `
    <h3>What it is</h3><p>The number of formaldehyde molecules above each square centimeter of ground, counted from the surface to the top of the atmosphere.</p>
    <h3>Where it comes from</h3><p>Mostly made in the air when other organic gases (VOCs) break down. In a Texas summer much of that comes from trees, especially oaks, which emit isoprene; traffic and industry add more. It lasts only a few hours, so it marks where VOCs are being processed right now.</p>
    <h3>In this scan</h3><p>Median ${sci(M.hcho)}, but the typical uncertainty is ${sci(M.hchoUnc)}: larger than the value itself. ${Math.round(M.hchoNeg * 100)}% of pixels are negative, which is physically impossible and a sign of noise. Summer daytime values over Texas are usually around 10¹⁶. With the sun this low and this much cloud, treat the pattern here as noise.</p>
    <h3>How it relates</h3><p>HCHO stands in for VOCs. Divided by NO₂ (the HCHO/NO₂ ratio you already compute from Pandora), it indicates how ground-level ozone forms: low ratios mean ozone production is limited by VOCs, high ratios mean it is limited by NO₂ and related gases (NOₓ).</p>` },
  no2_trop: { t: "NO₂ column, troposphere", b: `
    <h3>What it is</h3><p>Nitrogen dioxide in the lower atmosphere (roughly the lowest 12–16 km), as molecules per square centimeter.</p>
    <h3>Where it comes from</h3><p>Mostly burning fuel: cars, trucks, power plants, industry. It is removed within hours in daylight, so it stays close to where it was emitted, mostly inside the boundary layer.</p>
    <h3>In this scan</h3><p>Values are higher near downtown (median ${sci(M.no2Down)} within 10 km) than far out (${sci(M.no2Far)} beyond 30 km), and highest about 30 km south-southwest. But switch the map to <b>Cloud fraction</b>: the high-NO₂ areas are the fully overcast ones. Across the scene, pixels that are mostly cloudy average ${sci(M.no2Cloudy)}, about ${fmt(M.no2Cloudy / M.no2Clear, 0)}× the ${sci(M.no2Clear)} under mostly clear sky. Some of that may be real, since the city sits under the cloud, but heavy cloud also makes the retrieval rely on assumptions. With these flags, the pattern can't be trusted as a pollution map.</p>
    <h3>How it relates</h3><p>NO₂ plus VOCs (tracked by HCHO) plus sunlight make ground-level ozone. This is the number Pandora's tropospheric NO₂ is compared against, with Pandora averaged over the hour around TEMPO's pass.</p>` },
  no2_strat: { t: "NO₂ column, stratosphere", b: `
    <h3>What it is</h3><p>Nitrogen dioxide higher up, mostly 15–50 km, produced naturally by chemistry there.</p>
    <h3>Why it's separate</h3><p>TEMPO measures all the NO₂ along the light path. The stratospheric part is a smooth background that varies over hundreds of kilometers, so it is estimated and removed to leave the tropospheric part that reflects pollution.</p>
    <h3>In this scan</h3><p>About ${sci(M.no2Strat)} everywhere, varying by about 1% across the area. The color scale is stretched to show that tiny variation, so it looks busier than it is. Compare with the tropospheric map, which varies more than tenfold.</p>` },
  cloud: { t: "Effective cloud fraction", b: `
    <h3>What it is</h3><p>An estimate of how much of each pixel is covered by cloud, scaled to a standard bright cloud: 0 is clear, 1 is overcast.</p>
    <h3>Why it matters</h3><p>Clouds are bright and hide the air beneath them. Under a cloud, TEMPO sees little of the lowest air, where NO₂ and HCHO are concentrated, so the retrieval leans on assumptions and becomes less certain.</p>
    <h3>In this scan</h3><p>Median ${fmt(M.cloud, 2)}: mostly cloudy, with a fully overcast band over the city and to its south. That, plus the low sun, is why every pixel is flagged "suspicious".</p>
    <h3>How it relates</h3><p>Compare this map with NO₂: tropospheric NO₂ is about ${fmt(M.no2Cloudy / M.no2Clear, 0)}× higher under the cloudiest pixels (${M.nCloudy} pixels at 0.9 or more) than under the clearest (${M.nClear} pixels below 0.5). When a gas map lines up this closely with clouds, check whether you're seeing pollution or the effect of clouds on the measurement. This is exactly why analyses keep only normal-quality, mostly clear pixels.</p>` },
  aodgap: { t: "Where clouds would block AOD", b: `
    <h3>What it is</h3><p>Pixels shaded gray have an effective cloud fraction of 0.5 or more in this scan; green ones are clearer. TEMPO and ABI don't retrieve AOD where their cloud masks see cloud, so gray pixels mark roughly where AOD (and anything built on it) would be missing this evening.</p>
    <h3>A caution</h3><p>The 0.5 cutoff is illustrative. The real products use their own cloud masks, and the training warns of two failure modes: thick smoke mistaken for cloud (a gap exactly where smoke is worst) and "cloud contamination" that makes AOD look too high beside clouds.</p>` },
  platforms: { t: "Other ways to measure", b: `
    <h3>Research aircraft (in situ)</h3><p>The spiral is a research aircraft descending over the Pandora site, sampling the air it flies through. Dots turn pale in clean air and take the aerosol's color inside the layer, so the trail is a measured vertical profile. Aircraft measure directly and in fine vertical detail, but only where and when they fly. The aircraft and its spiral are drawn larger than life.</p>
    <h3>Satellite lidar (active)</h3><p>A lidar such as CALIPSO's fires its own laser pulses and times the echoes, so it records where along the vertical layers are: a thin "curtain" under its ground track, about 100 m wide. Passive instruments like TEMPO rely on sunlight and see the whole column at once. The satellite is drawn just above the scene; a real one orbits about 700 km up. The curtain's returns here come from the model layer, not real data.</p>
    <h3>Pixel grids</h3><p>Footprints of other sensors at nadir, for comparing with TEMPO's pixels: OMI (about 13 × 24 km), MODIS (1 km aerosol pixels) and VIIRS imagery (375 m). They grow away from nadir.</p>` },
  pbl: { t: "Boundary-layer height", b: `
    <h3>What it is</h3><p>The planetary boundary layer is the air near the ground that daytime heating keeps stirred. Pollution emitted at the surface mixes up through it. On summer afternoons its top is typically 1–2 km up; after sunset it collapses to a few hundred meters.</p>
    <h3>Where the number comes from</h3><p>From the weather model the retrieval uses, not measured by TEMPO itself.</p>
    <h3>In this scan</h3><p>About ${fmt(M.pbl, 1)} km, still afternoon-like, though at 7 pm the real layer may already be shrinking.</p>
    <h3>How it relates</h3><p>Most tropospheric NO₂ and much HCHO sit inside this layer. The same column spread through a shallower layer means higher concentrations at the ground, which is what people breathe and what Pandora's surface-concentration estimates try to capture.</p>` },
  ozone: { t: "Ozone, layer by layer", b: `
    <h3>What it is</h3><p>TEMPO's ozone profile: the ozone amount in 24 layers from near the ground to about 66 km. Color shows ozone density, in Dobson Units per kilometer of height. Each block covers four ground pixels.</p>
    <h3>Two kinds of ozone</h3><p>The bright band near 25 km is the stratospheric ozone layer, which absorbs harmful UV light. Near the ground, ozone is a pollutant, formed when NO₂ and VOCs react in sunlight. That's the link to the NO₂ and HCHO maps.</p>
    <h3>In this scan</h3><p>About ${fmt(M.ozTot, 0)} DU in the whole column, of which ${fmt(M.ozTrop, 0)} DU (${fmt(100 * M.ozTrop / M.ozTot, 0)}%) is in the troposphere. Use the <b>From</b> and <b>Up to</b> sliders to peel away layers, or cut away the south half to see the profile and the ground map together.</p>
    <h3>A caution</h3><p>A satellite has only blurry vertical information. The retrieval blends the measurement with a typical profile for the place and season, and near the ground the result leans heavily on that typical profile.</p>` },
  rays: { t: "Lines of sight", b: `
    <h3>Pandora, toward the Sun</h3><p>In direct-sun mode Pandora points straight at the Sun and measures the light that came through the atmosphere along that line. Right now the Sun is only ${fmt(sunEl)}° above the horizon to the ${compass((META.angles.saa + 360) % 360)}, so the line crosses about ${fmt(airmass, 0)}× more air than straight up, and it rises only about 1 km for every ${fmt(Math.tan(META.angles.sza * Math.PI / 180), 0)} km it travels sideways. It samples air well west of the site.</p>
    <h3>TEMPO, from above</h3><p>TEMPO looks down from the ${compass((META.angles.vaa + 360) % 360)}, ${fmt(META.angles.vza, 0)}° from vertical. The sunlight it measures came down through the atmosphere and scattered back up through the pixel, so its light path is different again.</p>
    <h3>Why they never agree exactly</h3><p>The two instruments sample different air, at different times, over different areas: a thin line versus a 2 × 5 km pixel. Comparisons average Pandora over an hour or so around TEMPO's pass and expect some disagreement.</p>` },
  vex: { t: "Height stretch", b: `
    <p><b>Area radius</b> sets how far around St. Edward's and downtown the scene reaches, from 5 km up to the whole ~55 km crop. Summary numbers in the explanations always describe the full crop. The altitude axis grows to fit whatever is switched on. Turning on ozone, which reaches 66 km, sets the stretch to ×1 and restores your setting when you turn it off. At ×1 heights are to scale: the area is about ${fmt(W, 0)} km across and the ozone reaches about 66 km. The boundary layer and near-ground ozone are thin at true scale; stretch heights to see them. The stretch applies to ozone, the boundary layer, the altitude axis and the lines of sight. It doesn't apply to 3D bars, whose height shows a value, not an altitude.</p>` },
};
function showAbout(key) {
  if (key === "ground-var") key = state.ground === "off" ? "intro" : state.ground;
  state.about = key;
  const a = ABOUT[key] || ABOUT.intro;
  document.getElementById("explain").innerHTML = `<h2>${a.t}</h2>${a.b}`;
  const owner = { platforms: "platforms", city: "city", aerosol: "aerosol", aodgap: "ground", hcho: "ground", no2_trop: "ground", no2_strat: "ground", cloud: "ground", pbl: "ground", ozone: "ozone", "pbl-sheet": "pbl", rays: "rays", vex: "vex" };
  document.querySelectorAll(".layer").forEach(l => l.classList.toggle("active", l.dataset.layer === owner[key]));
}
document.querySelectorAll("[data-about]").forEach(b => b.addEventListener("click", () => {
  const k = b.dataset.about; showAbout(k === "pbl-sheet" ? "pbl" : k);
  if (k === "pbl-sheet") document.querySelectorAll(".layer").forEach(l => l.classList.toggle("active", l.dataset.layer === "pbl"));
}));

function renderReadout() {
  const el = document.getElementById("readout"); if (!el) return;
  if (!state.aer) { el.innerHTML = `<h3>What the aerosol products would show</h3><p class="note" style="margin:0">Switch on the aerosol layer to see how TEMPO's aerosol products would describe it.</p>`; return; }
  const [lo, hi] = aerBounds(), pbl = M.pbl, a = META.angles, m = 1 / Math.cos(a.sza * Math.PI / 180);
  const rows = [];
  const add = (kind, html) => rows.push(`<div class="ro-row"><span class="ro-dot ${kind}"></span><div>${html}</div></div>`);
  const amount = state.aod < 0.2 ? "light" : state.aod < 0.5 ? "moderate" : state.aod < 1 ? "heavy" : "very heavy";
  add("info", `<b>Column (AOD ${fmt(state.aod, 2)})</b>: ${amount} aerosol loading. AOD counts all aerosol in the column at 550 nm and says nothing about height.`);
  if (state.aod >= 0.2) add("info", `<b>Height (ALH)</b>: TEMPO would estimate the layer at about ${fmt(state.alh)} km above the ground.`);
  else add("warn", `<b>Height (ALH)</b>: not available. TEMPO only estimates aerosol layer height when AOD is at least 0.2, so this thin layer's height would be unknown.`);
  if (hi <= pbl) add("warn", `<b>Surface</b>: the whole layer sits inside the ${fmt(pbl, 1)} km boundary layer, where air is mixed down to the ground. ${state.aod < 0.2 ? "At this low AOD it adds only a little to surface PM2.5." : state.aod < 0.5 ? "Expect somewhat higher surface PM2.5." : "Expect elevated surface PM2.5."}`);
  else if (lo >= pbl) add("ok", `<b>Surface</b>: the layer is above the ${fmt(pbl, 1)} km boundary layer, so for now it is aloft and adds little to surface PM2.5. It can mix down later as the boundary layer deepens.`);
  else add("warn", `<b>Surface</b>: the layer straddles the top of the ${fmt(pbl, 1)} km boundary layer. The part inside it mixes toward the ground, so expect some surface impact.`);
  if (state.alh > 3 || state.aerType === "dust") add("info", `<b>PM2.5 product</b>: TEMPO's hourly surface PM2.5 is not averaged with GOES ABI's estimate here, because the aerosol is ${state.aerType === "dust" ? "identified as dust" : "aloft (layer height above 3 km)"}.`);
  add("warn", `<b>This evening's conditions</b>: AOD isn't retrieved under clouds, and ${fmt(100 * M.cloudy50, 0)}% of pixels here have cloud fraction 0.5 or higher. With the sun ${fmt(90 - a.sza)}° up, false smoke/dust detections are also more likely.`);
  add("info", `<b>Along the Sun's line</b>: the low sun's path crosses about ${fmt(m, 1)}× more aerosol than a vertical one, so only ${pctTxt(Math.exp(-state.aod * m))} of direct sunlight gets through (versus ${pctTxt(Math.exp(-state.aod))} with the sun overhead). A sun-pointing instrument measures this dimming directly.`);
  el.innerHTML = `<h3>What the aerosol products would show</h3>${rows.join("")}`;
}

const GLOSSARY = [
  ["Vertical column", "The total amount of a gas above a patch of ground: imagine counting every molecule in a tall, thin column from the surface to space. Satellites and Pandora both report columns, because they see light that passed through the whole atmosphere, not a sample of air at one height."],
  ["molecules/cm²", "The unit for a column: how many molecules sit above each square centimeter of ground. NO₂ over a city is around 10¹⁶; over clean countryside, around 10¹⁵."],
  ["Dobson Unit (DU)", "The traditional unit for ozone columns. 1 DU is 2.687 × 10¹⁶ molecules/cm². A typical 300 DU column, squeezed to sea-level pressure at 0 °C, would be a layer of pure ozone just 3 mm thick."],
  ["Troposphere and stratosphere", "The troposphere is the lowest layer of the atmosphere, about 12–16 km deep over Texas, where weather and almost all pollution live. Above it, the stratosphere holds most of the ozone. Satellites see both, so retrievals split columns into the two parts."],
  ["Solar zenith angle", `How far the Sun is from straight overhead. 0° is overhead; 90° is the horizon. This scan was taken at about ${fmt(META.angles.sza, 0)}°, near sunset. A low sun means a long path through the air and little light, which makes measurements harder.`],
  ["Air mass factor (AMF)", "Instruments actually measure the gas along the light's slanted, scattered path (a slant column). The air mass factor converts that to a vertical column. It depends on sun and viewing angles, clouds, aerosols, how bright the ground is, and where in height the gas sits. For NO₂ and HCHO it is usually the largest source of error."],
  ["Aerosol optical depth (AOD)", "How much a vertical beam of sunlight is dimmed by particles (haze, smoke, dust, sea salt), through both absorption and scattering. TEMPO reports it at 550 nm. It has no units; values in North America are typically 0 to 1, and higher means more aerosol. A beam passing straight down through AOD τ keeps e^(−τ) of its light. AOD is a column total with no height information. Aerosols also matter for the gas maps: they change the light paths the air mass factor has to model. Pandora's direct-sun files report AOD estimates too."],
  ["Quality flag", "TEMPO marks each pixel normal (0), suspicious (1) or bad (2). Common practice is to keep only normal pixels for analysis. Everything over Austin in this evening scan is suspicious, because of the low sun and heavy cloud."],
  ["How these connect", "Ground-level ozone forms when NO₂ and VOCs react in sunlight. HCHO is a stand-in for VOCs, so HCHO, NO₂ and their ratio describe the ingredients. The boundary layer sets how concentrated they are near the ground. Clouds, aerosols and the sun's angle don't change the chemistry the instruments see, but they change how much light reaches the gases and how reliably the measurement can be converted into a column."],
  ["UV Aerosol Index (UV AAI)", "A TEMPO product that flags aerosols that absorb ultraviolet light, mainly smoke and dust. It works over clouds and for thin smoke, which is why TEMPO can see smoke that GOES ABI misses. It is the first step in building TEMPO's smoke/dust mask."],
  ["Smoke/dust mask", "A yes/no (with relative thickness) map of where smoke or dust is present, made from spectral tests that separate absorbing aerosols from clouds and clear sky. Recommended use: high, medium and low confidence for qualitative work; high and medium only for quantitative work."],
  ["Aerosol layer height (ALH)", "TEMPO's estimate of the height, above the ground, of the aerosol layer with the most extinction. It comes from the ratio of two red bands (670 and 688 nm, near an oxygen absorption band) and is only retrieved when AOD is at least 0.2."],
  ["PM2.5", "The mass of particles smaller than 2.5 micrometers per cubic meter of air at the surface (µg/m³): what air-quality standards regulate. The TEMPO/ABI product estimates hourly PM2.5 by combining satellite AOD (and ALH) with ground monitors from the AirNow network. It has no quality flags, and cloud edges make it noisy."],
];

// header text
const t0 = new Date(META.austin_start_utc);
const dateLocal = t0.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", year: "numeric" });
const timeLocal = t0.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
document.getElementById("when").textContent = `${dateLocal}, ${timeLocal} CDT · ${META.austin_start_utc.slice(0, 16).replace("T", " ")} UTC`;
document.getElementById("callout").innerHTML = `<strong>Read the numbers with care.</strong> This pass was taken with the sun only ${fmt(sunEl)}° above the horizon, under mostly cloudy skies (median cloud fraction ${fmt(M.cloud, 1)}). TEMPO flags every pixel over Austin as <em>suspicious</em>. The page shows what TEMPO measures and how the pieces fit together, not reliable values for this evening.`;
const NS = Math.round(10 * median(PIX.map(p => { const [a, b] = [p.c[1], p.c[2]]; return Math.hypot((a[0] - b[0]) * KY, (a[1] - b[1]) * KX); }))) / 10;
const EW = Math.round(10 * median(PIX.map(p => { const [a, b] = [p.c[0], p.c[1]]; return Math.hypot((a[0] - b[0]) * KY, (a[1] - b[1]) * KX); }))) / 10;
function spectrumSvg() {
  const x = nm => 8 + (nm - 285) / (750 - 285) * 344;
  const band = (a, b, y, h, fill, op) => `<rect x="${x(a)}" y="${y}" width="${x(b) - x(a)}" height="${h}" fill="${fill}" opacity="${op}"/>`;
  const lab = (nm, y, t, cls = "") => `<text x="${x(nm)}" y="${y}" text-anchor="middle" class="${cls}">${t}</text>`;
  let ticks = ""; for (let nm = 300; nm <= 700; nm += 100) ticks += `<line x1="${x(nm)}" x2="${x(nm)}" y1="96" y2="100" stroke="var(--muted)"/>${lab(nm, 112, nm + " nm")}`;
  return `<svg class="fig" viewBox="0 0 360 124" role="img" aria-label="TEMPO spectral coverage from 293 to 741 nanometers with a gap at 494 to 538 nanometers">
    ${band(293, 494, 60, 34, "var(--accent)", 0.35)}${band(538, 741, 60, 34, "var(--accent)", 0.35)}
    ${lab(393, 81, "293–494 nm", "strong")}${lab(640, 81, "538–741 nm", "strong")}${lab(516, 56, "gap")}
    ${band(290, 345, 30, 10, "var(--sat)", 0.8)}${lab(317, 24, "O₃")}
    ${band(328, 357, 44, 10, "var(--pbl)", 0.8)}<text x="${x(360)}" y="53">HCHO</text>
    ${band(405, 465, 30, 10, "var(--sat)", 0.8)}${lab(435, 24, "NO₂")}
    <line x1="${x(670)}" x2="${x(670)}" y1="22" y2="60" stroke="var(--sun)" stroke-width="2"/><line x1="${x(688)}" x2="${x(688)}" y1="22" y2="60" stroke="var(--sun)" stroke-width="2"/>${lab(660, 16, "ALH 670/688")}
    <text x="${x(290)}" y="8">UV: aerosol index, smoke/dust</text>
    <line x1="8" x2="352" y1="96" y2="96" stroke="var(--muted)"/>${ticks}
  </svg>`;
}
function cadenceSvg() {
  const x = m => 92 + m / 60 * 248, rows = [["TEMPO", [0], 18], ["ABI full disk", [0, 10, 20, 30, 40, 50], 0], ["ABI CONUS", Array.from({ length: 12 }, (_, i) => i * 5), 0], ["ABI mesoscale", Array.from({ length: 60 }, (_, i) => i), 0]];
  let out = ""; rows.forEach(([name, ts, w], r) => {
    const y = 14 + r * 22; out += `<text x="0" y="${y + 4}" class="strong">${name}</text>`;
    ts.forEach(t => { out += w ? `<rect x="${x(t)}" y="${y - 5}" width="${x(60) - x(0) - 1}" height="10" fill="var(--accent)" opacity="0.3"/><text x="${x(30)}" y="${y + 4}" text-anchor="middle">one sweep per hour</text>` : `<line x1="${x(t)}" x2="${x(t)}" y1="${y - 6}" y2="${y + 6}" stroke="var(--accent)" stroke-width="2"/>`; });
  });
  let ticks = ""; for (let m = 0; m <= 60; m += 15) ticks += `<text x="${x(m)}" y="106" text-anchor="middle">${m} min</text>`;
  return `<svg class="fig" viewBox="0 0 360 112" role="img" aria-label="How often TEMPO and GOES ABI observe within one hour">${out}${ticks}</svg>`;
}

document.getElementById("foot").innerHTML = `Data: NASA TEMPO Level 2, version 4 (${META.files.map(f => `<code>${f}</code>`).join(", ")}), cropped to ${META.bounds.lat[0].toFixed(2)}–${META.bounds.lat[1].toFixed(2)}°N, ${Math.abs(META.bounds.lon[1]).toFixed(2)}–${Math.abs(META.bounds.lon[0]).toFixed(2)}°W. Pandora site location from the Pandonia Global Network. The aerosol layer is illustrative. Background: NASA ARSET trainings (Mogno and Huff, 2026; Gupta, Follette-Cook, Strode and Malings, 2023). Buildings, river and campus: © OpenStreetMap contributors (ODbL).`;

// ---------- controls ----------
const $ = id => document.getElementById(id);
$("groundVar").addEventListener("change", e => { state.ground = e.target.value; rebuild(["surface"]); showAbout(state.ground === "off" ? "intro" : state.ground); });
const setBars = b => { state.bars = b; $("draw-flat").setAttribute("aria-pressed", String(!b)); $("draw-bars").setAttribute("aria-pressed", String(b)); rebuild(["surface"]); };
$("draw-flat").addEventListener("click", () => setBars(false));
$("draw-bars").addEventListener("click", () => setBars(true));
let vexBeforeOzone = null;
const setVex = v => { state.vex = v; $("vex").value = v; $("vexV").textContent = "×" + v; };
$("showOzone").addEventListener("change", e => {
  state.ozone = e.target.checked;
  // ozone reaches 66 km: drop the height stretch so the low layers stay readable, and restore it afterwards
  if (state.ozone && state.vex > 1) { vexBeforeOzone = state.vex; setVex(1); }
  else if (!state.ozone && vexBeforeOzone !== null) { setVex(vexBeforeOzone); vexBeforeOzone = null; }
  rebuild(); showAbout("ozone"); if (state.ozone) VIEWS.side(); else VIEWS.overview();
});
$("ozCut").addEventListener("change", e => { state.cut = e.target.checked; if (!state.ozone) { $("showOzone").checked = true; $("showOzone").dispatchEvent(new Event("change")); } else rebuild(["ozone"]); showAbout("ozone"); });
const ozVals = () => { $("ozMinV").textContent = state.ozMin + " km"; $("ozMaxV").textContent = state.ozMax + " km"; $("ozOpacityV").textContent = Math.round(state.ozOpacity * 100) + "%"; };
$("ozMin").addEventListener("input", e => { state.ozMin = Math.min(+e.target.value, state.ozMax - 1); e.target.value = state.ozMin; ozVals(); rebuild(["ozone"]); });
$("ozMax").addEventListener("input", e => { state.ozMax = Math.max(+e.target.value, state.ozMin + 1); e.target.value = state.ozMax; ozVals(); rebuild(["ozone"]); });
$("ozOpacity").addEventListener("input", e => { state.ozOpacity = +e.target.value; ozVals(); rebuild(["ozone"]); });
$("showPbl").addEventListener("change", e => { state.pbl = e.target.checked; rebuild(["pbl"]); showAbout("pbl"); document.querySelectorAll(".layer").forEach(l => l.classList.toggle("active", l.dataset.layer === "pbl")); });
$("showRays").addEventListener("change", e => { state.rays = e.target.checked; rebuild(["rays"]); showAbout("rays"); });
$("vex").addEventListener("input", e => { state.vex = +e.target.value; $("vexV").textContent = "×" + state.vex; rebuild(["axis", "ozone", "pbl", "rays", "aerosol", "city"]); });
$("vexV").textContent = "×" + state.vex; ozVals();
$("radiusV").textContent = state.radius + " km";
$("radius").addEventListener("input", e => { setRadius(+e.target.value); $("radiusV").textContent = state.radius + " km"; rebuild(); });
$("radius").addEventListener("change", () => VIEWS.overview());
const aerVals = () => { $("aodV").textContent = fmt(state.aod, 2); $("alhV").textContent = fmt(state.alh) + " km"; $("thickV").textContent = fmt(state.thick) + " km";
  $("aer-smoke").setAttribute("aria-pressed", String(state.aerType === "smoke")); $("aer-dust").setAttribute("aria-pressed", String(state.aerType === "dust")); };
const aerChanged = (custom) => { if (custom) $("aerPreset").value = "custom"; if (!state.aer) { state.aer = true; $("showAer").checked = true; } aerVals(); rebuild(["aerosol", "rays"]); };
$("showAer").addEventListener("change", e => { state.aer = e.target.checked; rebuild(["aerosol", "rays"]); showAbout("aerosol"); });
$("aerPreset").addEventListener("change", e => { const pr = AER_PRESETS[e.target.value]; if (!pr) return;
  Object.assign(state, { aerType: pr.type, aod: pr.aod, alh: pr.alh, thick: pr.thick }); $("aod").value = pr.aod; $("alh").value = pr.alh; $("thick").value = pr.thick; aerChanged(false); showAbout("aerosol"); });
$("aer-smoke").addEventListener("click", () => { state.aerType = "smoke"; aerChanged(true); });
$("aer-dust").addEventListener("click", () => { state.aerType = "dust"; aerChanged(true); });
$("aod").addEventListener("input", e => { state.aod = +e.target.value; aerChanged(true); });
$("alh").addEventListener("input", e => { state.alh = +e.target.value; aerChanged(true); });
$("thick").addEventListener("input", e => { state.thick = +e.target.value; aerChanged(true); });
$("aerBox").addEventListener("change", e => { state.aerBox = e.target.checked; rebuild(["aerosol"]); });
$("showTgrid").addEventListener("change", e => { state.tgrid = e.target.checked; rebuild(["tgrid"]); });
$("showAbi").addEventListener("change", e => { state.abi = e.target.checked; rebuild(["abi"]); });
$("showPlane").addEventListener("change", e => { state.plane = e.target.checked; rebuild([]); showAbout("platforms"); });
$("showLidar").addEventListener("change", e => { state.lidar = e.target.checked; rebuild([]); showAbout("platforms"); });
$("fpSel").addEventListener("change", e => { state.fp = e.target.value; rebuild(["fp"]); showAbout("platforms"); });
aerVals();

// camera views
let tween = null, glide = false;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function view(pos, target) {
  if (!glide || reduceMotion.matches) { tween = null; camera.position.set(...pos); controls.target.set(...target); controls.update(); return; }
  tween = { s: performance.now(), p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...pos), t1: new THREE.Vector3(...target) };
}
function stepTween() {
  if (!tween) return;
  const f = Math.min(1, (performance.now() - tween.s) / 900), e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
  camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e);
  if (f >= 1) tween = null;
}
controls.addEventListener("start", () => { tween = null; });
const VIEWS = {
  overview: () => { const H = contentTop() * state.vex; view([W * 0.85, W * 0.4 + H * 0.9, D * 1.05 + H * 0.3], [0, H * 0.25, 0]); },
  side: () => { const H = contentTop() * state.vex; view([0, H * 0.5, D * 1.2 + Math.max(W * 0.15, H * 1.1)], [0, H * 0.45, 0]); },
  top: () => view([0, Math.max(W, D) * 1.55, 0.01], [0, 0, 0]),
  east: () => { const H = contentTop() * state.vex; view([W * 0.85 + H * 0.35, H * 0.6, D * 0.2], [-W * 0.12, H * 0.3, 0]); },
  plane: () => { const s0 = META.pandora, cx = px(s0.lon), cz = pz(s0.lat), v = state.vex, d = 2.1 * PLANE_TOP * v + 8; view([cx + d * 0.45, PLANE_TOP * v * 0.55 + d * 0.12, cz + d * 0.9], [cx, PLANE_TOP * v * 0.42, cz]); },
  pandora: () => { const s0 = META.pandora, cx = px(s0.lon), cz = pz(s0.lat), v = state.vex; view([cx + 13, 4 + 1.6 * v, cz + 15], [cx - 3.5, 0.45 * v, cz - 4.5]); },
  city: () => { const cx = px(-97.749), cz = pz(30.252); view([cx + 6.5, 3 + 1.1 * state.vex, cz + 10], [cx, 0.2 * state.vex, cz - 0.5]); },
};
$("v-overview").addEventListener("click", VIEWS.overview);
$("v-side").addEventListener("click", VIEWS.side);
$("v-top").addEventListener("click", VIEWS.top);
$("v-city").addEventListener("click", VIEWS.city);

// theme changes: rebuild colors that come from tokens
const themeWatch = () => { scene.background = new THREE.Color(css("--scene")); rebuild(); };
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeWatch);
new MutationObserver(themeWatch).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// size + loop
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h); labelRenderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
scene.background = new THREE.Color(css("--scene"));
resize(); rebuild(); VIEWS.overview(); showAbout("intro");
const NEAR_KM = 40;
const _mp = new THREE.Vector3();
function updateMarker() {
  const g = groups.ground; if (!g) return;
  const m = g.children.find(c => c.userData.isPandoraMarker); if (!m) return;
  // ~1/28 of the camera distance, clamped: about 0.1 km tall when flying low over campus,
  // ~0.5 km in the Downtown view (well below the tallest stretched tower), up to 4 km from the overview
  const d = camera.position.distanceTo(m.getWorldPosition(_mp));
  m.scale.setScalar(Math.min(4, Math.max(0.04, d / 28)));
}
function updateAxisVisibility() {  // looking straight down, the altitude axis collapses onto the map: hide it
  const g = groups.axis; if (!g) return;
  const topDown = controls.getPolarAngle() < 0.5;
  if (g.userData.top !== topDown) { g.userData.top = topDown; g.traverse(o => { if (o !== g) o.visible = !topDown; }); }
}
function updateLod() {
  const near = camera.position.distanceTo(controls.target) < NEAR_KM;
  scene.traverse(o => { if (o.userData && o.userData.lod) o.visible = (o.userData.lod === "near") === near; });
}
(function loop() { requestAnimationFrame(loop); const tnow = performance.now(); Object.values(groups).forEach(g => { if (g && g.userData.tick) g.userData.tick(tnow); }); stepTween(); controls.update(); updateLod(); updateAxisVisibility(); updateMarker(); doPick(); renderer.render(scene, camera); labelRenderer.render(scene, camera); })();

// ---------- scene API for the training sections ----------
function syncControls() {
  $("groundVar").value = state.ground;
  $("draw-flat").setAttribute("aria-pressed", String(!state.bars)); $("draw-bars").setAttribute("aria-pressed", String(state.bars));
  $("showAer").checked = state.aer; $("aod").value = state.aod; $("alh").value = state.alh; $("thick").value = state.thick; $("aerBox").checked = state.aerBox;
  const pre = Object.entries(AER_PRESETS).find(([, p]) => p.type === state.aerType && p.aod === state.aod && p.alh === state.alh && p.thick === state.thick);
  $("aerPreset").value = pre ? pre[0] : "custom";
  $("showOzone").checked = state.ozone; $("ozCut").checked = state.cut; $("ozMin").value = state.ozMin; $("ozMax").value = state.ozMax; $("ozOpacity").value = state.ozOpacity;
  $("showPbl").checked = state.pbl; $("showRays").checked = state.rays; $("showTgrid").checked = state.tgrid; $("showAbi").checked = state.abi; $("showPlane").checked = state.plane; $("showLidar").checked = state.lidar; $("fpSel").value = state.fp;
  $("radius").value = state.radius; $("radiusV").textContent = state.radius + " km"; setVex(state.vex); ozVals(); aerVals();
}
const SCENE_KEYS = ["ground", "bars", "ozone", "cut", "ozMin", "ozMax", "ozOpacity", "pbl", "rays", "vex", "city", "aerBox", "aer", "aerType", "aod", "alh", "thick", "tgrid", "abi", "plane", "lidar", "fp", "scan"];
function applyScene(sc) {
  SCENE_KEYS.forEach(k => { if (k in sc) state[k] = sc[k]; });
  state.sunOv = sc.sunOv || null;
  vexBeforeOzone = null;
  if ("radius" in sc) setRadius(sc.radius);
  syncControls(); rebuild();
  showAbout(sc.about || (state.ground === "off" ? "intro" : "aerosol"));
  (VIEWS[sc.view || "overview"] || VIEWS.overview)();
}
window.VIZ = { applyScene, state, M, META, NS, EW, PIX, CITY, fmt, sci, pctTxt, compass, sunEl, airmass, spectrumSvg, cadenceSvg, GLOSSARY,
  startGlide: () => { glide = true; },
  setSun: (sza, saa) => { state.sunOv = { sza, saa }; rebuild(["rays"]); } };
})();
