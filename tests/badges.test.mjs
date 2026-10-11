import test from "node:test";
import assert from "node:assert/strict";
import * as B from "../js/badges.mjs";
import * as Sess from "../js/session.mjs";

function roll(store, extra) {
  return B.evaluateRoll(store, Object.assign({
    mode: "regular",
    hadBet: true,
    handRolls: 1,
    decisions: [],
    now: 1,
  }, extra));
}

test("the catalog is 30 badges with the marquee ids", () => {
  assert.equal(B.BADGES.length, 30);
  assert.equal(B.BADGES.filter((b) => b.tier === "bronze").length, 7);
  assert.equal(B.BADGES.filter((b) => b.tier === "silver").length, 9);
  assert.equal(B.BADGES.filter((b) => b.tier === "gold").length, 9);
  assert.equal(B.BADGES.filter((b) => b.tier === "legendary").length, 5);
  assert.deepEqual(B.BADGES.filter((b) => b.hidden).map((b) => b.id), ["crapless_corner_point", "press_undo"]);
  assert.equal(B.badgeById("spin_the_block").tier, "legendary");
});

test("hand length badges need a working bet on the milestone roll", () => {
  let res = roll({ badges: {}, progress: {} }, { handRolls: 10, hadBet: false });
  assert.equal(res.unlocked.length, 0);
  res = roll(res.store, { handRolls: 10, hadBet: true });
  assert.ok(res.unlocked.includes("hand_10_rolls"));
  res = roll(res.store, { handRolls: 20, hadBet: true });
  assert.ok(res.unlocked.includes("hand_20_rolls"));
  res = roll(res.store, { handRolls: 40, hadBet: true, tier: "blazing" });
  assert.ok(res.unlocked.includes("hand_40_rolls"));
  assert.ok(res.unlocked.includes("blazing_reached"));
});

test("ATS singles, the sweep, and spin the block", () => {
  let store = { badges: {}, progress: {} };
  let res = roll(store, { decisions: [{ bet: "Low Rolls", result: "win", profit: 3000 }], total: 6 });
  assert.ok(res.unlocked.includes("ats_low_rolls"));
  assert.ok(!res.unlocked.includes("spin_the_block"));
  store = res.store;
  res = roll(store, { decisions: [{ bet: "High Rolls", result: "win", profit: 3000 }], total: 8 });
  assert.ok(res.unlocked.includes("ats_high_rolls"));
  assert.ok(!res.unlocked.includes("spin_the_block"));
  assert.ok(!res.unlocked.includes("ats_sweep_one_hand"));
  store = res.store;
  res = roll(store, { decisions: [{ bet: "Roll 'Em All", result: "win", profit: 15500 }], total: 10 });
  assert.ok(res.unlocked.includes("ats_roll_em_all"));
  assert.ok(res.unlocked.includes("ats_sweep_one_hand"));
  store = res.store;
  res = roll(store, { decisions: [{ bet: "Low Rolls", result: "win", profit: 3000 }], total: 4 });
  assert.ok(res.unlocked.includes("spin_the_block"));
  assert.equal(store.badges.ats_low_rolls.count, 1);
  assert.ok(res.store.badges.ats_low_rolls.count >= 2);
});

test("a 7 clears spin the block and a low plus a high is not a spin", () => {
  let res = roll({ badges: {}, progress: {} }, { decisions: [{ bet: "Low Rolls", result: "win", profit: 100 }], total: 5 });
  res = roll(res.store, { total: 7, decisions: [], sevenOut: true });
  res = roll(res.store, { decisions: [{ bet: "Low Rolls", result: "win", profit: 100 }], total: 4 });
  assert.ok(!res.unlocked.includes("spin_the_block"));
  res = roll({ badges: {}, progress: {} }, { decisions: [{ bet: "Low Rolls", result: "win", profit: 100 }], total: 4 });
  res = roll(res.store, { decisions: [{ bet: "High Rolls", result: "win", profit: 100 }], total: 9 });
  assert.ok(!res.unlocked.includes("spin_the_block"));
});

test("hard way all day and a hardway hat trick", () => {
  let res = roll({ badges: {}, progress: {} }, {
    decisions: [{ bet: "Hard Way All Day", result: "win", profit: 16400 }],
  });
  assert.ok(res.unlocked.includes("hwad_win"));
  res = roll({ badges: {}, progress: {} }, { decisions: [{ bet: "Hard 6", result: "win", profit: 900 }] });
  res = roll(res.store, { decisions: [{ bet: "Hard 8", result: "win", profit: 900 }] });
  assert.ok(!res.unlocked.includes("hard_hat_trick"));
  res = roll(res.store, { decisions: [{ bet: "Hard 4", result: "win", profit: 700 }] });
  assert.ok(res.unlocked.includes("hard_hat_trick"));
  res = roll({ badges: {}, progress: {} }, { decisions: [{ bet: "Hard 6", result: "win", profit: 1 }] });
  res = roll(res.store, { decisions: [{ bet: "Hard 8", result: "lose", profit: 0 }] });
  res = roll(res.store, { decisions: [{ bet: "Hard 4", result: "win", profit: 1 }] });
  res = roll(res.store, { decisions: [{ bet: "Hard 10", result: "win", profit: 1 }] });
  assert.ok(!res.unlocked.includes("hard_hat_trick"));
});

test("discipline badges refuse short, loosened, and reset sessions", () => {
  const base = { badges: {}, progress: {}, sessions: { withinLimits: 0, awarded: [] } };
  const good = {
    sessionId: 1,
    betRolls: 20,
    loosened: false,
    endReason: "loss",
    lossCents: 25000,
    winCents: 0,
    lossPromptAfter20: true,
    endedAtLoss: true,
    rollAfterLoss: false,
    now: 5,
  };
  let res = B.evaluateSession(base, Object.assign({}, good, { betRolls: 19 }));
  assert.equal(res.unlocked.length, 0);
  res = B.evaluateSession(base, Object.assign({}, good, { loosened: true }));
  assert.equal(res.unlocked.length, 0);
  res = B.evaluateSession(base, Object.assign({}, good, { endReason: "reset", endedAtLoss: false }));
  assert.equal(res.unlocked.length, 0);
  res = B.evaluateSession(base, Object.assign({}, good, { lossPromptAfter20: false, betRolls: 10 }));
  assert.equal(res.unlocked.length, 0);
  res = B.evaluateSession(base, good);
  assert.ok(res.unlocked.includes("limits_set_session"));
  assert.ok(res.unlocked.includes("loss_limit_kept"));
  assert.equal(res.store.sessions.withinLimits, 1);
  res = B.evaluateSession(res.store, Object.assign({}, good, { sessionId: 1 }));
  assert.equal(res.unlocked.length, 0);
});

test("five within limits ignores a roll after the loss limit and allows play after a win goal", () => {
  let store = { badges: {}, progress: {}, sessions: { withinLimits: 0, awarded: [] } };
  for (let i = 1; i <= 5; i++) {
    const res = B.evaluateSession(store, {
      sessionId: i,
      betRolls: 22,
      lossCents: 25000,
      endReason: "end",
      rollAfterLoss: false,
      now: i,
    });
    store = res.store;
  }
  assert.ok(store.badges.five_sessions_within_limits);
  store = { badges: {}, progress: {}, sessions: { withinLimits: 4, awarded: [] } };
  const after = B.evaluateSession(store, {
    sessionId: 9,
    betRolls: 22,
    lossCents: 25000,
    endReason: "loss",
    lossPromptAfter20: true,
    endedAtLoss: true,
    rollAfterLoss: true,
    now: 9,
  });
  assert.equal(after.store.sessions.withinLimits, 4);
  assert.ok(!after.store.badges.five_sessions_within_limits);
});

test("session limits floor percents to $5 and treat a looser loss limit as void", () => {
  assert.equal(Sess.percentToCents(100000, 25), 25000);
  assert.equal(Sess.percentToCents(100050, 10), 10000);
  const session = Sess.startSession(null, 100000, {
    loss: { kind: "amount", amount: 25000 },
    win: { kind: "off" },
  }, 10);
  session.rolls = 1;
  assert.equal(Sess.limitsLoosened(null, { loss: { kind: "off" }, win: { kind: "off" } }, session), true);
  assert.equal(Sess.limitsLoosened(null, { loss: { kind: "amount", amount: 50000 }, win: { kind: "off" } }, session), true);
  assert.equal(Sess.limitsLoosened(null, { loss: { kind: "amount", amount: 5000 }, win: { kind: "off" } }, session), false);
  const hit = Sess.limitStatus(session, 70000);
  assert.equal(hit.loss, true);
  assert.equal(Sess.sessionQualifies(Object.assign({}, session, { ended: true, betRolls: 20, endReason: "loss" })), true);
  assert.equal(Sess.sessionQualifies(Object.assign({}, session, { ended: true, betRolls: 20, endReason: "reset" })), false);
});
