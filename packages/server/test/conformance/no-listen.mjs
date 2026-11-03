// Preloaded into a run of the bundle's hook or client mode (task 6.6; AD-19): any attempt to open
// a listening socket ends the process with exit 97 and one stderr line, so a mode that opens a
// port cannot pass.

import http from "node:http";
import net from "node:net";

const refuse = () => {
  process.stderr.write("no-listen: a listening socket was opened\n");
  process.exit(97);
};

for (const prototype of [net.Server.prototype, http.Server.prototype]) {
  prototype.listen = refuse;
}
for (const name of ["serve", "listen"]) {
  if (globalThis.Bun !== undefined) Object.defineProperty(globalThis.Bun, name, { value: refuse });
}
