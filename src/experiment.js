// One full Eratosthenes measurement between two places, plus the reference sample of real city pairs.

import { sunAtTransit } from './sun.js';
import { cityDistances, lonDiff } from './geo.js';
import { arcAngle, circumference, percentError, EARTH_EQUATORIAL_KM } from './calc.js';

/** Run the whole method for one pair. `sunCache` lets the reference sample reuse per-city sun positions. */
export function measure(a, b, { date, refraction, distMode }, sunCache) {
  const sun = (c) => {
    if (!sunCache) return sunAtTransit(c, date, { refraction });
    if (!sunCache.has(c)) sunCache.set(c, sunAtTransit(c, date, { refraction }));
    return sunCache.get(c);
  };
  const sunA = sun(a);
  const sunB = sun(b);
  const dist = cityDistances(a, b);
  const arc = arcAngle(sunA, sunB);
  const distanceKm = distMode === 'ns' ? dist.northSouthKm : dist.straightKm;
  const C = circumference(distanceKm, arc.angle);
  return { sunA, sunB, dist, arc, distanceKm, C, error: percentError(C, EARTH_EQUATORIAL_KM) };
}

// Deterministic so the reference charts look the same on every visit.
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/**
 * Sample real city pairs (≥100k people) from the database and measure each with both distance methods.
 *   byLon:  Δlon 0–8°, ≥5° latitude apart  → how accuracy falls off as the pair leaves the meridian
 *   byDist: Δlon ≤1°, any spacing         → how accuracy depends on how far apart the cities are
 */
export function buildReference(cities, { date, refraction }, n = 250) {
  const pool = cities.filter((c) => c.pop >= 100);
  const rand = rng(42);
  const sunCache = new Map();

  function sample(maxDLon, minDLat) {
    const rows = [];
    for (let tries = 0; rows.length < n && tries < 200_000; tries++) {
      const a = pool[Math.floor(rand() * pool.length)];
      const b = pool[Math.floor(rand() * pool.length)];
      const dLon = Math.abs(lonDiff(a.lon, b.lon));
      if (a === b || dLon > maxDLon || Math.abs(a.lat - b.lat) < minDLat) continue;
      const ns = measure(a, b, { date, refraction, distMode: 'ns' }, sunCache);
      const st = measure(a, b, { date, refraction, distMode: 'straight' }, sunCache);
      rows.push({ a, b, dLon, ns, st });
    }
    return rows;
  }

  return { byLon: sample(8, 5), byDist: sample(1, 0.3) };
}
