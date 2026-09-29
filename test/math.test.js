import { describe, it, expect } from 'vitest';
import { toDMS, dmsToDecimal, formatDMS, arcAngle, circumference, EARTH_MERIDIONAL_KM } from '../src/calc.js';
import { sunAtTransit } from '../src/sun.js';
import { cityDistances } from '../src/geo.js';

describe('DMS conversion (step 9)', () => {
  it('round-trips', () => {
    const { sign, d, m, s } = toDMS(71.0701, 2);
    expect(dmsToDecimal(d, m, s, sign)).toBeCloseTo(71.0701, 5);
  });
  it('carries seconds that round up to 60', () => {
    expect(formatDMS(10.99999999)).toBe(`+11°00'00.0"`);
  });
  it('handles negatives', () => {
    expect(formatDMS(-5.5)).toBe(`-5°30'00.0"`);
  });
});

describe('sun at meridian transit', () => {
  const boston = { lat: 42.35843, lon: -71.05977 };

  it('Boston, June solstice 2026 — matches NOAA solar noon ≈ 16:4x UTC, alt ≈ 71.1°', () => {
    const sun = sunAtTransit(boston, '2026-06-21', { refraction: false });
    expect(sun.time.toISOString().slice(0, 10)).toBe('2026-06-21');
    expect(sun.time.getUTCHours()).toBe(16);
    expect(sun.azimuth).toBeCloseTo(180, 1);
    expect(sun.altitude).toBeCloseTo(90 - (boston.lat - 23.435), 1);
  });

  it('refraction lifts the Sun slightly', () => {
    const noAir = sunAtTransit(boston, '2026-12-21', { refraction: false });
    const air = sunAtTransit(boston, '2026-12-21', { refraction: true });
    expect(air.altitude - noAir.altitude).toBeGreaterThan(0.01);
    expect(air.altitude - noAir.altitude).toBeLessThan(0.1);
  });

  it('finds the correct local day near the date line (Auckland)', () => {
    const sun = sunAtTransit({ lat: -36.85, lon: 174.76 }, '2026-01-01');
    const localDate = sun.time.toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
    expect(localDate).toBe('2026-01-01');
    expect(Math.cos((sun.azimuth * Math.PI) / 180)).toBeGreaterThan(0.99); // Sun due north
  });
});

describe('full Eratosthenes pipeline', () => {
  function run(a, b, date) {
    const sa = sunAtTransit(a, date, { refraction: false });
    const sb = sunAtTransit(b, date, { refraction: false });
    const { angle } = arcAngle(sa, sb);
    return circumference(cityDistances(a, b).northSouthKm, angle);
  }

  it('same-hemisphere pair on one meridian gives ≈ 40,008 km', () => {
    const c = run({ lat: 30, lon: -80 }, { lat: 45, lon: -80 }, '2026-03-20');
    expect(Math.abs(c - EARTH_MERIDIONAL_KM) / EARTH_MERIDIONAL_KM).toBeLessThan(0.01);
  });

  it('cross-hemisphere pair (Sun north for one, south for other) still works', () => {
    const c = run({ lat: -20, lon: 20 }, { lat: 40, lon: 20 }, '2026-09-29');
    expect(Math.abs(c - EARTH_MERIDIONAL_KM) / EARTH_MERIDIONAL_KM).toBeLessThan(0.01);
  });

  it('using straight-line distance for an offset pair overestimates', () => {
    const a = { lat: 42.36, lon: -71.06 }; // Boston
    const b = { lat: 25.77, lon: -80.19 }; // Miami
    const d = cityDistances(a, b);
    expect(d.straightKm).toBeGreaterThan(d.northSouthKm * 1.05);
  });
});

describe('measure() and reference sample', async () => {
  const { measure, buildReference } = await import('../src/experiment.js');
  const boston = { lat: 42.35843, lon: -71.05977 };
  const maracaibo = { lat: 10.6423, lon: -71.6109 };

  it('reproduces the Boston → Maracaibo worksheet result', () => {
    const m = measure(boston, maracaibo, { date: '2026-09-29', refraction: true, distMode: 'ns' });
    expect(m.arc.angle).toBeCloseTo(31.7038, 3);
    expect(m.C).toBeGreaterThan(39850);
    expect(m.C).toBeLessThan(39950);
  });

  it('builds a deterministic reference sample', () => {
    const cities = [];
    for (let i = 0; i < 400; i++) cities.push({ lat: -60 + (i * 37) % 120, lon: -30 + (i * 13) % 12, pop: 200 });
    const r1 = buildReference(cities, { date: '2026-03-20', refraction: false }, 20);
    const r2 = buildReference(cities, { date: '2026-03-20', refraction: false }, 20);
    expect(r1.byLon.length).toBe(20);
    expect(r1.byLon.map((r) => r.st.C)).toEqual(r2.byLon.map((r) => r.st.C));
    // straight-line distance is never shorter, so it never gives a smaller circumference
    for (const r of r1.byLon) expect(r.st.C).toBeGreaterThanOrEqual(r.ns.C - 1e-6);
  });
});
