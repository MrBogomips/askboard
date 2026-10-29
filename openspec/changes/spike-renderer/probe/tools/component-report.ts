// Summarises a group 4 run per fixture and engine: the verdict and its reasons, the violations
// grouped by directive, blocked URI and policy, the CSP console lines, and the draft and state
// after each action.
//
// Usage, from probe/: bun tools/component-report.ts <run> [--steps] [--fixtures a,b]

import { readdir } from "node:fs/promises";
import { join } from "node:path";

const [run, ...flags] = process.argv.slice(2);
if (!run) throw new Error("usage: bun tools/component-report.ts <run> [--steps] [--fixtures a,b]");
const showSteps = flags.includes("--steps");
const only = flags.includes("--fixtures") ? (flags[flags.indexOf("--fixtures") + 1] ?? "").split(",") : null;
const root = join(import.meta.dir, "..", "runs", run);

type Violation = { directive?: string; blockedURI?: string; policy?: string; where?: string; sample?: string };
type Load = {
  fixture: string;
  verdict: string;
  reasons: string[];
  timeToVisibleMs: number | null;
  probe: { events: { kind: string; [k: string]: unknown }[]; board: Violation[] };
  console: { text: string; phase: string }[];
  steps?: { action: { do: string; selector?: string; key?: string }; error: string | null; state: Record<string, unknown> | null }[];
};

const policyOf = (v: Violation) => (String(v.policy ?? "").includes("connect-src 'self'") ? "board" : "view");

for (const engine of (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && d.name !== "snapshots")) {
  const files = (await readdir(join(root, engine.name))).filter((f) => f.endsWith(".json")).sort();
  for (const file of files) {
    const load = (await Bun.file(join(root, engine.name, file)).json()) as Load;
    if (only && !only.includes(load.fixture)) continue;
    const violations = [
      ...load.probe.events.filter((e) => e.kind === "violation").map((e) => ({ ...(e as Violation), where: "view" })),
      ...load.probe.board.filter((e) => !String(e.blockedURI).endsWith("/favicon.ico")).map((e) => ({ ...e, where: "board" })),
    ];
    const groups = new Map<string, { n: number; sample: string }>();
    for (const v of violations) {
      const key = `${v.directive} ${v.blockedURI || "inline"} (${policyOf(v)} policy, to ${v.where})`;
      const group = groups.get(key) ?? { n: 0, sample: String(v.sample ?? "").slice(0, 80) };
      group.n += 1;
      groups.set(key, group);
    }
    const reasons = load.reasons.map((r) => r.slice(0, 220)).join("; ");
    console.log(`${engine.name.padEnd(8)} ${load.fixture.padEnd(20)} ${load.verdict.padEnd(6)} ${reasons}`);
    for (const [key, { n, sample }] of groups) console.log(`    ${n}× ${key}${sample ? ` «${sample}»` : ""}`);
    const lines = load.console.filter((m) => m.phase !== "screenshot" && /Refused to|Content.Security.Policy/i.test(m.text));
    if (lines.length > 0 && violations.length === 0) {
      for (const m of lines.slice(0, 3)) console.log(`    console only: ${m.text.slice(0, 160)}`);
    }
    if (showSteps) {
      for (const step of load.steps ?? []) {
        const s = step.state ?? {};
        const draft = s.draft as { values?: unknown; ui?: unknown } | undefined;
        console.log(
          `    ${step.action.do} ${step.action.selector ?? step.action.key ?? ""}${step.error ? ` ERROR ${step.error.slice(0, 120)}` : ""}` +
            ` → values ${JSON.stringify(draft?.values)} ui ${JSON.stringify(draft?.ui)} scrollY ${s.scrollY}/${s.scrollMax}` +
            ` overflow ${s.bodyOverflow} locked ${s.scrollLocked} dialogs ${s.dialogs} focus ${JSON.stringify(s.focus)}`,
        );
      }
    }
  }
}
