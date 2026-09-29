// Trials recorded in this browser session (each press of Calculate).
// Kept in sessionStorage so a page refresh doesn't lose them; closing the tab clears them.

const KEY = 'eratosthenes-trials';

let trials = load();

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trials));
  } catch {
    /* storage unavailable (private mode etc.) - trials still live in memory */
  }
}

export const getTrials = () => trials;

/** Adds a trial unless it repeats the previous one exactly. Returns true if added. */
export function addTrial(t) {
  const last = trials.at(-1);
  const key = (x) => [x.a.id, x.b.id, x.date, x.refraction, x.distMode].join('|');
  if (last && key(last) === key(t)) return false;
  trials.push({ ...t, n: (last?.n ?? 0) + 1 });
  save();
  return true;
}

export function clearTrials() {
  trials = [];
  save();
}
