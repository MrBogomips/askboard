// Release mirror for the container runs: serves probe/dist as GitHub Releases does, with a 302 whose Location
// is relative, so a container that reaches the host as host.docker.internal follows it. The probe's own
// release server redirects to an absolute 127.0.0.1 URL, which inside a container is the container itself.
// Env: PORT (47841), LOG (JSONL file).
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(import.meta.dir, "..", "probe", "dist");
const port = Number(process.env.PORT ?? 47841);
const log = (entry: Record<string, unknown>) => process.env.LOG && appendFileSync(process.env.LOG, `${JSON.stringify({ t: Date.now(), ...entry })}\n`);

Bun.serve({
  hostname: "127.0.0.1",
  port,
  fetch(req) {
    const path = new URL(req.url).pathname;
    const release = /^\/askboard\/askboard\/releases\/download\/v[^/]+\/(askboard-[a-z0-9-]+)$/.exec(path);
    if (release) {
      log({ kind: "release", asset: release[1], ua: req.headers.get("user-agent") });
      return new Response(null, { status: 302, headers: { location: `/objects/${release[1]}` } });
    }
    const object = /^\/objects\/(askboard-[a-z0-9-]+)$/.exec(path);
    if (object) {
      log({ kind: "download", file: object[1] });
      return new Response(readFileSync(join(dist, object[1])));
    }
    return new Response("Not Found", { status: 404 });
  },
});
console.log(`release mirror on http://127.0.0.1:${port}`);
