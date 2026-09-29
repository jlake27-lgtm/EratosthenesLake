// Distances between cities on the WGS84 ellipsoid (replaces measuring in Google Maps).

import geodesic from 'geographiclib-geodesic';

const WGS84 = geodesic.Geodesic.WGS84;

/** Wrap a longitude difference into [-180, 180]. */
export function lonDiff(lonA, lonB) {
  let d = lonB - lonA;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/**
 * @returns {{
 *   straightKm: number,   // shortest surface distance (what Google Maps "measure distance" gives)
 *   northSouthKm: number, // distance along a meridian between the two latitudes — what the Sun angle actually measures
 *   dLat: number, dLon: number
 * }}
 */
export function cityDistances(a, b) {
  const straight = WGS84.Inverse(a.lat, a.lon, b.lat, b.lon);
  const meridian = WGS84.Inverse(a.lat, 0, b.lat, 0);
  return {
    straightKm: straight.s12 / 1000,
    northSouthKm: meridian.s12 / 1000,
    dLat: b.lat - a.lat,
    dLon: lonDiff(a.lon, b.lon),
  };
}
