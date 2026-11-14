// Group 4: does a native `<select>` alone trigger a CSP violation? A standalone page with a
// hash-only `style-src` creates a single and a multiple `<select>` from its one hashed script,
// in each Playwright engine, and prints the violations and the console lines.
//
// Usage, from probe/: PLAYWRIGHT_BROWSERS_PATH=<scratch>/ms-playwright bun tools/check-native-select.ts

import { chromium, firefox, webkit } from "playwright";

const script = [
  "const events = [];",
  'document.addEventListener("securitypolicyviolation", (e) => events.push(e.effectiveDirective));',
  "window.__events = events;",
  'setTimeout(() => { const s = document.createElement("select"); const o = document.createElement("option");',
  '  o.textContent = "a"; s.append(o); document.body.append(s); }, 10);',
  'setTimeout(() => { const s = document.createElement("select"); s.multiple = true; document.body.append(s); }, 50);',
].join("\n");
const hash = new Bun.CryptoHasher("sha256").update(script).digest("base64");
const policy = `default-src 'none'; img-src data:; script-src 'sha256-${hash}'; style-src 'sha256-AAAA'`;
const html = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}"><body><script>${script}</script>`;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () => new Response(html, { headers: { "content-type": "text/html" } }),
});
try {
  for (const type of [chromium, firefox, webkit]) {
    const browser = await type.launch();
    const page = await browser.newPage();
    const lines: string[] = [];
    page.on("console", (m) => lines.push(m.text().slice(0, 120)));
    await page.goto(`http://127.0.0.1:${server.port}/`);
    await page.waitForTimeout(400);
    const events = await page.evaluate(() => (window as unknown as { __events: string[] }).__events);
    console.log(`${type.name().padEnd(8)} violations ${JSON.stringify(events)} console ${JSON.stringify(lines)}`);
    await browser.close();
  }
} finally {
  server.stop();
}
