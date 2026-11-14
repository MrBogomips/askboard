// Release-server stand-in on 127.0.0.1 (design decision 4): GitHub-style release download, 302 to an object URL.
// Also writes plugin/scripts/release.txt from dist/manifest.json, so the launcher pins this build.
// Env: PORT (47800), RATE (bytes/s, 0 = unthrottled), DELAY (first-byte ms), FAULT (404|truncate|corrupt|hang),
// SUFFIX ("" or "-min": which build the assets map to), RUN (log folder under runs/).
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const port = Number(process.env.PORT ?? 47800);
const rate = Number(process.env.RATE ?? 0);
const delay = Number(process.env.DELAY ?? 0);
const fault = process.env.FAULT ?? "";
const suffix = process.env.SUFFIX ?? "";
const runDir = join(import.meta.dir, "runs", process.env.RUN ?? "release");
mkdirSync(runDir, { recursive: true });
const logFile = join(runDir, "release-server.jsonl");
const log = (entry: Record<string, unknown>) => appendFileSync(logFile, `${JSON.stringify({ t: Date.now(), ...entry })}\n`);

const manifest = JSON.parse(readFileSync(join(import.meta.dir, "dist", "manifest.json"), "utf8"));
const version = "0.0.1-spike";
const base = `http://127.0.0.1:${port}/askboard/askboard/releases/download`;
const lines = [`version ${version}`, `url ${base}`];
for (const f of manifest.files as { file: string; sha256: string }[]) {
  const m = /^askboard-(.+?)(-min)?$/.exec(f.file);
  if (m && (m[2] ?? "") === suffix) lines.push(`${m[1]} ${f.sha256}`);
}
if (process.env.WRITE_RELEASE !== "0") writeFileSync(join(import.meta.dir, "plugin", "scripts", "release.txt"), `${lines.join("\n")}\n`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function body(bytes: Uint8Array): ReadableStream<Uint8Array> {
  const chunk = 64 * 1024;
  let offset = 0;
  const end = fault === "truncate" ? Math.floor(bytes.length / 2) : bytes.length;
  return new ReadableStream({
    async pull(controller) {
      if (offset === 0 && delay) await sleep(delay);
      if (fault === "hang" && offset >= chunk) return sleep(3_600_000);
      if (offset >= end) {
        controller.close();
        return;
      }
      const next = bytes.slice(offset, Math.min(offset + chunk, end));
      if (fault === "corrupt" && offset === 0) next[100] ^= 0xff;
      offset += next.length;
      if (rate) await sleep((next.length / rate) * 1000);
      controller.enqueue(next);
    },
  });
}

Bun.serve({
  hostname: "127.0.0.1",
  port,
  idleTimeout: 0,
  fetch(req) {
    const url = new URL(req.url);
    const release = /^\/askboard\/askboard\/releases\/download\/v[^/]+\/(askboard-[a-z0-9-]+)$/.exec(url.pathname);
    if (release) {
      log({ kind: "release", asset: release[1], ua: req.headers.get("user-agent") });
      if (fault === "404") return new Response("Not Found", { status: 404 });
      return Response.redirect(`http://127.0.0.1:${port}/objects/${release[1]}${suffix}`, 302);
    }
    const object = /^\/objects\/(askboard-[a-z0-9-]+)$/.exec(url.pathname);
    if (object) {
      const bytes = new Uint8Array(readFileSync(join(import.meta.dir, "dist", object[1])));
      log({ kind: "download", file: object[1], bytes: bytes.length, rate, delay, fault });
      return new Response(body(bytes), { headers: { "content-type": "application/octet-stream", "content-length": String(fault === "truncate" ? bytes.length : bytes.length) } });
    }
    return new Response("Not Found", { status: 404 });
  },
});
console.log(`release server on ${base} (rate ${rate || "unthrottled"} B/s, delay ${delay} ms, fault ${fault || "none"}, assets${suffix})`);
