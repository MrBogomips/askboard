// The amendments to the approved texts (agent-facing-gaps, task 1.2; contract spec: Amendments to
// the approved texts, The approved examples stay as archived; design decision 4): the archived
// `review-model-contract` texts with the record applied are the texts the contract serves.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  APPROVED_TEXT_AMENDMENTS,
  type ApprovedTextAmendment,
  amendedApprovedText,
} from "../src/fixtures/index.ts";
import { SERVER_INSTRUCTIONS, TOOL_DEFINITIONS } from "../src/index.ts";

const ARCHIVE = join(
  import.meta.dir,
  "../../../openspec/changes/archive/2026-10-29-review-model-contract/examples",
);
const archived = (name: string) => Bun.file(join(ARCHIVE, name));
const archivedTools = (await archived("tools.json").json()) as {
  tools: { name: string; description: string }[];
};
const archivedInstructions = (await archived("server-instructions.md").text()).trimEnd();

const entry = (over: Partial<ApprovedTextAmendment> = {}): ApprovedTextAmendment => ({
  change: "some-change",
  approved: "2026-01-01",
  target: "server-instructions.md",
  from: "keep working",
  to: "keep going",
  ...over,
});

const archivedText = (target: string): string | undefined =>
  target === "server-instructions.md"
    ? archivedInstructions
    : archivedTools.tools.find(({ name }) => `tools.json#${name}.description` === target)
        ?.description;

// The entries that do nothing: each target's entries apply one after another, and each must change
// the text the step before it left, as an unused `tools/licence-exceptions.json` entry fails.
const inertEntries = (
  record: readonly ApprovedTextAmendment[],
  textOf: (target: string) => string | undefined,
): string[] =>
  record.flatMap((amendment, at) => {
    const text = textOf(amendment.target);
    if (text === undefined)
      return [`${amendment.change}: ${amendment.target} names no archived text`];
    const before = amendedApprovedText(amendment.target, text, record.slice(0, at));
    const after = amendedApprovedText(amendment.target, text, record.slice(0, at + 1));
    return after === before ? [`${amendment.change}: ${amendment.target} changes nothing`] : [];
  });

describe("the served texts follow the record", () => {
  test("the archived instructions with the record applied are SERVER_INSTRUCTIONS", () => {
    expect(amendedApprovedText("server-instructions.md", archivedInstructions)).toBe(
      SERVER_INSTRUCTIONS,
    );
  });

  test("the archived tool descriptions with the record applied are TOOL_DEFINITIONS'", () => {
    const amended = archivedTools.tools.map((tool) => ({
      ...tool,
      description: amendedApprovedText(`tools.json#${tool.name}.description`, tool.description),
    }));
    expect(TOOL_DEFINITIONS.map(({ name, description }) => ({ name, description }))).toEqual(
      amended.map(({ name, description }) => ({ name, description })),
    );
  });

  test("the record is not empty, and each entry names its change, a date and a change of text", () => {
    expect(APPROVED_TEXT_AMENDMENTS.length).toBeGreaterThan(0);
    for (const amendment of APPROVED_TEXT_AMENDMENTS) {
      expect(amendment.change).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(amendment.approved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(amendment.to).not.toBe(amendment.from);
    }
  });

  test("each entry's target is the instructions or the description of a tool in the archive", () => {
    const targets = new Set([
      "server-instructions.md",
      ...archivedTools.tools.map(({ name }) => `tools.json#${name}.description`),
    ]);
    for (const { change, target } of APPROVED_TEXT_AMENDMENTS) {
      expect(targets.has(target), `${change}: ${target}`).toBe(true);
    }
  });

  test("each entry changes the text of the step before it, none is left with nothing to do", () => {
    expect(inertEntries(APPROVED_TEXT_AMENDMENTS, archivedText)).toEqual([]);
  });

  test("a chain of two entries on one target is accepted: the second reads the first's wording", () => {
    const record = [
      entry({ from: "keep working", to: "keep going" }),
      entry({ change: "later-change", from: "keep going", to: "carry on" }),
    ];
    expect(inertEntries(record, () => "then keep working")).toEqual([]);
  });

  test("a no-op entry in a chain is still refused, naming it", () => {
    const record = [
      entry({ from: "keep working", to: "keep going" }),
      entry({ change: "later-change", from: "keep going", to: "keep going" }),
    ];
    expect(inertEntries(record, () => "then keep working")).toEqual([
      expect.stringContaining("later-change"),
    ]);
  });

  test("an entry whose target names no archived text is refused, naming it", () => {
    const record = [entry({ target: "tools.json#fetsh.description" })];
    expect(inertEntries(record, () => undefined)).toEqual([
      expect.stringContaining("tools.json#fetsh.description"),
    ]);
  });

  test("a target no amendment names comes back as it was", () => {
    expect(
      amendedApprovedText("tools.json#fetch.description", "as approved", [
        entry({ target: "tools.json#update.description" }),
      ]),
    ).toBe("as approved");
  });

  test("the amendments of a target apply in order, the second reading the first's text", () => {
    const first = entry({ from: "keep working", to: "keep going" });
    const second = entry({ from: "keep going", to: "carry on" });
    expect(
      amendedApprovedText("server-instructions.md", "then keep working", [first, second]),
    ).toBe("then carry on");
    expect(() =>
      amendedApprovedText("server-instructions.md", "then keep working", [second, first]),
    ).toThrow(/some-change.*server-instructions\.md/);
  });
});

describe("an amendment that no longer applies", () => {
  test("a replaced text found zero times throws, naming the change and the target", () => {
    expect(() => amendedApprovedText("server-instructions.md", "nothing here", [entry()])).toThrow(
      /some-change.*server-instructions\.md|server-instructions\.md.*some-change/,
    );
  });

  test("a replaced text found twice throws, naming the change and the target", () => {
    expect(() =>
      amendedApprovedText("server-instructions.md", "keep working, keep working", [entry()]),
    ).toThrow(/some-change.*server-instructions\.md|server-instructions\.md.*some-change/);
  });

  test("an amendment of another target is not applied to this one", () => {
    const other = entry({ target: "tools.json#update.description" });
    expect(amendedApprovedText("server-instructions.md", "nothing here", [other])).toBe(
      "nothing here",
    );
  });
});

describe("the approved wording", () => {
  const update = TOOL_DEFINITIONS.find(({ name }) => name === "update");

  test("the update description names itemId and followUp", () => {
    expect(update?.description).toContain("`itemId`");
    expect(update?.description).toContain("`followUp`");
  });

  test("the update description says to change a question's items to add a widget", () => {
    expect(update?.description).toContain("change the question's `items`");
  });

  test("the instructions' follow-up line names itemId", () => {
    const line = SERVER_INSTRUCTIONS.split("\n").find((text) => text.includes("follow-ups"));
    expect(line).toContain("`itemId`");
    expect(line).toContain("`reply`");
  });
});

describe("the approved examples stay as archived", () => {
  test("the fixture copies of tools.json and server-instructions.md equal the archive", async () => {
    for (const name of ["tools.json", "server-instructions.md"]) {
      const copy = await Bun.file(join(import.meta.dir, "fixtures", name)).text();
      expect(copy).toBe(await archived(name).text());
    }
  });
});
