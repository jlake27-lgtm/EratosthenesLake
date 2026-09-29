// Converts Stellarium's base_locations.txt into a compact JSON file for the site.
// Source: https://github.com/Stellarium/stellarium/blob/master/data/base_locations.txt
// (city data originally from GeoNames, CC-BY 4.0)
//
// Output rows: [name, province, regionIndex, lat, lon, timeZone, populationThousands, typeCode]

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = new URL('../data-src/base_locations.txt', import.meta.url);
const REGIONS = new URL('../data-src/regions-geoscheme.tab', import.meta.url);
const OUT = new URL('../public/data/cities.json', import.meta.url);

// Only real places on Earth (drop landers, spacecraft impact sites, etc.).
const KEEP_TYPES = new Set(['C', 'B', 'R', 'N', 'O', 'H']);

function parseCoord(text) {
  const m = /^([\d.]+)([NSEW])$/.exec(text.trim());
  if (!m) return NaN;
  const v = parseFloat(m[1]);
  return m[2] === 'S' || m[2] === 'W' ? -v : v;
}

const regionNames = {};
for (const line of readFileSync(REGIONS, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [code, planet, name] = line.split('\t');
  if (planet === 'Earth') regionNames[code] = name;
}

const regionList = [];
const regionIndex = {};
const rows = [];

for (const line of readFileSync(SRC, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const f = line.split('\t');
  const [name, province, region, type, pop, latS, lonS, , , tz = '', planet = ''] = f;
  if (planet && planet !== 'Earth') continue;
  if (!KEEP_TYPES.has(type)) continue;
  const lat = parseCoord(latS);
  const lon = parseCoord(lonS);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

  const regionName = regionNames[region] ?? '';
  if (!(regionName in regionIndex)) {
    regionIndex[regionName] = regionList.length;
    regionList.push(regionName);
  }
  rows.push([
    name,
    province,
    regionIndex[regionName],
    +lat.toFixed(5),
    +lon.toFixed(5),
    tz,
    pop ? +parseFloat(pop).toFixed(1) : 0,
    type,
  ]);
}

// Biggest places first so search results and suggestions favor well-known cities.
rows.sort((a, b) => b[6] - a[6]);

writeFileSync(OUT, JSON.stringify({ regions: regionList, cities: rows }));
console.log(`Wrote ${rows.length} locations, ${regionList.length} regions -> public/data/cities.json`);
