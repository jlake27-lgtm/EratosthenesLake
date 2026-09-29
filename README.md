# EratosthenesLake

Eratosthenes Method of Earth Circumference Calculator and Data Visualization

Pick any two cities that lie roughly north–south of each other. The site finds the Sun's altitude at local
solar noon in each city on the same day, measures the distance between them, and uses Eratosthenes' proportion
to calculate the circumference of the Earth — the same steps as the Stellarium classroom exercise, done
automatically and shown as a worksheet.

## Features

- **City search** over ~34,600 places from Stellarium's own location database, so any pair you choose can be
  cross-checked in Stellarium.
- **Partner suggestions**: after choosing City A, see cities within ±0.5–3° of longitude, filtered by
  population and time zone.
- **Sun at the meridian** for each city: local solar-noon time, altitude (DMS and decimal), and azimuth, with an
  atmosphere (refraction) toggle matching Stellarium's `A` key.
- **Step-by-step worksheet**: DMS → decimal degrees, the arc angle, and the 360° proportion, with percent error
  against the equatorial (40,075 km) and pole-to-pole (40,008 km) circumference.
- **Warnings** for pairs that are too far off the meridian, too close together, in different time zones, on
  opposite sides of the Sun (handled with zenith angles), or in polar night.
- **Map** of the two cities and City A's meridian.
- **Accuracy charts**
  - *Your trials*: every press of Calculate is plotted (and listed in a table) for the current browser session.
  - *Reference: accuracy vs. longitude difference* and *accuracy vs. distance apart*: 250 real city pairs each,
    measured with both the north–south and straight-line distance.
- Shareable links (the URL stores the date and both cities), light and dark themes, works on phones.

**Live site:** https://jlake27-lgtm.github.io/EratosthenesLake/

## Running it

Requires [Node.js](https://nodejs.org) 22.12 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

Open the site through the dev server (or any web server). Opening `index.html` directly as a file will not
work, because browsers block module scripts from `file://` pages.

Other commands:

```bash
npm test           # math tests (vitest)
npm run build      # static site in dist/ — upload anywhere (GitHub Pages, Netlify, ...)
npm run preview    # serve the built site locally
npm run cities     # rebuild public/data/cities.json from data-src/
```

## Deploying

Every push to `main` runs `.github/workflows/deploy.yml`, which installs dependencies, runs the tests, builds
the site, and publishes `dist/` to GitHub Pages. If the tests fail, nothing is deployed. The workflow can also be
run by hand from the repository's **Actions** tab (*Deploy to GitHub Pages* → *Run workflow*).

One-time setup (already done for this repository): **Settings → Pages → Build and deployment → Source:
GitHub Actions**.

## How the calculation works

1. **Solar noon.** For each city, [Astronomy Engine](https://github.com/cosinekitty/astronomy) finds the moment
   the Sun crosses the local meridian (hour angle 0) on the chosen local date, and returns its altitude and
   azimuth — optionally with atmospheric refraction.
2. **Arc angle.** Each altitude is turned into a *signed zenith angle* (90° − altitude, positive when the Sun is
   due south, negative when due north). The arc of the Earth between the cities is the difference of the two
   zenith angles. When the Sun is on the same side for both cities this equals the difference of altitudes;
   when it isn't (e.g. cities in different hemispheres) it correctly becomes their sum.
3. **Distance.** [GeographicLib](https://geographiclib.sourceforge.io/) computes distances on the WGS84 ellipsoid:
   - *North–south* (default): the distance along a meridian between the two latitudes. This is what the Sun
     angle actually measures.
   - *Straight line*: the shortest surface distance, like measuring in Google Maps. Any east–west offset makes
     it longer than the north–south separation and inflates the result.
4. **Proportion.** 360° / angle = C / distance, so C = 360 × distance / angle.

Why does even the north–south method usually land a few tenths of a percent below 40,075 km? The Earth is slightly flattened: its
circumference through the poles is 40,008 km, and a degree of latitude is a little longer near the poles than
near the equator.

## Project layout

```
index.html              page markup
src/main.js             UI wiring, worksheet rendering
src/calc.js             DMS conversion, zenith angles, proportion
src/sun.js              Sun position at meridian transit
src/geo.js              ellipsoid distances
src/experiment.js       one full measurement + reference city-pair sample
src/cities.js           city list loading, search, partner suggestions
src/chart.js            dependency-free SVG scatter chart
src/charts-view.js      the three accuracy charts
src/trials.js           session trial storage
src/map.js              Leaflet map
scripts/build-cities.mjs  converts Stellarium's location file to JSON
data-src/               original Stellarium data files
public/data/cities.json generated city list served to the browser
test/                   vitest tests
```

## Credits and data

- City list: Stellarium's `base_locations.txt` and `regions-geoscheme.tab`
  ([Stellarium](https://github.com/Stellarium/stellarium), GPL-2.0-or-later), whose city data comes from
  [GeoNames](https://www.geonames.org/) (CC-BY 4.0).
- Sun positions: [Astronomy Engine](https://github.com/cosinekitty/astronomy) (MIT).
- Distances: [GeographicLib](https://geographiclib.sourceforge.io/) (MIT).
- Map: [Leaflet](https://leafletjs.com/) (BSD-2-Clause) with © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors tiles.
- Fonts: IBM Plex Sans and IBM Plex Mono (SIL Open Font License) via Google Fonts.

The code in this repository is MIT licensed (see `LICENSE`). The files in `data-src/` and the derived
`public/data/cities.json` remain under their original licenses listed above.
