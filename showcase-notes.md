# Showcase notes

Research notes for `showcase.html`. Every fact used on the page is listed here with its source.
Generated 2026-09-30.

## What the project is

- Name: **EratosthenesLake** (repo / README title, `README.md:1`); site title "Eratosthenes Simulator" (`index.html:7`, `index.html:15`).
- One-line description: "Eratosthenes Method of Earth Circumference Calculator and Data Visualization" (`README.md:3`).
- What it does: pick two cities roughly north–south of each other; the site finds the Sun's altitude at local solar noon in each on the same day, measures the distance, and uses Eratosthenes' proportion to compute Earth's circumference, "the same steps as the Stellarium classroom exercise, done automatically and shown as a worksheet" (`README.md:5-8`).
- The worksheet numbers steps 9, 10, 11 of a handout (`src/calc.js:1`, `src/main.js:206` `<ol start="9">`); steps 2–8 are the Stellarium part (`src/sun.js:1`). The handout itself is **not** in the repo.
- Live site: https://jlake27-lgtm.github.io/EratosthenesLake/ (`README.md:29`).
- Repo: https://github.com/jlake27-lgtm/EratosthenesLake (`git remote -v`, `package.json:10`).
- License: MIT, © 2026 jlake27-lgtm (`LICENSE`). Data files keep their licenses (`README.md:111-112`).

## Features (`README.md:10-27`)

- City search over ~34,600 places from Stellarium's location database.
- Partner suggestions within ±0.5–3° of longitude, filtered by population and time zone (`index.html:60-77`, `src/cities.js:51-64`, defaults maxDLon 1°, min pop 50k, same TZ, minDLat 3°).
- Sun at meridian: solar-noon time, altitude (DMS + decimal), azimuth; atmosphere/refraction toggle matching Stellarium's `A` key (`index.html:28-31`).
- Worksheet: DMS→decimal, arc angle, 360° proportion, % error vs 40,075 km equatorial and 40,008 km pole-to-pole (`src/main.js:206-222`).
- Warnings: Δlon > 3° (warn) / > 1° (note), straight-line > 0.5% longer than N–S, Δlat < 2°, different UTC offsets, polar night, Sun on opposite sides (`src/main.js:152-165`).
- Leaflet map with City A's meridian (`src/map.js`).
- Three accuracy charts: session trials + two reference charts of 250 real pairs each (`src/charts-view.js`, `src/experiment.js:33-53`).
- Shareable URL hash with date + both cities (`src/main.js:239-242`), light/dark themes (`src/style.css:24`).

## Core method (input → output)

`src/main.js:149` → `measure()` in `src/experiment.js:8-21`:

1. **Solar noon** — `sunAtTransit()` (`src/sun.js:13-33`): Astronomy Engine `SearchHourAngle(Sun, observer, 0, start, +1)` starting from *local mean midnight* = UTC midnight − lon/15 h (`sun.js:19-21`), then `Equator(...)` and `Horizon(..., refraction ? 'normal' : undefined)`. Default refraction on (`sun.js:13`, `main.js:9`).
2. **Signed zenith** — `signedZenith(alt, az) = (cos az < 0 ? +1 : −1) × (90 − alt)` (`src/calc.js:37-40`). Positive = Sun due south.
3. **Arc angle** — `angle = |zA − zB|`, `sameSide` flag (`src/calc.js:43-52`).
4. **Distance** — GeographicLib WGS84 `Inverse`: straight = (latA,lonA)→(latB,lonB); north–south = (latA,0)→(latB,0) (`src/geo.js:22-31`). Default mode `'ns'` (`main.js:9`).
5. **Proportion** — `C = 360 × distance / angle`, NaN if angle ≤ 0 (`src/calc.js:55-58`).
6. **Error** — `(C − actual)/actual × 100`, actual = `EARTH_EQUATORIAL_KM = 40075.017` (`calc.js:3`, `experiment.js:20`); worksheet also shows vs `EARTH_MERIDIONAL_KM = 40007.863` (`calc.js:4`, `main.js:182-183`).
- Why results land a few tenths of a percent under 40,075: Earth is flattened; pole-to-pole 40,008 km (`README.md:77-79`).

## Reference values (computed with the real `src/experiment.js` `measure()` via Node, 2026-09-30)

Script: scratchpad `ref.mjs` importing `src/experiment.js`.

| Case | Inputs | altA / altB | angle | N–S km | straight km | C (km) | err vs 40,075 |
|---|---|---|---|---|---|---|---|
| 1 Boston → Maracaibo (test `math.test.js:76-81`) | 42.35843,−71.05977 / 10.6423,−71.6109, 2026-09-29, refraction on, N–S | 45.0553 / 76.7591 | 31.7038° | 3514.551 | 3514.961 | 39,908.09 | −0.417% |
| 2 same, straight line | … straight | | 31.7038° | | 3514.961 | 39,912.75 | −0.405% |
| 3 Test `math.test.js:54` | 30,−80 / 45,−80, 2026-03-20, no refraction, N–S | 60.0433 / 45.0428 | 15.0005° | 1664.831 | 1664.831 | 39,954.59 | −0.300% |
| 4 Test `math.test.js:59` (cross-hemisphere) | −20,20 / 40,20, 2026-09-29, no refraction | 72.5025 (az 0°, Sun north) / 47.4952 | 60.0024° (sameSide false) | 6641.895 | 6641.895 | 39,849.80 | −0.562% |
| 5 Boston → Miami (`math.test.js:64-65`) | 42.36,−71.06 / 25.77,−80.19, 2026-06-21, refraction on, straight | 71.0826 / 87.6681 | 16.5855° | 1840.271 | 2021.052 | 43,868.38 | +9.466% |

Boston solar noon 2026-09-29 = 16:34:29 UTC.

### Demo verification

The page's demo loads the **same library versions** as `package-lock.json` / `node_modules` (astronomy-engine 2.1.19, geographiclib-geodesic 2.2.0) from jsDelivr and uses a line-for-line port of `sunAtTransit`, `cityDistances`, `signedZenith`, `arcAngle`, `circumference`, `percentError`. Checked in headless WebKit (Playwright) — see "Verification" below.

## Numbers (reproducible)

- Cities: **34,632** rows in `public/data/cities.json` (`node -e` count); 24 regions; 6,285 with pop ≥ 100k (the reference-chart pool, `experiment.js:34`). README says "~34,600".
- Tests: **11** passing (`npx vitest run`, `test/math.test.js`).
- Commits: **3** (`git log`).
- JS modules in `src/`: **10** files, **1,057** lines (`wc -l src/*.js`).
- Runtime dependencies: **3** (astronomy-engine, geographiclib-geodesic, leaflet — `package.json:19-23`); dev: vite, vitest.
- Reference charts: 250 pairs each, seed 42 LCG (`experiment.js:24-26,33,35`).
- Constants: 40,075.017 km, 40,007.863 km (`calc.js:3-4`).

## Tech stack

- JavaScript (ES modules, `"type": "module"`, `package.json:7`), HTML, CSS.
- Vite 8 — dev server/build, `base: './'` for sub-path hosting (`vite.config.js`).
- Vitest 5 — tests.
- Astronomy Engine — Sun transit/altitude/azimuth (`sun.js`).
- GeographicLib — WGS84 geodesics (`geo.js`).
- Leaflet + OpenStreetMap tiles — map (`map.js`).
- Hand-written SVG scatter chart, no chart library (`src/chart.js`, README "dependency-free SVG scatter chart").
- Node ≥ 22.12 (`package.json:28-30`); `scripts/build-cities.mjs` converts Stellarium data.
- GitHub Actions → GitHub Pages; tests gate deployment (`.github/workflows/deploy.yml`, `README.md:54-56`). Workflow uses Node 24.
- IBM Plex Sans / Mono via Google Fonts (`index.html:10`).
- Data: Stellarium `base_locations.txt` + `regions-geoscheme.tab` (GPL-2.0+), from GeoNames (CC-BY 4.0) (`data-src/README.md`).

## Timeline (`git log --stat`)

- 2026-09-29 13:20 −0400 `b4aa728` Initial commit — LICENSE + README stub (23 lines).
- 2026-09-29 13:23 `3f68f8b` Add Eratosthenes circumference simulator — 23 files, 37,836 insertions (most are the 34,751-line Stellarium data file).
- 2026-09-29 14:37 `61e3502` Deploy to GitHub Pages with Actions — workflow + README section.
- Note: the whole app arrived in one commit, so the history can't show intermediate development steps.

## Limitations / gaps (from code, no TODOs exist — `grep TODO` empty)

- Opening `index.html` as a file doesn't work; needs a server (`README.md:40-41`, `main.js:282`).
- "Same time zone" compares UTC offsets *right now*, not on the chosen date (`cities.js:66-69`, `utcOffsetLabel` uses `new Date()`).
- Proportion assumes a sphere; north–south method lands a few tenths of a percent under 40,075 km because of flattening (`README.md:77-79`).
- Tests cover the math pipeline only; no UI tests (`test/` has one file).
- Map needs network access to OSM tiles (`map.js:6`).
- Search returns at most 12 matches (`cities.js:31`); suggestions at most 25 (`cities.js:51`).
- Git history is three commits on one day.

## Design choice

Theme: **"noon sun over the night sky"** — Eratosthenes' method is about the Sun's noon shadow, so light mode is a warm sun-bleached parchment with ink text, and dark mode is a deep night-sky blue with a faint star texture. One accent: a sun-gold/ochre (darker ochre in light mode for AA contrast, brighter gold in dark). This echoes the project's own ochre City A color (`style.css:12`). Display font Fraunces (classical, slightly antique serif, fitting a 2,200-year-old method); body IBM Plex Sans and code IBM Plex Mono, the same families the app itself uses (`index.html:10`).

## Open questions

- The classroom handout (steps 1–11) referenced in comments isn't in the repo, so the page can't show steps 1–8 beyond "done in Stellarium".
- No screenshots of the app are in the repo; the page uses its own diagram and demo instead.
- The live site URL comes from the README; I did not verify it is currently up.
- No roadmap or TODOs exist, so "What's next" is limited to gaps observed in the code.

## Verification (2026-09-30, Playwright 1.63 + headless Chromium, `file://` URL)

- Demo vs real code (C from `#demo-C[data-c]` vs Node `measure()` above), all 4 presets, identical to 0.01 km:
  case 1 39,908.09 · case 3 39,954.59 · case 4 39,849.80 · case 5 43,868.38. Page also shows −0.25% vs 40,008 km for case 1, matching the hero pill.
- Checked at 375×812 and 1440×900, light and dark: no console/page errors, `scrollWidth == clientWidth` (no horizontal page scroll), KaTeX rendered 3 formulas, highlight.js active.
- Fixed during checks: footer grid overflow at 375px (added `min-width: 0` to grid children); hero title broke mid-word (added `<wbr>`); diagram labels overlapped (moved distance label outside the arc, added text halo); the zenith and proportion formulas overflowed on phones (simplified/stacked them).
- Only the demo's Sun table scrolls horizontally, inside its own container, on phones (intentional).
- Offline fallback: if the jsDelivr libraries don't load, the demo shows the verified case-1 worked example, and the diagram draws from built-in case-1 values.
- Claims audit: every number on the page appears in the tables/lists above; code excerpts are copied verbatim from `src/calc.js:37-52`, `src/sun.js:16-25`, `src/geo.js:22-31`.
