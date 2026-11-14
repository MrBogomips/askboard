import { describe, expect, test } from "bun:test";
import { TREE_SHAPE } from "@askboard/contract";
import { plainChoiceBoardDocument, treeBoardDocument } from "@askboard/contract/fixtures";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { componentFacts, LanguageContext, LocaleContext, register } from "../catalog/port.ts";
import type { ViewQuestion } from "../view-document.ts";
import { AgentChange, ChangeNotice, ReopenedNotice } from "./change-notice.tsx";

// View-and-widgets: Reopened question (reopen-start-from-answer, design decision 5): the notice
// says in one line whether the board started the question from the previous answer, and keeps its
// button either way. The browser scenarios of task 3.1 cover it on the real board.

const previous = {
  choice: ["SQLite"],
  when: "2026-11-08T10:00:00Z",
  receipt: "delivered",
} as const;

const inLanguage = (element: ReturnType<typeof createElement>, language: "en-US" | "it-IT") =>
  renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: language },
      createElement(LocaleContext.Provider, { value: language }, element),
    ),
  );

const render = (carried: boolean, language: "en-US" | "it-IT" = "en-US") =>
  inLanguage(
    createElement(ReopenedNotice, { previous, disabled: false, carried, onStart: () => {} }),
    language,
  );

// The markup's text, its entities read back.
const textOf = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "|")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");

describe("the reopened notice's line", () => {
  test("carried: the line for a question started from the previous answer, and the button", () => {
    const text = textOf(render(true));
    expect(text).toContain("Your previous answer is filled in. Change it or answer again.");
    expect(text).not.toContain("starts from the agent's version");
    expect(render(true)).toContain("Start from my previous answer");
  });

  test("not carried: the line for a question that starts from the agent's version, and the button", () => {
    const text = textOf(render(false));
    expect(text).toContain(
      "This question starts from the agent's version, not from your previous answer.",
    );
    expect(text).not.toContain("is filled in");
    expect(render(false)).toContain("Start from my previous answer</button>");
  });

  test("in Italian", () => {
    expect(textOf(render(true, "it-IT"))).toContain("La tua risposta precedente è già inserita.");
    expect(textOf(render(false, "it-IT"))).toContain(
      "Questa domanda riparte dalla versione dell'agente",
    );
    expect(render(false, "it-IT")).toContain("Parti dalla mia risposta precedente</button>");
  });

  test("the title and the previous answer still show beside the line", () => {
    const text = textOf(render(true));
    expect(text).toContain("Reopened by the agent");
    expect(text).toContain("SQLite");
  });
});

// The rest of the file's notices, which the card shows beside it: the agent-change notice and the
// read-only view of the agent's revision (EXPERIENCE: Agent-change notice).
describe("the agent-change notice and the revision it shows", () => {
  const [base] = plainChoiceBoardDocument.items as unknown as readonly [ViewQuestion];
  const [first, second] = base.props.options ?? [];
  const earlier: ViewQuestion = base;
  const changed: ViewQuestion = {
    ...base,
    rev: 2,
    props: {
      ...base.props,
      text: "Which database now?",
      header: "Store",
      options: [
        ...(first === undefined
          ? []
          : [{ ...first, description: "Managed by the platform team." }]),
        { label: "Redis", recommended: true },
      ],
    },
  };
  const notice = (busy: boolean) =>
    inLanguage(
      createElement(ChangeNotice, {
        question: changed,
        earlier,
        stake: "Your 2 changes on this question",
        busy,
        onReload: () => {},
        onKeep: () => {},
      }),
      "en-US",
    );

  test("the notice names what is at stake and offers the three choices, the change hidden", () => {
    const html = notice(false);
    expect(html).toContain('data-askboard-notice="agent-change"');
    expect(html).toContain("Your 2 changes on this question");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Which database now?");
    expect(html).not.toContain('disabled=""');
  });

  test("a choice on its way disables Reload and Keep", () => {
    expect(notice(true).match(/disabled=""/g)).toHaveLength(2);
  });

  test("the revision is marked against the earlier one: struck text, added, removed and changed options", () => {
    const html = inLanguage(createElement(AgentChange, { question: changed, earlier }), "en-US");
    expect(html).toContain("<del");
    expect(html).toContain("Which database now?");
    expect(html).toContain('data-askboard-change="added"');
    expect(html).toContain('data-askboard-change="removed"');
    expect(html).toContain("Managed by the platform team.");
    if (second !== undefined) expect(html).toContain(second.label);
  });

  test("with no earlier revision known, the new one shows unmarked", () => {
    const html = inLanguage(
      createElement(AgentChange, { question: changed, earlier: undefined }),
      "en-US",
    );
    expect(html).toContain("Which database now?");
    expect(html).not.toContain("<del");
  });

  test("a widget the agent changed is named with its type and its operations", () => {
    if (componentFacts("tree") === undefined) {
      register("tree", () => null, { shape: () => TREE_SHAPE, name: "change.widgetTree" });
    }
    const [plan] = treeBoardDocument.items as unknown as readonly [ViewQuestion];
    const [wbs] = plan.props.items as unknown as readonly [
      { props: { nodes: { label: string }[] } },
    ];
    const renamed = {
      ...wbs,
      props: {
        ...wbs.props,
        nodes: wbs.props.nodes.map((node) => ({ ...node, label: "Renamed" })),
      },
    };
    const after = {
      ...plan,
      props: { ...plan.props, items: [renamed] },
    } as unknown as ViewQuestion;
    const html = inLanguage(
      createElement(AgentChange, { question: after, earlier: plan }),
      "en-US",
    );
    expect(html).toContain('data-askboard-change="widget"');
    expect(html).toContain(`data-askboard-widget="${(wbs as unknown as { id: string }).id}"`);
  });

  test("the notice's change opens and shuts on its button (the expanded view is the card's)", () => {
    const html = notice(false);
    expect(html).toContain('aria-controls="database:agent-change"');
  });
});

describe("the previous answer in the reopened notice", () => {
  test("the options, the Other text, the notes on options and the open prompt's note, as text", () => {
    const html = inLanguage(
      createElement(ReopenedNotice, {
        previous: {
          choice: ["SQLite"],
          other: "Mollie",
          optionNotes: { SQLite: "Fast." },
          note: "Before the freeze.",
          when: "2026-11-08T10:00:00Z",
          receipt: "delivered",
        },
        disabled: true,
        carried: true,
        onStart: () => {},
      }),
      "en-US",
    );
    const text = textOf(html);
    expect(text).toContain("SQLite");
    expect(text).toContain("Mollie");
    expect(text).toContain("SQLite: Fast.");
    expect(text).toContain("Before the freeze.");
    expect(html).toContain('disabled=""');
  });
});
