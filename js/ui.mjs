import * as E from "./engine.mjs";
import * as S from "./strategies.mjs";
import * as F from "./fair.mjs";
import * as A from "./audio.mjs";

const STORE = "bb-bubble-craps-v1";
const CHIP_FILE = { 100: "1", 500: "5", 2500: "25", 10000: "100", 50000: "500" };
const FACE_ROT = {
  1: "rotateX(0deg) rotateY(0deg)",
  2: "rotateX(0deg) rotateY(-90deg)",
  3: "rotateX(-90deg) rotateY(0deg)",
  4: "rotateX(90deg) rotateY(0deg)",
  5: "rotateX(0deg) rotateY(90deg)",
  6: "rotateX(0deg) rotateY(180deg)",
};
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

const settings = {
  sound: true,
  haptics: true,
  autoRoll: true,
  workingComeOut: false,
  hardwaysComeOut: true,
  comeOddsOff: true,
  showDice: false,
  tutorTrack: "beginner",
  tutorOn: true,
  reduced: false,
  chip: 500,
};
let game = E.createGame();
let view = "home";
let page = 1;
let betTab = "place";
let learnFilter = "all";
let fairScope = "session";
let rolling = false;
let timerRAF = 0;
let timerStart = 0;
let toastTimer = 0;
let returnPage = 1;
let sessionRolls = [];
let allRolls = [];
let tutorStep = 0;
let tour = false;
let mutedTips = {};

const app = document.getElementById("app");
const reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.settings) Object.assign(settings, data.settings);
    if (Array.isArray(data.allRolls)) allRolls = data.allRolls.slice(-8000);
    if (data.game && data.game.bets && data.game.bets.hops) {
      game = data.game;
      game.placeWorkingOnComeOut = !!settings.workingComeOut;
      game.hardwaysWorkingOnComeOut = settings.hardwaysComeOut !== false;
      game.comeOddsOffOnComeOut = settings.comeOddsOff !== false;
    }
  } catch {
    /* keep defaults */
  }
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({
      settings,
      game,
      allRolls: allRolls.slice(-8000),
    }));
  } catch {
    /* quota */
  }
}

function money(c) { return E.formatMoney(c); }
function haptic(pattern) {
  if (!settings.haptics || !navigator.vibrate) return;
  navigator.vibrate(pattern);
}
function motionOff() { return settings.reduced || reducedMQ.matches; }

function chipSrc(cents) {
  return "assets/chips/chip-" + (CHIP_FILE[cents] || "5") + "-value.svg";
}
function chipHTML(cents) {
  return '<img alt="" width="44" height="44" src="' + chipSrc(cents) + '">';
}
function pipsHTML(face) {
  const on = PIPS[face] || [];
  let html = "";
  for (let i = 0; i < 9; i++) html += '<i class="' + (on.includes(i) ? "on" : "") + '"></i>';
  return html;
}
function faceSpans(face) {
  const on = PIPS[face] || [];
  let html = "";
  for (let i = 0; i < 9; i++) html += "<span class=\"pip" + (on.includes(i) ? " on" : "") + "\"></span>";
  return html;
}
function flatDie(face, id) {
  return '<div class="die2d" id="' + id + '" aria-label="Die showing ' + face + '">' + pipsHTML(face) + "</div>";
}
function miniDie(face) {
  return '<div class="mini-die" aria-hidden="true">' + pipsHTML(face) + "</div>";
}
function edgeDot(kind, number, pair) {
  const edge = E.edgeFor({ kind, number, pair }, game.mode);
  const cls = E.edgeClass(edge);
  return cls ? '<i class="edge ' + cls + '" title="' + edge + '% house edge"></i>' : "";
}
function stakeLabel(cents) {
  return cents ? '<span class="amt">' + money(cents) + "</span>" : "";
}

function mount() {
  app.innerHTML = `
    <h1 class="sr">Billy Bubs Bubble Craps</h1>
    <header class="hud" id="hud"></header>
    <div class="toast" id="toast" role="status"></div>
    <div class="stage" id="stage"><div class="pager" id="pager"></div></div>
    <div class="dots" id="dots"></div>
    <div class="dock" id="dock"></div>
    <main class="panel hidden" id="panel"></main>
    <nav class="tabs" id="tabs" aria-label="Sections"></nav>
    <p class="legal">18+ · Practice only · No real money</p>
    <div id="overlay"></div>
  `;
  app.addEventListener("click", onClick);
  const stage = document.getElementById("stage");
  let sx = 0;
  let dx = 0;
  let tracking = false;
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a, input")) return;
    tracking = true;
    sx = e.clientX;
    dx = 0;
  });
  stage.addEventListener("pointermove", (e) => {
    if (!tracking || motionOff()) return;
    dx = e.clientX - sx;
    const pager = document.getElementById("pager");
    pager.style.transition = "none";
    pager.style.transform = "translateX(calc(" + (-page * 100 / 3) + "% + " + dx + "px))";
  });
  stage.addEventListener("pointerup", () => {
    if (!tracking) return;
    tracking = false;
    if (dx <= -48 && page < 2) page += 1;
    else if (dx >= 48 && page > 0) page -= 1;
    dx = 0;
    snap();
  });
  stage.addEventListener("pointercancel", () => { tracking = false; snap(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { page = Math.min(2, page + 1); snap(); paint(); }
    if (e.key === "ArrowLeft") { page = Math.max(0, page - 1); snap(); paint(); }
    if (e.key === " " && view === "play" && !rolling) { e.preventDefault(); doRoll(); }
  });
  paint();
}

function snap() {
  const pager = document.getElementById("pager");
  if (!pager) return;
  pager.style.transition = motionOff() ? "none" : "";
  pager.style.transform = "translateX(" + (-page * 100 / 3) + "%)";
}

function onClick(e) {
  const t = e.target.closest("[data-act]");
  if (!t || t.disabled) return;
  A.unlock();
  A.setMuted(!settings.sound);
  const act = t.dataset.act;
  if (act === "view") { setView(t.dataset.view); return; }
  if (act === "page") { page = Number(t.dataset.page); snap(); paint(); return; }
  if (act === "play") { startMode(t.dataset.mode || "regular"); return; }
  if (act === "mode") { switchMode(t.dataset.mode); return; }
  if (act === "chip") { settings.chip = Number(t.dataset.cents); haptic(8); A.chip(); save(); paint(); return; }
  if (act === "bet") { addBet(t.dataset); return; }
  if (act === "take") { takeBet(t.dataset); return; }
  if (act === "roll") { doRoll(); return; }
  if (act === "press") { doPress(); return; }
  if (act === "power") { doPower(); return; }
  if (act === "undo") { const r = E.undoPress(game); if (r.ok) { game = r.state; A.chip(); } save(); paint(); return; }
  if (act === "clear") { const r = E.clearPress(game); if (r.ok) game = r.state; save(); paint(); return; }
  if (act === "betsoff") { game = E.setBetsOff(game, !game.betsOff); toast(game.betsOff ? "Bets Off. Place and Buy sit out." : "Bets on. Place and Buy are working."); save(); paint(); return; }
  if (act === "billy") { doBilly(); return; }
  if (act === "reset") { game = E.resetLayout(game); toast("Bets returned to your practice chips."); save(); paint(); return; }
  if (act === "tab") { betTab = t.dataset.tab; paint(); return; }
  if (act === "toast-go") { page = 2; hideToast(); snap(); paint(); return; }
  if (act === "tutor") { openTutor(t.dataset.step ? Number(t.dataset.step) : tutorStep); return; }
  if (act === "tips") { settings.tutorOn = !settings.tutorOn; save(); paint(); if (settings.tutorOn) openTutor(0); return; }
  if (act === "tour") { tour = true; tutorStep = 0; startMode(game.mode || "regular"); openTutor(0); return; }
  if (act === "billy-help") { openSheet(billyHelp()); return; }
  if (act === "close") { closeOverlay(); return; }
  if (act === "gotit") { advanceTutor(); return; }
  if (act === "why") { openSheet(whySheet()); return; }
  if (act === "mute-tip") { mutedTips[currentTip().id] = true; settings.tutorOn = false; save(); closeOverlay(); return; }
  if (act === "filter") { learnFilter = t.dataset.filter; paint(); return; }
  if (act === "strategy") { runStrategy(t.dataset.id); return; }
  if (act === "stop-strategy") { game.strategy = null; toast("Auto-bet stopped."); save(); paint(); return; }
  if (act === "fair-scope") { fairScope = t.dataset.scope; paint(); return; }
  if (act === "setting") { toggleSetting(t.dataset.key); return; }
  if (act === "track") { settings.tutorTrack = t.dataset.track; save(); paint(); return; }
  if (act === "bank-reset") { game = E.resetBankroll(game); sessionRolls = []; toast("Practice chips reset to $1,000."); save(); paint(); return; }
  if (act === "fair-reset") { allRolls = []; sessionRolls = []; toast("Fair Dice history cleared on this device."); save(); paint(); return; }
  if (act === "export") { openSheet(lockedExport()); return; }
  if (act === "for") { openSheet(forSheet()); return; }
  if (act === "confirm-take") { confirmTake(); return; }
  if (act === "premium") { setView("premium"); return; }
}

function setView(next) {
  view = next;
  if (next !== "play") stopTimer();
  else startTimer();
  paint();
}

function startMode(mode) {
  if (game.mode !== mode || view === "home") {
    if (E.tableTotal(game) || game.phase !== "come-out") game = E.switchMode(game, mode);
    else game.mode = mode === "crapless" ? "crapless" : "regular";
  }
  view = "play";
  page = 1;
  save();
  paint();
  snap();
  startTimer();
}

function switchMode(mode) {
  if (game.mode === mode) return;
  game = E.switchMode(game, mode);
  if (mode === "crapless" && betTab === "lay") betTab = "place";
  toast(mode === "crapless" ? "Crapless rules. Don't bets and ATS are off." : "Regular rules.");
  save();
  paint();
}

function addBet(ds) {
  if (rolling) return;
  const spot = spotFrom(ds);
  if (spot.kind === "dontComePoint") {
    toast("That Don't Come is already on a number. Use minus to take it down.");
    return;
  }
  let amount = settings.chip;
  let note = "";
  if (spot.kind === "horn") {
    const posted = Math.floor(amount / 400) * 400;
    if (!posted) {
      toast("Horn is posted in $4 units. A $1 chip is short.");
      return;
    }
    if (posted !== amount) note = "Horn uses $4 units. " + money(amount - posted) + " stayed in practice chips.";
    amount = posted;
  }
  const res = E.placeBet(game, spot, amount);
  if (!res.ok) { toast(res.error); return; }
  game = res.state;
  A.chip();
  haptic(10);
  const edge = E.edgeFor(spot, game.mode);
  if (note) toast(note);
  else if (settings.tutorOn && edge > 5 && !mutedTips["edge-" + spot.kind]) {
    toast(E.describeSpot(spot) + " · " + edge + "% house edge. Lowest edge is not the same as a win.");
  }
  save();
  paint();
  startTimer();
}

function spotFrom(ds) {
  const spot = { kind: ds.kind };
  if (ds.number) spot.number = Number(ds.number);
  if (ds.pair) spot.pair = ds.pair;
  return spot;
}

async function takeBet(ds) {
  if (rolling) return;
  const spot = spotFrom(ds);
  let res = E.removeBet(game, spot, settings.chip);
  if (res.needsConfirm) {
    window.__take = { kind: ds.kind, number: ds.number, pair: ds.pair };
    openSheet(dontWarn(res.warning));
    return;
  }
  if (!res.ok && /No bet/.test(res.error || "")) res = E.removeBet(game, spot);
  if (!res.ok) { toast(res.error); return; }
  game = res.state;
  A.chip();
  save();
  paint();
}

function confirmTake() {
  const ds = window.__take;
  closeOverlay();
  if (!ds) return;
  const res = E.removeBet(game, spotFrom(ds), null, { confirm: true });
  if (res.ok) game = res.state;
  save();
  paint();
}

function doBilly() {
  const res = E.placeBillysWay(game, settings.chip);
  game = res.state;
  if (!res.placed.length) { toast(res.skipped[0] ? res.skipped[0].reason : "Can't post Billy's Way."); return; }
  A.chip();
  haptic([10, 30, 10]);
  const skipped = res.skipped.length ? " Skipped " + res.skipped.length + "." : "";
  toast("Billy's Way posted " + res.placed.length + " bets." + skipped);
  if (settings.tutorOn) openTutor(0, "billy");
  save();
  paint();
}

function doPress() {
  const res = E.press(game);
  if (!res.ok) { toast("Press: " + res.error); return; }
  game = res.state;
  A.press();
  haptic(12);
  toast(res.label);
  if (settings.tutorOn) openTutor(0, "press");
  save();
  paint();
}

function doPower() {
  const res = E.powerPress(game);
  if (!res.ok) { toast("Power Press: " + res.error); return; }
  game = res.state;
  A.press();
  haptic(16);
  toast((res.capped ? "Capped at $500. " : "") + "Power Press +" + money(res.added) + ". " + money(res.back) + " stays in your chips.");
  if (settings.tutorOn) openTutor(0, "power");
  save();
  paint();
}

function runStrategy(id) {
  const card = S.strategyById(id);
  if (!card) return;
  if (card.lesson) { openSheet("<h2>" + card.name + "</h2><p>" + card.how + "</p><div class='actions'><button class='go' data-act='close'>Got it</button></div>"); return; }
  if (card.mode !== "both" && card.mode !== game.mode) {
    toast(card.name + " is for " + card.mode + ".");
    return;
  }
  game.strategy = { id, rolls: 0, data: {} };
  view = "play";
  page = 1;
  const res = S.autoBet(game, id, settings.chip);
  game = res.state;
  toast(res.message || card.name + " is placing bets for you. Cancel any time.");
  save();
  paint();
  startTimer();
}

async function doRoll() {
  if (rolling || view !== "play") return;
  rolling = true;
  stopTimer();
  A.setMuted(!settings.sound);
  if (game.strategy && game.strategy.id) {
    const maintained = S.autoBet(game, game.strategy.id, settings.chip);
    game = maintained.state;
    if (maintained.message) toast(maintained.message);
  }
  const dice = E.rollDice();
  const from = page;
  if (settings.showDice) { returnPage = from; page = 2; }
  paint();
  snap();
  A.pop();
  A.rattle();
  haptic(18);
  await animateDice(dice);
  const settled = E.settle(game, dice.d1, dice.d2);
  game = settled.state;
  rememberRoll(settled);
  if (settled.net > 0) { A.win(); haptic([12, 40, 16]); }
  else if (settled.result === "seven-out") { A.seven(); haptic(40); }
  else A.chip();
  if (settings.showDice) {
    page = returnPage;
  }
  paint();
  snap();
  if (page !== 2) showRollToast(settled);
  celebrate(settled);
  maybeTutor(settled);
  rolling = false;
  save();
  startTimer();
}

function rememberRoll(settled) {
  const rec = {
    d1: settled.dice.d1,
    d2: settled.dice.d2,
    total: settled.dice.total,
    result: settled.result,
    phaseBefore: settled.result === "natural" || settled.result === "craps" || settled.result === "point-set" ? "come-out" : "point",
    mode: game.mode,
    net: settled.net,
    source: settled.dice.source || E.getRngSource(),
  };
  sessionRolls.push(rec);
  allRolls.push(rec);
  if (allRolls.length > 8000) allRolls.splice(0, allRolls.length - 8000);
}

function animateDice(dice) {
  const reduce = motionOff();
  const ms = reduce ? 160 : 1200;
  const els = [...document.querySelectorAll("#dice-row .die2d")];
  if (!els.length) return wait(ms);
  const start = performance.now();
  let lastSwap = 0;
  return new Promise((resolve) => {
    const tick = (now) => {
      const t = now - start;
      if (!reduce && t < ms - 220) {
        const lift = Math.sin((t / ms) * Math.PI) * 46;
        els.forEach((el, i) => {
          const spin = (t / 7) * (i ? -1 : 1);
          el.style.transform = "translateY(" + (-lift) + "px) rotate(" + spin + "deg)";
          if (now - lastSwap > 70) el.innerHTML = pipsHTML(1 + Math.floor((t / 60 + i * 3) % 6));
        });
        lastSwap = now - lastSwap > 70 ? now : lastSwap;
        requestAnimationFrame(tick);
      } else {
        const faces = [dice.d1, dice.d2];
        els.forEach((el, i) => {
          el.innerHTML = pipsHTML(faces[i]);
          el.style.transform = "translateY(0) rotate(0deg)";
          el.setAttribute("aria-label", "Die showing " + faces[i]);
        });
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function celebrate(settled) {
  const big = settled.net >= 2500 || settled.decisions.some((d) => d.rearmed);
  const seven = settled.result === "seven-out";
  if (!big && !seven && settled.net <= 0) return;
  if (!big && !seven) {
    /* minor win: Billie stays in the toast */
    return;
  }
  const pose = seven
    ? "assets/mascots/billie/billie-C-sevenout.svg"
    : (settled.net >= 10000 ? "assets/mascots/billie/billie-C-winner.svg" : "assets/mascots/billie/billie-C-cheer.svg");
  const title = seven ? "Seven-out" : "Winner";
  const line = seven
    ? "That hand is over. Long hands happen; so do quick ones. Dice have no memory."
    : settled.narrative;
  openSheet(
    "<div class='celebrate-body'><img src='" + pose + "' alt='Bubbles Billie'><strong>" +
    (settled.net >= 0 ? "+" : "") + money(settled.net) + "</strong><p>" + title + ". " + line +
    "</p><p class='muted'>Practice chips</p><div class='actions'><button class='go' data-act='close'>Keep playing</button></div></div>",
    true
  );
}

function maybeTutor(settled) {
  if (!settings.tutorOn || !tour) return;
  if (settled.result === "point-set") openTutor(3);
  else if (settled.result === "seven-out" || settled.result === "point-made") openTutor(5);
}

function currentTip() {
  const experienced = settings.tutorTrack === "experienced";
  const point = game.point;
  if (tour) {
    const steps = tutorSteps();
    return steps[Math.min(tutorStep, steps.length - 1)];
  }
  if (game.phase === "come-out" && game.mode === "crapless") {
    return {
      id: "off-c",
      title: "Come-out",
      body: experienced
        ? "1 in 6 chance of a 2/3/11/12 point. Max odds there is 3x."
        : "Come-out! Only a 7 wins right away. Nothing loses on this roll.",
    };
  }
  if (game.phase === "come-out") {
    return {
      id: "off-r",
      title: "Come-out",
      body: experienced
        ? "Place and Buy are off on the come-out. Pass is the best entry. Regular Pass + 3-4-5x is 0.37%."
        : "Come-out! Bet Pass: 7 or 11 wins, 2, 3, or 12 loses, anything else is the point.",
    };
  }
  return {
    id: "point",
    title: "Point " + point,
    body: experienced
      ? "Max " + E.oddsMultiple(point) + "x odds. Billy's Way is 1.71% blended in Regular and 1.43% in Crapless."
      : "Point is " + point + ". Add Odds. They have no house edge. Want more? Place 6 and 8, or tap Billy's Way.",
  };
}

function tutorSteps() {
  const crapless = game.mode === "crapless";
  return [
    { id: "s1", title: "Practice chips", body: "Education only. Play money only. No real gambling, no deposits, no cash-out, no prizes. The machine rolls. Regular has the lower edge. Crapless is a variant." },
    { id: "s2", title: "Puck OFF", body: "Come-out roll. Bet the Pass Line. Your bankroll says Practice chips." },
    { id: "s3", title: "Come-out results", body: crapless ? "Only a 7 wins right away. 2, 3, 11, and 12 become the point. Nothing loses on the come-out." : "7 and 11 win. 2, 3, and 12 lose. 4, 5, 6, 8, 9, and 10 become the point." },
    { id: "s4", title: "Odds", body: "When the puck is ON, add Odds. There is no house edge on odds, up to 3x, 4x, or 5x. The expected loss in chips stays tied to the flat bet. Swings get bigger." },
    { id: "s5", title: "Numbers", body: "Place 6 and 8 (1.52%). On 4, 5, 9, and 10, Buy is cheaper than Place when the 5% commission is taken only on a win." },
    { id: "s6", title: "The cycle", body: "A point hit turns the puck OFF. A seven-out takes the line, Place, and Buy. That is normal. Dice have no memory." },
    { id: "s7", title: "Good and costly", body: "Lower edge: Pass or Come with odds, Place 6/8, Buy 4/5/9/10. Higher edge: Field, hardways, hops, Big Red, ATS, Repeaters, and Hard Way All Day at 21.4%." },
  ];
}

function openTutor(step, force) {
  if (typeof step === "number") tutorStep = step;
  const tip = force === "billy"
    ? { id: "billy", title: "Billy's Way", body: settings.tutorTrack === "experienced" ? "1.71% blended in Regular, 1.43% in Crapless. Each spot is the cheaper way to bet that number. A 7 takes them all. Seven-out exposure is 6.4 units in Regular and 10.4 in Crapless per press." : "Billy's Way buys the outside numbers and places 6 and 8. A 7 takes them all down." }
    : force === "press"
      ? { id: "press", title: "Press", body: "That extra unit came from your chips. Bigger bet, same odds. The house edge does not change. What is at risk, and the swings, go up." }
      : force === "power"
        ? { id: "power", title: "Power Press", body: "The win was already yours. Putting it back on the number is not house money. Same odds, bigger swings." }
        : currentTip();
  const steps = tour ? tutorSteps().length : 0;
  const count = steps ? "<p class='muted'>Step " + (tutorStep + 1) + " of " + steps + "</p>" : "";
  openSheet(
    "<header><img src='assets/mascots/dealer-billy/billy-A-hello.svg' alt='Dealer Billy, the tutor'><div><p class='tag'>BILLY TIPS</p><h2>" + tip.title + "</h2></div></header>" +
    count + "<p>" + tip.body + "</p>" +
    "<div class='actions'><button data-act='why'>Why?</button><button data-act='mute-tip'>Mute this tip</button><button class='go' data-act='gotit'>Got it</button></div>"
  );
}

function advanceTutor() {
  if (!tour) { closeOverlay(); return; }
  tutorStep += 1;
  if (tutorStep >= tutorSteps().length) { tour = false; closeOverlay(); return; }
  openTutor(tutorStep);
}

function whySheet() {
  return "<h2>Why the edge is the edge</h2><p>X to 1 means winnings on top of your bet. X for 1 includes the stake in the number, so 165 for 1 pays $164 profit.</p><p>Pass Line in Regular is 1.41% per bet, and 0.37% combined with 3-4-5x odds. The odds themselves are 0%. Crapless Pass is 5.38%, and 1.26% with max odds.</p><p>Place 6/8 is 1.52%. Buy 4/10 is 1.67% with commission on wins only. Hard Way All Day is 21.43%, about 1 win in 210.</p><p>The Blazing meter only shows how long this hand has lasted. It never changes odds or advice. Dice have no memory.</p><div class='actions'><button class='go' data-act='close'>Back</button></div>";
}

function billyHelp() {
  return "<h2>What's Billy's Way?</h2><p>One tap posts a separate bet on every number. Regular buys 4, 5, 9, and 10 at the chip you selected, and places 6 and 8 at chip × 6/5. Crapless also buys 2, 3, 11, and 12.</p><p>A $5 chip is Buy $5 and Place $6. The blend is 1.71% in Regular and 1.43% in Crapless. A 7 takes every spot.</p><div class='actions'><button class='go' data-act='play' data-mode='regular'>Play Regular</button><button data-act='close'>Close</button></div>";
}

function forSheet() {
  return "<h2>To 1 and for 1</h2><p><b>To 1</b> is profit on top of your bet. A $1 hop at 15 to 1 pays $15 profit and the $1 stays up.</p><p><b>For 1</b> includes the stake. Hard Way All Day at 165 for 1 pays $164 profit. Low Rolls at 31 for 1 pays $30 profit. The stake stays up and the lamps start over.</p><div class='actions'><button class='go' data-act='close'>Got it</button></div>";
}

function dontWarn(warning) {
  return "<header><img src='assets/mascots/dealer-billy/billy-A-tip.svg' alt='Dealer Billy'><div><h2>Take down Don't?</h2></div></header><p>" + warning + " Confirm only if you mean to give that up.</p><div class='actions'><button data-act='close'>Leave it up</button><button class='go' data-act='confirm-take'>Take it down</button></div>";
}

function lockedExport() {
  return "<h2>Export CSV</h2><p class='lock'>Premium · locked</p><p>Standard keeps your roll history on this device. CSV export is a Premium preview. There is no purchase on this test build.</p><div class='actions'><button class='go' data-act='close'>Close</button></div>";
}

function openSheet(html, celebrate) {
  stopTimer();
  document.getElementById("overlay").innerHTML = "<div class='overlay" + (celebrate ? " celebrate" : "") + "'><div class='sheet' role='dialog'>" + html + "</div></div>";
}
function closeOverlay() {
  const el = document.getElementById("overlay");
  if (el) el.innerHTML = "";
  window.__take = null;
  if (view === "play") startTimer();
}

function toast(text) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.className = "toast show";
  el.innerHTML = "<div>" + text + "</div>";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 2500);
}
function hideToast() {
  const el = document.getElementById("toast");
  if (el) el.className = "toast";
}
function showRollToast(settled) {
  const el = document.getElementById("toast");
  const sign = settled.net > 0 ? "+" : "";
  el.className = "toast show";
  el.innerHTML = "<button data-act='toast-go' aria-label='Open the dice'>" +
    "<span class='faces'>" + miniDie(settled.dice.d1) + miniDie(settled.dice.d2) + "</span></button>" +
    "<div><b>" + settled.dice.line + "</b><div>" + sign + money(settled.net) + " practice chips</div></div>";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 2500);
}

function startTimer() {
  stopTimer();
  if (!settings.autoRoll || view !== "play" || rolling || document.querySelector(".overlay")) return;
  timerStart = performance.now();
  const loop = (now) => {
    const p = Math.min(1, (now - timerStart) / 15000);
    document.querySelectorAll(".ring").forEach((ring) => { ring.style.setProperty("--p", (p * 100).toFixed(2) + "%"); });
    if (p >= 1) { doRoll(); return; }
    timerRAF = requestAnimationFrame(loop);
  };
  timerRAF = requestAnimationFrame(loop);
}
function stopTimer() {
  if (timerRAF) cancelAnimationFrame(timerRAF);
  timerRAF = 0;
}

function toggleSetting(key) {
  if (key === "tutorTrack") return;
  settings[key] = !settings[key];
  if (key === "workingComeOut") game.placeWorkingOnComeOut = settings.workingComeOut;
  if (key === "hardwaysComeOut") game.hardwaysWorkingOnComeOut = settings.hardwaysComeOut;
  if (key === "comeOddsOff") game.comeOddsOffOnComeOut = settings.comeOddsOff;
  if (key === "sound") A.setMuted(!settings.sound);
  if (key === "reduced") document.documentElement.classList.toggle("reduce", settings.reduced);
  save();
  paint();
  if (view === "play") startTimer();
}

function paint() {
  const scrolls = [...document.querySelectorAll(".page")].map((p) => p.scrollTop);
  const play = view === "play";
  document.getElementById("hud").classList.toggle("hidden", !play);
  document.getElementById("stage").classList.toggle("hidden", !play);
  document.getElementById("dots").classList.toggle("hidden", !play);
  document.getElementById("dock").classList.toggle("hidden", !play);
  document.getElementById("panel").classList.toggle("hidden", play);
  document.getElementById("hud").innerHTML = hudHTML();
  document.getElementById("tabs").innerHTML = tabsHTML();
  if (play) {
    document.getElementById("pager").innerHTML = pageHTML(0) + pageHTML(1) + pageHTML(2);
    document.getElementById("dots").innerHTML = dotsHTML();
    document.getElementById("dock").innerHTML = dockHTML();
    snap();
    document.querySelectorAll(".page").forEach((p, i) => { if (scrolls[i]) p.scrollTop = scrolls[i]; });
  } else {
    document.getElementById("panel").innerHTML = panelHTML();
  }
}

function hudHTML() {
  const on = E.tableTotal(game);
  const puck = game.phase === "point"
    ? "<div class='puck on' aria-label='Point " + game.point + "'>" + game.point + "</div>"
    : "<div class='puck off' aria-label='Puck off'>OFF</div>";
  return "<div class='hud-bank'><small>Practice chips</small><strong>" + money(game.bankroll) + "</strong><em>On table " + money(on) + "</em></div>" +
    "<div class='hud-mid'>" + puck + blazeMini() + "</div>" +
    "<div class='hud-side'><button class='pill" + (settings.tutorOn ? " on" : "") + "' data-act='tips' aria-pressed='" + settings.tutorOn + "'><img src='assets/mascots/dealer-billy/small/billy-A-avatar-round.svg' alt=''>Billy Tips</button>" +
    "<button class='icon-btn' data-act='view' data-view='fair' aria-label='Fair Dice'>FAIR</button></div>";
}

function blazeMini() {
  const tier = E.blazingTier(E.blazingScore(game.hand), game.hand.points);
  return "<small title='Cosmetic meter. It never changes odds or advice.'>" + tier.toUpperCase() + "</small>";
}

function tabsHTML() {
  const items = [
    ["play", "Play"],
    ["fair", "Fair Dice"],
    ["learn", "Learn"],
    ["premium", "Premium"],
    ["settings", "Settings"],
  ];
  return items.map(([id, label]) => {
    const active = (id === "play" && (view === "play" || view === "home")) || view === id;
    const dest = id === "play" ? (view === "home" ? "home" : "play") : id;
    return "<button class='tab" + (active ? " on" : "") + "' data-act='view' data-view='" + dest + "'>" + icon(id) + label + "</button>";
  }).join("");
}

function icon(name) {
  const paths = {
    play: "M8 5v14l11-7z",
    fair: "M4 19V5M10 19V9M16 19V7M22 19H2",
    learn: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
    premium: "M12 3l2.2 6.6H21l-5.4 4 2.1 6.4L12 16.8 6.3 20l2.1-6.4L3 9.6h6.8z",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  };
  return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7' aria-hidden='true'><path d='" + (paths[name] || "") + "'/></svg>";
}

function dotsHTML() {
  return [0, 1, 2].map((i) => "<button class='dot" + (page === i ? " on" : "") + "' data-act='page' data-page='" + i + "' aria-label='" + ["Side bets", "Board", "Dice"][i] + "'></button>").join("");
}

function pageHTML(i) {
  if (i === 0) return "<section class='page side'>" + sideHTML() + "</section>";
  if (i === 1) return "<section class='page'>" + boardHTML() + "</section>";
  return "<section class='page'>" + domeHTML() + "</section>";
}

function spotButton(opts) {
  const stake = opts.stake || 0;
  return "<button class='spot" + (opts.cls ? " " + opts.cls : "") + (stake ? " has" : "") + "' data-act='bet' data-kind='" + opts.kind + "'" +
    (opts.number != null ? " data-number='" + opts.number + "'" : "") +
    (opts.pair ? " data-pair='" + opts.pair + "'" : "") +
    " aria-label='" + opts.label + (stake ? ", " + money(stake) : "") + "'>" +
    edgeDot(opts.kind, opts.number, opts.pair) +
    "<small>" + opts.pay + "</small><b>" + opts.name + "</b>" + stakeLabel(stake) + (opts.extra || "") + "</button>";
}

function boardHTML() {
  const b = game.bets;
  const crapless = game.mode === "crapless";
  const horns = [
    [2, "1-1", "ACES", "30:1"],
    [3, "1-2", "ACE DEUCE", "15:1"],
    [11, "5-6", "YO", "15:1"],
    [12, "6-6", "MIDNIGHT", "30:1"],
  ];
  const horn = horns.map(([n, pair, name, pay]) => spotButton({
    kind: "hop", pair, number: n, name, pay, stake: b.hops[pair], label: name + " hop",
  })).join("");
  const hards = [[4, "7:1"], [6, "9:1"], [8, "9:1"], [10, "7:1"]].map(([n, pay]) => spotButton({
    kind: "hardway", number: n, name: "HARD " + n, pay, stake: b.hardways[n], label: "Hard " + n,
  })).join("");
  const lamps = [4, 6, 8, 10].map((n) => "<i class='lamp" + (game.progress.hardAllDay[n] ? " on" : "") + "'>" + n + "</i>").join("");
  const ats = crapless ? "" : "<div class='ats'>" + [
    ["small", "LOW ROLLS", "31 FOR 1"],
    ["all", "ROLL 'EM ALL", "156 FOR 1"],
    ["tall", "HIGH ROLLS", "31 FOR 1"],
  ].map(([kind, name, pay]) => spotButton({ kind, name, pay, stake: b[kind], label: name, extra: bonusLamps(kind) })).join("") + "</div>";
  const nums = E.numbersFor(game);
  const numHTML = nums.map((n) => {
    const come = game.bets.comeBets[n];
    return "<div class='numbox'><button class='half" + (b.buy[n] ? " has" : "") + "' data-act='bet' data-kind='buy' data-number='" + n + "' aria-label='Buy " + n + (b.buy[n] ? ", " + money(b.buy[n]) : "") + "'>BUY" +
      (b.buy[n] ? "<div>" + money(b.buy[n]) + "</div>" : "") + "</button><div class='face'>" + n +
      (come && come.amount ? "<div class='cmark'>C " + money(come.amount) + "</div>" : "") +
      "</div><button class='half" + (b.place[n] ? " has" : "") + "' data-act='bet' data-kind='place' data-number='" + n + "' aria-label='Place " + n + (b.place[n] ? ", " + money(b.place[n]) : "") + "'>PLACE" +
      (b.place[n] ? "<div>" + money(b.place[n]) + "</div>" : "") + "</button></div>";
  }).join("");
  const dont = crapless ? "" : spotButton({ kind: "dontPass", name: "DON'T", pay: "BAR 12", stake: b.dontPass, label: "Don't Pass" }) +
    spotButton({ kind: "dontPassOdds", name: "LAY", pay: "6x", stake: b.dontPassOdds, label: "Lay odds" });
  return "<div class='seg mode-switch'><button class='" + (game.mode === "regular" ? "on" : "") + "' data-act='mode' data-mode='regular'>Regular</button><button class='" + (game.mode === "crapless" ? "on" : "") + "' data-act='mode' data-mode='crapless'>Crapless</button></div><div class='felt'>" +
    "<div class='prop'><div class='box2'>" + horn + "</div><div class='midcol'>" +
    spotButton({ kind: "any7", cls: "bigred", name: "BIG RED", pay: "4 TO 1", stake: b.any7, label: "Big Red any seven" }) +
    spotButton({ kind: "hardAllDay", cls: "hwad", name: "ALL DAY", pay: "165 FOR 1", stake: b.hardAllDay, label: "Hard Way All Day", extra: "<span class='lamps'>" + lamps + "</span>" }) +
    "</div><div class='box2'>" + hards + "</div></div>" +
    "<div class='band three'>" +
    spotButton({ kind: "anyCraps", name: "ANY CRAPS", pay: "7 TO 1", stake: b.anyCraps, label: "Any Craps" }) +
    spotButton({ kind: "horn", name: "HORN", pay: "$4 UNITS", stake: b.horn, label: "Horn four way" }) +
    spotButton({ kind: "ce", name: "C & E", pay: "C 7 · E 15", stake: b.ce, label: "C and E" }) +
    "</div>" + ats +
    "<div class='nums " + (crapless ? "crap" : "reg") + "'>" + numHTML + "</div>" +
    "<div class='band" + (crapless ? "" : " two") + "'>" +
    spotButton({ kind: "come", name: "COME", pay: crapless ? "7 WINS" : "7 / 11", stake: b.come, label: "Come" }) +
    (crapless ? "" : spotButton({ kind: "dontCome", name: "DON'T COME", pay: "BAR 12", stake: b.dontCome, label: "Don't Come" })) +
    "</div>" +
    "<div class='band'>" + spotButton({ kind: "field", cls: "field", name: "FIELD", pay: "2 AND 12 PAY 2:1", stake: b.field, label: "Field" }) + "</div>" +
    "<div class='band " + (crapless ? "two" : "four") + "'>" +
    spotButton({ kind: "pass", name: "PASS", pay: "LINE", stake: b.pass, label: "Pass Line" }) +
    spotButton({ kind: "passOdds", name: "ODDS", pay: "3-4-5x", stake: b.passOdds, label: "Pass odds" }) +
    dont + "</div></div>" +
    "<div class='keys'><button class='key" + (game.betsOff ? " on" : "") + "' data-act='betsoff'>BETS OFF</button>" +
    "<button class='key primary' data-act='billy'>BILLY'S WAY<small>Buy " + money(settings.chip) + " · 6/8 " + money(E.billysWayAmounts(settings.chip).place) + "</small></button>" +
    "<button class='key' data-act='reset'>RESET</button></div>" +
    betPanelHTML();
}

function bonusLamps(kind) {
  const set = kind === "small" ? [2, 3, 4, 5, 6] : kind === "tall" ? [8, 9, 10, 11, 12] : [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
  return "<span class='lamps'>" + set.map((n) => "<i class='lamp" + (game.progress[kind][n] ? " on" : "") + "'>" + n + "</i>").join("") + "</span>";
}

function betPanelHTML() {
  const crapless = game.mode === "crapless";
  const tabs = ["place", "buy", ...(crapless ? [] : ["lay"]), "odds"];
  if (!tabs.includes(betTab)) betTab = "place";
  const ledLast = game.lastDice ? game.lastDice.d1 + "·" + game.lastDice.d2 : "—";
  let rows = "";
  if (betTab === "place" || betTab === "buy") {
    const kind = betTab;
    rows = E.numbersFor(game).map((n) => {
      const stake = game.bets[kind][n] || 0;
      const pay = kind === "place" ? placePayLabel(n) : buyPayLabel(n);
      const edge = E.edgeFor({ kind, number: n }, game.mode);
      return rowHTML(kind, n, n, pay + " · " + edge + "%", stake);
    }).join("");
  } else if (betTab === "odds") {
    rows = oddsRows();
  } else {
    rows = layRows();
  }
  return "<section class='betpanel'><div class='led'><div><span>POINT</span><b>" + (game.point || "OFF") + "</b></div><div><span>LAST ROLL</span><b>" + ledLast + "</b></div><div><span>BALANCE</span><b>" + money(game.bankroll) + "</b></div></div>" +
    "<div class='btabs'>" + tabs.map((id) => "<button class='btab" + (betTab === id ? " on" : "") + "' data-act='tab' data-tab='" + id + "'>" + id.toUpperCase() + "</button>").join("") + "</div>" +
    "<div class='betlist'>" + rows + layoutExtras() + "</div></section>";
}

function layoutExtras() {
  const b = game.bets;
  const rows = [];
  const add = (kind, number, title, sub, stake) => {
    if (!stake) return;
    rows.push(rowHTML(kind, number, title, sub, stake));
  };
  if (game.phase === "come-out" && b.pass) add("pass", null, "Pass Line", "take down before a point", b.pass);
  if (b.come) add("come", null, "Come", "still in the Come box", b.come);
  if (game.mode !== "crapless" && b.dontCome) add("dontCome", null, "Don't Come", "before it moves to a number", b.dontCome);
  add("field", null, "Field", "2 and 12 pay 2 to 1", b.field);
  add("any7", null, "Big Red", "4 to 1", b.any7);
  add("anyCraps", null, "Any Craps", "7 to 1", b.anyCraps);
  add("ce", null, "C & E", "stays up when it wins", b.ce);
  add("horn", null, "Horn", "comes down in $4 units", b.horn);
  [4, 6, 8, 10].forEach((n) => add("hardway", n, "Hard " + n, "one roll pair", b.hardways[n]));
  if (game.mode !== "crapless") {
    add("small", null, "Low Rolls", "31 for 1", b.small);
    add("tall", null, "High Rolls", "31 for 1", b.tall);
    add("all", null, "Roll 'Em All", "156 for 1", b.all);
  }
  add("hardAllDay", null, "Hard Way All Day", "165 for 1 · minus clears the lamps", b.hardAllDay);
  if (!rows.length) return "";
  return "<p class='also'>Also on the layout</p>" + rows.join("");
}

function rowHTML(kind, number, title, sub, stake, pair) {
  return "<div class='betrow'><button class='step' data-act='take' data-kind='" + kind + "'" +
    (number != null ? " data-number='" + number + "'" : "") + (pair ? " data-pair='" + pair + "'" : "") +
    " aria-label='Take down " + title + "'>−</button><div class='meta'><div><b>" + title + "</b><small> " + sub + "</small></div><b>" +
    (stake ? money(stake) : "—") + "</b></div><button class='step' data-act='bet' data-kind='" + kind + "'" +
    (number != null ? " data-number='" + number + "'" : "") + (pair ? " data-pair='" + pair + "'" : "") +
    " aria-label='Add chip to " + title + "'>+</button></div>";
}

function placePayLabel(n) {
  if (n === 6 || n === 8) return "7 to 6";
  if (n === 5 || n === 9) return "7 to 5";
  if (n === 4 || n === 10) return "9 to 5";
  if (n === 2 || n === 12) return "11 to 2";
  return "11 to 4";
}
function buyPayLabel(n) {
  if (n === 6 || n === 8) return "6 to 5, vig on win";
  if (n === 5 || n === 9) return "3 to 2, vig on win";
  if (n === 4 || n === 10) return "2 to 1, vig on win";
  if (n === 2 || n === 12) return "6 to 1, vig on win";
  return "3 to 1, vig on win";
}
function oddsRows() {
  const bits = [];
  const max = game.point && game.bets.pass ? E.maxPassOdds(game.bets.pass, game.point) : 0;
  bits.push(rowHTML("passOdds", null, "Pass odds", max ? "max " + money(max) : "after a point", game.bets.passOdds));
  Object.keys(game.bets.comeBets).forEach((n) => {
    const slot = game.bets.comeBets[n];
    if (!slot || !slot.amount) return;
    bits.push(rowHTML("comeOdds", Number(n), "Come " + n + " odds", "max " + money(E.maxPassOdds(slot.amount, Number(n))), slot.odds || 0));
  });
  if (bits.length === 1 && !game.bets.pass) bits[0] = "<p class='muted'>Bet the Pass Line on the come-out, then take odds.</p>";
  return bits.join("");
}
function layRows() {
  if (game.mode === "crapless") return "";
  const max = game.bets.dontPass ? E.maxLayOdds(game.bets.dontPass) : 0;
  let html = rowHTML("dontPass", null, "Don't Pass", "bar 12 · take down warns once a point is on", game.bets.dontPass);
  html += rowHTML("dontPassOdds", null, "Lay odds", max ? "max " + money(max) + " · wins 3x/4x/5x" : "need Don't Pass", game.bets.dontPassOdds);
  Object.keys(game.bets.dontComeBets).forEach((n) => {
    const slot = game.bets.dontComeBets[n];
    if (!slot || !slot.amount) return;
    html += rowHTML("dontComePoint", Number(n), "Don't Come " + n, "flat · take down gives up the edge", slot.amount);
    html += rowHTML("dontComeOdds", Number(n), "Lay " + n, "max " + money(E.maxLayOdds(slot.amount)), slot.odds || 0);
  });
  return html;
}

function sideHTML() {
  const reps = E.NUMBERS.map((n) => {
    const need = E.REPEATER_NEEDS[n];
    const have = game.repeaterCount[n] || 0;
    const pips = Array.from({ length: need }, (_, i) => (i < have ? "●" : "○")).join("");
    const stake = game.bets.repeaters[n] || 0;
    return "<article class='rep'><header><b>" + n + "</b><small>" + E.REPEATER_FOR[n] + " FOR 1</small></header>" +
      "<div class='pips'>" + pips + " " + have + "/" + need + "</div>" +
      "<small class='" + E.edgeClass(E.REPEATER_EDGE[n]) + "'>" + E.REPEATER_EDGE[n] + "% · " + (stake ? money(stake) : "no bet") + "</small>" +
      "<div class='row'><button data-act='bet' data-kind='repeater' data-number='" + n + "'>Add</button>" +
      "<button data-act='take' data-kind='repeater' data-number='" + n + "'>Take</button></div></article>";
  }).join("");
  const hops = E.ALL_HOPS.map((key) => {
    const hard = E.HARD_HOPS.includes(key);
    const [a, b] = key.split("-").map(Number);
    const stake = game.bets.hops[key] || 0;
    return "<div class='hop" + (hard ? " hard" : "") + (stake ? " has" : "") + "'><button data-act='bet' data-kind='hop' data-pair='" + key + "' aria-label='Hop " + key + "'>" +
      "<b>" + a + "·" + b + "</b>" + (a + b) + " · " + (hard ? "30 to 1" : "15 to 1") +
      (stake ? "<div>" + money(stake) + "</div>" : "") + "</button>" +
      (stake ? "<button data-act='take' data-kind='hop' data-pair='" + key + "' aria-label='Take down hop " + key + "'>Take</button>" : "") + "</div>";
  }).join("");
  return "<h2>Repeaters</h2><p class='sub'>A number before a 7. Any 7 loses, including a come-out 7. $1 to $25. <button data-act='for'>For 1?</button></p><div class='reps'>" + reps + "</div>" +
    "<h2>Hops</h2><p class='sub'>One exact pair on the next roll. Hard hops 30 to 1. Easy hops 15 to 1. The four Horn numbers are the same bet as the board.</p><div class='hops'>" + hops + "</div>";
}

function domeHTML() {
  const d1 = game.lastDice ? game.lastDice.d1 : 1;
  const d2 = game.lastDice ? game.lastDice.d2 : 1;
  const bubbles = [12, 28, 44, 61, 73, 18].map((left, i) => "<i class='bubble' style='left:" + left + "%;width:" + (10 + i * 3) + "px;height:" + (10 + i * 3) + "px;animation-delay:" + (i * 0.6) + "s'></i>").join("");
  const tier = E.blazingTier(E.blazingScore(game.hand), game.hand.points);
  const tiers = ["cold", "warm", "hot", "blazing"];
  const active = tiers.indexOf(tier);
  const meter = "<div class='meter' title='Cosmetic meter. It never changes odds or advice.'>" +
    tiers.map((name, i) => "<i class='" + (i <= active ? "on-" + tier : "") + "'></i>").join("") +
    "<span>" + tier.toUpperCase() + "</span></div>";
  const hist = game.history.map((h) => "<span class='rchip" + (h.total === 7 ? " seven" : "") + "'>" + h.total + "</span>").join("");
  const hit = game.lastWin ? (game.lastWin.kind === "buy" ? "Buy " : "Place ") + game.lastWin.number + " +" + money(game.lastWin.profit) : "";
  const line = game.lastDice ? game.lastDice.line : "Waiting for a roll";
  return "<div class='dome-screen'><div class='dome-stage'><div class='dome'>" + bubbles +
    "<div class='dice-row' id='dice-row'>" + flatDie(d1, "die-a") + flatDie(d2, "die-b") + "</div></div></div>" +
    "<div class='result-line'>" + line + "<small>" + (game.lastNarrative || "Secure random dice. The tumble is only the picture.") + "</small></div>" +
    "<div style='display:flex;justify-content:center'>" + (game.phase === "point" ? "<div class='puck on'>" + game.point + "</div>" : "<div class='puck off'>OFF</div>") + "</div>" +
    meter + "<p class='muted' style='margin:0'>Hand " + game.hand.rolls + " rolls · " + game.hand.points + " points. A 7 is always 1 in 6.</p>" +
    "<div class='hitline'>" + hit + "</div>" +
    "<div class='rollstrip' aria-label='Last rolls'>" + hist + "</div></div>";
}

function dockHTML() {
  const st = E.pressStatus(game);
  const chips = E.CHIPS.map((c) => "<button class='chip-btn" + (settings.chip === c ? " on" : "") + "' data-act='chip' data-cents='" + c + "' aria-label='$" + (c / 100) + " chip'>" + chipHTML(c) + "</button>").join("");
  const undo = game.pressStack.length ? "<div class='undo'><button data-act='undo'>UNDO</button><button data-act='clear'>CLEAR</button></div>" : "";
  const kicker = !st.pressOk ? "<span class='why'>" + (st.pressReason || "") + "</span>" : "";
  return "<div class='pressline'>" + (st.pressOk ? st.label : "PRESS") + " " + kicker + "</div>" +
    "<div class='rollrow'><button class='press-btn' data-act='press'" + (st.pressOk ? "" : " disabled") + ">PRESS</button>" +
    "<button class='roll-btn' data-act='roll' aria-label='Roll the dice'>ROLL<span class='ring'></span></button>" +
    "<button class='press-btn' data-act='power'" + (st.powerOk ? "" : " disabled") + ">POWER<br>PRESS</button></div>" + undo +
    "<div class='rack'>" + chips + "</div>" +
    "<div class='bankbar'><span>Practice chips <strong>" + money(game.bankroll) + "</strong></span><span>On table <strong>" + money(E.tableTotal(game)) + "</strong></span>" +
    (game.strategy ? "<button data-act='stop-strategy'>Stop " + game.strategy.id + "</button>" : "") + "</div>";
}

function panelHTML() {
  if (view === "home") return homeHTML();
  if (view === "fair") return fairHTML();
  if (view === "learn") return learnHTML();
  if (view === "premium") return premiumHTML();
  if (view === "settings") return settingsHTML();
  return homeHTML();
}

function homeHTML() {
  return "<section class='home'><img class='logo' src='assets/logos/billybubs-bubble-craps-color-dark.svg' alt='Billy Bubs Bubble Craps'>" +
    "<div class='home-dome' aria-hidden='true'>" + flatDie(5, "home-d1") + flatDie(2, "home-d2") + "</div>" +
    "<div class='disclaimer'><b>Education only. Play money only.</b> No real gambling, no deposits, no cash-out, no prizes. Every bankroll on this table is practice chips. 18+.</div>" +
    "<div class='modes'><button class='mode-card' data-act='play' data-mode='regular'><b>Regular</b><span>Pass, Don't, odds 3-4-5x. The lower house edge.</span></button>" +
    "<button class='mode-card' data-act='play' data-mode='crapless'><b>Crapless</b><span>Only a come-out 7 wins. 2, 3, 11, and 12 are points. No Don't. No ATS.</span></button></div>" +
    "<button class='cta' data-act='play' data-mode='regular'>Play Regular · 15-second bet timer · auto roll</button>" +
    "<button class='ghost' data-act='tour'>Tutor tour</button>" +
    "<button class='ghost' data-act='billy-help'>What's Billy's Way?</button></section>";
}

function learnHTML() {
  const filters = ["all", "regular", "crapless", "lessons"];
  const cards = S.STRATEGIES.filter((c) => learnFilter === "all" || c.filter.includes(learnFilter)).map((c) => {
    return "<article class='card'><p class='tag'>" + c.mode.toUpperCase() + " · " + c.id + "</p><h3>" + c.name + "</h3><p>" + c.how + "</p><p class='muted'>" + c.edge + " · " + c.risk + "</p><p class='muted'>" + c.bankroll + "</p>" +
      "<button class='cta' data-act='strategy' data-id='" + c.id + "'>" + (c.lesson ? "Read the lesson" : "Run " + c.id) + "</button></article>";
  }).join("");
  return "<h2>Strategy library</h2><div class='filters'>" + filters.map((f) => "<button class='" + (learnFilter === f ? "on" : "") + "' data-act='filter' data-filter='" + f + "'>" + f[0].toUpperCase() + f.slice(1) + "</button>").join("") + "</div>" + cards;
}

function premiumHTML() {
  const rows = [
    ["Field 2 and 12", "2:1"],
    ["Odds, Regular", "3-4-5x"],
    ["Odds, Crapless", "3-3-3-4-5x"],
    ["Lay odds", "6x flat"],
    ["Buy commission", "5% on wins only"],
    ["Hard Way All Day", "165 for 1"],
    ["ATS", "31 / 31 / 156 for 1"],
    ["Repeater pays", "Standard 40–90 for 1"],
    ["Hop pays", "15 / 30 to 1"],
    ["Fair Dice CSV", "Locked"],
    ["Saved presets", "Standard only"],
  ];
  return "<h2>Premium</h2><p class='lock'>Locked preview · no purchase</p><p>Standard rules are on. Custom rules are a preview of what a Premium unlock would change. This test build does not sell anything.</p>" +
    rows.map(([k, v]) => "<div class='setting'><div><b>" + k + "</b><div class='muted'>Standard</div></div><span class='lock'>" + v + "</span></div>").join("") +
    "<article class='card'><h3>With Premium you could preview</h3><p>Your casino's odds and payouts. Live house-edge preview. Presets. Fair Dice CSV export. Hard Way All Day 150–200 for 1. Repeater pay tables.</p><p class='muted'>Shooter skill simulation is not in Bubble Craps.</p></article>";
}

function settingsHTML() {
  const row = (key, label, detail) => "<div class='setting'><div><b>" + label + "</b><div class='muted'>" + detail + "</div></div><button class='switch" + (settings[key] ? " on" : "") + "' data-act='setting' data-key='" + key + "' role='switch' aria-checked='" + settings[key] + "' aria-label='" + label + "'><i></i></button></div>";
  return "<h2>Settings</h2>" +
    row("sound", "Sound", "Dome pop, dice, chips, wins") +
    row("haptics", "Haptics", "Vibration where the phone allows it") +
    row("autoRoll", "Auto roll", "15 seconds, then the machine rolls. ROLL always works.") +
    row("workingComeOut", "Place and Buy working on come-out", "Off is Standard") +
    row("hardwaysComeOut", "Hardways working on come-out", "On is Standard") +
    row("comeOddsOff", "Come odds off on come-out", "On is Standard. The flat Come still works.") +
    row("showDice", "Show the dice on each roll", "Jumps to the dome, then back") +
    row("reduced", "Reduced motion", "Cross-fade instead of sliding and tumbling") +
    "<div class='setting'><div><b>Tutor track</b><div class='muted'>Beginner or experienced</div></div><div class='seg'><button class='" + (settings.tutorTrack === "beginner" ? "on" : "") + "' data-act='track' data-track='beginner'>Beginner</button><button class='" + (settings.tutorTrack === "experienced" ? "on" : "") + "' data-act='track' data-track='experienced'>Experienced</button></div></div>" +
    "<button class='cta' data-act='bank-reset'>Reset bankroll to $1,000</button>" +
    "<button class='ghost' data-act='fair-reset'>Reset Fair Dice history</button>" +
    "<p class='muted'>RNG: " + (E.getRngSource() === "fallback" ? "basic (fallback)" : "secure") + ". Dice use your device's secure random generator, with rejection sampling so every face is equal.</p>";
}

function fairHTML() {
  const rolls = fairScope === "session" ? sessionRolls : fairScope === "last" ? allRolls.slice(-100) : allRolls;
  const test = F.totalsTest(rolls);
  const band = F.sevenBand(Math.max(rolls.length, 1));
  const sevens = rolls.filter((r) => r.total === 7).length;
  const sevenPct = rolls.length ? sevens / rolls.length : 0;
  const faces = F.facesTest(rolls, 1);
  const faces2 = F.facesTest(rolls, 2);
  const doubles = rolls.filter((r) => r.d1 === r.d2).length;
  let hi = { t: 2, d: -Infinity };
  let lo = { t: 2, d: Infinity };
  for (let t = 2; t <= 12; t++) {
    const d = (test.counts[t] || 0) - (test.expected[t - 2] || 0);
    if (d > hi.d) hi = { t, d };
    if (d < lo.d) lo = { t, d };
  }
  const bars = [];
  for (let t = 2; t <= 12; t++) {
    const exp = rolls.length * F.expectedRate(t);
    const got = test.counts[t] || 0;
    const w = rolls.length ? Math.min(100, (got / Math.max(rolls.length * (6 / 36), 1)) * 100) : 0;
    bars.push("<div class='barline'><span>" + t + "</span><div class='track'><span style='width:" + w + "%'></span><em style='left:" + (F.expectedRate(t) / (6 / 36) * 100) + "%'></em></div><span>" + got + "</span></div>");
  }
  const readout = test.readout;
  return "<h2>Fair Dice</h2><p class='lock'>" + readout.badge + "</p><p>" + readout.words + "</p>" +
    "<div class='filters'>" + [["session", "This session"], ["last", "Last 100"], ["all", "All time"]].map(([id, label]) => "<button class='" + (fairScope === id ? "on" : "") + "' data-act='fair-scope' data-scope='" + id + "'>" + label + "</button>").join("") + "</div>" +
    "<article class='card'><h3>Totals vs expected</h3><div class='bars'>" + bars.join("") + "</div><p class='muted'>The mark is the fair share. 7 is 6/36, 16.67%.</p></article>" +
    "<article class='card'><h3>Sevens</h3><p>" + (rolls.length ? (sevenPct * 100).toFixed(1) : "0") + "% vs 16.67% (1 in 6). Normal band about " + (band.low * 100).toFixed(1) + "%–" + (band.high * 100).toFixed(1) + "%.</p></article>" +
    "<article class='card'><h3>Fairness test</h3><p>" + (rolls.length < 180 ? "Roll 180 times for a fair test (now " + rolls.length + ")." : "χ² " + test.chi2.toFixed(2) + " · df 10 · p " + test.p.toFixed(3)) + "</p><p>" + readout.words + "</p></article>" +
    "<article class='card'><h3>Each die</h3><p>Die 1 faces: " + faces.counts.join(" · ") + "</p><p>Die 2 faces: " + faces2.counts.join(" · ") + "</p><p class='muted'>Each face should be near 16.67%.</p></article>" +
    "<article class='card'><h3>Hard vs easy</h3><p>Doubles " + doubles + " of " + rolls.length + " (fair 16.67%).</p></article>" +
    "<article class='card'><h3>Above and below expected</h3><p>" + (rolls.length ? hi.t + ": " + (hi.d >= 0 ? "+" : "") + hi.d.toFixed(1) + " vs expected · " + lo.t + ": " + lo.d.toFixed(1) : "Roll to fill this in.") + "</p></article>" +
    (function () {
      const st = F.streakStats(rolls);
      return "<article class='card'><h3>Streaks</h3><p>Longest run without a 7: " + st.longestDry + ". Current run without a 7: " + st.currentDry + ".</p><p>Longest hand before a seven-out: " + st.longestHand + " rolls. This hand: " + st.currentHand + ".</p><p class='muted'>A long gap is not a sign the next roll is different. A 7 is still 1 in 6.</p></article>";
    })() +
    "<article class='card'><h3>Last rolls</h3><div class='rollstrip'>" + rolls.slice(-20).map((r) => "<span class='rchip" + (r.total === 7 ? " seven" : "") + "'>" + r.total + "</span>").join("") + "</div></article>" +
    "<p>Every roll uses your device's secure random generator. Each die is a fair 1 to 6, and the two dice are independent. Nothing on this screen, not your bets, your streak, or the Blazing meter, can change the next roll.</p>" +
    "<p class='muted'>RNG: " + (E.getRngSource() === "fallback" ? "basic (fallback)" : "secure") + ".</p>" +
    "<button class='ghost' data-act='export'>Export CSV</button>";
}

load();
game.placeWorkingOnComeOut = !!settings.workingComeOut;
A.setMuted(!settings.sound);
mount();
if (view === "play") startTimer();
