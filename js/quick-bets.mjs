/**
 * One-tap bets (rev 16 S12). Buy 4/5/9/10, Place 6/8.
 * The point is skipped unless Include my point is on.
 */

import * as E from "./engine.mjs";

export const INSIDE = [5, 6, 8, 9];
export const OUTSIDE = [4, 5, 9, 10];
export const ACROSS = [4, 5, 6, 8, 9, 10];

export function keysFor(app) {
  if (app === "bubble") return ["inside", "outside"];
  return ["across", "inside", "outside"];
}

export function numbersFor(name) {
  if (name === "across") return ACROSS.slice();
  if (name === "outside") return OUTSIDE.slice();
  return INSIDE.slice();
}

export function unitFor(chip, tableMin) {
  return Math.max(Math.round(chip || 0), Math.round(tableMin || 0));
}

export function amountFor(number, unit) {
  if (number === 6 || number === 8) return Math.floor((unit * 6) / 5);
  return unit;
}

export function kindFor(number, existing) {
  if (existing === "lay") return null;
  if (existing === "place" || existing === "buy") return existing;
  return number === 6 || number === 8 ? "place" : "buy";
}

/**
 * One unit on each number. Point skipped by default.
 * A Place or Buy already up keeps its type and gains one unit. A Lay is skipped.
 */
export function plan(name, opts) {
  const o = opts || {};
  const unit = unitFor(o.chip, o.tableMin);
  const point = o.includePoint ? null : o.point;
  const have = o.have || {};
  const spots = [];
  numbersFor(name).forEach((n) => {
    if (point && n === point) {
      spots.push({ n, skip: true, reason: "point" });
      return;
    }
    const existing = have[n] || "";
    const kind = kindFor(n, existing);
    if (!kind) {
      spots.push({ n, skip: true, reason: "lay" });
      return;
    }
    spots.push({ n, kind, amount: amountFor(n, unit), skip: false });
  });
  const live = spots.filter((s) => !s.skip);
  const total = live.reduce((a, s) => a + s.amount, 0);
  return { name, unit, spots, total, live };
}

/** All or nothing. Nothing is posted when the bankroll is short. */
export function post(state, name, opts) {
  const built = plan(name, opts);
  if (!built.live.length) return { ok: false, error: "Nothing to post.", state, plan: built };
  if ((state.bankroll || 0) < built.total) {
    return { ok: false, error: "Not enough practice chips for the whole bet.", state, plan: built };
  }
  let next = state;
  for (let i = 0; i < built.live.length; i++) {
    const s = built.live[i];
    const res = E.placeBet(next, { kind: s.kind, number: s.n }, s.amount);
    if (!res.ok) return { ok: false, error: res.error, state, plan: built };
    next = res.state;
  }
  return { ok: true, state: next, plan: built };
}
