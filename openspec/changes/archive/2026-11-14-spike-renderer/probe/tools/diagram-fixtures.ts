// Writes the diagram fixtures of task group 3 into fixtures/: the JSON files are the record, and
// this script says how they were made.
//
// Usage, from probe/: bun tools/diagram-fixtures.ts

import { join } from "node:path";

const dir = join(import.meta.dir, "..", "fixtures");
const write = (name: string, fixture: object) => Bun.write(`${dir}/${name}.json`, `${JSON.stringify(fixture, null, 2)}\n`);

const GOLDEN = [
  "@startuml",
  "actor Customer",
  'participant "Web app" as Web',
  'participant "Checkout API" as API',
  'participant "Order service" as Orders',
  'participant "Payment gateway" as Gateway',
  "Customer -> Web : Place order",
  "Web -> API : POST /checkout",
  "API -> Orders : create order",
  "API -> Gateway : authorize payment",
  "Gateway --> API : authorized",
  "API --> Web : order confirmed",
  "@enduml",
].join("\n");
const GOLDEN_FIXED = GOLDEN.replace(
  "API -> Orders : create order\nAPI -> Gateway : authorize payment\nGateway --> API : authorized",
  "API -> Gateway : authorize payment\nGateway --> API : authorized\nAPI -> Orders : create order",
);

const MERMAID: Record<string, string> = {
  flowchart: [
    "flowchart LR",
    "  A[Agent asks] --> B{Board open?}",
    "  B -->|yes| C[Show question]",
    "  B -->|no| D[Open board]",
    "  D --> C",
    "  C --> E((Answer))",
  ].join("\n"),
  sequence: [
    "sequenceDiagram",
    "  participant Agent",
    "  participant Board",
    "  participant User",
    "  Agent->>Board: ask(question)",
    "  Board->>User: show question",
    "  User-->>Board: answer",
    "  Board-->>Agent: answer delivered",
    "  Note over Board,User: draft record holds edits",
  ].join("\n"),
  class: [
    "classDiagram",
    "  class Ask {",
    "    +String id",
    "    +send()",
    "  }",
    "  class Answer {",
    "    +String value",
    "  }",
    '  Ask "1" --> "*" Answer : receives',
    "  Ask <|-- FollowUp",
  ].join("\n"),
  state: [
    "stateDiagram-v2",
    "  [*] --> Open",
    "  Open --> Answered : answer",
    "  Open --> Discarded : discard",
    "  Answered --> [*]",
    "  Discarded --> [*]",
  ].join("\n"),
};

const PLANTUML: Record<string, string> = {
  sequence: GOLDEN,
  class: [
    "@startuml",
    "class Ask {",
    "  +id: String",
    "  +send()",
    "}",
    "class Answer {",
    "  +value: String",
    "}",
    "class FollowUp",
    'Ask "1" --> "*" Answer : receives',
    "Ask <|-- FollowUp",
    "@enduml",
  ].join("\n"),
  activity: [
    "@startuml",
    "start",
    ":Agent sends the ask;",
    "if (Board open?) then (yes)",
    "  :Show the question;",
    "else (no)",
    "  :Open the board;",
    "endif",
    ":User answers;",
    "stop",
    "@enduml",
  ].join("\n"),
  component: [
    "@startuml",
    "[Board page] as Board",
    "[View] as View",
    "[Session process] as Session",
    "Board --> View : srcdoc",
    "Board --> Session : board protocol",
    "@enduml",
  ].join("\n"),
  state: [
    "@startuml",
    "[*] --> Open",
    "Open --> Answered : answer",
    "Open --> Discarded : discard",
    "Answered --> [*]",
    "Discarded --> [*]",
    "@enduml",
  ].join("\n"),
};

const diagram = (id: string, type: string, source: string, props: object = {}) => ({
  id,
  type,
  props: { label: `${type} diagram`, source, ...props },
});
const one = (description: string, item: object, extra: object = {}) => ({
  description,
  board: { id: (item as { id: string }).id, title: description, items: [item] },
  check: { selector: `[data-item-id=${(item as { id: string }).id}] figure`, text: "" },
  expectDiagrams: [(item as { id: string }).id],
  ...extra,
});

// Task 3.1: the Mermaid fixtures, and what `layout: elk` does with elkjs replaced.
for (const [kind, source] of Object.entries(MERMAID)) {
  await write(`mermaid-${kind}`, one(`Mermaid ${kind} diagram (task 3.1)`, diagram("m1", "Mermaid", source)));
  await write(
    `mermaid-${kind}-shim`,
    one(`Mermaid ${kind} diagram with the style shim (criterion 1)`, diagram("m1", "Mermaid", source, { probe: { shim: true } })),
  );
}
const ELK_FRONT = `---\nconfig:\n  layout: elk\n---\n${MERMAID.flowchart}`;
await write(
  "mermaid-elk-secure",
  one("Front matter asks for layout: elk; `layout` is in `secure` (task 3.1)", diagram("m1", "Mermaid", ELK_FRONT)),
);
await write(
  "mermaid-elk-open",
  one(
    "Front matter asks for layout: elk, with Mermaid's default `secure` list (task 3.1)",
    diagram("m1", "Mermaid", ELK_FRONT, { probe: { secure: false } }),
  ),
);

// Task 3.2: the PlantUML fixtures, with Graphviz (viz-global.js) and without (Smetana).
for (const [kind, source] of Object.entries(PLANTUML)) {
  await write(`plantuml-${kind}`, one(`PlantUML ${kind} diagram, with viz-global.js (task 3.2)`, diagram("p1", "PlantUML", source)));
  await write(
    `plantuml-smetana-${kind}`,
    one(`PlantUML ${kind} diagram, without viz-global.js (task 3.2)`, diagram("p1", "PlantUMLSmetana", source)),
  );
  await write(
    `plantuml-${kind}-shim`,
    one(`PlantUML ${kind} diagram, with viz-global.js and the style shim (criterion 1)`, diagram("p1", "PlantUML", source, { probe: { shim: true } })),
  );
  await write(
    `plantuml-smetana-${kind}-shim`,
    one(`PlantUML ${kind} diagram, without viz-global.js, with the style shim (criterion 1)`, diagram("p1", "PlantUMLSmetana", source, { probe: { shim: true } })),
  );
}
const RESOURCES = [
  "@startuml",
  "!theme cerulean",
  "!include <C4/C4_Context>",
  "Alice -> Bob : <:1f600:> hello <&heart>",
  "@enduml",
].join("\n");
await write(
  "plantuml-resources",
  one("A theme, a stdlib include, an emoji and an icon, with AskBoard's refusing loader (task 3.3)", diagram("p1", "PlantUML", RESOURCES)),
);
await write(
  "plantuml-resources-default",
  one(
    "The same source with the engine's own script-tag loader (task 3.3)",
    diagram("p1", "PlantUML", RESOURCES, { probe: { loader: "default" } }),
  ),
);

// Task 3.4: the welcome and error images, and the golden source, as PlantUML returns them.
const ERR = { expectDiagrams: [], expectDiagramErrors: ["p1"] };
await write("sponsor-empty", one("An empty source (task 3.4)", diagram("p1", "PlantUML", "", { probe: { raw: true, shim: true } }), ERR));
await write(
  "sponsor-empty-diagram",
  one("An empty diagram, @startuml and @enduml only (task 3.4)", diagram("p1", "PlantUML", "@startuml\n@enduml", { probe: { raw: true, shim: true } }), ERR),
);
await write(
  "sponsor-error",
  one(
    "A source with a syntax error (task 3.4)",
    diagram("p1", "PlantUML", "@startuml\nAlice -> : missing target\nthis is not plantuml\n@enduml", { probe: { raw: true, shim: true } }),
    ERR,
  ),
);
await write("sponsor-golden", one("The golden source, unthemed (task 3.4)", diagram("p1", "PlantUML", GOLDEN, { probe: { raw: true, shim: true } })));
await write(
  "sponsor-crash",
  one(
    "A class diagram whose Graphviz cannot start under the written CSP: PlantUML's crash image (task 3.4)",
    diagram("p1", "PlantUML", PLANTUML.class as string, { probe: { raw: true, shim: true } }),
    ERR,
  ),
);

// Task 3.5: label-heavy Mermaid diagrams, one item per measurement mitigation.
const LABELS = {
  flow: [
    "flowchart TD",
    "  A[Customer places an order with several items] --> B{Payment authorized by the gateway?}",
    "  B -->|yes, within the time limit| C[Create the order and reserve the stock]",
    "  B -->|no, or the gateway timed out| D[Show the payment error and keep the basket]",
    "  C --> E[Send the order confirmation email to the customer]",
    "  D --> F[Customer retries with another payment method]",
    "  F --> B",
  ].join("\n"),
  sequence: [
    "sequenceDiagram",
    "  participant Customer as Customer on the web app",
    "  participant API as Checkout API service",
    "  participant Gateway as Payment gateway provider",
    "  Customer->>API: POST /checkout with the basket and the address",
    "  API->>Gateway: authorize the payment for the full amount",
    "  Gateway-->>API: authorized, with a transaction reference",
    "  API-->>Customer: order confirmed, with the order number",
    "  Note over API,Gateway: the order is created only after the authorization",
  ].join("\n"),
};
const MEASURES = ["none", "shell-rule", "cssom", "config", "shim"];
for (const [kind, source] of Object.entries(LABELS)) {
  const items = MEASURES.map((measure, index) =>
    diagram(`m${index + 1}`, "Mermaid", source, {
      measure: measure === "shim" ? "none" : measure,
      label: `Mermaid ${kind}, measure ${measure}`,
      ...(measure === "shim" ? { probe: { shim: true } } : {}),
    }),
  );
  await write(`measure-${kind}`, {
    description: `Label-heavy Mermaid ${kind}, one item per measurement mitigation (task 3.5)`,
    board: { id: `measure-${kind}`, title: `Mermaid ${kind} labels`, items: [{ id: "s1", type: "Stack", children: items }] },
    check: { selector: "[data-item-id=m5] figure", text: "" },
    expectDiagrams: items.map((item) => item.id),
  });
}

// Task 3.6: the hit regions drawn, on the golden PlantUML diagram and the Mermaid fixtures.
// The anchors each source calls for: every participant (head and foot) and message of the golden
// diagram, every node and edge of the Mermaid fixtures. Keys follow the anchor rule: the source ID
// where the renderer keeps one, else the label and its occurrence.
const keys = (kind: string, ids: string[], by = "id", occurrences = [1]) =>
  ids.flatMap((id) => occurrences.map((n) => `${kind}:${by}:${id}#${n}`));
const GOLDEN_ANCHORS = [
  ...keys("participant", ["Customer", "Web", "API", "Orders", "Gateway"], "id", [1, 2]),
  ...keys("message", ["Place order", "POST /checkout", "create order", "authorize payment", "authorized", "order confirmed"], "label"),
];
const MERMAID_ANCHORS: Record<string, string[]> = {
  flowchart: [
    ...keys("node", ["A", "B", "C", "D", "E"]),
    ...keys("edge", ["L_A_B_0", "L_B_C_0", "L_B_D_0", "L_D_C_0", "L_C_E_0"]),
  ],
  sequence: [
    ...keys("participant", ["Agent", "Board", "User"], "id", [1, 2]),
    ...keys("message", ["ask(question)", "show question", "answer", "answer delivered"], "label"),
    ...keys("note", ["draft record holds edits"], "label"),
  ],
  class: [...keys("node", ["Ask", "Answer", "FollowUp"]), ...keys("edge", ["id_Ask_Answer_1", "id_Ask_FollowUp_2"])],
  state: [
    ...keys("node", ["root_start", "Open", "Answered", "Discarded", "root_end"]),
    ...keys("edge", ["edge0", "edge1", "edge2", "edge3", "edge4"]),
  ],
};
await write("anchors-plantuml", {
  ...one(
    "The golden diagram with its hit regions drawn, with the style shim (task 3.6)",
    diagram("p1", "PlantUML", GOLDEN, { showHits: true, probe: { shim: true } }),
  ),
  expectAnchors: { p1: GOLDEN_ANCHORS },
});
const mermaidItems = Object.entries(MERMAID).map(([kind, source], index) =>
  diagram(`m${index + 1}`, "Mermaid", source, { showHits: true, label: `Mermaid ${kind}`, probe: { shim: true } }),
);
await write("anchors-mermaid", {
  description: "The four Mermaid fixtures with their hit regions drawn, with the style shim (task 3.6)",
  board: { id: "anchors-mermaid", title: "Mermaid anchors", items: [{ id: "s1", type: "Stack", children: mermaidItems }] },
  check: { selector: "[data-item-id=m4] figure", text: "" },
  expectDiagrams: mermaidItems.map((item) => item.id),
  expectAnchors: Object.fromEntries(Object.keys(MERMAID).map((kind, index) => [`m${index + 1}`, MERMAID_ANCHORS[kind]])),
});

// Task 3.7 and the golden case (EXPERIENCE.md, Key Flows): one question with the diagram and the
// excerpt side by side, the two options and the open prompt. `golden` uses the PlantUML chunk with
// Graphviz, `golden-smetana` the one without, and `golden-text` puts a Text in the diagram's place,
// the baseline for the PlantUML share of the time to visible. All three use the style shim.
const goldenBoard = (type: string, diagramItem: object) => ({
  description: `The golden single-question case (EXPERIENCE.md, Key Flows), the diagram's item a ${type}`,
  board: {
    id: "golden",
    title: "Is the checkout flow correct as drawn?",
    items: [
      {
        id: "q1",
        type: "Group",
        props: { title: "Is the checkout flow correct as drawn?" },
        children: [
          {
            id: "r1",
            type: "Row",
            props: { widths: [3, 2] },
            children: [
              diagramItem,
              {
                id: "x1",
                type: "Text",
                props: {
                  text: "Checkout spec · Order creation (docs/specs/checkout.md · §3.2 · lines 40–52): an order is created only after the payment gateway authorizes the payment.",
                },
              },
            ],
          },
          {
            id: "c1",
            type: "Choice",
            props: {
              label: "Is the checkout flow correct as drawn?",
              options: [
                { value: "correct", label: "Correct" },
                { value: "changes", label: "Needs changes" },
              ],
            },
          },
          { id: "n1", type: "TextField", props: { label: "Note for the agent (optional)" } },
        ],
      },
    ],
  },
  ...(type === "Text"
    ? { check: { selector: "[data-item-id=x1]", text: "Checkout spec" } }
    : {
        check: { selector: "[data-item-id=p1] figure", text: "" },
        expectDiagrams: ["p1"],
        rerender: { item: "p1", source: GOLDEN_FIXED },
      }),
});
const goldenDiagram = (type: string) =>
  type === "Text"
    ? { id: "p1", type: "Text", props: { text: "(the diagram's place)" } }
    : diagram("p1", type, GOLDEN, { label: "Checkout flow", probe: { shim: true } });
for (const [name, type] of [["golden", "PlantUML"], ["golden-smetana", "PlantUMLSmetana"], ["golden-text", "Text"]] as const) {
  await write(name, goldenBoard(type, goldenDiagram(type)));
}
console.log("fixtures written");
