// Drives the background-tab probe (criterion 13) in several engines, in parallel.
//
//   bun tab-drive.ts --run NAME --minutes 65 [--engines a,b,...] [--scratch DIR] [--drop-every SECONDS]
//
// Per engine: start `bun tab.ts serve`, open the board in tab 1, open a second tab in front,
// keep both for the given minutes, then write runs/<run>/<engine>.summary.json.
//
// Two kinds of engine. "pw-*" are driven through Playwright 1.64.1, which keeps every page it
// controls visible (Chromium focus emulation, Juggler, WebKit), so the board never goes to the
// background. "raw-*" launch the browser binary headless and open the second tab over the
// browser's own protocol (CDP, WebDriver BiDi) without attaching to the board, so the board
// tab really is hidden. Playwright's own Firefox build has no raw engine: it never answers
// BiDi browsingContext.create.
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { chromium, firefox, webkit } from "playwright";

const HERE = import.meta.dirname;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FIREFOX = "/Applications/Firefox.app/Contents/MacOS/firefox";
// Playwright turns these off by default; a real browser has them on, so they are restored.
const BACKGROUND_FLAGS = [
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
];

type Opened = { version: string; frontTab: () => Promise<void>; close: () => Promise<void> };
type Engine = { mode: string; open: (board: string, blank: string, scratch: string) => Promise<Opened> };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const scratchDirs: string[] = [];
function freshDir(scratch: string, prefix: string): string {
  const dir = mkdtempSync(join(scratch, prefix));
  scratchDirs.push(dir);
  return dir;
}

// Minimal JSON-RPC over WebSocket: CDP and WebDriver BiDi share the {id, method, params} shape.
async function rpc(url: string) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let next = 0;
  const pending = new Map<number, (m: { result?: unknown; error?: unknown }) => void>();
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  };
  ws.onclose = () => {
    for (const settle of pending.values()) settle({ error: "connection closed" });
    pending.clear();
  };
  // biome-ignore lint/suspicious/noExplicitAny: protocol results are untyped here
  const send = (method: string, params: object = {}): Promise<any> =>
    new Promise((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => pending.get(id)?.({ error: "no reply in 15 s" }), 15000);
      pending.set(id, (m) => {
        clearTimeout(timer);
        pending.delete(id);
        m.error ? reject(new Error(`${method}: ${JSON.stringify(m.error)}`)) : resolve(m.result);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { send, close: () => ws.close() };
}

// Launches a browser binary and waits for its protocol endpoint on stdout or stderr.
async function launchRaw(exe: string, args: string[], pattern: RegExp) {
  const child = spawn(exe, args, { stdio: ["ignore", "pipe", "pipe"] });
  const endpoint = await new Promise<string>((resolve, reject) => {
    const onLine = (l: string) => {
      const m = l.match(pattern);
      if (m) resolve(m[1]);
    };
    createInterface({ input: child.stdout }).on("line", onLine);
    createInterface({ input: child.stderr }).on("line", onLine);
    child.once("exit", (code) => reject(new Error(`${exe} exited ${code}`)));
    setTimeout(() => reject(new Error(`${exe}: no endpoint in 30 s`)), 30000);
  });
  const kill = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill("SIGTERM");
    await Promise.race([new Promise((r) => child.once("exit", r)), sleep(5000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  };
  return { endpoint, kill };
}

function rawChrome(exe: string, extra: string[] = []): Engine["open"] {
  return async (board, blank, scratch) => {
    const args = ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${freshDir(scratch, "tab-profile-")}`, ...extra];
    const b = await launchRaw(exe, [...args, "--no-first-run", "--no-default-browser-check", board], /(ws:\/\/\S+)/);
    const cdp = await rpc(b.endpoint);
    const { product } = await cdp.send("Browser.getVersion");
    return {
      version: product,
      frontTab: async () => void (await cdp.send("Target.createTarget", { url: blank, newWindow: false, background: false })),
      close: async () => {
        await cdp.send("Browser.close").catch(() => {});
        cdp.close();
        await b.kill();
      },
    };
  };
}

function rawFirefox(exe: string): Engine["open"] {
  return async (board, blank, scratch) => {
    const args = ["--headless", "--remote-debugging-port", "0", "-profile", freshDir(scratch, "tab-profile-"), "-no-remote"];
    const b = await launchRaw(exe, [...args, board], /BiDi listening on (ws:\/\/\S+)/);
    const bidi = await rpc(`${b.endpoint}/session`);
    const { capabilities } = await bidi.send("session.new", { capabilities: {} });
    return {
      version: `${capabilities.browserName} ${capabilities.browserVersion}`,
      frontTab: async () => {
        const { context } = await bidi.send("browsingContext.create", { type: "tab", background: false });
        await bidi.send("browsingContext.navigate", { context, url: blank, wait: "none" });
      },
      close: async () => {
        await bidi.send("browser.close").catch(() => {});
        bidi.close();
        await b.kill();
      },
    };
  };
}

function playwright(launch: () => ReturnType<typeof chromium.launch>): Engine["open"] {
  return async (board, blank) => {
    const browser = await launch();
    const ctx = await browser.newContext();
    await (await ctx.newPage()).goto(board);
    return {
      version: browser.version(),
      frontTab: async () => {
        const front = await ctx.newPage();
        await front.goto(blank);
        await front.bringToFront();
      },
      close: () => browser.close(),
    };
  };
}

const ENGINES: Record<string, Engine> = {
  "raw-chromium": {
    mode: "Playwright's Chromium binary, new headless, second tab over CDP (no Playwright attach)",
    // Without the mock keychain, Chrome for Testing waits on a macOS keychain prompt and loads nothing.
    open: (...a) => rawChrome(chromium.executablePath(), ["--use-mock-keychain"])(...a),
  },
  "raw-chrome": {
    mode: "installed Google Chrome, new headless, fresh user-data-dir, second tab over CDP",
    open: rawChrome(CHROME),
  },
  "raw-firefox-installed": {
    mode: "installed Firefox, headless, fresh profile, second tab over WebDriver BiDi",
    open: rawFirefox(FIREFOX),
  },
  "pw-chromium": {
    mode: "Playwright-driven Chromium (headless shell), background flags restored",
    open: playwright(() => chromium.launch({ headless: true, ignoreDefaultArgs: BACKGROUND_FLAGS })),
  },
  "pw-firefox": { mode: "Playwright-driven Firefox, headless", open: playwright(() => firefox.launch()) },
  "pw-webkit": { mode: "Playwright-driven WebKit, headless", open: playwright(() => webkit.launch()) },
};

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const cleanups: Array<() => Promise<void>> = [];

async function startServer(run: string, engine: string) {
  const drop = ["--drop-every", arg("drop-every", "0")];
  const child = spawn("bun", ["tab.ts", "serve", "--run", run, "--engine", engine, ...drop], { cwd: HERE });
  const line = await new Promise<string>((resolve, reject) => {
    createInterface({ input: child.stdout }).once("line", resolve);
    child.once("exit", (code) => reject(new Error(`server exited ${code}`)));
  });
  return { child, ...(JSON.parse(line) as { board: string; blank: string; log: string }) };
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((r) => child.once("exit", r));
}

async function drive(run: string, name: string, minutes: number, scratch: string) {
  const engine = ENGINES[name];
  if (!engine) throw new Error(`unknown engine ${name}`);
  const srv = await startServer(run, name);
  const note = (data: Record<string, unknown>) =>
    fetch(srv.board.replace("/board", "/note"), { method: "POST", body: JSON.stringify(data) }).catch(() => {});
  let opened: Opened | undefined;
  const close = async () => {
    await opened?.close().catch(() => {});
    await stopServer(srv.child);
  };
  cleanups.push(close);
  try {
    opened = await engine.open(srv.board, srv.blank, scratch);
    await sleep(3000);
    await note({ step: "board-loaded", mode: engine.mode, browserVersion: opened.version });
    await opened.frontTab();
    await note({ step: "front-tab-opened" });
    const end = Date.now() + minutes * 60000;
    while (Date.now() < end) await sleep(Math.min(60000, end - Date.now()));
    await note({ step: "end" });
  } finally {
    await close();
  }
  const summary = execFileSync("bun", ["tab.ts", "report", srv.log], { cwd: HERE, encoding: "utf8" });
  writeFileSync(srv.log.replace(/\.jsonl$/, ".summary.json"), summary);
  console.log(summary);
}

async function main() {
  const run = arg("run", "tab-smoke");
  const minutes = Number(arg("minutes", "2"));
  const names = arg("engines", Object.keys(ENGINES).join(",")).split(",");
  const scratch = arg("scratch", tmpdir());
  const finish = (code: number) => {
    // Only the profile folders this driver created are removed.
    for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
    process.exit(code);
  };
  const shutdown = async () => {
    await Promise.allSettled(cleanups.map((c) => c()));
    finish(1);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  const results = await Promise.allSettled(names.map((n) => drive(run, n, minutes, scratch)));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`${names[i]}: ${r.reason}`);
  });
  finish(results.some((r) => r.status === "rejected") ? 1 : 0);
}

main();
