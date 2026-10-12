/**
 * Billy Bubs Table Craps. Reuses the shared engine, rail, dice, celebration
 * and strategies. Does not import the Bubble UI.
 */
import * as E from "./engine.mjs";
import * as TR from "./table-rules.mjs";
import * as Rail from "./rail.mjs";
import * as TS from "./table-strategies.mjs";
import * as R from "./replay.mjs";
import * as Et from "./etiquette.mjs";
import * as PC from "./point-celebration.mjs";
import * as PT from "./point-tier.mjs";
import { SETS, orient, cssMatrix } from "./tc-dice.mjs";
import { resolveSwipe } from "./swipe.mjs";
import * as Badges from "./badges.mjs";

const A = "../assets/";
const STORE = "bb-table-craps-v1";
const PREM = "bb-table-premium";
const app = document.getElementById("app");
const reducedMQ = matchMedia("(prefers-reduced-motion: reduce)");

const settings = {
  chip: 500,
  theme: "billy",
  colorUp: "offer",
  sound: true,
  tutor: true,
  numbet: "place",
  premium: false,
  set: "3V",
};

let game = E.createGame({ profile: "table" });
let rail = Rail.railBreakdown(game.bankroll);
let rebuilt = 0;
let page = 1;
let screen = "play";
let rolling = false;
let offer = null;
let convert = null;
let tutorId = "T1";
let tutorStep = 0;
let changeNote = "";
let toastText = "";
let strategyId = "";
let compareRun = null;
let filter = "all";
let menu = false;

function money(c) { return E.formatMoney(c); }
function premiumOn() { return settings.premium || localStorage.getItem(PREM) === "1"; }
function save() {
  localStorage.setItem(STORE, JSON.stringify({ game, rail, settings, rebuilt }));
}
function load() {
  settings.premium = localStorage.getItem(PREM) === "1";
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!raw || !raw.game) return;
    game = raw.game;
    E.tableTotal(game);
    if (raw.settings) Object.assign(settings, raw.settings);
    if (raw.rail && Rail.railMatches(raw.rail, game.bankroll)) rail = raw.rail;
    else {
      rail = Rail.railBreakdown(game.bankroll);
      rebuilt += 1;
    }
  } catch {
    rail = Rail.railBreakdown(game.bankroll);
  }
}

function sync(note) {
  const moved = Rail.syncRail(rail, game.bankroll);
  rail = moved.rail;
  if (moved.breaks && moved.breaks.length) {
    changeNote = moved.breaks.map((b) => b.label).join(" · ");
    if (!localStorage.getItem("bb-table-change-seen")) {
      toastText = "Here's your change.";
      localStorage.setItem("bb-table-change-seen", "1");
    }
  }
  if (note) changeNote = note;
  save();
}

function chipImg(cents) {
  const file = { 100: "1", 500: "5", 2500: "25", 10000: "100", 50000: "500" }[cents] || "5";
  return A + "chips/chip-" + file + "-value.svg";
}

function betHTML(amt, tag) {
  if (!amt) return "";
  return "<span class='bet'>" + "<img src='" + chipImg(amt >= 50000 ? 50000 : amt >= 10000 ? 10000 : amt >= 2500 ? 2500 : amt >= 500 ? 500 : 100) + "' alt=''>" +
    "<span class='amt'>" + (tag ? "<i>" + tag + "</i>" : "") + money(amt) + "</span></span>";
}

function feltHTML() {
  const b = game.bets;
  const pres = E.fieldPresentation((game.rules && game.rules.field2) || 2, (game.rules && game.rules.field12) || 2);
  const num = (n) => {
    const pt = game.point === n;
    const lay = (b.lay && b.lay[n]) || 0;
    const buy = b.buy[n] || 0;
    const place = b.place[n] || 0;
    const come = (b.comeBets[n] && b.comeBets[n].amount) || 0;
    const pay = n === 6 || n === 8 ? "7:6" : n === 5 || n === 9 ? "7:5" : "9:5";
    return "<button class='spot numbox" + (pt ? " point" : "") + "' data-act='num' data-n='" + n + "' aria-label='" + n + "'>" +
      "<span class='half lay'>" + (lay ? "<span class='amt'><i>L</i>" + money(lay) + "</span>" : "LAY") + "</span>" +
      "<span class='half buy'>" + (buy ? "<span class='amt'><i>B</i>" + money(buy) + "</span>" : "BUY") + "</span>" +
      "<span class='face'><span class='d'>" + n + "</span>" + (come ? "<span class='amt'><i>C</i>" + money(come) + "</span>" : "") +
      (pt ? "<img class='puck' data-puck src='" + A + "icons/puck-on.svg' alt=''>" : "") + "</span>" +
      "<span class='half place'>" + (place ? "<span class='amt'><i>P</i>" + money(place) + "</span>" : pay) + "</span></button>";
  };
  const hop = (a, b, id, pay, amt) => "<button class='spot' data-act='spot' data-kind='" + id + "'><span class='pd'><img src='" + A + "dice/faces/face-" + a + ".svg' alt=''><img src='" + A + "dice/faces/face-" + b + ".svg' alt=''></span><span class='sub'>" + pay + "</span>" + betHTML(amt) + "</button>";
  const lamps = (ns, on) => "<span class='lamps'>" + ns.map((n) => "<i class='" + (on[n] ? "on" : "") + "'></i>").join("") + "</span>";
  return "<div class='tc-felt' id='felt'>" +
    "<div class='ats'>" +
    "<button class='spot' data-act='spot' data-kind='small'><span class='lb'>SMALL</span>" + betHTML(b.small) + lamps([2, 3, 4, 5, 6], game.progress.small || {}) + "<span class='sub'>31 FOR 1</span></button>" +
    "<button class='spot' data-act='spot' data-kind='all'><span class='lb'>ALL</span>" + betHTML(b.all) + lamps([2, 3, 4, 5, 6, 8, 9, 10, 11, 12], game.progress.all || {}) + "<span class='sub'>156 FOR 1</span></button>" +
    "<button class='spot' data-act='spot' data-kind='tall'><span class='lb'>TALL</span>" + betHTML(b.tall) + lamps([8, 9, 10, 11, 12], game.progress.tall || {}) + "<span class='sub'>31 FOR 1</span></button></div>" +
    "<div class='nums'>" + [4, 5, 6, 8, 9, 10].map(num).join("") + "</div>" +
    "<div class='comerow'><button class='spot come' data-act='spot' data-kind='come'><span class='lb'>COME</span>" + betHTML(b.come) + "</button>" +
    "<div class='numbet' role='radiogroup' aria-label='Number bet'>" +
    ["place", "buy", "lay"].map((k) => "<button data-act='numbet' data-k='" + k + "' class='" + (settings.numbet === k ? "on" : "") + "' role='radio' aria-checked='" + (settings.numbet === k) + "'>" + k.toUpperCase() + "</button>").join("") +
    "</div><button class='spot dc' data-act='spot' data-kind='dontCome'><span class='lb'>DON'T COME</span><span class='sub'>BAR " + ((game.rules && game.rules.bar) || 12) + "</span>" + betHTML(b.dontCome) + "</button></div>" +
    "<button class='spot field' data-act='spot' data-kind='field' aria-label='" + pres.aria + "'>" +
    "<span class='fn ring'>2</span><span class='fn'>3</span><span class='fn'>4</span><span class='fn'>9</span><span class='fn'>10</span><span class='fn'>11</span><span class='fn ring'>12</span>" +
    "<span class='fl'>" + pres.felt + "</span>" + betHTML(b.field) + "</button>" +
    "<div class='props'><div class='horn'>" +
    hop(1, 1, "hop:1-1", "30:1", b.hops["1-1"]) + hop(1, 2, "hop:1-2", "15:1", b.hops["1-2"]) +
    hop(5, 6, "hop:5-6", "15:1", b.hops["5-6"]) + hop(6, 6, "hop:6-6", "30:1", b.hops["6-6"]) +
    "</div><button class='spot bigred' data-act='spot' data-kind='any7'><span class='lb'>BIG RED</span><span class='sub'>ANY 7 · 4 TO 1</span>" + betHTML(b.any7) + "</button>" +
    "<button class='spot hwad' data-act='spot' data-kind='hardAllDay'><span class='lb'>HARD WAY ALL DAY</span><span class='sub'>165 FOR 1</span>" + betHTML(b.hardAllDay) + "</button>" +
    "<div class='hard'>" + hop(2, 2, "hardway:4", "7:1", b.hardways[4]) + hop(3, 3, "hardway:6", "9:1", b.hardways[6]) + hop(4, 4, "hardway:8", "9:1", b.hardways[8]) + hop(5, 5, "hardway:10", "7:1", b.hardways[10]) + "</div></div>" +
    "<div class='line'>" +
    "<button class='spot pass' data-act='spot' data-kind='pass'><span class='lb'>PASS LINE</span>" + betHTML(b.pass) + "</button>" +
    "<button class='spot' data-act='spot' data-kind='passOdds'><span class='lb'>ODDS</span><span class='sub'>3-4-5X</span>" + betHTML(b.passOdds) + "</button>" +
    "<button class='spot' data-act='spot' data-kind='dontPass'><span class='lb'>DON'T PASS</span><span class='sub'>BAR 12</span>" + betHTML(b.dontPass) + "</button>" +
    "<button class='spot' data-act='spot' data-kind='dontPassOdds'><span class='lb'>LAY ODDS</span><span class='sub'>UP TO 6X</span>" + betHTML(b.dontPassOdds) + "</button></div></div>";
}

function railHTML() {
  const order = [50000, 10000, 2500, 500, 100];
  const stacks = order.map((d) => {
    const n = rail[d] || 0;
    const vis = Math.min(n, Rail.DISPLAY_CAP);
    const chips = Array.from({ length: vis }, (_, i) => "<i class='ch" + (i === vis - 1 ? " top" : "") + "' style='bottom:" + (12 + i * 3) + "px;background-image:url(" + chipImg(d) + ")'></i>").join("");
    const badge = Rail.badgeText(n);
    return "<button class='stack" + (n ? "" : " empty") + (settings.chip === d ? " sel" : "") + "' data-act='chip' data-chip='" + d + "' aria-pressed='" + (settings.chip === d) + "' style='min-width:44px;min-height:44px'>" +
      chips + (badge ? "<span class='cnt'>" + badge + "</span>" : "") + "<span class='den'>$" + (d / 100) + "</span></button>";
  }).join("");
  return "<div class='tc-rail tc-stack-host' role='group' aria-label='" + Rail.railGroupLabel(rail) + "'><div class='rtot'>PRACTICE CHIPS <b>" + money(Rail.railTotal(rail)) + "</b></div><div class='trough'>" + stacks + "</div></div>";
}

function fireRail(size) {
  const lit = game.firePoints || [];
  const locked = !game.fireOpen;
  return "<div class='tc-fire " + size + (locked ? " locked" : "") + "'><span class='fl'>FIRE<br>BET</span>" +
    [4, 5, 6, 8, 9, 10].map((n) => "<span class='med" + (lit.indexOf(n) >= 0 ? " lit" : "") + "'>" + n + "</span>").join("") +
    "<span class='cnt'>" + lit.length + " of 6</span></div>";
}

function sideHTML() {
  const open = !!game.fireOpen;
  return "<div class='tc-side'>" +
    "<section class='tc-firetile" + (open ? " open" : " locked") + "'><header><b>FIRE BET</b><span class='chip'>" + (open ? "OPEN · UNTIL THE FIRST ROLL" : "LOCKED · NEW SHOOTER") + "</span></header>" +
    fireRail("l") +
    "<div class='pay'><span><b>4 pts</b> 24 to 1</span><span><b>5 pts</b> 249 to 1</span><span><b>6 pts</b> 999 to 1</span></div>" +
    "<div class='row'><span class='edge r'>20.76%</span><span class='lim'>$1–$10</span>" +
    "<button class='betbtn' data-act='fire' " + (open ? "" : "disabled") + ">" + (open ? "ADD $1" : "LOCKED") + "</button></div>" +
    "<p class='note'>" + (open ? "Bet now: it closes at this shooter's first come-out roll." : "Your Fire Bet rides until the seven-out. It can't come down now.") + "</p></section></div>";
}

function shooterHTML() {
  const set = SETS[settings.set] || SETS["3V"];
  return "<div class='tc-shooter'><div class='table'><div class='wall'></div><div class='tlabel'>BOTH DICE MUST HIT THE BACK WALL</div>" + fireRail("s") +
    "<p>Set dice are practice only. RSR about 6.0 = random. The Wizard of Odds is still skeptical. Casino rules vary.</p></div>" +
    "<div class='sets' role='radiogroup'>" + Object.keys(SETS).map((k) => {
      const s = SETS[k];
      return "<button data-act='set' data-set='" + k + "' class='" + (settings.set === k ? "on" : "") + "'><b>" + s.name + "</b><small>" + (s.aka || "for practice") + "</small></button>";
    }).join("") + "</div>" +
    "<p class='note'>Throw with one hand, for practice. A soft toss is a no-roll and draws nothing.</p></div>";
}

function pickerHTML() {
  const rows = TS.TABLE_STRATEGIES.filter((c) => {
    if (filter === "all") return true;
    if (filter === "free") return c.tier === "free";
    if (filter === "premium") return c.tier === "premium";
    return c.filters.indexOf(filter) >= 0 || c.risk === filter;
  });
  return "<div class='tc-sheet tc-picker'><header class='sh'><small>TABLE CRAPS · STRATEGIES</small><h1>Pick a strategy</h1>" +
    "<div class='filters'>" + ["all", "light", "dark", "hedge", "press", "warn", "free", "premium"].map((f) => "<button data-act='filter' data-f='" + f + "' class='" + (filter === f ? "on" : "") + "'>" + f + "</button>").join("") + "</div>" +
    "<div class='sum'><span><b>16</b> Free</span><span><b>8</b> Premium</span><button class='cmp' data-act='screen' data-screen='compare'>COMPARE</button></div></header>" +
    "<div class='list'>" + rows.map((c) => "<button class='strow" + (c.warning ? " warn" : "") + "' data-act='strat' data-id='" + c.id + "'><span class='rk'>" + c.n + "</span><span class='nm'><b>" + c.name + "</b><small>" + c.id + "</small></span><span class='edge'>" + c.edge + "</span><span class='tier " + (c.warning ? "warn" : c.tier === "premium" ? "prem" : "free") + "'>" + (c.warning ? "FREE · WARNING" : c.tier === "premium" ? "PREMIUM" : "FREE") + "</span></button>").join("") + "</div>" +
    "<p>No system beats the edge. Practice chips only.</p><a href='../'>Bubble Craps</a></div>";
}

function tutorialHTML() {
  const steps = TS.tutorial(tutorId);
  const step = steps[Math.min(tutorStep, steps.length - 1)];
  const card = TS.strategyById(tutorId);
  return feltHTML() + "<div class='tc-coach' data-mascot='billy'><img src='" + A + "mascots/dealer-billy/billy-A-tip.svg' alt='Dealer Billy'><div><div class='kick'>TUTORIAL · " + (card ? card.name : "") + "</div></div><div class='body'>" + (step ? step.text : "") + "</div><div class='acts'><button data-act='tutor-back'>BACK</button><button class='go' data-act='tutor-next'>NEXT</button><button data-act='screen' data-screen='play'>EXIT</button></div></div>";
}

function chartHTML(runs) {
  const W = 600, H = 220, pad = { l: 46, r: 8, t: 12, b: 22 };
  const ys = runs.flatMap((r) => r.line);
  const ymin = Math.min(0, ...ys);
  const ymax = Math.max(...ys, 1);
  const n = Math.max(1, runs[0].line.length - 1);
  const X = (i) => pad.l + (i / n) * (W - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - ymin) / (ymax - ymin || 1)) * (H - pad.t - pad.b);
  const dash = ["", "8 4", "2 3", "10 3 2 3", "5 2", "1 4"];
  const paths = runs.map((r, j) => {
    const d = r.line.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join("");
    return "<path d='" + d + "' fill='none' stroke='var(--cmp-" + (j + 1) + ")' stroke-width='2.2' stroke-dasharray='" + dash[j] + "'/>";
  }).join("");
  const rows = runs.slice().sort((a, b) => b.net - a.net).map((r, i) => "<tr" + (i ? "" : " class='top'") + "><td>" + r.id + (i ? "" : " <small>top on this replay</small>") + "</td><td>" + money(r.net) + "</td><td>" + money(r.maxDrawdown) + "</td></tr>").join("");
  return "<figure class='chart'><svg viewBox='0 0 " + W + " " + H + "' role='img' aria-label='Bankroll by roll'>" + paths + "</svg><figcaption>Same dice. Past rolls don't predict future rolls.</figcaption></figure><table class='mt'><caption>Top on this replay</caption><thead><tr><th>Plan</th><th>Net</th><th>Max drop</th></tr></thead><tbody>" + rows + "</tbody></table>";
}

function compareHTML() {
  if (!premiumOn()) {
    return "<div class='tc-sheet tc-compare'><h1>Strategy Comparison</h1><p>Standard play shows one locked demo. Changing it opens Premium.</p>" +
      (compareRun ? chartHTML(compareRun.runs) : "") +
      "<button class='go' data-act='screen' data-screen='paywall' style='height:44px'>Unlock comparison</button></div>";
  }
  return "<div class='tc-sheet tc-compare'><header class='sh'><small>STRATEGY COMPARISON · PREMIUM</small><h1>Same dice, different plans.</h1><p class='warnline'><b>Past rolls don't predict future rolls.</b> Every strategy here has a house edge.</p></header>" +
    (compareRun ? chartHTML(compareRun.runs) : "<p>Run a replay to chart it.</p>") +
    "<button data-act='run-compare' style='height:44px'>Replay 120 rolls</button><p class='seed'>Seeded " + R.SEEDED_RNG_NAME + ". Top on this replay.</p></div>";
}

function paywallHTML() {
  return "<div class='tc-sheet tc-pay'><button class='x' data-act='screen' data-screen='play' aria-label='Close'>✕</button>" +
    "<img class='mascot' src='" + A + "mascots/dealer-billy/billy-A-tip.svg' alt='Dealer Billy'>" +
    "<small>ONE-TIME UNLOCK</small><h1>Table Craps Premium</h1><ul>" +
    ["Custom house rules: 10x odds, Field 3:1, presets", "8 Premium strategies + tutorials", "Strategy Comparison: replay up to 6 plans", "Fair Dice CSV export · saved presets"].map((t) => "<li>" + t + "</li>").join("") +
    "</ul><p class='honest'>Premium doesn't change the dice or the odds. Practice chips only. Sold per app: applies to Table Craps only.</p>" +
    "<button class='buy' data-act='unlock'>Unlock for $4.99</button><div class='sub'><button data-act='restore'>Restore purchases</button><button data-act='screen' data-screen='play'>Not now</button></div>" +
    "<p class='fine'>One-time purchase · no subscription · 18+ · practice only</p></div>";
}

function menuHTML() {
  const deck = Et.deckFor("table").all;
  return "<div class='tc-sheet'><h1>Table</h1><button data-act='leave' style='height:44px'>Leave table</button>" +
    "<a href='../' style='display:flex;align-items:center;height:44px'>Bubble Craps</a>" +
    "<label>Color up <select data-act='color-setting'><option value='offer'" + (settings.colorUp === "offer" ? " selected" : "") + ">Offer</option><option value='auto'" + (settings.colorUp === "auto" ? " selected" : "") + ">Auto</option><option value='off'" + (settings.colorUp === "off" ? " selected" : "") + ">Off</option></select></label>" +
    "<label>Theme <select data-act='theme'><option value='billy'>Billy navy</option><option value='midnight'" + (settings.theme === "midnight" ? " selected" : "") + ">Midnight</option><option value='classic'" + (settings.theme === "classic" ? " selected" : "") + ">Classic</option><option value='highlimit'" + (settings.theme === "highlimit" ? " selected" : "") + ">High limit</option></select></label>" +
    "<p>" + TR.RULE0_LINE + "</p><h2>Dealer Billy</h2>" +
    deck.map((t) => "<article class='card'><h3>" + t.n + ". " + t.topic + "</h3><p>" + t.billy + "</p><p>" + t.why + "</p></article>").join("") +
    "<p>" + Et.ETIQUETTE_FOOTER + "</p><button data-act='etiquette-done' style='height:44px'>Got it</button></div>";
}

function stageHTML() {
  if (screen === "picker") return pickerHTML();
  if (screen === "tutorial") return tutorialHTML();
  if (screen === "compare") return compareHTML();
  if (screen === "paywall") return paywallHTML();
  if (menu) return menuHTML();
  if (page === 0) return sideHTML();
  if (page === 2) return shooterHTML();
  return feltHTML();
}

function render() {
  app.dataset.theme = settings.theme || "billy";
  const point = game.point;
  const offerHTML = offer ? "<div class='tc-offer' role='status'><div class='t'><b>" + offer + "</b></div><button class='go' data-act='color-up'>COLOR UP</button><button class='x' data-act='color-dismiss' aria-label='Not now'>×</button></div>" : "";
  const conv = convert ? "<div class='tc-coach convert' data-mascot='billy'><img src='" + A + "mascots/dealer-billy/billy-A-tip.svg' alt='Dealer Billy'><div class='kick'>One bet per number · " + convert.number + "</div><div class='body'>You have <b>" + convert.from + " " + money(convert.amount) + "</b> on the " + convert.number + ". Switch it to <b>" + convert.to + " " + money(convert.amount) + "</b>? Buy pays true odds; the 5% commission is taken only when it wins.</div><div class='acts'><button class='go' data-act='convert'>CONVERT TO " + convert.to.toUpperCase() + "</button><button data-act='keep'>KEEP " + convert.from.toUpperCase() + "</button></div></div>" : "";
  app.innerHTML = "<header class='tc-hud'><button class='avbtn' data-act='menu' aria-label='Dealer Billy, menu'><img class='av' alt='' src='" + A + "mascots/dealer-billy/hud/hud-billy-A-36@2x.png'></button>" +
    "<div class='money'><div><small>Practice chips</small><b>" + money(game.bankroll) + "</b></div><div><small>On table</small><b>" + money(E.tableTotal(game)) + "</b></div></div>" +
    "<img class='puck' data-puck alt='" + (point ? "Point " + point : "Puck off") + "' src='" + A + "icons/puck-" + (point ? "on" : "off") + ".svg'>" +
    "<button class='fair' data-act='menu'>FAIR</button></header>" +
    "<main class='tc-stage' id='stage'>" + stageHTML() + conv + (toastText ? "<div class='tc-toast' role='status'><b>" + toastText + "</b>" + (changeNote ? "<small>" + changeNote + "</small>" : "") + "</div>" : "") + "</main>" +
    "<div class='tc-dots'><button class='pill' data-act='page' data-page='" + ((page + 2) % 3) + "'><span class='cap'>‹ " + ["BOARD", "SIDE BETS", "BOARD"][page] + "</span></button>" +
    "<span class='dots'>" + [0, 1, 2].map((i) => "<button data-act='page' data-page='" + i + "' aria-label='" + ["Side bets", "Board", "Dice"][i] + "'><i class='" + (page === i ? "on" : "") + "'></i></button>").join("") + "</span>" +
    "<button class='pill' data-act='page' data-page='" + ((page + 1) % 3) + "'><span class='cap'>" + ["BOARD", "SHOOTER", "BOARD"][page] + " ›</span></button></div>" +
    "<footer class='tc-dock'>" + offerHTML + railHTML() + "<button class='tc-shoot' data-act='roll'><small>GO TO</small><b>SHOOT</b></button></footer>" +
    "<nav class='tc-keys'><button data-act='screen' data-screen='play'" + (screen === "play" && !menu ? " class='on'" : "") + ">BETS</button><button data-act='screen' data-screen='picker'>STRATEGIES</button><button data-act='tutor'>TUTOR</button><button data-act='menu'>STATS</button></nav>" +
    "<div class='tc-notice'><span>18+</span> PRACTICE ONLY · NO REAL MONEY</div>";
  fitTable();
}

function fitTable() {
  const w = innerWidth, h = innerHeight, land = w > h && h <= 500;
  app.classList.toggle("land", land);
  app.classList.toggle("short", !land && h < 700);
  app.classList.toggle("narrow", w < 360);
  const f = document.getElementById("felt");
  const stage = document.getElementById("stage");
  if (!f || !stage) return;
  f.classList.toggle("land", land);
  const st = stage.getBoundingClientRect();
  const coach = stage.querySelector(".tc-coach");
  const coachH = coach ? coach.offsetHeight + 12 : 0;
  const ring = land ? 8 : h < 700 ? 4.5 : 8.5 * Math.min(1, w / 390);
  const aw = st.width - 2 * ring, ah = Math.max(180, st.height - 2 * ring - coachH);
  let k, rows;
  if (!land) {
    k = Math.min(1.12, aw / 354);
    const base = { ats: 46, come: 48, field: 50, p1: 50, p2: 50, line: 50 };
    const gap = Math.max(2, 3 * k);
    const pad = 2 * (h < 700 ? 3 : Math.max(3, 6 * k)) + 3.2;
    const sm = {};
    Object.keys(base).forEach((n) => { sm[n] = Math.max(44, base[n] * k); });
    const used = Object.values(sm).reduce((a, b) => a + b, 0) + 4 * gap + pad;
    let nums = Math.min(150 * k, Math.max(80, ah - used - gap));
    f.style.setProperty("--g", gap.toFixed(1) + "px");
    rows = [sm.ats, nums, sm.come, sm.field, sm.p1 + sm.p2 + gap, sm.line];
    f.style.gridTemplateRows = rows.map((r) => r.toFixed(1) + "px").join(" ");
  } else {
    k = Math.min(1.05, ah / 300);
    rows = [44, Math.max(80, ah - 200), 44, 44, 44];
    f.style.gridTemplateRows = rows.map((r) => r.toFixed(1) + "px").join(" ");
  }
  f.style.setProperty("--k", k.toFixed(4));
  const strip = Math.max(14, 16 * k);
  f.style.setProperty("--digit", Math.min(34 * k, 28).toFixed(1) + "px");
  f.style.setProperty("--strip", strip.toFixed(1) + "px");
  f.style.setProperty("--strip-lay", strip.toFixed(1) + "px");
}

function placeSpot(kind, number) {
  if (rolling) return;
  let amount = settings.chip;
  const spot = { kind, number };
  if (kind === "pass" || kind === "dontPass" || kind === "come" || kind === "dontCome" || kind === "field" || kind === "place" || kind === "buy" || kind === "lay") {
    const min = kind === "place" && (number === 6 || number === 8) ? 1200 : 1000;
    if ((kind === "pass" ? game.bets.pass : kind === "field" ? game.bets.field : 0) === 0 && amount < min && (kind === "pass" || kind === "dontPass" || kind === "field" || kind === "come" || kind === "dontCome")) amount = min;
  }
  const res = E.placeBet(game, spot, amount);
  if (!res.ok && res.convert) { convert = res.convert; render(); return; }
  if (!res.ok) { toastText = res.error; render(); return; }
  game = res.state;
  sync();
  if (kind === "dontPass" || kind === "dontCome") maybeNudge("first_dont");
  render();
}

function maybeNudge(trigger) {
  if (!settings.tutor) return;
  const tip = Et.nudgeFor(trigger, "table");
  if (tip) toastText = tip.billy;
}

function doRoll() {
  if (rolling) return;
  rolling = true;
  PC.cancelCelebration();
  offer = null;
  const passBefore = game.bets.pass;
  const pointBefore = game.point;
  const handBefore = game.hand.points;
  const dice = E.rollDice();
  if (!dice || !dice.d1) {
    rolling = false;
    toastText = (dice && dice.error) || TR.NO_ROLL;
    render();
    return;
  }
  const settled = E.settle(game, dice.d1, dice.d2);
  game = settled.state;
  if (strategyId) game = TS.afterRoll(game, strategyId, settled, { unit: 1000 });
  sync();
  const gained = Rail.colorUpOffer(rail);
  if (gained && settings.colorUp === "auto" && !rolling) {
    rail = Rail.railColorUp(rail).rail;
  } else if (gained && settings.colorUp === "offer") {
    offer = (rail[100] > 20 ? rail[100] + " × $1" : rail[500] + " × $5") + " on the rail. Color up?";
  }
  rolling = false;
  toastText = settled.narrative;
  render();
  if (settled.result === "point-made") {
    const points = game.hand.points;
    const tier = PT.celebrationTier(points, { meterOn: true, blazing: settled.tier === "blazing" });
    const quiet = !(passBefore > 0);
    const copy = PT.celebrationCopy({ tier, quiet, point: pointBefore, points, hard: dice.hard, net: settled.net, stinger: "" });
    const targets = [document.querySelector(".tc-hud .puck"), document.querySelector(".numbox.point")].filter(Boolean);
    PC.celebratePoint({
      targets: targets.length ? targets : [document.querySelector(".tc-hud")],
      avoid: [".tc-shoot", ".tc-rail", ".tc-hud", ".tc-keys", ".tc-dots", ".tc-notice"].map((s) => document.querySelector(s)),
      point: pointBefore,
      net: quiet ? 0 : settled.net,
      big: !quiet && settled.net >= 25 * Math.max(passBefore, 1),
      tier,
      duration: copy.duration,
      line: copy.call,
      cheer: copy.cheer,
      quiet,
      billie: A + "mascots/billie/billie-C-winner.svg",
      chip: A + "chips/chip-25-value.svg",
      reduced: reducedMQ.matches,
    });
  }
}

function leave() {
  rail = Rail.leaveTable(rail).rail;
  const total = Rail.railTotal(rail);
  toastText = "Practice chips: " + money(total);
  menu = false;
  screen = "play";
  save();
  render();
}

function onClick(e) {
  const t = e.target.closest("[data-act]");
  if (!t) return;
  const act = t.dataset.act;
  if (act === "chip") { settings.chip = Number(t.dataset.chip); render(); return; }
  if (act === "roll") { doRoll(); return; }
  if (act === "page") { page = Number(t.dataset.page); screen = "play"; menu = false; render(); return; }
  if (act === "screen") { screen = t.dataset.screen; menu = false; render(); return; }
  if (act === "menu") { menu = !menu; screen = "play"; render(); return; }
  if (act === "numbet") { settings.numbet = t.dataset.k; render(); return; }
  if (act === "num") { placeSpot(settings.numbet, Number(t.dataset.n)); return; }
  if (act === "spot") {
    const kind = t.dataset.kind;
    if (kind.indexOf(":") > 0) {
      const [k, rest] = kind.split(":");
      if (k === "hop") {
        const res = E.placeBet(game, { kind: "hop", pair: rest }, Math.max(100, settings.chip));
        if (res.ok) { game = res.state; sync(); }
        else toastText = res.error;
        render();
        return;
      }
      placeSpot(k, Number(rest));
      return;
    }
    placeSpot(kind);
    return;
  }
  if (act === "fire") {
    const res = E.placeBet(game, { kind: "fire" }, 100);
    if (!res.ok) toastText = res.error;
    else { game = res.state; sync(); }
    render();
    return;
  }
  if (act === "color-up") { rail = Rail.railColorUp(rail).rail; offer = null; save(); render(); return; }
  if (act === "color-dismiss") { offer = null; render(); return; }
  if (act === "convert" && convert) {
    const res = E.placeBet(game, { kind: convert.to, number: convert.number }, convert.amount, { convert: true });
    convert = null;
    if (res.ok) { game = res.state; sync(); } else toastText = res.error;
    render();
    return;
  }
  if (act === "keep") { convert = null; render(); return; }
  if (act === "filter") { filter = t.dataset.f; render(); return; }
  if (act === "strat") {
    const id = t.dataset.id;
    const card = TS.strategyById(id);
    if (card && card.tier === "premium" && !premiumOn()) { screen = "paywall"; render(); return; }
    if (card && card.warning) { toastText = card.name + " is a warning. It is not offered as Play this."; screen = "picker"; render(); return; }
    strategyId = id;
    tutorId = id;
    const bet = TS.autoBet(game, id, { unit: 1000 });
    game = bet.state;
    sync();
    screen = "play";
    toastText = card.name + " is placing bets. " + TS.TUTOR_END;
    render();
    return;
  }
  if (act === "tutor") { screen = "tutorial"; tutorStep = 0; render(); return; }
  if (act === "tutor-next") { tutorStep += 1; render(); return; }
  if (act === "tutor-back") { tutorStep = Math.max(0, tutorStep - 1); render(); return; }
  if (act === "unlock" || act === "restore") {
    settings.premium = true;
    localStorage.setItem(PREM, "1");
    toastText = "Premium unlocked on this device. Practice chips only.";
    screen = "compare";
    render();
    return;
  }
  if (act === "run-compare") {
    if (!premiumOn()) { screen = "paywall"; render(); return; }
    const seq = R.rollSequenceFromSeed(482113907, 120);
    compareRun = R.compare(seq.dice, ["T1", "T2", "T5", "T6", "T7", "T23"], { rules: game.rules });
    render();
    return;
  }
  if (act === "leave") { leave(); return; }
  if (act === "set") { settings.set = t.dataset.set; render(); return; }
  if (act === "color-setting") { settings.colorUp = t.value; save(); return; }
  if (act === "theme") { settings.theme = t.value; save(); render(); return; }
  if (act === "etiquette-done") {
    let store = { badges: {}, progress: {} };
    try { store = JSON.parse(localStorage.getItem("bb-table-badges-v1") || "") || store; } catch { /* fresh */ }
    Et.ETIQUETTE.forEach((tip, i) => {
      store = Badges.noteAction(store, { type: "etiquette", id: tip.id, complete: i === Et.ETIQUETTE.length - 1 }).store;
    });
    localStorage.setItem("bb-table-badges-v1", JSON.stringify(store));
    toastText = store.badges.table_manners ? "Table Manners unlocked." : "Table Manners noted.";
    menu = false;
    render();
  }
}

let touchX = 0;
app.addEventListener("pointerdown", (e) => { touchX = e.clientX; });
app.addEventListener("pointerup", (e) => {
  const dx = e.clientX - touchX;
  if (Math.abs(dx) < 48 || screen !== "play") return;
  if (dx < 0) page = Math.min(2, page + 1);
  else page = Math.max(0, page - 1);
  render();
});
app.addEventListener("click", onClick);
app.addEventListener("change", onClick);
addEventListener("resize", fitTable);

load();
const q = new URLSearchParams(location.search);
if (q.get("theme")) settings.theme = q.get("theme");
const shot = q.get("shot");
if (shot === "paywall") { settings.premium = false; screen = "paywall"; }
if (shot === "picker") screen = "picker";
if (shot === "tutorial") { screen = "tutorial"; tutorId = "T1"; }
if (shot === "colorup") {
  rail = Rail.emptyRail();
  rail[100] = 26;
  game.bankroll = 2600;
  game.bets = E.createGame({ profile: "table" }).bets;
  offer = "26 × $1 on the rail. Color up?";
}
if (shot === "compare") {
  settings.premium = true;
  screen = "compare";
  const seq = R.rollSequenceFromSeed(482113907, 80);
  compareRun = R.compare(seq.dice, ["T1", "T5", "T6"], {});
}
render();
if (shot === "celebrate" || shot === "base" || shot === "big" || shot === "huge" || shot === "fire") {
  const tier = shot === "celebrate" ? "base" : shot;
  const copy = PT.celebrationCopy({ tier: tier === "fire" ? "huge" : tier, point: 6, points: tier === "huge" || tier === "fire" ? 3 : tier === "big" ? 2 : 1, net: 7000, stinger: tier === "fire" ? PT.fireStinger(4, true) : "" });
  requestAnimationFrame(() => PC.celebratePoint({
    targets: [document.querySelector(".tc-hud .puck"), document.querySelector("[data-n='6']")],
    avoid: [".tc-shoot", ".tc-rail", ".tc-hud", ".tc-keys", ".tc-dots", ".tc-notice"].map((s) => document.querySelector(s)),
    point: 6, net: 7000, tier: copy.tier, big: tier !== "base", duration: copy.duration,
    line: copy.call, cheer: copy.cheer, stinger: copy.stinger, hold: true,
    billie: A + "mascots/billie/billie-C-winner.svg",
    chip: A + "chips/chip-25-value.svg",
  }));
}
window.__tcReady = true;
