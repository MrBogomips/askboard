// Task 1.2: the adoption rule of docs/prd-askboard-2026-10-25/addendum.md, applied to every direct
// dependency of the probe's package.json, from the npm registry and the GitHub API.
// Usage: GITHUB_TOKEN=$(gh auth token) bun tools/adoption.ts [--date YYYY-MM-DD] [--out <file>]
import { join } from "node:path";
import { classify, repositoryOf } from "../../../../../tools/check-licences.ts";

const NPM = "https://registry.npmjs.org";
const GITHUB = "https://api.github.com";
const MIN_STARS = 1000;
const PUSH_MONTHS = 6;
const RELEASE_MONTHS = 12;

type Failure =
  | "licence-outside-rule"
  | "stars-below-1000"
  | "no-push-in-6-months"
  | "no-release-in-12-months"
  | "archived"
  | "no-github-repository"
  | "lookup-failed";

interface Row {
  package: string;
  pin: string;
  kind: "dependency" | "devDependency";
  npmLicence: string | null;
  githubLicence: string | null;
  licenceVerdict: string;
  repository: string | null;
  stars: number | null;
  lastPush: string | null;
  lastRelease: { date: string; source: string; name: string } | null;
  pinPublished: string | null;
  npmLatest: string | null;
  archived: boolean | null;
  result: "pass" | "pass (unmodified only)" | "fail";
  failures: Failure[];
  notes: string[];
}

const argValue = (name: string): string | undefined => {
  const at = Bun.argv.indexOf(name);
  return at >= 0 ? Bun.argv[at + 1] : undefined;
};

const monthsBefore = (date: string, months: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
};

const getJson = async (url: string, token?: string): Promise<unknown> => {
  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
};

interface Packument {
  "dist-tags"?: Record<string, string>;
  time?: Record<string, string>;
  versions?: Record<string, { license?: unknown; repository?: unknown }>;
  repository?: unknown;
}

interface GitHubRepo {
  stargazers_count: number;
  pushed_at: string;
  archived: boolean;
  license: { spdx_id: string } | null;
}

interface GitHubRelease {
  tag_name: string;
  published_at: string | null;
  prerelease: boolean;
}

// GitHub's releases/latest skips pre-releases; a project releasing only pre-releases still counts.
const latestRelease = async (slug: string, token: string) => {
  const list = (await getJson(`${GITHUB}/repos/${slug}/releases?per_page=20`, token)) as
    | GitHubRelease[]
    | undefined;
  const dated = (list ?? []).filter((r) => r.published_at !== null);
  dated.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  return dated[0];
};

const licenceText = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const assess = async (
  name: string,
  pin: string,
  kind: Row["kind"],
  runDate: string,
  token: string,
): Promise<Row> => {
  const notes: string[] = [];
  const failures: Failure[] = [];
  const doc = (await getJson(`${NPM}/${name.replace("/", "%2F")}`)) as Packument | undefined;
  if (!doc) throw new Error(`${name}: not in the npm registry`);
  const manifest = doc.versions?.[pin];
  const npmLicence = licenceText(manifest?.license);
  const npmLatest = doc["dist-tags"]?.latest ?? null;
  const repo = repositoryOf(manifest?.repository ?? doc.repository);
  const slug = repo ? `${repo.owner}/${repo.repo}` : null;
  if (pin.startsWith("0.")) notes.push("0.x version: minor releases may break the API");
  if (npmLatest && npmLatest !== pin) notes.push(`npm latest is ${npmLatest}, the pin is ${pin}`);

  let gh: GitHubRepo | undefined;
  let release: Row["lastRelease"] = null;
  if (!slug) failures.push("no-github-repository");
  else {
    try {
      gh = (await getJson(`${GITHUB}/repos/${slug}`, token)) as GitHubRepo | undefined;
      const latest = await latestRelease(slug, token);
      if (latest?.published_at) {
        const source = latest.prerelease ? "GitHub releases (pre-release)" : "GitHub releases";
        release = { date: latest.published_at, source, name: latest.tag_name };
      }
    } catch (error) {
      failures.push("lookup-failed");
      notes.push(error instanceof Error ? error.message : String(error));
    }
  }
  const npmDate = npmLatest ? doc.time?.[npmLatest] : undefined;
  // A monorepo's GitHub releases may belong to another package (DefinitelyTyped has none):
  // the later of the GitHub release and the npm publish of `latest` is the package's last release.
  if (npmDate && (!release || npmDate > release.date)) {
    release = { date: npmDate, source: "npm publish of latest", name: npmLatest ?? "" };
  }

  const licenceVerdict = npmLicence ? classify(npmLicence) : "outside";
  if (licenceVerdict === "outside") failures.push("licence-outside-rule");
  const githubLicence = gh?.license?.spdx_id ?? null;
  if (githubLicence && npmLicence && githubLicence !== npmLicence) {
    notes.push(`GitHub reports ${githubLicence} for the repository; npm reports ${npmLicence}`);
  }
  if (gh) {
    if (gh.stargazers_count < MIN_STARS) failures.push("stars-below-1000");
    if (gh.pushed_at.slice(0, 10) < monthsBefore(runDate, PUSH_MONTHS)) {
      failures.push("no-push-in-6-months");
    }
    if (gh.archived) failures.push("archived");
  }
  if (!release || release.date.slice(0, 10) < monthsBefore(runDate, RELEASE_MONTHS)) {
    failures.push("no-release-in-12-months");
  }
  if (slug === "DefinitelyTyped/DefinitelyTyped") {
    notes.push("stars, push and archived flag are DefinitelyTyped's, the repository holding every @types package");
  }

  const result: Row["result"] =
    failures.length > 0 ? "fail" : licenceVerdict === "unmodified-only" ? "pass (unmodified only)" : "pass";
  return {
    package: name,
    pin,
    kind,
    npmLicence,
    githubLicence,
    licenceVerdict,
    repository: slug,
    stars: gh?.stargazers_count ?? null,
    lastPush: gh?.pushed_at ?? null,
    lastRelease: release,
    pinPublished: doc.time?.[pin] ?? null,
    npmLatest,
    archived: gh?.archived ?? null,
    result,
    failures,
    notes,
  };
};

const main = async (): Promise<number> => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("adoption: GITHUB_TOKEN is required (GITHUB_TOKEN=$(gh auth token))");
    return 2;
  }
  const probe = join(import.meta.dir, "..");
  const runDate = argValue("--date") ?? new Date().toLocaleDateString("sv-SE");
  const out = argValue("--out") ?? join(probe, "..", "evidence", "adoption.json");
  const pkg = (await Bun.file(join(probe, "package.json")).json()) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const direct = [
    ...Object.entries(pkg.dependencies ?? {}).map(([n, v]) => [n, v, "dependency"] as const),
    ...Object.entries(pkg.devDependencies ?? {}).map(([n, v]) => [n, v, "devDependency"] as const),
  ];
  const rows = await Promise.all(direct.map(([n, v, k]) => assess(n, v, k, runDate, token)));
  const rule = {
    source: "docs/prd-askboard-2026-10-25/addendum.md, Adoption rule",
    licence: "permissive (MIT, Apache-2.0, BSD, ISC, 0BSD); MPL-2.0 or EPL-2.0 only unmodified",
    stars: `at least ${MIN_STARS}, or a named exception`,
    pushSince: monthsBefore(runDate, PUSH_MONTHS),
    releaseSince: monthsBefore(runDate, RELEASE_MONTHS),
    archived: "not archived",
  };
  await Bun.write(out, `${JSON.stringify({ runDate, generatedAt: new Date().toISOString(), rule, rows }, null, 2)}\n`);
  for (const r of rows) {
    const why = r.failures.length > 0 ? ` (${r.failures.join(", ")})` : "";
    console.log(`${r.package}@${r.pin}: ${r.result}${why}`);
  }
  console.log(`adoption: ${rows.length} rows written to ${out}`);
  return rows.some((r) => r.failures.includes("lookup-failed")) ? 1 : 0;
};

process.exitCode = await main();
