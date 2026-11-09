import { describe, expect, test } from "bun:test";
import { costOf100, pricesFor } from "../src/cost.ts";
import { measureRun, type RunInput, type RunMeasure } from "../src/measure.ts";
import { buildReport, type ReportContext, renderMarkdown } from "../src/report.ts";
import { DEFAULTS } from "../src/settings.ts";
import { parseTranscript } from "../src/transcript.ts";
import { askboardS1, auqS1, baselineS1, boardRecords, s6Main } from "./support/flows.ts";

const price = (model: string) => {
  const found = pricesFor(model);
  if (found === undefined) throw new Error(`no prices for ${model}`);
  return found;
};

const init = (arm: "askboard" | "auq" | "baseline") => ({
  model: "claude-opus-5-5",
  version: "2.1.314",
  tools: arm === "askboard" ? ["ToolSearch"] : ["AskUserQuestion", "ToolSearch"],
  mcpServers:
    arm === "askboard"
      ? [
          { name: "plugin:askboard:askboard", status: "connected" },
          { name: "claude.ai Docs", status: "connected" },
        ]
      : [
          { name: "bench", status: "connected" },
          { name: "claude.ai Docs", status: "connected" },
        ],
  plugins: arm === "askboard" ? [{ name: "askboard", path: "/repo" }] : [],
  skills: arm === "askboard" ? ["askboard:askboard"] : [],
  result: { subtype: "success", isError: false },
});

const run = (overrides: Partial<RunInput>): RunMeasure =>
  measureRun({
    caseId: "S1",
    arm: "askboard",
    run: 1,
    main: parseTranscript(askboardS1()),
    subagents: [],
    records: boardRecords(),
    init: init("askboard"),
    timedOut: false,
    exitCode: 0,
    ...overrides,
  });

const measures: RunMeasure[] = [
  run({ run: 1 }),
  run({ run: 2 }),
  run({ run: 3, timedOut: true }),
  run({ arm: "auq", run: 1, main: parseTranscript(auqS1()), records: [], init: init("auq") }),
  run({ arm: "auq", run: 2, main: parseTranscript(auqS1()), records: [], init: init("auq") }),
  run({
    caseId: "S6",
    main: parseTranscript(s6Main()),
    subagents: [parseTranscript(askboardS1({ agentId: "a" }))],
  }),
  run({
    arm: "baseline",
    run: 1,
    main: parseTranscript(baselineS1()),
    records: [],
    init: init("baseline"),
  }),
  run({
    arm: "baseline",
    run: 2,
    main: parseTranscript(baselineS1()),
    records: [],
    init: init("baseline"),
  }),
];

const context: ReportContext = {
  runId: "20261030T100000Z",
  settings: DEFAULTS,
  claudeVersion: "2.1.314",
  pluginDir: "/repo",
  platform: "darwin-arm64",
};

describe("buildReport", () => {
  const report = buildReport(measures, context);

  test("has a row per case row and arm, with n valid of n run", () => {
    expect(report.rows.map((row) => [row.row, row.arm, row.valid, row.runs])).toEqual([
      ["S1-cold", "askboard", 2, 3],
      ["S1-cold", "auq", 2, 2],
      ["S1-warm", "askboard", 2, 3],
      ["S1-warm", "auq", 2, 2],
      ["S6", "askboard", 1, 1],
    ]);
    expect(report.rows[0]).toMatchObject({
      k1: { median: 420, n: 2 },
      k2: { median: 180 },
      output: { median: 600 },
      k3: { median: 1_100, p90: 1_100 },
      prepMs: { median: 2_500 },
      x: { median: 90 },
      a: { median: 215 },
      emit: { median: 600 },
      dispatch: { median: 200 },
      show: { median: 300 },
    });
  });

  test("checks the plain-question targets as ratios of medians", () => {
    const cold = report.targets.filter((target) => target.row === "S1-cold");
    expect(cold.map((target) => [target.kpi, target.askboard, target.auq])).toEqual([
      ["K1", 420, 260],
      ["K2", 180, 90],
      ["K3", 1_100, 1_100],
    ]);
    expect(cold[0]?.ratio).toBeCloseTo(420 / 260, 6);
    expect(cold[0]?.within).toBe(false);
    expect(cold[2]).toMatchObject({ ratio: 1, within: true });
  });

  test("the context AskBoard adds before the first ask, against the baseline, and the tool search", () => {
    expect(report.context).toMatchObject({
      askboard: { median: 20_010 },
      baseline: { median: 19_210 },
      auq: { median: 19_000 },
      added: 800,
      toolSearch: { median: 1_500 },
    });
  });

  test("without a baseline, the context added and AskBoard's T are not available", () => {
    const without = buildReport(
      measures.filter((measure) => measure.arm !== "baseline"),
      context,
    );
    expect(without.context.added).toBeUndefined();
    expect(without.cost.askboard).toMatchObject({ available: false, missing: ["T"] });
  });

  test("the cost of 100 questions per arm from the mixed medians", () => {
    const prices = price("claude-opus-5-5");
    const askboard = costOf100({ k1: 330, k2: 72, x: 85.5, a: 214.1, t: 2_300 }, prices, "5m");
    const auq = costOf100({ k1: 251, k2: 54, x: 0, a: 58.2, t: 0 }, prices, "5m");
    expect(report.cost.ttl).toBe("5m");
    expect(report.cost.askboard).toMatchObject({ available: true });
    expect(report.cost.askboard.cost?.total).toBeCloseTo(askboard.total, 9);
    expect(report.cost.auq.cost?.total).toBeCloseTo(auq.total, 9);
    expect(report.cost.askboard.inputs).toEqual({
      k1: 330,
      k2: 72,
      x: 85.5,
      a: expect.closeTo(214.1, 9),
      t: 2_300,
    });
    const target = report.targets.find((item) => item.kpi === "cost");
    expect(target?.ratio).toBeCloseTo(askboard.total / auq.total, 9);
  });

  test("the answer reaching a waiting agent, against 2 s", () => {
    expect(report.delivery).toMatchObject({
      spread: { median: 1_000, n: 5 },
      targetMs: 2_000,
      within: true,
    });
  });

  test("lists invalid runs, the arms' servers and plugins, and the rules", () => {
    expect(report.invalid).toEqual([
      { caseId: "S1", arm: "askboard", run: 3, reason: "timed out" },
    ]);
    expect(report.arms.askboard).toMatchObject({
      mcpServers: ["claude.ai Docs (connected)", "plugin:askboard:askboard (connected)"],
      plugins: ["askboard (/repo)"],
      skills: ["askboard:askboard"],
    });
    expect(report.arms.auq.skills).toEqual([]);
    expect(report.arms.auq.mcpServers).toContain("bench (connected)");
    expect(report.loading).toContain("--plugin-dir /repo");
    expect(report.rules.join(" ")).toContain("requestId");
    expect(report.costModel).toContain("1 cold and 9 warm");
    expect(report.differences).toEqual([]);
  });

  test("names each observed value that differs from the pinned one", () => {
    const other = buildReport(measures, {
      ...context,
      settings: { ...DEFAULTS, model: "claude-sonnet-5-5", effort: "high" },
      claudeVersion: "2.1.315",
    });
    expect(other.differences).toEqual([
      "model: claude-opus-5-5 in the transcripts, claude-sonnet-5-5 pinned",
      "effort: medium in the transcripts, high pinned",
      "Claude Code: 2.1.314 in the transcripts, 2.1.315 at preflight",
    ]);
  });

  test("flags a skill other than askboard:askboard, naming it, and nothing for the expected lists", () => {
    expect(report.differences.join(" ")).not.toContain("skill");
    const [first, ...rest] = measures;
    if (first === undefined || first.init === undefined) throw new Error("no measure");
    const extra = {
      ...first,
      init: { ...first.init, skills: ["askboard:askboard", "deep-research"] },
    };
    const flagged = buildReport([extra, ...rest], context);
    expect(flagged.differences).toHaveLength(1);
    expect(flagged.differences[0]).toContain("deep-research");
    expect(flagged.differences[0]).not.toContain("askboard:askboard (");
    expect(renderMarkdown(flagged)).toContain("skills askboard:askboard, deep-research");
  });

  test("the help skill in the listing is expected, and another skill beside it is flagged", () => {
    const [first, ...rest] = measures;
    if (first === undefined || first.init === undefined) throw new Error("no measure");
    const both = {
      ...first,
      init: { ...first.init, skills: ["askboard:askboard", "askboard:askboard-help"] },
    };
    expect(buildReport([both, ...rest], context).differences.join(" ")).not.toContain("skill");
    const other = {
      ...first,
      init: { ...first.init, skills: ["askboard:askboard", "askboard:askboard-help", "x:y"] },
    };
    const flagged = buildReport([other, ...rest], context);
    expect(flagged.differences).toHaveLength(1);
    expect(flagged.differences[0]).toContain("x:y");
    expect(flagged.differences[0]).toStartWith("skills: x:y listed beside");
  });

  test("a run that wrote both 5-minute and 1-hour caches is flagged", () => {
    const [first, ...rest] = measures;
    if (first === undefined) throw new Error("no measure");
    const mixed = {
      ...first,
      observed: { ...first.observed, cacheWrites: { "5m": 10, "1h": 10 } },
    };
    const flagged = buildReport([mixed, ...rest], context);
    expect(flagged.observed.ttl).toBe("mixed");
    expect(flagged.differences).toContain(
      "cache TTL: both 5m and 1h written in the transcripts; the cost uses the requested 5m",
    );
  });

  test("an arm without valid runs has no figures and no cost", () => {
    const empty = buildReport([run({ timedOut: true })], context);
    expect(
      empty.rows.find((row) => row.row === "S1-cold" && row.arm === "askboard")?.k1,
    ).toBeUndefined();
    expect(empty.cost.askboard).toMatchObject({ available: false });
    expect(empty.cost.askboard.missing).toContain("K1");
    expect(empty.targets).toEqual([]);
    expect(empty.delivery.spread).toBeUndefined();
  });

  test("an unpriced model gets no cost, saying why", () => {
    const unpriced = buildReport(measures, {
      ...context,
      settings: { ...DEFAULTS, model: "claude-x" },
    });
    expect(unpriced.cost.askboard).toMatchObject({
      available: false,
      missing: ["list prices for claude-x"],
    });
  });
});

describe("renderMarkdown", () => {
  const markdown = renderMarkdown(buildReport(measures, context));

  test("has every section, the t3′ label and the figures", () => {
    for (const heading of [
      "# AskBoard early benchmark, 20261030T100000Z",
      "## Settings",
      "## How AskBoard was loaded",
      "## Results per question",
      "## Plain-question targets (SM-1 to SM-4)",
      "## Context before the first ask (NFR-1)",
      "## Cost of 100 questions (SM-4)",
      "## Answer delivery on the pull path (PRD OQ2)",
      "## Observed in the transcripts",
      "## Invalid runs",
      "## Counting rules and cost model",
    ]) {
      expect(markdown).toContain(heading);
    }
    expect(markdown).toContain("t3′");
    expect(markdown).toContain("| S1-cold | AskBoard | 2 of 3 | 420 |");
    expect(markdown).toContain("timed out");
  });
});
