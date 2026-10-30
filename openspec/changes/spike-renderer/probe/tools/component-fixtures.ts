// Writes the component fixtures of task group 4 into fixtures/: the JSON files are the record,
// and this script says how they were made. One component per fixture (design decision 6), with
// one user action and the draft value it must leave.
//
// Usage, from probe/: bun tools/component-fixtures.ts

import { join } from "node:path";
import type { Action, Fixture } from "../board.ts";

const dir = join(import.meta.dir, "..", "fixtures");
const written: string[] = [];
const write = async (name: string, fixture: Fixture) => {
  await Bun.write(`${dir}/${name}.json`, `${JSON.stringify(fixture, null, 2)}\n`);
  written.push(name);
};

type Item = Fixture["board"]["items"][number];
const board = (id: string, title: string, items: Item[]) => ({ id, title, items });
const one = (
  name: string,
  description: string,
  item: Item,
  rest: Omit<Fixture, "description" | "board"> = {},
): Promise<void> => write(name, { description, board: board(name, description, [item]), ...rest });

const click = (selector: string, extra: Partial<Action> = {}): Action => ({ do: "click", selector, ...extra });
// MathLive loses keys that Playwright's `keyboard.type` sends right after the click that focuses
// the field (control run too), so a formula is typed one key at a time.
const typeKeys = (selector: string, keys: string[]): Action[] => [
  click(selector),
  ...keys.map((key): Action => ({ do: "press", key, ms: 300 })),
];
const options = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

// --- Task 4.1: the component matrix (run `matrix`) ---------------------------------------------

await one(
  "c-radio",
  "Radix Radio Group (Choice, single)",
  { id: "c1", type: "Choice", props: { label: "Policy", options: options([["fixed", "Fixed delay"], ["expo", "Exponential backoff"]]) } },
  { actions: [click("label[for=c1-expo]")], expectDraft: { c1: "expo" }, check: { selector: "[data-item-id=c1]", text: "Exponential" } },
);
await one(
  "c-checkbox",
  "Radix Checkbox (Choice, multiple)",
  {
    id: "c2",
    type: "Choice",
    props: { label: "Targets", multiple: true, options: options([["a", "Alpha"], ["b", "Beta"], ["c", "Gamma"]]) },
  },
  { actions: [click("label[for=c2-a]"), click("label[for=c2-c]")], expectDraft: { c2: ["a", "c"] } },
);
await one(
  "c-switch",
  "Radix Switch (Toggle)",
  { id: "s1", type: "Toggle", props: { label: "Retry on timeout" } },
  { actions: [click("#s1-switch")], expectDraft: { s1: true } },
);
await write("c-tabs", {
  description: "Radix Tabs",
  board: board("c-tabs", "Radix Tabs", [
    {
      id: "tb1",
      type: "Tabs",
      props: { label: "Views", tabs: ["Summary", "Detail"] },
      children: [
        { id: "tb1a", type: "Text", props: { text: "Summary panel" } },
        { id: "tb1b", type: "Text", props: { text: "Detail panel" } },
      ],
    },
  ]),
  actions: [click("[role=tab]:has-text('Detail')")],
  expectDraft: { "ui:tb1": "1" },
});
const SIZES = options([["s", "Small"], ["m", "Medium"], ["l", "Large"]]);
await one(
  "c-select",
  "Radix Select, item-aligned (its default position)",
  { id: "se1", type: "Select", props: { label: "Size", options: SIZES } },
  { actions: [click("#se1-trigger"), click("[role=option]:has-text('Medium')")], expectDraft: { se1: "m" } },
);
await one(
  "c-select-popper",
  "Radix Select, popper position",
  { id: "se1", type: "Select", props: { label: "Size", options: SIZES, position: "popper" } },
  { actions: [click("#se1-trigger"), click("[role=option]:has-text('Large')")], expectDraft: { se1: "l" } },
);
await one(
  "c-select-shim",
  "Radix Select, item-aligned, with the style-element shim",
  { id: "se1", type: "Select", props: { label: "Size", options: SIZES, styleShim: true } },
  { actions: [click("#se1-trigger"), click("[role=option]:has-text('Medium')")], expectDraft: { se1: "m" } },
);
await write("c-slider", {
  description: "Radix Slider, set",
  board: board("c-slider", "Radix Slider, set", [{ id: "sl1", type: "Slider", props: { label: "Budget", min: 0, max: 100 } }]),
  draft: { values: { sl1: 30 }, ui: {} },
  actions: [{ do: "press", selector: "[role=slider]", key: "ArrowRight" }],
  expectDraft: { sl1: 31 },
});
await one(
  "c-toggle-group",
  "Radix Toggle Group",
  { id: "tg1", type: "ToggleGroup", props: { label: "View", options: options([["split", "Split"], ["unified", "Unified"]]) } },
  { actions: [click("[role=radio]:has-text('Unified')")], expectDraft: { tg1: "unified" } },
);
await one(
  "c-popover",
  "Radix Popover, non-modal",
  { id: "po1", type: "Popover", props: { label: "Why?", text: "The agent asks because two fixes touch the same file." } },
  { actions: [click("[data-item-id=po1] button")], expectDraft: { "ui:po1": true } },
);
await one(
  "c-popover-modal",
  "Radix Popover, modal",
  { id: "po1", type: "Popover", props: { label: "Why?", text: "Modal popover.", modal: true } },
  { actions: [click("[data-item-id=po1] button")], expectDraft: { "ui:po1": true } },
);
await one(
  "c-popover-modal-shim",
  "Radix Popover, modal, with the style-element shim",
  { id: "po1", type: "Popover", props: { label: "Why?", text: "Modal popover.", modal: true, styleShim: true } },
  { actions: [click("[data-item-id=po1] button")], expectDraft: { "ui:po1": true } },
);
await one(
  "c-date-picker",
  "Date Picker on react-day-picker in a Radix Popover",
  { id: "dp1", type: "DatePicker", props: { label: "Due", month: "2026-11-01" } },
  { actions: [click("#dp1-date"), click("button:has-text('12')")], expectDraft: { dp1: "2026-11-12" } },
);
const MARKDOWN = [
  "## Why this question",
  "",
  "Two fixes touch **`retry.ts`**; see [the issue](https://example.org/issue/12).",
  "",
  "- keep the *exponential* backoff",
  "- cap it at 30 s",
  "",
  "| Option | Cost |",
  "| :--- | ---: |",
  "| A | 2 |",
  "| B | 5 |",
  "",
  "```ts",
  "const delay = Math.min(30_000, 2 ** attempt * 100);",
  "```",
  "",
  "<script>alert(1)</script> <img src=x onerror=alert(1)>",
].join("\n");
await one(
  "c-markdown",
  "markdown-it with DOMPurify",
  { id: "md1", type: "Markdown", props: { source: MARKDOWN } },
  { check: { selector: "[data-item-id=md1] table", text: "Cost" } },
);
await one(
  "c-markdown-classes",
  "markdown-it with DOMPurify, table alignment as classes",
  { id: "md1", type: "Markdown", props: { source: MARKDOWN, alignClasses: true } },
  { check: { selector: "[data-item-id=md1] table", text: "Cost" } },
);
const LATEX = "\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}";
await one(
  "c-katex",
  "KaTeX through its DOM API",
  { id: "mx1", type: "Math", props: { source: LATEX } },
  { check: { selector: "[data-item-id=mx1] .katex", text: "π" } },
);
await one(
  "c-katex-string",
  "Negative control: KaTeX renderToString set as markup",
  { id: "mx1", type: "MathString", props: { source: LATEX } },
  { negative: [{ kind: "violation", directives: ["style-src-attr"] }] },
);
await one(
  "c-mathlive",
  "MathLive math-field",
  { id: "ml1", type: "MathField", props: { label: "Formula", initial: "" } },
  { actions: typeKeys("math-field", ["x", "^", "2"]), expectDraft: { ml1: "x^2" } },
);
await one(
  "c-mathlive-sandboxed",
  "MathLive math-field, keyboard policy sandboxed",
  { id: "ml1", type: "MathField", props: { label: "Formula", initial: "", sandboxedKeyboard: true } },
  { actions: typeKeys("math-field", ["x", "^", "2"]), expectDraft: { ml1: "x^2" } },
);
await one(
  "c-mathlive-shim",
  "MathLive math-field, keyboard in the frame and the markup shim",
  { id: "ml1", type: "MathField", props: { label: "Formula", initial: "", sandboxedKeyboard: true, markupShim: true } },
  { actions: typeKeys("math-field", ["x", "^", "2"]), expectDraft: { ml1: "x^2" } },
);
await one(
  "c-table",
  "TanStack Table, sortable table",
  {
    id: "ta1",
    type: "Table",
    props: {
      columns: [
        { key: "name", label: "Name" },
        { key: "owner", label: "Owner" },
      ],
      rows: [
        { name: "retry", owner: "Ada" },
        { name: "cache", owner: "Lin" },
        { name: "auth", owner: "Sam" },
      ],
    },
  },
  { actions: [click("th button:has-text('Name')")], expectDraft: { "ui:ta1": [{ id: "name", desc: false }] } },
);
await one(
  "c-tree",
  "TanStack Table, tree mode",
  {
    id: "tr1",
    type: "Tree",
    props: {
      columns: [{ key: "label", label: "Task" }],
      rows: [
        { id: "1", label: "Build", children: [{ id: "1.1", label: "View" }, { id: "1.2", label: "Widgets" }] },
        { id: "2", label: "Ship" },
      ],
    },
  },
  {
    actions: [click("[data-row-id='1'] button")],
    expectDraft: { "ui:tr1": { "1": true } },
    check: { selector: "[data-item-id=tr1]", text: "Widgets" },
  },
);
await one(
  "c-spreadsheet",
  "TanStack Table, A1 grid",
  { id: "ss1", type: "Spreadsheet", props: { columns: 4, rows: 5 } },
  { actions: [{ do: "fill", selector: "input[data-ref=B2]", value: "42" }], expectDraft: { ss1: { B2: "42" } } },
);
const RANKING = {
  id: "rk1",
  type: "Ranking",
  props: {
    label: "Order the fixes",
    entries: [
      { id: "a", label: "Fix A: cap the backoff" },
      { id: "b", label: "Fix B: jitter" },
      { id: "c", label: "Fix C: circuit breaker" },
    ],
  },
};
await one("c-ranking", "Pragmatic drag and drop, Ranking", RANKING, {
  actions: [{ do: "drag", selector: "[data-drag-id=c]", to: "[data-drag-id=a]" }],
  expectDraft: { rk1: ["c", "a", "b"] },
});
const KANBAN = {
  id: "kb1",
  type: "Kanban",
  props: {
    label: "Triage",
    lanes: [
      { id: "todo", label: "To do", cards: [{ id: "k1", label: "Flaky test" }, { id: "k2", label: "Slow build" }] },
      { id: "doing", label: "Doing", cards: [{ id: "k3", label: "Upgrade Bun" }] },
      { id: "done", label: "Done", cards: [] },
    ],
  },
};
await one("c-kanban", "Pragmatic drag and drop, Kanban", KANBAN, {
  actions: [{ do: "drag", selector: "[data-drag-id=k1]", to: "[data-lane-id=done]" }],
  expectDraft: { kb1: { todo: ["k2"], doing: ["k3"], done: ["k1"] } },
});
await one(
  "c-chart",
  "ECharts bar chart, canvas renderer",
  {
    id: "ch1",
    type: "Chart",
    props: {
      label: "Failures per fix",
      bars: [
        { label: "A", value: 4 },
        { label: "B", value: 9 },
        { label: "C", value: 6 },
      ],
    },
  },
  // The middle bar: the chart is 480 by 208 px (h-64 at the view's 13 px root size).
  { actions: [click("[data-chart=ch1]", { at: { x: 251, y: 120 } })], expectDraft: { ch1: "B" } },
);
await one(
  "c-chart-rich",
  "ECharts bar chart, canvas renderer, tooltip drawn on the canvas",
  {
    id: "ch1",
    type: "Chart",
    props: {
      label: "Failures per fix",
      richTooltip: true,
      bars: [
        { label: "A", value: 4 },
        { label: "B", value: 9 },
        { label: "C", value: 6 },
      ],
    },
  },
  { actions: [click("[data-chart=ch1]", { at: { x: 251, y: 120 } })], expectDraft: { ch1: "B" } },
);
await one(
  "c-graph",
  "xyflow with dagre",
  {
    id: "gr1",
    type: "Graph",
    props: {
      label: "Dependencies",
      nodes: [
        { id: "a", label: "contract" },
        { id: "b", label: "compute" },
        { id: "c", label: "view" },
        { id: "d", label: "widgets" },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
        { from: "b", to: "d" },
        { from: "c", to: "d" },
      ],
    },
  },
  { actions: [click(".react-flow__node[data-id=c]")], expectDraft: { gr1: "c" } },
);
const OLD_FILE = {
  name: "retry.ts",
  contents: [
    "// Retry with a fixed delay.",
    "export function delay(attempt: number): number {",
    '  const base = "fixed";',
    "  return 1000;",
    "}",
    "",
  ].join("\n"),
};
const NEW_FILE = {
  name: "retry.ts",
  contents: [
    "// Retry with exponential backoff, capped.",
    "export function delay(attempt: number): number {",
    '  const base = "exponential";',
    "  return Math.min(30_000, 2 ** attempt * 100);",
    "}",
    "",
  ].join("\n"),
};
const diff = (name: string, description: string, props: Record<string, unknown>) =>
  one(name, description, { id: "df1", type: "DiffReview", props: { oldFile: OLD_FILE, newFile: NEW_FILE, ...props } }, {
    check: { selector: "[data-item-id=df1]", text: "" },
  });
await diff("c-diff", "@pierre/diffs, its default configuration", { config: "default" });
await one(
  "c-app",
  "ext-apps App in the view, AppBridge on the board page",
  { id: "ap1", type: "AppChannel" },
  {
    bridge: true,
    actions: [click("[data-item-id=ap1] button")],
    expectDraft: { "ui:ap1": { connected: true, host: "askboard-board-stand-in", sent: true } },
    expectBridge: ["ui/notifications/initialized", "ui/update-model-context"],
  },
);
await one(
  "c-app-jitless",
  "ext-apps App with zod's jitless set when the chunk loads",
  { id: "ap1", type: "AppChannelJitless" },
  {
    bridge: true,
    actions: [click("[data-item-id=ap1] button")],
    expectDraft: { "ui:ap1": { connected: true, host: "askboard-board-stand-in", sent: true } },
    expectBridge: ["ui/notifications/initialized", "ui/update-model-context"],
  },
);
await one(
  "c-tailwind",
  "The Tailwind stylesheets: token, radius, type scale, arbitrary value and data variant",
  { id: "tw1", type: "Swatches" },
  {
    expectComputed: [
      { selector: "#tw-token", property: "background-color", equals: "rgb(11, 110, 127)" },
      { selector: "#tw-token", property: "color", equals: "rgb(255, 255, 255)" },
      { selector: "#tw-radius", property: "border-top-left-radius", equals: "4px" },
      { selector: "#tw-type", property: "font-size", equals: "20px" },
      { selector: "#tw-type", property: "font-weight", equals: "600" },
      { selector: "#tw-arbitrary", property: "width", equals: "137px" },
      { selector: "#tw-grid", property: "display", equals: "grid" },
      { selector: "#tw-data", property: "font-weight", equals: "600" },
    ],
  },
);

// --- Task 4.2: @pierre/diffs configurations (run `diffs`) --------------------------------------

await diff("c-diff-classes", "@pierre/diffs with useCSSClasses", { config: "css-classes" });
await diff("c-diff-vars", "@pierre/diffs with a CSS-variables theme on the syntax tokens", { config: "css-variables" });
await diff("c-diff-plain", "@pierre/diffs with no highlighting (.txt files)", { config: "plain" });
await diff("c-diff-vars-shim", "@pierre/diffs, CSS-variables theme and the markup shim", { config: "css-variables", shim: true });
await diff("c-diff-shim", "@pierre/diffs, default themes and the markup shim", { config: "default", shim: true });
await diff("c-diff-plain-shim", "@pierre/diffs, no highlighting, and the markup shim", { config: "plain", shim: true });

// --- Task 4.3: S-6, Radix Dialog and Alert Dialog (run `dialog`) -------------------------------

const S6_STEPS = (opener: string): Action[] => [
  click(`[data-open=${opener}]`),
  { do: "wheel", selector: "body", delta: { x: 0, y: 600 } },
  { do: "press", key: "PageDown" },
  { do: "press", key: "Tab" },
  { do: "press", key: "Tab" },
  { do: "press", key: "Tab" },
  { do: "press", key: "Tab" },
  { do: "press", key: "Escape" },
  { do: "wheel", selector: "body", delta: { x: 0, y: 600 } },
];
const spacer = { id: "sp1", type: "Spacer", props: { text: "Long content behind the dialog" } };
const s6 = (name: string, description: string, dialog: Item, extra: Item[] = []) =>
  write(name, {
    description,
    board: board(name, description, [dialog, spacer, ...extra]),
    actions: S6_STEPS(dialog.id),
    expectDraft: { [`ui:${dialog.id}`]: false },
  });
await s6("s6-dialog", "S-6: Radix Dialog, modal", { id: "dl1", type: "Dialog" });
await s6("s6-alert", "S-6: Radix Alert Dialog", { id: "dl1", type: "AlertDialog" });
await s6("s6-nonmodal", "S-6: Radix Dialog, non-modal", { id: "dl1", type: "Dialog", props: { modal: false } });
await s6("s6-dialog-rule", "S-6: Radix Dialog, modal, with the static scroll-lock rule", { id: "dl1", type: "Dialog" }, [
  { id: "lr1", type: "ScrollLockRule" },
]);
await s6("s6-dialog-shim", "S-6: Radix Dialog, modal, with the style-element shim", {
  id: "dl1",
  type: "Dialog",
  props: { styleShim: true },
});
await s6("s6-alert-shim", "S-6: Radix Alert Dialog with the style-element shim", {
  id: "dl1",
  type: "AlertDialog",
  props: { styleShim: true },
});

// --- Task 4.4: S-4, S-7, S-8 on the Form (run `form`) ------------------------------------------

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", title: "Name", pattern: "^[A-Z][a-z]+$" },
    colour: { type: "string", title: "Colour", enum: ["r", "g", "b"] },
    size: { type: "string", title: "Size", enum: ["s", "m", "l"] },
    tags: { type: "array", title: "Tags", uniqueItems: true, items: { type: "string", enum: ["a", "b", "c"] } },
  },
};
const UI_SCHEMA = {
  colour: { "ui:widget": "radio", "ui:enumNames": ["Red", "Green", "Blue"] },
  size: { "ui:widget": "select", "ui:enumNames": ["Small", "Medium", "Large"] },
  tags: { "ui:widget": "checkboxes", items: { "ui:enumNames": ["Alpha", "Beta", "Gamma"] } },
};
const FORM_PROPS = {
  schema: SCHEMA,
  uiSchema: UI_SCHEMA,
  extraErrors: { name: { __errors: ["Use a capitalised name (AskBoard's field check)"] } },
};
const FORM_STEPS: Action[] = [
  { do: "fill", selector: "#root_name", value: "Ada" },
  { do: "press", selector: "#root_name", key: "Enter" },
  click("label[for=root_colour-g]"),
  click("#root_size"),
  click("[role=option]:has-text('Medium')"),
  click("label[for=root_tags-a]"),
  click("label[for=root_tags-c]"),
];
await one("form", "S-4, S-7, S-8: RJSF with tagName div, the no-op validator and extraErrors", { id: "f1", type: "Form", props: FORM_PROPS }, {
  actions: FORM_STEPS,
  expectDraft: { f1: { name: "Ada", colour: "g", size: "m", tags: ["a", "c"] }, "ui:f1": null },
  check: { selector: "[data-item-id=f1]", text: "Use a capitalised name" },
});
await one(
  "form-shim",
  "S-4, S-7, S-8: the Form, with the style-element shim for its Select",
  { id: "f1", type: "Form", props: { ...FORM_PROPS, styleShim: true } },
  {
    actions: FORM_STEPS,
    expectDraft: { f1: { name: "Ada", colour: "g", size: "m", tags: ["a", "c"] }, "ui:f1": null },
    check: { selector: "[data-item-id=f1]", text: "Use a capitalised name" },
  },
);
await one(
  "form-tag",
  "S-7 negative control: RJSF with a <form> tag and its submit button",
  { id: "f1", type: "Form", props: { ...FORM_PROPS, asForm: true } },
  {
    actions: [
      { do: "fill", selector: "#root_name", value: "Ada" },
      { do: "press", selector: "#root_name", key: "Enter" },
      click("button[type=submit]"),
    ],
    negative: [
      { kind: "draft", key: "ui:f1", equals: null },
      // A GET submission from the srcdoc goes to the board page's URL with the fields as its query.
      { kind: "no-request", path: "/b/form-tag?", exact: true },
      { kind: "no-request", path: "/b/form-tag?root" },
      { kind: "alive" },
    ],
  },
);
await one(
  "form-ajv",
  "S-4 negative control: RJSF with @rjsf/validator-ajv8, validating live",
  { id: "f1", type: "FormAjv", props: { schema: SCHEMA, uiSchema: UI_SCHEMA } },
  {
    actions: [{ do: "fill", selector: "#root_name", value: "ada" }],
    negative: [{ kind: "violation", directives: ["script-src"], blocked: "eval" }],
  },
);

// --- Task 4.5: S-8, the safe pattern subset in the view (run `pattern`) -------------------------

await one(
  "pattern",
  "S-8: the accepted patterns evaluated with RegExp in the view",
  {
    id: "pt1",
    type: "PatternProbe",
    props: {
      cases: [
        { pattern: "^[A-Z][a-z]+$", matches: ["Ada"], misses: ["ada", "Ada1"] },
        { pattern: "^\\d{3}-\\d{4}$", matches: ["555-1234"], misses: ["5551234"] },
        { pattern: "^[\\w.+-]+@[\\w-]+\\.[a-z]{2,}$", matches: ["a.b+c@x-y.org"], misses: ["a@b"] },
        { pattern: "^(?:[a-z0-9-]+\\.)?example\\.org$", matches: ["example.org", "api.example.org"], misses: ["example.com"] },
        { pattern: "^(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])$", matches: ["2026-10"], misses: ["2026-13"] },
        { pattern: "^(?:red|green|blue)$", matches: ["green"], misses: ["grey"] },
        { pattern: "^[(+*)\\]]+$", matches: ["(+)]"], misses: ["a"] },
        { pattern: "^[A-Z]{2,5}-[0-9]+$", matches: ["ASKB-12"], misses: ["A-1"] },
      ],
    },
  },
  { check: { selector: "[data-item-id=pt1]", text: "all patterns behave as listed" } },
);

// --- Task 4.6: S-5, the `.dark` switch (run `theme`) -------------------------------------------

await write("theme", {
  description: "S-5: the .dark class switch, with diagrams and the Tailwind swatches",
  board: board("theme", "S-5: the .dark class switch", [
    { id: "tw1", type: "Swatches" },
    {
      id: "m1",
      type: "Mermaid",
      props: { label: "Mermaid diagram", source: "flowchart LR\n  A[Ask] --> B[Answer]", probe: { shim: true } },
    },
    {
      id: "p1",
      type: "PlantUMLSmetana",
      props: { label: "PlantUML diagram", source: "@startuml\nAgent -> Board : ask\nBoard --> Agent : answer\n@enduml", probe: { shim: true } },
    },
  ]),
  actions: [{ do: "command", command: "theme", args: { dark: true }, ms: 2500 }],
  expectDiagrams: ["m1", "p1"],
  expectThemes: { m1: "dark", p1: "dark" },
  expectComputed: [
    { selector: "html", property: "background-color", equals: "rgb(27, 25, 22)" },
    { selector: "#tw-token", property: "background-color", equals: "rgb(95, 180, 194)" },
    { selector: "#tw-dark", property: "color", equals: "rgb(95, 180, 194)" },
  ],
});

// --- Task 4.8: UX spike items (run `drag-slider`) ----------------------------------------------

await one("ux-ranking", "UX spike: native drag in the Ranking, two moves", RANKING, {
  actions: [
    { do: "drag", selector: "[data-drag-id=c]", to: "[data-drag-id=a]" },
    { do: "drag", selector: "[data-drag-id=a]", to: "[data-drag-id=b]" },
  ],
  expectDraft: { rk1: ["c", "b", "a"] },
});
await one("ux-kanban", "UX spike: native drag in the Kanban, across lanes and onto a card", KANBAN, {
  actions: [
    { do: "drag", selector: "[data-drag-id=k1]", to: "[data-lane-id=done]" },
    { do: "drag", selector: "[data-drag-id=k3]", to: "[data-drag-id=k2]" },
  ],
  expectDraft: { kb1: { todo: ["k3", "k2"], doing: [], done: ["k1"] } },
});
await one(
  "ux-slider-unset",
  "UX spike: a click on an unset Slider's track",
  { id: "sl1", type: "Slider", props: { label: "Budget", min: 0, max: 100 } },
  { actions: [click("[data-item-id=sl1] [data-orientation=horizontal] > span", { at: { x: 192, y: 2 } })] },
);

// The same click on a set Slider's track, to show the click reaches the track: 192 of 256 px.
await write("ux-slider-set", {
  description: "UX spike: the same click on a set Slider's track",
  board: board("ux-slider-set", "UX spike: a click on a set Slider's track", [
    { id: "sl1", type: "Slider", props: { label: "Budget", min: 0, max: 100 } },
  ]),
  draft: { values: { sl1: 30 }, ui: {} },
  actions: [click("[data-item-id=sl1] [data-orientation=horizontal] > span", { at: { x: 192, y: 2 } })],
});

console.log(`wrote ${written.length} fixtures: ${written.join(", ")}`);
