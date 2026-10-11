/**
 * Live swipe check. Uses Playwright's core against the system Chrome when both exist.
 * Skips in environments that have neither, so `npm test` still passes on a bare Node runner.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CHROME = ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find((p) => existsSync(p));

async function loadPlaywright() {
  try {
    return await import("playwright-core");
  } catch {
    return null;
  }
}

function serve(port) {
  const child = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: "ignore",
  });
  return child;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("a horizontal swipe that starts on a felt button changes the screen and the dot", async (t) => {
  const pw = await loadPlaywright();
  if (!pw || !CHROME) {
    t.skip("playwright-core or system Chrome is not available");
    return;
  }
  const port = 8766;
  const server = serve(port);
  await wait(400);
  const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    await page.addInitScript(() => {
      localStorage.setItem("bb-bubble-craps-v1", JSON.stringify({
        settings: { autoRoll: false, sound: false, tutorOn: false, blazing: true, autoPress: "off", autoPressMax: 3, seenBlaze: {} },
      }));
    });
    await page.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
    await page.click("button[data-mode='regular']");
    await page.waitForSelector("#stage[data-page='1']");

    const field = page.locator("button[aria-label='Field']");
    const box = await field.boundingBox();
    assert.ok(box, "Field is on the board");
    const y = box.y + box.height / 2;
    const x = box.x + box.width * 0.72;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 140, y + 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForFunction(() => {
      const stage = document.getElementById("stage");
      const dice = document.getElementById("dice-row");
      if (!stage || !dice || stage.dataset.page !== "2") return false;
      const rect = dice.getBoundingClientRect();
      return rect.x > 8 && rect.right < 400;
    });
    const diceDot = await page.locator(".dot[aria-label='Dice']").getAttribute("class");
    assert.match(diceDot, /\bon\b/);
    const boardDot = await page.locator(".dot[aria-label='Board']").getAttribute("class");
    assert.doesNotMatch(boardDot, /\bon\b/);
    const fieldClass = await field.getAttribute("class");
    assert.doesNotMatch(fieldClass || "", /\bhas\b/, "the swipe must not place the Field bet");

    const dice = page.locator("#dice-row");
    const diceBox = await dice.boundingBox();
    assert.ok(diceBox);
    const dy = diceBox.y + 20;
    const dx = diceBox.x + 40;
    await page.mouse.move(dx, dy);
    await page.mouse.down();
    await page.mouse.move(dx + 200, dy + 4, { steps: 12 });
    await page.mouse.up();
    await page.waitForFunction(() => {
      const stage = document.getElementById("stage");
      const field = document.querySelector("button[aria-label='Field']");
      if (!stage || !field || stage.dataset.page !== "1") return false;
      const rect = field.getBoundingClientRect();
      return rect.x > 8 && rect.right < 390;
    });
    const back = await page.locator(".dot[aria-label='Board']").getAttribute("class");
    assert.match(back, /\bon\b/);

    const fieldAgain = page.locator("button[aria-label='Field']");
    const fieldBox = await fieldAgain.boundingBox();
    assert.ok(fieldBox && fieldBox.x > 0, "Field is on screen");
    const fy = fieldBox.y + fieldBox.height / 2;
    const fx = fieldBox.x + 36;
    await page.mouse.move(fx, fy);
    await page.mouse.down();
    await page.mouse.move(fx + 150, fy, { steps: 12 });
    await page.mouse.up();
    await page.waitForFunction(() => document.getElementById("stage").dataset.page === "0");
    const side = await page.locator(".dot[aria-label='Side bets']").getAttribute("class");
    assert.match(side, /\bon\b/);
    assert.ok(await page.locator("text=C 3:1").count());
    assert.equal(errors.length, 0, errors.join("\n"));
  } finally {
    await browser.close();
    server.kill();
  }
});
