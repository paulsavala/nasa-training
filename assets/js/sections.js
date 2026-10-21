(function () {
"use strict";
/* =====================================================================
   SECTIONS: the training's structure. Each section sets up the 3D scene
   (scene), offers a few variations to try (tries), explains (body), and
   shows the matching training slides (slides: [file stem, title, note]).
   ===================================================================== */
const V = window.VIZ || null;
const q = (f, d = "–") => { try { const r = f(); return r === undefined || r === null ? d : r; } catch (e) { return d; } };
const f1 = x => q(() => V.fmt(x(), 1));
const f0 = x => q(() => V.fmt(x(), 0));
const pblKm = () => f1(() => V.M.pbl);
const cloudyPct = () => f0(() => 100 * V.M.cloudy50);
const sunUp = () => f1(() => V.sunEl);
const pathX = () => f1(() => V.airmass);
const dl = t => `<span class="demo-link">${t}</span>`;

// The scene every section starts from; sections override what they need.
const BASE = { ground: "cloud", bars: false, ozone: false, cut: false, ozMin: 0, ozMax: 66, ozOpacity: 1, pbl: true, rays: true, vex: 5,
  aer: true, aerType: "smoke", aod: 0.8, alh: 0.9, thick: 1.2, aerBox: false, radius: 25, tgrid: false, abi: false, plane: false, lidar: false, fp: "none", view: "overview" };
const NEAR = { aerType: "smoke", aod: 0.8, alh: 0.9, thick: 1.2 };
const ALOFT = { aerType: "smoke", aod: 0.6, alh: 4.5, thick: 1.5 };
const DUST = { aerType: "dust", aod: 0.7, alh: 3.4, thick: 2.0 };
const HAZE = { aerType: "smoke", aod: 0.12, alh: 1.0, thick: 1.0 };


// log-scale "where measurements are made" ladder
function ladderSvg() {
  const x = km => 250 + (Math.log10(km) + 3) / 8 * 310;
  const rows = [["Ground instruments (Pandora, monitors)", 0.001, 0.003], ["Research aircraft", 0.1, 12], ["Stratospheric balloons", 20, 40], ["Space station (ISS)", 400, 420], ["Polar-orbiting satellites", 600, 1000], ["Geostationary (TEMPO, GOES)", 35786, 35786]];
  let out = "";
  rows.forEach(([name, a, b], i) => {
    const y = 18 + i * 24;
    out += `<text x="0" y="${y + 4}" class="strong">${name}</text>`;
    out += (b / a > 1.5) ? `<rect x="${x(a)}" y="${y - 5}" width="${x(b) - x(a)}" height="10" rx="5" style="fill:var(--accent-bright);opacity:.7"/>` : `<circle cx="${x(a)}" cy="${y}" r="5" style="fill:var(--accent-bright)"/>`;
  });
  const ticks = [[0.001, "1 m"], [0.1, "100 m"], [10, "10 km"], [1000, "1,000 km"], [100000, "100,000 km"]];
  let ax = `<line x1="${x(0.001)}" x2="${x(100000)}" y1="160" y2="160" style="stroke:var(--rule)"/>`;
  ticks.forEach(([k, t]) => { ax += `<line x1="${x(k)}" x2="${x(k)}" y1="157" y2="163" style="stroke:var(--muted)"/><text x="${x(k)}" y="176" text-anchor="middle">${t}</text>`; });
  return `<svg class="fig" viewBox="0 0 600 182" role="img" aria-label="Measurement platforms by height above ground, from ground instruments to geostationary satellites at about 36,000 km">${out}${ax}</svg>`;
}
// one day of observations over Austin, by platform
function daySvg() {
  const x = h => 150 + h / 24 * 410;
  const rows = [["GOES-East ABI", Array.from({ length: 144 }, (_, i) => i / 6)], ["TEMPO", Array.from({ length: 13 }, (_, i) => 7 + i)], ["Terra (MODIS)", [10.5]], ["Aqua (MODIS), VIIRS", [13.5]], ["Aura (OMI)", [13.75]]];
  let out = "";
  rows.forEach(([name, ts], i) => {
    const y = 16 + i * 22;
    out += `<text x="0" y="${y + 4}" class="strong">${name}</text><line x1="${x(0)}" x2="${x(24)}" y1="${y}" y2="${y}" style="stroke:var(--line)"/>`;
    ts.forEach(t => { out += `<line x1="${x(t)}" x2="${x(t)}" y1="${y - 6}" y2="${y + 6}" style="stroke:var(--accent-bright);stroke-width:${ts.length > 50 ? 1 : 2.5}"/>`; });
  });
  let ax = ""; [0, 6, 12, 18, 24].forEach(h => { ax += `<text x="${x(h)}" y="134" text-anchor="middle">${String(h).padStart(2, "0")}:00</text>`; });
  return `<svg class="fig" viewBox="0 0 590 140" role="img" aria-label="Observations over one day: ABI every 10 minutes, TEMPO hourly in daylight, polar orbiters once each around midday">${out}${ax}</svg>`;
}

// Where sunlight goes before it reaches a satellite (static diagram)
function lightPathSvg(opts = {}) {
  // Geometry: rays leave the Sun's edge along their own direction, and each returning ray stops short of the
  // satellite at its own point on a ring, so the three arrows arrive from clearly different directions.
  const SUN = [46, 46], SR = 20, SAT = [430, 40], RING = 30;
  const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); return [dx / L, dy / L]; };
  const head = (tip, u, col) => { const L = 10, w = 5, bx = tip[0] - u[0] * L, by = tip[1] - u[1] * L;
    return `<polygon points="${tip[0].toFixed(1)},${tip[1].toFixed(1)} ${(bx - u[1] * w).toFixed(1)},${(by + u[0] * w).toFixed(1)} ${(bx + u[1] * w).toFixed(1)},${(by - u[0] * w).toFixed(1)}" style="fill:var(${col})"/>`; };
  const line = (p, q, col) => `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" style="stroke:var(${col});stroke-width:2.2"/>`;
  const fromSun = to => { const u = unit(SUN, to); return line([SUN[0] + u[0] * (SR + 3), SUN[1] + u[1] * (SR + 3)], to, "--sun"); };
  const toSat = from => { const u = unit(from, SAT), tip = [SAT[0] - u[0] * RING, SAT[1] - u[1] * RING]; return line(from, [tip[0] - u[0] * 9, tip[1] - u[1] * 9], "--sat") + head(tip, u, "--sat"); };
  const num = (x, y, n) => `<circle cx="${x}" cy="${y}" r="10" style="fill:var(--panel);stroke:var(--fg);stroke-width:1.2"/><text x="${x}" y="${y + 4}" text-anchor="middle" class="strong" style="font-size:11px">${n}</text>`;
  const GROUND = [128, 248], SCAT = [352, 192], ABS = [232, 206], CLOUD = [586, 112];
  let g = "";
  g += `<rect x="0" y="248" width="660" height="16" style="fill:var(--ground)"/><text x="10" y="260" style="fill:var(--fg);font-size:11px">ground</text>`;
  g += `<path d="M556 128 q-6 -16 12 -18 q6 -16 26 -10 q14 -8 26 6 q18 2 14 18 z" style="fill:var(--panel);stroke:var(--muted);stroke-width:1.2"/><text x="590" y="146" text-anchor="middle">cloud</text>`;
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 44; i++) { const x = 180 + rnd() * 250, y = 170 + rnd() * 56; if (Math.hypot(x - SCAT[0], y - SCAT[1]) < 12 || Math.hypot(x - ABS[0], y - ABS[1]) < 12) continue;
    g += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(2 + rnd() * 2).toFixed(1)}" style="fill:var(--smoke);opacity:.6"/>`; }
  g += `<text x="306" y="240" text-anchor="middle">smoke particles (aerosol)</text>`;
  if (opts.smokeOverCloud) { for (let i = 0; i < 16; i++) g += `<circle cx="${(548 + rnd() * 80).toFixed(0)}" cy="${(88 + rnd() * 14).toFixed(0)}" r="${(1.8 + rnd() * 1.6).toFixed(1)}" style="fill:var(--smoke);opacity:.7"/>`;
    g += `<text x="640" y="84" text-anchor="end" style="font-size:10px">smoke above cloud</text>`; }
  [[150, 228], [470, 222], [70, 180]].forEach(([x, y]) => { g += `<text x="${x}" y="${y}" text-anchor="middle" style="fill:var(--fg);font-size:10.5px">NO₂</text>`; });
  g += `<circle cx="${SUN[0]}" cy="${SUN[1]}" r="${SR}" style="fill:var(--sun)"/><text x="${SUN[0]}" y="${SUN[1] + SR + 18}" text-anchor="middle" class="strong">Sun</text>`;
  g += `<rect x="${SAT[0] - 8}" y="${SAT[1] - 8}" width="16" height="16" style="fill:var(--fg)"/><rect x="${SAT[0] - 32}" y="${SAT[1] - 3}" width="20" height="6" style="fill:var(--water)"/><rect x="${SAT[0] + 12}" y="${SAT[1] - 3}" width="20" height="6" style="fill:var(--water)"/><text x="${SAT[0] + 42}" y="${SAT[1] + 4}" class="strong">Satellite</text>`;
  // 1 ground, 2 scattered by a particle, 3 cloud top, 4 absorbed
  g += fromSun(GROUND) + toSat(GROUND);
  g += fromSun(SCAT) + `<circle cx="${SCAT[0]}" cy="${SCAT[1]}" r="5.5" style="fill:var(--smoke)"/>` + toSat(SCAT);
  g += fromSun(CLOUD) + toSat(CLOUD);
  g += fromSun(ABS) + `<circle cx="${ABS[0]}" cy="${ABS[1]}" r="6.5" style="fill:var(--smoke)"/><text x="${ABS[0] + 8}" y="${ABS[1] + 18}" style="fill:var(--fg);font-size:13px;font-weight:700">×</text>`;
  g += num(98, 176, 1) + num(250, 140, 2) + num(504, 68, 3) + num(156, 152, 4);
  return `<figure class="diagram"><svg class="fig wide" viewBox="0 0 660 268" role="img" aria-label="Four paths sunlight can take: reflected by the ground after passing through gases, scattered back by an aerosol particle, reflected by a cloud top, or absorbed by a smoke particle. Only the first three reach the satellite.">${g}</svg>
    <figcaption>${opts.caption || `<ol class="paths">
      <li><b>Reflected by the ground.</b> This light crosses the whole atmosphere twice, so gases like NO₂ have two chances to absorb some of its colors.</li>
      <li><b>Scattered back by aerosol</b> before it reaches the ground. More aerosol means more of this, so a smoky scene looks brighter from above, especially over dark ground.</li>
      <li><b>Reflected by a cloud top.</b> Bright, but it never saw the air under the cloud, so whatever is below is hidden.</li>
      <li><b>Absorbed by smoke.</b> It never comes back. Smoke and dust absorb most strongly in the ultraviolet.</li>
    </ol><span class="note">Orange: sunlight coming in. Blue: light heading to the satellite. The satellite only gets the total of all paths, at each wavelength.</span>`}</figcaption></figure>`;
}

// ---- Interactive toy retrieval: fit a guessed atmosphere to a "measured" spectrum ----
// A deliberately simple model (not TEMPO's algorithm): Rayleigh + aerosol path brightness, a surface term dimmed by aerosol,
// smoke that absorbs more in the UV, and NO2 absorption bands in the 400-470 nm window.
const RT = { wl: [] };
for (let w = 300; w <= 740; w += 2) RT.wl.push(w);
const inGap = w => w > 494 && w < 538;
function no2Sigma(w) {  // toy NO2 cross-section: banded structure, strongest near 400-460 nm
  if (w < 330 || w > 520) return 0;
  const env = Math.exp(-Math.pow((w - 430) / 45, 2));
  return env * (0.55 + 0.45 * Math.cos(2 * Math.PI * (w - 400) / 14));
}
function spectrum(aod, no2, ground = 1) {
  return RT.wl.map(w => {
    const ray = 0.11 * Math.pow(w / 400, -4);                       // air molecules scatter blue/UV light back
    const ta = aod * Math.pow(w / 550, -1.3);                      // aerosol optical depth at this wavelength
    const ssa = 0.92 - 0.22 * Math.max(0, (420 - w) / 120);        // smoke absorbs more in the UV
    const aer = 0.16 * ssa * (1 - Math.exp(-ta));                   // light scattered back by aerosol
    const absorb = Math.exp(-1.2 * (1 - ssa) * ta);                // light absorbed by aerosol
    const surf = ground * (0.04 + 0.12 * Math.max(0, (w - 300) / 440)) * Math.exp(-0.9 * ta) * absorb;
    const gas = Math.exp(-0.06 * no2 * no2Sigma(w) * 2);            // NO2 dips (light passes through twice)
    return Math.min(0.6, (ray * Math.exp(-0.3 * ta) + aer * absorb + surf) * gas);
  });
}

// ---- Interactive "spectrum mixer": what each ingredient adds to the light reaching the satellite ----
// Same toy physics as the retrieval below, split into contributions that stack up to the total.
function components(o) {
  const dust = o.type === "dust";
  const out = { air: [], aer: [], ground: [], cloud: [], total: [] };
  RT.wl.forEach(w => {
    const ta = o.aod * Math.pow(w / 550, dust ? -0.4 : -1.3);
    const ssa = (dust ? 0.95 : 0.92) - (dust ? 0.14 : 0.22) * Math.max(0, (420 - w) / 120);
    const absorb = Math.exp(-1.2 * (1 - ssa) * ta), gas = Math.exp(-0.06 * o.no2 * no2Sigma(w) * 2);
    const clear = 1 - o.cloud;
    const air = clear * 0.11 * Math.pow(w / 400, -4) * Math.exp(-0.3 * ta) * gas;
    const aer = clear * 0.16 * ssa * (1 - Math.exp(-ta)) * absorb * gas;
    const ground = clear * o.ground * (0.04 + 0.12 * Math.max(0, (w - 300) / 440)) * Math.exp(-0.9 * ta) * absorb * gas;
    const cloud = o.cloud * 0.55 * Math.exp(-0.06 * o.no2 * no2Sigma(w) * 0.3);   // cloud tops see little of the gas below
    out.air.push(air); out.aer.push(aer); out.ground.push(ground); out.cloud.push(cloud); out.total.push(air + aer + ground + cloud);
  });
  return out;
}
const MIX_START = { aod: 0.1, type: "smoke", no2: 0.3, ground: 1, cloud: 0 };
const MIX_PRESETS = [
  ["Clean air", { aod: 0.05, type: "smoke", no2: 0.2, ground: 1, cloud: 0 }],
  ["Smoky", { aod: 1.2, type: "smoke", no2: 0.6, ground: 1, cloud: 0 }],
  ["Polluted city (lots of NO₂)", { aod: 0.2, type: "smoke", no2: 3.5, ground: 1, cloud: 0 }],
  ["Dust over bright desert", { aod: 0.8, type: "dust", no2: 0.2, ground: 2.5, cloud: 0 }],
  ["Mostly cloudy", { aod: 0.3, type: "smoke", no2: 2, ground: 1, cloud: 0.8 }],
];
function mixerHtml() {
  return `<figure class="retrieval" id="mx">
    <div class="trybar" style="margin-top:0" role="group" aria-label="Example scenes"><span class="lab">Examples:</span>${MIX_PRESETS.map(([n], i) => `<button type="button" class="chip small" data-mx="${i}">${n}</button>`).join("")}</div>
    <svg class="fig wide" id="mx-svg" viewBox="0 0 620 262" role="img" aria-label="Spectrum seen by the satellite, split into light scattered by air molecules, scattered by aerosol, reflected by the ground and reflected by clouds."></svg>
    <div class="mx-share" id="mx-share" aria-live="polite"></div>
    <div class="rt-controls">
      <div class="row"><label for="mx-aod">Aerosol (AOD)</label><input type="range" id="mx-aod" min="0" max="2" step="0.02"><span class="val" id="mx-aodV"></span></div>
      <div class="row"><span id="mx-typeL" style="color:var(--muted);min-width:6.5em">Aerosol type</span><div class="seg" role="group" aria-labelledby="mx-typeL"><button type="button" id="mx-smoke">Smoke</button><button type="button" id="mx-dust">Dust</button></div></div>
      <div class="row"><label for="mx-no2">NO₂</label><input type="range" id="mx-no2" min="0" max="4" step="0.05"><span class="val" id="mx-no2V"></span></div>
      <div class="row"><label for="mx-ground">Ground brightness</label><input type="range" id="mx-ground" min="0.3" max="3" step="0.05"><span class="val" id="mx-groundV"></span></div>
      <div class="row"><label for="mx-cloud">Cloud cover</label><input type="range" id="mx-cloud" min="0" max="1" step="0.02"><span class="val" id="mx-cloudV"></span></div>
    </div>
    <figcaption><span>The colored bands stack up to the dark line: the total brightness the satellite records at each wavelength. The thin dashed line is the scene you started from, so you can see what changed. Things to notice: NO₂ cuts dips only in the shaded band, and they get shallower under cloud. More aerosol adds its own brightness but dims the ground's share. Smoke darkens the ultraviolet end more than dust does.</span>
    <span class="note">A simplified model of how light reaches the satellite; see "What this model simplifies" below. NO₂ in units of 10¹⁶ molecules/cm²; ground brightness relative to typical vegetation.</span></figcaption>
  </figure>
  <details class="model-notes">
    <summary>What this model simplifies, and where to find the full version</summary>
    <p>This is a simplified version of the radiative transfer calculation that real retrievals rely on. Its structure is the real one: the brightness the satellite records is the sum of light scattered back by air molecules, light scattered back by aerosol, and light reflected by the ground and clouds, each dimmed by absorption along the way.</p>
    <p><b>Kept from the real physics</b></p>
    <ul>
      <li>Air molecules scatter in proportion to wavelength<sup>−4</sup> (Rayleigh scattering), which is why the curve climbs toward the ultraviolet.</li>
      <li>Aerosol optical depth changes with wavelength as a power law (the Ångström law), steeper for small smoke particles than for larger dust; smoke and dust absorb more strongly in the ultraviolet.</li>
      <li>Gases absorb following the Beer–Lambert law, and light that reaches the ground crosses the atmosphere twice.</li>
      <li>More aerosol adds scattered light but dims the light from the ground beneath it.</li>
    </ul>
    <p><b>Simplified or made up</b></p>
    <ul>
      <li>Light is treated as scattering once. Real light scatters many times, which matters most in the ultraviolet and in thick smoke.</li>
      <li>The Sun and viewing angles are ignored; real calculations depend strongly on them.</li>
      <li>The NO₂ dips are a stand-in pattern, not NO₂'s measured absorption spectrum.</li>
      <li>The ground's brightness is a smooth ramp; real surfaces have features such as vegetation's sharp rise in brightness near 700 nm. Clouds are flat white reflectors.</li>
      <li>All coefficients were chosen to look reasonable, so the units are arbitrary.</li>
    </ul>
    <p><b>The full models.</b> Operational retrievals compute spectra with full radiative transfer models that handle multiple scattering, the actual angles, measured absorption spectra and surface maps. For details: the <a href="https://asdc.larc.nasa.gov/documents/tempo/ATBD_TEMPO_NO2.pdf" target="_blank" rel="noopener">TEMPO NO₂ Algorithm Theoretical Basis Document</a>; the TEMPO aerosol algorithm paper, <a href="https://doi.org/10.1029/2025JD044082" target="_blank" rel="noopener">Zhang, Kondragunta and Ciren (2025)</a>; and <a href="https://www.libradtran.org" target="_blank" rel="noopener">libRadtran</a>, a free radiative transfer package you can run yourself.</p>
  </details>`;
}
function initMixer() {
  const $ = id => document.getElementById(id); if (!$("mx")) return;
  const o = { ...MIX_START }, ref = components(MIX_START).total;
  const COLS = [["air", "--water", "Air molecules"], ["aer", "--smoke", "Aerosol"], ["ground", "--pbl", "Ground"], ["cloud", "--muted", "Clouds"]];
  const X = w => 52 + (w - 300) / 440 * 552, Y = v => 214 - v / 0.6 * 196;
  const segs = () => { const out = []; let cur = []; RT.wl.forEach((w, i) => { if (inGap(w)) { if (cur.length) out.push(cur); cur = []; } else cur.push(i); }); if (cur.length) out.push(cur); return out; };
  const SEGS = segs();
  const linePath = arr => SEGS.map(sg => sg.map((i, k) => `${k ? "L" : "M"}${X(RT.wl[i]).toFixed(1)} ${Y(arr[i]).toFixed(1)}`).join("")).join("");
  function draw() {
    const c = components(o), dust = o.type === "dust";
    let g = "";
    [0, 0.2, 0.4, 0.6].forEach(v => { g += `<line x1="52" x2="604" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="46" y="${Y(v) + 3}" text-anchor="end">${v.toFixed(1)}</text>`; });
    [300, 400, 500, 600, 700].forEach(w => { g += `<text x="${X(w)}" y="232" text-anchor="middle">${w} nm</text>`; });
    g += `<text x="12" y="${Y(0.3)}" transform="rotate(-90 12 ${Y(0.3)})" text-anchor="middle">brightness seen from space</text>`;
    g += `<rect x="${X(400)}" y="${Y(0.6)}" width="${X(470) - X(400)}" height="${Y(0) - Y(0.6)}" style="fill:var(--accent-soft);opacity:.45"/><text x="${X(435)}" y="${Y(0.58)}" text-anchor="middle">NO₂ band</text>`;
    g += `<rect x="${X(494)}" y="${Y(0.6)}" width="${X(538) - X(494)}" height="${Y(0) - Y(0.6)}" style="fill:var(--card)"/><text x="${X(516)}" y="${Y(0.58)}" text-anchor="middle">gap</text>`;
    // stacked bands, bottom to top: ground, aerosol, air, cloud
    const order = ["ground", "aer", "air", "cloud"], base = RT.wl.map(() => 0);
    order.forEach(k => {
      const col = COLS.find(cc => cc[0] === k)[1], top = base.map((b, i) => b + c[k][i]);
      SEGS.forEach(sg => {
        const up = sg.map(i => `${X(RT.wl[i]).toFixed(1)},${Y(top[i]).toFixed(1)}`), dn = sg.slice().reverse().map(i => `${X(RT.wl[i]).toFixed(1)},${Y(base[i]).toFixed(1)}`);
        g += `<polygon points="${up.concat(dn).join(" ")}" style="fill:var(${k === "aer" && dust ? "--dust" : col});opacity:.75"/>`;
      });
      top.forEach((v, i) => { base[i] = v; });
    });
    g += `<path d="${linePath(ref)}" style="fill:none;stroke:var(--muted);stroke-width:1.2;stroke-dasharray:4 4"/>`;
    g += `<path d="${linePath(c.total)}" style="fill:none;stroke:var(--fg);stroke-width:2"/>`;
    let lx = 70; COLS.forEach(([k, col, name]) => { g += `<rect x="${lx}" y="246" width="12" height="10" style="fill:var(${k === "aer" && dust ? "--dust" : col});opacity:.75"/><text x="${lx + 16}" y="255" class="strong">${name}</text>`; lx += name.length * 6.6 + 34; });
    g += `<line x1="${lx}" x2="${lx + 22}" y1="251" y2="251" style="stroke:var(--fg);stroke-width:2"/><text x="${lx + 26}" y="255" class="strong">total</text>`;
    $("mx-svg").innerHTML = g;
    // shares at 550 nm
    const i550 = RT.wl.indexOf(550), tot = c.total[i550];
    $("mx-share").innerHTML = `At 550 nm the light reaching the satellite comes from: ` + COLS.map(([k, , name]) => `<b>${name.toLowerCase()}</b> ${Math.round(100 * c[k][i550] / tot)}%`).join(", ") + ".";
    $("mx-aodV").textContent = o.aod.toFixed(2); $("mx-no2V").textContent = o.no2.toFixed(2); $("mx-groundV").textContent = "×" + o.ground.toFixed(2); $("mx-cloudV").textContent = Math.round(o.cloud * 100) + "%";
    $("mx-smoke").setAttribute("aria-pressed", String(!dust)); $("mx-dust").setAttribute("aria-pressed", String(dust));
  }
  const sync = () => { $("mx-aod").value = o.aod; $("mx-no2").value = o.no2; $("mx-ground").value = o.ground; $("mx-cloud").value = o.cloud; draw(); };
  [["mx-aod", "aod"], ["mx-no2", "no2"], ["mx-ground", "ground"], ["mx-cloud", "cloud"]].forEach(([id, k]) => $(id).addEventListener("input", e => { o[k] = +e.target.value; draw(); }));
  $("mx-smoke").addEventListener("click", () => { o.type = "smoke"; draw(); });
  $("mx-dust").addEventListener("click", () => { o.type = "dust"; draw(); });
  document.querySelectorAll("#mx [data-mx]").forEach(b => b.addEventListener("click", () => { Object.assign(o, MIX_PRESETS[+b.dataset.mx][1]); sync(); }));
  sync();
}

// ---- Interactive globe: a polar orbiter vs. a geostationary instrument over one simulated day ----
function orbitHtml(startMode = "polar") {
  return `<figure class="retrieval" id="ob">
    <div class="trybar" style="margin-top:0" role="group" aria-label="Orbit">
      <button type="button" class="chip" id="ob-polar" aria-pressed="${startMode === "polar"}">Polar orbit (like Aqua)</button>
      <button type="button" class="chip" id="ob-geo" aria-pressed="${startMode === "geo"}">Geostationary (like TEMPO)</button>
      <button type="button" class="chip small" id="ob-pause">Pause</button>
      <button type="button" class="chip small" id="ob-reset">Start the day over</button>
    </div>
    <div class="ob-stage" id="ob-stage"><div class="ob-clock" id="ob-clock"></div></div>
    <figcaption><span id="ob-note"></span><span class="note">One simulated day passes in about 48 seconds; drag to turn the globe. Sizes of the Earth and orbits are to scale; satellites, the Sun and its distance are not. Orange arrows show the direction of sunlight. Land outline: Natural Earth.</span></figcaption>
  </figure>`;
}
function initOrbits(startMode = "polar") {
  const $ = id => document.getElementById(id); if (!$("ob")) return;
  if (!window.THREE) { $("ob-stage").innerHTML = '<p class="err">The 3D library did not load.</p>'; return; }
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const D2R = Math.PI / 180, RE = 6371, DAY = 48000;           // ms of real time per simulated day
  const stage = $("ob-stage"), W = 1024, H = 512;
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
  const controls = new THREE.OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.enablePan = false;
  scene.add(new THREE.AmbientLight(0xffffff, 0.28));
  const sunL = new THREE.DirectionalLight(0xffffff, 1.05); sunL.position.set(10, 0, 0); scene.add(sunL);   // the Sun is along +x
  // Earth texture: base map (ocean, land, graticule) + an overlay of measured areas, composited each frame
  const base = document.createElement("canvas"), over = document.createElement("canvas"), comp = document.createElement("canvas");
  [base, over, comp].forEach(c => { c.width = W; c.height = H; });
  const ex = lon => (lon + 180) / 360 * W, ey = lat => (90 - lat) / 180 * H;
  function drawBase() {
    const g = base.getContext("2d");
    g.fillStyle = "#2f6fae"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#8fae7a"; g.strokeStyle = "#5f7d4c"; g.lineWidth = 1;
    (window.LAND_110M || []).forEach(ring => { g.beginPath(); ring.forEach(([lo, la], i) => { const x = ex(lo), y = ey(la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); });
    g.fillRect(0, ey(-84), W, H - ey(-84));
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1;
    for (let lo = -180; lo <= 180; lo += 30) { g.beginPath(); g.moveTo(ex(lo), 0); g.lineTo(ex(lo), H); g.stroke(); }
    for (let la = -60; la <= 60; la += 30) { g.beginPath(); g.moveTo(0, ey(la)); g.lineTo(W, ey(la)); g.stroke(); }
  }
  drawBase();
  const tex = new THREE.CanvasTexture(comp);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshLambertMaterial({ map: tex }));
  scene.add(earth);
  const AUSTIN = [30.27, -97.74];
  const local = (lat, lon, r = 1) => new THREE.Vector3(r * Math.cos(lat * D2R) * Math.cos(lon * D2R), r * Math.sin(lat * D2R), -r * Math.cos(lat * D2R) * Math.sin(lon * D2R));
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(css("--sun")) }));
  pin.position.copy(local(...AUSTIN, 1.005)); earth.add(pin);
  // satellites (symbols, not to scale)
  const satMesh = (s) => { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: new THREE.Color(css("--fg")) });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), m)); const pm = new THREE.MeshBasicMaterial({ color: new THREE.Color(css("--accent-bright")) });
    const p = new THREE.Mesh(new THREE.BoxGeometry(s * 3.2, s * 0.12, s * 0.9), pm); g.add(p); return g; };
  // polar orbit like Aqua: 705 km, inclination 98.2°, period 98.8 min, crossing the equator northbound at 1:30 pm local solar time
  const RP = 1 + 705 / RE, INC = 98.2 * D2R, NODE = -22.5 * D2R, PERIOD = 98.8 / 1440;   // fraction of a day
  const n = new THREE.Vector3(Math.cos(NODE), 0, Math.sin(NODE)), e = new THREE.Vector3(Math.cos(NODE - Math.PI / 2), 0, Math.sin(NODE - Math.PI / 2));
  // (east of the subsolar meridian is toward -z; NODE = -22.5° puts the node 22.5° east, i.e. 13:30 local time)
  const m = e.clone().multiplyScalar(Math.cos(INC)).add(new THREE.Vector3(0, Math.sin(INC), 0));
  const polarPos = f => { const u = 2 * Math.PI * (f % PERIOD) / PERIOD; return n.clone().multiplyScalar(Math.cos(u) * RP).add(m.clone().multiplyScalar(Math.sin(u) * RP)); };
  const polarSat = satMesh(0.045); scene.add(polarSat);
  const ringPts = []; for (let i = 0; i <= 128; i++) ringPts.push(polarPos(i / 128 * PERIOD));
  const polarRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: new THREE.Color(css("--muted")), transparent: true, opacity: 0.6 })); scene.add(polarRing);
  // geostationary: 35,786 km over the equator at 91°W, turning with the Earth
  const RG = 1 + 35786 / RE, geoSat = satMesh(0.16); geoSat.position.copy(local(0, -91, RG)); earth.add(geoSat);
  const FOR = { s: 17, n: 58, w: -128, e: -60 };      // TEMPO's field of regard, roughly
  // the geostationary ring, the Sun (direction right; distance and size not to scale) and arrows of incoming sunlight
  const gr = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * 2 * Math.PI; gr.push(new THREE.Vector3(RG * Math.cos(a), 0, RG * Math.sin(a))); }
  const geoRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(gr), new THREE.LineDashedMaterial({ color: new THREE.Color(css("--muted")), dashSize: 0.25, gapSize: 0.2 }));
  geoRing.computeLineDistances(); scene.add(geoRing);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(css("--sun")) })); sun.position.set(15, 0, 0); scene.add(sun);
  const rays = new THREE.Group(), rc = new THREE.Color(css("--sun"));
  [[0.75, 0.45], [0, 0.6], [-0.75, 0.45], [0.45, -0.55], [-0.45, -0.55]].forEach(([y, z]) => {
    rays.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(2.6, y, z), new THREE.Vector3(1.45, y, z)]), new THREE.LineBasicMaterial({ color: rc })));
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 10), new THREE.MeshBasicMaterial({ color: rc })); h.position.set(1.4, y, z); h.rotation.z = Math.PI / 2; rays.add(h);
  });
  scene.add(rays);
  const coneG = new THREE.BufferGeometry().setFromPoints([[FOR.n, FOR.w], [FOR.n, FOR.e], [FOR.s, FOR.w], [FOR.s, FOR.e]].flatMap(([la, lo]) => [local(0, -91, RG), local(la, lo, 1.002)]));
  const cone = new THREE.LineSegments(coneG, new THREE.LineBasicMaterial({ color: new THREE.Color(css("--sat")), transparent: true, opacity: 0.7 })); earth.add(cone);
  // state
  let mode = "polar", t0 = performance.now(), tSim = 0, paused = false, lastF = 0, visible = true, austinCount = 0, lastHit = -1, lastScanHour = -1, scanning = false;
  const START_UTC = 13 / 24;    // the day starts at 13:00 UTC (8 am in Austin)
  const og = over.getContext("2d");
  const sunDirLocal = () => earth.worldToLocal(new THREE.Vector3(10, 0, 0)).normalize();
  const lit = (lat, lon) => local(lat, lon).dot(sunDirLocal()) > 0.03;
  const subPoint = v => { const p = earth.worldToLocal(v.clone()); return [Math.asin(p.y / p.length()) / D2R, Math.atan2(-p.z, p.x) / D2R]; };
  const gcKm = (a, b) => { const c = Math.sin(a[0] * D2R) * Math.sin(b[0] * D2R) + Math.cos(a[0] * D2R) * Math.cos(b[0] * D2R) * Math.cos((a[1] - b[1]) * D2R); return RE * Math.acos(Math.min(1, Math.max(-1, c))); };
  function paintSwath(lat, lon) {
    const half = 10.35, rx = Math.min(180, half / Math.max(0.05, Math.cos(lat * D2R)));
    og.fillStyle = css("--sun"); og.globalAlpha = 1;
    [-360, 0, 360].forEach(off => { og.beginPath(); og.ellipse(ex(lon + off), ey(lat), rx / 360 * W, 2.2 / 180 * H, 0, 0, 2 * Math.PI); og.fill(); });
  }
  function paintGeoColumn(lon) { og.fillStyle = css("--sun"); og.fillRect(ex(lon) - 3, ey(FOR.n), 6, ey(FOR.s) - ey(FOR.n)); }
  function setRotation(f) { earth.rotation.y = ((START_UTC + f) % 1 - 0.5) * 2 * Math.PI; earth.updateMatrixWorld(); }   // subsolar point at UTC noon over 0°
  function reset() { og.clearRect(0, 0, W, H); tSim = 0; lastF = 0; austinCount = 0; lastHit = -1; lastScanHour = -1; t0 = performance.now(); }
  function setMode(mo) {
    mode = mo; $("ob-polar").setAttribute("aria-pressed", String(mo === "polar")); $("ob-geo").setAttribute("aria-pressed", String(mo === "geo"));
    polarSat.visible = polarRing.visible = mo === "polar"; geoSat.visible = cone.visible = geoRing.visible = sun.visible = mo === "geo";
    reset();
    camera.fov = mo === "polar" ? 40 : 50; camera.updateProjectionMatrix();
    // both views are fixed relative to the Sun, so the Earth is seen turning and the day/night line stays put
    if (mo === "polar") { camera.position.set(1.0, 1.7, -3.1); controls.target.set(0.35, 0, 0); }   // the afternoon side, where passes are painted
    else { camera.position.set(4, 13, 13); controls.target.set(3.5, 0, 0); }                         // the whole geostationary ring, the Earth and the Sun
    controls.update();
  }
  function step(f0, f1) {
    const N = mode === "polar" ? 10 : 4;
    for (let k = 1; k <= N; k++) {
      const f = f0 + (f1 - f0) * k / N; setRotation(f);
      if (mode === "polar") {
        const p = polarPos(f), [la, lo] = subPoint(p);
        if (lit(la, lo)) { paintSwath(la, lo); if (gcKm([la, lo], AUSTIN) < 1165 && f - lastHit > 0.02) { austinCount++; lastHit = f; } }
      } else {
        const hrs = f * 24, hour = Math.floor(hrs), frac = hrs - hour, centerLit = lit(38, -95);
        if (centerLit) {
          if (hour !== lastScanHour) { og.clearRect(0, 0, W, H); lastScanHour = hour; scanning = true; }
          const lon = FOR.e - (FOR.e - FOR.w) * frac; paintGeoColumn(lon);
          const prevLon = FOR.e - (FOR.e - FOR.w) * Math.max(0, frac - (f1 - f0) * 24 / N);
          if (lon <= AUSTIN[1] && prevLon > AUSTIN[1]) austinCount++;
        } else if (scanning) { scanning = false; }
      }
    }
    if (mode === "polar") polarSat.position.copy(polarPos(f1)), polarSat.lookAt(0, 0, 0);
  }
  function compose() {
    const g = comp.getContext("2d"); g.globalAlpha = 1; g.drawImage(base, 0, 0); g.globalAlpha = 0.55; g.drawImage(over, 0, 0); g.globalAlpha = 1;
    tex.needsUpdate = true;
  }
  function clock(f) {
    const utc = ((START_UTC + f) % 1) * 24, aus = (utc - 5 + 24) % 24, fmtT = h => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
    $("ob-clock").innerHTML = `Austin ${fmtT(aus)} CDT${f >= 1 ? " (day done)" : ""}<br>Austin measured: <b>${austinCount}</b> time${austinCount === 1 ? "" : "s"}`;
    $("ob-note").textContent = mode === "polar"
      ? "A polar orbiter like Aqua circles pole to pole about 14½ times a day while the Earth turns beneath it, so each daylight pass paints a new strip (here MODIS's 2,330 km swath). Every pass crosses the equator northbound at about 1:30 pm local time, so Austin is seen about once a day, at about the same time. Near the equator the strips leave gaps; VIIRS's wider 3,000 km swath closes them."
      : "The Earth spins once a day, carrying every place from night into day and back. A geostationary satellite circles at exactly the same rate (watch it travel around the dashed ring), so it stays above the same spot over the equator and stares at the same region all day. Like TEMPO, it sweeps its mirror from east to west across North America once an hour in daylight, so Austin is measured every hour, but it never sees the rest of the globe.";
  }
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(stage);
  $("ob-polar").addEventListener("click", () => setMode("polar"));
  $("ob-geo").addEventListener("click", () => setMode("geo"));
  $("ob-reset").addEventListener("click", reset);
  $("ob-pause").addEventListener("click", () => { paused = !paused; $("ob-pause").textContent = paused ? "Play" : "Pause"; if (!paused) t0 = performance.now() - tSim * DAY; });
  scene.background = new THREE.Color(css("--scene"));
  setMode(startMode); resize();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { paused = true; $("ob-pause").textContent = "Play"; }
  (function loop(now) {
    if (!renderer.domElement.isConnected) { renderer.dispose(); return; }    // section changed: stop
    requestAnimationFrame(loop);
    if (!visible) { if (!paused) t0 = now - tSim * DAY; return; }
    if (!paused && tSim < 1) { tSim = Math.min(1, (now - t0) / DAY); step(lastF, tSim); lastF = tSim; }
    else setRotation(tSim);
    compose(); clock(tSim); controls.update(); renderer.render(scene, camera);
  })(performance.now());
}

// ---- Interactive North America globe: viewing angle and TEMPO pixel size anywhere in the field of regard ----
// Geometry: TEMPO 35,786 km above the equator at 91°W. Each pixel is a fixed angle as seen from the satellite (calibrated
// to the training's 2.0 × 4.8 km at the center of the field of regard); its footprint is found by tracing those angles to the ground.
function vzaHtml() {
  return `<figure class="retrieval" id="va">
    <div class="trybar" style="margin-top:0" role="group" aria-label="Places"><span class="lab">Go to:</span>${VA_PLACES.map(([n], i) => `<button type="button" class="chip small" data-va="${i}">${n}</button>`).join("")}</div>
    <div class="ob-stage" id="va-stage"><div class="va-cross" aria-hidden="true"></div><div class="ob-clock va-info" id="va-info"></div></div>
    <figcaption><span>Drag to turn the globe; scroll or pinch to zoom in. The crosshair is the spot being described. Colors show the viewing angle (0° would be straight down); the small shapes are single TEMPO pixels drawn 40 times larger so their shape is visible. Zoom in close and the true-size pixel grid around the crosshair appears, along with the line of sight to TEMPO (blue), straight up (gray), and the viewing angle between them (orange).</span>
    <span class="note">Computed from the geometry: pixel angles are fixed as seen from the satellite and calibrated to 2.0 × 4.8 km at the center of TEMPO's view. This reproduces the training's table to within about 0.1 km, except near Juneau, where real pixels are slightly smaller. Map: Natural Earth 1:10m.</span></figcaption>
  </figure>`;
}
const VA_PLACES = [["Center of view", 33.5, -89.2], ["Austin", 30.27, -97.74], ["Mexico City", 19.43, -99.13], ["Miami", 25.76, -80.19], ["Washington, DC", 38.9, -77.04], ["Seattle", 47.61, -122.33], ["Oil sands", 57.0, -111.5], ["Juneau", 58.3, -134.42]];
function initVza() {
  const $ = id => document.getElementById(id); if (!$("va")) return;
  if (!window.THREE) { $("va-stage").innerHTML = '<p class="err">The 3D library did not load.</p>'; return; }
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const D2R = Math.PI / 180, RE = 6371, ANS = 4.2001e-5, AEW = 1.30146e-4;    // pixel angles in radians (N–S, E–W)
  const local = (lat, lon, r = 1) => new THREE.Vector3(r * Math.cos(lat * D2R) * Math.cos(lon * D2R), r * Math.sin(lat * D2R), -r * Math.cos(lat * D2R) * Math.sin(lon * D2R));
  const SAT = local(0, -91, 1 + 35786 / RE), Z = new THREE.Vector3(0, 1, 0);
  const vzaAt = p => { const v = SAT.clone().sub(p); return Math.acos(v.dot(p) / v.length() / p.length()) / D2R; };
  const hit = d => { const b = SAT.dot(d), c = SAT.lengthSq() - 1, disc = b * b - c; if (disc < 0) return null; return SAT.clone().addScaledVector(d, -b - Math.sqrt(disc)); };
  const look = (d0, a, b) => { const ew = d0.clone().cross(Z).normalize(); return d0.clone().applyAxisAngle(ew, a).applyAxisAngle(Z, b).normalize(); };
  function pixelCorners(p, i = 0, j = 0, scale = 1) {   // footprint of the pixel offset (i, j) steps from the one containing p
    const d0 = p.clone().sub(SAT).normalize(), pts = [];
    [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].forEach(([a, b]) => { const q = hit(look(d0, (i + a) * ANS * scale, (j + b) * AEW * scale)); if (q) pts.push(q); });
    return pts.length === 4 ? pts : null;
  }
  const sizeKm = p => { const d0 = p.clone().sub(SAT).normalize(), c = hit(d0), n = hit(look(d0, ANS, 0)), e = hit(look(d0, 0, AEW)); return [n.distanceTo(c) * RE, e.distanceTo(c) * RE]; };
  // overlay texture: viewing-angle shading and 10° contours only (land, lakes and borders are drawn as crisp geometry below)
  const W = 4096, H = 2048, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const ex = lon => (lon + 180) / 360 * W, ey = lat => (90 - lat) / 180 * H;
  const STOPS = [[20, [253, 231, 37]], [40, [94, 201, 98]], [55, [33, 145, 140]], [70, [59, 82, 139]], [85, [68, 1, 84]]];
  const vcol = v => { for (let k = 1; k < STOPS.length; k++) if (v <= STOPS[k][0]) { const [a, ca] = STOPS[k - 1], [b, cb] = STOPS[k], f = Math.max(0, (v - a) / (b - a)); return ca.map((c, m) => c + (cb[m] - c) * f); } return STOPS[STOPS.length - 1][1]; };
  const img = g.getImageData(0, 0, W, H), dat = img.data, x0 = Math.floor(ex(-175)), x1 = Math.ceil(ex(-25)), y0 = Math.floor(ey(85)), y1 = Math.ceil(ey(-15));
  const V = new Float32Array(W * H).fill(NaN), tmp = new THREE.Vector3();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const lon = x / W * 360 - 180, lat = 90 - y / H * 180; tmp.copy(local(lat, lon)); const v = vzaAt(tmp); if (v >= 88) continue;
    V[y * W + x] = v; const c = vcol(v), i = 4 * (y * W + x);
    dat[i] = c[0]; dat[i + 1] = c[1]; dat[i + 2] = c[2]; dat[i + 3] = 112;
  }
  for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) {   // contour lines every 10°
    const a = V[y * W + x], b = V[y * W + x - 1], c = V[(y - 1) * W + x];
    if ((Math.floor(a / 10) !== Math.floor(b / 10) && isFinite(b)) || (Math.floor(a / 10) !== Math.floor(c / 10) && isFinite(c))) { const i = 4 * (y * W + x); dat[i] = dat[i + 1] = dat[i + 2] = 250; dat[i + 3] = 235; }
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = "#fff"; g.font = "bold 22px sans-serif"; g.textAlign = "center";
  [20, 30, 40, 50, 60, 70, 80].forEach(t => { for (let la = 70; la >= -10; la -= 0.25) { const v = vzaAt(local(la, -91)); if (Math.abs(v - t) < 0.2) { g.fillText(t + "°", ex(-91), ey(la) - 3); break; } } });
  // scene
  const stage = $("va-stage"), renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(css("--scene"));
  const camera = new THREE.PerspectiveCamera(30, 1, 0.001, 50), controls = new THREE.OrbitControls(camera, renderer.domElement);
  const labels = new THREE.CSS2DRenderer(); labels.domElement.className = "labels"; stage.appendChild(labels.domElement);
  controls.enablePan = false; controls.minDistance = 1.012; controls.maxDistance = 4; controls.enableDamping = true;
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8;
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshBasicMaterial({ color: 0x3a7dbf })));      // ocean
  // land and lakes: Natural Earth 1:10m polygons, triangulated and subdivided so they hug the sphere at any zoom
  function polyMesh(polys, r, color) {
    const pos = [], proj = v => { const p = local(v.y, v.x, r); pos.push(p.x, p.y, p.z); };
    const sub = (A, B, C, depth) => {
      const ab = A.distanceTo(B), bc = B.distanceTo(C), ca = C.distanceTo(A), m = Math.max(ab, bc, ca);
      if (m > 1 && depth < 14) { const half = (P, Q) => P.clone().add(Q).multiplyScalar(0.5);
        if (m === ab) { const M = half(A, B); sub(A, M, C, depth + 1); sub(M, B, C, depth + 1); }
        else if (m === bc) { const M = half(B, C); sub(A, B, M, depth + 1); sub(A, M, C, depth + 1); }
        else { const M = half(C, A); sub(A, B, M, depth + 1); sub(M, B, C, depth + 1); } return; }
      proj(A); proj(B); proj(C);
    };
    const ring = r0 => { const v = r0.map(([x, y]) => new THREE.Vector2(x, y)); if (v.length > 1 && v[0].equals(v[v.length - 1])) v.pop(); return v; };
    polys.forEach(rings => { const outer = ring(rings[0]), holes = rings.slice(1).map(ring); if (outer.length < 3) return;
      let tris; try { tris = THREE.ShapeUtils.triangulateShape(outer, holes); } catch (e) { return; }
      const all = outer.concat(...holes); tris.forEach(([a, b, c]) => sub(all[a], all[b], all[c], 0)); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  }
  const NA = window.NA_MAP || { land: [], lakes: [], borders: [], states: [] };
  scene.add(polyMesh(NA.land, 1.0001, 0xb9d3a0)); scene.add(polyMesh(NA.lakes, 1.0002, 0x3a7dbf));
  const lineSet = (lines, r, color, opacity) => { const pts = []; lines.forEach(l => { for (let k = 1; k < l.length; k++) { const a = local(l[k - 1][1], l[k - 1][0], r), b = local(l[k][1], l[k][0], r); pts.push(a.x, a.y, a.z, b.x, b.y, b.z); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity })); };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.0004, 384, 192), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));   // viewing-angle overlay
  scene.add(lineSet(NA.states, 1.0005, 0x4d5b4a, 0.45)); scene.add(lineSet(NA.borders, 1.0005, 0x2c352a, 0.85));
  const CITIES = [["Austin", 30.27, -97.74], ["Houston", 29.76, -95.37], ["Dallas", 32.78, -96.8], ["San Antonio", 29.42, -98.49], ["Denver", 39.74, -104.99], ["Phoenix", 33.45, -112.07], ["Los Angeles", 34.05, -118.24], ["San Francisco", 37.77, -122.42], ["Seattle", 47.61, -122.33], ["Portland", 45.52, -122.68], ["Salt Lake City", 40.76, -111.89], ["Las Vegas", 36.17, -115.14], ["Chicago", 41.88, -87.63], ["Minneapolis", 44.98, -93.27], ["St. Louis", 38.63, -90.2], ["Kansas City", 39.1, -94.58], ["New Orleans", 29.95, -90.07], ["Atlanta", 33.75, -84.39], ["Miami", 25.76, -80.19], ["Washington", 38.91, -77.04], ["New York", 40.71, -74.01], ["Boston", 42.36, -71.06], ["Detroit", 42.33, -83.05], ["Toronto", 43.65, -79.38], ["Montréal", 45.5, -73.57], ["Vancouver", 49.28, -123.12], ["Calgary", 51.05, -114.07], ["Edmonton", 53.55, -113.49], ["Winnipeg", 49.9, -97.14], ["Fort McMurray", 56.73, -111.38], ["Anchorage", 61.22, -149.9], ["Juneau", 58.3, -134.42], ["Mexico City", 19.43, -99.13], ["Monterrey", 25.69, -100.32], ["Guadalajara", 20.67, -103.35], ["Havana", 23.11, -82.37], ["San Juan", 18.47, -66.11]];
  const cityObjs = CITIES.map(([n, la, lo]) => { const el = document.createElement("div"); el.className = "va-city"; el.textContent = n; const o = new THREE.CSS2DObject(el); o.position.copy(local(la, lo, 1.0006)); scene.add(o); return o; });
  // 40x pixel glyphs across the field of regard
  const glyph = [], gp = [];
  for (let la = 15; la <= 65; la += 7.5) for (let lo = -135; lo <= -60; lo += 9) {
    const p = local(la, lo); if (vzaAt(p) > 80) continue;
    const c = pixelCorners(p, 0, 0, 40); if (!c) continue;
    for (let k = 0; k < 4; k++) { const a = c[k].clone().setLength(1.0015), b = c[(k + 1) % 4].clone().setLength(1.0015); gp.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  }
  const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
  const glyphs = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xffffff })); scene.add(glyphs);
  // true-size pixel patch, line of sight and zenith at the crosshair (rebuilt when the view settles)
  let patch = null, sight = null;
  const ray = new THREE.Raycaster(), sphere = new THREE.Sphere(new THREE.Vector3(), 1);
  function centerPoint() { ray.setFromCamera(new THREE.Vector2(0, 0), camera); const p = new THREE.Vector3(); return ray.ray.intersectSphere(sphere, p) ? p : null; }
  function rebuildLocal(p, dist) {
    [patch, sight].forEach(o => { if (o) { scene.remove(o); o.geometry.dispose(); } });
    patch = sight = null; if (!p || vzaAt(p) > 85) return;
    const pts = [], N = 7;
    for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) { const c = pixelCorners(p, i, j); if (!c) continue; for (let k = 0; k < 2; k++) { const a = c[k].clone().setLength(1.0006), b = c[k + 1].clone().setLength(1.0006); pts.push(a.x, a.y, a.z, b.x, b.y, b.z); } }
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    patch = new THREE.LineSegments(pg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })); scene.add(patch);
    p = p.clone().setLength(1.0006); const L = Math.max(0.004, (dist - 1) * 0.45), up = p.clone().normalize(), toSat = SAT.clone().sub(p).normalize();
    const arc = []; for (let k = 0; k <= 16; k++) arc.push(p.clone().add(up.clone().lerp(toSat, k / 16).normalize().multiplyScalar(L * 0.45)));
    const sg = new THREE.BufferGeometry().setFromPoints([p, p.clone().addScaledVector(up, L), p, p.clone().addScaledVector(toSat, L * 1.6), ...arc.flatMap((a, k) => k ? [arc[k - 1], a] : [])]);
    const colors = []; const cu = new THREE.Color(css("--muted")), cs = new THREE.Color(css("--sat")), ca = new THREE.Color(css("--sun"));
    const nseg = sg.attributes.position.count / 2; for (let k = 0; k < nseg; k++) { const c = k === 0 ? cu : k === 1 ? cs : ca; colors.push(c.r, c.g, c.b, c.r, c.g, c.b); }
    sg.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    sight = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true })); scene.add(sight);
  }
  function info(p) {
    if (!p) { $("va-info").innerHTML = "Point the crosshair at the Earth."; return; }
    const lat = Math.asin(p.y / p.length()) / D2R, lon = Math.atan2(-p.z, p.x) / D2R, v = vzaAt(p);
    const where = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}°${lon <= 0 ? "W" : "E"}`;
    if (v > 85) { $("va-info").innerHTML = `${where}<br>Too close to the edge of the Earth as seen from TEMPO`; return; }
    const [ns, ew] = sizeKm(p), area = ns * ew;
    $("va-info").innerHTML = `${where}<br>Viewing angle <b>${v.toFixed(0)}°</b><br>Pixel ≈ <b>${ns.toFixed(1)} × ${ew.toFixed(1)} km</b> (N–S × E–W)<br>${(area / 9.6).toFixed(1)}× the area of a pixel at the center of TEMPO's view`;
  }
  function goTo(lat, lon, dist = 1.6) { camera.position.copy(local(lat, lon, dist)); controls.target.set(0, 0, 0); controls.update(); }
  document.querySelectorAll("#va [data-va]").forEach(b => b.addEventListener("click", () => { const [, la, lo] = VA_PLACES[+b.dataset.va]; goTo(la, lo, 1.08); }));
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h); labels.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(stage); let visible = true; new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(stage);
  goTo(38, -97, 2.3); resize();
  let lastKey = "", still = 0;
  (function loop() {
    if (!renderer.domElement.isConnected) { renderer.dispose(); tex.dispose(); return; }
    requestAnimationFrame(loop); if (!visible) return;
    const dist = camera.position.length(); controls.rotateSpeed = Math.min(1, Math.max(0.015, (dist - 1) * 0.9)); controls.zoomSpeed = Math.min(1, Math.max(0.25, (dist - 1) * 2));
    controls.update();
    const p = centerPoint(), key = p ? p.toArray().map(x => x.toFixed(5)).join() + dist.toFixed(4) : "none";
    if (key !== lastKey) { lastKey = key; still = 0; info(p); } else if (++still === 8) rebuildLocal(p, dist);
    glyphs.visible = dist > 1.25; if (patch) patch.visible = dist < 1.3;
    const nearP = Math.max(5e-5, (dist - 1) * 0.4); if (Math.abs(camera.near - nearP) / nearP > 0.05) { camera.near = nearP; camera.far = dist + 1.5; camera.updateProjectionMatrix(); }
    const showCities = dist < 1.6, cn = camera.position.clone().normalize();
    cityObjs.forEach(o => { o.visible = showCities && o.position.clone().normalize().dot(cn) > 1 / dist + 0.002; });   // only cities on the visible side
    renderer.render(scene, camera); labels.render(scene, camera);
  })();
}

// ---- Interactive mask simulator: build a scene from above, see the smoke/dust mask an instrument would report ----
// A simplified model of the decision steps (cloud screening, UV aerosol index, smoke-vs-dust tests, confidence), with
// thresholds chosen for illustration. It reproduces the behaviors the training describes, not the real algorithm's numbers.
const MK_START = { sensor: "tempo", quant: false };
const MK_PRESETS = [
  ["Smoke plume", { smoke: 1.4, dust: 0, cloud: 0, above: false, haze: 0, sand: false, sun: 55 }],
  ["Thin smoke", { smoke: 0.45, dust: 0, cloud: 0, above: false, haze: 0, sand: false, sun: 55 }],
  ["Smoke over clouds", { smoke: 1.2, dust: 0, cloud: 0.45, above: true, haze: 0, sand: false, sun: 55 }],
  ["Very thick smoke", { smoke: 3, dust: 0, cloud: 0, above: false, haze: 0, sand: false, sun: 55 }],
  ["Bright desert", { smoke: 0.8, dust: 0, cloud: 0, above: false, haze: 0, sand: true, sun: 55 }],
  ["Dust storm", { smoke: 0, dust: 1.2, cloud: 0.15, above: false, haze: 0, sand: false, sun: 55 }],
  ["Low sun", { smoke: 0.9, dust: 0, cloud: 0, above: false, haze: 0, sand: false, sun: 10 }],
];
function maskSimHtml() {
  return `<figure class="retrieval" id="mk">
    <div class="trybar" style="margin-top:0" role="group" aria-label="Example scenes"><span class="lab">Examples:</span>${MK_PRESETS.map(([n], i) => `<button type="button" class="chip small" data-mk="${i}">${n}</button>`).join("")}</div>
    <div class="mk-maps">
      <div><div class="mk-title">What is really there</div><canvas id="mk-truth" class="smooth" width="480" height="320" role="img" aria-label="The scene from above: ground, water, clouds, smoke and dust"></canvas></div>
      <div><div class="mk-title">What the mask reports <span class="seg" role="group" aria-label="Instrument"><button type="button" id="mk-tempo">TEMPO</button><button type="button" id="mk-abi">ABI</button></span></div><canvas id="mk-mask" width="480" height="320" role="img" aria-label="The smoke and dust mask computed for this scene"></canvas></div>
    </div>
    <div class="mk-legend" id="mk-legend"></div>
    <div class="mx-share" id="mk-stats" aria-live="polite"></div>
    <div class="rt-controls">
      <div class="row"><label for="mk-smoke">Smoke (peak AOD)</label><input type="range" id="mk-smoke" min="0" max="3" step="0.05"><span class="val" id="mk-smokeV"></span></div>
      <div class="row"><label for="mk-dust">Dust (peak AOD)</label><input type="range" id="mk-dust" min="0" max="2" step="0.05"><span class="val" id="mk-dustV"></span></div>
      <div class="row"><label for="mk-cloud">Cloud cover</label><input type="range" id="mk-cloud" min="0" max="0.8" step="0.02"><span class="val" id="mk-cloudV"></span></div>
      <div class="row"><label for="mk-haze">Thin haze (AOD)</label><input type="range" id="mk-haze" min="0" max="0.5" step="0.02"><span class="val" id="mk-hazeV"></span></div>
      <div class="row"><label for="mk-sun">Sun above horizon</label><input type="range" id="mk-sun" min="8" max="70" step="1"><span class="val" id="mk-sunV"></span></div>
      <div class="row"><input type="checkbox" id="mk-above"><label for="mk-above" style="color:var(--fg)">Smoke is above the clouds</label></div>
      <div class="row"><input type="checkbox" id="mk-sand"><label for="mk-sand" style="color:var(--fg)">Bright ground (white sand) in the northeast</label></div>
      <div class="row"><input type="checkbox" id="mk-quant"><label for="mk-quant" style="color:var(--fg)">Quantitative use: keep high and medium confidence only</label></div>
    </div>
    <figcaption><span>Build a scene on the left and watch the mask on the right. The fire is at the west edge; its smoke drifts east and thins. A lake sits in the southwest.</span>
    <span class="note">A simplified model of the mask's decision steps, with illustrative thresholds. See "What this mask model simplifies" below.</span></figcaption>
  </figure>
  <details class="model-notes">
    <summary>What this mask model simplifies, and where to find the real algorithm</summary>
    <p>Each pixel goes through the same kinds of steps as the real products, in a simplified form:</p>
    <ul>
      <li><b>Cloud screening.</b> Cloudy pixels are not retrieved. Very thick smoke (AOD above 2 here) is mistaken for cloud by the upstream cloud mask, leaving a gap in the plume's core.</li>
      <li><b>UV aerosol index.</b> Smoke and dust raise it in proportion to their amount; non-absorbing haze lowers it slightly; a low sun adds noise. TEMPO only: smoke above a cloud is caught, because absorbing smoke over a bright cloud gives a strong signal (the "call-back").</li>
      <li><b>Bright ground.</b> White sand gives a false aerosol signal, so it can show up as smoke.</li>
      <li><b>Smoke or dust.</b> TEMPO labels thin dust over vegetation, and dust over water, as smoke, as the training notes. ABI identifies dust over water well.</li>
      <li><b>Confidence.</b> Low, medium and high come from how far the signal is above the threshold. ABI's mask is presence-only, and it misses thin smoke (here, AOD below 0.6) because it has no UV bands.</li>
    </ul>
    <p>The real algorithm combines many more spectral tests with careful thresholds tuned on real data. It is described in the <a href="https://www.nesdis.noaa.gov/s3/2025-12/ATBD_Enterprise_Aerosol_Detection_Product_v1.1_2024-03-18.pdf" target="_blank" rel="noopener">Aerosol Detection Product Algorithm Theoretical Basis Document</a> (Ciren, Kondragunta and Huff, 2024), cited in the training.</p>
  </details>`;
}
function initMaskSim() {
  const $ = id => document.getElementById(id); if (!$("mk")) return;
  const NX = 60, NY = 40, CS = 8, o = { ...MK_START, ...MK_PRESETS[0][1] };
  // fixed random fields so the scene stays put while sliders move
  let seed = 101; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const noiseF = Array.from({ length: NX * NY }, () => { let s = 0; for (let k = 0; k < 6; k++) s += rnd(); return (s - 3) / 0.71; });   // ~N(0,1)
  const lat = []; for (let i = 0; i < 6 * 5; i++) lat.push(rnd());
  const smooth = (x, y) => { const v = (gx, gy, s) => { const xs = x / s, ys = y / s, x0 = Math.floor(xs), y0 = Math.floor(ys), fx = xs - x0, fy = ys - y0;
      const h = (a, b) => { const t = Math.sin((a + gx) * 127.1 + (b + gy) * 311.7) * 43758.5453; return t - Math.floor(t); };
      const sm = t => t * t * (3 - 2 * t), a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
      return a + (b - a) * sm(fx) + (c - a) * sm(fy) + (a - b - c + d) * sm(fx) * sm(fy); };
    return 0.55 * v(3, 7, 9) + 0.3 * v(11, 2, 4.5) + 0.15 * v(5, 13, 2.2); };
  const CLOUDF = []; for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) CLOUDF.push(smooth(x, y));
  const sortedC = CLOUDF.slice().sort((a, b) => b - a);
  const surface = (x, y) => (Math.hypot((x - 10) / 9, (y - 31) / 6) < 1 ? "water" : (o.sand && Math.hypot((x - 47) / 9, (y - 9) / 6) < 1 ? "sand" : "veg"));
  const smokeAt = (x, y) => { if (x < 3) return 0; const w = 1.4 + 0.2 * (x - 3), c = 19 + 0.08 * (x - 3); return o.smoke * Math.exp(-((y - c) ** 2) / (2 * w * w)) * Math.exp(-(x - 3) / 40) * Math.min(1, (x - 2) / 3); };
  const dustAt = (x, y) => o.dust * Math.exp(-((x - 30) ** 2) / (2 * 11 * 11) - ((y - 31) ** 2) / (2 * 4.5 * 4.5));
  function classify(x, y, sensor) {
    const i = y * NX + x, sm = smokeAt(x, y), du = dustAt(x, y), surf = surface(x, y);
    const thr = o.cloud > 0 ? sortedC[Math.max(0, Math.round(o.cloud * NX * NY) - 1)] : 2, cloudy = CLOUDF[i] >= thr;
    const sigma = 0.2 + 0.42 * Math.max(0, 50 - o.sun) / 42, n = noiseF[i] * sigma;
    const truth = sm >= 0.2 ? "smoke" : du >= 0.2 ? "dust" : "none";
    if (cloudy) {
      if (sensor === "tempo" && o.above && sm > 0.1) { const aai = 5.0 * sm + n; if (aai > 1) return { cls: "smokecloud", conf: aai > 4 ? 3 : aai > 2 ? 2 : 1, truth, hidden: false }; }
      return { cls: "cloud", truth, hidden: true };
    }
    if (sm > 2.0) return { cls: "cloud", truth, hidden: true, thick: true };   // thick smoke read as cloud upstream
    if (sensor === "abi") {
      if (sm > 0.6 && sm >= du) return { cls: "smoke", conf: 0, truth };
      if (du > 0.3) return { cls: "dust", conf: 0, truth };
      if (surf === "sand" && noiseF[i] > 0.6) return { cls: "smoke", conf: 0, truth };
      return { cls: "none", truth };
    }
    const aai = 4.0 * sm + 2.8 * du - 0.4 * o.haze + n + (surf === "sand" ? 1.5 : 0);
    if (aai < 1) return { cls: "none", truth };
    const conf = aai > 4 ? 3 : aai > 2 ? 2 : 1;
    let cls = du > sm ? "dust" : "smoke";
    if (cls === "dust" && (surf === "water" || du < 0.4)) cls = "smoke";       // TEMPO's known dust-as-smoke cases
    return { cls, conf, truth };
  }
  // the "really there" map is drawn smoothly at full canvas resolution; the mask stays per pixel, as real masks are
  const TW = NX * CS, TH = NY * CS, FINE = new Float32Array(TW * TH);
  const EDGE = new Float32Array(TW * TH);
  for (let py = 0; py < TH; py++) for (let px = 0; px < TW; px++) { FINE[py * TW + px] = smooth(px / CS - 0.5, py / CS - 0.5); EDGE[py * TW + px] = smooth(px / CS * 2.6 + 40, py / CS * 2.6 + 40); }
  const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const ellipse = (fx, fy, cx, cy, rx, ry) => Math.hypot((fx - cx) / rx, (fy - cy) / ry);
  function drawTruth(thr) {
    const ctx = $("mk-truth").getContext("2d"), img = ctx.createImageData(TW, TH), d = img.data, on = o.cloud > 0;
    const mix = (c, t, a) => { c[0] += (t[0] - c[0]) * a; c[1] += (t[1] - c[1]) * a; c[2] += (t[2] - c[2]) * a; };
    for (let py = 0; py < TH; py++) for (let px = 0; px < TW; px++) {
      const fx = px / CS - 0.5, fy = py / CS - 0.5, c = [168, 199, 140];                              // light grassland
      c[0] += 6 * Math.sin(fx * 0.9 + fy * 0.4); c[1] += 6 * Math.sin(fx * 0.5 - fy * 0.8);            // gentle texture
      const lake = ellipse(fx, fy, 10, 31, 9, 6); if (lake < 1.04) mix(c, [70, 130, 190], sstep(1.04, 0.96, lake));
      if (o.sand) { const sd = ellipse(fx, fy, 47, 9, 9, 6); if (sd < 1.1) mix(c, [242, 236, 216], sstep(1.1, 0.92, sd)); }
      if (o.haze > 0) mix(c, [228, 231, 238], Math.min(0.8, o.haze * 1.4));
      const sm = smokeAt(fx, fy), du = dustAt(fx, fy), f = FINE[py * TW + px];
      const aer = () => { if (du > 0.01) mix(c, [196, 134, 63], Math.min(0.8, du * 0.55)); if (sm > 0.01) mix(c, [92, 80, 70], Math.min(0.88, sm * 0.5)); };
      const cloud = () => {
        if (!on) return;
        const sh = FINE[Math.min(TH - 1, py + 5) * TW + Math.max(0, px - 5)];                           // soft shadow cast to the southeast
        if (sh > thr - 0.04) mix(c, [60, 70, 80], 0.18 * sstep(thr - 0.04, thr + 0.04, sh));
        const fb = f + 0.045 * (EDGE[py * TW + px] - 0.5);   // small-scale noise gives billowy edges
        const a = sstep(thr - 0.03, thr + 0.025, fb); if (a <= 0) return;
        const lit = Math.max(-1, Math.min(1, (f - FINE[Math.min(TH - 1, py + 3) * TW + Math.min(TW - 1, px + 3)]) * 14));  // lit from the northwest
        const v = 226 + 18 * lit + 12 * sstep(thr, thr + 0.12, f);
        mix(c, [v, v + 1, Math.min(255, v + 5)], 0.97 * a);
      };
      if (o.above) { cloud(); aer(); } else { aer(); cloud(); }
      const i = 4 * (py * TW + px); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  const MCOL = { smoke: [[201, 184, 166], [155, 133, 115], [94, 75, 60]], dust: [[240, 210, 160], [217, 165, 92], [168, 112, 42]], abiSmoke: [110, 91, 74], abiDust: [196, 134, 63] };
  function draw() {
    const mg = $("mk-mask").getContext("2d");
    const thr = o.cloud > 0 ? sortedC[Math.max(0, Math.round(o.cloud * NX * NY) - 1)] : 2;
    drawTruth(thr);
    const st = { ok: 0, wrong: 0, missed: 0, hidden: 0, falsePos: 0, cut: 0 };
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
      const i = y * NX + x, X = x * CS, Y = y * CS, sm = smokeAt(x, y), du = dustAt(x, y), cloudy = CLOUDF[i] >= thr;
      // mask
      const r = classify(x, y, o.sensor);
      let c = [214, 220, 226];
      if (r.cls === "cloud") c = [255, 255, 255];
      else if (r.cls === "smoke" || r.cls === "smokecloud") c = o.sensor === "abi" ? MCOL.abiSmoke : MCOL.smoke[r.conf - 1];
      else if (r.cls === "dust") c = o.sensor === "abi" ? MCOL.abiDust : MCOL.dust[r.conf - 1];
      const dropped = o.quant && o.sensor === "tempo" && (r.cls === "smoke" || r.cls === "dust" || r.cls === "smokecloud") && r.conf === 1;
      if (dropped) c = [214, 220, 226];
      mg.fillStyle = `rgb(${c.join(",")})`; mg.fillRect(X, Y, CS, CS);
      if (r.cls === "cloud") { mg.strokeStyle = "rgba(120,130,140,.55)"; mg.beginPath(); mg.moveTo(X, Y + CS); mg.lineTo(X + CS, Y); mg.stroke(); }
      if (r.cls === "smokecloud" && !dropped) { mg.fillStyle = "rgba(255,255,255,.75)"; mg.fillRect(X + 2, Y + 2, 4, 4); }
      // stats
      const found = !dropped && ["smoke", "dust", "smokecloud"].includes(r.cls), type = r.cls === "smokecloud" ? "smoke" : r.cls;
      if (r.truth !== "none") { if (r.hidden) st.hidden++; else if (!found) { st.missed++; if (dropped) st.cut++; } else if (type === r.truth) st.ok++; else st.wrong++; }
      else if (found) st.falsePos++;
    }
    const total = st.ok + st.wrong + st.missed + st.hidden;
    $("mk-stats").innerHTML = total || st.falsePos ? `Of ${total} pixels that really contain smoke or dust: <b>${st.ok}</b> found with the right type, <b>${st.wrong}</b> found but labeled the wrong type, <b>${st.missed}</b> missed${st.cut ? ` (${st.cut} of them dropped as low confidence)` : ""}, <b>${st.hidden}</b> not retrieved (under cloud or read as cloud). False detections where there is none: <b>${st.falsePos}</b>.` : "No smoke or dust in this scene.";
    $("mk-smokeV").textContent = o.smoke.toFixed(2); $("mk-dustV").textContent = o.dust.toFixed(2); $("mk-cloudV").textContent = Math.round(o.cloud * 100) + "%";
    $("mk-hazeV").textContent = o.haze.toFixed(2); $("mk-sunV").textContent = o.sun + "°";
    $("mk-tempo").setAttribute("aria-pressed", String(o.sensor === "tempo")); $("mk-abi").setAttribute("aria-pressed", String(o.sensor === "abi"));
    $("mk-quant").disabled = o.sensor === "abi";
    const sw = (rgb, t, extra = "") => `<span class="mk-key"><i style="background:rgb(${rgb.join(",")})${extra}"></i>${t}</span>`;
    $("mk-legend").innerHTML = o.sensor === "tempo"
      ? `${sw(MCOL.smoke[0], "smoke, low")}${sw(MCOL.smoke[1], "medium")}${sw(MCOL.smoke[2], "high")}${sw(MCOL.dust[0], "dust, low")}${sw(MCOL.dust[1], "medium")}${sw(MCOL.dust[2], "high")}${sw(MCOL.smoke[1], "smoke above cloud", ";box-shadow:inset 0 0 0 3px #fff")}${sw([255, 255, 255], "cloud: not retrieved", ";border:1px solid #9aa")}${sw([214, 220, 226], "no aerosol detected")}`
      : `${sw(MCOL.abiSmoke, "smoke (presence only)")}${sw(MCOL.abiDust, "dust (presence only)")}${sw([255, 255, 255], "cloud: not retrieved", ";border:1px solid #9aa")}${sw([214, 220, 226], "no aerosol detected")}`;
  }
  const sync = () => { ["smoke", "dust", "cloud", "haze", "sun"].forEach(k => { $("mk-" + k).value = o[k]; }); $("mk-above").checked = o.above; $("mk-sand").checked = o.sand; $("mk-quant").checked = !!o.quant; draw(); };
  ["smoke", "dust", "cloud", "haze", "sun"].forEach(k => $("mk-" + k).addEventListener("input", e => { o[k] = +e.target.value; draw(); }));
  $("mk-above").addEventListener("change", e => { o.above = e.target.checked; draw(); });
  $("mk-sand").addEventListener("change", e => { o.sand = e.target.checked; draw(); });
  $("mk-quant").addEventListener("change", e => { o.quant = e.target.checked; draw(); });
  $("mk-tempo").addEventListener("click", () => { o.sensor = "tempo"; draw(); });
  $("mk-abi").addEventListener("click", () => { o.sensor = "abi"; draw(); });
  document.querySelectorAll("#mk [data-mk]").forEach(b => b.addEventListener("click", () => { Object.assign(o, MK_PRESETS[+b.dataset.mk][1]); sync(); }));
  sync();
}

// ---- 2D AOD lab: AOD = how dense the aerosol is × how deep the layer is; the Sun's angle sets how much of it sunlight crosses ----
function aodLabHtml() {
  return `<figure class="retrieval" id="al">
    <svg class="fig wide" id="al-svg" viewBox="0 0 640 300" role="img" aria-label="Side view of an aerosol layer above the ground, with a vertical beam and a beam from the Sun, showing how much light each loses crossing the layer."></svg>
    <div class="al-out" id="al-out" aria-live="polite"></div>
    <div class="rt-controls">
      <div class="row"><label for="al-dens">How dense the aerosol is</label><input type="range" id="al-dens" min="0" max="1" step="0.01"><span class="val" id="al-densV"></span></div>
      <div class="row"><label for="al-depth">How deep the layer is</label><input type="range" id="al-depth" min="0.2" max="4" step="0.05"><span class="val" id="al-depthV"></span></div>
      <div class="row"><label for="al-sun">Sun above the horizon</label><input type="range" id="al-sun" min="5" max="90" step="1"><span class="val" id="al-sunV"></span></div>
    </div>
    <figcaption><span>AOD adds up all the aerosol in a vertical column: how much light each kilometer of hazy air removes, times how many kilometers there are. Try halving the density and doubling the depth: the AOD doesn't change, which is why AOD alone can't tell you where the aerosol is. The Sun's angle doesn't change the AOD either, but a low Sun's light crosses much more of the layer, so far less of it gets through.</span>
    <span class="note">Density is given as the fraction of light removed per kilometer (the extinction coefficient, per km). The slanted path uses the flat-atmosphere approximation, 1/sin(Sun angle), which overstates the path when the Sun is within a few degrees of the horizon.</span></figcaption>
  </figure>`;
}
function initAodLab() {
  const $ = id => document.getElementById(id); if (!$("al")) return;
  const o = { dens: 0.3, depth: 1.5, sun: 45 };
  const GY = 262, KM = 46, GX = 470, D2R = Math.PI / 180;
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const DOTS = Array.from({ length: 900 }, () => [rnd(), rnd(), 1.4 + rnd() * 1.6]);
  function beam(x0, y0, x1, y1, enterU, tau) {   // a sunlight beam that fades inside the layer, from parameter enterU (0..1) to the ground
    let g = ""; const N = 36;
    for (let k = 0; k < N; k++) {
      const u0 = k / N, u1 = (k + 1) / N, xa = x0 + (x1 - x0) * u0, ya = y0 + (y1 - y0) * u0, xb = x0 + (x1 - x0) * u1, yb = y0 + (y1 - y0) * u1;
      const inside = Math.max(0, (u0 - enterU) / Math.max(1e-6, 1 - enterU)), f = Math.exp(-tau * inside);
      g += `<line x1="${xa.toFixed(1)}" y1="${ya.toFixed(1)}" x2="${xb.toFixed(1)}" y2="${yb.toFixed(1)}" style="stroke:var(--sun);stroke-width:${(1 + 5 * f).toFixed(2)};stroke-opacity:${(0.2 + 0.8 * f).toFixed(3)};stroke-linecap:round"/>`;
    }
    return g;
  }
  function draw() {
    const aod = o.dens * o.depth, e = o.sun * D2R, slant = 1 / Math.sin(e), tauS = aod * slant;
    const top = GY - o.depth * KM;
    let g = `<defs><clipPath id="al-clip"><rect x="0" y="0" width="640" height="300"/></clipPath></defs><g clip-path="url(#al-clip)">`;
    g += `<rect x="0" y="0" width="640" height="${GY}" style="fill:var(--scene)"/><rect x="0" y="${GY}" width="640" height="${300 - GY}" style="fill:#a9c98f"/>`;
    for (let km = 1; km <= 5; km++) g += `<line x1="38" x2="44" y1="${GY - km * KM}" y2="${GY - km * KM}" style="stroke:var(--muted)"/><text x="34" y="${GY - km * KM + 3}" text-anchor="end">${km} km</text>`;
    g += `<line x1="44" x2="44" y1="${GY - 5 * KM}" y2="${GY}" style="stroke:var(--muted)"/>`;
    // the aerosol layer: dot count grows with density, spread over the layer's depth
    g += `<rect x="50" y="${top}" width="590" height="${GY - top}" style="fill:var(--smoke);opacity:${Math.min(0.35, 0.05 + 0.3 * o.dens)}"/>`;
    const n = Math.round(900 * o.dens * Math.min(1, o.depth / 4) + 0);
    for (let i = 0; i < n; i++) { const [a, b, r] = DOTS[i]; g += `<circle cx="${(52 + a * 586).toFixed(1)}" cy="${(top + b * (GY - top)).toFixed(1)}" r="${(r * 0.9).toFixed(2)}" style="fill:var(--smoke);opacity:.8"/>`; }
    g += `<line x1="50" x2="640" y1="${top}" y2="${top}" style="stroke:var(--smoke);stroke-dasharray:4 3"/>`;
    // straight-down beam
    const VX = 600; g += beam(VX, 6, VX, GY, (top - 6) / (GY - 6), aod);
    g += `<text x="${VX - 10}" y="20" text-anchor="end" class="strong">straight down</text>`;
    // the Sun's beam, aimed at the ground point GX
    const len = 700, sx = GX - len * Math.cos(e), sy = GY - len * Math.sin(e), enter = 1 - (GY - top) / (GY - sy);
    g += beam(sx, sy, GX, GY, enter, tauS);
    let sunX = sx, sunY = sy; const kx = sx < 80 ? (GX - 80) / (GX - sx) : 1, ky = sy < 30 ? (GY - 30) / (GY - sy) : 1, k = Math.min(kx, ky);
    sunX = GX - (GX - sx) * k; sunY = GY - (GY - sy) * k;
    g += `<circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="18" style="fill:var(--sun)"/>`;
    g += `<path d="M ${GX - 46} ${GY} A 46 46 0 0 1 ${(GX - 46 * Math.cos(e)).toFixed(1)} ${(GY - 46 * Math.sin(e)).toFixed(1)}" style="fill:none;stroke:var(--fg);stroke-width:1.2"/><text x="${GX - 52}" y="${GY - 8}" text-anchor="end" class="strong">${o.sun}°</text>`;
    g += `</g>`;
    $("al-svg").innerHTML = g;
    const pc = f => { const v = 100 * f; return v < 1 ? (v < 0.1 ? "<0.1%" : v.toFixed(1) + "%") : Math.round(v) + "%"; };
    $("al-out").innerHTML = `<div><span class="al-k">AOD</span><b>${aod.toFixed(2)}</b><span class="al-s">${o.dens.toFixed(2)} per km × ${o.depth.toFixed(2)} km</span></div>
      <div><span class="al-k">Straight down</span><b>${pc(Math.exp(-aod))}</b><span class="al-s">of direct light gets through</span></div>
      <div><span class="al-k">From the Sun</span><b>${pc(Math.exp(-tauS))}</b><span class="al-s">gets through; the path is ${slant.toFixed(1)}× longer</span></div>`;
    $("al-densV").textContent = o.dens.toFixed(2) + " /km"; $("al-depthV").textContent = o.depth.toFixed(2) + " km"; $("al-sunV").textContent = o.sun + "°";
  }
  [["al-dens", "dens"], ["al-depth", "depth"], ["al-sun", "sun"]].forEach(([id, k]) => { $(id).value = o[k]; $(id).addEventListener("input", ev => { o[k] = +ev.target.value; draw(); }); });
  draw();
}

// ---- GWR lab: the PM2.5 product's regression, run on an imaginary region ----
// Follows the TEMPO-ABI PM2.5 Users' Guide (V1, Jan 2025): every hour, at every grid cell, fit PM2.5 = A + B·AOD + C·ALH to
// AirNow monitors, each weighted by exp(-distance / 50 km); pixels with no ALH use a default height of 1 km.
// What is invented here: the region, the smoke, the monitors and the conversion from smoke to surface PM2.5.
function gwrHtml() {
  return `<figure class="retrieval" id="gw">
    <div class="trybar" style="margin-top:0" role="group" aria-label="Example situations"><span class="lab">Examples:</span>${GW_PRESETS.map(([n], i) => `<button type="button" class="chip small" data-gw="${i}">${n}</button>`).join("")}</div>
    <div class="gw-maps">
      <div><div class="mk-title">What the satellite sees: AOD</div><canvas id="gw-aod" width="240" height="160" role="img" aria-label="Satellite AOD with monitor locations"></canvas></div>
      <div><div class="mk-title">True surface PM2.5</div><canvas id="gw-true" width="240" height="160" role="img" aria-label="True surface PM2.5"></canvas></div>
      <div><div class="mk-title">Estimated PM2.5 (GWR)</div><canvas id="gw-est" width="240" height="160" role="img" aria-label="PM2.5 estimated by geographically weighted regression"></canvas></div>
    </div>
    <div class="mk-legend" id="gw-legend"></div>
    <div class="mx-share" id="gw-stats" aria-live="polite"></div>
    <div class="mx-share" id="gw-probe">Hover over the estimate map to see the regression fitted at that spot.</div>
    <div class="rt-controls">
      <div class="row"><label for="gw-smoke">Smoke amount (peak AOD)</label><input type="range" id="gw-smoke" min="0" max="2" step="0.05"><span class="val" id="gw-smokeV"></span></div>
      <div class="row"><label for="gw-lift">Smoke rises downwind</label><input type="range" id="gw-lift" min="0" max="1.6" step="0.05"><span class="val" id="gw-liftV"></span></div>
      <div class="row"><label for="gw-mon">AirNow monitors</label><input type="range" id="gw-mon" min="6" max="60" step="1"><span class="val" id="gw-monV"></span></div>
      <div class="row"><label for="gw-cloud">Cloud cover</label><input type="range" id="gw-cloud" min="0" max="0.6" step="0.02"><span class="val" id="gw-cloudV"></span></div>
      <div class="row"><span id="gw-modelL" style="color:var(--muted);min-width:9em">Regression uses</span><div class="seg" role="group" aria-labelledby="gw-modelL"><button type="button" id="gw-m-aod">AOD only</button><button type="button" id="gw-m-alh">AOD + ALH (as documented)</button></div></div>
      <div class="row"><input type="checkbox" id="gw-edge"><label for="gw-edge" style="color:var(--fg)">Cloud contamination: AOD too high next to clouds</label></div>
    </div>
    <figcaption><span>An imaginary 600 × 400 km region. "AOD + ALH" is the regression documented for the product; "AOD only" drops the height, for comparison. A fire on the west edge sends smoke east; with "Smoke rises downwind" turned up, the plume lifts above the boundary layer as it travels, so the satellite still sees it but the air at the ground clears. Black dots are AirNow monitors, clustered in four cities. Each estimate is a local regression, so it depends on which monitors are near and what they report.</span>
    <span class="note">The regression follows the product's documentation; the scene is invented. See "How close this is to the real product" below.</span></figcaption>
  </figure>
  <details class="model-notes">
    <summary>How close this is to the real product</summary>
    <p><b>Same as the product</b>, per the <a href="https://www.star.nesdis.noaa.gov/data/pub0008/akhuff/ACC_Product_Documentation/TEMPO-ABI_PM2.5_Users_Guide_V1_20250107.pdf" target="_blank" rel="noopener">TEMPO-ABI PM2.5 Users' Guide</a> (version 1, January 2025):</p>
    <ul>
      <li>The model at each grid cell: PM2.5 = A + B × AOD + C × ALH, with A, B and C refitted every hour from the satellite values at AirNow monitors.</li>
      <li>Each monitor's weight falls off as exp(−distance / 50 km).</li>
      <li>Where TEMPO has no layer height (AOD below 0.2), the height defaults to 1 km.</li>
      <li>No estimate where there is no AOD, for example under clouds; and cloud contamination makes estimates noisy along cloud edges.</li>
    </ul>
    <p><b>Simplified or invented here</b></p>
    <ul>
      <li>The region, the smoke plume, the monitor locations and the "true" PM2.5 are made up. The true PM2.5 is a simple rule: smoke counts toward surface PM2.5 only to the extent it sits inside a 1.5 km boundary layer.</li>
      <li>One AOD map stands in for the merged TEMPO and ABI AOD (the product averages them where both exist), on 5 km cells instead of 2 km.</li>
      <li>The training's 2026 slides describe a newer version: TEMPO's estimate uses the part of the AOD inside the boundary layer (found with ALH), and it is merged with a separate ABI estimate, not averaged with it when the aerosol is above 3 km or is dust. Those details aren't in the public user's guide, so the lab uses the documented version. The method paper is <a href="https://doi.org/10.1029/2025EA004959" target="_blank" rel="noopener">Zhang, Kondragunta and Wei (2026)</a>.</li>
    </ul>
    <p>The product's own validation against held-out monitors: R² = 0.70 and RMSE = 9.3 µg/m³ for the ABI-only estimate, and R² = 0.64 and RMSE = 10.2 µg/m³ with TEMPO included (Users' Guide, 10-fold cross-validation).</p>
  </details>`;
}
const GW_PRESETS = [
  ["Smoke near the ground", { smoke: 1.2, lift: 0, mon: 40, cloud: 0, model: "alh", edge: false }],
  ["Smoke lifts downwind", { smoke: 1.2, lift: 1.2, mon: 20, cloud: 0, model: "alh", edge: false }],
  ["Same, AOD only", { smoke: 1.2, lift: 1.2, mon: 20, cloud: 0, model: "aod", edge: false }],
  ["Few monitors", { smoke: 1.2, lift: 0.6, mon: 10, cloud: 0, model: "alh", edge: false }],
  ["Clouds", { smoke: 1.2, lift: 0.4, mon: 40, cloud: 0.35, model: "alh", edge: true }],
];
function initGwr() {
  const $ = id => document.getElementById(id); if (!$("gw")) return;
  const NX = 120, NY = 80, KM = 5, H = 50, o = { ...GW_PRESETS[1][1] };
  let seed = 31; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => { let s = 0; for (let k = 0; k < 6; k++) s += rnd(); return (s - 3) / 0.71; };
  const CITIES = [[150, 120], [330, 260], [470, 110], [520, 320]];
  // monitor list: city clusters first, then scattered rural sites, so "fewer monitors" keeps the cities
  const MON = [];
  for (let k = 0; k < 6; k++) CITIES.forEach(([cx, cy]) => MON.push([cx + gauss() * 14, cy + gauss() * 14]));
  for (let k = 0; k < 36; k++) MON.push([20 + rnd() * 560, 20 + rnd() * 360]);
  const ORDER = MON.map((m, i) => i).sort((a, b) => (a < 8 ? a : a < 24 ? 100 + a : 1000 + ((a * 7919) % 97)) - (b < 8 ? b : b < 24 ? 100 + b : 1000 + ((b * 7919) % 97)));
  const nz = Array.from({ length: NX * NY }, gauss), mz = MON.map(gauss);
  const cloudF = []; for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const x = i / 9, y = j / 9; cloudF.push(0.5 + 0.3 * Math.sin(x * 1.3 + 0.7) * Math.cos(y * 1.1 - 0.4) + 0.2 * Math.sin(x * 2.9 + y * 2.3)); }
  const sortedC = cloudF.slice().sort((a, b) => b - a);
  function field() {   // true PM2.5, satellite AOD, ALH, cloud mask on the grid
    const thr = o.cloud > 0 ? sortedC[Math.round(o.cloud * NX * NY) - 1] : 9;
    const F = { smoke: new Float32Array(NX * NY), pm: new Float32Array(NX * NY), aod: new Float32Array(NX * NY), alh: new Float32Array(NX * NY), cloud: new Uint8Array(NX * NY) };
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, x = (i + 0.5) * KM, y = (j + 0.5) * KM;
      const urban = CITIES.reduce((s, [cx, cy]) => s + Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * 22 * 22)), 0);
      const w = 25 + 0.22 * x, yc = 200 + 0.12 * (x - 300), smoke = x < 15 ? 0 : o.smoke * Math.exp(-((y - yc) ** 2) / (2 * w * w)) * Math.exp(-x / 650);
      const height = 0.6 + o.lift * Math.max(0, x - 80) / 100;                       // km above ground
      const inPbl = 1 / (1 + Math.exp((height - 1.5) / 0.3));                          // share of the smoke inside a 1.5 km boundary layer
      F.pm[k] = Math.max(1, 5 + 9 * urban + 70 * smoke * inPbl + 1.2 * nz[k]);
      F.cloud[k] = cloudF[k] >= thr ? 1 : 0; F.smoke[k] = smoke;
      const aodTrue = 0.07 + 0.08 * urban + smoke;
      F.aod[k] = Math.max(0, aodTrue + 0.025 * nz[(k * 31) % (NX * NY)]);
      F.alh[k] = F.aod[k] >= 0.2 ? (smoke > 0.1 ? height : 0.8) + 0.15 * nz[(k * 17) % (NX * NY)] : 1.0;   // default 1 km where ALH isn't retrieved
    }
    if (o.edge) for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) { const k = j * NX + i; if (!F.cloud[k] && (F.cloud[k - 1] || F.cloud[k + 1] || F.cloud[k - NX] || F.cloud[k + NX])) F.aod[k] += 0.35; }
    return F;
  }
  let F, fitAt = null;
  function solve3(M, v) {   // 3x3 linear solve (Gaussian elimination)
    const a = M.map((r, i) => [...r, v[i]]);
    for (let c = 0; c < 3; c++) { let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r; [a[c], a[p]] = [a[p], a[c]];
      if (Math.abs(a[c][c]) < 1e-12) return null; for (let r = 0; r < 3; r++) if (r !== c) { const f = a[r][c] / a[c][c]; for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k]; } }
    return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
  }
  const pred = (aod, alh) => o.model === "alh" ? [1, aod, alh] : [1, aod, 0];   // the documented model, or the same without ALH
  function run() {
    F = field();
    const mons = ORDER.slice(0, o.mon).map(m => { const [x, y] = MON[m], i = Math.min(NX - 1, Math.floor(x / KM)), j = Math.min(NY - 1, Math.floor(y / KM)), k = j * NX + i;
      return { x, y, k, ok: !F.cloud[k], pm: Math.max(1, F.pm[k] + 1.5 * mz[m]), aod: F.aod[k], alh: F.alh[k] }; });
    const use = mons.filter(m => m.ok), est = new Float32Array(NX * NY).fill(NaN), coef = new Array(NX * NY);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i; if (F.cloud[k]) continue;
      const x = (i + 0.5) * KM, y = (j + 0.5) * KM, M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0]; let sw = 0;
      use.forEach(m => { const w = Math.exp(-Math.hypot(m.x - x, m.y - y) / H), z = pred(m.aod, m.alh); sw += w;
        for (let a = 0; a < 3; a++) { v[a] += w * z[a] * m.pm; for (let b = 0; b < 3; b++) M[a][b] += w * z[a] * z[b]; } });
      if (sw < 1e-6) continue;
      for (let a = 0; a < 3; a++) M[a][a] += 1e-4 * sw;                          // tiny ridge so sparse neighborhoods stay solvable
      if (o.model !== "alh") M[2][2] += 1;
      const c = solve3(M, v); if (!c) continue;
      const z = pred(F.aod[k], F.alh[k]); est[k] = Math.max(0, c[0] + c[1] * z[1] + c[2] * z[2]); coef[k] = c;
    }
    return { mons, est, coef };
  }
  const AQI = [[9, [0, 228, 0]], [35.4, [255, 255, 0]], [55.4, [255, 126, 0]], [125.4, [255, 0, 0]], [225.4, [143, 63, 151]], [1e9, [126, 0, 35]]];
  const pmCol = v => { for (let n = 0; n < AQI.length; n++) if (v <= AQI[n][0]) { const lo = n ? AQI[n - 1][0] : 0, f = n === AQI.length - 1 ? 0 : (v - lo) / (AQI[n][0] - lo), nx = AQI[Math.min(AQI.length - 1, n + 1)][1], c = AQI[n][1];
    return c.map((q, m) => q + (nx[m] - q) * Math.min(1, Math.max(0, f)) * 0.35); } return AQI[AQI.length - 1][1]; };
  const aodCol = v => { const t = Math.min(1, v / 1.5), s = [[247, 251, 255], [158, 202, 225], [66, 146, 198], [8, 69, 148], [8, 29, 88]], x = t * 4, i = Math.min(3, Math.floor(x)), f = x - i; return s[i].map((q, m) => q + (s[i + 1][m] - q) * f); };
  function paint(id, fn) {
    const ctx = $(id).getContext("2d"), img = ctx.createImageData(NX * 2, NY * 2), d = img.data;
    for (let py = 0; py < NY * 2; py++) for (let px = 0; px < NX * 2; px++) { const k = (py >> 1) * NX + (px >> 1), c = fn(k), q = 4 * (py * NX * 2 + px); d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255; }
    ctx.putImageData(img, 0, 0); return ctx;
  }
  let last = null;
  function draw() {
    const R = run(); last = R;
    const CL = [236, 239, 243];
    const a = paint("gw-aod", k => F.cloud[k] ? CL : aodCol(F.aod[k]));
    R.mons.forEach(m => { a.beginPath(); a.arc(m.x / KM * 2, m.y / KM * 2, 2.6, 0, 2 * Math.PI); a.fillStyle = m.ok ? "#111" : "#999"; a.fill(); a.strokeStyle = "#fff"; a.lineWidth = 1; a.stroke(); });
    paint("gw-true", k => pmCol(F.pm[k]));
    paint("gw-est", k => isNaN(R.est[k]) ? CL : pmCol(R.est[k]));
    // accuracy over cells with an estimate
    let n = 0, se = 0, sb = 0, sy = 0, syy = 0, sxy = 0, sx = 0, sxx = 0, np = 0, sep = 0;
    for (let k = 0; k < NX * NY; k++) { const e = R.est[k]; if (isNaN(e)) continue; const t = F.pm[k]; n++; se += (e - t) ** 2; sb += e - t; sx += t; sxx += t * t; sy += e; syy += e * e; sxy += t * e;
      if (F.smoke[k] > 0.25) { np++; sep += (e - t) ** 2; } }
    const r = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy)), used = R.mons.filter(m => m.ok).length;
    $("gw-stats").innerHTML = n ? `Estimate vs. truth over the ${Math.round(100 * n / (NX * NY))}% of the region with an estimate: R² = <b>${(r * r).toFixed(2)}</b>, typical error (RMSE) = <b>${Math.sqrt(se / n).toFixed(1)} µg/m³</b>${np ? ` (inside the smoke plume: <b>${Math.sqrt(sep / np).toFixed(1)}</b>)` : ""}, average bias = <b>${(sb / n >= 0 ? "+" : "") + (sb / n).toFixed(1)} µg/m³</b>. ${used} of ${R.mons.length} monitors have satellite AOD this hour.` : "No estimates: every cell is cloudy.";
    ["aod", "alh"].forEach(m => $("gw-m-" + m).setAttribute("aria-pressed", String(o.model === m)));
    $("gw-smokeV").textContent = o.smoke.toFixed(2); $("gw-liftV").textContent = o.lift.toFixed(2) + " km/100 km"; $("gw-monV").textContent = o.mon; $("gw-cloudV").textContent = Math.round(o.cloud * 100) + "%";
    const sw = (rgb, t) => `<span class="mk-key"><i style="background:rgb(${rgb.map(Math.round).join(",")})"></i>${t}</span>`;
    $("gw-legend").innerHTML = `PM2.5 (µg/m³, EPA AQI colors): ${sw(AQI[0][1], "0–9")}${sw(AQI[1][1], "9–35")}${sw(AQI[2][1], "35–55")}${sw(AQI[3][1], "55–125")}${sw(AQI[4][1], "125+")} · AOD: ${sw(aodCol(0.1), "0.1")}${sw(aodCol(0.5), "0.5")}${sw(aodCol(1.2), "1.2+")} · ${sw(CL, "cloud: no AOD, no estimate")}`;
  }
  $("gw-est").addEventListener("mousemove", ev => {
    if (!last) return; const r = ev.target.getBoundingClientRect(), i = Math.floor((ev.clientX - r.left) / r.width * NX), j = Math.floor((ev.clientY - r.top) / r.height * NY), k = j * NX + i;
    if (i < 0 || j < 0 || i >= NX || j >= NY) return;
    const c = last.coef[k];
    $("gw-probe").innerHTML = !c ? "No estimate here (cloud, so no AOD)." :
      `Here: PM2.5 = ${c[0].toFixed(1)} + ${c[1].toFixed(1)} × AOD${o.model === "alh" ? ` ${c[2] >= 0 ? "+" : "−"} ${Math.abs(c[2]).toFixed(1)} × ALH` : ""}, with AOD ${F.aod[k].toFixed(2)} and ALH ${F.alh[k].toFixed(1)} km → estimate <b>${last.est[k].toFixed(0)}</b> µg/m³; truth <b>${F.pm[k].toFixed(0)}</b>.`;
  });
  const sync = () => { ["smoke", "lift", "mon", "cloud"].forEach(k => { $("gw-" + k).value = o[k]; }); $("gw-edge").checked = o.edge; draw(); };
  ["smoke", "lift", "mon", "cloud"].forEach(k => $("gw-" + k).addEventListener("input", e => { o[k] = +e.target.value; draw(); }));
  ["aod", "alh"].forEach(m => $("gw-m-" + m).addEventListener("click", () => { o.model = m; draw(); }));
  $("gw-edge").addEventListener("change", e => { o.edge = e.target.checked; draw(); });
  document.querySelectorAll("#gw [data-gw]").forEach(b => b.addEventListener("click", () => { Object.assign(o, GW_PRESETS[+b.dataset.gw][1]); sync(); }));
  sync();
}

// =====================================================================
// Shared helpers for the practical figures
// =====================================================================
const RAD = Math.PI / 180;
function sunPos(ms, lat, lon) {   // solar elevation and azimuth (degrees, azimuth clockwise from north); accurate to ~0.3°
  const d = ms / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * RAD, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24, H = (gmst * 15 + lon) * RAD - ra, la = lat * RAD;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(H));
  return { el: el / RAD, az: (az / RAD + 360) % 360 };
}
const PANDORA = { lat: 30.2285, lon: -97.7544 };
const hhmm = h => { h = ((h % 24) + 24) % 24; const m = Math.round((h % 1) * 60); return `${String(Math.floor(h) + (m === 60 ? 1 : 0)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const fig = (id, inner, caption, note) => `<figure class="retrieval" id="${id}">${inner}<figcaption>${caption ? `<span>${caption}</span>` : ""}${note ? `<span class="note">${note}</span>` : ""}</figcaption></figure>`;
const slider = (id, label, min, max, step) => `<div class="row"><label for="${id}">${label}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}"><span class="val" id="${id}V"></span></div>`;
function bindSliders(o, spec, draw) {   // spec: [[id, key, format]]
  const $ = id => document.getElementById(id);
  spec.forEach(([id, k, f]) => { const el = $(id); el.value = o[k]; el.addEventListener("input", e => { o[k] = +e.target.value; draw(); }); });
  return () => spec.forEach(([id, k, f]) => { $(id).value = o[k]; $(id + "V").textContent = f(o[k]); });
}

// =====================================================================
// Inline figure: what "layer height" means for a real profile (Aerosol Layer Height)
// =====================================================================
function alhProfileHtml() {
  return fig("ap", `<svg class="fig wide" id="ap-svg" viewBox="0 0 620 300" role="img" aria-label="Aerosol extinction profile with two adjustable layers, the boundary layer top and the reported layer height."></svg>
    <div class="al-out" id="ap-out" aria-live="polite"></div>
    <div class="rt-controls">
      ${slider("ap-h1", "Layer 1 height", 0.3, 7, 0.1)}${slider("ap-a1", "Layer 1 AOD", 0, 1.5, 0.02)}
      ${slider("ap-h2", "Layer 2 height", 0.3, 7, 0.1)}${slider("ap-a2", "Layer 2 AOD", 0, 1.5, 0.02)}
    </div>`,
    "The curve shows how much light the aerosol removes at each height (extinction). TEMPO's layer height marks the height with the most extinction, measured from the ground. Try two layers of similar strength: one number can't describe both, so read ALH as a summary of where most of the aerosol is.",
    "Each layer is drawn as a smooth bump about 1 km thick; AOD is the area under its curve. Austin's ground is about 150 m above sea level, and ALH is measured from the ground, not from sea level.");
}
function initAlhProfile() {
  const $ = id => document.getElementById(id); if (!$("ap")) return;
  const o = { h1: 0.9, a1: 0.6, h2: 4.0, a2: 0.0 }, PBL = 1.5;
  const ext = (z, h, a) => a * Math.exp(-((z - h) ** 2) / (2 * 0.42 * 0.42)) / (0.42 * Math.sqrt(2 * Math.PI));
  const Y = z => 270 - z / 8 * 250, X = v => 70 + v / 2.2 * 520;
  const sync = bindSliders(o, [["ap-h1", "h1", v => v.toFixed(1) + " km"], ["ap-a1", "a1", v => v.toFixed(2)], ["ap-h2", "h2", v => v.toFixed(1) + " km"], ["ap-a2", "a2", v => v.toFixed(2)]], () => draw());
  function draw() {
    sync();
    const zs = Array.from({ length: 321 }, (_, i) => i * 0.025), ev = zs.map(z => ext(z, o.h1, o.a1) + ext(z, o.h2, o.a2));
    let peak = 0; ev.forEach((v, i) => { if (v > ev[peak]) peak = i; });
    const aod = o.a1 + o.a2, alh = zs[peak], inPbl = zs.reduce((s, z, i) => s + (z <= PBL ? ev[i] * 0.025 : 0), 0);
    let g = "";
    for (let z = 0; z <= 8; z += 1) g += `<line x1="70" x2="600" y1="${Y(z)}" y2="${Y(z)}" style="stroke:var(--line)"/><text x="62" y="${Y(z) + 3}" text-anchor="end">${z} km</text>`;
    g += `<text x="12" y="${Y(4)}" transform="rotate(-90 12 ${Y(4)})" text-anchor="middle">height above ground</text>`;
    g += `<text x="${X(1.1)}" y="296" text-anchor="middle">extinction (how much light is removed per km) →</text>`;
    g += `<rect x="70" y="${Y(PBL)}" width="530" height="${Y(0) - Y(PBL)}" style="fill:var(--pbl);opacity:.12"/><line x1="70" x2="600" y1="${Y(PBL)}" y2="${Y(PBL)}" style="stroke:var(--pbl);stroke-dasharray:5 4"/><text x="596" y="${Y(PBL) - 5}" text-anchor="end" style="fill:var(--pbl)">top of boundary layer</text>`;
    const pts = zs.map((z, i) => `${X(Math.min(2.2, ev[i])).toFixed(1)},${Y(z).toFixed(1)}`);
    g += `<polygon points="${X(0)},${Y(0)} ${pts.join(" ")} ${X(0)},${Y(8)}" style="fill:var(--smoke);opacity:.35"/><polyline points="${pts.join(" ")}" style="fill:none;stroke:var(--smoke);stroke-width:2"/>`;
    g += `<rect x="70" y="${Y(0)}" width="530" height="6" style="fill:#a9c98f"/>`;
    if (aod >= 0.2) g += `<line x1="70" x2="600" y1="${Y(alh)}" y2="${Y(alh)}" style="stroke:var(--accent-bright);stroke-width:2"/><text x="596" y="${Y(alh) - 6}" text-anchor="end" class="strong" style="fill:var(--accent-bright)">ALH ${alh.toFixed(1)} km</text>`;
    $("ap-svg").innerHTML = g;
    $("ap-out").innerHTML = `<div><span class="al-k">Total AOD</span><b>${aod.toFixed(2)}</b><span class="al-s">area under the curve</span></div>
      <div><span class="al-k">Layer height</span><b>${aod >= 0.2 ? alh.toFixed(1) + " km" : "—"}</b><span class="al-s">${aod >= 0.2 ? "height of most extinction" : "not retrieved: AOD below 0.2"}</span></div>
      <div><span class="al-k">Inside boundary layer</span><b>${aod > 0 ? Math.round(100 * inPbl / aod) + "%" : "—"}</b><span class="al-s">of the AOD, the part that can reach the ground</span></div>`;
  }
  draw();
}

// =====================================================================
// Inline figure: the Sun's height over Austin through the day and year (Smoke/Dust Mask)
// =====================================================================
function sunChartHtml() {
  return fig("sc", `<svg class="fig wide" id="sc-svg" viewBox="0 0 620 270" role="img" aria-label="The Sun's height above the horizon over Austin through one day, with TEMPO's hourly scans and the low-sun range shaded."></svg>
    <div class="rt-controls">${slider("sc-m", "Month", 1, 12, 1)}</div>`,
    "The Sun's height over Austin through one day, on the 15th of the month. Dots are TEMPO's hourly scans; hollow dots fall in the shaded low-sun range (Sun below 20°, a solar zenith angle above 70°), where light paths are long, the signal is weak, and false smoke and dust detections are more likely. The star is the scan used in the 3D scene.",
    "Times are local clock time (CDT in summer, CST in winter). Scan times are approximate: TEMPO reaches Austin a few minutes past each hour.");
}
function initSunChart() {
  const $ = id => document.getElementById(id); if (!$("sc")) return;
  const o = { m: 8 }, X = h => 50 + h / 24 * 550, Y = e => 240 - e / 90 * 220;
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const sync = bindSliders(o, [["sc-m", "m", v => MON[v - 1]]], () => draw());
  function draw() {
    sync();
    const dst = o.m >= 3 && o.m <= 10, off = dst ? 5 : 6, day = Date.UTC(2026, o.m - 1, 15);
    const at = h => sunPos(day + (h + off) * 3600000, PANDORA.lat, PANDORA.lon).el;   // h = local clock hour
    let g = `<rect x="50" y="${Y(20)}" width="550" height="${Y(0) - Y(20)}" style="fill:var(--warn-bg)"/><text x="56" y="${Y(20) + 13}" style="fill:var(--warn-fg)">low sun: below 20°</text>`;
    for (let e = 0; e <= 90; e += 30) g += `<line x1="50" x2="600" y1="${Y(e)}" y2="${Y(e)}" style="stroke:var(--line)"/><text x="44" y="${Y(e) + 3}" text-anchor="end">${e}°</text>`;
    for (let h = 0; h <= 24; h += 3) g += `<text x="${X(h)}" y="258" text-anchor="middle">${hhmm(h)}</text>`;
    const pts = []; for (let h = 0; h <= 24.001; h += 0.1) { const e = at(h); if (e > -2) pts.push(`${X(h).toFixed(1)},${Y(Math.max(0, e)).toFixed(1)}`); else if (pts.length && pts[pts.length - 1] !== "|") pts.push("|"); }
    pts.join(" ").split("|").forEach(seg => { if (seg.trim()) g += `<polyline points="${seg.trim()}" style="fill:none;stroke:var(--sun);stroke-width:2.5"/>`; });
    let up = 0, low = 0;
    for (let h = 0; h < 24; h++) { const t = h + 0.25, e = at(t); if (e <= 0) continue; up++; if (e < 20) low++;
      g += `<circle cx="${X(t)}" cy="${Y(e)}" r="4.5" style="fill:${e < 20 ? "var(--panel)" : "var(--accent-bright)"};stroke:var(--accent-bright);stroke-width:1.8"/>`; }
    if (o.m === 8) { const t = 19.25, e = at(t); g += `<text x="${X(t)}" y="${Y(e) - 9}" text-anchor="middle" style="fill:var(--fg);font-size:15px">★</text>`; }
    g += `<text x="56" y="18" class="strong">${MON[o.m - 1]} 15: ${up} TEMPO scans in daylight, ${low} of them with the Sun below 20°. Highest sun ${Math.max(...Array.from({ length: 240 }, (_, i) => at(i / 10))).toFixed(0)}°.</text>`;
    $("sc-svg").innerHTML = g;
  }
  draw();
}

// =====================================================================
// Inline figure: AOD at different wavelengths (AOD)
// =====================================================================
function aodSpectrumHtml() {
  return fig("as", `<svg class="fig wide" id="as-svg" viewBox="0 0 620 260" role="img" aria-label="AOD as a function of wavelength for adjustable aerosol amount and Angstrom exponent, with common instrument wavelengths marked."></svg>
    <div class="trybar" style="margin-top:6px" role="group" aria-label="Aerosol types"><span class="lab">Typical:</span>${AS_TYPES.map(([n], i) => `<button type="button" class="chip small" data-as="${i}">${n}</button>`).join("")}</div>
    <div class="al-out" id="as-out" aria-live="polite"></div>
    <div class="rt-controls">${slider("as-aod", "AOD at 550 nm", 0.05, 2, 0.01)}${slider("as-alpha", "Ångström exponent α", 0, 2.5, 0.05)}</div>`,
    "AOD depends on the wavelength, so values from different instruments can only be compared at the same wavelength. The usual conversion is the Ångström law: AOD(λ) = AOD(550) × (λ / 550 nm)<sup>−α</sup>. Small particles such as smoke have a large α (AOD falls quickly toward the red); large dust particles have α near zero (nearly flat).",
    "Typical α values are rough guides; real values vary by event. TEMPO and ABI report AOD at 550 nm; sun photometers such as AERONET's report at 440, 500, 675 and 870 nm, among others.");
}
const AS_TYPES = [["Smoke", 0.8, 1.8], ["Urban haze", 0.3, 1.4], ["Dust", 0.8, 0.25], ["Sea salt", 0.15, 0.5]];
function initAodSpectrum() {
  const $ = id => document.getElementById(id); if (!$("as")) return;
  const o = { aod: 0.8, alpha: 1.8 }, WL = [440, 500, 550, 675, 870];
  const X = w => 60 + Math.log(w / 300) / Math.log(1100 / 300) * 540, Y = v => 225 - v / 3 * 205;
  const sync = bindSliders(o, [["as-aod", "aod", v => v.toFixed(2)], ["as-alpha", "alpha", v => v.toFixed(2)]], () => draw());
  const at = w => o.aod * Math.pow(w / 550, -o.alpha);
  function draw() {
    sync();
    let g = "";
    [0, 1, 2, 3].forEach(v => { g += `<line x1="60" x2="600" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="54" y="${Y(v) + 3}" text-anchor="end">${v}</text>`; });
    [300, 400, 550, 700, 900, 1100].forEach(w => { g += `<text x="${X(w)}" y="243" text-anchor="middle">${w} nm</text>`; });
    g += `<text x="16" y="${Y(1.5)}" transform="rotate(-90 16 ${Y(1.5)})" text-anchor="middle">AOD</text>`;
    WL.forEach(w => { g += `<line x1="${X(w)}" x2="${X(w)}" y1="${Y(3)}" y2="${Y(0)}" style="stroke:${w === 550 ? "var(--accent-bright)" : "var(--rule)"};stroke-dasharray:${w === 550 ? "0" : "3 3"}"/>`; });
    g += `<text x="${X(550) + 4}" y="${Y(2.9)}" style="fill:var(--accent-bright)">TEMPO, ABI: 550 nm</text><text x="${X(675) + 4}" y="${Y(2.6)}">dashed: sun photometers (440, 500, 675, 870 nm)</text>`;
    const pts = []; for (let w = 300; w <= 1100; w += 5) pts.push(`${X(w).toFixed(1)},${Y(Math.min(3, at(w))).toFixed(1)}`);
    g += `<polyline points="${pts.join(" ")}" style="fill:none;stroke:var(--smoke);stroke-width:2.5"/>`;
    WL.forEach(w => { g += `<circle cx="${X(w)}" cy="${Y(Math.min(3, at(w)))}" r="4" style="fill:${w === 550 ? "var(--accent-bright)" : "var(--smoke)"}"/>`; });
    $("as-svg").innerHTML = g;
    $("as-out").innerHTML = [440, 500, 675].map(w => `<div><span class="al-k">AOD at ${w} nm</span><b>${at(w).toFixed(2)}</b><span class="al-s">${at(w) > o.aod ? "+" : ""}${Math.round(100 * (at(w) / o.aod - 1))}% vs. 550 nm</span></div>`).join("");
  }
  document.querySelectorAll("#as [data-as]").forEach(b => b.addEventListener("click", () => { const [, a, al] = AS_TYPES[+b.dataset.as]; o.aod = a; o.alpha = al; draw(); }));
  draw();
}

// =====================================================================
// Part 2.1: columns vs. what you breathe
// =====================================================================
function columnLabHtml() {
  return fig("cl", `<div class="trybar" style="margin-top:0" role="group" aria-label="Times of day"><span class="lab">Try:</span>
      <button type="button" class="chip small" data-cl="0">Early morning: shallow mixing</button><button type="button" class="chip small" data-cl="1">Afternoon: deep mixing</button><button type="button" class="chip small" data-cl="2">Pollution layer aloft</button></div>
    <svg class="fig wide" id="cl-svg" viewBox="0 0 620 300" role="img" aria-label="Vertical profile of NO2: the shaded area is the column a satellite or Pandora measures; the value at the bottom is what a ground monitor measures."></svg>
    <div class="al-out" id="cl-out" aria-live="polite"></div>
    <div class="rt-controls">
      ${slider("cl-s", "NO₂ at the ground", 1, 40, 0.5)}${slider("cl-h", "Boundary layer depth", 0.3, 3, 0.05)}${slider("cl-a", "NO₂ in a layer aloft (2.5–3.5 km)", 0, 10, 0.25)}
      <div class="row"><input type="checkbox" id="cl-fix"><label for="cl-fix" style="color:var(--fg)">Hold the column fixed while changing the boundary layer</label></div>
    </div>`,
    "The shaded area is the tropospheric column, what TEMPO and Pandora measure: every NO₂ molecule above a square centimeter of ground. A ground monitor measures only the bottom of the profile. Tick “Hold the column fixed” and change the boundary layer depth: the satellite sees exactly the same number while the air at the ground changes several-fold.",
    "Simplified profile: NO₂ well mixed in the boundary layer, a small background above, air density falling with height (8 km scale height), sea-level conditions at the ground. 1 ppb at the ground is about 2.5 × 10¹⁰ molecules/cm³.");
}
function initColumnLab() {
  const $ = id => document.getElementById(id); if (!$("cl")) return;
  const o = { s: 12, h: 1.5, a: 0, fix: false };
  const NAIR = 2.46e19, BG = 0.15, DZ = 0.01;   // molecules/cm3 at the ground; background ppb above the boundary layer
  const ppb = z => (z <= o.h ? o.s : BG) + (z >= 2.5 && z <= 3.5 ? o.a : 0);
  const dens = z => ppb(z) * 1e-9 * NAIR * Math.exp(-z / 8);   // molecules/cm3
  const column = () => { let c = 0; for (let z = DZ / 2; z < 12; z += DZ) c += dens(z) * DZ * 1e5; return c; };
  const X = v => 80 + v / 1.0e12 * 500, Y = z => 270 - z / 5 * 250;
  let held = null;
  const sync = bindSliders(o, [["cl-s", "s", v => v.toFixed(1) + " ppb"], ["cl-h", "h", v => v.toFixed(2) + " km"], ["cl-a", "a", v => v.toFixed(2) + " ppb"]], () => {
    if (o.fix && held !== null) { const keep = o.s; o.s = 1; const per = column() - (() => { o.s = 0; const c = column(); o.s = 1; return c; })(); o.s = Math.max(0.5, Math.min(60, (held - (column() - per)) / per)); if (!isFinite(o.s)) o.s = keep; }
    draw(); });
  $("cl-s").addEventListener("input", () => { if (o.fix) held = column(); });
  $("cl-a").addEventListener("input", () => { if (o.fix) held = column(); });
  $("cl-fix").addEventListener("change", e => { o.fix = e.target.checked; held = o.fix ? column() : null; draw(); });
  function draw() {
    sync();
    const col = column(); let inBl = 0; for (let z = DZ / 2; z < o.h; z += DZ) inBl += dens(z) * DZ * 1e5;
    let g = "";
    for (let z = 0; z <= 5; z++) g += `<line x1="80" x2="600" y1="${Y(z)}" y2="${Y(z)}" style="stroke:var(--line)"/><text x="72" y="${Y(z) + 3}" text-anchor="end">${z} km</text>`;
    [0, 2.5e11, 5e11, 7.5e11, 1e12].forEach(v => { g += `<text x="${X(v)}" y="287" text-anchor="middle">${(v / 1e11).toFixed(1)}</text>`; });
    g += `<text x="${X(5e11)}" y="299" text-anchor="middle">NO₂ molecules per cm³ (× 10¹¹)</text>`;
    g += `<line x1="80" x2="600" y1="${Y(o.h)}" y2="${Y(o.h)}" style="stroke:var(--pbl);stroke-dasharray:5 4"/><text x="596" y="${Y(o.h) - 5}" text-anchor="end" style="fill:var(--pbl)">top of boundary layer</text>`;
    const pts = []; for (let z = 0; z <= 5.0001; z += 0.01) pts.push(`${X(Math.min(1e12, dens(z))).toFixed(1)},${Y(z).toFixed(1)}`);
    g += `<polygon points="${X(0)},${Y(0)} ${pts.join(" ")} ${X(0)},${Y(5)}" style="fill:var(--accent-bright);opacity:.25"/><polyline points="${pts.join(" ")}" style="fill:none;stroke:var(--accent-bright);stroke-width:2"/>`;
    g += `<rect x="80" y="${Y(0)}" width="520" height="6" style="fill:#a9c98f"/><circle cx="${X(Math.min(1e12, dens(0)))}" cy="${Y(0)}" r="6" style="fill:var(--sun)"/>`;
    g += `<text x="${Math.min(560, X(Math.min(1e12, dens(0))) + 10)}" y="${Y(0) - 8}" class="strong">ground monitor</text><text x="${X(1e11) + 10}" y="${Y(4.6)}" class="strong" style="fill:var(--accent-bright)">column = shaded area</text>`;
    $("cl-svg").innerHTML = g;
    $("cl-out").innerHTML = `<div><span class="al-k">Ground monitor sees</span><b>${o.s.toFixed(1)} ppb</b><span class="al-s">NO₂ in the air at the surface</span></div>
      <div><span class="al-k">TEMPO / Pandora see</span><b>${(col / 1e15).toFixed(1)} × 10¹⁵</b><span class="al-s">molecules/cm² in the tropospheric column</span></div>
      <div><span class="al-k">Share in boundary layer</span><b>${Math.round(100 * inBl / col)}%</b><span class="al-s">of the column</span></div>`;
  }
  const PRE = [{ s: 20, h: 0.5, a: 0 }, { s: 20, h: 2.0, a: 0 }, { s: 6, h: 1.2, a: 6 }];
  document.querySelectorAll("#cl [data-cl]").forEach(b => b.addEventListener("click", () => {
    const p = PRE[+b.dataset.cl];
    if (o.fix && +b.dataset.cl < 2) { o.h = p.h; o.a = 0; const target = held; o.s = 1; const one = column(); o.s = 0; const zero = column(); o.s = Math.max(0.5, Math.min(60, (target - zero) / (one - zero))); }
    else { Object.assign(o, p); if (o.fix) held = column(); }
    draw(); }));
  draw();
}

// =====================================================================
// Part 2.2: matching a ground instrument to a satellite pixel, in space and time
// =====================================================================
function matchMapHtml() {
  return fig("mm", `<svg class="fig wide" id="mm-svg" viewBox="0 0 620 380" role="img" aria-label="Map of TEMPO pixels around St. Edward's University with the Pandora site and the ground track of its line of sight to the Sun."></svg>
    <div class="mx-share" id="mm-out" aria-live="polite"></div>
    <div class="rt-controls">${slider("mm-t", "Time of day (Aug 27, 2026)", 7, 20, 0.25)}${slider("mm-h", "Height of the polluted layer", 0.3, 3, 0.05)}</div>`,
    "Real TEMPO pixels from the scan used throughout this site, around the Pandora at St. Edward's (orange). In direct-sun mode Pandora looks at the Sun, so the air it measures lies along the line toward the Sun. The orange line is where that sightline passes through the polluted layer: when the Sun is low, it reaches many kilometers away, across several TEMPO pixels.",
    "The blue pixel contains the site; outlined pixels are the ones the sightline crosses. TEMPO's own view is slanted too (36° from vertical, from the south), which shifts what it sees by about 1 km for a 1.5 km layer.");
}
function initMatchMap() {
  const $ = id => document.getElementById(id); if (!$("mm") || !V || !V.PIX) return;
  const o = { t: 19.25, h: 1.6 }, KX = 111.32 * Math.cos(PANDORA.lat * RAD), KY = 110.57, R = 16;   // km half-width shown
  const px = lon => (lon - PANDORA.lon) * KX, pz = lat => -(lat - PANDORA.lat) * KY;
  const S = 380 / (2 * R), X = x => 310 + x * S, Y = z => 190 + z * S;
  const pix = V.PIX.filter(p => Math.abs(px(p.lon)) < R + 4 && Math.abs(pz(p.lat)) < R + 4);
  const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
  const city = V.CITY;
  const sync = bindSliders(o, [["mm-t", "t", v => hhmm(v) + " CDT"], ["mm-h", "h", v => v.toFixed(2) + " km"]], () => draw());
  function draw() {
    sync();
    const sp = sunPos(Date.UTC(2026, 7, 27, 0, 0) + (o.t + 5) * 3600000, PANDORA.lat, PANDORA.lon);
    let g = `<defs><clipPath id="mm-clip"><rect x="0" y="0" width="620" height="380"/></clipPath></defs><g clip-path="url(#mm-clip)"><rect x="0" y="0" width="620" height="380" style="fill:var(--scene)"/>`;
    // river and downtown for orientation
    (city.river || []).forEach(w => { g += `<polyline points="${w.map(([la, lo]) => `${X(px(lo)).toFixed(1)},${Y(pz(la)).toFixed(1)}`).join(" ")}" style="fill:none;stroke:var(--water);stroke-width:2;opacity:.7"/>`; });
    city.downtown.forEach(b => { g += `<polygon points="${b.g.map(([la, lo]) => `${X(px(lo)).toFixed(1)},${Y(pz(la)).toFixed(1)}`).join(" ")}" style="fill:var(--building);opacity:.8"/>`; });
    let ok = sp.el > 0, end = [0, 0], dist = 0;
    if (ok) { dist = o.h / Math.tan(sp.el * RAD); const a = sp.az * RAD; end = [Math.sin(a) * dist, -Math.cos(a) * dist]; }
    const polys = pix.map(p => p.c.map(([la, lo]) => [px(lo), pz(la)]));
    const home = polys.findIndex(pl => inside([0, 0], pl));
    const crossed = new Set(); if (ok) for (let k = 0; k <= 200; k++) { const pt = [end[0] * k / 200, end[1] * k / 200]; polys.forEach((pl, i) => { if (inside(pt, pl)) crossed.add(i); }); }
    polys.forEach((pl, i) => { const pts = pl.map(([x, z]) => `${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join(" ");
      g += `<polygon points="${pts}" style="fill:${i === home ? "var(--accent-bright)" : "none"};fill-opacity:.25;stroke:${crossed.has(i) && i !== home ? "var(--sun)" : "var(--sat)"};stroke-width:${crossed.has(i) && i !== home ? 2.2 : 0.8};stroke-opacity:${crossed.has(i) ? 1 : 0.55}"/>`; });
    if (ok) { g += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(end[0])}" y2="${Y(end[1])}" style="stroke:var(--sun);stroke-width:3.5;stroke-linecap:round"/>`;
      const far = [end[0] * 1.08, end[1] * 1.08]; g += `<text x="${Math.max(20, Math.min(600, X(far[0])))}" y="${Math.max(16, Math.min(372, Y(far[1])))}" text-anchor="middle" style="fill:var(--sun)" class="strong">toward the Sun</text>`; }
    g += `<circle cx="${X(0)}" cy="${Y(0)}" r="6" style="fill:var(--sun);stroke:var(--fg);stroke-width:1.5"/><text x="${X(0) + 10}" y="${Y(0) + 18}" class="strong">Pandora</text>`;
    g += `<line x1="20" x2="${20 + 5 * S}" y1="365" y2="365" style="stroke:var(--fg);stroke-width:2"/><text x="${20 + 2.5 * S}" y="358" text-anchor="middle">5 km</text><text x="600" y="22" text-anchor="end" class="strong">N ↑</text></g>`;
    $("mm-svg").innerHTML = g;
    $("mm-out").innerHTML = !ok ? "The Sun is down: Pandora can't measure in direct-sun mode, and TEMPO doesn't scan." :
      `Sun ${sp.el.toFixed(0)}° above the horizon, toward the ${["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(sp.az / 45) % 8]}. Pandora's sightline crosses the top of a ${o.h.toFixed(1)} km layer <b>${dist.toFixed(1)} km</b> from the site and passes through <b>${crossed.size}</b> TEMPO pixel${crossed.size === 1 ? "" : "s"}. ${dist > 5 ? "Comparing Pandora with only the pixel over the site would mix in different air." : "At this sun height, the pixel over the site is a reasonable match."}`;
  }
  draw();
}
function matchTimeHtml() {
  return fig("mt", `<svg class="fig wide" id="mt-svg" viewBox="0 0 620 250" role="img" aria-label="Pandora NO2 readings every two minutes around a TEMPO overpass, with an adjustable averaging window."></svg>
    <div class="al-out" id="mt-out" aria-live="polite"></div>
    <div class="rt-controls">${slider("mt-w", "Averaging window (± minutes)", 2, 60, 1)}</div>`,
    "Pandora reports many times an hour; TEMPO gives one value per hourly scan. To compare them, average Pandora's readings in a window around the moment TEMPO passed over. A narrow window keeps the timing tight but leaves few, noisy readings; a wide one smooths the noise but mixes in air from before and after the scan, especially when pollution is changing fast.",
    "Illustrative Pandora readings (made up). A window of about ±30 minutes is a common starting choice in published TEMPO–Pandora comparisons; check what your own analysis needs.");
}
function initMatchTime() {
  const $ = id => document.getElementById(id); if (!$("mt")) return;
  const o = { w: 30 }, T0 = 14 * 60 + 15;   // TEMPO over Austin at 14:15 local
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const series = []; let walk = 0;
  for (let m = 12 * 60 + 30; m <= 16 * 60; m += 2) { walk = 0.85 * walk + (rnd() - 0.5) * 0.9; series.push([m, 6 + 3.5 * Math.exp(-((m - 15 * 60 - 20) ** 2) / (2 * 25 * 25)) + walk + (rnd() - 0.5) * 1.6]); }
  const tempo = 6.4;
  const X = m => 50 + (m - 750) / 210 * 550, Y = v => 220 - v / 14 * 200;
  const sync = bindSliders(o, [["mt-w", "w", v => "± " + v + " min"]], () => draw());
  function draw() {
    sync();
    const inWin = series.filter(([m]) => Math.abs(m - T0) <= o.w), mean = inWin.reduce((s, [, v]) => s + v, 0) / inWin.length;
    const sd = Math.sqrt(inWin.reduce((s, [, v]) => s + (v - mean) ** 2, 0) / Math.max(1, inWin.length - 1));
    let g = `<rect x="${X(T0 - o.w)}" y="20" width="${X(T0 + o.w) - X(T0 - o.w)}" height="200" style="fill:var(--accent-soft);opacity:.7"/>`;
    [0, 4, 8, 12].forEach(v => { g += `<line x1="50" x2="600" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="44" y="${Y(v) + 3}" text-anchor="end">${v}</text>`; });
    for (let m = 780; m <= 960; m += 30) g += `<text x="${X(m)}" y="238" text-anchor="middle">${hhmm(m / 60)}</text>`;
    g += `<text x="12" y="${Y(7)}" transform="rotate(-90 12 ${Y(7)})" text-anchor="middle">NO₂ column (× 10¹⁵ molecules/cm²)</text>`;
    series.forEach(([m, v]) => { const inn = Math.abs(m - T0) <= o.w; g += `<circle cx="${X(m)}" cy="${Y(v)}" r="2.8" style="fill:${inn ? "var(--sun)" : "var(--muted)"};opacity:${inn ? 1 : 0.5}"/>`; });
    g += `<line x1="${X(T0)}" x2="${X(T0)}" y1="20" y2="220" style="stroke:var(--accent-bright);stroke-width:2"/><text x="${X(T0) + 5}" y="32" class="strong" style="fill:var(--accent-bright)">TEMPO scan</text>`;
    g += `<line x1="${X(T0 - o.w)}" x2="${X(T0 + o.w)}" y1="${Y(mean)}" y2="${Y(mean)}" style="stroke:var(--sun);stroke-width:3"/><circle cx="${X(T0)}" cy="${Y(tempo)}" r="6" style="fill:var(--accent-bright);stroke:var(--panel);stroke-width:2"/>`;
    $("mt-svg").innerHTML = g;
    $("mt-out").innerHTML = `<div><span class="al-k">Pandora readings used</span><b>${inWin.length}</b><span class="al-s">within ± ${o.w} min of the scan</span></div>
      <div><span class="al-k">Pandora average</span><b>${mean.toFixed(1)}</b><span class="al-s">spread ± ${sd.toFixed(1)} (× 10¹⁵)</span></div>
      <div><span class="al-k">Difference from TEMPO</span><b>${(mean - tempo >= 0 ? "+" : "") + (mean - tempo).toFixed(1)}</b><span class="al-s">TEMPO pixel: ${tempo.toFixed(1)} (× 10¹⁵)</span></div>`;
  }
  draw();
}

// =====================================================================
// Part 2.3: a day of measurements, and the UTC trap
// =====================================================================
function dayLabHtml() {
  return fig("dl", `<svg class="fig wide" id="dl-svg" viewBox="0 0 620 300" role="img" aria-label="One day of NO2 over Austin and when each instrument samples it."></svg>
    <div class="rt-controls">
      <div class="row"><span id="dl-kL" style="color:var(--muted);min-width:9em">Day</span><div class="seg" role="group" aria-labelledby="dl-kL"><button type="button" id="dl-k0">Typical weekday</button><button type="button" id="dl-k1">Weekend</button><button type="button" id="dl-k2">Polluted afternoon</button></div></div>
      <div class="row"><input type="checkbox" id="dl-cloud"><label for="dl-cloud" style="color:var(--fg)">Clouds from 12:30 to 15:30</label></div>
      <div class="row"><input type="checkbox" id="dl-utc"><label for="dl-utc" style="color:var(--fg)">Show the clock in UTC, as in the data files</label></div>
    </div>`,
    "The gray curve is the NO₂ column over Austin through one day. Each row shows when an instrument samples it. Pandora (in direct-sun mode) and TEMPO see the whole daylight cycle; a polar orbiter sees one moment, at about 1:30 pm. Hollow TEMPO points are low-sun scans to treat with care. Turn on clouds: TEMPO loses a few hours, but the polar orbiter loses the whole day.",
    "Illustrative NO₂ curve (made up). Austin is UTC−5 in summer (CDT) and UTC−6 in winter (CST).");
}
function initDayLab() {
  const $ = id => document.getElementById(id); if (!$("dl")) return;
  const o = { k: 0, cloud: false, utc: false };
  const curve = (h) => { const rush = (c, w, a) => a * Math.exp(-((h - c) ** 2) / (2 * w * w));
    if (o.k === 1) return 2.2 + rush(13, 3.5, 1.4) + rush(20, 2, 0.8);
    if (o.k === 2) return 2.5 + rush(7.8, 1.2, 5) + rush(15.5, 2.2, 7) + rush(18.5, 1.3, 3);
    return 2.5 + rush(7.8, 1.2, 6) + rush(12.5, 3, 1.5) + rush(18, 1.4, 4.5); };
  const day = Date.UTC(2026, 7, 27);
  const el = h => sunPos(day + (h + 5) * 3600000, PANDORA.lat, PANDORA.lon).el;
  const cloudy = h => o.cloud && h >= 12.5 && h <= 15.5;
  const X = h => 150 + h / 24 * 455, Y = v => 150 - v / 12 * 130;
  function draw() {
    [0, 1, 2].forEach(k => $("dl-k" + k).setAttribute("aria-pressed", String(o.k === k)));
    let g = "";
    // night shading
    for (let h = 0; h < 24; h += 0.25) if (el(h + 0.125) <= 0) g += `<rect x="${X(h)}" y="14" width="${X(0.25) - X(0) + 0.5}" height="276" style="fill:var(--card)"/>`;
    if (o.cloud) g += `<rect x="${X(12.5)}" y="14" width="${X(15.5) - X(12.5)}" height="276" style="fill:var(--muted);opacity:.18"/><text x="${X(14)}" y="28" text-anchor="middle" class="strong">clouds</text>`;
    [0, 4, 8, 12].forEach(v => { g += `<line x1="150" x2="605" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="144" y="${Y(v) + 3}" text-anchor="end">${v}</text>`; });
    g += `<text x="100" y="${Y(6)}" transform="rotate(-90 100 ${Y(6)})" text-anchor="middle">NO₂ column</text>`;
    const pts = []; for (let h = 0; h <= 24; h += 0.1) pts.push(`${X(h).toFixed(1)},${Y(curve(h)).toFixed(1)}`);
    g += `<polyline points="${pts.join(" ")}" style="fill:none;stroke:var(--muted);stroke-width:2.5"/>`;
    const rows = [["Pandora (direct sun)", 186], ["TEMPO (hourly)", 216], ["Polar orbiter", 246]];
    rows.forEach(([n, y]) => { g += `<text x="144" y="${y + 4}" text-anchor="end" class="strong">${n}</text><line x1="150" x2="605" y1="${y}" y2="${y}" style="stroke:var(--line)"/>`; });
    for (let h = 0; h < 24; h += 0.05) if (el(h) > 2 && !cloudy(h)) { g += `<line x1="${X(h)}" x2="${X(h)}" y1="181" y2="191" style="stroke:var(--sun);stroke-width:1.2"/>`; }
    for (let h = 0.25; h < 24; h += 1) { const e = el(h); if (e <= 0) continue; const c = cloudy(h);
      g += `<circle cx="${X(h)}" cy="216" r="5" style="fill:${c ? "none" : e < 20 ? "var(--panel)" : "var(--accent-bright)"};stroke:${c ? "var(--muted)" : "var(--accent-bright)"};stroke-width:1.8;stroke-dasharray:${c ? "2 2" : "0"}"/>`;
      if (!c) g += `<circle cx="${X(h)}" cy="${Y(curve(h))}" r="3.5" style="fill:var(--accent-bright)"/>`; }
    const p = 13.5; g += `<rect x="${X(p) - 5}" y="241" width="10" height="10" style="fill:${cloudy(p) ? "none" : "var(--sat)"};stroke:var(--sat);stroke-dasharray:${cloudy(p) ? "2 2" : "0"}"/>`;
    if (!cloudy(p)) g += `<rect x="${X(p) - 4}" y="${Y(curve(p)) - 4}" width="8" height="8" style="fill:var(--sat)"/>`;
    // clock labels, local or UTC
    for (let h = 0; h <= 24; h += 3) { const lab = o.utc ? hhmm(h + 5) : hhmm(h); g += `<text x="${X(h)}" y="282" text-anchor="middle">${lab}</text>`; }
    g += `<text x="144" y="297" text-anchor="end">${o.utc ? "clock: UTC" : "clock: local (CDT)"}</text>`;
    if (o.utc) { g += `<line x1="${X(19)}" x2="${X(19)}" y1="14" y2="270" style="stroke:var(--warn-fg);stroke-width:2;stroke-dasharray:6 4"/>`;
      g += `<text x="${X(19) - 6}" y="44" text-anchor="end" style="fill:var(--warn-fg)" class="strong">Aug 27 UTC</text><text x="${X(19) + 6}" y="44" style="fill:var(--warn-fg)" class="strong">Aug 28 UTC</text>`;
      g += `<text x="${X(19) - 6}" y="58" text-anchor="end" style="fill:var(--warn-fg)">evening scans land in the next day's files</text>`; }
    $("dl-svg").innerHTML = g;
  }
  [0, 1, 2].forEach(k => $("dl-k" + k).addEventListener("click", () => { o.k = k; draw(); }));
  $("dl-cloud").addEventListener("change", e => { o.cloud = e.target.checked; draw(); });
  $("dl-utc").addEventListener("change", e => { o.utc = e.target.checked; draw(); });
  draw();
}

// =====================================================================
// Part 2.4: inside a TEMPO file, and quality flags on the real scan
// =====================================================================
function fileAnatomyHtml() {
  const part = (t, d, cls = "") => `<span class="fn-part ${cls}"><b>${t}</b><i>${d}</i></span>`;
  const v = (n, d) => `<li><code>${n}</code><span>${d}</span></li>`;
  return `<figure class="retrieval" id="fa">
    <div class="fn">${part("TEMPO", "instrument")}${part("NO2", "product")}${part("L2", "level 2: one value per pixel")}${part("V04", "data version")}${part("20260828T001329Z", "granule start, UTC")}${part("S016", "scan 16 of the day")}${part("G03", "granule 3 of that scan")}${part(".nc", "netCDF-4 file")}</div>
    <div class="fa-grid">
      <div class="fa-box"><h4>product/</h4><p class="note">the answers</p><ul>${v("vertical_column_troposphere", "tropospheric NO₂ column, molecules/cm²")}${v("vertical_column_troposphere_uncertainty", "its uncertainty")}${v("vertical_column_stratosphere", "stratospheric part")}${v("main_data_quality_flag", "0 normal, 1 suspicious, 2 bad")}</ul></div>
      <div class="fa-box"><h4>geolocation/</h4><p class="note">where and when</p><ul>${v("latitude, longitude", "pixel centers")}${v("latitude_bounds, longitude_bounds", "the 4 pixel corners")}${v("time", "seconds since Jan 6, 1980 (GPS time)")}${v("solar_zenith_angle", "sun angle, degrees")}${v("viewing_zenith_angle", "satellite angle, degrees")}</ul></div>
      <div class="fa-box"><h4>support_data/</h4><p class="note">context for judging the answer</p><ul>${v("eff_cloud_fraction", "how cloudy, 0 to 1")}${v("vertical_column_total", "total column, troposphere + stratosphere")}${v("pbl_height", "boundary-layer height from a weather model, m")}${v("…", "air mass factors, surface reflectance and more")}</ul></div>
    </div>
    <div class="fa-grid2"><svg class="fig" viewBox="0 0 300 150" role="img" aria-label="Every variable is a 2D array indexed by mirror step and cross-track position."><g>${Array.from({ length: 6 }, (_, i) => Array.from({ length: 9 }, (_, j) => `<rect x="${60 + j * 24}" y="${20 + i * 18}" width="22" height="16" style="fill:var(--accent-bright);opacity:${0.25 + 0.6 * ((i * 7 + j * 3) % 5) / 5}"/>`).join("")).join("")}</g>
      <text x="168" y="146" text-anchor="middle">mirror_step → (west to east in time)</text><text x="40" y="74" text-anchor="middle" transform="rotate(-90 40 74)">xtrack (north–south)</text></svg>
      <p>Every variable is a 2D array, one value per pixel: <code>mirror_step</code> counts the mirror's steps as it scans east to west, and <code>xtrack</code> runs north–south along the slit. To find a place, look up its pixel through latitude and longitude. One hourly scan is split into several granules, each about 6–7 minutes of scanning; this one covers 00:13:29–00:20:06 UTC.</p></div>
    <div class="chain" style="margin-top:12px"><span class="box">L1b</span><span class="arr">calibrated light (radiances) →</span><span class="box">L2</span><span class="arr">one retrieval per pixel, in granules →</span><span class="box">L3</span><span class="arr">L2 put on a regular grid, one file per scan →</span><span class="box">L4</span><span class="arr">combined with other data or models (e.g., PM2.5)</span></div>
    <figcaption><span class="note">Variable names are from TEMPO's NO₂ and HCHO version 4 files used for the 3D scene; other products follow the same layout with their own variables.</span></figcaption>
  </figure>`;
}
function qaLabHtml() {
  return fig("qa", `<svg class="fig wide" id="qa-svg" viewBox="0 0 620 330" role="img" aria-label="Real TEMPO NO2 pixels over Austin, filtered by quality flag and cloud fraction."></svg>
    <div class="al-out" id="qa-out" aria-live="polite"></div>
    <div class="rt-controls">
      <div class="row"><input type="checkbox" id="qa-flag"><label for="qa-flag" style="color:var(--fg)">Keep only normal-quality pixels (flag 0), as usually recommended</label></div>
      ${slider("qa-cf", "Maximum cloud fraction", 0, 1, 0.05)}
    </div>`,
    "The real tropospheric NO₂ pixels from the evening scan used throughout this site. Filters are the first step of any analysis. Here the recommended one leaves nothing: with the Sun 8° above the horizon and heavy cloud, TEMPO flags every pixel over Austin as suspicious. Relax it and filter by cloud fraction instead, and watch how few clear pixels remain, and how their average differs from the unfiltered one.",
    "Colors span 0 to 1.5 × 10¹⁶ molecules/cm². Gray pixels are removed by the current filters.");
}
function initQaLab() {
  const $ = id => document.getElementById(id); if (!$("qa") || !V || !V.PIX) return;
  const o = { flag: false, cf: 1 }, P = V.PIX, KX = 111.32 * Math.cos(30.25 * RAD), KY = 110.57;
  const xs = P.map(p => p.lon), ys = P.map(p => p.lat), lo0 = Math.min(...xs), lo1 = Math.max(...xs), la0 = Math.min(...ys), la1 = Math.max(...ys);
  const s = Math.min(560 / ((lo1 - lo0) * KX), 300 / ((la1 - la0) * KY)), X = lo => 30 + (lo - lo0) * KX * s, Y = la => 315 - (la - la0) * KY * s;
  const col = v => { const t = Math.max(0, Math.min(1, v / 1.5e16)), st = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]], x = t * 4, i = Math.min(3, Math.floor(x)), f = x - i; return `rgb(${st[i].map((c, m) => Math.round(c + (st[i + 1][m] - c) * f)).join(",")})`; };
  const sync = bindSliders(o, [["qa-cf", "cf", v => v.toFixed(2)]], () => draw());
  $("qa-flag").addEventListener("change", e => { o.flag = e.target.checked; draw(); });
  function draw() {
    sync();
    const keep = p => (!o.flag || p.no2_q === 0) && p.cloud <= o.cf && p.no2_trop !== null;
    let g = "", n = 0, sum = 0, all = 0, allN = 0;
    P.forEach(p => { const k = keep(p); if (p.no2_trop !== null) { all += p.no2_trop; allN++; } if (k) { n++; sum += p.no2_trop; }
      g += `<polygon points="${p.c.map(([la, lo]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join(" ")}" style="fill:${k ? col(p.no2_trop) : "var(--card)"};stroke:${k ? "none" : "var(--line)"};stroke-width:.5"/>`; });
    g += `<circle cx="${X(PANDORA.lon)}" cy="${Y(PANDORA.lat)}" r="5" style="fill:var(--sun);stroke:var(--fg);stroke-width:1.2"/>`;
    $("qa-svg").innerHTML = g;
    const f = v => (v / 1e15).toFixed(1);
    $("qa-out").innerHTML = `<div><span class="al-k">Pixels kept</span><b>${n} of ${P.length}</b><span class="al-s">${Math.round(100 * n / P.length)}% of the area</span></div>
      <div><span class="al-k">Average NO₂ kept</span><b>${n ? f(sum / n) : "—"}</b><span class="al-s">× 10¹⁵ molecules/cm²</span></div>
      <div><span class="al-k">Average, no filter</span><b>${f(all / allN)}</b><span class="al-s">× 10¹⁵ molecules/cm²</span></div>`;
  }
  draw();
}

// =====================================================================
// Part 3: hands-on Python (code cells are kept in sync with notebooks/hands_on.ipynb)
// =====================================================================
const PY = {"cells": {"setup": "!pip install -q git+https://github.com/paulsavala/pandora-tools earthaccess xarray netCDF4 h5netcdf pyproj s3fs\nimport numpy as np, pandas as pd, xarray as xr, matplotlib.pyplot as plt\nimport pandora_tools as pdt", "pandora": "client = pdt.PandoraClient()\npandora = client.fetch(\"AustinTX\", 257, \"2026-08-27\", \"2026-08-28\", products=\"rnvh3\")\ngood = pandora[pandora[\"no2_qa\"].isin([0, 10])]        # assured or not-assured HIGH quality only\n# Pandora reports moles per m²; TEMPO reports molecules per cm². 1 mol/m² = 6.022e19 molecules/cm².\ngood = good.assign(no2_trop=good[\"no2_trop_col\"] * 6.022e19)\nlat0, lon0 = float(good[\"latitude\"].iloc[0]), float(good[\"longitude\"].iloc[0])\ngood.plot(x=\"local_time\", y=\"no2_trop\", style=\".\", ylabel=\"NO₂ tropospheric column (molecules/cm²)\")", "tempo-search": "import earthaccess\nearthaccess.login()                                     # free NASA Earthdata account\nresults = earthaccess.search_data(short_name=\"TEMPO_NO2_L2\", version=\"V04\",\n                                  temporal=(\"2026-08-27 13:00\", \"2026-08-28 02:00\"),\n                                  bounding_box=(lon0 - 0.5, lat0 - 0.5, lon0 + 0.5, lat0 + 0.5))\npaths = earthaccess.download(results, \"tempo_files\")", "tempo-open": "def open_tempo_no2(path):\n    \"\"\"One TEMPO NO2 L2 granule as a flat table: one row per pixel.\"\"\"\n    prod = xr.open_dataset(path, group=\"product\")\n    geo = xr.open_dataset(path, group=\"geolocation\")\n    sup = xr.open_dataset(path, group=\"support_data\")\n    table = pd.DataFrame({\n        \"lat\": geo[\"latitude\"].values.ravel(),\n        \"lon\": geo[\"longitude\"].values.ravel(),\n        \"time\": np.repeat(geo[\"time\"].values, geo.sizes[\"xtrack\"]),   # one time per mirror step\n        \"no2_trop\": prod[\"vertical_column_troposphere\"].values.ravel(),\n        \"flag\": prod[\"main_data_quality_flag\"].values.ravel(),\n        \"cloud\": sup[\"eff_cloud_fraction\"].values.ravel(),\n    })\n    table[\"time\"] = pd.to_datetime(table[\"time\"]).dt.tz_localize(\"UTC\")\n    return table.dropna(subset=[\"no2_trop\"])\n\ntempo = pd.concat([open_tempo_no2(p) for p in paths], ignore_index=True)\nprint(tempo[\"flag\"].value_counts())                     # 0 normal, 1 suspicious, 2 bad", "tempo-filter": "clean = tempo[(tempo[\"flag\"] == 0) & (tempo[\"cloud\"] < 0.2)]\nprint(f\"kept {len(clean)} of {len(tempo)} pixels\")", "match": "def nearest_pixels(table, lat, lon, max_km=3):\n    \"\"\"Pixels whose center is within max_km of a site (TEMPO pixels are ~2 x 5 km).\"\"\"\n    dx = (table[\"lon\"] - lon) * 111.32 * np.cos(np.radians(lat))\n    dy = (table[\"lat\"] - lat) * 110.57\n    return table[np.hypot(dx, dy) <= max_km]\n\nnear = nearest_pixels(clean, lat0, lon0)\npairs = []\nfor scan_time, pix in near.groupby(near[\"time\"].dt.floor(\"10min\")):\n    t = pix[\"time\"].mean()\n    window = good[(good[\"utc_time\"] - t).abs() <= pd.Timedelta(\"30min\")]   # Pandora within ±30 min\n    if len(window):\n        pairs.append({\"time\": t, \"tempo\": pix[\"no2_trop\"].mean(), \"pandora\": window[\"no2_trop\"].mean(), \"n_pandora\": len(window)})\npairs = pd.DataFrame(pairs)\npairs.plot.scatter(x=\"pandora\", y=\"tempo\")", "tempo-aod": "aod_results = earthaccess.search_data(short_name=\"TEMPO_AODALH_L2\",\n                                      temporal=(\"2026-08-27 13:00\", \"2026-08-28 02:00\"),\n                                      bounding_box=(lon0 - 0.5, lat0 - 0.5, lon0 + 0.5, lat0 + 0.5))\naod_paths = earthaccess.download(aod_results, \"tempo_aod\")\n\ndef open_tempo_aod(path):\n    \"\"\"TEMPO AOD (550 nm) and aerosol layer height, one row per pixel.\"\"\"\n    prod = xr.open_dataset(path, group=\"product\")\n    geo = xr.open_dataset(path, group=\"geolocation\")\n    qf = xr.open_dataset(path, group=\"quality_diagnostic_flags\")\n    return pd.DataFrame({\n        \"lat\": geo[\"latitude\"].values.ravel(), \"lon\": geo[\"longitude\"].values.ravel(),\n        \"aod550\": prod[\"aod550\"].values.ravel(),\n        \"alh_km\": prod[\"alh\"].values.ravel(),\n        \"dqf\": qf[\"dqf\"].values.ravel(),          # 0 high, 1 medium, 2 low, 3 no retrieval\n    }).dropna(subset=[\"aod550\"])\n\naod = pd.concat([open_tempo_aod(p) for p in aod_paths], ignore_index=True)\naod_q = aod[(aod[\"dqf\"] == 0) & (aod[\"aod550\"] <= 5)]     # quantitative use: high quality, no extreme values\nalh_q = aod_q[aod_q[\"aod550\"] > 0.2]                      # layer height is only retrieved where AOD > 0.2", "tempo-adp": "adp_results = earthaccess.search_data(short_name=\"TEMPOABI_ADP_L2\",\n                                      temporal=(\"2026-08-27 13:00\", \"2026-08-28 02:00\"),\n                                      bounding_box=(lon0 - 0.5, lat0 - 0.5, lon0 + 0.5, lat0 + 0.5))\nadp_paths = earthaccess.download(adp_results, \"tempo_adp\")\n\ndef open_tempo_adp(path):\n    \"\"\"TEMPO-ABI smoke/dust mask, UV aerosol index and confidence, one row per pixel.\"\"\"\n    prod = xr.open_dataset(path, group=\"product\")\n    geo = xr.open_dataset(path, group=\"geolocation\")\n    qc = xr.open_dataset(path, group=\"quality_diagnostic_flags\")[\"qc_flag\"].values.ravel().astype(\"int64\")\n    return pd.DataFrame({\n        \"lat\": geo[\"latitude\"].values.ravel(), \"lon\": geo[\"longitude\"].values.ravel(),\n        \"smoke\": prod[\"smoke\"].values.ravel(), \"dust\": prod[\"dust\"].values.ravel(),\n        \"uv_aai\": prod[\"uv_aai\"].values.ravel(),\n        \"smoke_conf\": qc & 0b001100,              # 0 high, 4 medium, 8 low\n        \"dust_conf\": qc & 0b110000,               # 0 high, 16 medium, 32 low\n    })\n\nadp = pd.concat([open_tempo_adp(p) for p in adp_paths], ignore_index=True)\nsmoke_q = adp[(adp[\"smoke\"] == 1) & adp[\"smoke_conf\"].isin([0, 4])]   # quantitative: high + medium confidence\nplt.scatter(adp[\"lon\"], adp[\"lat\"], c=adp[\"uv_aai\"], s=1, cmap=\"magma\"); plt.colorbar(label=\"UV aerosol index\")\nplt.scatter(smoke_q[\"lon\"], smoke_q[\"lat\"], s=1, c=\"k\"); plt.title(\"Smoke (high + medium confidence) over the UV aerosol index\")", "abi-aod": "import s3fs\nfrom pyproj import Proj\nfs = s3fs.S3FileSystem(anon=True)                         # NOAA's public bucket: no login needed\nfiles = fs.ls(\"noaa-goes19/ABI-L2-AODC/2026/239/19/\")      # year / day of year (Aug 27 = 239) / hour, UTC\nwith fs.open(files[0]) as f:\n    abi = xr.open_dataset(f, engine=\"h5netcdf\").load()\n\nproj = abi[\"goes_imager_projection\"].attrs                # ABI fixed grid -> latitude and longitude\nh = proj[\"perspective_point_height\"]\ngeos = Proj(proj=\"geos\", h=h, lon_0=proj[\"longitude_of_projection_origin\"], sweep=proj[\"sweep_angle_axis\"])\nX, Y = np.meshgrid(abi[\"x\"].values * h, abi[\"y\"].values * h)\nabi_lon, abi_lat = geos(X, Y, inverse=True)               # points off the Earth's disk come back as inf\nabi_aod = abi[\"AOD\"].where(abi[\"DQF\"] == 0).values         # ABI: high quality only for quantitative use"}, "steps": [["setup", "1. Set up", "Install the tools. In Google Colab, run this once per session. <code>pandora-tools</code> is the reader for Pandora files; <code>earthaccess</code> handles NASA Earthdata downloads (you need a free Earthdata account).", "tested"], ["pandora", "2. Pandora NO₂ at St. Edward's", "Download Pandora 257's sky-scan NO₂ (product <code>rnvh3</code>) for the evening of the scan used on this site. Keep only high-quality readings (flags 0 and 10) and convert moles/m² to molecules/cm², TEMPO's unit.", "tested"], ["tempo-search", "3. Find and download TEMPO NO₂ granules", "Search NASA's catalog for TEMPO NO₂ Level 2 files over the site for the same day, in UTC (see “A Day of Measurements”).", "login"], ["tempo-open", "4. Open a TEMPO file as a table", "Read the three groups described in “Inside a TEMPO File” and flatten the mirror-step × cross-track grid into one row per pixel.", "tested"], ["tempo-filter", "5. Filter by quality and clouds", "Normal-quality pixels only, then a cloud-fraction cutoff. Print how many survive.", "tested"], ["match", "6. Match Pandora to TEMPO", "For each scan, average the pixels within 3 km of the site and the Pandora readings within ±30 minutes of the pixels' own time (see “Matching Instruments in Space and Time”).", "tested"], ["tempo-aod", "7. TEMPO AOD and layer height", "TEMPO's combined aerosol product (<code>TEMPO_AODALH_L2</code>). Keep high-quality AOD for quantitative work; layer height exists only where AOD is above 0.2.", "guide"], ["tempo-adp", "8. TEMPO's smoke/dust mask", "The TEMPO-ABI aerosol detection product (<code>TEMPOABI_ADP_L2</code>): smoke and dust flags, the UV aerosol index, and confidence stored as bits in <code>qc_flag</code>. For quantitative use, keep high and medium confidence.", "guide"], ["abi-aod", "9. ABI AOD from NOAA's public cloud", "GOES-19 ABI AOD for the continental US, read straight from NOAA's open bucket on Amazon Web Services with no login. ABI data sit on a fixed grid of scan angles, so latitude and longitude are computed from the projection.", "guide"]]};
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const NOTEBOOK_URL = "https://colab.research.google.com/github/paulsavala/nasa-training/blob/main/notebooks/hands_on.ipynb";
function pythonBody() {
  const badge = s => s === "tested" ? `<span class="py-badge ok">Run on real files</span>` : s === "login" ? `<span class="py-badge">Needs an Earthdata login; not run here</span>` : `<span class="py-badge warn">From the product's user guide; not yet run on real files</span>`;
  return `
    <p>This walks through one small study: how TEMPO's NO₂ over St. Edward's compares with the Pandora there on one evening, and then how to open TEMPO's aerosol products. It uses <a href="https://github.com/paulsavala/pandora-tools" target="_blank" rel="noopener">pandora-tools</a> for the Pandora files and standard Python libraries for the satellite files. Each step points back to the part of this site that explains it.</p>
    <p><a class="py-colab" href="${NOTEBOOK_URL}" target="_blank" rel="noopener">Open the notebook in Google Colab</a> <span class="note">or copy the cells below into your own notebook.</span></p>
    <div class="card"><h4>Before you start</h4>Steps 2 and 4–6 have been run on real Pandora and TEMPO files; step 3 needs a free Earthdata login. Steps 7–9 follow the product user guides: TEMPO's aerosol products only become generally available around spring 2027, so the searches in steps 7–8 may come back empty until then, and the variable names should be checked against the first real file you open.</div>
    ${PY.steps.map(([k, title, text, status]) => `<h3>${title}</h3><p>${text} ${badge(status)}</p>
      <div class="py-code"><button type="button" class="chip small py-copy" data-py="${k}">Copy</button><pre><code>${esc(PY.cells[k])}</code></pre></div>`).join("")}
    <h3>Ideas to try next</h3>
    <ul>
      <li>Repeat step 6 for a whole month and plot TEMPO against Pandora. How does the agreement change with time of day or cloud cover?</li>
      <li>Swap the 3 km pixel radius for pixels along the line toward the Sun (“Matching Instruments in Space and Time”).</li>
      <li>Add a TCEQ or EPA surface monitor and compare its ppb with the columns (“Columns vs. What You Breathe”).</li>
      <li>For a smoke day, compare TEMPO AOD with ABI AOD at the same hour, both on high quality only.</li>
    </ul>
    <p class="note">Sources for steps 7–9: <a href="https://www.star.nesdis.noaa.gov/atmospheric-composition-training/documents/TEMPO_AODALH_Users_Guide.pdf" target="_blank" rel="noopener">TEMPO AOD/ALH Users' Guide</a>, <a href="https://www.star.nesdis.noaa.gov/atmospheric-composition-training/documents/TEMPO-ABI_ADP_Users_Guide.pdf" target="_blank" rel="noopener">TEMPO-ABI ADP Users' Guide</a>, <a href="https://star.nesdis.noaa.gov/atmospheric-composition-training/documents/ABI_ADP_Users_Guide.pdf" target="_blank" rel="noopener">ABI ADP Users' Guide</a>. The ADP guide's sample code and its tables describe the confidence bits differently; the code above follows the masked values in its tables (high = 0, medium = 4 for smoke).</p>`;
}
function initCodeCopy() {
  document.querySelectorAll(".py-copy").forEach(b => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(PY.cells[b.dataset.py]); b.textContent = "Copied"; } catch (e) { b.textContent = "Select and copy"; }
    setTimeout(() => { b.textContent = "Copy"; }, 1600);
  }));
}

function retrievalHtml() {
  return `<figure class="retrieval" id="rt">
    <div class="rt-head">
      <div><b>Hidden atmosphere</b> <span class="note" id="rt-truth">AOD ? · NO₂ ?</span> <button type="button" class="chip small" id="rt-reveal">Reveal</button> <button type="button" class="chip small" id="rt-new">New one</button></div>
      <div class="rt-err" id="rt-err"></div>
    </div>
    <svg class="fig wide" id="rt-svg" viewBox="0 0 620 262" role="img" aria-label="Measured spectrum compared with the spectrum predicted from your guesses for aerosol optical depth and NO2."></svg>
    <div class="rt-controls">
      <div class="row"><label for="rt-aod">Guess AOD</label><input type="range" id="rt-aod" min="0" max="2" step="0.02" value="0.2"><span class="val" id="rt-aodV"></span></div>
      <div class="row"><label for="rt-no2">Guess NO₂</label><input type="range" id="rt-no2" min="0" max="4" step="0.05" value="0.5"><span class="val" id="rt-no2V"></span></div>
      <div class="row"><input type="checkbox" id="rt-bright"><label for="rt-bright" style="color:var(--fg)">Make the algorithm assume the ground is 50% brighter than it really is (a wrong prior)</label></div>
      <div class="row"><button type="button" class="chip" id="rt-solve">Let the algorithm search</button></div>
    </div>
    <figcaption><span id="rt-msg">Move the sliders until the dashed curve (your guess, run through the model) lies on the solid curve (what the satellite measured). Watch the dips between 400 and 470 nm for NO₂, and the overall level and the UV end for AOD.</span>
    <span class="note">Uses the same simplified model as the spectrum above (see "What this model simplifies"). Real retrievals fit far more detailed models, often through precomputed lookup tables. NO₂ in units of 10¹⁶ molecules/cm².</span></figcaption>
  </figure>`;
}
function initRetrieval() {
  const $ = id => document.getElementById(id); if (!$("rt")) return;
  let truth, measured, anim = null;
  const noise = () => { let s = 17; return () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 0.004; };
  const newTruth = () => {
    truth = { aod: +(0.15 + Math.random() * 1.3).toFixed(2), no2: +(0.4 + Math.random() * 2.8).toFixed(2) };
    const n = noise(); measured = spectrum(truth.aod, truth.no2).map(v => v + n());
    $("rt-truth").textContent = "AOD ? · NO₂ ?"; $("rt-reveal").hidden = false;
  };
  const X = w => 52 + (w - 300) / 440 * 552, Y = v => 214 - v / 0.45 * 196;
  const path = arr => arr.map((v, i) => inGap(RT.wl[i]) ? null : [X(RT.wl[i]), Y(v)]).reduce((d, p, i, a) => p ? d + (i && a[i - 1] ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1) : d, "");
  const misfit = sim => { let s = 0, n = 0; sim.forEach((v, i) => { if (!inGap(RT.wl[i])) { s += (v - measured[i]) ** 2; n++; } }); return Math.sqrt(s / n); };
  const model = (a, n) => spectrum(a, n, $("rt-bright").checked ? 1.5 : 1);
  function draw() {
    const a = +$("rt-aod").value, n = +$("rt-no2").value, sim = model(a, n), e = misfit(sim);
    $("rt-aodV").textContent = a.toFixed(2); $("rt-no2V").textContent = n.toFixed(2);
    let g = "";
    [0, 0.1, 0.2, 0.3, 0.4].forEach(v => { g += `<line x1="52" x2="604" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="46" y="${Y(v) + 3}" text-anchor="end">${v.toFixed(1)}</text>`; });
    [300, 400, 500, 600, 700].forEach(w => { g += `<text x="${X(w)}" y="232" text-anchor="middle">${w} nm</text>`; });
    g += `<text x="12" y="${Y(0.2)}" transform="rotate(-90 12 ${Y(0.2)})" text-anchor="middle">brightness seen from space</text>`;
    g += `<rect x="${X(494)}" y="${Y(0.45)}" width="${X(538) - X(494)}" height="${Y(0) - Y(0.45)}" style="fill:var(--card)"/><text x="${X(516)}" y="${Y(0.43)}" text-anchor="middle">no TEMPO</text><text x="${X(516)}" y="${Y(0.43) + 11}" text-anchor="middle">channels</text>`;
    g += `<rect x="${X(400)}" y="${Y(0.45)}" width="${X(470) - X(400)}" height="${Y(0) - Y(0.45)}" style="fill:var(--accent-soft);opacity:.55"/><text x="${X(435)}" y="${Y(0.43)}" text-anchor="middle">NO₂ dips</text>`;
    g += `<rect x="${X(300)}" y="${Y(0.45)}" width="${X(360) - X(300)}" height="${Y(0) - Y(0.45)}" style="fill:var(--warn-bg);opacity:.7"/><text x="${X(330)}" y="${Y(0.43)}" text-anchor="middle">UV: smoke</text><text x="${X(330)}" y="${Y(0.43) + 11}" text-anchor="middle">absorbs</text>`;
    g += `<path d="${path(measured)}" style="fill:none;stroke:var(--fg);stroke-width:2"/>`;
    g += `<path d="${path(sim)}" style="fill:none;stroke:var(--accent-bright);stroke-width:2;stroke-dasharray:6 4"/>`;
    g += `<line x1="360" x2="384" y1="254" y2="254" style="stroke:var(--fg);stroke-width:2"/><text x="388" y="257" class="strong">measured</text><line x1="460" x2="484" y1="254" y2="254" style="stroke:var(--accent-bright);stroke-width:2;stroke-dasharray:6 4"/><text x="488" y="257" class="strong">model, your guess</text>`;
    $("rt-svg").innerHTML = g;
    const good = e < 0.0035;
    $("rt-err").innerHTML = `Mismatch <span class="val" style="min-width:0">${(e * 1000).toFixed(1)}</span> ${good ? '<span class="rt-ok">matched</span>' : ""}`;
  }
  function solve() {
    let best = [0, 0, 1e9];
    for (let a = 0; a <= 2.0001; a += 0.02) for (let n = 0; n <= 4.0001; n += 0.05) { const e = misfit(model(a, n)); if (e < best[2]) best = [a, n, e]; }
    const a0 = +$("rt-aod").value, n0 = +$("rt-no2").value, t0 = performance.now(), D = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1400;
    cancelAnimationFrame(anim);
    const step = now => { const f = D ? Math.min(1, (now - t0) / D) : 1, e = 1 - Math.pow(1 - f, 3);
      $("rt-aod").value = a0 + (best[0] - a0) * e; $("rt-no2").value = n0 + (best[1] - n0) * e; draw();
      if (f < 1) anim = requestAnimationFrame(step); else done(best); };
    anim = requestAnimationFrame(step);
  }
  function done(best) {
    reveal();
    const more = best[0] > truth.aod ? "more" : "less", no2off = Math.abs(best[1] - truth.no2) > 0.15;
    $("rt-msg").textContent = $("rt-bright").checked
      ? `Best the algorithm can do: AOD ${best[0].toFixed(2)}, NO₂ ${best[1].toFixed(2)}. With the ground assumed too bright, no guess matches the measured curve. Even the best one leaves a visible gap, and to make up for the extra ground brightness it settles on ${more} aerosol than is really there${no2off ? ", and the wrong amount of NO₂ too" : ""}. Wrong prior information gives wrong answers: this is why bright surfaces cause trouble for aerosol retrievals, and part of why retrievals come with quality flags.`
      : `Best match: AOD ${best[0].toFixed(2)}, NO₂ ${best[1].toFixed(2)}, close to the hidden values. With correct assumptions, finding the best-matching curve recovers the atmosphere. Now tick the wrong-prior box and search again.`;
  }
  const reveal = () => { $("rt-truth").textContent = `AOD ${truth.aod.toFixed(2)} · NO₂ ${truth.no2.toFixed(2)}`; $("rt-reveal").hidden = true; };
  $("rt-aod").addEventListener("input", draw); $("rt-no2").addEventListener("input", draw); $("rt-bright").addEventListener("change", draw);
  $("rt-solve").addEventListener("click", solve); $("rt-reveal").addEventListener("click", reveal);
  $("rt-new").addEventListener("click", () => { newTruth(); $("rt-msg").textContent = "A new hidden atmosphere. Try matching it by hand, then let the algorithm search."; draw(); });
  newTruth(); draw();
}

const SECTIONS = [
/* ------------------------------------------------------------------ BACKGROUND */
{ id: "aerosols", part: "b", title: "What Aerosols Are, and How We Measure Them",
  lede: "Aerosols are tiny particles floating in the air: smoke, dust, sea salt, soot and droplets of chemicals formed in the air. They are measured from the ground, from aircraft and from space.",
  scene: { view: "overview", ...NEAR, rays: false },
  start: "Smoke over Austin, drawn as spheres. The real particles are far too small to see: a few millionths of a meter across.",
  tries: [
    { label: "Smoke", scene: { ...NEAR, rays: false }, note: "Smoke from fires: mostly fine particles of organic carbon and soot, which absorb sunlight, especially in the ultraviolet." },
    { label: "Dust", scene: { ...DUST, rays: false }, note: "Mineral dust lifted by strong winds: larger particles, often carried high and far." },
    { label: "Thin haze", scene: { ...HAZE, rays: false }, note: "A light, everyday haze: small particles formed in the air from gases such as sulfur dioxide, nitrogen oxides and organic vapors (secondary aerosol)." },
    { label: "Aircraft spiral", scene: { ...NEAR, plane: true, rays: false, view: "plane", radius: 12, vex: 3 }, note: "A research aircraft samples the air directly as it descends. Its trail takes the smoke's color only inside the layer, which turns into a measured vertical profile. Aircraft and spiral are drawn larger than life." },
  ],
  body: () => `
    <p>Air pollution comes in two forms: <b>gases</b> (such as NO₂, ozone and sulfur dioxide) and <b>particles</b>. Particles suspended in the air are called <b>aerosols</b>, or particulate matter (PM). They include smoke from fires, dust blown off dry land, sea salt, soot from engines, and droplets formed in the air when gases react.</p>
    <ul>
      <li><b>Primary</b> aerosols are emitted directly as particles: smoke, dust, soot, sea spray.</li>
      <li><b>Secondary</b> aerosols form in the air, when gases such as sulfur dioxide, nitrogen oxides and organic vapors react and condense.</li>
      <li><b>Size matters.</b> PM2.5 means particles smaller than 2.5 micrometers, about 30 times thinner than a human hair. They reach deep into the lungs, which is why air-quality standards regulate them.</li>
    </ul>
    <p>They are tiny but potent. Aerosols affect health and visibility, scatter and absorb sunlight (a direct effect on climate), act as the seeds that cloud droplets form on (an indirect effect), and fall out as acid rain and deposition.</p>
    <h3>Three ways to monitor air pollution</h3>
    <p>Monitoring draws on three sources that work best together: <b>ground measurements</b> (monitors and instruments like the Pandora at St. Edward's), <b>air and space observations</b> (aircraft and satellites) and <b>models</b>. Most of this site is about the satellite part, which is <b>remote sensing</b>: collecting information about something without touching it, the way your eye or a camera does. Which platform to use depends on what you need to know, in how much detail, and how often.</p>
    ${ladderSvg()}
    <p class="note" style="margin-top:6px">Where measurements are made, on a log scale of height above the ground.</p>
    <h3>Why aircraft still matter</h3>
    <p>Research aircraft carry instruments that sample the air directly (in situ) or look down at it like a satellite. Flying spirals over ground sites, as NASA's DISCOVER-AQ campaigns did, they measure vertical profiles of particles and gases in detail that no satellite can match. They fly only on campaign days and over small areas, so their main role is to test and improve satellite retrievals and models. Try ${dl("Aircraft spiral")} above.</p>`,
  slides: [["f-04", "Air pollution monitoring", "Ground, air and space, and models"], ["f-09", "Remote sensing platforms"], ["f-10", "Remote sensing of our planet", "Platforms by height"]] },

{ id: "measure", part: "b", title: "What Satellites Actually Measure", stage: false, topFigure: () => lightPathSvg(),
  lede: "A satellite like TEMPO doesn't measure smoke or NO₂ directly. It measures light: how bright the Earth looks from space at each wavelength. Everything else is worked out from that.",
  scene: { view: "overview", ...NEAR }, start: "", tries: [],
  body: () => `
    <p>It helps to take it in three steps.</p>
    <p><b>1. Where the sunlight goes.</b> Sunlight comes down through the atmosphere, and different things happen to different bits of it before some of it reaches the satellite, as the figure above shows. The Earth also emits infrared and microwave radiation of its own, which other instruments use; TEMPO works with reflected sunlight.</p>
    <p><b>2. What arrives is a spectrum.</b> All those paths add up, and the instrument records the total brightness at each wavelength: one curve per pixel. Each ingredient changes the curve in its own way. A gas like NO₂ absorbs at its own set of wavelengths, cutting a pattern of small dips into the curve, like a fingerprint; more gas means deeper dips. Aerosols change the curve's overall shape: scattering brightens it, and smoke and dust absorb strongly in the ultraviolet, darkening that end. Try building a spectrum yourself:</p>
    ${mixerHtml()}
    <p><b>3. A retrieval works backward.</b> The algorithm can't read the amounts off the curve. Instead it uses a <b>radiative transfer model</b>, physics that predicts what the spectrum <i>would</i> look like for a given atmosphere, and adjusts its guesses until the predicted curve matches the measured one. Whatever the model can't solve for, such as how bright the ground is or what kind of aerosol it is, comes in as <b>prior information</b> (assumptions). Try it:</p>
    ${retrievalHtml()}
    <p>That is the whole chain in the slides:</p>
    <div class="chain"><span class="box">Measured spectral radiance</span><span class="arr">+</span><span class="box">Prior information &amp; radiative transfer</span><span class="arr">→ retrieval algorithm →</span><span class="box">Geophysical parameters</span><span class="arr">→</span><span class="box">Applications</span></div>
    <p>Every product in Part 1 (mask, AOD, layer height, PM2.5) comes out of a chain like this. That is why clouds, bright surfaces and a low sun keep coming up: they make the measured curve harder to match, or make the assumptions wrong.</p>`,
  after: () => { initMixer(); initRetrieval(); },
  slides: [["f-13", "Measuring the Earth–atmosphere system from space"], ["f-14", "The remote sensing process"]] },

{ id: "sensors", part: "b", title: "Passive and Active Sensors",
  lede: "Passive sensors rely on sunlight or the Earth's own glow. Active sensors bring their own light, like a flash, and time the echo.",
  scene: { view: "east", ...NEAR, lidar: true, rays: false },
  start: "A satellite lidar (active) passing over Austin. Its laser echoes build a curtain showing where the aerosol is in height, along a thin line under the satellite's track.",
  tries: [
    { label: "Smoke near the ground", scene: { ...NEAR, lidar: true, rays: false, view: "east" }, note: "The curtain lights up just above the ground, inside the boundary layer." },
    { label: "Smoke aloft", scene: { ...ALOFT, lidar: true, rays: false, view: "east" }, note: "The curtain places the layer high above the boundary layer: vertical detail that a passive column measurement like AOD doesn't have." },
    { label: "Passive: sunlight only", scene: { ...NEAR, lidar: false, rays: true, view: "overview" }, note: "A passive instrument like TEMPO only sees sunlight that the scene sends its way (blue line), so it measures the whole column at once and works only in daylight." },
  ],
  body: () => `
    <p><b>Passive</b> sensors detect what the scene gives off on its own or reflects from another source, usually the Sun. MODIS, MISR, OMI, VIIRS and TEMPO are all passive. They see wide areas at once, but in the visible and ultraviolet only in daylight, and they see the whole column of air together.</p>
    <p><b>Active</b> sensors send out their own signal and measure what comes back, like radar or sonar. The lidar on CALIPSO (2006–2023) was the training's example. By timing its laser's echoes, it measured how high aerosol layers sat, day or night, but only along a footprint about 100 m wide under its track.</p>
    <p>The two complement each other. TEMPO's layer height product (Part 1) is a way of getting some of the vertical information a lidar gives, but from a passive instrument that covers all of North America every hour.</p>`,
  slides: [["f-23", "Active and passive sensors"]] },

{ id: "orbits", part: "b", title: "Orbits and Resolution", stage: false, topFigure: () => orbitHtml(),
  lede: "Where a satellite orbits decides how often it sees a place. Its design decides how much detail it sees. No instrument can have everything at once.",
  scene: { view: "overview", ...NEAR }, start: "", tries: [],
  body: () => `
    <p>The globe above compares the two common orbits over a simulated day. Painted areas are where each instrument has measured so far; like TEMPO, both only measure in daylight.</p>
    <div class="tablewrap"><table class="t">
      <thead><tr><th></th><th>Polar (sun-synchronous) orbit</th><th>Geostationary orbit</th></tr></thead>
      <tbody>
        <tr><th>Height</th><td>About 600–1,000 km (NOAA-20: 833 km, one orbit every 101 minutes)</td><td>About 36,000 km above the equator (TEMPO: 35,786 km, at 91°W)</td></tr>
        <tr><th>Motion</th><td>Circles pole to pole; passes over a place at about the same local solar time each day</td><td>Turns with the Earth, so it appears fixed in the sky</td></tr>
        <tr><th>How often</th><td>1–3 observations per day, per sensor</td><td>Every 30 seconds to 1 hour, over one region</td></tr>
        <tr><th>Examples</th><td>Terra and Aqua (MODIS), Aura (OMI), Suomi NPP and NOAA-20 (VIIRS)</td><td>GOES-East and -West (ABI), Himawari-8/9, GEO-KOMPSAT-2A, and for air quality TEMPO, GEMS and Sentinel-4</td></tr>
      </tbody></table></div>
    ${daySvg()}
    <p class="note" style="margin-top:6px">One summer day of observations over Austin. Overpass times are approximate local solar times.</p>
    <p>Satellites and their instruments have separate names, and a satellite's name changes over its life. The 2023 slides use GOES as the example: GOES-R and GOES-S before launch became GOES-16 and GOES-17 in orbit, then GOES-East and GOES-West once operational. Today GOES-19 serves as GOES-East and GOES-18 as GOES-West. The instrument on each is ABI.</p>
    <h3>Four kinds of resolution</h3>
    <ul>
      <li><b>Spatial:</b> the size of a pixel, the smallest area measured. MODIS 250 m–1 km; MISR 275 m–1.1 km; VIIRS 375 m; OMI 13 × 24 km; TEMPO about 2 × 5 km.</li>
      <li><b>Temporal:</b> how often the same place is observed. For polar orbiters it depends mostly on swath width: VIIRS (3,000 km swath) covers the globe daily, MODIS (2,300 km) every 1–2 days, MISR (380 km) every 6–8 days. Geostationary instruments revisit their region every 30 seconds to an hour.</li>
      <li><b>Spectral:</b> the number of independent channels. ABI has 16; TEMPO has thousands.</li>
      <li><b>Radiometric:</b> how finely the detectors distinguish brightness.</li>
    </ul>
    <p>It is very difficult to get extremely high spatial, temporal, spectral and radiometric resolution all at once. TEMPO is one answer to that trade-off: hourly, hyperspectral and kilometer-scale, but only in daylight and only over North America.</p>`,
  after: () => initOrbits(),
  slides: [["f-17", "Common orbit types"], ["f-19", "Observation frequency"], ["f-20", "Swath width"], ["f-25", "Why spatial resolution matters"], ["f-26", "Temporal resolution"], ["f-29", "The remote sensing trade-off"]] },
/* ------------------------------------------------------------------ PART 1 */
{ id: "geo", part: 1, title: "The Geostationary View",
  lede: "TEMPO and the GOES-R Advanced Baseline Imager watch North America from a fixed point about 36,000 km up, so they can see the same place every hour, or every few minutes.",
  scene: { view: "overview" },
  start: "The orange line points to the Sun, low in the west. The blue line points to TEMPO, high in the southern sky. Drag to orbit; scroll to zoom.",
  tries: [
    { label: "Side view", scene: { view: "side" }, note: "From the side, the low Sun is obvious: its line climbs only about 1 km for every 7 km it travels. TEMPO's line is much steeper." },
    { label: "Hide the smoke", scene: { aer: false }, note: "Without the aerosol layer you see only what these TEMPO files actually contain: pixels (colored by cloud), the boundary layer, and the viewing geometry." },
    { label: "Map view", scene: { view: "top" }, note: "From above, the tiles are TEMPO's pixels over Austin. Each is a few kilometers across; downtown fits inside a handful of them." },
  ],
  body: () => `
    <p>Satellites that measure air quality used to circle the Earth in low orbits and pass over any given city about once a day. A geostationary satellite instead orbits once per day above the equator, so it hovers over the same spot. From there it can watch pollution build, move and fade over the course of a day.</p>
    <p>Two geostationary instruments matter for aerosols over North America:</p>
    <ul>
      <li><b>TEMPO</b> (Tropospheric Emissions: Monitoring of Pollution), NASA's instrument and the first geostationary mission for hourly daytime air-quality monitoring over North America. It is the North American part of an international constellation of geostationary air-quality instruments across the Northern Hemisphere.</li>
      <li><b>ABI</b>, the Advanced Baseline Imager on NOAA's GOES-R series weather satellites, covered in “GOES-R ABI, and How the Two Compare” below.</li>
    </ul>
    <p>Here is what that means over a day. A geostationary instrument like TEMPO stays above the same spot and scans North America every daylight hour; a polar orbiter, for comparison, sees each place about once a day:</p>
    ${orbitHtml("geo")}
    <p>TEMPO was selected in 2012 as a joint project of NASA and the Smithsonian Astrophysical Observatory, rode to orbit on April 7, 2023 aboard the Intelsat 40e satellite, saw first light on August 2, 2023, and began nominal operations on October 19, 2023. Its base mission ended June 19, 2025, and it has been extended through September 2029.</p>
    <h3>What the 3D scene shows</h3>
    <p>Throughout this site, the scene is built from one real TEMPO scan over Austin, Texas: ${q(() => new Date(V.META.austin_start_utc).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }))} CDT. The flat tiles are TEMPO's pixels, colored here by cloud fraction. The translucent green sheet is the top of the boundary layer, about ${pblKm()} km up. Downtown's towers, the river and St. Edward's University (where a Pandora spectrometer stands, marked by the orange pin) are drawn from OpenStreetMap.</p>
    <p>The brown spheres are an <b>aerosol layer you control</b>. The TEMPO files behind this scene are for NO₂, formaldehyde and ozone, not aerosols, so the layer is a model. It lets each section show what an aerosol product would say about a layer of smoke or dust, using this evening's real clouds, boundary layer and sun angle.</p>
    <div class="card"><h4>Read the numbers with care</h4>This pass came with the Sun only ${sunUp()}° above the horizon and mostly cloudy skies, and TEMPO flags every pixel over Austin as "suspicious". That makes it a poor scan for measuring anything, but a useful one for this training, which spends a lot of time on exactly these conditions.</div>`,
  after: () => initOrbits("geo"),
  slides: [["p1-06", "The geostationary era of air quality", "TEMPO estimated PM2.5 during wildfire smoke, 18–22 UTC on July 14, 2026"], ["p1-15", "GEO instruments for aerosol monitoring", "TEMPO and GOES-R ABI"], ["p1-16", "TEMPO mission objectives"], ["p1-17", "TEMPO mission timeline"]] },

{ id: "spectrum", part: 1, title: "Seeing in Ultraviolet and Visible Light",
  lede: "TEMPO splits sunlight into thousands of narrow wavelengths from the ultraviolet to the red. Those fine spectral details let it tell gases, smoke and dust apart.",
  scene: { view: "side", rays: true },
  start: "The side view shows what TEMPO's spectra are sensitive to: the aerosol layer's thickness and, through the 670/688 nm pair, its height.",
  tries: [
    { label: "Smoke", scene: { ...NEAR, view: "side" }, note: "Smoke absorbs ultraviolet light strongly, so it lowers the UV signal TEMPO sees. That is what the UV Aerosol Index picks up." },
    { label: "Dust", scene: { ...DUST, view: "side" }, note: "Dust absorbs in the UV too. Deciding whether an absorbing plume is smoke or dust takes further spectral tests, which feed the smoke/dust mask." },
    { label: "Thin haze", scene: { ...HAZE, view: "side" }, note: "A thin, weakly absorbing haze barely changes the spectrum. Thin smoke is still detectable in the UV, which is one of TEMPO's advantages over ABI." },
  ],
  body: () => `
    <p>TEMPO is a <b>hyperspectral spectrometer</b>. Rather than a handful of broad color bands, it records a nearly continuous spectrum from about <b>293 to 741 nm</b> (with a gap near 494–538 nm), at 0.6 nm resolution with 0.2 nm sampling. It covers North America from Mexico to Canada with hourly daytime scans, at about 2.0 × 4.75 km at the center of its field of regard.</p>
    ${q(() => V.spectrumSvg(), "")}
    <p class="note" style="margin-top:6px">Where TEMPO looks in the spectrum. Gas windows are approximate.</p>
    <h3>What the spectrum is used for</h3>
    <ul>
      <li><b>Gases.</b> Each gas absorbs at its own pattern of wavelengths. TEMPO's key trace gases are NO₂, O₃, SO₂ and HCHO.</li>
      <li><b>Aerosol presence and type.</b> Smoke and dust absorb ultraviolet light. The UV bands give the <b>UV Absorbing Aerosol Index (UV AAI)</b>, the first step in identifying smoke and dust.</li>
      <li><b>Aerosol height.</b> The ratio of two red bands, 670 and 688 nm, carries information on how high the aerosol is. The 688 nm band sits in an oxygen absorption band: light reflected by a high layer passes through less oxygen, so the ratio changes with the layer's height (see “Aerosol Layer Height”).</li>
    </ul>
    <p>This is the core difference from a weather imager like ABI, which sees with 16 broader bands from the visible to the thermal infrared, and has no ultraviolet bands.</p>`,
  slides: [["p1-18", "TEMPO instrument overview"], ["p1-19", "TEMPO's spectral resolution", "Spectral coverage over typical surface reflectances"]] },

{ id: "pixels", part: 1, title: "Pixels and Scan Timing",
  lede: "Each TEMPO pixel covers a few kilometers, and its size depends on where it falls in TEMPO's view. A full scan of North America takes about an hour.",
  scene: { view: "top", radius: 14, tgrid: true, aer: false, rays: false, pbl: false },
  start: "Map view with TEMPO's pixel edges outlined in blue. Each tile is one measurement; everything inside it is averaged together.",
  tries: [
    { label: "Fly to downtown", scene: { view: "city", radius: 8, tgrid: true, aer: false, rays: false, pbl: false }, note: "Downtown's towers sit inside a few TEMPO pixels. A single pixel can't resolve one building or street; it averages over roughly 9 km²." },
    { label: "Whole crop", scene: { view: "top", radius: 55, tgrid: true, aer: false, rays: false, pbl: false }, note: "The full area in these files, about 100 km across. TEMPO's pixels here are narrow north–south and long east–west, about 2 × 5 km." },
    { label: "Compare: OMI pixels", scene: { view: "top", radius: 25, tgrid: true, fp: "omi", aer: false, rays: false, pbl: false }, note: "OMI (purple), TEMPO's ultraviolet predecessor in low orbit, saw this area in a few 13 × 24 km pixels, once a day. TEMPO (blue) sees it in about a hundred, every hour." },
    { label: "Compare: VIIRS pixels", scene: { view: "top", radius: 6, tgrid: true, fp: "viirs", aer: false, rays: false, pbl: false }, note: "VIIRS imagery pixels (375 m, purple) are far finer than TEMPO's (blue), but VIIRS passes over only about once a day: the spatial-versus-temporal trade-off." },
  ],
  body: () => `
    <p>TEMPO's footprint isn't the same everywhere. Pixels grow with the <b>viewing zenith angle</b>, the angle between straight up and the line to the satellite. Over Austin in these files, pixels measure about <b>${q(() => V.NS)} km north–south by ${q(() => V.EW)} km east–west</b>, seen ${f0(() => V.META.angles.vza)}° from vertical. From the training:</p>
    <div class="tablewrap"><table class="t">
      <thead><tr><th>Location</th><th>N–S (km)</th><th>E–W (km)</th><th>Viewing angle</th></tr></thead>
      <tbody>
        <tr><th>Center of field of regard (33.5°N, 89.2°W)</th><td>2.0</td><td>4.8</td><td>39°</td></tr>
        <tr><th>Mexico City</th><td>1.6</td><td>4.7</td><td>25°</td></tr>
        <tr><th>Miami</th><td>1.8</td><td>4.8</td><td>32°</td></tr>
        <tr><th>Washington, DC</th><td>2.3</td><td>5.1</td><td>47°</td></tr>
        <tr><th>Seattle</th><td>3.3</td><td>6.5</td><td>63°</td></tr>
        <tr><th>Juneau</th><td>5.9</td><td>9.1</td><td>76°</td></tr>
        <tr><th>Austin (this scan)</th><td>${q(() => V.NS)}</td><td>${q(() => V.EW)}</td><td>${f0(() => V.META.angles.vza)}°</td></tr>
      </tbody></table></div>
    <p>The table only samples a few places. Explore the rest of North America yourself:</p>
    ${vzaHtml()}
    <h3>When TEMPO looks</h3>
    <p>TEMPO builds each image by sweeping a mirror from east to west across North America. It has flexible scanning to cover as much daylight as possible and to catch fast-moving events:</p>
    <ul>
      <li><b>Nominal operations:</b> hourly east–west scans of the full domain; shorter, 40-minute optimized scans around dawn and dusk; and pre-sunrise twilight scans (city lights, auroras).</li>
      <li><b>Special operations:</b> rapid regional scans every 10 minutes or less, for wildfires, dust storms and volcanic eruptions. The TEMPO Operations Log lists the dates.</li>
    </ul>
    <p>The scan in this scene reached Austin at ${q(() => new Date(V.META.austin_start_utc).toISOString().slice(11, 16))} UTC: the mirror crossed the whole Austin area in about a minute. TEMPO only measures in daylight, so this evening scan, with the Sun ${sunUp()}° up, was among the day's last.</p>`,
  after: () => initVza(),
  slides: [["p1-20", "TEMPO's spatial resolution", "Pixel size across the field of regard"], ["p1-21", "Spatial resolution examples", "Mexico City and New York"], ["p1-22", "Temporal resolution: scanning modes"]] },

{ id: "abi", part: 1, title: "GOES-R ABI, and How the Two Compare",
  lede: "ABI is a weather imager: it has fewer, broader bands than TEMPO and no ultraviolet, but finer pixels and new images every 1 to 10 minutes, day and night.",
  scene: { view: "top", radius: 10, tgrid: true, abi: true, aer: false, rays: false, pbl: false },
  start: "TEMPO's pixels (blue) with a 2 km grid (red) laid over them for scale: about the finest spacing of ABI's aerosol products. Over Texas, ABI's real cells are somewhat larger than 2 km.",
  tries: [
    { label: "TEMPO pixels only", scene: { view: "top", radius: 10, tgrid: true, abi: false, aer: false, rays: false, pbl: false }, note: "TEMPO: about 2 × 5 km, once an hour, in daylight." },
    { label: "ABI grid only", scene: { view: "top", radius: 10, tgrid: false, abi: true, aer: false, rays: false, pbl: false }, note: "ABI's aerosol products: about 2 km cells at the satellite's nadir, every 5–10 minutes. Imagery is less pixelated than TEMPO's." },
    { label: "Both, with smoke", scene: { view: "overview", radius: 10, tgrid: true, abi: true, ...NEAR }, note: "Both instruments see the same smoke. Only TEMPO can estimate how high it is; only ABI can follow it minute by minute and at night (fires and dust)." },
  ],
  body: () => `
    <p>The <b>Advanced Baseline Imager</b> is the main instrument on NOAA's GOES-R satellites (one of six instruments on each), built for weather, oceans and environmental hazards. GOES-19 operates as GOES-East and GOES-18 as GOES-West. ABI is a multispectral imaging radiometer:</p>
    <ul>
      <li><b>16 bands</b> from 0.47 to 13.3 µm: 2 visible, 4 near-infrared and 10 infrared.</li>
      <li><b>0.5 to 2 km</b> pixels: 0.5 km for band 2, 1 km for bands 1, 3 and 5, and 2 km for the rest.</li>
      <li><b>Fast scanning</b> in the default flex mode: the full disk every 10 minutes, the continental US every 5 minutes, and two movable 1,000 × 1,000 km mesoscale sectors every minute.</li>
    </ul>
    ${q(() => V.cadenceSvg(), "")}
    <p class="note" style="margin-top:6px">How often each instrument observes within one hour.</p>
    <h3>Side by side</h3>
    <div class="tablewrap"><table class="t">
      <thead><tr><th></th><th>TEMPO</th><th>GOES-R ABI</th></tr></thead>
      <tbody>
        <tr><th>Instrument</th><td>Hyperspectral spectrometer</td><td>Multispectral imaging radiometer</td></tr>
        <tr><th>Mission</th><td>Air quality and atmospheric chemistry</td><td>Weather, hazards and environmental monitoring</td></tr>
        <tr><th>Spectrum</th><td>UV and visible, ~293–741 nm, thousands of narrow bands</td><td>Visible to infrared, 16 wider bands</td></tr>
        <tr><th>Detects</th><td>Trace gases (NO₂, O₃, HCHO) and aerosols</td><td>Clouds, fires, smoke, dust, sea surface temperature</td></tr>
        <tr><th>Pixels</th><td>~2.0 × 4.75 km at center of view</td><td>0.5–2 km at nadir, depending on band</td></tr>
        <tr><th>How often</th><td>Hourly (10 min in special operations)</td><td>10 min full disk, 5 min CONUS, 1 min mesoscale</td></tr>
        <tr><th>Strengths for air quality</th><td>Trace gases; aerosol layer height; daytime smog through the day</td><td>Rapid tracking of plumes; fire hot spots and dust day and night; early warning</td></tr>
        <tr><th>Blind spots</th><td>No data after sunset; hourly scans miss rapid fire or dust onset; no thermal bands for fire heat</td><td>No trace gases; smoke invisible to IR at night; no aerosol height</td></tr>
      </tbody></table></div>
    <p>In the training's words, ABI monitors rapid transport and TEMPO reveals chemical composition. The two are designed to be used together.</p>`,
  slides: [["p1-25", "GOES-R Advanced Baseline Imager"], ["p1-26", "ABI spectral resolution"], ["p1-27", "ABI scanning modes"], ["p1-28", "TEMPO and ABI: characteristics"], ["p1-29", "TEMPO and ABI: air-quality applications"]] },

{ id: "products", part: 1, title: "The Aerosol Product Family", readout: true,
  lede: "Five aerosol products come from TEMPO, ABI or both. TEMPO's build on each other: the smoke/dust mask feeds aerosol optical depth, which feeds surface PM2.5.",
  scene: { view: "overview", ...NEAR },
  start: "The panel beside the text reads the scene the way the product family would: column amount, layer height, and what reaches the surface.",
  tries: [
    { label: "Smoke near the surface", scene: { ...NEAR }, note: "AOD sees heavy smoke; the layer height puts it inside the boundary layer; surface PM2.5 would be elevated." },
    { label: "Smoke aloft", scene: { ...ALOFT, view: "side" }, note: "Similar AOD, very different story at the surface. Only the layer height product tells these two apart." },
    { label: "Thin haze", scene: { ...HAZE }, note: "AOD below 0.2: TEMPO doesn't estimate a layer height for aerosol this thin." },
  ],
  body: () => `
    <div class="tri"><div><b>Column</b>Aerosol optical depth: how much aerosol in total.</div><div><b>Height</b>Aerosol layer height: how high the densest layer sits.</div><div><b>Surface</b>Estimated PM2.5: what reaches the air people breathe.</div></div>
    <div class="tablewrap"><table class="t">
      <thead><tr><th>Product</th><th>Inputs</th><th>File prefix</th><th>Main variables</th><th>Level</th></tr></thead>
      <tbody>
        <tr><th>Aerosol detection</th><td>ABI</td><td><code>OR_ABI-L2-ADPF / ADPC / ADPM</code></td><td>Smoke/dust mask</td><td>2, ABI fixed grid</td></tr>
        <tr><th>Aerosol optical depth</th><td>ABI</td><td><code>OR_ABI-L2-AODF / AODC</code></td><td>AOD</td><td>2, ABI fixed grid</td></tr>
        <tr><th>Aerosol detection</th><td>TEMPO & ABI</td><td><code>TEMPO-ABI-G19_ADP_L2</code></td><td>UV AAI, smoke/dust mask</td><td>2, TEMPO granule</td></tr>
        <tr><th>AOD & layer height</th><td>TEMPO</td><td><code>TEMPO_AODALH_L2</code></td><td>AOD, aerosol layer height</td><td>2, TEMPO granule</td></tr>
        <tr><th>Fine particulate matter</th><td>TEMPO & ABI</td><td><code>TEMPO-ABI_PM25_L4</code></td><td>1-hour average surface PM2.5</td><td>4, ABI fixed grid</td></tr>
      </tbody></table></div>
    <p class="note">The ABI fixed grid is a map projection based on the geostationary satellite's viewpoint. It is irregular: cells cover more ground the farther they are from the point directly below the satellite.</p>
    <h3>How TEMPO's products are made</h3>
    <p>In the training, "TEMPO aerosol products" means products whose algorithms ingest TEMPO's Level 1b radiance and irradiance files; they also ingest ABI Level 1b and/or Level 2 products. To keep latency short, they use the near-real-time version of TEMPO's Level 1b radiances. Once operational, latency will be about 2 hours; research versions today can take much longer. The products feed one another:</p>
    <div class="chain"><span class="box">Smoke/dust mask</span><span class="arr">→ input to →</span><span class="box">Aerosol optical depth</span><span class="arr">→ input to →</span><span class="box">Surface PM2.5</span></div>
    <p>The next four sections take them one at a time.</p>`,
  slides: [["p1-32", "ABI and TEMPO aerosol products overview"], ["p1-33", "TEMPO aerosol algorithms"]] },

{ id: "mask", part: 1, title: "The Smoke/Dust Mask", readout: true,
  lede: "The aerosol detection product answers a qualitative question: is there smoke or dust in this pixel, and is it thin or thick?",
  scene: { view: "overview", ...NEAR, ground: "cloud" },
  start: `This evening is a hard case for the mask: the Sun is only ${sunUp()}° up, and about ${cloudyPct()}% of pixels are mostly cloudy.`,
  tries: [
    { label: "Thick smoke", scene: { aerType: "smoke", aod: 1.6, alh: 1.0, thick: 1.4 }, note: "Thick smoke over a dark surface is where the mask is most accurate. But very thick smoke can be misread upstream as cloud, leaving gaps." },
    { label: "Thin haze", scene: { ...HAZE }, note: "Optically thin smoke is often missed by ABI's mask. TEMPO's UV aerosol index can still pick it up, and reports it as thin." },
    { label: "Smoke over cloud", scene: { aerType: "smoke", aod: 0.7, alh: 4.5, thick: 1.5, view: "side" }, note: "Smoke above a cloud deck: the mask isn't retrieved under clouds, but TEMPO has a smoke-over-cloud 'call-back' for this case." },
    { label: "Dust", scene: { ...DUST }, note: "ABI's mask is more accurate for dust over ocean. TEMPO can mislabel thin dust over vegetation, or Saharan dust over ocean, as smoke." },
  ],
  body: () => `
    <p>The aerosol detection product (ADP), usually called the <b>smoke/dust mask</b>, is a qualitative indicator. Spectral threshold tests separate absorbing aerosols (smoke and dust) from clouds and clear sky. It is the quickest way to see where smoke or dust is.</p>
    <h3>How the light paths become a mask</h3>
    <p>The mask starts from the same four things that can happen to sunlight on its way to the satellite. Each leaves a different signature in the spectrum, and the tests look for those signatures:</p>
    ${lightPathSvg({ smokeOverCloud: true, caption: `<ol class="paths">
      <li><b>Ground.</b> The reference. Over dark ground (water, forest) any brightening or UV darkening from aerosol stands out clearly; over bright ground (white sand, snow) it is hard to tell apart from the ground itself, which is where false smoke comes from.</li>
      <li><b>Scattered by aerosol.</b> Smoke and dust add brightness in the visible but, because they absorb, return less ultraviolet light than a clean sky would. That UV deficit is what the UV Aerosol Index measures.</li>
      <li><b>Cloud top.</b> Clouds are bright and nearly the same at every wavelength (white), with no UV deficit, so spectral tests can tell them from smoke. Smoke drifting <i>above</i> a cloud still absorbs the cloud's reflected UV, so the index catches smoke over clouds: TEMPO's "call-back".</li>
      <li><b>Absorbed.</b> The light that never returns is the signal. Absorption is strongest in the ultraviolet, which is why TEMPO's UV bands see thin smoke that ABI, with no UV bands, misses.</li>
    </ol><span class="note">Same light paths as in “What Satellites Actually Measure”, read the way the mask's spectral tests read them.</span>` })}
    <p>The key quantity is the <b>UV Aerosol Index</b>: it compares the ultraviolet brightness the satellite measures with what a clean, aerosol-free atmosphere would give at the same sun and viewing angles. Clean air and clouds come out near zero; absorbing smoke and dust come out positive, and more strongly the thicker they are. Further spectral tests then separate smoke from dust and screen out clouds and clear sky, and the result is a yes-or-no mask with a rough thickness.</p>
    <p>Try it: build a scene and see what the mask makes of it.</p>
    ${maskSimHtml()}
    <p>TEMPO's version is a <b>hybrid</b> that uses Level 1b radiances from both TEMPO and ABI. Its first step is the <b>UV Absorbing Aerosol Index</b>, which can also be used on its own to highlight absorbing aerosols. The mask then reports the presence and relative optical thickness of smoke or dust. It is a Level 2 product distributed as granules, at 2.0 × 4.75 km at the center of TEMPO's view.</p>
    <h3>TEMPO and ABI together</h3>
    <div class="tablewrap"><table class="t">
      <thead><tr><th></th><th>TEMPO</th><th>ABI</th></tr></thead>
      <tbody>
        <tr><th>Strengths</th><td>Larger geographic extent; optically thin smoke that ABI misses; smoke north and west of ABI's viewing-angle cutoff; smoke on top of clouds; relative intensity (thin vs. thick)</td><td>More accurate for dust over ocean; frequent (10 min full disk and CONUS, 5 min mesoscale); finer pixels</td></tr>
        <tr><th>Limitations</th><td>Slightly coarser pixels; hourly; false smoke over bright surfaces; dust sometimes misclassified as smoke</td><td>Binary flag (presence only); retrievals at high viewing angles not recommended</td></tr>
      </tbody></table></div>
    <h3>Confidence flags</h3>
    <ul>
      <li>For <b>qualitative</b> use (looking at where smoke is): high, medium and low confidence.</li>
      <li>For <b>quantitative</b> use: high and medium confidence only.</li>
      <li>Not retrieved over snow, ice or clouds (except TEMPO's smoke-over-cloud call-back) or at night.</li>
    </ul>
    <h3>Things to know</h3>
    <ul>
      <li>Most accurate for <b>thick smoke or dust over dark surfaces</b> such as water and vegetation; less accurate over bright surfaces. TEMPO can show false smoke over very bright ground (the slides show White Sands National Monument).</li>
      <li><b>Gaps in thick plumes</b>: the upstream ABI cloud mask can misidentify thick smoke as cloud.</li>
      <li><b>False detections at large angles</b>: high viewing angles, or high solar zenith angles in the early morning and late afternoon. With the Sun ${sunUp()}° above the horizon (solar zenith ${f0(() => V.META.angles.sza)}°), this evening scan is exactly that situation.</li>
      <li>Thin dust over vegetation, and Saharan dust over ocean, may be classified as smoke by TEMPO. ABI's dust mask is usually accurate for dust over ocean.</li>
    </ul>
    <p>How often is the Sun low when TEMPO scans? It depends on the season:</p>
    ${sunChartHtml()}`,
  after: () => { initMaskSim(); initSunChart(); },
  slides: [["p1-34", "Aerosol detection product (smoke/dust mask)"], ["p1-35", "TEMPO ADP algorithm"], ["p1-36", "TEMPO and ABI synergy: smoke/dust mask"], ["p1-37", "Confidence flags: smoke/dust mask"], ["p1-38", "Things to know: using the mask"], ["p1-39", "More things to know: TEMPO's mask"]] },

{ id: "aod", part: 1, title: "Aerosol Optical Depth", stage: false, topFigure: () => aodLabHtml(),
  lede: "AOD measures how much the aerosol in the whole column dims sunlight. It is quantitative, but it says nothing about how high the aerosol is.",
  scene: { view: "overview", ...NEAR, ground: "aodgap" },
  start: "Gray pixels are cloudy enough that AOD would likely be missing this evening (an illustrative cutoff at cloud fraction 0.5). Green pixels are where it could be retrieved.",
  tries: [
    { label: "AOD 0.1", scene: { aerType: "smoke", aod: 0.1, alh: 1.0, thick: 1.0, ground: "aodgap" }, note: "Clean air. Straight down, about 90% of sunlight gets through; along this evening's low-sun path, only about half." },
    { label: "AOD 0.8", scene: { ...NEAR, ground: "aodgap" }, note: "Heavy smoke. Straight down, under half of direct sunlight gets through; along the low Sun's path, well under 1%." },
    { label: "AOD 1.6", scene: { aerType: "smoke", aod: 1.6, alh: 1.0, thick: 1.4, ground: "aodgap" }, note: "Very thick smoke. Plumes this dense are where AOD gaps appear, when the upstream cloud mask mistakes the smoke for cloud." },
    { label: "Same AOD, smoke aloft", scene: { ...ALOFT, aod: 0.8, ground: "aodgap", view: "side" }, note: "Same AOD as heavy smoke near the ground. AOD alone can't tell these apart." },
  ],
  body: () => `
    <p><b>Aerosol optical depth (AOD)</b> is a quantitative measure of aerosol loading: how much light is removed (absorbed or scattered) by particles in the whole vertical column. It has no units. In North America values are typically 0 to 1, with larger values meaning more aerosol. TEMPO reports it at 550 nm.</p>
    <p>A beam of light passing straight down through a layer of AOD τ keeps a fraction e<sup>−τ</sup> of its intensity. Light arriving at a slant crosses more of the layer, so the same smoke dims it more: in the evening TEMPO scan used elsewhere on this site, the Sun was ${sunUp()}° up and its light crossed about ${pathX()}× more of the atmosphere than it would from overhead. Try that angle in the figure above.</p>
    <p>AOD also depends on wavelength. TEMPO reports it at 550 nm; to compare with an instrument that reports other wavelengths, convert first:</p>
    ${aodSpectrumHtml()}
    <h3>TEMPO's AOD and layer height algorithm</h3>
    <p>AOD and aerosol layer height come from one combined TEMPO algorithm (<code>TEMPO_AODALH_L2</code>), a Level 2 product distributed as granules at 2.0 × 4.75 km at the center of TEMPO's view. It uses TEMPO's smoke/dust mask to choose the aerosol type, which improves accuracy and coverage, especially for dust. ABI offers more frequent AOD (every 10 minutes for full disk and CONUS), a composite average that smooths gaps, and finer pixels; but ABI's dust AOD can be underestimated or missed over land, and it has no mesoscale AOD.</p>
    <h3>Quality flags</h3>
    <ul>
      <li><b>TEMPO:</b> use high quality only, for all applications.</li>
      <li><b>ABI:</b> high and medium ("top 2") for qualitative use; high only for quantitative use.</li>
      <li>AOD is not retrieved over clouds, snow and ice, ephemeral (land) or shallow (ocean) water, or sun glint, or at night.</li>
    </ul>
    <h3>Things to know</h3>
    <ul>
      <li><b>Gaps in thick plumes</b> in both TEMPO and ABI AOD, because the upstream ABI cloud mask misidentifies thick smoke as cloud.</li>
      <li><b>Cloud contamination</b> can make AOD anomalously high next to clouds, so treat values at cloud edges with caution.</li>
      <li><b>No height information.</b> AOD is a column total. For height, use TEMPO's new aerosol layer height product.</li>
      <li>Blocks of missing ABI AOD can occur at random.</li>
    </ul>
    <p class="pointer">Comparing AOD with Pandora or ground monitors? See Part 2, <a href="#sec-columns">Columns vs. What You Breathe</a> and <a href="#sec-matching">Matching Instruments in Space and Time</a>.</p>`,
  after: () => { initAodLab(); initAodSpectrum(); },
  slides: [["p1-40", "Aerosol optical depth"], ["p1-41", "TEMPO AOD and layer height algorithm"], ["p1-42", "TEMPO and ABI synergy: AOD"], ["p1-43", "Quality flags: AOD"], ["p1-44", "Things to know: using AOD"]] },

{ id: "alh", part: 1, title: "Aerosol Layer Height: the Third Dimension", readout: true,
  lede: "New with TEMPO: an hourly estimate of how high the main aerosol layer sits. It separates a smoky sky from smoky air at the ground.",
  scene: { view: "side", ...NEAR },
  start: `Side view. The green sheet is the top of the boundary layer, about ${pblKm()} km up this evening. Air below it is stirred down to the ground.`,
  tries: [
    { label: "Smoke near the surface", scene: { ...NEAR, view: "side" }, note: "The whole layer is inside the boundary layer: high particle concentrations reach the ground, and air quality is poor." },
    { label: "Smoke aloft", scene: { ...ALOFT, view: "side" }, note: "Thick in the column but above the boundary layer: low surface PM2.5 for now. It can mix down later as the boundary layer deepens." },
    { label: "Straddling the top", scene: { aerType: "smoke", aod: 0.8, alh: 1.8, thick: 1.6, view: "side" }, note: "Part of the layer is inside the boundary layer and mixes down; part stays aloft." },
    { label: "Too thin to place", scene: { aerType: "smoke", aod: 0.15, alh: 2.5, thick: 1.5, view: "side" }, note: "AOD below 0.2: TEMPO doesn't retrieve a layer height, so this layer's altitude would be unknown." },
  ],
  body: () => `
    <p>The training calls this TEMPO's biggest addition: <b>aerosol layer height (ALH)</b> enhances AOD with a 3D view of smoke. Two layers with the same AOD can mean very different air at the surface:</p>
    <div class="tri"><div><b>Smoke near the surface</b>High particle concentrations, high PM2.5, poor air quality.</div><div><b>Smoke aloft</b>Low PM2.5 at the surface; the smoke isn't affecting surface air quality, yet.</div><div><b>What decides it</b>Whether the layer sits inside the boundary layer, which mixes air down to the ground.</div></div>
    <h3>How it's defined</h3>
    <ul>
      <li>The estimated altitude of the aerosol layer with the most extinction, in the troposphere.</li>
      <li><b>Height above the surface</b>, not above sea level.</li>
      <li>Derived from the ratio of TEMPO's convolved 670 nm and 688 nm bands.</li>
      <li>Only retrieved where <b>AOD ≥ 0.2</b>.</li>
      <li>Level 2, in the same granules and files as AOD (<code>TEMPO_AODALH_L2</code>).</li>
    </ul>
    ${alhProfileHtml()}
    <h3>Reading it with the boundary layer</h3>
    <p>The boundary layer here is the green sheet, about ${pblKm()} km deep in this scan (from the weather model the TEMPO retrieval uses, not measured by TEMPO). Layer height tells you where smoke is; the boundary layer tells you whether that height reaches people. The training's case studies turn on exactly this: in July 2026 Ontario wildfire smoke stayed near the ground close to the fires but traveled aloft downwind, and in a May 2026 Northern Plains dust storm the leading edge was lofted by afternoon.</p>
    <p>ALH also improves the surface PM2.5 estimate, which uses it to work out how much of the AOD is in the boundary layer (next section).</p>`,
  after: () => initAlhProfile(),
  slides: [["p1-45", "Height of aerosols from TEMPO", "Smoke near the surface vs. smoke aloft"], ["p1-41", "TEMPO AOD and layer height algorithm"]] },

{ id: "pm25", part: 1, title: "Estimated Surface PM2.5", stage: false, topFigure: () => gwrHtml(),
  lede: "The Level 4 product turns satellite AOD into hourly surface PM2.5 by learning, every hour, from ground monitors.",
  scene: { view: "overview", ...NEAR },
  start: "Watch the 'PM2.5 product' line in the panel as you try the scenarios below.",
  tries: [
    { label: "Smoke near the surface", scene: { ...NEAR }, note: "TEMPO's and ABI's PM2.5 estimates are averaged: the aerosol is low and identified as smoke." },
    { label: "Smoke above 3 km", scene: { ...ALOFT, view: "side" }, note: "Layer height above 3 km: TEMPO's PM2.5 is not averaged with ABI's, because TEMPO's estimate, which knows the height, is more accurate here." },
    { label: "Dust", scene: { ...DUST }, note: "Identified as dust: TEMPO's PM2.5 is not averaged with ABI's, since TEMPO's dust AOD is more accurate." },
  ],
  body: () => `
    <p>Surface PM2.5 is the mass of fine particles per cubic meter of air at the ground, the quantity air-quality standards regulate. The satellite product estimates it from AOD with a <b>geographically weighted regression (GWR)</b> against the AirNow monitor network. At each grid cell, every hour, it fits PM2.5 = A + B × AOD + C × ALH to the monitors, weighting each one by exp(−distance / 50 km), so nearby monitors count most. The figure above runs that same regression on an imaginary region.</p>
    <div class="chain"><span class="box">ABI AOD</span><span class="arr">→ GWR with AOD →</span><span class="box">ABI estimate</span></div>
    <div class="chain"><span class="box">TEMPO AOD + ALH</span><span class="arr">→ GWR with boundary-layer AOD →</span><span class="box">TEMPO estimate</span></div>
    <div class="chain"><span class="arr">both, with AirNow PM2.5 →</span><span class="box">merged: final estimated PM2.5</span></div>
    <ul>
      <li>Surface PM2.5 in µg/m³, a 1-hour average by clock hour (for example 13:00–13:59).</li>
      <li>Level 4, on the ABI fixed grid, 2.0 km at nadir. Domain: the continental US, southern Canada, northern Mexico and the Caribbean.</li>
      <li>File prefix <code>TEMPO-ABI_PM25_L4</code>.</li>
    </ul>
    <h3>What each satellite adds</h3>
    <p>TEMPO's layer height lets the algorithm estimate how much of the AOD is in the boundary layer, which raises accuracy, especially when the aerosol is above 3 km. TEMPO's dust AOD is also more accurate and covers more area. ABI brings 12 observations for each TEMPO one, so more chances to see between clouds, and keeps estimates coming when TEMPO granules are missing. But ABI has no height information, and its dust AOD can be underestimated or missed.</p>
    <p><b>TEMPO's PM2.5 is not averaged with ABI's when</b> the aerosol is aloft (layer height above 3 km) or is identified as dust.</p>
    <h3>Things to know</h3>
    <ul>
      <li>It fills gaps in the AirNow regulatory monitor network.</li>
      <li><b>No quality or confidence flags.</b></li>
      <li>Cloud contamination of TEMPO and ABI AOD adds noise, worse for TEMPO's estimate and especially along cloud edges. With ${cloudyPct()}% of pixels mostly cloudy, this evening over Austin would be a noisy hour.</li>
    </ul>
    <p class="pointer">Working with ground monitors yourself? See Part 2, <a href="#sec-columns">Columns vs. What You Breathe</a>.</p>`,
  after: () => initGwr(),
  slides: [["p1-46", "Estimated surface PM2.5 algorithm"], ["p1-47", "TEMPO and ABI synergy: PM2.5"], ["p1-48", "Things to know: estimated PM2.5"]] },

{ id: "summary1", part: 1, title: "Part 1 in Summary", readout: true,
  lede: "ABI is fast, frequent and proven. TEMPO is hourly and new, but adds aerosol height, thin smoke, and smoke over clouds. Use both.",
  scene: { view: "overview", ...NEAR },
  start: "One scene, three views of the same aerosol: column (AOD), height (ALH), and surface (PM2.5).",
  tries: [
    { label: "Smoke near the surface", scene: { ...NEAR } },
    { label: "Smoke aloft", scene: { ...ALOFT, view: "side" } },
    { label: "Dust", scene: { ...DUST } },
  ],
  body: () => `
    <div class="tablewrap"><table class="t">
      <thead><tr><th></th><th>ABI aerosol products</th><th>TEMPO aerosol products</th></tr></thead>
      <tbody>
        <tr><th>How often</th><td>Every 5–10 minutes</td><td>About every hour</td></tr>
        <tr><th>Latency</th><td>About 10 minutes after observation</td><td>About 2 hours once operational (~spring 2027)</td></tr>
        <tr><th>Pixels</th><td>Slightly finer; less pixelated imagery</td><td>Slightly coarser; more pixelated imagery</td></tr>
        <tr><th>Mission</th><td>Operational, 24/7 support: data are almost always there</td><td>Research: periodic interruptions; data are sometimes missing</td></tr>
        <tr><th>Aerosol height</th><td>None</td><td>New aerosol layer height product</td></tr>
        <tr><th>Maturity</th><td>Proven performance (provisional to full validation)</td><td>New; performance still being evaluated</td></tr>
      </tbody></table></div>
    <h3>Key points</h3>
    <ul>
      <li>TEMPO's UV and visible hyperspectral observations enhance NOAA's geostationary aerosol products. <b>New:</b> UV Aerosol Index and aerosol layer height. <b>Improved:</b> smoke/dust mask, AOD and 1-hour surface PM2.5.</li>
      <li>ABI monitors rapid transport; TEMPO reveals chemical composition. ABI's products are frequent and near-real-time but lack vertical structure; TEMPO's deliver vertical structure and near-surface air-quality information.</li>
      <li><b>Use all available TEMPO and ABI imagery</b> to get a full picture of a smoke or dust event.</li>
    </ul>`,
  slides: [["p1-49", "Things to remember: ABI vs. TEMPO"], ["p1-50", "Summary: TEMPO enhances ABI products"], ["p1-53", "Part 1 summary"]] },

/* ------------------------------------------------------------------ PART 2 */
{ id: "columns", part: 2, title: "Columns vs. What You Breathe", stage: false, topFigure: () => columnLabHtml(),
  lede: "TEMPO and Pandora measure columns: everything above a patch of ground. Ground monitors measure the air at the surface. Comparing them means knowing how the two are connected.",
  scene: { view: "overview", ...NEAR }, start: "", tries: [],
  body: () => `
    <p>Most comparisons you'll make mix two kinds of numbers:</p>
    <div class="tablewrap"><table class="t">
      <thead><tr><th>Instrument</th><th>What it reports</th><th>Units</th></tr></thead>
      <tbody>
        <tr><th>TEMPO</th><td>Column over each pixel (tropospheric and stratospheric NO₂ separately; total column in support data)</td><td>molecules/cm²</td></tr>
        <tr><th>Pandora</th><td>Column over the site (total from direct sun; tropospheric from sky scans); some products also estimate surface concentration</td><td>moles/m² (× 6.022 × 10¹⁹ = molecules/cm²)</td></tr>
        <tr><th>Ground monitor (EPA, TCEQ)</th><td>Concentration in the air at the inlet</td><td>ppb (gases), µg/m³ (PM2.5)</td></tr>
        <tr><th>TEMPO / ABI aerosol</th><td>AOD: the aerosol column, as light lost</td><td>unitless</td></tr>
      </tbody></table></div>
    <p>A column and a surface concentration rise and fall together only if the shape of the profile stays the same. The biggest thing that changes the shape is the <b>boundary layer</b>, the mixed layer of air near the ground: shallow and concentrated in the early morning, deep and diluted in the afternoon. The same column can therefore mean very different surface air (try the buttons above), and the same surface reading can come with very different columns.</p>
    <h3>Practical consequences</h3>
    <ul>
      <li><b>Compare like with like.</b> Satellite columns go with Pandora columns. To compare either with a ground monitor, expect the relationship to change with time of day and season, and look at the boundary-layer height (TEMPO's NO₂ and HCHO files include one, from a weather model).</li>
      <li><b>Mind the stratosphere.</b> Pandora's direct-sun total column includes stratospheric NO₂ (about ${q(() => V.sci(V.M.no2Strat))} molecules/cm² over Austin in the scan used here); TEMPO's tropospheric column has it removed.</li>
      <li><b>Aerosols work the same way.</b> AOD is a column; PM2.5 is a surface concentration. The PM2.5 product in Part 1 exists precisely to bridge them, using layer height to judge how much of the column is near the ground.</li>
    </ul>`,
  after: () => initColumnLab(),
  slides: [] },

{ id: "matching", part: 2, title: "Matching Instruments in Space and Time", stage: false, topFigure: () => matchMapHtml(),
  lede: "Before comparing a ground instrument with a satellite, decide which pixels and which minutes of data belong together. Those choices can change the answer.",
  scene: { view: "overview", ...NEAR }, start: "", tries: [],
  body: () => `
    <h3>In space: which pixels?</h3>
    <p>A Pandora looks along a thin line; a TEMPO pixel averages over about 10 km². They see the same air only roughly, and the mismatch grows when the Sun is low, because the Pandora's sightline then runs a long way sideways through the polluted layer (the map above). Common choices:</p>
    <ul>
      <li>The single pixel containing the site: simplest, fine near midday.</li>
      <li>The pixels within a few kilometers: smooths noise, but averages over more varied air.</li>
      <li>Pixels along the line toward the Sun: better matched to direct-sun measurements at low sun.</li>
    </ul>
    <h3>In time: which minutes?</h3>
    ${matchTimeHtml()}
    <ul>
      <li><b>Use the pixel's own time.</b> Each TEMPO pixel has an exact observation time (<code>geolocation/time</code>); the scan reaches Austin a few minutes past the hour, not on it.</li>
      <li><b>Filter both sides first.</b> Apply TEMPO's quality and cloud filters and Pandora's quality flags before matching (Part 2, “Inside a TEMPO File”).</li>
      <li><b>Keep the number of readings.</b> Report how many Pandora readings went into each average; a match built on one or two readings deserves less trust.</li>
    </ul>`,
  after: () => { initMatchMap(); initMatchTime(); },
  slides: [] },

{ id: "day", part: 2, title: "A Day of Measurements", stage: false, topFigure: () => dayLabHtml(),
  lede: "Pollution changes hour by hour. Each instrument samples that day differently, and the data files keep time in UTC, not Austin time.",
  scene: { view: "overview", ...NEAR }, start: "", tries: [],
  body: () => `
    <p>For studies of high-pollution days, the sampling pattern matters as much as the instrument:</p>
    <ul>
      <li><b>Pandora</b> measures every few minutes in direct-sun mode and roughly every 20–30 minutes in sky-scan mode, but only when the Sun is up and not hidden by cloud.</li>
      <li><b>TEMPO</b> gives one value per hourly scan in daylight; early-morning and late-evening scans come with a low Sun.</li>
      <li><b>Polar orbiters</b> such as TROPOMI, VIIRS or MODIS give one look a day, around the same local time, so they show a snapshot, not the daily cycle.</li>
      <li><b>Ground monitors</b> run around the clock, usually reported as hourly averages, but at a single point at the surface.</li>
    </ul>
    <h3>The UTC trap</h3>
    <p>TEMPO's file names, Pandora's <code>utc_time</code> column and most data portals use UTC. Austin is 5 hours behind UTC in summer (CDT) and 6 in winter (CST). So an evening scan at 7:15 pm on August 27 in Austin is <code>20260828T001329Z</code>, in the next day's files. The scan used throughout this site is exactly that case. When you gather “one day” of data, decide whether you mean a UTC day or a local day, and convert before grouping (the <code>local_time</code> column that pandora-tools adds helps).</p>`,
  after: () => initDayLab(),
  slides: [] },

{ id: "files", part: 2, title: "Inside a TEMPO File, and Quality Flags", stage: false, topFigure: () => fileAnatomyHtml(),
  lede: "What's in the files you'll download, and the filtering that should come before any average or comparison.",
  scene: { view: "overview", ...NEAR }, start: "", tries: [],
  body: () => `
    <p>Every TEMPO Level 2 file has the same layout: the answers in <code>product/</code>, where and when in <code>geolocation/</code>, and the context needed to judge each answer in <code>support_data/</code>. The aerosol products use the same idea, with their flags in a <code>quality_diagnostic_flags/</code> group.</p>
    <h3>Filter before you average</h3>
    ${qaLabHtml()}
    <ul>
      <li><b>Quality flag first.</b> For TEMPO trace gases, <code>main_data_quality_flag</code> = 0 (normal) is the usual choice. For aerosols, follow each product's guidance (Part 1: high quality for TEMPO AOD; high and medium confidence for quantitative use of the smoke/dust mask).</li>
      <li><b>Then clouds.</b> Many studies also drop pixels above a cloud fraction of about 0.2–0.3, because cloudy pixels rely more on assumptions.</li>
      <li><b>Report what you kept.</b> As above, filters can remove most pixels; an average of a few clear pixels can differ a lot from the unfiltered map.</li>
      <li><b>Pandora has flags too.</b> Its L2 files mark each reading assured or not-assured, high, medium or low quality; the high-quality classes (0 and 10) are a common choice.</li>
    </ul>`,
  after: () => initQaLab(),
  slides: [] },

/* ------------------------------------------------------------------ PART 3 */
{ id: "python", part: 3, title: "Hands-On in Python", stage: false,
  lede: "One worked example, start to finish: download Pandora and TEMPO data, filter them, match them, and look at TEMPO's aerosol products and the smoke/dust mask.",
  scene: { view: "overview", ...NEAR }, start: "", tries: [],
  body: () => pythonBody(),
  after: () => initCodeCopy(),
  slides: [] },

/* ------------------------------------------------------------------ APPENDIX */
{ id: "terms", part: 0, title: "Terms, Data and Credits", stage: false,
  lede: "Short definitions of the terms used across the site, where to get the data, and where everything on this site comes from.",
  scene: { view: "overview", ...NEAR },
  start: "",
  tries: [],
  body: () => `<div class="glossary">${q(() => V.GLOSSARY.map(([h, b]) => `<details><summary>${h}</summary><p>${b}</p></details>`).join(""), "")}</div>
    <h3>Getting the data</h3>
    <ul>
      <li><b>ABI</b> files are distributed through NOAA's Open Data Dissemination (NODD) program on Amazon Web Services and Google Cloud Storage, for GOES-19 and GOES-18.</li>
      <li><b>TEMPO</b> aerosol algorithms are being moved to operations; products are expected by spring 2027. NOAA will generate the operational files and NASA Earthdata will distribute them, with about 2 hours of latency. User's guides are available for each aerosol product.</li>
      <li>NASA tools for TEMPO data: the Earthdata TEMPO page, Earthdata Search, Worldview, Harmony, Earthdata GIS, OPeNDAP, Google Earth Engine, Jupyter notebooks, and the Earthdata Forum (tag posts "ASDC" or "TEMPO"). TEMPO data are archived at NASA's <a href="https://asdc.larc.nasa.gov/" target="_blank" rel="noopener">Atmospheric Science Data Center</a>.</li>
    </ul>
    <h3>About this site</h3>
    <p>The training slides are by Caterina Mogno (University of Maryland, Baltimore County and NASA Goddard) and Amy Huff (STC at NOAA/NESDIS) for NASA's Applied Remote Sensing Training program (ARSET), October 13 and 15, 2026. The 3D scene uses a real TEMPO Level 2 scan (NO₂, formaldehyde and ozone profile products) over Austin; its aerosol layer is illustrative. Building footprints, the river and the St. Edward's campus come from OpenStreetMap.</p>`,
  slides: [] },
];

/* =====================================================================
   PAGE ENGINE
   ===================================================================== */
const $ = id => document.getElementById(id);
const PARTS = { b: ["Background", "Fundamentals of satellite remote sensing"], 1: ["Part 1", "TEMPO's aerosol products"], 2: ["Part 2", "Working with the measurements"], 3: ["Part 3", "Hands-on in Python"], 0: ["Reference", ""] };
const deckOf = f => { const [d, n] = f.split("-"); return `${{ p1: "Aerosols 2026, Part 1", p2: "Aerosols 2026, Part 2", f: "Remote sensing fundamentals, 2023" }[d]}, slide ${+n}`; };
const numbered = SECTIONS.filter(s => s.part);
const numOf = s => numbered.indexOf(s) + 1;
let visited = new Set();
try { visited = new Set(JSON.parse(localStorage.getItem("tempo-aerosols-visited") || "[]")); } catch (e) { /* storage unavailable */ }
const saveVisited = () => { try { localStorage.setItem("tempo-aerosols-visited", JSON.stringify([...visited])); } catch (e) { /* ignore */ } };

function renderNav(cur) {
  const groups = ["b", 1, 2, 3, 0].map(p => {
    const items = SECTIONS.filter(s => s.part === p).map(s => {
      const n = s.part ? numOf(s) : "§";
      return `<a class="sec-link${visited.has(s.id) ? " done" : ""}" href="#sec-${s.id}"${s === cur ? ' aria-current="page"' : ""}><span class="num">${n}</span><span>${s.title}</span></a>`;
    }).join("");
    const [a, b] = PARTS[p];
    return `<div class="navgroup"><div class="navgroup-label">${a}${b ? `<span>${b}</span>` : ""}</div>${items}</div>`;
  });
  $("nav").innerHTML = groups.join("");
}

let current = null, slideList = [], slideIdx = 0;
// i = -1 is the section's own starting scene; a button whose scene is identical to it is shown as pressed
function setTry(sec, i) {
  const merged = t => JSON.stringify(Object.assign({}, BASE, sec.scene, t ? t.scene : {}));
  const startKey = merged(null);
  document.querySelectorAll("#trybar .chip").forEach((b, k) => b.setAttribute("aria-pressed", String(i === -1 ? merged(sec.tries[k]) === startKey : k === i)));
  const t = i === -1 ? null : sec.tries[i];
  $("trynote").textContent = t ? (t.note || "") : (sec.start || "");
  if (V) V.applyScene(JSON.parse(t ? merged(t) : startKey));
}

function show(sec, opts = {}) {
  current = sec;
  visited.add(sec.id); saveVisited();
  renderNav(sec);
  $("eyebrow").textContent = sec.part ? `${PARTS[sec.part][0]} · Section ${numOf(sec)} of ${numbered.length}` : "Reference";
  $("title").textContent = sec.title;
  $("lede").textContent = sec.lede;
  const stageOn = sec.stage !== false;
  ["viewport", "trybar", "trynote", "controls"].forEach(id => { $(id).style.display = stageOn ? "" : "none"; });
  $("topfig").innerHTML = sec.topFigure ? sec.topFigure() : "";
  document.title = `${sec.title} · TEMPO Aerosols in 3D`;
  // try chips
  const chips = sec.tries.length ? [`<span class="lab">Try:</span>`, ...sec.tries.map(t => `<button type="button" class="chip" aria-pressed="false">${t.label}</button>`)] : [];
  $("trybar").innerHTML = chips.join("");
  document.querySelectorAll("#trybar .chip").forEach((b, k) => b.addEventListener("click", () => setTry(sec, k)));
  // body
  $("prose").innerHTML = sec.body();
  $("content").classList.toggle("with-readout", !!sec.readout);
  $("asidecol").hidden = !sec.readout;
  // slides
  slideList = sec.slides;
  $("slides").innerHTML = sec.slides.length ? `<div class="slides-head"><h3>From the training slides</h3><p>NASA ARSET · select a slide to enlarge</p></div>
    <div class="slide-grid">${sec.slides.map(([f, t, n], i) => {
      const where = deckOf(f);
      return `<figure><button type="button" data-i="${i}" aria-label="Enlarge: ${t}"><img src="slides/${f}.jpg" alt="Training slide: ${t}" loading="lazy" width="1280" height="720"></button><figcaption><b>${t}</b>${n ? ` · ${n}` : ""}<span>${where}</span></figcaption></figure>`;
    }).join("")}</div>` : "";
  document.querySelectorAll("#slides .slide-grid button").forEach(b => b.addEventListener("click", () => openSlide(+b.dataset.i)));
  // prev / next
  const i = SECTIONS.indexOf(sec), prev = SECTIONS[i - 1], next = SECTIONS[i + 1];
  $("nextbar").innerHTML = (prev ? `<a class="prev" href="#sec-${prev.id}"><small>← Previous</small>${prev.title}</a>` : "") + (next ? `<a class="next" href="#sec-${next.id}"><small>Next →</small>${next.title}</a>` : "");
  if (sec.after) sec.after();
  setTry(sec, -1);
  if (!opts.initial) {
    $("sidebar").classList.remove("open"); $("navtoggle").setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    $("title").focus({ preventScroll: true });
  }
}

function fromHash() { const id = location.hash.replace(/^#(sec-)?/, ""); return SECTIONS.find(s => s.id === id) || SECTIONS[0]; }
window.addEventListener("hashchange", () => { const s = fromHash(); if (s !== current) show(s); });
$("navtoggle").addEventListener("click", () => { const o = $("sidebar").classList.toggle("open"); $("navtoggle").setAttribute("aria-expanded", String(o)); });

// lightbox
const lb = $("lightbox");
function openSlide(i) {
  slideIdx = (i + slideList.length) % slideList.length;
  const [f, t, n] = slideList[slideIdx];
  $("lb-img").src = `slides/${f}.jpg`; $("lb-img").alt = `Training slide: ${t}`;
  $("lb-cap").textContent = `${t}${n ? " · " + n : ""} (${deckOf(f)})`;
  $("lb-prev").hidden = $("lb-next").hidden = slideList.length < 2;
  if (!lb.open) { if (lb.showModal) lb.showModal(); else lb.setAttribute("open", ""); }
}
$("lb-prev").addEventListener("click", () => openSlide(slideIdx - 1));
$("lb-next").addEventListener("click", () => openSlide(slideIdx + 1));
$("lb-close").addEventListener("click", () => lb.close());
lb.addEventListener("click", e => { if (e.target === lb) lb.close(); });
lb.addEventListener("keydown", e => { if (e.key === "ArrowLeft") openSlide(slideIdx - 1); if (e.key === "ArrowRight") openSlide(slideIdx + 1); });

// scene caption
if (V) {
  const t0 = new Date(V.META.austin_start_utc);
  $("when").textContent = "Real TEMPO scan, " + t0.toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " CDT · aerosol layer illustrative";
}

show(fromHash(), { initial: true });
if (V) V.startGlide();
})();
