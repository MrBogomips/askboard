// Temporary diagnostics for #160: removed before the pull request is ready.
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sessionFilePath, sessionFolder } from "@askboard/contract";

const MAIN = join(import.meta.dir, "..", "..", "packages", "server", "src", "main.ts");
const PS = "pid,ppid,pgid,stat,sig,sigmask,command";
const sh = (cmd: string[]) => {
  const r = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  return `${r.stdout.toString()}${r.stderr.toString()}`.trimEnd();
};
const collect = (stream: ReadableStream<Uint8Array>) => {
  const box = { text: "" };
  void (async () => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) box.text += decoder.decode(chunk);
  })();
  return box;
};
const exitedWithin = async (child: { exited: Promise<number> }, ms: number) =>
  Promise.race([child.exited, Bun.sleep(ms).then(() => "still running" as const)]);

console.log("== ancestors");
let pid = process.pid;
for (let i = 0; i < 8 && pid > 1; i += 1) {
  console.log(sh(["ps", "-o", PS, "-p", String(pid)]));
  pid = Number(sh(["ps", "-o", "ppid=", "-p", String(pid)]).trim());
}
console.log("which bun:", sh(["which", "-a", "bun"]));
console.log("uname:", sh(["uname", "-a"]));

const tiny = join(mkdtempSync("/tmp/abd-"), "tiny.mjs");
writeFileSync(
  tiny,
  `for (const s of ["SIGINT","SIGTERM","SIGHUP"]) process.on(s, () => { process.stderr.write("got " + s + "\\n"); process.exit(0); });
process.stderr.write("ready\\n"); setInterval(() => {}, 1000);`,
);

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "claude-code", version: "2.1.312" },
  },
};

const probe = async (label: string, argv: string[], how: string, via: string) => {
  const runtime = mkdtempSync("/tmp/abd-");
  const child = Bun.spawn(argv, {
    env: { PATH: process.env.PATH ?? "", XDG_RUNTIME_DIR: runtime, HOME: runtime },
    cwd: runtime,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const err = collect(child.stderr);
  collect(child.stdout);
  child.stdin.write(`${JSON.stringify(initialize)}\n`);
  child.stdin.flush();
  const file = sessionFilePath(
    sessionFolder({ env: { XDG_RUNTIME_DIR: runtime }, uid: process.getuid?.() ?? 0 }),
    process.pid,
  );
  const ready = () => (label === "main" ? existsSync(file) : err.text.includes("ready"));
  const began = performance.now();
  for (let t = 0; t < 500 && !ready(); t += 1) await Bun.sleep(10);
  console.log(
    `\n== ${label} ${how} via ${via} (pid ${child.pid}, ready ${ready()} in ${Math.round(performance.now() - began)} ms)`,
  );
  console.log(sh(["ps", "-o", PS, "-p", String(child.pid)]));
  const started = performance.now();
  if (via === "bun") child.kill(how as NodeJS.Signals);
  else console.log(sh(["/bin/kill", `-${how.slice(3)}`, String(child.pid)]));
  const first = await exitedWithin(child, 3000);
  console.log(
    `after ${Math.round(performance.now() - started)} ms: ${first}; stderr: ${JSON.stringify(err.text)}`,
  );
  if (first === "still running") {
    console.log(sh(["ps", "-o", PS, "-p", String(child.pid)]));
    console.log(sh(["sample", String(child.pid), "1"]).split("\n").slice(0, 150).join("\n"));
    child.kill(how as NodeJS.Signals);
    console.log(
      `second ${how}: ${await exitedWithin(child, 3000)}; stderr: ${JSON.stringify(err.text)}`,
    );
    child.kill("SIGKILL");
    await child.exited;
  }
};

for (const how of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  await probe("tiny-bun", ["bun", tiny], how, "bun");
  await probe("tiny-node", ["node", tiny], how, "bun");
  await probe("main", ["bun", MAIN], how, "bun");
  await probe("main", ["bun", MAIN], how, "/bin/kill");
}
