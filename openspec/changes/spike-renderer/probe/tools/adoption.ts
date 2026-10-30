// Adoption status of every direct dependency of the probe, and of the packages the UX checks
// name (S-1, S-2, S-3, S-5) and the fonts the product owner decides on, against the adoption rule
// of docs/prd-askboard-2026-10-25/addendum.md: licence, stars, a push within 6 months, a release
// within 12, not archived. Licences are classified by the repository's own licence check.
//
// Usage, from probe/: GITHUB_TOKEN=$(gh auth token) bun tools/adoption.ts [YYYY-MM-DD]
// Writes ../evidence/adoption.json and prints a Markdown table.

import { join } from "node:path";
import { classify, repositoryOf } from "../../../../../tools/check-licences.ts";

const PROBE = join(import.meta.dir, "..");
const EVIDENCE = join(PROBE, "..", "evidence", "adoption.json");
const NPM = "https://registry.npmjs.org";
const GITHUB = "https://api.github.com/repos";
const MIN_STARS = 1000;

// Packages named by the UX checks and the open font decision, read but not installed.
const CHECKS: Record<string, { version: string; check: string }> = {
  elkjs: { version: "0.9.3", check: "S-1 (Mermaid 12.2.0 dependency)" },
  "react-arborist": { version: "4.0.1", check: "S-2" },
  "react-dnd": { version: "16.0.1", check: "S-2 (react-arborist peer)" },
  "vis-timeline": { version: "8.5.6", check: "S-3" },
  "@egjs/hammerjs": { version: "2.0.17", check: "S-3 (vis-timeline peer)" },
  cmdk: { version: "1.1.1", check: "S-5" },
  "next-themes": { version: "0.4.6", check: "S-5" },
  "@fontsource/inter": { version: "5.3.0", check: "fonts (product owner decision)" },
  "@fontsource/jetbrains-mono": { version: "5.3.0", check: "fonts (product owner decision)" },
};

// A package whose package.json names no repository: the source of the hint is recorded.
const REPOSITORY_HINTS: Record<string, { repository: string; source: string }> = {
  "@pierre/diffs": {
    repository: "pierrecomputer/pierre",
    source: "no repository field in the package; design.md decision 1 names the repository",
  },
};

type Row = {
  package: string;
  version: string;
  role: string;
  licence: string | null;
  licenceVerdict: string;
  repository: string | null;
  repositorySource: string;
  stars: number | null;
  pushedAt: string | null;
  archived: boolean | null;
  latest: string | null;
  latestReleasedAt: string | null;
  pinnedReleasedAt: string | null;
  dependsOn: Record<string, string>;
  verdict: "pass" | "fail";
  failures: string[];
};

const monthsBefore = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
};

const fetchJson = async (url: string, headers: Record<string, string> = {}) => {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
};

const github = (path: string, token: string) =>
  fetchJson(`${GITHUB}/${path}`, {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
  });

const licenceText = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  const type = (value as { type?: unknown } | null)?.type;
  return typeof type === "string" ? type : null;
};

const readRow = async (name: string, version: string, role: string, token: string, today: Date) => {
  const failures: string[] = [];
  const doc = await fetchJson(`${NPM}/${name.replace("/", "%2F")}`);
  const versions = (doc.versions ?? {}) as Record<string, Record<string, unknown>>;
  const meta = versions[version];
  if (!meta) throw new Error(`${name}@${version} is not in the registry`);
  const time = (doc.time ?? {}) as Record<string, string>;
  const latest = ((doc["dist-tags"] ?? {}) as Record<string, string>).latest ?? null;
  const licence = licenceText(meta.license);
  const licenceVerdict = classify(licence ?? undefined);
  if (licenceVerdict === "outside") failures.push(`licence ${licence ?? "none"} outside the rule`);

  const hint = REPOSITORY_HINTS[name];
  const found = repositoryOf(meta.repository) ?? repositoryOf(hint?.repository);
  const repository = found ? `${found.owner}/${found.repo}` : null;
  let stars: number | null = null;
  let pushedAt: string | null = null;
  let archived: boolean | null = null;
  if (repository) {
    const repo = await github(repository, token);
    stars = repo.stargazers_count as number;
    pushedAt = repo.pushed_at as string;
    archived = repo.archived as boolean;
    if (stars < MIN_STARS) failures.push(`stars ${stars} < ${MIN_STARS}`);
    if (new Date(pushedAt) < monthsBefore(today, 6)) failures.push(`last push ${pushedAt.slice(0, 10)} older than 6 months`);
    if (archived) failures.push("archived");
  } else {
    failures.push("no GitHub repository");
  }
  const latestReleasedAt = latest ? (time[latest] ?? null) : null;
  if (!latestReleasedAt || new Date(latestReleasedAt) < monthsBefore(today, 12)) {
    failures.push(`last release ${latestReleasedAt?.slice(0, 10) ?? "unknown"} older than 12 months`);
  }
  const dependsOn = {
    ...((meta.dependencies ?? {}) as Record<string, string>),
    ...Object.fromEntries(
      Object.entries((meta.peerDependencies ?? {}) as Record<string, string>).map(([k, v]) => [k, `peer ${v}`]),
    ),
  };
  const row: Row = {
    package: name,
    version,
    role,
    licence,
    licenceVerdict,
    repository,
    repositorySource: found && !repositoryOf(meta.repository) ? (hint?.source ?? "") : "package.json",
    stars,
    pushedAt,
    archived,
    latest,
    latestReleasedAt,
    pinnedReleasedAt: time[version] ?? null,
    dependsOn,
    verdict: failures.length === 0 ? "pass" : "fail",
    failures,
  };
  return row;
};

const main = async () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required: GITHUB_TOKEN=$(gh auth token) bun tools/adoption.ts");
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const today = new Date(`${date}T23:59:59Z`);
  const manifest = await Bun.file(join(PROBE, "package.json")).json();
  const direct: [string, string, string][] = [
    ...Object.entries(manifest.dependencies as Record<string, string>).map(
      ([n, v]) => [n, v, "direct"] as [string, string, string],
    ),
    ...Object.entries(manifest.devDependencies as Record<string, string>).map(
      ([n, v]) => [n, v, "direct (build or driver)"] as [string, string, string],
    ),
    ...Object.entries(CHECKS).map(([n, { version, check }]) => [n, version, check] as [string, string, string]),
  ];
  const rows: Row[] = [];
  for (const [name, version, role] of direct) rows.push(await readRow(name, version, role, token, today));
  const evidence = {
    date,
    rule: {
      licence: "MIT, Apache-2.0, BSD, ISC, 0BSD; MPL-2.0 or EPL-2.0 unmodified only (tools/check-licences.ts)",
      stars: `at least ${MIN_STARS}`,
      push: `since ${monthsBefore(today, 6).toISOString().slice(0, 10)}`,
      release: `since ${monthsBefore(today, 12).toISOString().slice(0, 10)}`,
      archived: "not archived",
    },
    rows,
  };
  await Bun.write(EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log("| Package | Pin | Role | Licence | Stars | Last push | Last release | Verdict |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    const verdict = r.verdict === "pass" ? "Pass" : `Fail: ${r.failures.join("; ")}`;
    console.log(
      `| \`${r.package}\` | ${r.version} | ${r.role} | ${r.licence ?? "none"} | ${r.stars?.toLocaleString("en-US") ?? "—"} (${r.repository ?? "—"}) | ${r.pushedAt?.slice(0, 10) ?? "—"} | ${r.latestReleasedAt?.slice(0, 10) ?? "—"} (${r.latest}) | ${verdict} |`,
    );
  }
};

if (import.meta.main) await main();
