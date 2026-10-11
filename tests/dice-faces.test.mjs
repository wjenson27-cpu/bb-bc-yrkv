/**
 * Settled cube: the face the player sees on top is the engine value.
 * Composes the cube rest matrix with each face matrix. Skips only when
 * Playwright or system Chrome is missing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as E from "../js/engine.mjs";

const CHROME = ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/usr/local/bin/google-chrome", "/usr/bin/chromium"].find((p) => existsSync(p));
const root = fileURLToPath(new URL("..", import.meta.url));

async function loadPlaywright() {
  try {
    return await import("playwright-core");
  } catch {
    return null;
  }
}

function serve(port) {
  return spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: root,
    stdio: "ignore",
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("every settled cube shows the engine face on top", async (t) => {
  const pw = await loadPlaywright();
  if (!pw || !CHROME) {
    t.skip("playwright-core or system Chrome is not available");
    return;
  }
  const port = 8792;
  const server = serve(port);
  await wait(400);
  const browser = await pw.chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1280 } });
    await page.goto("http://127.0.0.1:" + port + "/index.html", { waitUntil: "networkidle" });
    const report = await page.evaluate(() => {
      const host = document.createElement("div");
      host.id = "sweep";
      host.style.cssText = "position:fixed;inset:0;z-index:80;background:#140F08;display:grid;grid-template-columns:repeat(6,1fr);gap:10px;padding:12px;align-content:start;";
      document.body.appendChild(host);
      const style = document.createElement("style");
      style.textContent = "#sweep .cube3d{--s:64px}#sweep .cube{transition:none !important}";
      document.head.appendChild(style);
      for (let d1 = 1; d1 <= 6; d1++) {
        for (let d2 = 1; d2 <= 6; d2++) {
          const cell = document.createElement("div");
          cell.style.cssText = "display:flex;gap:6px;align-items:center;justify-content:center;color:#FFD36A;font:12px sans-serif;";
          cell.dataset.d1 = String(d1);
          cell.dataset.d2 = String(d2);
          const faces = [1, 2, 3, 4, 5, 6].map((n) => "<i class='f f" + n + "'></i>").join("");
          cell.innerHTML = "<b style='width:28px'>" + (d1 + d2) + "</b>" +
            "<div class='cube3d'><div class='cube' data-face='" + d1 + "'>" + faces + "</div></div>" +
            "<div class='cube3d b'><div class='cube' data-face='" + d2 + "'>" + faces + "</div></div>";
          host.appendChild(cell);
        }
      }
      const read = (cube) => {
        const cubeM = new DOMMatrix(getComputedStyle(cube).transform);
        const facing = [];
        cube.querySelectorAll(".f").forEach((face) => {
          const hit = String(face.className).match(/f(\d)/);
          if (!hit) return;
          const world = cubeM.multiply(new DOMMatrix(getComputedStyle(face).transform));
          const y = world.m32;
          const z = world.m33;
          if (!(y < -0.5 && z > 0.5)) return;
          facing.push({
            n: Number(hit[1]),
            y,
            z,
            upY: -world.m22,
            upZ: -world.m23,
          });
        });
        return facing;
      };
      const rows = [];
      host.querySelectorAll("[data-d1]").forEach((cell) => {
        const cubes = cell.querySelectorAll(".cube");
        rows.push({
          d1: Number(cell.dataset.d1),
          d2: Number(cell.dataset.d2),
          a: read(cubes[0]),
          b: read(cubes[1]),
        });
      });
      return rows;
    });
    assert.equal(report.length, 36);
    report.forEach((row) => {
      const cap = E.rollCaption(row.d1, row.d2);
      assert.equal(row.a.length, 1, "one camera-up face on die 1 for " + row.d1 + "+" + row.d2);
      assert.equal(row.b.length, 1, "one camera-up face on die 2 for " + row.d1 + "+" + row.d2);
      const a = row.a[0];
      const b = row.b[0];
      assert.equal(a.n, cap.d1, "die 1 top face for " + row.d1 + "+" + row.d2);
      assert.equal(b.n, cap.d2, "die 2 top face for " + row.d1 + "+" + row.d2);
      assert.ok(a.upY < 0 && b.upY < 0, "pips are upright");
      assert.ok(a.upZ < 0 && b.upZ < 0, "pips are not mirrored");
      assert.equal(cap.total, row.d1 + row.d2);
      assert.equal(cap.hard, row.d1 === row.d2);
    });
    mkdirSync(root + "docs/qa/compare", { recursive: true });
    await page.locator("#sweep").screenshot({
      path: root + "docs/qa/compare/run8-dice-36.jpg",
      type: "jpeg",
      quality: 82,
    });
    assert.ok(existsSync(root + "docs/qa/compare/run8-dice-36.jpg"));
  } finally {
    await browser.close();
    server.kill();
  }
});
