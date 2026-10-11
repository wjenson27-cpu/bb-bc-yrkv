/**
 * Longest-roll board for one device.
 *
 * A roll is every dice throw by one shooter from the come-out until a
 * seven-out. A made point continues it. A 7 on the come-out does not end it.
 *
 * Storage is a getItem/setItem pair (localStorage today). A Game Center,
 * Play Games, or backend adapter can replace that pair later. Until then
 * the screen says "On this device".
 */

export const STORE_KEY = "bb-longest-roll-v1";
export const TOP_N = 10;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function browserStore() {
  const ls = typeof localStorage !== "undefined" ? localStorage : null;
  return {
    getItem(key) {
      try { return ls ? ls.getItem(key) : null; }
      catch { return null; }
    },
    setItem(key, value) {
      if (!ls) return;
      ls.setItem(key, String(value));
    },
  };
}

export function memoryStore(seed) {
  const bag = Object.assign({}, seed);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null;
    },
    setItem(key, value) {
      bag[key] = String(value);
    },
  };
}

export function emptyData() {
  return { name: "", highlightId: "", entries: [] };
}

/** Monday 00:00:00.000 in the local timezone of `now`. */
export function weekStart(now) {
  const d = new Date(now);
  const day = d.getDay();
  const back = day === 0 ? 6 : day - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, 0, 0, 0, 0).getTime();
}

export function formatWhen(at) {
  const d = new Date(at);
  return MONTHS[d.getMonth()] + " " + d.getDate();
}

export function normalizeName(raw) {
  const s = String(raw || "").trim().replace(/\s+/g, " ").slice(0, 12);
  if (!/^[A-Za-z0-9][A-Za-z0-9 .'-]{0,11}$/.test(s)) return "";
  return s.toUpperCase();
}

/**
 * The finished shooter roll, or null when the throw did not seven-out.
 * `handBefore` is the hand counter before this throw was added.
 */
export function completedRoll(handBefore, result) {
  if (result !== "seven-out" || !handBefore) return null;
  const throws = Math.floor(handBefore.rolls || 0) + 1;
  const points = Math.floor(handBefore.points || 0);
  if (!(throws >= 1) || points < 0) return null;
  return { throws, points };
}

function byRank(a, b) {
  if (b.throws !== a.throws) return b.throws - a.throws;
  if (b.points !== a.points) return b.points - a.points;
  return a.at - b.at;
}

function modeOf(mode) {
  return mode === "crapless" ? "crapless" : "regular";
}

export function ranked(entries, opts) {
  const mode = modeOf(opts.mode);
  const start = opts.scope === "week" ? weekStart(opts.now) : -Infinity;
  return (entries || [])
    .filter((e) => e.mode === mode && e.at >= start)
    .slice()
    .sort(byRank)
    .slice(0, TOP_N);
}

export function placeOf(entries, candidate, opts) {
  const others = (entries || []).filter((e) => e.id !== candidate.id);
  const top = ranked(others.concat([candidate]), {
    mode: candidate.mode,
    scope: opts.scope,
    now: opts.now,
  });
  const idx = top.findIndex((e) => e.id === candidate.id);
  return idx >= 0 ? idx + 1 : 0;
}

export function isPersonalBest(entries, candidate) {
  const mine = (entries || []).filter((e) => e.mode === candidate.mode);
  if (!mine.length) return candidate.throws >= 1;
  const best = mine.slice().sort(byRank)[0];
  if (candidate.throws > best.throws) return true;
  if (candidate.throws === best.throws && candidate.points > best.points) return true;
  return false;
}

export function bestEntry(entries, mode) {
  const mine = (entries || []).filter((e) => e.mode === modeOf(mode));
  if (!mine.length) return null;
  return mine.slice().sort(byRank)[0];
}

function asEntry(raw, id) {
  const throws = Math.floor(Number(raw.throws));
  const points = Math.floor(Number(raw.points) || 0);
  const at = Number(raw.at);
  const mode = raw.mode === "crapless" ? "crapless" : raw.mode === "regular" ? "regular" : "";
  if (!mode || !(throws >= 1) || points < 0 || !Number.isFinite(at)) return null;
  return { throws, points, mode, at, id: id || raw.id };
}

export function previewRoll(data, candidate) {
  const entry = asEntry(candidate, "__preview__");
  if (!entry) {
    return { madeWeek: false, madeAll: false, rankWeek: 0, rankAll: 0, personalBest: false, throws: 0, points: 0, mode: "regular", at: 0 };
  }
  const entries = (data && data.entries) || [];
  const rankWeek = placeOf(entries, entry, { scope: "week", now: entry.at });
  const rankAll = placeOf(entries, entry, { scope: "all", now: entry.at });
  return {
    madeWeek: rankWeek > 0,
    madeAll: rankAll > 0,
    rankWeek,
    rankAll,
    personalBest: isPersonalBest(entries, entry),
    throws: entry.throws,
    points: entry.points,
    mode: entry.mode,
    at: entry.at,
  };
}

function prune(entries, now) {
  const start = weekStart(now);
  const keep = new Set();
  ["regular", "crapless"].forEach((mode) => {
    ranked(entries, { mode, scope: "all", now }).forEach((e) => keep.add(e.id));
    entries
      .filter((e) => e.mode === mode && e.at >= start)
      .sort(byRank)
      .slice(0, 80)
      .forEach((e) => keep.add(e.id));
  });
  return entries.filter((e) => keep.has(e.id));
}

export function commitRoll(data, candidate) {
  const base = data && Array.isArray(data.entries) ? data : emptyData();
  const name = normalizeName(candidate && candidate.name);
  if (!name) return { ok: false, error: "Enter 3 initials or a nickname.", data: base };
  const draft = asEntry(candidate, "__new__");
  if (!draft) return { ok: false, error: "That roll cannot be posted.", data: base };
  const preview = previewRoll(base, draft);
  if (!preview.madeWeek && !preview.madeAll) {
    return { ok: false, error: "That roll missed the board.", data: base };
  }
  const id = "r" + draft.at + "-" + draft.mode[0] + draft.throws + "p" + draft.points + "n" + base.entries.length;
  const personalBest = preview.personalBest;
  const entry = {
    id,
    throws: draft.throws,
    points: draft.points,
    mode: draft.mode,
    at: draft.at,
    name,
    personalBest,
  };
  let entries = base.entries.map((e) => (
    personalBest && e.mode === entry.mode ? Object.assign({}, e, { personalBest: false }) : e
  ));
  entries = prune(entries.concat([entry]), entry.at);
  return {
    ok: true,
    data: { name, highlightId: id, entries },
    entry,
    madeWeek: preview.madeWeek,
    madeAll: preview.madeAll,
    personalBest,
    rankWeek: placeOf(entries, entry, { scope: "week", now: entry.at }),
    rankAll: placeOf(entries, entry, { scope: "all", now: entry.at }),
  };
}

function sanitize(data) {
  const entries = [];
  const list = Array.isArray(data.entries) ? data.entries : [];
  list.forEach((e) => {
    if (!e || typeof e !== "object") return;
    const name = normalizeName(e.name);
    const parsed = asEntry(e, e.id ? String(e.id) : "");
    if (!name || !parsed || !parsed.id) return;
    entries.push({
      id: parsed.id,
      throws: parsed.throws,
      points: parsed.points,
      mode: parsed.mode,
      at: parsed.at,
      name,
      personalBest: !!e.personalBest,
    });
  });
  return {
    name: normalizeName(data.name),
    highlightId: data.highlightId ? String(data.highlightId) : "",
    entries,
  };
}

export function readStore(storage, key = STORE_KEY) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return emptyData();
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return emptyData();
    return sanitize(data);
  } catch {
    return emptyData();
  }
}

export function writeStore(storage, data, key = STORE_KEY) {
  storage.setItem(key, JSON.stringify({
    name: data.name || "",
    highlightId: data.highlightId || "",
    entries: data.entries || [],
  }));
}
