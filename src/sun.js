// Sun position at local meridian transit (what the handout does by hand in Stellarium, steps 2–8).

import * as Astronomy from 'astronomy-engine';

/**
 * Find the moment the Sun crosses the local meridian on a given calendar date
 * and return its altitude/azimuth at that instant.
 *
 * @param {{lat:number, lon:number, elevation?:number}} place
 * @param {string} isoDate  "YYYY-MM-DD" — the local date at that place
 * @param {{refraction?: boolean}} opts  refraction=true matches Stellarium with the atmosphere on
 */
export function sunAtTransit(place, isoDate, { refraction = true } = {}) {
  const observer = new Astronomy.Observer(place.lat, place.lon, place.elevation ?? 0);

  // Start the search at local *mean* midnight (UTC midnight shifted by longitude).
  // Solar noon is always within ~20 min of 12h later, so this finds the transit
  // on the right local day without needing time-zone rules.
  const [y, m, d] = isoDate.split('-').map(Number);
  const localMidnightUtc = Date.UTC(y, m - 1, d) - (place.lon / 15) * 3600_000;
  const start = Astronomy.MakeTime(new Date(localMidnightUtc));

  const event = Astronomy.SearchHourAngle(Astronomy.Body.Sun, observer, 0, start, +1);
  const eq = Astronomy.Equator(Astronomy.Body.Sun, event.time, observer, true, true);
  const hor = Astronomy.Horizon(event.time, observer, eq.ra, eq.dec, refraction ? 'normal' : undefined);

  return {
    time: event.time.date, // JS Date (UTC instant)
    altitude: hor.altitude,
    azimuth: hor.azimuth,
    declination: eq.dec,
  };
}
