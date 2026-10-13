/**
 * Table shooter cubes show the rolled faces. YOUR SET stays on the set.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ensureStaticServer } from "./listen.mjs";

const CHROME = ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/usr/local/bin/google-chrome", "/usr/bin/chromium"].find((p) => existsSync(p));
const root = fileURLToPath(new URL("..", import.meta.url));

function contrastRatio(a, b) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const hi = Math.max(lum(a), lum(b));
  const lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
}

test("table cubes match all 36 rolls and the set readout stays put", async (t) => {
  if (!CHROME) {
    t.skip("system Chrome is not available");
    return;
  }
  let pw;
  try { pw = await import("playwright-core"); } catch { t.skip("playwright-core is not available"); return; }
  const server = await ensureStaticServer(root);
  const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    await page.goto("http://127.0.0.1:" + server.port + "/table/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__tcReady);
    await page.evaluate(() => { window.__tcRollSpeed = "instant"; });
    await page.locator("[data-act='go-shooter']").click();
    await page.waitForSelector(".setview .pair .tc-cube");
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        await page.evaluate((faces) => {
          const seq = faces.slice();
          window.__tcRng = () => (seq.shift() - 0.5) / 6;
        }, [a, b]);
        await page.locator("[data-act='throw']").click();
        await page.waitForFunction((faces) => {
          const cubes = [...document.querySelectorAll(".setview .pair .tc-cube")];
          return cubes.length === 2 && cubes[0].dataset.top === String(faces[0]) && cubes[1].dataset.top === String(faces[1]);
        }, [a, b]);
      }
    }
    const readout = await page.evaluate(() => {
      const faces = [...document.querySelectorAll(".tc-shooter .readout .pipro img")].map((img) => (img.getAttribute("src").match(/face-(\d)/) || [])[1]);
      return { text: document.querySelector(".tc-shooter .readout").innerText, faces };
    });
    assert.match(readout.text, /YOUR SET/);
    assert.deepEqual(readout.faces, ["3", "3"], readout.text);
    await page.evaluate(() => { delete window.__tcRng; });
    await page.locator("[data-act='throw']").click();
    const live = await page.evaluate(() => {
      const cubes = [...document.querySelectorAll(".setview .pair .tc-cube")].map((c) => c.dataset.top);
      const pips = [...document.querySelectorAll(".tc-shooter .result .pipro img")].map((img) => (img.getAttribute("src").match(/face-(\d)/) || [])[1]);
      return { cubes, pips };
    });
    assert.deepEqual(live.cubes, live.pips);
    assert.equal(errors.length, 0, errors.join("\n"));
  } finally {
    await browser.close();
    server.kill();
  }
});

test("ROLL and SHOOT white text clears 4.5:1", async (t) => {
  if (!CHROME) { t.skip("system Chrome is not available"); return; }
  let pw;
  try { pw = await import("playwright-core"); } catch { t.skip("playwright-core is not available"); return; }
  const server = await ensureStaticServer(root);
  const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("http://127.0.0.1:" + server.port + "/index.html", { waitUntil: "domcontentloaded" });
    await page.locator("button[data-act='play'][data-mode='regular']").first().click();
    await page.waitForSelector(".roll-btn");
    const roll = await page.evaluate(() => {
      const btn = document.querySelector(".roll-btn");
      const label = btn.querySelector("b") || btn;
      const parse = (s) => {
        const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      };
      const img = getComputedStyle(btn).backgroundImage;
      const hex = (img.match(/#([0-9a-f]{6})/i) || [])[1];
      const bg = hex ? [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)] : parse(getComputedStyle(btn).backgroundColor);
      return { fg: parse(getComputedStyle(label).color), bg, text: label.textContent };
    });
    assert.ok(roll.fg && roll.bg, "roll colors");
    assert.ok(contrastRatio(roll.fg, roll.bg) >= 4.5, "ROLL " + contrastRatio(roll.fg, roll.bg).toFixed(2));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:" + server.port + "/table/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tc-shoot b");
    const shoot = await page.evaluate(() => {
      const btn = document.querySelector(".tc-shoot");
      const label = btn.querySelector("b");
      const small = btn.querySelector("small");
      const parse = (s) => {
        const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      };
      const img = getComputedStyle(btn).backgroundImage;
      const hex = (img.match(/#([0-9a-f]{6})/i) || [])[1];
      const bg = hex ? [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)] : parse(getComputedStyle(btn).backgroundColor);
      return {
        fg: parse(getComputedStyle(label).color),
        small: parse(getComputedStyle(small).color),
        bg,
      };
    });
    assert.ok(contrastRatio(shoot.fg, shoot.bg) >= 4.5, "SHOOT " + contrastRatio(shoot.fg, shoot.bg).toFixed(2));
    assert.ok(contrastRatio(shoot.small, shoot.bg) >= 4.5, "YOUR THROW " + contrastRatio(shoot.small, shoot.bg).toFixed(2));
  } finally {
    await browser.close();
    server.kill();
  }
});
