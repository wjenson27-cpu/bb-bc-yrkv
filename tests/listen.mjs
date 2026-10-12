import net from "node:net";
import { spawn } from "node:child_process";

export const STATIC_PORT = 8765;

function portOpen(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: "127.0.0.1" }, () => {
      sock.end();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
  });
}

/**
 * One static server for every browser test. Reuses a server that is already
 * listening so parallel files, and a reviewer, do not kill each other's port.
 * kill() is a no-op: the suite wrapper owns the process.
 */
export async function ensureStaticServer(root) {
  if (!(await portOpen(STATIC_PORT))) {
    const child = spawn("python3", ["-m", "http.server", String(STATIC_PORT), "--bind", "127.0.0.1"], {
      cwd: root,
      stdio: "ignore",
      detached: true,
    });
    child.unref();
    await waitForPort(STATIC_PORT);
  }
  return { port: STATIC_PORT, kill() {} };
}

/** Wait until a local static server accepts connections. Avoids reload flakes. */
export function waitForPort(port, ms = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const once = () => {
      const sock = net.connect({ port, host: "127.0.0.1" }, () => {
        sock.end();
        resolve();
      });
      sock.on("error", () => {
        sock.destroy();
        if (Date.now() - start > ms) reject(new Error("server did not listen on " + port));
        else setTimeout(once, 40);
      });
    };
    once();
  });
}
