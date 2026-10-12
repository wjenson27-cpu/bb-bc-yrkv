/**
 * One static server, then the suite one file at a time.
 * Browser tests share port 8765 and never kill it mid-run.
 */
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8765;

function portOpen(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: "127.0.0.1" }, () => {
      sock.end();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
  });
}

const files = readdirSync(join(root, "tests"))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => join("tests", name));

const started = !(await portOpen(PORT));
const server = started
  ? spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" })
  : null;

if (started) {
  const deadline = Date.now() + 8000;
  while (!(await portOpen(PORT))) {
    if (Date.now() > deadline) {
      console.error("static server did not listen");
      if (server) server.kill();
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 40));
  }
}

const child = spawn(process.execPath, ["--test", "--test-concurrency=1", ...files], {
  cwd: root,
  stdio: "inherit",
});
child.on("exit", (code) => {
  if (server) server.kill();
  process.exit(code || 0);
});
