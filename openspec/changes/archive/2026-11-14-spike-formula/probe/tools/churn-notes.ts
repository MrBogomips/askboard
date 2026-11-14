// Reads IronCalc's GitHub release notes and changelog history, so each npm release of
// @ironcalc/wasm can carry the release-note lines that touch the JavaScript/WebAssembly API.

const REPO = "ironcalc/IronCalc";
const API = "https://api.github.com";

// Lines worth reading for API churn; front-end (app, widget) and other bindings are noise here.
const API_LINE = /\b(wasm|webassembly|javascript|js|bindings?|api|breaking|renames?|renamed|deprecat\w*|initSync|fromBytes|constructor|model|usermodel)\b/i;
const NOT_JS = /\b(python|nodejs|node\.js|widget|app|MUI|docs?)\b|\[app\]|\[Widget\]/i;

export interface GitHubRelease {
  tag: string;
  publishedAt: string;
  url: string;
  apiLines: string[];
}

export interface ChangelogInfo {
  presentOnMain: boolean;
  history: { sha: string; date: string; message: string }[];
  lastContentRef: string | null;
  lastContent: string | null;
}

async function gh<T>(path: string, token: string | undefined): Promise<{ status: number; body: T | null }> {
  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers });
  if (res.status === 404) return { status: 404, body: null };
  if (!res.ok) throw new Error(`GitHub ${path}: HTTP ${res.status} ${await res.text()}`);
  return { status: res.status, body: (await res.json()) as T };
}

function apiLines(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[*-] /.test(l) && API_LINE.test(l) && !NOT_JS.test(l))
    // Keep the pull request URL as the source; drop the author handle.
    .map((l) => l.replace(/^[*-] /, "").replace(/ by @[\w-]+ in (https\S+)/, " ($1)"));
}

export async function readReleases(token: string | undefined): Promise<GitHubRelease[]> {
  type Raw = { tag_name: string; published_at: string; html_url: string; body: string | null }[];
  const { body } = await gh<Raw>(`/repos/${REPO}/releases?per_page=100`, token);
  return (body ?? []).map((r) => ({
    tag: r.tag_name,
    publishedAt: r.published_at,
    url: r.html_url,
    apiLines: apiLines(r.body ?? ""),
  }));
}

// The changelog was deleted from the repository; read its history and its last content.
export async function readChangelog(token: string | undefined): Promise<ChangelogInfo> {
  const onMain = await gh<unknown>(`/repos/${REPO}/contents/CHANGELOG.md`, token);
  type Commits = { sha: string; commit: { author: { date: string }; message: string } }[];
  const { body: commits } = await gh<Commits>(`/repos/${REPO}/commits?path=CHANGELOG.md&per_page=100`, token);
  const history = (commits ?? []).map((c) => ({
    sha: c.sha,
    date: c.commit.author.date,
    message: c.commit.message.split("\n")[0] ?? "",
  }));
  let lastContentRef: string | null = null;
  let lastContent: string | null = null;
  for (const c of history) {
    const { body } = await gh<{ content: string }>(`/repos/${REPO}/contents/CHANGELOG.md?ref=${c.sha}`, token);
    if (body) {
      lastContentRef = c.sha;
      lastContent = Buffer.from(body.content, "base64").toString("utf8");
      break;
    }
  }
  return { presentOnMain: onMain.status !== 404, history, lastContentRef, lastContent };
}
