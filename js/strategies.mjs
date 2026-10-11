/**
 * App 1 strategy cards B1–B12 and auto-bet maintenance.
 */
import {
  TABLE_MIN,
  formatMoney,
  maxPassOdds,
  maxLayOdds,
  numbersFor,
  placeBet,
  placeBillysWay,
  removeBet,
  press,
  powerPress,
  billysWayAmounts,
} from "./engine.mjs";

export const STRATEGIES = [
  {
    id: "B1",
    name: "Pass Line + Max Odds",
    mode: "both",
    filter: ["all", "regular", "crapless"],
    edge: "0.37% Regular · 1.26% Crapless with max odds",
    risk: "Low to Medium",
    bankroll: "30 units flat. With max odds, 60 to 90 units.",
    how: "Pass on the come-out. Take 3-4-5x odds once a point is set. Odds have no house edge, so the combined edge drops to 0.37% in Regular and 1.26% in Crapless.",
  },
  {
    id: "B2",
    name: "Don't Pass + Lay Odds",
    mode: "regular",
    filter: ["all", "regular"],
    edge: "1.40% per bet resolved · 0.27% with 6x lay",
    risk: "Low",
    bankroll: "60 to 80 units. Stop-loss 50%.",
    how: "Don't Pass on the come-out. Lay up to 6x after the point. 2 and 3 win, 7 and 11 lose, 12 pushes. Not available in Crapless.",
  },
  {
    id: "B3",
    name: "3-Point Molly",
    mode: "both",
    filter: ["all", "regular", "crapless"],
    edge: "0.37% each Regular · 1.26% each Crapless",
    risk: "Medium",
    bankroll: "100+ units. A seven-out takes all three numbers.",
    how: "Pass plus odds, then two Come bets with odds, so three numbers are working. Replace Come bets as they win.",
  },
  {
    id: "B4",
    name: "Place 6 and 8",
    mode: "both",
    filter: ["all", "regular", "crapless"],
    edge: "1.52% · 0.46% per roll",
    risk: "Low to Medium",
    bankroll: "25 to 30 pairs. Stop-loss 50%.",
    how: "Place 6 and 8 in $6 units (7 to 6). Off on the come-out unless you turn working on. Buy 6/8 is worse under Standard rules (2.27%).",
  },
  {
    id: "B5",
    name: "Place 6/8 Regression & Press",
    mode: "both",
    filter: ["all", "regular", "crapless", "lessons"],
    edge: "1.52%, unchanged by pressing",
    risk: "Medium, then Low",
    bankroll: "20 to 25 times the opening spread.",
    how: "Open at $18 each. After the first hit, regress to $6 each. Later hits press one $6 unit, up to 3 times per number. Same edge, more at risk when you press.",
  },
  {
    id: "B6",
    name: "Crapless Line + Odds: \"Make the line pay\"",
    mode: "crapless",
    filter: ["all", "crapless"],
    edge: "5.38% flat · 1.26% with max odds",
    risk: "Medium to High",
    bankroll: "80 to 100 units. Stop-loss 50%.",
    how: "Pass at the minimum, then always take max odds. On 2/12, 3x odds pay 6 to 1. On 3/11 they pay 3 to 1. A 2 or 12 point wins 1 time in 7.",
  },
  {
    id: "B7",
    name: "Crapless 6/8 Only, Avoid 2/3/11/12",
    mode: "crapless",
    filter: ["all", "crapless"],
    edge: "1.52% on 6/8. Pass 5.38% flat.",
    risk: "Low to Medium",
    bankroll: "30 to 40 units.",
    how: "Pass plus odds and Place 6/8. No Place or Buy on 2, 3, 11, or 12. Those Place bets cost 6.25% to 7.14%.",
  },
  {
    id: "B8",
    name: "Crapless Conservative Outside",
    mode: "crapless",
    filter: ["all", "crapless"],
    edge: "Buy 4/10 1.67% · Buy 5/9 2.00%",
    risk: "Medium",
    bankroll: "40 units. Stop-loss 40%.",
    how: "After the point, Buy 4, 5, 9, and 10. Leave 2, 3, 11, and 12 alone. Take them down after 3 hits.",
  },
  {
    id: "B9",
    name: "Why You Skip Place 2/12 and 3/11",
    mode: "crapless",
    filter: ["all", "crapless", "lessons"],
    edge: "Place 2/12 7.14% vs Buy 0.71%. Place 3/11 6.25% vs Buy 1.25%.",
    risk: "Very High on Place 2/12",
    bankroll: "Lesson card. No auto-bet.",
    how: "Place 2/12 pays 11 to 2 against true odds of 6 to 1. Place 3/11 pays 11 to 4 against 3 to 1. Buy pays true odds less 5% of the stake, and only on a win. This card does not place a bet.",
    lesson: true,
  },
  {
    id: "B10",
    name: "Crapless Come-Bet Ladder",
    mode: "crapless",
    filter: ["all", "crapless"],
    edge: "5.38% flat · about 1.26% with odds",
    risk: "High",
    bankroll: "120+ units. Stop-loss 40%.",
    how: "Pass plus odds, then one Come bet per roll until three numbers are working. Take max odds on each.",
  },
  {
    id: "B11",
    name: "Bubble Budget Grind",
    mode: "both",
    filter: ["all", "regular", "crapless", "lessons"],
    edge: "1.41% Regular · 5.38% Crapless",
    risk: "Low",
    bankroll: "30 units. Stop-loss 15 units. 100-roll limit.",
    how: "Pass flat at the table minimum. Take odds only when the bankroll can spare them. No prop bets. Stops after 100 rolls. Regular is the cheaper line.",
  },
  {
    id: "B12",
    name: "Billy's Way",
    mode: "both",
    filter: ["all", "regular", "crapless"],
    edge: "1.71% blended Regular · 1.43% Crapless",
    risk: "Medium to High",
    bankroll: "About 100 to 130 units Regular, 160 to 210 Crapless.",
    how: "One unit across. Regular buys 4, 5, 9, 10 and places 6 and 8. Crapless also buys 2, 3, 11, 12. Each spot is its own bet. A 7 takes them all.",
  },
];

export function strategyById(id) {
  return STRATEGIES.find((s) => s.id === id) || null;
}

function unitFromChip(chip) {
  return Math.max(TABLE_MIN, chip || TABLE_MIN);
}

function tryPlace(state, spot, amount, out) {
  if (amount <= 0 || amount > state.bankroll) {
    out.skipped.push({ ...spot, reason: "Not enough practice chips." });
    return state;
  }
  const res = placeBet(state, spot, amount);
  if (!res.ok) {
    out.skipped.push({ ...spot, reason: res.error });
    return state;
  }
  out.placed.push({ ...spot, amount });
  return res.state;
}

function topUp(state, spot, target, out) {
  const cur = spot.kind === "pass" ? state.bets.pass
    : spot.kind === "dontPass" ? state.bets.dontPass
      : spot.kind === "come" ? state.bets.come
        : spot.kind === "place" ? state.bets.place[spot.number] || 0
          : spot.kind === "buy" ? state.bets.buy[spot.number] || 0
            : 0;
  if (cur >= target) return state;
  return tryPlace(state, spot, target - cur, out);
}

function fillPassOdds(state, out) {
  if (state.phase !== "point" || !state.bets.pass) return state;
  const cap = maxPassOdds(state.bets.pass, state.point);
  const need = cap - state.bets.passOdds;
  if (need <= 0) return state;
  const add = Math.min(need, state.bankroll);
  if (add <= 0) return state;
  return tryPlace(state, { kind: "passOdds" }, add, out);
}

function fillLay(state, out) {
  if (state.phase !== "point" || !state.bets.dontPass) return state;
  const cap = maxLayOdds(state.bets.dontPass);
  const need = cap - state.bets.dontPassOdds;
  if (need <= 0) return state;
  return tryPlace(state, { kind: "dontPassOdds" }, Math.min(need, state.bankroll), out);
}

function fillComeOdds(state, out) {
  let next = state;
  Object.keys(next.bets.comeBets).forEach((key) => {
    const n = Number(key);
    const slot = next.bets.comeBets[n];
    if (!slot || !slot.amount) return;
    const cap = maxPassOdds(slot.amount, n);
    const need = cap - (slot.odds || 0);
    if (need > 0) next = tryPlace(next, { kind: "comeOdds", number: n }, Math.min(need, next.bankroll), out);
  });
  return next;
}

function comePointCount(state) {
  return Object.values(state.bets.comeBets).filter((s) => s && s.amount).length;
}

function ensureData(state, id) {
  if (!state.strategy || state.strategy.id !== id) {
    state.strategy = { id, rolls: 0, data: {} };
  }
  return state.strategy;
}

/**
 * Place or repair the strategy's bets. Call before a roll.
 * Does not stack a fresh unit every roll; it maintains the recipe.
 */
export function autoBet(state, id, chipCents, opts = {}) {
  const card = strategyById(id);
  const out = { placed: [], skipped: [], message: "" };
  if (!card) return { ok: false, state, ...out, message: "Unknown strategy." };
  if (card.lesson) {
    return {
      ok: true,
      state,
      ...out,
      message: "Place 2/12 is 7.14%. Buy 2/12 is 0.71%. Place 3/11 is 6.25%. Buy 3/11 is 1.25%. This lesson does not bet.",
    };
  }
  if (card.mode !== "both" && card.mode !== state.mode) {
    return { ok: false, state, ...out, message: card.name + " is a " + card.mode + " strategy." };
  }
  const chip = chipCents || TABLE_MIN;
  const bet = unitFromChip(chip);
  let next = structuredClone(state);
  const strat = ensureData(next, id);
  if (opts.count !== false) strat.rolls = (strat.rolls || 0) + 1;
  if (id === "B11" && strat.rolls > 100) {
    next.strategy = strat;
    return { ok: true, state: next, ...out, paused: true, message: "100-roll limit. Budget grind is paused." };
  }

  if (id === "B1" || id === "B6" || id === "B7" || id === "B11") {
    if (next.phase === "come-out") next = topUp(next, { kind: "pass" }, id === "B11" ? TABLE_MIN : bet, out);
    const oddsOk = id !== "B11" || next.bankroll >= TABLE_MIN * 20;
    if (oddsOk) next = fillPassOdds(next, out);
  }
  if (id === "B2") {
    if (next.phase === "come-out") next = topUp(next, { kind: "dontPass" }, bet, out);
    next = fillLay(next, out);
  }
  if (id === "B3") {
    if (next.phase === "come-out") next = topUp(next, { kind: "pass" }, bet, out);
    next = fillPassOdds(next, out);
    const working = (next.phase === "point" ? 1 : 0) + comePointCount(next) + (next.bets.come ? 1 : 0);
    if (next.phase === "point" && working < 3 && !next.bets.come) {
      next = tryPlace(next, { kind: "come" }, bet, out);
    }
    next = fillComeOdds(next, out);
  }
  if (id === "B4") {
    const stake = Math.floor((bet * 6) / 5);
    [6, 8].forEach((n) => {
      if ((next.bets.place[n] || 0) < stake) next = tryPlace(next, { kind: "place", number: n }, stake - (next.bets.place[n] || 0), out);
    });
  }
  if (id === "B5") {
    const data = strat.data;
    const mode = (next.autoPress && next.autoPress.mode) || "off";
    const cap = mode === "off" ? 3 : Math.min(5, Math.max(1, Number(next.autoPress.max) || 3));
    if (data.stopped) {
      out.paused = true;
      out.message = "Three opening spreads lost. Place 6/8 regression is paused.";
    } else {
      const p6 = next.bets.place[6] || 0;
      const p8 = next.bets.place[8] || 0;
      if (data.opened && p6 === 0 && p8 === 0) {
        data.losses = (data.losses || 0) + 1;
        data.opened = false;
        data.regressed = false;
        data.presses = { 6: 0, 8: 0 };
        if (data.losses >= 3) {
          data.stopped = true;
          out.paused = true;
          out.message = "Three opening spreads lost. Place 6/8 regression is paused.";
        }
      }
      const hit = (next.lastDecisions || []).some((d) => d.result === "win" && (d.bet === "Place 6" || d.bet === "Place 8"));
      if (!data.stopped && !data.opened) {
        [6, 8].forEach((n) => {
          if ((next.bets.place[n] || 0) < 1800) next = tryPlace(next, { kind: "place", number: n }, 1800 - (next.bets.place[n] || 0), out);
        });
        if ((next.bets.place[6] || 0) >= 1800 && (next.bets.place[8] || 0) >= 1800) data.opened = true;
      } else if (!data.stopped && !data.regressed && hit) {
        [6, 8].forEach((n) => {
          const have = next.bets.place[n] || 0;
          if (have > 600) {
            const res = removeBet(next, { kind: "place", number: n }, have - 600);
            if (res.ok) next = res.state;
          }
        });
        data.regressed = true;
        data.presses = { 6: 0, 8: 0 };
        out.message = "Regressed 6 and 8 to $6.";
      } else if (!data.stopped && data.regressed && hit) {
        data.presses = data.presses || { 6: 0, 8: 0 };
        const n = (next.lastDecisions || []).reduce((found, d) => {
          if (d.result !== "win") return found;
          if (d.bet === "Place 6") return 6;
          if (d.bet === "Place 8") return 8;
          return found;
        }, 0);
        if (n && (data.presses[n] || 0) < cap) {
          const res = mode === "power" ? powerPress(next) : press(next);
          if (res.ok) {
            next = res.state;
            data.presses[n] += 1;
            const stake = next.bets.place[n];
            const prefix = mode === "off" ? "PRESS" : "Auto " + (mode === "power" ? "POWER PRESS" : "PRESS");
            const back = mode === "power" ? ", " + formatMoney(res.back) + " to chips" : "";
            out.message = prefix + " " + n + " +" + formatMoney(res.added) + " → " + formatMoney(stake) + back;
          }
        }
      }
    }
  }
  if (id === "B7") {
    const stake = Math.floor((bet * 6) / 5);
    [6, 8].forEach((n) => {
      if ((next.bets.place[n] || 0) < stake) next = tryPlace(next, { kind: "place", number: n }, stake - (next.bets.place[n] || 0), out);
    });
  }
  if (id === "B8") {
    const data = strat.data;
    if (!data.seen) data.seen = true;
    else if (!data.resting) {
      const buyHit = (next.lastDecisions || []).filter((d) => d.result === "win" && /^Buy (4|5|9|10)$/.test(d.bet)).length;
      data.hits = (data.hits || 0) + buyHit;
    }
    if (data.resting) {
      if (next.phase === "come-out") data.resting = false;
    } else if ((data.hits || 0) >= 3) {
      [4, 5, 9, 10].forEach((n) => {
        if (next.bets.buy[n]) {
          const res = removeBet(next, { kind: "buy", number: n });
          if (res.ok) next = res.state;
        }
      });
      data.hits = 0;
      data.resting = true;
      out.message = "Three outside hits. Buys taken down.";
    } else if (next.phase === "point") {
      [4, 5, 9, 10].forEach((n) => {
        if (!next.bets.buy[n]) next = tryPlace(next, { kind: "buy", number: n }, TABLE_MIN, out);
      });
    }
  }
  if (id === "B10") {
    if (next.phase === "come-out") next = topUp(next, { kind: "pass" }, bet, out);
    next = fillPassOdds(next, out);
    const workingNums = (next.phase === "point" ? 1 : 0) + comePointCount(next);
    if (next.phase === "point" && workingNums < 3 && !next.bets.come) {
      next = tryPlace(next, { kind: "come" }, bet, out);
    }
    next = fillComeOdds(next, out);
  }
  if (id === "B12") {
    const want = billysWayAmounts(chip);
    const buys = (state.mode === "crapless" ? [2, 3, 4, 5, 9, 10, 11, 12] : [4, 5, 9, 10]).filter((n) => numbersFor(next).includes(n));
    const missing = buys.some((n) => (next.bets.buy[n] || 0) < want.buy) || [6, 8].some((n) => (next.bets.place[n] || 0) < want.place);
    if (missing && next.phase === "point") {
      const res = placeBillysWay(next, chip);
      next = res.state;
      out.placed.push(...res.placed);
      out.skipped.push(...res.skipped);
    }
  }
  next.strategy = strat;
  return { ok: true, state: next, ...out };
}

/**
 * Press the Billy's Way spot that just won. B5 applies the same setting itself.
 * Does not change the bet's original amount.
 */
export function applyAutoPress(state) {
  const cfg = state.autoPress || { mode: "off", max: 3, counts: {} };
  if (!cfg.mode || cfg.mode === "off") return { ok: false, state, skipped: true };
  if (state.strategy && state.strategy.id === "B5") return { ok: false, state, skipped: true };
  const lw = state.lastWin;
  if (!lw) return { ok: false, state, error: "after a hit" };
  const marked = state.billyMark && state.billyMark[lw.kind] && state.billyMark[lw.kind][lw.number];
  if (!marked) return { ok: false, state, error: "not a Billy's Way spot" };
  const counts = { ...(cfg.counts || {}) };
  const key = lw.kind + ":" + lw.number;
  const cap = Math.min(5, Math.max(1, Number(cfg.max) || 3));
  if ((counts[key] || 0) >= cap) return { ok: false, state, error: "auto-press cap" };
  const res = cfg.mode === "power" ? powerPress(state) : press(state);
  if (!res.ok) return { ok: false, state, error: res.error };
  counts[key] = (counts[key] || 0) + 1;
  res.state.autoPress = { mode: cfg.mode, max: cap, counts };
  const stake = res.state.bets[lw.kind][lw.number];
  const verb = cfg.mode === "power" ? "POWER PRESS" : "PRESS";
  const back = cfg.mode === "power" ? ", " + formatMoney(res.back) + " to chips" : "";
  return {
    ok: true,
    state: res.state,
    added: res.added,
    back: res.back,
    atMax: !!res.atMax,
    message: "Auto " + verb + " " + lw.number + " +" + formatMoney(res.added) + " → " + formatMoney(stake) + back,
  };
}

export function clearStrategy(state) {
  const next = structuredClone(state);
  next.strategy = null;
  return next;
}

export function lessonText(id) {
  const card = strategyById(id);
  return card ? card.how : "";
}

export { formatMoney };
