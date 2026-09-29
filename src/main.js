import './style.css';
import { loadCities, getCity, searchCities, suggestPartners, cityLabel, formatPop, utcOffsetLabel } from './cities.js';
import { formatDMS, toDMS, percentError, EARTH_EQUATORIAL_KM, EARTH_MERIDIONAL_KM } from './calc.js';
import { measure } from './experiment.js';
import { addTrial } from './trials.js';
import { createMap } from './map.js';
import { setupCharts, renderTrialsChart, scheduleReference } from './charts-view.js';

const state = { a: null, b: null, date: todayISO(), refraction: true, distMode: 'ns' };

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const fmt = (n, digits = 0) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLocalTime(date, tz) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'UTC', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    }).format(date);
  } catch {
    return `${date.toISOString().slice(11, 19)} UTC`;
  }
}

const latLabel = (lat) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
const lonLabel = (lon) => `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;

// ---------- city pickers ----------

function setupPicker(slot) {
  const card = $(`.city[data-slot="${slot}"]`);
  const input = $('input[type="search"]', card);
  const list = $('.results', card);
  let items = [];
  let active = -1;

  const close = () => { list.hidden = true; active = -1; };
  const choose = (city) => {
    state[slot] = city;
    input.value = '';
    close();
    update();
  };
  const renderList = () => {
    if (!citiesReady) {
      list.innerHTML = `<li class="status">${citiesError ? esc(citiesError) : 'Loading city list…'}</li>`;
      list.hidden = !input.value.trim();
      return;
    }
    list.innerHTML = items
      .map((c, i) => `<li role="option" data-i="${i}" class="${i === active ? 'active' : ''}">
          <strong>${esc(cityLabel(c))}</strong>
          <span>${esc(c.region)}${c.pop ? ` · ${formatPop(c.pop)}` : ''}</span>
        </li>`)
      .join('');
    if (!items.length && input.value.trim()) list.innerHTML = '<li class="status">No matching cities.</li>';
    list.hidden = !input.value.trim();
  };

  const runSearch = () => {
    items = citiesReady ? searchCities(input.value) : [];
    active = items.length ? 0 : -1;
    renderList();
  };
  input.addEventListener('input', runSearch);
  input.addEventListener('focus', runSearch);
  pickers.push({ input, runSearch });
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, items.length - 1); renderList(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); renderList(); e.preventDefault(); }
    else if (e.key === 'Enter' && items[active]) { choose(items[active]); e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
  input.addEventListener('blur', close);
  list.addEventListener('mousedown', (e) => {
    e.preventDefault(); // keep focus in the input (also when grabbing the list's scrollbar)
    const li = e.target.closest('li[data-i]');
    if (li) choose(items[+li.dataset.i]);
  });
}

function renderCityInfo(slot) {
  const c = state[slot];
  const el = $(`.city[data-slot="${slot}"] .city-info`);
  if (!c) {
    el.innerHTML = '<p class="muted">No city selected.</p>';
    return;
  }
  el.innerHTML = `
    <p class="city-name">${esc(cityLabel(c))}</p>
    <p class="muted">${esc(c.region)}${c.pop ? ` · pop. ${formatPop(c.pop)}` : ''}</p>
    <dl class="kv">
      <dt>Latitude</dt><dd>${latLabel(c.lat)}</dd>
      <dt>Longitude</dt><dd>${lonLabel(c.lon)}</dd>
      <dt>Time zone</dt><dd>${esc(c.tz || 'auto')} ${c.tz ? `<span class="muted">(${esc(utcOffsetLabel(c.tz))})</span>` : ''}</dd>
    </dl>`;
}

// ---------- suggestions ----------

function renderSuggestions() {
  const list = $('.suggest-list');
  if (!state.a) {
    list.innerHTML = '<li class="muted">Pick City A first.</li>';
    return;
  }
  const partners = suggestPartners(state.a, {
    maxDLon: +$('#maxDLon').value,
    minPopK: +$('#minPop').value,
    sameTz: $('#sameTz').checked,
  });
  if (!partners.length) {
    list.innerHTML = '<li class="muted">No matches. Try widening the longitude range or lowering the population.</li>';
    return;
  }
  list.innerHTML = partners
    .map(({ city, dLat, dLon }) => `<li><button type="button" data-id="${city.id}">
        <span><strong>${esc(cityLabel(city))}</strong> <span class="muted">${esc(city.region)} · ${formatPop(city.pop)}</span></span>
        <span class="nums">Δlat ${dLat > 0 ? '+' : ''}${dLat.toFixed(1)}° · Δlon ${dLon > 0 ? '+' : ''}${dLon.toFixed(2)}°</span>
      </button></li>`)
    .join('');
}

// ---------- results worksheet ----------

function inputProblem() {
  if (!state.a || !state.b) return 'Choose two cities, then press Calculate.';
  if (state.a.id === state.b.id) return 'Pick two different cities.';
  return null;
}

function renderPrompt() {
  const problem = inputProblem();
  $('#calculate').disabled = !!problem;
  $('#results').innerHTML = `<p class="placeholder">${problem ?? 'Ready. Press <strong>Calculate</strong> to measure the Earth.'}</p>`;
}

function renderResults() {
  if (inputProblem()) return renderPrompt();
  const el = $('#results');
  const { a, b } = state;

  const m = measure(a, b, state);
  const { sunA, sunB, dist, arc, distanceKm, C } = m;

  const warnings = [];
  const absDLon = Math.abs(dist.dLon);
  if (absDLon > 3) warnings.push(['warn', `The cities are ${absDLon.toFixed(1)}° apart in longitude, which is not really north–south.`]);
  else if (absDLon > 1) warnings.push(['note', `The cities are ${absDLon.toFixed(1)}° apart in longitude. The closer to 0°, the better.`]);
  if (state.distMode === 'straight' && dist.straightKm > dist.northSouthKm * 1.005) {
    const extra = (dist.straightKm / dist.northSouthKm - 1) * 100;
    warnings.push(['warn', `The straight-line distance is ${extra.toFixed(1)}% longer than the north–south distance. The Sun angle only measures north–south separation, so this inflates the circumference by the same amount.`]);
  }
  if (Math.abs(dist.dLat) < 2) warnings.push(['warn', `Only ${Math.abs(dist.dLat).toFixed(2)}° of latitude apart. Small angles magnify any measurement error.`]);
  if (a.tz && b.tz && utcOffsetLabel(a.tz) !== utcOffsetLabel(b.tz)) warnings.push(['note', 'The cities are in different time zones. The handout asks for the same time zone.']);
  for (const [c, s] of [[a, sunA], [b, sunB]]) {
    if (s.altitude < 0) warnings.push(['warn', `At ${esc(c.name)} the Sun is below the horizon even at noon (polar night). You couldn't see it in Stellarium.`]);
  }
  if (!arc.sameSide) warnings.push(['note', 'The noon Sun is <strong>south</strong> of one city and <strong>north</strong> of the other (e.g. different hemispheres, or one city in the tropics). Subtracting the altitudes would be wrong here, so step 10 adds the zenith angles instead.']);

  const dirWord = (s) => (Math.cos((s.azimuth * Math.PI) / 180) < 0 ? 'south' : 'north');
  const step9 = (s) => {
    const { d, m, s: sec, sign } = toDMS(s.altitude, 1);
    return `${sign < 0 ? '−' : ''}${d} + ${m}/60 + ${sec.toFixed(1)}/3600 = <strong>${s.altitude.toFixed(4)}°</strong>`;
  };

  let step10;
  if (arc.sameSide) {
    const [hi, lo] = [sunA.altitude, sunB.altitude].sort((x, y) => y - x);
    step10 = `${hi.toFixed(4)}° − ${lo.toFixed(4)}° → angle = <strong>${arc.angle.toFixed(4)}°</strong>`;
  } else {
    step10 = `Zenith angles: (90° − ${sunA.altitude.toFixed(4)}°) + (90° − ${sunB.altitude.toFixed(4)}°)
      = ${Math.abs(arc.zA).toFixed(4)}° + ${Math.abs(arc.zB).toFixed(4)}° → angle = <strong>${arc.angle.toFixed(4)}°</strong>`;
  }

  const errEq = percentError(C, EARTH_EQUATORIAL_KM);
  const errMer = percentError(C, EARTH_MERIDIONAL_KM);
  const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '');

  el.innerHTML = `
    <h2>Measurement for ${esc(state.date)}</h2>
    ${warnings.length ? `<ul class="warnings">${warnings.map(([k, t]) => `<li class="${k}">${t}</li>`).join('')}</ul>` : ''}

    <div class="table-wrap">
      <table class="sun-table">
        <thead><tr><th></th><th>Solar noon (local)</th><th>Sun altitude (DMS)</th><th>Decimal</th><th>Azimuth</th><th>Sun is</th></tr></thead>
        <tbody>
          ${[[a, sunA, 'a'], [b, sunB, 'b']].map(([c, s, k]) => `<tr>
            <th scope="row"><span class="dot ${k}"></span> ${esc(c.name)}</th>
            <td>${formatLocalTime(s.time, c.tz)}</td>
            <td class="mono">${formatDMS(s.altitude)}</td>
            <td class="mono">${s.altitude.toFixed(4)}°</td>
            <td class="mono">${formatDMS(s.azimuth)}</td>
            <td>due ${dirWord(s)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <ol class="steps" start="9">
      <li><h3>Convert DMS to decimal degrees</h3>
        <p><span class="dot a"></span> ${step9(sunA)}</p>
        <p><span class="dot b"></span> ${step9(sunB)}</p></li>
      <li><h3>Angle of the arc of the Earth</h3><p>${step10}</p></li>
      <li><h3>Set up the proportion</h3>
        <p class="mono">360° / ${arc.angle.toFixed(4)}° = C / ${fmt(distanceKm, 1)} km</p>
        <p class="mono">C = 360 × ${fmt(distanceKm, 1)} / ${arc.angle.toFixed(4)}</p>
        <p class="answer">C ≈ <strong>${fmt(C)} km</strong></p></li>
    </ol>

    <div class="compare">
      <div><span class="muted">Distance used</span><strong>${fmt(distanceKm, 1)} km</strong><small>${state.distMode === 'ns' ? 'north–south component' : 'straight line'}</small></div>
      <div><span class="muted">Other distance</span><strong>${fmt(state.distMode === 'ns' ? dist.straightKm : dist.northSouthKm, 1)} km</strong><small>${state.distMode === 'ns' ? 'straight line' : 'north–south component'}</small></div>
      <div><span class="muted">vs. equator 40,075 km</span><strong>${sign(errEq)}${Math.abs(errEq).toFixed(2)}%</strong></div>
      <div><span class="muted">vs. pole-to-pole 40,008 km</span><strong>${sign(errMer)}${Math.abs(errMer).toFixed(2)}%</strong></div>
    </div>`;
  return m;
}

// ---------- wiring ----------

let map;
let citiesReady = false;
let citiesError = '';
const pickers = [];

function update() {
  renderCityInfo('a');
  renderCityInfo('b');
  renderSuggestions();
  renderPrompt();
  map?.show(state.a, state.b);
  const params = new URLSearchParams({ date: state.date });
  if (state.a) params.set('a', state.a.id);
  if (state.b) params.set('b', state.b.id);
  history.replaceState(null, '', `#${params}`);
}

async function init() {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (/^\d{4}-\d{2}-\d{2}$/.test(hash.get('date') ?? '')) state.date = hash.get('date');

  $('#date').value = state.date;
  $('#date').addEventListener('change', (e) => { if (e.target.value) { state.date = e.target.value; update(); scheduleReference(state); } });
  $('#refraction').addEventListener('change', (e) => { state.refraction = e.target.checked; update(); scheduleReference(state); });
  document.querySelectorAll('input[name="distMode"]').forEach((r) =>
    r.addEventListener('change', (e) => { state.distMode = e.target.value; update(); }));
  ['#maxDLon', '#minPop', '#sameTz'].forEach((s) => $(s).addEventListener('change', renderSuggestions));
  $('.suggest-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (btn) { state.b = getCity(+btn.dataset.id); update(); }
  });

  $('#calculate').addEventListener('click', () => {
    const m = renderResults();
    if (m) {
      const { a, b, date, refraction, distMode } = state;
      addTrial({
        a: { id: a.id, name: a.name }, b: { id: b.id, name: b.name }, date, refraction, distMode,
        dLon: Math.abs(m.dist.dLon), distanceKm: m.distanceKm, C: m.C, error: m.error,
      });
      renderTrialsChart();
    }
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  setupPicker('a');
  setupPicker('b');
  map = createMap($('#map'));
  setupCharts();

  $('#results').innerHTML = '<p class="placeholder">Loading city list…</p>';
  try {
    await loadCities();
  } catch (err) {
    citiesError = 'Could not load the city list. Open the site through a web server (npm run dev), not as a file.';
    $('#results').innerHTML = `<p class="placeholder">${esc(citiesError)}</p>`;
    pickers.forEach((p) => p.runSearch());
    return;
  }
  citiesReady = true;
  scheduleReference(state);
  if (hash.has('a')) state.a = getCity(+hash.get('a')) ?? null;
  if (hash.has('b')) state.b = getCity(+hash.get('b')) ?? null;
  update();
  // A shared link with both cities shows its result right away.
  if (!inputProblem()) renderResults();
  // Anything typed while the list was loading gets searched now.
  pickers.forEach((p) => p.input.value.trim() && document.activeElement === p.input && p.runSearch());
}

init();
