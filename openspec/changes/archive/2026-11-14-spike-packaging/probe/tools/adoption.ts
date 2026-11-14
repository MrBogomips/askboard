// Adoption-rule check (task 1.2): licence, stars, last push, last release and archived flag from the GitHub API and
// the npm registry, judged against the addendum's rule on the run date. Writes ../evidence/adoption.json.
// Usage: GITHUB_TOKEN=$(gh auth token) bun tools/adoption.ts [run-date]
import { writeFileSync } from "node:fs";
import { join } from "node:path";

type Candidate = { name: string; version: string; repo: string; npm?: string; role: string };

const CANDIDATES: Candidate[] = [
  { name: "bun", version: "1.4.4", repo: "oven-sh/bun", role: "toolchain and embedded runtime (AD-19)" },
  { name: "node", version: "24.22.1", repo: "nodejs/node", role: "fallback runtime for the plain bundle (AD-19)" },
  { name: "deno", version: "2.9.8", repo: "denoland/deno", role: "alternative compiler named in SOLUTION-DESIGN §4.10" },
  { name: "@modelcontextprotocol/server", version: "2.4.0", repo: "modelcontextprotocol/typescript-sdk", npm: "@modelcontextprotocol/server", role: "probe dependency (Stack)" },
  { name: "zod", version: "4.6.7", repo: "colinhacks/zod", npm: "zod", role: "probe dependency" },
  { name: "playwright", version: "1.64.1", repo: "microsoft/playwright", npm: "playwright", role: "probe dependency (browser driver)" },
];

const PERMISSIVE = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD"]);
const runDate = new Date(process.argv[2] ?? "2026-10-30T00:00:00Z");
const monthsBefore = (months: number) => new Date(Date.UTC(runDate.getUTCFullYear(), runDate.getUTCMonth() - months, runDate.getUTCDate()));

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required (GITHUB_TOKEN=$(gh auth token))");

async function json(url: string, auth: boolean): Promise<any> {
  const res = await fetch(url, { headers: auth ? { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" } : {} });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function latestRelease(repo: string): Promise<string | null> {
  const releases = await json(`https://api.github.com/repos/${repo}/releases?per_page=20`, true);
  const published = releases.filter((r: any) => !r.draft).map((r: any) => r.published_at as string);
  if (published.length > 0) return published.sort().at(-1) ?? null;
  const tags = await json(`https://api.github.com/repos/${repo}/tags?per_page=1`, true);
  if (tags.length === 0) return null;
  const commit = await json(tags[0].commit.url, true);
  return commit.commit.committer.date;
}

const fileHint = (line: string | null) => (line ? `"${line.trim().slice(0, 80)}"` : "no text");

async function check(c: Candidate) {
  const repo = await json(`https://api.github.com/repos/${c.repo}`, true);
  const release = await latestRelease(c.repo);
  let npmLicence: string | null = null;
  let npmPublished: string | null = null;
  if (c.npm) {
    const doc = await json(`https://registry.npmjs.org/${c.npm.replace("/", "%2F")}`, false);
    npmLicence = doc.versions?.[c.version]?.license ?? null;
    npmPublished = doc.time?.[c.version] ?? null;
  }
  const licence = npmLicence ?? repo.license?.spdx_id ?? null;
  // GitHub answers NOASSERTION for a licence file it cannot classify: record its first line for a human reading.
  let licenceFirstLine: string | null = null;
  if (licence === "NOASSERTION") {
    const file = await json(`https://api.github.com/repos/${c.repo}/license`, true);
    licenceFirstLine = Buffer.from(file.content, "base64").toString("utf8").split("\n").find((l) => l.trim()) ?? null;
  }
  const failures: string[] = [];
  if (licence === "NOASSERTION") failures.push(`licence file not classified by GitHub (${fileHint(licenceFirstLine)}): read it`);
  else if (!licence || !PERMISSIVE.has(licence)) failures.push(`licence ${licence ?? "unknown"} is not on the permissive list`);
  if (repo.stargazers_count < 1000) failures.push(`stars ${repo.stargazers_count} < 1000`);
  if (new Date(repo.pushed_at) < monthsBefore(6)) failures.push(`last push ${repo.pushed_at} older than 6 months`);
  if (!release || new Date(release) < monthsBefore(12)) failures.push(`last release ${release ?? "none"} older than 12 months`);
  if (repo.archived) failures.push("archived");
  return {
    name: c.name,
    version: c.version,
    role: c.role,
    repo: c.repo,
    licence,
    licenceFirstLine,
    repoLicence: repo.license?.spdx_id ?? null,
    stars: repo.stargazers_count,
    pushedAt: repo.pushed_at,
    lastRelease: release,
    versionPublished: npmPublished,
    archived: repo.archived,
    verdict: failures.length === 0 ? "pass" : failures.every((f) => f.startsWith("licence file")) ? "review" : "fail",
    failures,
  };
}

const rows = [];
for (const c of CANDIDATES) rows.push(await check(c));
const out = { runDate: runDate.toISOString().slice(0, 10), checkedAt: new Date().toISOString(), rule: "permissive licence; >= 1000 stars; push within 6 months and release within 12; not archived", rows };
writeFileSync(join(import.meta.dir, "..", "..", "evidence", "adoption.json"), `${JSON.stringify(out, null, 2)}\n`);
for (const r of rows) console.log(`${r.name}@${r.version}\t${r.licence}\t${r.stars}\t${r.pushedAt}\t${r.lastRelease}\t${r.verdict}${r.failures.length ? `: ${r.failures.join("; ")}` : ""}`);
