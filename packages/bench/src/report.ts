// The benchmark's report (FR-32; early-benchmark design decisions 10 and 11): medians and spread
// per row and arm, the plain-question targets, the context added before the first ask, the cost of
// 100 questions, the answer delivery on the pull path, the settings and what was observed.

import {
  COST_DEFAULTS,
  type Cost,
  type CostInputs,
  costOf100,
  mixQuestion,
  PRICES_CHECKED,
  pricesFor,
} from "./cost.ts";
import type { AskMeasure, RunMeasure } from "./measure.ts";
import { ARMS, type Arm, ASKING_ARMS, type CaseId, type RowId, rowsOf } from "./scenarios.ts";
import type { CacheTtl, RunSettings } from "./settings.ts";
import { type Spread, spreadOf } from "./stats.ts";

export const REPORT_VERSION = "1.0";
/** Within +25% of AskUserQuestion (SM-1 to SM-4, plain questions). */
export const PLAIN_TARGET = 1.25;
/** PRD OQ2: an idle main conversation receives an answer within 2 s. */
export const DELIVERY_TARGET_MS = 2_000;

export type ReportContext = {
  readonly runId: string;
  readonly settings: RunSettings;
  /** What `claude --version` reported at preflight. */
  readonly claudeVersion: string | undefined;
  readonly pluginDir: string;
  readonly platform: string;
};

const FIGURES = [
  "k1",
  "k2",
  "output",
  "k3",
  "prepMs",
  "x",
  "a",
  "emit",
  "dispatch",
  "show",
] as const;
type Figure = (typeof FIGURES)[number];

export type ReportRow = {
  readonly row: RowId;
  readonly arm: Arm;
  readonly runs: number;
  readonly valid: number;
} & { readonly [figure in Figure]?: Spread };

export type Target = {
  readonly row: RowId | "S1";
  readonly kpi: "K1" | "K2" | "K3" | "cost";
  readonly askboard: number;
  readonly auq: number;
  readonly ratio: number;
  readonly within: boolean;
};

export type ArmCost = {
  readonly available: boolean;
  readonly inputs?: CostInputs;
  readonly cost?: Cost;
  readonly missing: readonly string[];
};

export type Report = {
  readonly version: string;
  readonly runId: string;
  readonly settings: RunSettings & {
    readonly claudeVersionInstalled: string | undefined;
    readonly pluginDir: string;
    readonly platform: string;
  };
  readonly loading: string;
  readonly arms: Readonly<
    Record<
      Arm,
      {
        readonly mcpServers: readonly string[];
        readonly plugins: readonly string[];
        readonly skills: readonly string[];
        readonly tools: readonly string[];
      }
    >
  >;
  readonly observed: {
    readonly versions: readonly string[];
    readonly models: readonly string[];
    readonly efforts: readonly string[];
    readonly ttl: CacheTtl | "mixed" | "none";
  };
  readonly differences: readonly string[];
  readonly rows: readonly ReportRow[];
  readonly targets: readonly Target[];
  readonly context: {
    readonly askboard?: Spread;
    /** The AskBoard arm's command without AskBoard: the difference is what AskBoard adds. */
    readonly baseline?: Spread;
    /** For information: AskUserQuestion's own definition is in this arm's first request. */
    readonly auq?: Spread;
    readonly added?: number;
    readonly toolSearch?: Spread;
  };
  readonly cost: {
    readonly model: string;
    readonly ttl: CacheTtl;
    readonly askboard: ArmCost;
    readonly auq: ArmCost;
  };
  readonly delivery: {
    readonly spread?: Spread;
    readonly targetMs: number;
    readonly within?: boolean;
  };
  readonly invalid: readonly {
    readonly caseId: CaseId;
    readonly arm: Arm;
    readonly run: number;
    readonly reason: string;
  }[];
  readonly rules: readonly string[];
  readonly costModel: string;
  readonly notes: readonly string[];
};

const ARM_NAMES: Readonly<Record<Arm, string>> = {
  askboard: "AskBoard",
  auq: "AskUserQuestion",
  baseline: "Baseline",
};

export const RULES: readonly string[] = [
  "Usage comes from the transcripts, deduplicated by requestId: one response stored as several entries counts once.",
  "K1 is the non-thinking output (output_tokens − thinking_tokens) of the response that emits the ask, plus every response that only prepares it: tool search, skill load, failed attempts. K2 is the billed thinking_tokens of the same responses. Both are per question.",
  "K3 runs from t0, the start of the request that emits the ask (the timestamp of the entry that triggered it), to t3′ for AskBoard and to t1, the tool call's entry, for AskUserQuestion. Prep is the time of the preparing responses before t0.",
  "t2′ is when the scripted board answerer started, the session process having opened the board; t3′ is when the board document and the open question reached it, through the board protocol. t3′ excludes rendering, which E1 does not report, and includes the answerer's start-up.",
  "The first ask of a session is the cold row, tool search included; the second is the warm row; S6 asks from a subagent. Retries count. Each case runs the set number of times; medians are compared and the spread is reported.",
  "A run counts only when it ended before its timeout, held every expected ask, asked the scenario's questions, the scripted answer reached the agent, and, for AskBoard, the answerer saw each board.",
];

const COST_MODEL = `Cost(100 q) = Σ_q [P_out·(K1+K2+X) + P_w·(K1+K2'+X+A) + P_r·R·(K1+K2'+X+A)] + Σ_sessions [T·(N_req·P_r + n_w·P_w)], with K2' = K2, ${COST_DEFAULTS.sessions} sessions of ${COST_DEFAULTS.questionsPerSession} questions, N_req = ${COST_DEFAULTS.requestsPerSession}, R = ${COST_DEFAULTS.reReads}, n_w = ${COST_DEFAULTS.writesOfT}, at the list prices checked on ${PRICES_CHECKED}. Per question, a session is 1 cold and 9 warm asks. X is the output of the requests that call collect; A the input growth over the asking flow's tool results; T, for AskBoard, the first-request difference from the baseline plus what tool search loads in the session, and 0 for AskUserQuestion. Answers after the TTL, at a ${COST_DEFAULTS.contextAtExpiry.toLocaleString("en-US")}-token context, are shown apart.`;

const NOTES: readonly string[] = [
  "AskBoard rows end K3 at t3′, not at a render beacon: E1 has no benchmark mode (proposal, open question 5).",
  "The answer-delivery figure measures an agent waiting in collect; the push targets come with the mod (E4).",
];

const median = (spread: Spread | undefined): number | undefined => spread?.median;

const figureOf = (ask: AskMeasure, figure: Figure): number | undefined => {
  if (figure === "emit" || figure === "dispatch" || figure === "show") return ask.splits?.[figure];
  return ask[figure];
};

const spreadOfFigure = (asks: readonly AskMeasure[], figure: Figure): Spread | undefined =>
  spreadOf(
    asks
      .map((ask) => figureOf(ask, figure))
      .filter((value): value is number => value !== undefined),
  );

const rowOf = (measures: readonly RunMeasure[], row: RowId, arm: Arm): ReportRow | undefined => {
  const runs = measures.filter(
    (measure) =>
      measure.arm === arm && (row === "S6" ? measure.caseId === "S6" : measure.caseId === "S1"),
  );
  if (runs.length === 0) return undefined;
  const asks = runs
    .filter((measure) => measure.valid)
    .flatMap((measure) => measure.asks.filter((ask) => ask.row === row));
  const figures = Object.fromEntries(
    FIGURES.flatMap((figure) => {
      const spread = spreadOfFigure(asks, figure);
      return spread === undefined ? [] : [[figure, spread]];
    }),
  );
  return {
    row,
    arm,
    runs: runs.length,
    valid: runs.filter((measure) => measure.valid).length,
    ...figures,
  };
};

const target = (
  row: RowId | "S1",
  kpi: Target["kpi"],
  askboard?: number,
  auq?: number,
): Target[] =>
  askboard === undefined || auq === undefined || auq === 0
    ? []
    : [{ row, kpi, askboard, auq, ratio: askboard / auq, within: askboard / auq <= PLAIN_TARGET }];

const validS1 = (measures: readonly RunMeasure[], arm: Arm) =>
  measures.filter((measure) => measure.caseId === "S1" && measure.arm === arm && measure.valid);

const contextOf = (measures: readonly RunMeasure[]): Report["context"] => {
  const firsts = (arm: Arm) =>
    spreadOf(
      validS1(measures, arm).flatMap((measure) =>
        measure.firstInput === undefined ? [] : [measure.firstInput],
      ),
    );
  const askboard = firsts("askboard");
  const baseline = firsts("baseline");
  const auq = firsts("auq");
  const toolSearch = spreadOf(
    validS1(measures, "askboard").flatMap((measure) =>
      measure.toolSearchGrowth === undefined ? [] : [measure.toolSearchGrowth],
    ),
  );
  return {
    ...(askboard === undefined ? {} : { askboard }),
    ...(baseline === undefined ? {} : { baseline }),
    ...(auq === undefined ? {} : { auq }),
    ...(askboard === undefined || baseline === undefined
      ? {}
      : { added: askboard.median - baseline.median }),
    ...(toolSearch === undefined ? {} : { toolSearch }),
  };
};

const armCost = (
  rows: readonly ReportRow[],
  arm: Arm,
  t: number | undefined,
  model: string,
  ttl: CacheTtl,
): ArmCost => {
  const prices = pricesFor(model);
  if (prices === undefined) return { available: false, missing: [`list prices for ${model}`] };
  const find = (row: RowId) => rows.find((item) => item.row === row && item.arm === arm);
  const cold = find("S1-cold");
  const warm = find("S1-warm");
  const mixed = (figure: Figure) => mixQuestion(median(cold?.[figure]), median(warm?.[figure]));
  const values = {
    K1: mixed("k1"),
    K2: mixed("k2"),
    X: arm === "auq" ? 0 : mixed("x"),
    A: mixed("a"),
    T: t,
  };
  const missing = Object.entries(values)
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);
  if (missing.length > 0) return { available: false, missing };
  const inputs: CostInputs = {
    k1: values.K1 ?? 0,
    k2: values.K2 ?? 0,
    x: values.X ?? 0,
    a: values.A ?? 0,
    t: values.T ?? 0,
  };
  return { available: true, inputs, cost: costOf100(inputs, prices, ttl), missing: [] };
};

const distinct = (values: readonly string[]): string[] => [...new Set(values)].sort();

const armsOf = (measures: readonly RunMeasure[]): Report["arms"] => {
  const of = (arm: Arm) => {
    const inits = measures
      .filter((measure) => measure.arm === arm)
      .flatMap((m) => (m.init === undefined ? [] : [m.init]));
    return {
      mcpServers: distinct(
        inits.flatMap((init) => init.mcpServers.map((s) => `${s.name} (${s.status})`)),
      ),
      plugins: distinct(inits.flatMap((init) => init.plugins.map((p) => `${p.name} (${p.path})`))),
      skills: distinct(inits.flatMap((init) => init.skills)),
      tools: distinct(inits.flatMap((init) => init.tools)),
    };
  };
  return { askboard: of("askboard"), auq: of("auq"), baseline: of("baseline") };
};

const observedOf = (measures: readonly RunMeasure[]): Report["observed"] => {
  const all = (pick: (measure: RunMeasure) => readonly string[]) =>
    distinct(measures.flatMap(pick));
  const main = measures.filter((measure) => measure.caseId === "S1");
  const writes = main.reduce(
    (sum, measure) => ({
      "5m": sum["5m"] + measure.observed.cacheWrites["5m"],
      "1h": sum["1h"] + measure.observed.cacheWrites["1h"],
    }),
    { "5m": 0, "1h": 0 },
  );
  const ttl =
    writes["5m"] > 0 && writes["1h"] > 0
      ? "mixed"
      : writes["5m"] > 0
        ? "5m"
        : writes["1h"] > 0
          ? "1h"
          : "none";
  return {
    versions: all((measure) => measure.observed.versions),
    models: all((measure) => measure.observed.models),
    efforts: all((measure) => measure.observed.efforts),
    ttl,
  };
};

// AskBoard's two skills (keyboard-shortcuts-help, design decision 11): the listing the benchmark
// measures holds both; the AskBoard arm still allows only the first (`command.ts`).
const EXPECTED_SKILLS: ReadonlySet<string> = new Set([
  "askboard:askboard",
  "askboard:askboard-help",
]);

const differencesOf = (
  observed: Report["observed"],
  context: ReportContext,
  arms: Report["arms"],
): string[] => {
  const differs = (values: readonly string[], pinned: string | undefined) =>
    pinned !== undefined && values.length > 0 && values.some((value) => value !== pinned);
  const { settings } = context;
  const unexpected = distinct(
    Object.values(arms).flatMap((arm) => arm.skills.filter((skill) => !EXPECTED_SKILLS.has(skill))),
  );
  return [
    ...(unexpected.length > 0
      ? [
          `skills: ${unexpected.join(", ")} listed beside ${[...EXPECTED_SKILLS].join(" and ")}; the listing is part of T and a call to one counts as preparation`,
        ]
      : []),
    ...(differs(observed.models, settings.model)
      ? [`model: ${observed.models.join(", ")} in the transcripts, ${settings.model} pinned`]
      : []),
    ...(differs(observed.efforts, settings.effort)
      ? [`effort: ${observed.efforts.join(", ")} in the transcripts, ${settings.effort} pinned`]
      : []),
    ...(differs(observed.versions, context.claudeVersion)
      ? [
          `Claude Code: ${observed.versions.join(", ")} in the transcripts, ${context.claudeVersion} at preflight`,
        ]
      : []),
    ...((observed.ttl === "5m" || observed.ttl === "1h") && observed.ttl !== settings.cacheTtl
      ? [
          `cache TTL: ${observed.ttl} written in the transcripts, ${settings.cacheTtl} requested; the cost uses ${observed.ttl}`,
        ]
      : []),
    ...(observed.ttl === "mixed"
      ? [
          `cache TTL: both 5m and 1h written in the transcripts; the cost uses the requested ${settings.cacheTtl}`,
        ]
      : []),
  ];
};

const loadingOf = (context: ReportContext): string => {
  const { settings, pluginDir } = context;
  const host = settings.auqPermissionHost
    ? "with bench's permission host (mcp__bench__approve, MCP_PROTOCOL_NEGOTIATION=legacy)"
    : "without a permission host";
  return `AskBoard arm: AskBoard loaded with --plugin-dir ${pluginDir} (session ${settings.session}), in the isolated configuration (--setting-sources "", restricted --tools, no --strict-mcp-config), BROWSER set to the scripted board answerer. AskUserQuestion arm: no AskBoard; AskUserQuestion answered by a PreToolUse hook in the run's settings, ${host}. E1 has no hooks, so no asking rule applies. Baseline: the AskBoard arm's command and prompt without --plugin-dir, ended after its first request.`;
};

export const buildReport = (measures: readonly RunMeasure[], context: ReportContext): Report => {
  const cases = distinct(measures.map((measure) => measure.caseId)) as CaseId[];
  const rows = rowsOf(cases).flatMap((row) =>
    ASKING_ARMS.flatMap((arm) => {
      const found = rowOf(measures, row, arm);
      return found === undefined ? [] : [found];
    }),
  );
  const find = (row: RowId, arm: Arm) => rows.find((item) => item.row === row && item.arm === arm);
  const kpiTargets = (["S1-cold", "S1-warm"] as const).flatMap((row) =>
    (["k1", "k2", "k3"] as const).flatMap((figure) =>
      target(
        row,
        figure.toUpperCase() as Target["kpi"],
        median(find(row, "askboard")?.[figure]),
        median(find(row, "auq")?.[figure]),
      ),
    ),
  );
  const contextFigures = contextOf(measures);
  const observed = observedOf(measures);
  const ttl: CacheTtl =
    observed.ttl === "5m" || observed.ttl === "1h" ? observed.ttl : context.settings.cacheTtl;
  const t =
    contextFigures.added === undefined || contextFigures.toolSearch === undefined
      ? undefined
      : Math.max(0, contextFigures.added) + contextFigures.toolSearch.median;
  const askboardCost = armCost(rows, "askboard", t, context.settings.model, ttl);
  const auqCost = armCost(rows, "auq", 0, context.settings.model, ttl);
  const delivery = spreadOf(
    measures
      .filter((measure) => measure.arm === "askboard" && measure.valid)
      .flatMap((measure) =>
        measure.asks.flatMap((ask) =>
          ask.answerToAgentMs === undefined ? [] : [ask.answerToAgentMs],
        ),
      ),
  );
  const arms = armsOf(measures);
  return {
    version: REPORT_VERSION,
    runId: context.runId,
    settings: {
      ...context.settings,
      claudeVersionInstalled: context.claudeVersion,
      pluginDir: context.pluginDir,
      platform: context.platform,
    },
    loading: loadingOf(context),
    arms,
    observed,
    differences: differencesOf(observed, context, arms),
    rows,
    targets: [
      ...kpiTargets,
      ...target("S1", "cost", askboardCost.cost?.total, auqCost.cost?.total),
    ],
    context: contextFigures,
    cost: { model: context.settings.model, ttl, askboard: askboardCost, auq: auqCost },
    delivery: {
      ...(delivery === undefined
        ? {}
        : { spread: delivery, within: delivery.median <= DELIVERY_TARGET_MS }),
      targetMs: DELIVERY_TARGET_MS,
    },
    invalid: measures
      .filter((measure) => !measure.valid)
      .map((measure) => ({
        caseId: measure.caseId,
        arm: measure.arm,
        run: measure.run,
        reason: measure.reason ?? "invalid",
      })),
    rules: RULES,
    costModel: COST_MODEL,
    notes: NOTES,
  };
};

// Markdown.

const num = (value: number | undefined): string =>
  value === undefined
    ? "n/a"
    : Number.isInteger(value)
      ? value.toLocaleString("en-US")
      : value.toFixed(1);
const money = (value: number | undefined): string =>
  value === undefined ? "n/a" : `$${value.toFixed(2)}`;
const table = (header: readonly string[], lines: readonly (readonly string[])[]): string =>
  [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...lines.map((line) => `| ${line.join(" | ")} |`),
  ].join("\n");
const list = (items: readonly string[]): string =>
  items.length === 0 ? "None." : items.map((item) => `- ${item}`).join("\n");

const settingsSection = (report: Report): string => {
  const s = report.settings;
  return table(
    ["Setting", "Value"],
    [
      ["Session process", `${s.session} (${s.pluginDir})`],
      ["Model", s.model],
      ["Effort", s.effort],
      ["Cache TTL", s.cacheTtl],
      ["Tool search (ENABLE_TOOL_SEARCH)", s.toolSearch],
      [
        "Claude Code",
        `${s.claudeVersionInstalled ?? "unknown"}${s.claudeVersion === undefined ? "" : ` (pinned ${s.claudeVersion})`}`,
      ],
      ["Runs per case and arm", String(s.runs)],
      [
        "Cases and arms",
        `${s.cases.join(", ")}; ${s.arms.map((arm) => ARM_NAMES[arm]).join(", ")}`,
      ],
      ["Max turns, timeout", `${s.maxTurns}, ${s.timeoutSeconds} s`],
      ["Platform", s.platform],
    ],
  );
};

const resultsSection = (report: Report): string => {
  const cell = (row: ReportRow, figure: Figure) => num(median(row[figure]));
  const medians = table(
    [
      "Row",
      "Arm",
      "Valid",
      "K1",
      "K2",
      "Output",
      "K3 (ms)",
      "Prep (ms)",
      "X",
      "A",
      "t0→t1",
      "t1→t2′",
      "t2′→t3′",
    ],
    report.rows.map((row) => [
      row.row,
      ARM_NAMES[row.arm],
      `${row.valid} of ${row.runs}`,
      ...(
        ["k1", "k2", "output", "k3", "prepMs", "x", "a", "emit", "dispatch", "show"] as const
      ).map((figure) => cell(row, figure)),
    ]),
  );
  const spread = table(
    ["Row", "Arm", "Figure", "Min", "Median", "p90", "Max"],
    report.rows.flatMap((row) =>
      (["k1", "k2", "k3"] as const).flatMap((figure) => {
        const value = row[figure];
        return value === undefined
          ? []
          : [
              [
                row.row,
                ARM_NAMES[row.arm],
                figure.toUpperCase(),
                num(value.min),
                num(value.median),
                num(value.p90),
                num(value.max),
              ],
            ];
      }),
    ),
  );
  return `Medians per question; tokens, and milliseconds where named. AskBoard's K3 ends at t3′.\n\n${medians}\n\nSpread across valid runs:\n\n${spread}`;
};

const targetsSection = (report: Report): string =>
  report.targets.length === 0
    ? "Not available: an arm has no valid S1 run."
    : table(
        ["Row", "KPI", "AskBoard", "AskUserQuestion", "Ratio", "Within +25%"],
        report.targets.map((item) => [
          item.row,
          item.kpi,
          item.kpi === "cost" ? money(item.askboard) : num(item.askboard),
          item.kpi === "cost" ? money(item.auq) : num(item.auq),
          item.ratio.toFixed(2),
          item.within ? "yes" : "no",
        ]),
      );

const contextSection = (report: Report): string => {
  const { context } = report;
  return table(
    ["Figure", "Tokens (median)"],
    [
      ["First request, AskBoard arm", num(median(context.askboard))],
      [
        "First request, baseline (the AskBoard arm without AskBoard)",
        num(median(context.baseline)),
      ],
      ["First request, AskUserQuestion arm (its own tool included)", num(median(context.auq))],
      ["Added by AskBoard before the first ask", num(context.added)],
      ["Loaded by the tool search at the first ask", num(median(context.toolSearch))],
    ],
  );
};

const costSection = (report: Report): string => {
  const line = (arm: "askboard" | "auq") => {
    const found = report.cost[arm];
    if (!found.available || found.cost === undefined || found.inputs === undefined) {
      return [ARM_NAMES[arm], `not available: ${found.missing.join(", ")}`, "", "", "", "", "", ""];
    }
    const { inputs, cost } = found;
    return [
      ARM_NAMES[arm],
      `K1 ${num(inputs.k1)}, K2 ${num(inputs.k2)}, X ${num(inputs.x)}, A ${num(inputs.a)}, T ${num(inputs.t)}`,
      money(cost.generation),
      money(cost.cacheWrite),
      money(cost.reReads),
      money(cost.toolOverhead),
      money(cost.total),
      money(cost.afterTtl),
    ];
  };
  return `Model ${report.cost.model}, cache TTL ${report.cost.ttl}, USD at list prices.\n\n${table(
    [
      "Arm",
      "Inputs",
      "Generation",
      "Cache write",
      "Re-reads",
      "Tool overhead",
      "Total",
      "If answered after the TTL, add",
    ],
    [line("askboard"), line("auq")],
  )}`;
};

const deliverySection = (report: Report): string => {
  const { spread, within, targetMs } = report.delivery;
  if (spread === undefined) return "Not available: no valid AskBoard run.";
  return `From the scripted answer to the transcript entry carrying the collect result, for an agent waiting in collect: median ${num(spread.median)} ms, p90 ${num(spread.p90)} ms, max ${num(spread.max)} ms over ${spread.n} asks; target ${num(targetMs)} ms: ${within ? "met" : "not met"}.`;
};

const observedSection = (report: Report): string => {
  const o = report.observed;
  const arms = ARMS.map(
    (arm) =>
      `- ${ARM_NAMES[arm]}: MCP servers ${report.arms[arm].mcpServers.join(", ") || "none"}; plugins ${report.arms[arm].plugins.join(", ") || "none"}; skills ${report.arms[arm].skills.join(", ") || "none"}; tools ${report.arms[arm].tools.join(", ") || "none"}`,
  );
  return [
    `- Claude Code ${o.versions.join(", ") || "not observed"}; model ${o.models.join(", ") || "not observed"}; effort ${o.efforts.join(", ") || "not observed"}; cache writes ${o.ttl}.`,
    ...arms,
    "",
    "Differences from the pinned settings:",
    "",
    list(report.differences),
  ].join("\n");
};

export const renderMarkdown = (report: Report): string =>
  [
    `# AskBoard early benchmark, ${report.runId}`,
    "## Settings",
    settingsSection(report),
    "## How AskBoard was loaded",
    report.loading,
    "## Results per question",
    resultsSection(report),
    "## Plain-question targets (SM-1 to SM-4)",
    targetsSection(report),
    "## Context before the first ask (NFR-1)",
    contextSection(report),
    "## Cost of 100 questions (SM-4)",
    costSection(report),
    "## Answer delivery on the pull path (PRD OQ2)",
    deliverySection(report),
    "## Observed in the transcripts",
    observedSection(report),
    "## Invalid runs",
    report.invalid.length === 0
      ? "None."
      : table(
          ["Case", "Arm", "Run", "Reason"],
          report.invalid.map((item) => [
            item.caseId,
            ARM_NAMES[item.arm],
            String(item.run),
            item.reason,
          ]),
        ),
    "## Counting rules and cost model",
    list([...report.rules, report.costModel, ...report.notes]),
    "",
  ].join("\n\n");
