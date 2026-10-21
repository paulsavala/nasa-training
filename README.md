# Seeing Smoke and Dust from Geostationary Orbit

A companion website for NASA ARSET's training on TEMPO aerosol products, written for students starting research with TEMPO, Pandora and ground-monitor data. It has four parts:

- **Background:** fundamentals of satellite remote sensing (aerosols, what satellites measure, passive and active sensors, orbits and resolution).
- **Part 1:** TEMPO's aerosol products, following NASA ARSET's 2026 training, with the training's slides.
- **Part 2:** working with the measurements: columns vs. surface concentrations, matching instruments in space and time, a day of measurements, file contents and quality flags.
- **Part 3:** a hands-on Python walkthrough (also as a Colab notebook in `notebooks/`).
- **For kids:** *Air Detectives*, a separate illustrated picture book for curious young readers, at `kids/` (linked from the sidebar).

Most sections are built around an interactive 3D scene made from one real TEMPO scan over Austin, Texas (August 27, 2026, 7:15 pm CDT), or around 2D interactive figures.

Plain HTML, CSS and JavaScript. There is no build step, so GitHub Pages can serve the repository as is.

## Publish on GitHub Pages

The site is published from this repository's `main` branch, root folder (**Settings → Pages → Deploy from a branch**), at <https://paulsavala.github.io/nasa-training/>. Pushing to `main` updates it within a minute or two.

`.nojekyll` tells GitHub Pages to serve the files exactly as they are.

## Preview locally

Open `index.html` in a browser. Or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

An internet connection is needed for three.js (loaded from jsDelivr) and the Google fonts.

## Layout

| Path | What it is |
|---|---|
| `index.html` | Page skeleton: sidebar, 3D stage, scene controls, content area, slide lightbox. |
| `assets/css/site.css` | All styles. Colors are CSS variables at the top, with a dark-mode set. |
| `assets/js/sections.js` | **The content.** Every section's text, scene setup, "Try" buttons and slides, plus all the 2D and globe figures (light paths, spectrum, retrieval, orbits, viewing-angle map, mask builder, AOD lab, PM2.5 regression, Part 2 figures) and the Part 3 code cells. |
| `assets/js/viewer.js` | The three.js scene: TEMPO pixels, boundary layer, aerosol layer, city, ozone, aircraft, lidar, pixel grids. Exposes `window.VIZ` for `sections.js`. |
| `data/tempo-data.js` | The TEMPO extract and Austin geometry, as `window.TEMPO_DATA`. |
| `data/land-110m.js` | World land outline for the orbit globe (Natural Earth 1:110m). |
| `data/na-map.js` | Detailed North America map for the viewing-angle explorer (Natural Earth 1:10m land, lakes, borders). |
| `slides/` | Slide images: `p1-NN.jpg` (ARSET aerosols 2026, Part 1) and `f-NN.jpg` (remote sensing fundamentals, 2023). `NN` is the slide number. |
| `kids/index.html` | *Air Detectives*, the kids' picture book. One self-contained page with no external data. |
| `notebooks/hands_on.ipynb` | The Part 3 walkthrough as a notebook (opens in Google Colab from the site). Keep its cells in sync with `PY` in `sections.js`. |
| `tools/` | Scripts that rebuild `data/tempo-data.js` from the original files. |

## Editing content

Everything a reader sees in a section lives in the `SECTIONS` array in `assets/js/sections.js`. Each entry looks like this:

```js
{ id: "alh",                 // used in the URL: index.html#sec-alh
  part: 1,                   // sidebar group: "b" (Background), 1, 2, 3, or 0 (Reference)
  title: "...", lede: "...",
  readout: true,             // show the "What the aerosol products would show" panel
  stage: false,              // optional: hide the 3D scene for this section...
  topFigure: () => `...`,    // ...and show this figure in its place
  after: () => initSomething(),  // optional: set up the section's interactive figures
  scene: { view: "side", ...NEAR },   // how the 3D scene starts
  start: "...",              // note shown under the scene at the start
  tries: [ { label: "Smoke aloft", scene: { ...ALOFT }, note: "..." } ],
  body: () => `<p>...</p>`,  // HTML for the explanation
  slides: [["p1-45", "Slide title", "optional note"]] }
```

- Sections appear in the order of the array; the numbers in the sidebar update automatically.
- Scene keys (see `BASE` in `sections.js`): `ground` (`cloud`, `aodgap`, `no2_trop`, `hcho`, `no2_strat`, `pbl`, `off`), `bars`, `aer`, `aerType` (`smoke`/`dust`), `aod`, `alh` and `thick` (km), `pbl`, `rays`, `vex` (height stretch), `radius` (km), `tgrid`, `abi`, `plane`, `lidar`, `fp` (`none`, `omi`, `modis`, `viirs`), `ozone`, `view` (`overview`, `side`, `top`, `city`, `east`, `plane`).
- To add a slide, put a 1280 × 720 JPEG in `slides/` and list it in the section's `slides`. For a new deck, add its prefix to `deckOf` in `sections.js`.

## Rebuilding the data

Only needed with a different TEMPO scan or a different city extract. From `tools/`:

```bash
pip install netCDF4 numpy
python3 prepare_data.py HCHO.nc NO2.nc O3PROF.nc tempo_austin.json   # TEMPO L2 V04 granules
python3 make_city.py                                                  # austin_osm.txt -> city.json
python3 build_data.py                                                 # -> ../data/tempo-data.js
```

The scene uses TEMPO L2 V04 granules `TEMPO_HCHO_L2`, `TEMPO_NO2_L2` and `TEMPO_O3PROF_L2` for scan S016G03 (2026-08-28 00:13 UTC). The `.nc` files are not stored in this repository.

## What is real and what is illustrative

- **Real:** TEMPO pixels, cloud fraction, NO₂, HCHO, ozone profile, boundary-layer height, sun and viewing angles, building and river geometry, and the Pandora site location.
- **Illustrative, and labeled as such on the page:** the aerosol layer, the research aircraft and lidar curtain, the pixel grids of other sensors, the simplified spectrum and retrieval models (the page explains what they simplify), and the orbit globe's timing (to scale in size, simplified in time), the mask builder and PM2.5 regression scenes (the regression itself follows the product documentation), and the illustrative curves in Part 2. The quality-flag figure in Part 2 uses the real scan. The TEMPO files used are trace-gas products and contain no aerosol data.

## Credits

- Training content and slides: NASA Applied Remote Sensing Training Program (ARSET).
  - *Geostationary Remote Sensing of Aerosols for Air Quality Applications in North America*, Parts 1 and 2, by C. Mogno and A. Huff (2026).
  - *Fundamentals of Satellite Remote Sensing*, by P. Gupta, M. Follette-Cook, S. Strode and C. Malings (2023).
  - Images on the slides are credited on each slide to their sources.
- TEMPO data: NASA.
- Pandora site location: Pandonia Global Network.
- Map data: © OpenStreetMap contributors, available under the Open Database License (ODbL).
- World land outline and North America map: Natural Earth (public domain), via the `world-atlas`, `us-atlas` and `@geo-maps` packages.
- Product details for Part 3: TEMPO AOD/ALH, TEMPO-ABI ADP and ABI ADP users' guides (NOAA STAR).
- 3D rendering: [three.js](https://threejs.org) r147 (MIT license).
