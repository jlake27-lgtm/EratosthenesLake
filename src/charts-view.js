// The three accuracy charts: session trials + two reference charts from real city pairs.

import { renderScatter } from './chart.js';
import { buildReference } from './experiment.js';
import { allCities } from './cities.js';
import { getTrials, clearTrials } from './trials.js';

const $ = (sel) => document.querySelector(sel);
const fmt = (n, digits = 0) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (n, digits = 2) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}%`;

// Error is plotted as |% error| on a log axis: the north–south method sits well under 1%,
// the straight-line method can pass 100%, and a linear axis would flatten one of them.
const Y_MIN = 0.01;
const absErr = (e) => Math.max(Math.abs(e), Y_MIN);
const pct = (v) => (v < 0.1 ? `${v}%` : v < 1 ? `${v.toFixed(1)}%` : `${fmt(v)}%`);
function yAxis(values) {
  const max = Math.max(100, ...values);
  return { type: 'log', domain: [Y_MIN, 10 ** Math.ceil(Math.log10(max))], format: pct, label: 'Error (%), log scale — lower is better' };
}

const kmTick = (v) => (v >= 1000 ? `${fmt(v / 1000)}k km` : `${fmt(v)} km`);
const X_LON = (max = 8) => ({ type: 'linear', domain: [0, Math.max(8, Math.ceil(max))], format: (v) => `${v}°`, label: 'Longitude difference between the cities' });
const X_DIST = (min = 20, max = 10000) => ({
  type: 'log',
  domain: [Math.min(20, 10 ** Math.floor(Math.log10(Math.max(min, 1)))), Math.max(10000, 10 ** Math.ceil(Math.log10(max)))],
  format: kmTick,
  label: 'Distance between the cities, log scale',
});

function seriesStyle() {
  const css = getComputedStyle(document.documentElement);
  return {
    ns: { name: 'North–south distance', color: css.getPropertyValue('--series-ns').trim(), shape: 'circle' },
    straight: { name: 'Straight-line distance', color: css.getPropertyValue('--series-st').trim(), shape: 'diamond' },
  };
}

// ---------- reference charts ----------

let reference = null;
let refTimer;
let refDate = '';

export function scheduleReference(state) {
  clearTimeout(refTimer);
  document.querySelectorAll('.ref-chart').forEach((el) => el.classList.add('stale'));
  refTimer = setTimeout(() => {
    reference = buildReference(allCities(), state);
    refDate = state.date;
    renderReference();
  }, 150);
}

function pairTip(r, m, extra) {
  return [
    `${signed(m.error)} error`,
    `${r.a.name} → ${r.b.name}`,
    extra,
    `C ≈ ${fmt(m.C)} km`,
  ];
}

function renderReference() {
  if (!reference) return;
  const s = seriesStyle();
  const { byLon, byDist } = reference;

  $('#ref-lon-caption').textContent =
    `${byLon.length} real city pairs from the database (each ≥100k people, at least 5° of latitude apart), measured for ${refDate}.`;
  renderScatter($('#ref-lon-chart'), {
    ariaLabel: 'Reference: error versus longitude difference for both distance methods',
    x: X_LON(),
    y: yAxis(byLon.map((r) => Math.abs(r.st.error))),
    series: ['ns', 'straight'].map((k) => ({
      ...s[k],
      points: byLon.map((r) => {
        const m = k === 'ns' ? r.ns : r.st;
        return { x: r.dLon, y: absErr(m.error), tip: pairTip(r, m, `Δlon ${r.dLon.toFixed(2)}° · ${fmt(m.distanceKm)} km`) };
      }),
    })),
  });

  $('#ref-dist-caption').textContent =
    `${byDist.length} real city pairs within 1° of longitude of each other (each ≥100k people), measured for ${refDate}.`;
  renderScatter($('#ref-dist-chart'), {
    ariaLabel: 'Reference: error versus distance between the cities for both distance methods',
    x: X_DIST(),
    y: yAxis(byDist.map((r) => Math.abs(r.st.error))),
    series: ['ns', 'straight'].map((k) => ({
      ...s[k],
      points: byDist.map((r) => {
        const m = k === 'ns' ? r.ns : r.st;
        return { x: m.distanceKm, y: absErr(m.error), tip: pairTip(r, m, `${fmt(m.distanceKm)} km · Δlon ${r.dLon.toFixed(2)}°`) };
      }),
    })),
  });
  document.querySelectorAll('.ref-chart').forEach((el) => el.classList.remove('stale'));
}

// ---------- session trials ----------

export function renderTrialsChart() {
  const trials = getTrials();
  const s = seriesStyle();
  const byDistance = $('input[name="trialsX"]:checked').value === 'distance';
  const latest = trials.at(-1);

  renderScatter($('#trials-chart'), {
    ariaLabel: `Your trials: error versus ${byDistance ? 'distance' : 'longitude difference'}`,
    empty: 'No trials yet. Each time you press Calculate, the result is plotted here.',
    x: byDistance
      ? X_DIST(Math.min(...trials.map((t) => t.distanceKm)), Math.max(...trials.map((t) => t.distanceKm)))
      : X_LON(Math.max(0, ...trials.map((t) => t.dLon))),
    y: yAxis(trials.map((t) => Math.abs(t.error))),
    series: ['ns', 'straight']
      .map((k) => ({
        ...s[k],
        points: trials
          .filter((t) => t.distMode === k)
          .map((t) => ({
            x: byDistance ? t.distanceKm : t.dLon,
            y: absErr(t.error),
            label: t === latest ? `#${t.n}` : undefined,
            tip: [
              `${signed(t.error)} error`,
              `#${t.n} ${t.a.name} → ${t.b.name}`,
              `${t.date} · Δlon ${t.dLon.toFixed(2)}° · ${fmt(t.distanceKm)} km`,
              `C ≈ ${fmt(t.C)} km`,
            ],
          })),
      }))
      // Keep the legend honest: only show a method once it has been used.
      .filter((ser, i, arr) => ser.points.length || arr.every((x) => !x.points.length)),
  });

  const body = $('#trials-table tbody');
  body.replaceChildren(
    ...trials
      .slice()
      .reverse()
      .map((t) => {
        const tr = document.createElement('tr');
        const cells = [
          `#${t.n}`,
          `${t.a.name} → ${t.b.name}`,
          t.date,
          `${t.dLon.toFixed(2)}°`,
          `${fmt(t.distanceKm, 1)} km`,
          t.distMode === 'ns' ? 'North–south' : 'Straight line',
          t.refraction ? 'On' : 'Off',
          `${fmt(t.C)} km`,
          signed(t.error),
        ];
        for (const c of cells) {
          const td = document.createElement('td');
          td.textContent = c;
          tr.append(td);
        }
        return tr;
      }),
  );
  $('#trials-count').textContent = trials.length ? `${trials.length} trial${trials.length === 1 ? '' : 's'}` : '';
  $('#clear-trials').disabled = !trials.length;
  $('#trials-table').hidden = !trials.length;
}

// ---------- wiring ----------

export function setupCharts() {
  document.querySelectorAll('input[name="trialsX"]').forEach((r) => r.addEventListener('change', renderTrialsChart));
  $('#clear-trials').addEventListener('click', () => {
    if (confirm('Clear all trials from this session?')) {
      clearTrials();
      renderTrialsChart();
    }
  });

  // Re-render on resize and when the light/dark palette switches.
  let frame;
  const rerender = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      renderTrialsChart();
      renderReference();
    });
  };
  let lastWidth = 0;
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w !== lastWidth) { lastWidth = w; rerender(); }
  }).observe($('#charts'));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rerender);

  renderTrialsChart();
}
