// Pure math for the Eratosthenes worksheet (handout steps 9–11).

export const EARTH_EQUATORIAL_KM = 40075.017;
export const EARTH_MERIDIONAL_KM = 40007.863;

/** Split decimal degrees into degrees/minutes/seconds (step 9, in reverse). */
export function toDMS(decimal, secondsDigits = 1) {
  const sign = decimal < 0 ? -1 : 1;
  const scale = 10 ** secondsDigits;
  // Round once in whole "ticks" of the smallest displayed unit to avoid 59.99…→60 carries.
  let ticks = Math.round(Math.abs(decimal) * 3600 * scale);
  const s = (ticks % (60 * scale)) / scale;
  ticks = Math.floor(ticks / (60 * scale));
  const m = ticks % 60;
  const d = Math.floor(ticks / 60);
  return { sign, d, m, s };
}

/** Step 9: degrees + minutes/60 + seconds/3600. */
export function dmsToDecimal(d, m, s, sign = 1) {
  return sign * (Math.abs(d) + m / 60 + s / 3600);
}

/** Stellarium-style DMS string, e.g. +71°04'12.3" */
export function formatDMS(decimal, secondsDigits = 1) {
  const { sign, d, m, s } = toDMS(decimal, secondsDigits);
  const sec = s.toFixed(secondsDigits).padStart(secondsDigits ? 3 + secondsDigits : 2, '0');
  return `${sign < 0 ? '-' : '+'}${d}°${String(m).padStart(2, '0')}'${sec}"`;
}

/**
 * Zenith angle of the Sun at noon, signed by which way you face to see it:
 * positive when the Sun is to the south, negative when it is to the north.
 * Using signed zenith angles makes the arc correct even when the Sun is on
 * opposite sides for the two cities (e.g. cities in different hemispheres).
 */
export function signedZenith(altitude, azimuth) {
  const facingSouth = Math.cos((azimuth * Math.PI) / 180) < 0;
  return (facingSouth ? 1 : -1) * (90 - altitude);
}

/** Step 10: angle of the arc of the Earth between the two cities. */
export function arcAngle(sunA, sunB) {
  const zA = signedZenith(sunA.altitude, sunA.azimuth);
  const zB = signedZenith(sunB.altitude, sunB.azimuth);
  return {
    zA,
    zB,
    sameSide: Math.sign(zA) === Math.sign(zB) || zA === 0 || zB === 0,
    angle: Math.abs(zA - zB),
  };
}

/** Step 11: 360° / angle = C / distance  →  C = 360 × distance / angle. */
export function circumference(distanceKm, angleDeg) {
  if (!(angleDeg > 0)) return NaN;
  return (360 * distanceKm) / angleDeg;
}

export function percentError(measured, actual) {
  return ((measured - actual) / actual) * 100;
}
