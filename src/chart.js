// Small dependency-free SVG scatter chart, styled by CSS tokens in style.css.
// Hover/focus shows a tooltip for the nearest point; arrow keys step through points.

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARGIN = { top: 12, right: 16, bottom: 46, left: 58 };
const HEIGHT = 300;
const HIT_RADIUS = 24;

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
}

/** Symbol path centered on 0,0. Circle for one series, diamond for the other, so shape backs up color. */
export function shapePath(shape, r) {
  if (shape === 'diamond') {
    const d = r * 1.3;
    return `M0 ${-d}L${d} 0L0 ${d}L${-d} 0Z`;
  }
  return `M${-r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}

function makeScale({ type = 'linear', domain: [d0, d1] }, [r0, r1]) {
  const f = type === 'log' ? Math.log10 : (v) => v;
  const a = f(d0), b = f(d1);
  const scale = (v) => r0 + ((f(Math.min(Math.max(v, d0), d1)) - a) / (b - a)) * (r1 - r0);
  scale.clamped = (v) => v < d0 || v > d1;
  return scale;
}

function linearTicks(d0, d1, count = 6) {
  const raw = (d1 - d0) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = Math.ceil(d0 / step) * step; v <= d1 + 1e-9; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

function logTicks(d0, d1) {
  const ticks = [];
  for (let e = Math.floor(Math.log10(d0)); e <= Math.ceil(Math.log10(d1)); e++) {
    for (const m of [1, 3]) {
      const v = m * 10 ** e;
      if (v >= d0 * 0.999 && v <= d1 * 1.001) ticks.push(v);
    }
  }
  return ticks;
}

function legend(series) {
  const wrap = document.createElement('div');
  wrap.className = 'chart-legend';
  for (const s of series) {
    const item = document.createElement('span');
    const sw = el('svg', { width: 14, height: 14, viewBox: '-7 -7 14 14', 'aria-hidden': 'true' });
    el('path', { d: shapePath(s.shape, 4.5), fill: s.color }, sw);
    item.append(sw, document.createTextNode(s.name));
    wrap.append(item);
  }
  return wrap;
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   series: {name:string, color:string, shape:'circle'|'diamond', points:{x:number, y:number, tip:string[], label?:string}[]}[],
 *   x: {type?:'linear'|'log', domain:[number,number], format:(v:number)=>string, label:string},
 *   y: {type?:'linear'|'log', domain:[number,number], format:(v:number)=>string, label:string},
 *   empty?: string, ariaLabel: string,
 * }} spec
 */
export function renderScatter(container, spec) {
  container.replaceChildren();
  container.classList.add('chart');
  if (spec.series.length > 1) container.append(legend(spec.series));

  const width = Math.max(container.clientWidth, 280);
  const svg = el('svg', {
    width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`,
    role: 'img', 'aria-label': spec.ariaLabel, tabindex: 0,
  }, container);
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const sx = makeScale(spec.x, [MARGIN.left, MARGIN.left + plotW]);
  const sy = makeScale(spec.y, [MARGIN.top + plotH, MARGIN.top]);

  // grid + axes
  const grid = el('g', { class: 'grid' }, svg);
  const xTicks = spec.x.type === 'log' ? logTicks(...spec.x.domain) : linearTicks(...spec.x.domain);
  const yTicks = spec.y.type === 'log' ? logTicks(...spec.y.domain) : linearTicks(...spec.y.domain, 5);
  const minXLabelGap = 44;
  let lastLabelX = -Infinity;
  for (const t of xTicks) {
    const x = sx(t);
    el('line', { x1: x, x2: x, y1: MARGIN.top, y2: MARGIN.top + plotH }, grid);
    if (x - lastLabelX >= minXLabelGap) {
      el('text', { x, y: MARGIN.top + plotH + 18, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = spec.x.format(t);
      lastLabelX = x;
    }
  }
  for (const t of yTicks) {
    const y = sy(t);
    el('line', { x1: MARGIN.left, x2: MARGIN.left + plotW, y1: y, y2: y }, grid);
    el('text', { x: MARGIN.left - 8, y: y + 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = spec.y.format(t);
  }
  el('line', { x1: MARGIN.left, x2: MARGIN.left + plotW, y1: MARGIN.top + plotH, y2: MARGIN.top + plotH, class: 'axis' }, svg);
  el('text', { x: MARGIN.left + plotW / 2, y: HEIGHT - 6, class: 'axis-label', 'text-anchor': 'middle' }, svg).textContent = spec.x.label;
  el('text', {
    x: -(MARGIN.top + plotH / 2), y: 14, class: 'axis-label', 'text-anchor': 'middle', transform: 'rotate(-90)',
  }, svg).textContent = spec.y.label;

  // points
  const all = [];
  const marks = el('g', {}, svg);
  for (const s of spec.series) {
    for (const p of s.points) {
      const px = sx(p.x), py = sy(p.y);
      const node = el('path', {
        d: shapePath(s.shape, 4), transform: `translate(${px} ${py})`,
        fill: s.color, class: 'mark',
      }, marks);
      all.push({ ...p, px, py, node, series: s });
    }
  }
  // sparse direct labels (e.g. the latest trial)
  for (const p of all) {
    if (!p.label) continue;
    el('text', { x: p.px + 9, y: p.py - 8, class: 'point-label' }, svg).textContent = p.label;
  }

  if (!all.length && spec.empty) {
    // HTML overlay (not SVG text) so the message wraps on narrow screens.
    const msg = document.createElement('div');
    msg.className = 'chart-empty';
    msg.textContent = spec.empty;
    Object.assign(msg.style, {
      left: `${MARGIN.left}px`, width: `${plotW}px`,
      top: `${svg.getBoundingClientRect().top - container.getBoundingClientRect().top + MARGIN.top}px`, height: `${plotH}px`,
    });
    container.append(msg);
  }

  // hover / focus tooltip
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  container.append(tip);
  const order = [...all].sort((a, b) => a.px - b.px);
  let current = null;

  function show(p) {
    current?.node.classList.remove('active');
    current = p;
    if (!p) { tip.hidden = true; return; }
    p.node.classList.add('active');
    p.node.parentNode.appendChild(p.node); // bring to front
    tip.replaceChildren();
    const [head, ...rest] = p.tip;
    const strong = document.createElement('strong');
    strong.textContent = head;
    tip.append(strong);
    const key = document.createElement('div');
    key.className = 'tip-series';
    const sw = el('svg', { width: 12, height: 12, viewBox: '-6 -6 12 12', 'aria-hidden': 'true' });
    el('path', { d: shapePath(p.series.shape, 4), fill: p.series.color }, sw);
    key.append(sw, document.createTextNode(p.series.name));
    tip.append(key);
    for (const line of rest) {
      const div = document.createElement('div');
      div.textContent = line;
      tip.append(div);
    }
    tip.hidden = false;
    const left = Math.min(Math.max(p.px + 12, 0), width - tip.offsetWidth - 4);
    const top = p.py - tip.offsetHeight - 12 < 0 ? p.py + 14 : p.py - tip.offsetHeight - 12;
    tip.style.transform = `translate(${left}px, ${top + svg.getBoundingClientRect().top - container.getBoundingClientRect().top}px)`;
  }

  svg.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bestD = HIT_RADIUS ** 2;
    for (const p of all) {
      const d = (p.px - mx) ** 2 + (p.py - my) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    show(best);
  });
  svg.addEventListener('pointerleave', () => show(null));
  svg.addEventListener('blur', () => show(null));
  svg.addEventListener('keydown', (e) => {
    if (!order.length) return;
    const i = current ? order.indexOf(current) : -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') show(order[Math.min(i + 1, order.length - 1)]);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') show(order[Math.max(i - 1, 0)]);
    else if (e.key === 'Escape') show(null);
    else return;
    e.preventDefault();
  });
}
