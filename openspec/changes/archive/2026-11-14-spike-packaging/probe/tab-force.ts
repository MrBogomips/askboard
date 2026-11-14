// Forces the two events an hour did not produce, to see what they look like to the server:
// a freeze (CDP Page.setWebLifecycleState) and a discard (chrome.tabs.discard from an extension),
// on a hidden board tab in Playwright's Chromium binary, new headless.
//
//   bun tab-force.ts --run NAME --scratch DIR
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { chromium } from "playwright";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const run = arg("run", "tab-forced");
const scratch = arg("scratch", "/tmp");

const server = spawn("bun", ["tab.ts", "serve", "--run", run, "--engine", "chromium-forced"], { cwd: import.meta.dirname });
const { board, blank } = JSON.parse(
  await new Promise<string>((r) => createInterface({ input: server.stdout }).once("line", r)),
) as { board: string; blank: string };
const note = (data: object) =>
  fetch(board.replace("/board", "/note"), { method: "POST", body: JSON.stringify(data) }).catch(() => {});

// An unpacked extension whose service worker can call chrome.tabs.
const ext = mkdtempSync(join(scratch, "tab-ext-"));
const profile = mkdtempSync(join(scratch, "tab-profile-"));
writeFileSync(
  join(ext, "manifest.json"),
  JSON.stringify({ manifest_version: 3, name: "tab-force", version: "1", permissions: ["tabs"], background: { service_worker: "sw.js" } }),
);
writeFileSync(join(ext, "sw.js"), "// evaluated over CDP\n");

const browser = spawn(
  chromium.executablePath(),
  ["--headless=new", "--use-mock-keychain", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    `--load-extension=${ext}`, "--disable-features=DisableLoadExtensionCommandLineSwitch", "--no-first-run", "--no-default-browser-check", board],
  { stdio: ["ignore", "ignore", "pipe"] },
);
const endpoint = await new Promise<string>((r) =>
  createInterface({ input: browser.stderr }).on("line", (l) => {
    const m = l.match(/(ws:\/\/\S+)/);
    if (m) r(m[1]);
  }),
);

// One CDP connection; sessionId routes commands to an attached target.
const ws = new WebSocket(endpoint);
await new Promise((r) => (ws.onopen = r));
let next = 0;
const pending = new Map<number, (m: { result?: unknown; error?: unknown }) => void>();
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data));
  pending.get(m.id)?.(m);
};
// biome-ignore lint/suspicious/noExplicitAny: protocol results are untyped here
const send = (method: string, params: object = {}, sessionId?: string): Promise<any> =>
  new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${JSON.stringify(m.error)}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
const attach = async (match: (t: { type: string; url: string }) => boolean) => {
  const { targetInfos } = await send("Target.getTargets");
  const t = targetInfos.find(match);
  if (!t) throw new Error("target not found");
  return (await send("Target.attachToTarget", { targetId: t.targetId, flatten: true })).sessionId as string;
};
// The extension's worker stays alive while a debugger is attached to it.
let worker = "";
for (let i = 0; !worker && i < 20; i++) {
  worker = await attach((t) => t.type === "service_worker" && t.url.endsWith("/sw.js")).catch(() => "");
  if (!worker) await sleep(500);
}
const inWorker = async (expression: string) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, worker);
  return r.exceptionDetails ? `error: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}` : r.result.value;
};
// Tab URLs are hidden from the worker here, so the board is found by state: the one tab not in
// front before the discard, the discarded one after it.
const tabWhere = (cond: string) => `(await chrome.tabs.query({})).find((t) => ${cond})`;

try {
  await sleep(3000);
  const { product } = await send("Browser.getVersion");
  await note({ step: "board-loaded", browserVersion: product, mode: "Playwright's Chromium binary, new headless, forced freeze and discard" });
  await send("Target.createTarget", { url: blank, newWindow: false, background: false });
  await note({ step: "front-tab-opened" });
  await sleep(20000);

  const s = await attach((t) => t.type === "page" && t.url.includes("/board"));
  await note({ step: "freeze-forced" });
  await send("Page.setWebLifecycleState", { state: "frozen" }, s);
  await sleep(30000);
  await send("Page.setWebLifecycleState", { state: "active" }, s);
  await note({ step: "unfreeze-forced" });
  await send("Target.detachFromTarget", { sessionId: s });
  await sleep(20000);

  const discard = `(async () => (await chrome.tabs.discard(${tabWhere("!t.active")}.id))?.discarded ?? false)()`;
  await note({ step: "discard-forced", result: await inWorker(discard) });
  await sleep(20000);
  const activate = `(async () => (await chrome.tabs.update(${tabWhere("t.discarded")}.id, { active: true })).active)()`;
  await note({ step: "board-activated", result: await inWorker(activate) });
  await sleep(15000);
} finally {
  await note({ step: "end" });
  await send("Browser.close").catch(() => {});
  ws.close();
  await sleep(1000);
  browser.kill();
  server.kill("SIGTERM");
  await sleep(500);
  rmSync(ext, { recursive: true, force: true });
  rmSync(profile, { recursive: true, force: true });
}
