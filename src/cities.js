// Loads the Stellarium city list and provides search + partner suggestions.

import { lonDiff } from './geo.js';

let cities = [];

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function loadCities() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/cities.json`);
  const { regions, cities: rows } = await res.json();
  cities = rows.map(([name, province, region, lat, lon, tz, pop, type], id) => ({
    id,
    name,
    province,
    region: regions[region],
    lat,
    lon,
    tz,
    pop, // thousands
    type,
    key: normalize(name),
  }));
  return cities;
}

export const getCity = (id) => cities[id];
export const allCities = () => cities;

/** Name search: prefix matches first, then substring matches; biggest cities first within each. */
export function searchCities(query, limit = 12) {
  const q = normalize(query.trim());
  if (!q) return [];
  const prefix = [];
  const contains = [];
  for (const c of cities) {
    if (c.key.startsWith(q)) {
      prefix.push(c);
      if (prefix.length >= limit) break;
    } else if (contains.length < limit && c.key.includes(q)) {
      contains.push(c);
    }
  }
  return prefix.concat(contains).slice(0, limit);
}

/**
 * Cities roughly north–south of `origin`.
 * @param {{maxDLon:number, minPopK:number, sameTz:boolean, minDLat:number}} opts
 */
export function suggestPartners(origin, { maxDLon = 1, minPopK = 50, sameTz = true, minDLat = 3 } = {}, limit = 25) {
  const out = [];
  for (const c of cities) {
    if (c.id === origin.id || c.pop < minPopK) continue;
    const dLon = lonDiff(origin.lon, c.lon);
    if (Math.abs(dLon) > maxDLon) continue;
    const dLat = c.lat - origin.lat;
    if (Math.abs(dLat) < minDLat) continue;
    if (sameTz && origin.tz && c.tz && !sameZone(origin, c)) continue;
    out.push({ city: c, dLat, dLon });
    if (out.length >= limit) break;
  }
  return out;
}

/** Same UTC offset right now counts as "same time zone" (America/Detroit ≈ America/New_York). */
function sameZone(a, b) {
  return a.tz === b.tz || utcOffsetLabel(a.tz) === utcOffsetLabel(b.tz);
}

const offsetCache = new Map();
export function utcOffsetLabel(tz) {
  if (!tz) return '';
  if (!offsetCache.has(tz)) {
    let label = '';
    try {
      label = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName').value;
    } catch {
      label = '';
    }
    offsetCache.set(tz, label);
  }
  return offsetCache.get(tz);
}

export function cityLabel(c) {
  return [c.name, c.province && c.province !== c.name ? c.province : null].filter(Boolean).join(', ');
}

export function formatPop(k) {
  if (!k) return '';
  if (k >= 1000) return `${(k / 1000).toFixed(1)}M`;
  if (k >= 1) return `${Math.round(k)}k`;
  return `${Math.round(k * 1000)}`;
}
