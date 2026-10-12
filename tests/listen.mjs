import net from "node:net";

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
