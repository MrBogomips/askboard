// Task 3.3: does AD-8's hash-only `script-src` stop a script tag with a relative URL in a page
// opened from file://, as a Snapshot is? PlantUML's own loader makes such tags for `!theme`,
// `!include <…>`, emoji and icons (D7), and from file:// the URL points into the Snapshot's folder.
// Writes runs/file-scripts/page/ (a page whose only script is hashed, and a `themes.js` beside it)
// and loads it in Playwright's Chromium, Firefox and WebKit.
//
// Usage, from probe/: bun tools/check-file-scripts.ts [--firefox <path to an installed Firefox>]
// With --firefox it also writes a headless screenshot of the same page from that Firefox, in
// runs/file-scripts/: the page reads "SCRIPT RAN" if the script ran, "BLOCKED" if not.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, firefox, webkit } from "playwright";

const DIR = join(import.meta.dir, "..", "runs", "file-scripts");
const INLINE =
  'window.__events=[];document.addEventListener("securitypolicyviolation",e=>__events.push(e.effectiveDirective+" "+e.blockedURI));' +
  'window.addEventListener("load",()=>{document.body.textContent="BLOCKED";const s=document.createElement("script");s.src="themes.js";' +
  's.onerror=()=>__events.push("onerror");s.onload=()=>__events.push("onload");document.head.appendChild(s);});';
const hash = new Bun.CryptoHasher("sha256").update(INLINE).digest("base64");

await mkdir(join(DIR, "page"), { recursive: true });
await Bun.write(
  join(DIR, "page", "index.html"),
  `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}'">` +
    `<body>init</body><script>${INLINE}</script>`,
);
await Bun.write(join(DIR, "page", "themes.js"), 'window.__ran = true; document.body.textContent = "SCRIPT RAN";');
const url = `file://${join(DIR, "page", "index.html")}`;

for (const [name, type] of [["chromium", chromium], ["firefox", firefox], ["webkit", webkit]] as const) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForTimeout(800);
    const result = await page.evaluate(() => ({
      ran: (window as unknown as { __ran?: boolean }).__ran === true,
      events: (window as unknown as { __events: string[] }).__events,
    }));
    console.log(`${name.padEnd(8)} ${browser.version().padEnd(14)} script ran: ${result.ran}  ${result.events.join(", ")}`);
  } finally {
    await browser.close();
  }
}

const installed = process.argv.indexOf("--firefox");
if (installed > 0) {
  const binary = process.argv[installed + 1] as string;
  const profile = join(DIR, "profile");
  await mkdir(profile, { recursive: true });
  const shot = join(DIR, "installed-firefox.png");
  const run = Bun.spawnSync([binary, "--headless", "--no-remote", "--profile", profile, "--window-size", "600,200", "--screenshot", shot, url]);
  const version = Bun.spawnSync([binary, "--version"]).stdout.toString().trim();
  console.log(`${version}: exit ${run.exitCode}, screenshot ${shot}`);
}
