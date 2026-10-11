/**
 * Billy Bubs Bubble Craps — rules engine.
 * Pure state, integer cents, no DOM. Runs in the browser and in Node.
 * Standard rules only (Premium is a locked preview in the UI).
 */

export const STARTING_BANKROLL = 100_000;
export const TABLE_MIN = 500;
export const TABLE_MAX = 100_000;
export const REPEATER_MIN = 100;
export const REPEATER_MAX = 2_500;
export const HOP_MIN = 100;
export const HOP_MAX = 10_000;
export const CHIPS = [100, 500, 2_500, 10_000, 50_000];

export const NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
export const REGULAR_NUMBERS = [4, 5, 6, 8, 9, 10];
export const HARDWAYS = [4, 6, 8, 10];
export const HARD_HOPS = ["1-1", "2-2", "3-3", "4-4", "5-5", "6-6"];
export const EASY_HOPS = [
  "1-2", "1-3", "1-4", "1-5", "1-6",
  "2-3", "2-4", "2-5", "2-6",
  "3-4", "3-5", "3-6",
  "4-5", "4-6",
  "5-6",
];
export const ALL_HOPS = HARD_HOPS.concat(EASY_HOPS);
/** Horn box singles are the same stake as these hops. */
export const HORN_TO_HOP = { 2: "1-1", 3: "1-2", 11: "5-6", 12: "6-6" };

export const REPEATER_NEEDS = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 8: 6, 9: 5, 10: 4, 11: 3, 12: 2 };
export const REPEATER_FOR = { 2: 40, 3: 50, 4: 65, 5: 80, 6: 90, 8: 90, 9: 80, 10: 65, 11: 50, 12: 40 };
export const REPEATER_EDGE = {
  2: 18.37, 12: 18.37,
  3: 21.88, 11: 21.88,
  4: 19.75, 10: 19.75,
  5: 18.08, 9: 18.08,
  6: 20.62, 8: 20.62,
};

const SMALL = [2, 3, 4, 5, 6];
const TALL = [8, 9, 10, 11, 12];
const ALLSET = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const BONUS_FOR = { small: 31, tall: 31, all: 156, hardAllDay: 165 };

const BILLY_BUY = [2, 3, 4, 5, 9, 10, 11, 12];
const BILLY_PLACE = [6, 8];

let lastRngSource = "secure";

export function getRngSource() {
  return lastRngSource;
}

export function formatMoney(cents) {
  const n = Math.round(Number(cents) || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const dollars = abs / 100;
  const text = Number.isInteger(dollars)
    ? dollars.toLocaleString("en-US")
    : dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return sign + "$" + text;
}

export function chipDollars() {
  return CHIPS.map((c) => c / 100);
}

function emptyMap(keys, value) {
  const o = {};
  keys.forEach((k) => {
    o[k] = value;
  });
  return o;
}

function emptyBets() {
  return {
    pass: 0,
    passOdds: 0,
    dontPass: 0,
    dontPassOdds: 0,
    come: 0,
    dontCome: 0,
    comeBets: {},
    dontComeBets: {},
    field: 0,
    place: emptyMap(NUMBERS, 0),
    buy: emptyMap(NUMBERS, 0),
    hardways: emptyMap(HARDWAYS, 0),
    any7: 0,
    anyCraps: 0,
    ce: 0,
    horn: 0,
    hops: emptyMap(ALL_HOPS, 0),
    small: 0,
    tall: 0,
    all: 0,
    hardAllDay: 0,
    repeaters: emptyMap(NUMBERS, 0),
  };
}

export function createGame(options = {}) {
  const bank = options.bankroll != null ? options.bankroll : STARTING_BANKROLL;
  return {
    mode: options.mode === "crapless" ? "crapless" : "regular",
    bankroll: bank,
    startingBankroll: options.startingBankroll != null ? options.startingBankroll : bank,
    phase: "come-out",
    point: null,
    betsOff: false,
    placeWorkingOnComeOut: false,
    hardwaysWorkingOnComeOut: true,
    comeOddsOffOnComeOut: true,
    bets: emptyBets(),
    originals: { place: emptyMap(NUMBERS, 0), buy: emptyMap(NUMBERS, 0) },
    progress: { small: {}, tall: {}, all: {}, hardAllDay: {} },
    repeaterCount: emptyMap(NUMBERS, 0),
    billyMark: { place: {}, buy: {} },
    autoPress: { mode: "off", max: 3, counts: {} },
    pressStack: [],
    lastWin: null,
    pressBlock: "after a hit",
    lastDice: null,
    lastDecisions: [],
    lastNarrative: "",
    history: [],
    hand: { rolls: 0, points: 0, lastLength: 0 },
    stats: { rolls: 0, wins: 0, losses: 0 },
    strategy: null,
  };
}

export function isCrapless(state) {
  return state.mode === "crapless";
}

export function numbersFor(state) {
  return isCrapless(state) ? NUMBERS.slice() : REGULAR_NUMBERS.slice();
}

export function tableTotal(state) {
  const b = state.bets;
  let t = b.pass + b.passOdds + b.dontPass + b.dontPassOdds + b.come + b.dontCome + b.field;
  t += b.any7 + b.anyCraps + b.ce + b.horn + b.small + b.tall + b.all + b.hardAllDay;
  NUMBERS.forEach((n) => {
    t += (b.place[n] || 0) + (b.buy[n] || 0) + (b.repeaters[n] || 0);
  });
  HARDWAYS.forEach((n) => {
    t += b.hardways[n] || 0;
  });
  ALL_HOPS.forEach((k) => {
    t += b.hops[k] || 0;
  });
  Object.keys(b.comeBets).forEach((k) => {
    const s = b.comeBets[k];
    if (s) t += (s.amount || 0) + (s.odds || 0);
  });
  Object.keys(b.dontComeBets).forEach((k) => {
    const s = b.dontComeBets[k];
    if (s) t += (s.amount || 0) + (s.odds || 0);
  });
  return t;
}

export function netWorth(state) {
  return state.bankroll + tableTotal(state);
}

export function passOddsProfit(cents, point) {
  switch (point) {
    case 4:
    case 10:
      return cents * 2;
    case 5:
    case 9:
      return Math.floor((cents * 3) / 2);
    case 6:
    case 8:
      return Math.floor((cents * 6) / 5);
    case 2:
    case 12:
      return cents * 6;
    case 3:
    case 11:
      return cents * 3;
    default:
      return 0;
  }
}

export function layOddsProfit(cents, point) {
  switch (point) {
    case 4:
    case 10:
      return Math.floor(cents / 2);
    case 5:
    case 9:
      return Math.floor((cents * 2) / 3);
    case 6:
    case 8:
      return Math.floor((cents * 5) / 6);
    default:
      return 0;
  }
}

export function placeProfit(cents, number) {
  switch (number) {
    case 4:
    case 10:
      return Math.floor((cents * 9) / 5);
    case 5:
    case 9:
      return Math.floor((cents * 7) / 5);
    case 6:
    case 8:
      return Math.floor((cents * 7) / 6);
    case 2:
    case 12:
      return Math.floor((cents * 11) / 2);
    case 3:
    case 11:
      return Math.floor((cents * 11) / 4);
    default:
      return 0;
  }
}

/** 5% of the buy stake, floored to the cent, taken from the win only. */
export function buyVig(cents) {
  return Math.floor((cents * 5) / 100);
}

export function buyProfit(cents, number) {
  const gross = passOddsProfit(cents, number);
  return gross - buyVig(cents);
}

export function fieldProfit(cents, total) {
  if (total === 2 || total === 12) return cents * 2;
  if (total === 3 || total === 4 || total === 9 || total === 10 || total === 11) return cents;
  return 0;
}

export function hardwayProfit(cents, number) {
  if (number === 4 || number === 10) return cents * 7;
  if (number === 6 || number === 8) return cents * 9;
  return 0;
}

export function maxPassOdds(lineAmount, point) {
  if (!lineAmount || !point) return 0;
  let multiple = 3;
  if (point === 5 || point === 9) multiple = 4;
  else if (point === 6 || point === 8) multiple = 5;
  else multiple = 3;
  return lineAmount * multiple;
}

export function maxLayOdds(lineAmount) {
  if (!lineAmount) return 0;
  return lineAmount * 6;
}

export function oddsMultiple(point) {
  if (point === 5 || point === 9) return 4;
  if (point === 6 || point === 8) return 5;
  return 3;
}

export function pressUnit(kind, number) {
  if (kind === "buy") return 500;
  if (number === 6 || number === 8) return 600;
  if (number === 5 || number === 9 || number === 4 || number === 10) return 500;
  if (number === 2 || number === 12) return 200;
  if (number === 3 || number === 11) return 400;
  return 500;
}

export function blazingTier(score, points) {
  const p = points || 0;
  const s = score || 0;
  if (s >= 24 || p >= 4) return "blazing";
  if (s >= 12) return "hot";
  if (s >= 4) return "warm";
  return "cold";
}

export function blazingScore(hand) {
  return (hand?.rolls || 0) + 3 * (hand?.points || 0);
}

/** Copy for a tier change. Cosmetic only: it never feeds the rules. */
export function blazeMoment(before, after, result) {
  const prev = before || { rolls: 0, points: 0 };
  const next = after || { rolls: 0, points: 0 };
  const prevTier = blazingTier(blazingScore(prev), prev.points);
  const nextTier = blazingTier(blazingScore(next), next.points);
  if (result === "seven-out") {
    const length = (prev.rolls || 0) + 1;
    const hot = prevTier === "hot" || prevTier === "blazing";
    return {
      tier: "cold",
      prevTier,
      cooled: prevTier !== "cold",
      text: prevTier === "cold" ? "" : "Cooled off. New hand, same odds.",
      handNote: hot
        ? "That was a " + length + "-roll hand. Long hands happen; so do quick ones. Dice have no memory."
        : "",
      lessonTier: null,
    };
  }
  if (nextTier !== prevTier && nextTier !== "cold") {
    const rolls = next.rolls || 0;
    let text = "";
    if (nextTier === "warm") text = "Warm: this hand has lasted " + rolls + " rolls so far.";
    else if (nextTier === "hot") {
      text = "Hot hand: " + rolls + " rolls so far. About 3 hands in 10 get this far. The next roll is still random: a 7 is 1 in 6.";
    } else {
      text = "Blazing: " + rolls + " rolls this hand. About 1 hand in 12 gets here. Fun to watch; it doesn't change the odds.";
    }
    return { tier: nextTier, prevTier, cooled: false, text, handNote: "", lessonTier: nextTier };
  }
  return { tier: nextTier, prevTier, cooled: false, text: "", handNote: "", lessonTier: null };
}

export function hopPayTo1(key) {
  return HARD_HOPS.includes(key) ? 30 : 15;
}

export function hopEdge(key) {
  return HARD_HOPS.includes(key) ? 13.89 : 11.11;
}

export function rollPairKey(d1, d2) {
  const a = Math.min(d1, d2);
  const b = Math.max(d1, d2);
  return a + "-" + b;
}

export function rollCaption(d1, d2) {
  const total = d1 + d2;
  const hard = d1 === d2;
  const names = {
    2: "SNAKE EYES",
    3: "ACE DEUCE",
    4: "FOUR",
    5: "FIVE",
    6: "SIX",
    7: "SEVEN",
    8: "EIGHT",
    9: "NINE",
    10: "TEN",
    11: "YO",
    12: "MIDNIGHT",
  };
  let word = names[total] || String(total);
  if (hard && (total === 4 || total === 6 || total === 8 || total === 10)) word = "HARD " + names[total];
  else if (!hard && (total === 4 || total === 6 || total === 8 || total === 10)) word = "EASY " + names[total];
  else if (total === 7) word = "SEVEN";
  const faceWord = ["", "one", "two", "three", "four", "five", "six"];
  const totalWord = ["", "", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  let aria = faceWord[d1] + " and " + faceWord[d2] + ", " + totalWord[total];
  if (hard && (total === 4 || total === 6 || total === 8 || total === 10)) aria = faceWord[d1] + " and " + faceWord[d2] + ", hard " + totalWord[total];
  else if (!hard && (total === 4 || total === 6 || total === 8 || total === 10)) aria = faceWord[d1] + " and " + faceWord[d2] + ", easy " + totalWord[total];
  return { d1, d2, total, hard, line: word, word, aria };
}

function cryptoObj() {
  if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.getRandomValues) {
    return globalThis.crypto;
  }
  return null;
}

/** Fair 1–6 via crypto.getRandomValues and rejection sampling. Optional rng() is for tests only. */
export function rollDie(rng) {
  if (typeof rng === "function") {
    lastRngSource = "test";
    return Math.floor(rng() * 6) + 1;
  }
  const c = cryptoObj();
  if (c) {
    lastRngSource = "secure";
    const buf = new Uint32Array(1);
    const limit = 4294967296 - (4294967296 % 6);
    let n;
    do {
      c.getRandomValues(buf);
      n = buf[0];
    } while (n >= limit);
    return (n % 6) + 1;
  }
  lastRngSource = "fallback";
  return Math.floor(Math.random() * 6) + 1;
}

export function rollDice(rng) {
  const d1 = rollDie(rng);
  const d2 = rollDie(rng);
  const cap = rollCaption(d1, d2);
  cap.source = lastRngSource;
  return cap;
}

function clone(state) {
  return structuredClone(state);
}

function spotMin(kind) {
  if (kind === "repeater") return REPEATER_MIN;
  if (kind === "hop") return HOP_MIN;
  if (kind === "small" || kind === "tall" || kind === "all" || kind === "hardAllDay") return 100;
  if (kind === "horn") return 400;
  if (kind === "ce") return 200;
  if (kind === "passOdds" || kind === "dontPassOdds" || kind === "comeOdds" || kind === "dontComeOdds") return 1;
  return TABLE_MIN;
}

function spotMax(kind) {
  if (kind === "repeater") return REPEATER_MAX;
  if (kind === "hop") return HOP_MAX;
  if (kind === "passOdds" || kind === "dontPassOdds" || kind === "comeOdds" || kind === "dontComeOdds") return Infinity;
  return TABLE_MAX;
}

function normalizeHop(spot) {
  if (spot.kind !== "hop") return spot;
  if (spot.pair && ALL_HOPS.includes(spot.pair)) return { kind: "hop", pair: spot.pair };
  if (HORN_TO_HOP[spot.number]) return { kind: "hop", pair: HORN_TO_HOP[spot.number] };
  return { kind: "hop", pair: spot.pair || "" };
}

export function describeSpot(spot) {
  const s = spot.kind === "hop" ? normalizeHop(spot) : spot;
  switch (s.kind) {
    case "pass": return "Pass Line";
    case "passOdds": return "Odds";
    case "dontPass": return "Don't Pass";
    case "dontPassOdds": return "Lay Odds";
    case "come": return "Come";
    case "dontCome": return "Don't Come";
    case "comeOdds": return "Come Odds " + s.number;
    case "dontComeOdds": return "Don't Come Odds " + s.number;
    case "field": return "Field";
    case "place": return "Place " + s.number;
    case "buy": return "Buy " + s.number;
    case "hardway": return "Hard " + s.number;
    case "any7": return "Big Red";
    case "anyCraps": return "Any Craps";
    case "ce": return "C&E";
    case "horn": return "Horn";
    case "hop": return "Hop " + s.pair;
    case "small": return "Low Rolls";
    case "tall": return "High Rolls";
    case "all": return "Roll 'Em All";
    case "hardAllDay": return "Hard Way All Day";
    case "repeater": return "Repeater " + s.number;
    default: return s.kind;
  }
}

function amountOf(state, spot) {
  const s = spot.kind === "hop" ? normalizeHop(spot) : spot;
  const b = state.bets;
  switch (s.kind) {
    case "pass": return b.pass;
    case "passOdds": return b.passOdds;
    case "dontPass": return b.dontPass;
    case "dontPassOdds": return b.dontPassOdds;
    case "come": return b.come;
    case "dontCome": return b.dontCome;
    case "field": return b.field;
    case "any7": return b.any7;
    case "anyCraps": return b.anyCraps;
    case "ce": return b.ce;
    case "horn": return b.horn;
    case "small": return b.small;
    case "tall": return b.tall;
    case "all": return b.all;
    case "hardAllDay": return b.hardAllDay;
    case "place": return b.place[s.number] || 0;
    case "buy": return b.buy[s.number] || 0;
    case "hardway": return b.hardways[s.number] || 0;
    case "hop": return b.hops[s.pair] || 0;
    case "repeater": return b.repeaters[s.number] || 0;
    case "comeOdds": return (b.comeBets[s.number] && b.comeBets[s.number].odds) || 0;
    case "dontComeOdds": return (b.dontComeBets[s.number] && b.dontComeBets[s.number].odds) || 0;
    case "comePoint": return (b.comeBets[s.number] && b.comeBets[s.number].amount) || 0;
    case "dontComePoint": return (b.dontComeBets[s.number] && b.dontComeBets[s.number].amount) || 0;
    default: return 0;
  }
}

function addAmount(state, spot, delta) {
  const s = spot.kind === "hop" ? normalizeHop(spot) : spot;
  const b = state.bets;
  switch (s.kind) {
    case "pass": b.pass += delta; break;
    case "passOdds": b.passOdds += delta; break;
    case "dontPass": b.dontPass += delta; break;
    case "dontPassOdds": b.dontPassOdds += delta; break;
    case "come": b.come += delta; break;
    case "dontCome": b.dontCome += delta; break;
    case "field": b.field += delta; break;
    case "any7": b.any7 += delta; break;
    case "anyCraps": b.anyCraps += delta; break;
    case "ce": b.ce += delta; break;
    case "horn": b.horn += delta; break;
    case "small": b.small += delta; break;
    case "tall": b.tall += delta; break;
    case "all": b.all += delta; break;
    case "hardAllDay": b.hardAllDay += delta; break;
    case "place": b.place[s.number] += delta; break;
    case "buy": b.buy[s.number] += delta; break;
    case "hardway": b.hardways[s.number] += delta; break;
    case "hop": b.hops[s.pair] += delta; break;
    case "repeater": b.repeaters[s.number] += delta; break;
    case "comeOdds": b.comeBets[s.number].odds += delta; break;
    case "dontComeOdds": b.dontComeBets[s.number].odds += delta; break;
    default: break;
  }
}

function validate(state, spot, amount, removing) {
  const s = spot.kind === "hop" ? normalizeHop(spot) : spot;
  if (!Number.isFinite(amount) || amount <= 0) return "Bet amount must be positive.";
  if (!removing && amount > state.bankroll) return "Not enough practice chips for that bet.";
  const crapless = isCrapless(state);
  const comeOut = state.phase === "come-out";
  const kind = s.kind;

  if (kind === "fire" || kind === "fireBet") return "Fire Bet is not in Bubble Craps.";
  if (crapless && (kind === "dontPass" || kind === "dontPassOdds" || kind === "dontCome" || kind === "dontComeOdds" || kind === "dontComePoint")) {
    return "Don't bets are not offered in Crapless.";
  }
  if (kind === "pass") {
    if (!comeOut) return "Pass Line is bet on the come-out.";
  } else if (kind === "dontPass") {
    if (!comeOut) return "Don't Pass is bet on the come-out.";
  } else if (kind === "passOdds") {
    if (comeOut || !state.point) return "Odds are available once a point is on.";
    if (!state.bets.pass) return "Need a Pass Line bet before taking odds.";
    if (!removing && state.bets.passOdds + amount > maxPassOdds(state.bets.pass, state.point)) {
      return "Max odds are " + oddsMultiple(state.point) + "x (" + formatMoney(maxPassOdds(state.bets.pass, state.point)) + ").";
    }
  } else if (kind === "dontPassOdds") {
    if (comeOut || !state.point) return "Lay odds are available once a point is on.";
    if (!state.bets.dontPass) return "Need a Don't Pass bet before laying odds.";
    if (!removing && state.bets.dontPassOdds + amount > maxLayOdds(state.bets.dontPass)) {
      return "Max lay odds are 6x the Don't Pass bet.";
    }
  } else if (kind === "come") {
    if (comeOut) return "Come is bet while a point is on.";
  } else if (kind === "dontCome") {
    if (comeOut) return "Don't Come is bet while a point is on.";
  } else if (kind === "comeOdds") {
    const cb = state.bets.comeBets[s.number];
    if (!cb || !cb.amount) return "No Come bet on " + s.number + ".";
    if (!removing && cb.odds + amount > maxPassOdds(cb.amount, s.number)) {
      return "Max come odds are " + oddsMultiple(s.number) + "x.";
    }
  } else if (kind === "dontComeOdds") {
    const db = state.bets.dontComeBets[s.number];
    if (!db || !db.amount) return "No Don't Come bet on " + s.number + ".";
    if (!removing && db.odds + amount > maxLayOdds(db.amount)) return "Max lay odds are 6x.";
  } else if (kind === "place" || kind === "buy") {
    if (!numbersFor(state).includes(s.number)) return describeSpot(s) + " is not offered in this mode.";
  } else if (kind === "hardway") {
    if (!HARDWAYS.includes(s.number)) return "Invalid hardway.";
  } else if (kind === "hop") {
    if (!ALL_HOPS.includes(s.pair)) return "Unknown hop.";
  } else if (kind === "repeater") {
    if (!NUMBERS.includes(s.number)) return "Repeaters are 2–12 except 7.";
    if (!removing && (state.repeaterCount[s.number] || 0) > 0) {
      return "This Repeater already has progress. Take it down to change the stake.";
    }
  } else if (kind === "horn") {
    if (!removing && amount % 400 !== 0) return "Horn is posted in $4 units.";
  } else if (kind === "ce") {
    if (!removing && amount % 200 !== 0) return "C&E is posted in $2 units.";
  } else if (kind === "small" || kind === "tall" || kind === "all" || kind === "hardAllDay") {
    if (!removing && lampsLit(state, kind)) {
      return "This bet already has lamps lit. Take it down to change the stake.";
    }
  } else if (kind === "field" || kind === "any7" || kind === "anyCraps") {
    /* ok */
  } else {
    return "Unknown bet.";
  }

  if (!removing) {
    const next = amountOf(state, s) + amount;
    const min = spotMin(kind);
    const max = spotMax(kind);
    if (amountOf(state, s) === 0 && amount < min) {
      return "Minimum is " + formatMoney(min) + ".";
    }
    if (next > max) return "Maximum is " + formatMoney(max) + ".";
  }
  return null;
}

function lampsLit(state, kind) {
  const lamps = (state.progress && state.progress[kind]) || {};
  return Object.keys(lamps).some((key) => lamps[key]);
}

function setOriginal(state, spot) {
  const s = spot.kind === "hop" ? normalizeHop(spot) : spot;
  if (s.kind === "place" || s.kind === "buy") {
    state.originals[s.kind][s.number] = amountOf(state, s);
  }
}

function clearProgress(state, kind) {
  if (kind === "small" || kind === "tall" || kind === "all" || kind === "hardAllDay") {
    state.progress[kind] = {};
  }
  if (kind === "repeater") {
    /* caller passes number */
  }
}

export function placeBet(state, spot, amount, opts = {}) {
  const s = spot.kind === "hop" ? normalizeHop(spot) : { ...spot };
  const err = validate(state, s, amount, false);
  if (err && !(opts.bypassMin && err.startsWith("Minimum is"))) {
    return { ok: false, error: err, state };
  }
  const next = clone(state);
  const prior = amountOf(next, s);
  addAmount(next, s, amount);
  if (prior === 0 && (s.kind === "small" || s.kind === "tall" || s.kind === "all" || s.kind === "hardAllDay")) {
    next.progress[s.kind] = {};
  }
  if (s.kind === "repeater" && prior === 0) next.repeaterCount[s.number] = 0;
  if ((s.kind === "place" || s.kind === "buy") && !opts.keepOriginal) setOriginal(next, s);
  next.bankroll -= amount;
  if (next.bankroll < 0) next.bankroll = 0;
  return { ok: true, state: next };
}

const DONT_KINDS = new Set(["dontPass", "dontCome", "dontComePoint", "dontPassOdds"]);

export function removeBet(state, spot, amount, opts = {}) {
  const s = spot.kind === "hop" ? normalizeHop(spot) : { ...spot };
  if (s.kind === "pass" && state.phase !== "come-out") {
    return { ok: false, error: "Pass Line stays up until it wins or loses.", state };
  }
  if (s.kind === "comePoint") {
    return { ok: false, error: "A Come bet on a number stays until it wins or loses.", state };
  }
  const pointOn = state.phase === "point" && state.point;
  if (!opts.confirm && pointOn && (s.kind === "dontPass" || s.kind === "dontComePoint")) {
    const edge = s.kind === "dontPass" ? dontEdgeNote(state.point) : dontEdgeNote(s.number);
    return {
      ok: false,
      needsConfirm: true,
      warning: "Taking down your Don't bet gives up its edge. " + edge,
      state,
    };
  }
  const next = clone(state);
  const current = amountOf(next, s);
  if (current <= 0) return { ok: false, error: "No bet to take down.", state };
  let take = amount == null ? current : Math.min(amount, current);
  if (s.kind === "horn" && take !== current && take % 400 !== 0) {
    take = Math.floor(take / 400) * 400;
    if (!take) return { ok: false, error: "Horn comes down in $4 units.", state };
  }
  if (s.kind === "ce" && take !== current && take % 200 !== 0) {
    take = Math.floor(take / 200) * 200;
    if (!take) return { ok: false, error: "C&E comes down in $2 units.", state };
  }
  if (s.kind === "dontPass") {
    const odds = next.bets.dontPassOdds;
    const flatTake = take;
    next.bets.dontPass -= flatTake;
    next.bankroll += flatTake;
    if (next.bets.dontPass === 0 && odds) {
      next.bets.dontPassOdds = 0;
      next.bankroll += odds;
    } else if (next.bets.dontPass > 0 && odds > maxLayOdds(next.bets.dontPass)) {
      const back = odds - maxLayOdds(next.bets.dontPass);
      next.bets.dontPassOdds -= back;
      next.bankroll += back;
    }
    return { ok: true, state: next };
  }
  if (s.kind === "dontComePoint") {
    const slot = next.bets.dontComeBets[s.number];
    if (!slot) return { ok: false, error: "No bet to take down.", state };
    next.bankroll += slot.amount + (slot.odds || 0);
    delete next.bets.dontComeBets[s.number];
    return { ok: true, state: next };
  }
  addAmount(next, s, -take);
  if (s.kind === "small" || s.kind === "tall" || s.kind === "all" || s.kind === "hardAllDay") {
    next.progress[s.kind] = {};
  }
  if (s.kind === "repeater") next.repeaterCount[s.number] = 0;
  if (s.kind === "place" || s.kind === "buy") {
    setOriginal(next, s);
    if (amountOf(next, s) === 0 && next.billyMark && next.billyMark[s.kind]) next.billyMark[s.kind][s.number] = false;
    if (amountOf(next, s) === 0 && next.autoPress && next.autoPress.counts) {
      delete next.autoPress.counts[s.kind + ":" + s.number];
    }
  }
  next.bankroll += take;
  return { ok: true, state: next, kind: s.kind, dont: DONT_KINDS.has(s.kind) };
}

function dontEdgeNote(point) {
  if (point === 4 || point === 10) return "With the point on 4 or 10, Don't wins 2 times in 3 (+33.3% of the flat).";
  if (point === 5 || point === 9) return "With the point on 5 or 9, Don't is worth +20.0% of the flat.";
  if (point === 6 || point === 8) return "With the point on 6 or 8, Don't is worth +9.1% of the flat.";
  return "Once a point is on, the Don't is the favorite.";
}

export function setBetsOff(state, off) {
  const next = clone(state);
  next.betsOff = !!off;
  return next;
}

export function resetLayout(state) {
  const next = clone(state);
  next.bankroll += tableTotal(next);
  next.bets = emptyBets();
  next.originals = { place: emptyMap(NUMBERS, 0), buy: emptyMap(NUMBERS, 0) };
  next.progress = { small: {}, tall: {}, all: {}, hardAllDay: {} };
  next.repeaterCount = emptyMap(NUMBERS, 0);
  next.billyMark = { place: {}, buy: {} };
  next.pressStack = [];
  next.lastWin = null;
  next.pressBlock = "after a hit";
  next.betsOff = false;
  if (next.autoPress) next.autoPress = { mode: next.autoPress.mode || "off", max: next.autoPress.max || 3, counts: {} };
  return next;
}

export function resetBankroll(state) {
  const next = createGame({ mode: state.mode, bankroll: STARTING_BANKROLL });
  next.placeWorkingOnComeOut = state.placeWorkingOnComeOut;
  next.hardwaysWorkingOnComeOut = state.hardwaysWorkingOnComeOut;
  next.comeOddsOffOnComeOut = state.comeOddsOffOnComeOut;
  return next;
}

export function contractsWorking(state) {
  if (state.phase === "point" && state.point) return true;
  const b = state.bets;
  if (b.pass > 0 || b.dontPass > 0 || b.come > 0 || b.dontCome > 0) return true;
  const live = (map) => Object.keys(map || {}).some((key) => map[key] && map[key].amount > 0);
  return live(b.comeBets) || live(b.dontComeBets);
}

export function switchMode(state, mode) {
  if ((state.hand && state.hand.rolls > 0) || contractsWorking(state)) {
    return {
      ok: false,
      error: "Finish this hand first. A hand ends on a seven-out. (Or Reset bankroll to start fresh.)",
      state,
    };
  }
  const cleared = resetLayout(state);
  cleared.mode = mode === "crapless" ? "crapless" : "regular";
  cleared.phase = "come-out";
  cleared.point = null;
  cleared.hand = { rolls: 0, points: 0, lastLength: 0 };
  cleared.lastDice = null;
  cleared.lastDecisions = [];
  cleared.lastNarrative = "";
  return { ok: true, state: cleared };
}

function billysBuyNumbers(state) {
  const allowed = new Set(numbersFor(state));
  return BILLY_BUY.filter((n) => allowed.has(n));
}

export function billysWayAmounts(chipCents) {
  const buy = chipCents;
  const place = Math.floor((chipCents * 6) / 5);
  return { buy, place };
}

export function placeBillysWay(state, chipCents) {
  const { buy, place } = billysWayAmounts(chipCents);
  let next = state;
  const placed = [];
  const skipped = [];
  billysBuyNumbers(state).forEach((n) => {
    const res = placeBet(next, { kind: "buy", number: n }, buy, { bypassMin: true });
    if (res.ok) {
      next = res.state;
      placed.push({ kind: "buy", number: n, amount: buy });
    } else skipped.push({ kind: "buy", number: n, reason: res.error });
  });
  BILLY_PLACE.forEach((n) => {
    const res = placeBet(next, { kind: "place", number: n }, place, { bypassMin: true });
    if (res.ok) {
      next = res.state;
      placed.push({ kind: "place", number: n, amount: place });
    } else skipped.push({ kind: "place", number: n, reason: res.error });
  });
  next.billyMark = next.billyMark || { place: {}, buy: {} };
  placed.forEach((p) => {
    next.billyMark[p.kind][p.number] = true;
  });
  if (placed.length && next.autoPress) {
    const counts = { ...(next.autoPress.counts || {}) };
    placed.forEach((p) => { delete counts[p.kind + ":" + p.number]; });
    next.autoPress = { mode: next.autoPress.mode || "off", max: next.autoPress.max || 3, counts };
  }
  return { ok: placed.length > 0, state: next, placed, skipped, buy, place };
}

export function takeDownBillysWay(state) {
  let next = state;
  const mark = state.billyMark || { buy: {}, place: {} };
  const clearKind = (kind) => {
    Object.keys(mark[kind] || {}).forEach((key) => {
      if (!mark[kind][key]) return;
      const n = Number(key);
      const have = next.bets[kind][n] || 0;
      if (have > 0) {
        const res = removeBet(next, { kind, number: n });
        if (res.ok) next = res.state;
      }
    });
  };
  clearKind("buy");
  clearKind("place");
  return next;
}

function preferKind(number) {
  return number === 6 || number === 8 ? "place" : "buy";
}

function winRecord(decisions, betName) {
  return decisions.find((d) => d.result === "win" && d.bet === betName);
}

function setPressContext(state, total, decisions, working) {
  state.pressStack = [];
  state.lastWin = null;
  const nums = numbersFor(state);
  if (total === 7) {
    state.pressBlock = "seven";
    return;
  }
  if (!nums.includes(total)) {
    state.pressBlock = total + " isn't a number bet";
    return;
  }
  const buyStake = state.bets.buy[total] || 0;
  const placeStake = state.bets.place[total] || 0;
  if (!working) {
    if (buyStake || placeStake) state.pressBlock = state.phase === "come-out" ? "Off on come-out" : "bets off";
    else state.pressBlock = "no bet on " + total;
    return;
  }
  const preferred = preferKind(total);
  const order = preferred === "buy" ? ["buy", "place"] : ["place", "buy"];
  for (const kind of order) {
    const stake = kind === "buy" ? buyStake : placeStake;
    if (!stake) continue;
    const rec = winRecord(decisions, (kind === "buy" ? "Buy " : "Place ") + total);
    if (!rec) continue;
    state.lastWin = {
      kind,
      number: total,
      profit: rec.profit,
      powerUsed: false,
    };
    state.pressBlock = null;
    return;
  }
  state.pressBlock = "no bet on " + total;
}

/** Bill's POWER PRESS ladder, dollars in cents. Rev 12a. Standard table only. */
export const POWER_LADDERS = {
  "6/8": [600, 1800, 4200, 9000, 21000, 45000],
  "4/10": [500, 1500, 4000, 10000, 30000, 90000],
  "5/9": [500, 1500, 3600, 8600, 20000, 50000],
  "2/12": [500, 3500, 25000],
  "3/11": [500, 2000, 8000, 32000],
};

function ladderGroup(number) {
  if (number === 6 || number === 8) return "6/8";
  if (number === 4 || number === 10) return "4/10";
  if (number === 5 || number === 9) return "5/9";
  if (number === 2 || number === 12) return "2/12";
  if (number === 3 || number === 11) return "3/11";
  return "";
}

function ladderSteps(number) {
  return POWER_LADDERS[ladderGroup(number)] || [];
}

/** Buy from $40 on 4/10, from $36 on 5/9, and on every Crapless 2/3/11/12 step. 6/8 stays Place. */
function ladderKind(number, amount, fromKind) {
  const group = ladderGroup(number);
  if (group === "6/8") return fromKind === "buy" ? "buy" : "place";
  if (group === "4/10") return amount >= 4000 ? "buy" : fromKind;
  if (group === "5/9") return amount >= 3600 ? "buy" : fromKind;
  return "buy";
}

function onLadderStep(kind, number, stake) {
  const steps = ladderSteps(number);
  const i = steps.indexOf(stake);
  if (i < 0) return -1;
  const group = ladderGroup(number);
  if (group === "6/8" && kind !== "place") return -1;
  if ((group === "2/12" || group === "3/11") && kind !== "buy") return -1;
  if (group === "4/10" && stake >= 4000 && kind !== "buy") return -1;
  if (group === "5/9" && stake >= 3600 && kind !== "buy") return -1;
  return i;
}

function rangeUnitFor(kind, number) {
  if ((number === 6 || number === 8) && kind === "place") return 600;
  return 500;
}

function giveGetPhrase(debit, profit) {
  const delta = debit - profit;
  if (delta === 0) return "even";
  if (delta > 0) return "add " + formatMoney(delta);
  return "get " + formatMoney(-delta);
}

function setSpotAmount(state, kind, number, amount) {
  const cur = amountOf(state, { kind, number });
  addAmount(state, { kind, number }, amount - cur);
}

/**
 * Plan one POWER PRESS. `maxCents` defaults to the Standard $1,000 max.
 * Premium can pass a lower max to exercise the cap rule; the live table does not.
 */
export function powerPlan(state, opts) {
  const max = (opts && opts.maxCents) || TABLE_MAX;
  const lw = state.lastWin;
  const empty = { ok: false, reason: state.pressBlock || "after a hit" };
  if (!lw) return empty;
  const stake = amountOf(state, { kind: lw.kind, number: lw.number });
  if (!stake) return { ok: false, reason: "no bet on " + lw.number };
  if (lw.powerUsed) return { ok: false, reason: "used", label: "POWER PRESS · used" };
  const profit = lw.profit || 0;
  const fromKind = lw.kind;
  const number = lw.number;
  const steps = ladderSteps(number);
  const unit = pressUnit(fromKind, number);
  const idx = onLadderStep(fromKind, number, stake);

  const finish = (toAmount, toKind, mode) => {
    const debit = toAmount - stake;
    if (debit <= 0) return { ok: false, reason: "at table max" };
    const give = debit - profit;
    if (debit > state.bankroll) return { ok: false, reason: "not enough chips" };
    const phrase = giveGetPhrase(debit, profit);
    let label = "POWER PRESS " + number + " → " + (toKind !== fromKind ? "Buy " : "") + formatMoney(toAmount) + " (" + phrase + ")";
    if (mode === "max") label = "POWER PRESS " + number + " → " + formatMoney(toAmount) + " (max) · " + phrase;
    if (mode === "round" || mode === "round-capped") label = "POWER PRESS " + number + " +" + formatMoney(debit) + " (round-down)";
    return {
      ok: true,
      reason: null,
      label,
      debit,
      back: Math.max(0, profit - debit),
      give: Math.max(0, give),
      toAmount,
      toKind,
      fromKind,
      fromAmount: stake,
      number,
      capped: mode === "max" || mode === "round-capped",
      atMax: mode === "max" || toAmount >= max,
      mode: mode || "ladder",
    };
  };

  const capLand = (wantedKind) => {
    const unitKind = wantedKind || fromKind;
    const landed = Math.floor(max / pressUnit(unitKind, number)) * pressUnit(unitKind, number);
    if (landed <= stake) return { ok: false, reason: "at table max" };
    const kind = ladderKind(number, landed, fromKind);
    return finish(landed, kind === "buy" || unitKind === "buy" ? kind : unitKind, "max");
  };

  if (idx >= 0) {
    const next = steps[idx + 1];
    if (!next) return { ok: false, reason: "top of the ladder · collect" };
    const kind = ladderKind(number, next, fromKind);
    if (next > max) return capLand(kind);
    return finish(next, kind, "ladder");
  }

  const group = ladderGroup(number);
  const joinLadder = !!group && !(group === "6/8" && fromKind === "buy");
  if (joinLadder) {
    const ceiling = stake + profit + rangeUnitFor(fromKind, number);
    let best = 0;
    steps.forEach((s) => {
      if (s > stake && s <= ceiling && s <= max && s > best) best = s;
    });
    if (best) return finish(best, ladderKind(number, best, fromKind), "off");
    const higher = steps.some((s) => s > stake && s > max && s <= ceiling);
    if (higher) return capLand(ladderKind(number, max, fromKind));
  }

  let add = Math.floor(profit / unit) * unit;
  const room = max - stake;
  let capped = false;
  if (add > room) {
    add = Math.floor(Math.max(0, room) / unit) * unit;
    capped = true;
  }
  if (add > state.bankroll) add = Math.floor(state.bankroll / unit) * unit;
  if (add <= 0) {
    return { ok: false, reason: profit < 500 || profit < unit ? "win under $5" : "at table max" };
  }
  return finish(stake + add, fromKind, capped ? "round-capped" : "round");
}

export function pressStatus(state, opts) {
  const lw = state.lastWin;
  const base = {
    pressOk: false,
    powerOk: false,
    pressReason: state.pressBlock || "after a hit",
    powerReason: state.pressBlock || "after a hit",
    label: "PRESS",
    powerLabel: "POWER PRESS",
  };
  if (!lw) return base;
  const stake = amountOf(state, { kind: lw.kind, number: lw.number });
  const original = state.originals[lw.kind][lw.number] || stake;
  const unit = pressUnit(lw.kind, lw.number);
  base.original = original;
  base.unit = unit;
  base.stake = stake;
  base.number = lw.number;
  base.kind = lw.kind;
  if (!stake) {
    base.pressReason = "no bet on " + lw.number;
    base.powerReason = "no bet on " + lw.number;
    return base;
  }
  const max = (opts && opts.maxCents) || TABLE_MAX;
  const nextPress = stake + original;
  if (original <= 0 || original > state.bankroll) {
    base.pressReason = "not enough chips";
  } else if (nextPress > max) {
    base.pressReason = "at table max";
  } else {
    base.pressOk = true;
    base.pressReason = null;
    base.label = "PRESS " + lw.number + " +" + formatMoney(original) + " → " + formatMoney(nextPress);
  }
  const plan = powerPlan(state, opts);
  base.powerAdd = plan.debit || 0;
  base.powerBack = plan.back || 0;
  base.powerGive = plan.give || 0;
  base.powerTo = plan.toAmount || 0;
  base.powerKind = plan.toKind || lw.kind;
  base.powerMode = plan.mode || "";
  base.capped = !!plan.capped;
  base.atMax = !!plan.atMax;
  if (plan.ok) {
    base.powerOk = true;
    base.powerReason = null;
    base.powerLabel = plan.label;
  } else {
    base.powerReason = plan.reason || "after a hit";
    base.powerLabel = plan.label || "POWER PRESS";
  }
  return base;
}

function applyPressAdd(state, kind, number, add, type) {
  addAmount(state, { kind, number }, add);
  state.bankroll -= add;
  if (state.bankroll < 0) state.bankroll = 0;
  state.pressStack.push({ kind, number, amount: add, type });
}

export function press(state) {
  const st = pressStatus(state);
  if (!st.pressOk) return { ok: false, error: st.pressReason || "Can't press", state };
  const next = clone(state);
  applyPressAdd(next, st.kind, st.number, st.original, "press");
  return { ok: true, state: next, label: pressStatus(next).label, added: st.original };
}

export function powerPress(state, opts) {
  const plan = powerPlan(state, opts);
  if (!plan.ok) return { ok: false, error: plan.reason || "Can't power press", state };
  const next = clone(state);
  const fromKind = plan.fromKind;
  const toKind = plan.toKind;
  setSpotAmount(next, fromKind, plan.number, 0);
  setSpotAmount(next, toKind, plan.number, plan.toAmount);
  next.bankroll -= plan.debit;
  if (next.bankroll < 0) next.bankroll = 0;
  next.pressStack.push({
    type: "power",
    kind: toKind,
    number: plan.number,
    amount: plan.debit,
    fromKind,
    fromAmount: plan.fromAmount,
    toKind,
    toAmount: plan.toAmount,
    converted: fromKind !== toKind,
  });
  next.lastWin.powerUsed = true;
  if (toKind !== fromKind) next.lastWin.kind = toKind;
  return {
    ok: true,
    state: next,
    added: plan.debit,
    back: plan.back,
    give: plan.give,
    capped: plan.capped,
    atMax: plan.atMax,
    toAmount: plan.toAmount,
    toKind,
    label: plan.label,
  };
}

export function undoPress(state) {
  if (!state.pressStack.length) return { ok: false, error: "Nothing to undo.", state };
  const next = clone(state);
  const last = next.pressStack.pop();
  if (last.toAmount != null && last.fromAmount != null && last.fromKind) {
    setSpotAmount(next, last.toKind || last.kind, last.number, 0);
    setSpotAmount(next, last.fromKind, last.number, last.fromAmount);
    next.bankroll += last.amount;
    if (next.lastWin) {
      next.lastWin.kind = last.fromKind;
      next.lastWin.powerUsed = false;
    }
  } else {
    addAmount(next, { kind: last.kind, number: last.number }, -last.amount);
    next.bankroll += last.amount;
    if (last.type === "power" && next.lastWin) next.lastWin.powerUsed = false;
  }
  return { ok: true, state: next };
}

export function clearPress(state) {
  let next = state;
  if (!state.pressStack.length) return { ok: false, error: "Nothing to clear.", state };
  while (next.pressStack.length) {
    const res = undoPress(next);
    if (!res.ok) break;
    next = res.state;
  }
  return { ok: true, state: next };
}

function pushDecision(decisions, bet, result, stake, profit, extra) {
  const net = result === "win" ? profit : result === "lose" ? -stake : 0;
  decisions.push({ bet, result, stake, profit: profit || 0, net, ...(extra || {}) });
}

function payStay(state, decisions, bet, stake, profit, extra) {
  state.bankroll += profit;
  pushDecision(decisions, bet, "win", stake, profit, extra);
}

function loseDown(state, decisions, bet, stake, clear) {
  clear();
  pushDecision(decisions, bet, "lose", stake, 0);
}

function placeWorking(state) {
  if (state.betsOff) return false;
  if (state.phase === "come-out" && !state.placeWorkingOnComeOut) return false;
  return true;
}

function moneyMap(map) {
  return Object.keys(map || {}).some((key) => {
    const v = map[key];
    if (typeof v === "number") return v > 0;
    return !!(v && ((v.amount || 0) > 0 || (v.odds || 0) > 0));
  });
}

/** True when at least one bet would settle on this roll. Parked Place/Buy do not count. */
export function hadWorkingBet(state) {
  const b = state.bets || {};
  if (b.pass > 0 || b.passOdds > 0 || b.dontPass > 0 || b.dontPassOdds > 0) return true;
  if (b.come > 0 || b.dontCome > 0) return true;
  if (b.field > 0 || b.any7 > 0 || b.anyCraps > 0 || b.ce > 0 || b.horn > 0) return true;
  if (b.small > 0 || b.tall > 0 || b.all > 0 || b.hardAllDay > 0) return true;
  if (moneyMap(b.comeBets) || moneyMap(b.dontComeBets)) return true;
  if (moneyMap(b.hops) || moneyMap(b.repeaters)) return true;
  if (hardwaysWorking(state) && moneyMap(b.hardways)) return true;
  if (placeWorking(state) && (moneyMap(b.place) || moneyMap(b.buy))) return true;
  return false;
}

function hardwaysWorking(state) {
  if (state.phase === "come-out" && !state.hardwaysWorkingOnComeOut) return false;
  return true;
}

function comeOddsWorking(state, comeOutSnapshot) {
  return !comeOutSnapshot || !state.comeOddsOffOnComeOut;
}

function settleOneRoll(state, d1, d2, decisions) {
  const total = d1 + d2;
  const b = state.bets;
  if (b.any7) {
    if (total === 7) payStay(state, decisions, "Big Red", b.any7, b.any7 * 4);
    else loseDown(state, decisions, "Big Red", b.any7, () => { b.any7 = 0; });
  }
  if (b.anyCraps) {
    if (total === 2 || total === 3 || total === 12) payStay(state, decisions, "Any Craps", b.anyCraps, b.anyCraps * 7);
    else loseDown(state, decisions, "Any Craps", b.anyCraps, () => { b.anyCraps = 0; });
  }
  if (b.ce) {
    // Split bet: half on Any Craps at 7 to 1, half on 11 at 15 to 1.
    // Net on the whole stake is 3 to 1 (craps) and 7 to 1 (11).
    if (total === 2 || total === 3 || total === 12) payStay(state, decisions, "C&E", b.ce, b.ce * 3);
    else if (total === 11) payStay(state, decisions, "C&E", b.ce, b.ce * 7);
    else loseDown(state, decisions, "C&E", b.ce, () => { b.ce = 0; });
  }
  if (b.horn) {
    const unit = b.horn / 4;
    let mult = 0;
    if (total === 2 || total === 12) mult = 30;
    else if (total === 3 || total === 11) mult = 15;
    if (mult) payStay(state, decisions, "Horn", b.horn, unit * mult - unit * 3);
    else loseDown(state, decisions, "Horn", b.horn, () => { b.horn = 0; });
  }
  const pair = rollPairKey(d1, d2);
  ALL_HOPS.forEach((key) => {
    const stake = b.hops[key];
    if (!stake) return;
    if (key === pair) payStay(state, decisions, "Hop " + key, stake, stake * hopPayTo1(key));
    else loseDown(state, decisions, "Hop " + key, stake, () => { b.hops[key] = 0; });
  });
  if (b.field) {
    const fp = fieldProfit(b.field, total);
    if (fp > 0) payStay(state, decisions, "Field", b.field, fp);
    else loseDown(state, decisions, "Field", b.field, () => { b.field = 0; });
  }
}

function settleHardways(state, d1, d2, decisions) {
  if (!hardwaysWorking(state)) return;
  const total = d1 + d2;
  const hard = d1 === d2;
  HARDWAYS.forEach((n) => {
    const stake = state.bets.hardways[n];
    if (!stake) return;
    if (total === 7 || (total === n && !hard)) {
      loseDown(state, decisions, "Hard " + n, stake, () => { state.bets.hardways[n] = 0; });
    } else if (total === n && hard) {
      payStay(state, decisions, "Hard " + n, stake, hardwayProfit(stake, n));
    }
  });
}

function bonusSet(kind) {
  if (kind === "small") return SMALL;
  if (kind === "tall") return TALL;
  if (kind === "all") return ALLSET;
  return HARDWAYS;
}

function settleBonus(state, d1, d2, decisions) {
  const total = d1 + d2;
  const hard = d1 === d2;
  ["small", "tall", "all"].forEach((kind) => {
    const stake = state.bets[kind];
    if (!stake) return;
    const label = describeSpot({ kind });
    if (total === 7) {
      state.bets[kind] = 0;
      state.progress[kind] = {};
      pushDecision(decisions, label, "lose", stake, 0);
      return;
    }
    const set = bonusSet(kind);
    if (set.includes(total)) state.progress[kind][total] = true;
    if (set.every((n) => state.progress[kind][n])) {
      const profit = stake * (BONUS_FOR[kind] - 1);
      state.bankroll += profit;
      state.progress[kind] = {};
      pushDecision(decisions, label, "win", stake, profit, { rearmed: true });
    }
  });
  const hw = state.bets.hardAllDay;
  if (hw) {
    if (total === 7) {
      state.bets.hardAllDay = 0;
      state.progress.hardAllDay = {};
      pushDecision(decisions, "Hard Way All Day", "lose", hw, 0);
    } else {
      if (hard && HARDWAYS.includes(total)) state.progress.hardAllDay[total] = true;
      if (HARDWAYS.every((n) => state.progress.hardAllDay[n])) {
        const profit = hw * (BONUS_FOR.hardAllDay - 1);
        state.bankroll += profit;
        state.progress.hardAllDay = {};
        pushDecision(decisions, "Hard Way All Day", "win", hw, profit, { rearmed: true });
      }
    }
  }
}

function settleRepeaters(state, total, decisions) {
  NUMBERS.forEach((n) => {
    const stake = state.bets.repeaters[n];
    if (!stake) return;
    if (total === 7) {
      const had = state.repeaterCount[n] || 0;
      state.bets.repeaters[n] = 0;
      state.repeaterCount[n] = 0;
      pushDecision(decisions, "Repeater " + n, "lose", stake, 0, { had, needs: REPEATER_NEEDS[n] });
      return;
    }
    if (total === n) {
      state.repeaterCount[n] = (state.repeaterCount[n] || 0) + 1;
      if (state.repeaterCount[n] >= REPEATER_NEEDS[n]) {
        const profit = stake * (REPEATER_FOR[n] - 1);
        state.bankroll += profit;
        state.repeaterCount[n] = 0;
        pushDecision(decisions, "Repeater " + n, "win", stake, profit, { rearmed: true });
      }
    }
  });
}

function settlePlaceBuy(state, total, decisions, working) {
  if (!working) return;
  if (total === 7) {
    NUMBERS.forEach((n) => {
      const p = state.bets.place[n];
      if (p) {
        state.bets.place[n] = 0;
        state.originals.place[n] = 0;
        if (state.billyMark) state.billyMark.place[n] = false;
        pushDecision(decisions, "Place " + n, "lose", p, 0);
      }
      const buy = state.bets.buy[n];
      if (buy) {
        state.bets.buy[n] = 0;
        state.originals.buy[n] = 0;
        if (state.billyMark) state.billyMark.buy[n] = false;
        pushDecision(decisions, "Buy " + n, "lose", buy, 0);
      }
    });
    return;
  }
  if (state.bets.place[total]) {
    const stake = state.bets.place[total];
    payStay(state, decisions, "Place " + total, stake, placeProfit(stake, total));
  }
  if (state.bets.buy[total]) {
    const stake = state.bets.buy[total];
    const vig = buyVig(stake);
    const profit = buyProfit(stake, total);
    payStay(state, decisions, "Buy " + total, stake, profit, { vig });
  }
}

function ensureCome(map, number) {
  if (!map[number]) map[number] = { amount: 0, odds: 0 };
  return map[number];
}

function settleComeContracts(state, total, decisions, comeOutSnapshot) {
  const oddsOn = comeOddsWorking(state, comeOutSnapshot);
  if (total === 7) {
    Object.keys(state.bets.comeBets).forEach((key) => {
      const slot = state.bets.comeBets[key];
      if (!slot || !slot.amount) return;
      const loseOdds = oddsOn ? slot.odds : 0;
      if (!oddsOn && slot.odds) state.bankroll += slot.odds;
      pushDecision(decisions, "Come " + key, "lose", slot.amount + loseOdds, 0);
    });
    state.bets.comeBets = {};
    Object.keys(state.bets.dontComeBets).forEach((key) => {
      const slot = state.bets.dontComeBets[key];
      if (!slot || !slot.amount) return;
      const oddsStake = oddsOn ? slot.odds : 0;
      const parked = oddsOn ? 0 : slot.odds;
      const oProfit = layOddsProfit(oddsStake, Number(key));
      state.bankroll += slot.amount * 2 + oddsStake + oProfit + parked;
      pushDecision(decisions, "Don't Come " + key, "win", slot.amount + oddsStake, slot.amount + oProfit);
    });
    state.bets.dontComeBets = {};
    return;
  }
  const slot = state.bets.comeBets[total];
  if (slot && slot.amount) {
    const oddsStake = oddsOn ? slot.odds : 0;
    const parked = oddsOn ? 0 : slot.odds;
    const oProfit = passOddsProfit(oddsStake, total);
    state.bankroll += slot.amount * 2 + oddsStake + oProfit + parked;
    pushDecision(decisions, "Come " + total, "win", slot.amount + oddsStake, slot.amount + oProfit);
    delete state.bets.comeBets[total];
  }
  const dslot = state.bets.dontComeBets[total];
  if (dslot && dslot.amount) {
    const loseOdds = oddsOn ? dslot.odds : 0;
    if (!oddsOn && dslot.odds) state.bankroll += dslot.odds;
    pushDecision(decisions, "Don't Come " + total, "lose", dslot.amount + loseOdds, 0);
    delete state.bets.dontComeBets[total];
  }
}

function settleNewCome(state, total, decisions) {
  const crapless = isCrapless(state);
  if (state.bets.come) {
    const amt = state.bets.come;
    const win = crapless ? total === 7 : total === 7 || total === 11;
    const lose = !crapless && (total === 2 || total === 3 || total === 12);
    if (win) {
      state.bankroll += amt * 2;
      state.bets.come = 0;
      pushDecision(decisions, "Come", "win", amt, amt);
    } else if (lose) {
      state.bets.come = 0;
      pushDecision(decisions, "Come", "lose", amt, 0);
    } else {
      state.bets.come = 0;
      const slot = ensureCome(state.bets.comeBets, total);
      slot.amount += amt;
      pushDecision(decisions, "Come", "move", amt, 0, { number: total });
    }
  }
  if (state.bets.dontCome) {
    const amt = state.bets.dontCome;
    if (crapless) {
      state.bankroll += amt;
      state.bets.dontCome = 0;
      pushDecision(decisions, "Don't Come", "push", amt, 0);
      return;
    }
    if (total === 2 || total === 3) {
      state.bankroll += amt * 2;
      state.bets.dontCome = 0;
      pushDecision(decisions, "Don't Come", "win", amt, amt);
    } else if (total === 7 || total === 11) {
      state.bets.dontCome = 0;
      pushDecision(decisions, "Don't Come", "lose", amt, 0);
    } else if (total === 12) {
      pushDecision(decisions, "Don't Come", "push", amt, 0);
    } else {
      state.bets.dontCome = 0;
      const slot = ensureCome(state.bets.dontComeBets, total);
      slot.amount += amt;
      pushDecision(decisions, "Don't Come", "move", amt, 0, { number: total });
    }
  }
}

function settleLine(state, total, decisions, comeOut, point) {
  const crapless = isCrapless(state);
  let result = "no-decision";
  let narrative = "";
  if (comeOut) {
    const passWin = total === 7 || (!crapless && total === 11);
    const passLose = !crapless && (total === 2 || total === 3 || total === 12);
    if (passWin) {
      if (state.bets.pass) payStay(state, decisions, "Pass Line", state.bets.pass, state.bets.pass);
      if (state.bets.dontPass) {
        loseDown(state, decisions, "Don't Pass", state.bets.dontPass, () => {
          state.bets.dontPass = 0;
          state.bets.dontPassOdds = 0;
        });
      }
      result = "natural";
      narrative = crapless ? "Come-out 7. Pass wins." : "Come-out " + total + ". Pass wins.";
    } else if (passLose) {
      if (state.bets.pass) {
        loseDown(state, decisions, "Pass Line", state.bets.pass, () => { state.bets.pass = 0; });
      }
      if (state.bets.dontPass) {
        if (total === 12) pushDecision(decisions, "Don't Pass", "push", state.bets.dontPass, 0);
        else payStay(state, decisions, "Don't Pass", state.bets.dontPass, state.bets.dontPass);
      }
      result = "craps";
      narrative = "Craps " + total + ". Pass loses." + (total === 12 ? " Don't Pass bars 12." : "");
    } else {
      state.phase = "point";
      state.point = total;
      result = "point-set";
      narrative = "Point is " + total + ".";
    }
  } else if (total === 7) {
    if (state.bets.pass || state.bets.passOdds) {
      const stake = state.bets.pass + state.bets.passOdds;
      state.bets.pass = 0;
      state.bets.passOdds = 0;
      if (stake) pushDecision(decisions, "Pass Line", "lose", stake, 0);
    }
    if (state.bets.dontPass) {
      const odds = state.bets.dontPassOdds;
      const oProfit = layOddsProfit(odds, point);
      state.bankroll += state.bets.dontPass + oProfit + odds;
      pushDecision(decisions, "Don't Pass", "win", state.bets.dontPass + odds, state.bets.dontPass + oProfit);
      state.bets.dontPassOdds = 0;
    }
    state.phase = "come-out";
    state.point = null;
    result = "seven-out";
    narrative = "Seven-out.";
  } else if (total === point) {
    if (state.bets.pass) {
      const odds = state.bets.passOdds;
      const oProfit = passOddsProfit(odds, point);
      state.bankroll += state.bets.pass + oProfit + odds;
      pushDecision(decisions, "Pass Line", "win", state.bets.pass + odds, state.bets.pass + oProfit);
      state.bets.passOdds = 0;
    }
    if (state.bets.dontPass || state.bets.dontPassOdds) {
      const stake = state.bets.dontPass + state.bets.dontPassOdds;
      state.bets.dontPass = 0;
      state.bets.dontPassOdds = 0;
      if (stake) pushDecision(decisions, "Don't Pass", "lose", stake, 0);
    }
    state.phase = "come-out";
    state.point = null;
    result = "point-made";
    narrative = "Point " + total + " hit. Pass wins.";
  } else {
    narrative = total + " rolled. Point stays " + point + ".";
  }
  return { result, narrative };
}

export function settle(state, d1, d2) {
  if (!(d1 >= 1 && d1 <= 6 && d2 >= 1 && d2 <= 6)) {
    return { ok: false, error: "Dice must be 1–6.", state };
  }
  const next = clone(state);
  const total = d1 + d2;
  const hard = d1 === d2;
  const comeOut = next.phase === "come-out";
  const point = next.point;
  const decisions = [];
  const working = placeWorking(next);

  next.stats.rolls += 1;
  next.lastDice = rollCaption(d1, d2);
  next.lastDice.source = getRngSource();
  settleOneRoll(next, d1, d2, decisions);
  settleHardways(next, d1, d2, decisions);
  settleBonus(next, d1, d2, decisions);
  settleRepeaters(next, total, decisions);
  settlePlaceBuy(next, total, decisions, working);
  settleComeContracts(next, total, decisions, comeOut);
  settleNewCome(next, total, decisions);
  const line = settleLine(next, total, decisions, comeOut, point);
  next.history.unshift({ d1, d2, total, hard, result: line.result });
  if (next.history.length > 20) next.history.length = 20;

  const sevenOut = line.result === "seven-out";
  if (sevenOut) {
    next.hand.lastLength = next.hand.rolls + 1;
    next.hand.rolls = 0;
    next.hand.points = 0;
    if (next.autoPress) next.autoPress = { mode: next.autoPress.mode || "off", max: next.autoPress.max || 3, counts: {} };
  } else {
    next.hand.rolls += 1;
    if (line.result === "point-made") next.hand.points += 1;
  }

  setPressContext(next, total, decisions, working);
  decisions.forEach((d) => {
    if (d.result === "win") next.stats.wins += 1;
    else if (d.result === "lose") next.stats.losses += 1;
  });
  const net = decisions.reduce((s, d) => s + (d.net || 0), 0);
  next.lastDecisions = decisions;
  next.lastNarrative = line.narrative;
  if (next.bankroll < 0) next.bankroll = 0;

  return {
    ok: true,
    state: next,
    decisions,
    narrative: line.narrative,
    result: line.result,
    dice: next.lastDice,
    net,
    tier: blazingTier(blazingScore(next.hand), next.hand.points),
    score: blazingScore(next.hand),
  };
}

export function edgeFor(spot, mode) {
  const s = spot.kind === "hop" ? normalizeHop(spot) : spot;
  const table = {
    pass: mode === "crapless" ? 5.38 : 1.41,
    passOdds: 0,
    dontPass: 1.4,
    dontPassOdds: 0,
    come: mode === "crapless" ? 5.38 : 1.41,
    dontCome: 1.4,
    comeOdds: 0,
    dontComeOdds: 0,
    field: 5.56,
    any7: 16.67,
    anyCraps: 11.11,
    ce: 11.11,
    horn: 12.5,
    small: 18.3,
    tall: 18.3,
    all: 17.98,
    hardAllDay: 21.43,
  };
  if (s.kind in table) return table[s.kind];
  if (s.kind === "hardway") return s.number === 6 || s.number === 8 ? 9.09 : 11.11;
  if (s.kind === "hop") return hopEdge(s.pair);
  if (s.kind === "repeater") return REPEATER_EDGE[s.number];
  if (s.kind === "place") {
    if (s.number === 6 || s.number === 8) return 1.52;
    if (s.number === 5 || s.number === 9) return 4;
    if (s.number === 4 || s.number === 10) return 6.67;
    if (s.number === 3 || s.number === 11) return 6.25;
    return 7.14;
  }
  if (s.kind === "buy") {
    if (s.number === 6 || s.number === 8) return 2.27;
    if (s.number === 5 || s.number === 9) return 2;
    if (s.number === 4 || s.number === 10) return 1.67;
    if (s.number === 3 || s.number === 11) return 1.25;
    return 0.71;
  }
  return null;
}

export function edgeClass(edge) {
  if (edge == null) return "";
  if (edge <= 2) return "edge-good";
  if (edge <= 5) return "edge-mid";
  return "edge-bad";
}

function fieldPayTo(pay) {
  return pay === 3 ? 3 : 2;
}

function fieldPayWord(pay) {
  return fieldPayTo(pay) === 3 ? "TRIPLE" : "DOUBLE";
}

function fieldPayOdds(pay) {
  return fieldPayTo(pay) === 3 ? "3 to 1" : "2 to 1";
}

/** Felt line, rings, and screen-reader label for the active Field pays. */
export function fieldPresentation(pay2, pay12) {
  const a = fieldPayTo(pay2);
  const b = fieldPayTo(pay12);
  let felt;
  if (a === 2 && b === 2) felt = "2 AND 12 PAY DOUBLE";
  else if (a === 3 && b === 3) felt = "2 AND 12 PAY TRIPLE";
  else felt = "2 PAYS " + fieldPayWord(a) + " · 12 PAYS " + fieldPayWord(b);
  let aria = "Field: 2, 3, 4, 9, 10, 11, 12; ";
  if (a === b) aria += "2 and 12 pay " + fieldPayOdds(a);
  else aria += "2 pays " + fieldPayOdds(a) + ", 12 pays " + fieldPayOdds(b);
  return {
    felt,
    aria,
    ring2: a === 3 ? "triple" : "single",
    ring12: b === 3 ? "triple" : "single",
  };
}

/** Props that win on fewer than 1 in 6 decisions. Line, odds, Come, and Place/Buy never qualify. */
export function isLongShot(spot) {
  const kind = spot && spot.kind;
  if (!kind) return false;
  if (kind === "pass" || kind === "passOdds" || kind === "dontPass" || kind === "dontPassOdds" ||
      kind === "come" || kind === "comeOdds" || kind === "dontCome" || kind === "dontComeOdds" ||
      kind === "place" || kind === "buy" || kind === "field") return false;
  if (kind === "any7" || kind === "ce" || kind === "horn") return false;
  return kind === "anyCraps" || kind === "hop" || kind === "hardway" || kind === "small" ||
    kind === "tall" || kind === "all" || kind === "hardAllDay" || kind === "repeater";
}

function tutorChance(spot) {
  if (spot.kind === "any7" || spot.kind === "ce" || spot.kind === "horn") return "Wins 6 of 36";
  if (spot.kind === "anyCraps") return "Wins 4 of 36";
  if (spot.kind === "hop") return "Wins 1 or 2 of 36";
  if (spot.kind === "hardway") return spot.number === 6 || spot.number === 8 ? "About 1 in 11" : "About 1 in 9";
  if (spot.kind === "small" || spot.kind === "tall") return "About 1 in 38";
  if (spot.kind === "all") return "About 1 try in 190";
  if (spot.kind === "hardAllDay") return "About 1 in 210";
  if (spot.kind === "repeater") return "About 1 in 31 to 1 in 81";
  return "";
}

function tutorPay(spot) {
  if (spot.kind === "any7") return "Pays 4 to 1";
  if (spot.kind === "anyCraps") return "Pays 7 to 1";
  if (spot.kind === "ce") return "Pays 3 to 1 on craps and 7 to 1 on 11";
  if (spot.kind === "horn") return "Pays 30 to 1 and 15 to 1";
  if (spot.kind === "hop") return "Pays 15 to 1 easy and 30 to 1 hard";
  if (spot.kind === "hardway") return spot.number === 6 || spot.number === 8 ? "Pays 9 to 1" : "Pays 7 to 1";
  if (spot.kind === "small" || spot.kind === "tall") return "Pays 31 for 1";
  if (spot.kind === "all") return "Pays 156 for 1";
  if (spot.kind === "hardAllDay") return "Pays 165 for 1";
  if (spot.kind === "repeater") return "Pays the repeater table";
  return "";
}

/**
 * Tutor line for a tapped bet. Empty means no edge warning.
 * Field has its own line. "Long shot" is only a prop under about 1 in 6.
 * "High house edge" starts at 9%.
 */
export function tutorEdgeNote(spot, mode, experienced) {
  if (!spot) return "";
  if (spot.kind === "field") {
    return "Field: wins on 16 of 36 rolls, but the 5–8 numbers lose. 5.56% edge.";
  }
  const edge = edgeFor(spot, mode);
  const longShot = isLongShot(spot);
  const high = edge != null && edge >= 9;
  if (!longShot && !high) return "";
  let line = longShot && high
    ? "Long shot with a high house edge."
    : longShot ? "Long shot." : "High house edge.";
  if (experienced) {
    const bits = [];
    if (edge != null) bits.push(edge + "% edge");
    const chance = tutorChance(spot);
    if (chance) bits.push(chance);
    const pay = tutorPay(spot);
    if (pay) bits.push(pay);
    if (bits.length) line += " " + bits.join(". ") + ".";
  }
  return line;
}

export const EDGES = {
  place68: 1.52,
  buy410: 1.67,
  buy59: 2,
  buy68: 2.27,
  buy212: 0.71,
  buy311: 1.25,
  place410: 6.67,
  place59: 4,
  place212: 7.14,
  place311: 6.25,
  field: 5.56,
  hwad: 21.43,
  passRegular: 1.41,
  passCrapless: 5.38,
  passOdds345: 0.37,
  craplessOdds: 1.26,
  dontLay: 0.27,
  billyRegular: 1.71,
  billyCrapless: 1.43,
};
