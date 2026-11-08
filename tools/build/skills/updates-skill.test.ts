// The updates reference (agent-facing-gaps, task 3.1; skills spec: The reference for changing an
// ask, Adding an item to a question taught): one line for each action of the input format's update
// schema, read from it, and the prose on adding to a question.

import { describe, expect, test } from "bun:test";
import { taggedBlocks } from "./blocks.ts";
import { contractSchemaResolver, type Schema } from "./fields.ts";
import { generateSkill } from "./generate.ts";
import { ACTION_GLOSSES, actionLines } from "./updates.ts";

const UPDATE_ID = "urn:askboard:input:update";
const schemaOf = (): Schema => {
  const found = contractSchemaResolver()(UPDATE_ID);
  if (found === undefined) throw new Error("no update schema");
  return found;
};

// The shipped update schema with one more action, `archive`, taking an `itemId`.
const withArchive = (): Schema => {
  const base = structuredClone(schemaOf()) as {
    $defs: Record<string, { oneOf?: unknown[] } & Record<string, unknown>>;
  };
  base.$defs.archive = {
    type: "object",
    properties: {
      action: { const: "archive" },
      itemId: { type: "string" },
      why: { type: "string" },
    },
    required: ["action", "itemId"],
    additionalProperties: false,
  };
  base.$defs.action?.oneOf?.push({ $ref: "#/$defs/archive" });
  return base as unknown as Schema;
};

const { files, examples } = generateSkill();
const updates = files.get("references/updates.md") ?? "";
const skill = files.get("SKILL.md") ?? "";
const lineOf = (text: string, action: string): string =>
  text.split("\n").find((line) => line.startsWith(`- \`${action}\``)) ?? "";

describe("the updates reference's action lines", () => {
  test("one line for each action of the update schema, in the schema's order", () => {
    const lines = actionLines(schemaOf());
    const order = ["add", "change", "delete", "reopen", "answer", "reply", "close"];
    expect(lines.map((line) => /^- `(\w+)`/.exec(line)?.[1])).toEqual(order);
    let at = -1;
    for (const action of order) {
      const found = updates.indexOf(`- \`${action}\``);
      expect(found, action).toBeGreaterThan(at);
      at = found;
    }
  });

  test("the reply line names itemId, followUp and text as required, and says what itemId and followUp are", () => {
    const reply = lineOf(updates, "reply");
    expect(reply).toContain("required: `itemId`, `followUp`, `text`");
    expect(reply).toContain("`itemId` is the question the follow-up event names");
    expect(reply).toContain("`followUp` that event's cursor");
  });

  test("the add line says what is optional", () => {
    expect(lineOf(updates, "add")).toContain("required: `item`");
    expect(lineOf(updates, "add")).toContain("optional: `parentId`, `after`");
  });

  test("an action with no fields beyond its name says so", () => {
    expect(lineOf(updates, "close")).toContain("no fields");
  });

  test("a schema with one more action adds one line and leaves the others unchanged", () => {
    const glosses = { ...ACTION_GLOSSES, archive: "Shelves an item." };
    const before = actionLines(schemaOf());
    const after = actionLines(withArchive(), glosses);
    expect(after).toEqual([
      ...before,
      "- `archive` (required: `itemId`; optional: `why`): Shelves an item.",
    ]);
  });

  test("the same through the generator: one more line, the rest of the file unchanged", () => {
    const glosses = { ...ACTION_GLOSSES, archive: "Shelves an item." };
    const made = generateSkill({ updateSchema: withArchive(), actionGlosses: glosses });
    const text = made.files.get("references/updates.md") ?? "";
    const extra = "- `archive` (required: `itemId`; optional: `why`): Shelves an item.\n";
    expect(text.replace(extra, "")).toBe(updates);
    expect(text).toContain(extra);
  });

  test("an action without a gloss fails, naming it", () => {
    expect(() => actionLines(withArchive())).toThrow(/archive/);
    expect(() => generateSkill({ updateSchema: withArchive() })).toThrow(/archive/);
  });

  test("an action whose schema has no action constant fails, naming it", () => {
    const broken = structuredClone(withArchive()) as unknown as {
      $defs: { archive: { properties: { action: unknown } } };
    };
    broken.$defs.archive.properties.action = { type: "string" };
    expect(() => actionLines(broken as unknown as Schema, ACTION_GLOSSES)).toThrow(/archive/);
  });
});

describe("the updates reference's prose", () => {
  test("says that add refuses a widget and takes a question or an area", () => {
    expect(updates).toContain("`add` takes a question");
    expect(updates).toContain("by `parentId`");
    expect(updates).toContain("an area at the top level");
    expect(updates).toContain("never a widget, atom, layout or context item");
  });

  test("gives the change of the question's items that adds one, sent whole, keeping the others", () => {
    expect(updates).toContain("`change` the question's `items`");
    expect(updates).toContain("replaces each key you send whole");
    expect(updates).toContain("every item you keep");
  });

  test("says that an item left out of the items a change sends is removed", () => {
    expect(updates).toContain("an item you leave out is removed from the question");
  });

  test("says a question with an answer is reopened first, and an item's props change by its own ID", () => {
    expect(updates).toContain("reopen");
    expect(updates).toContain("A question that has an answer is reopened first");
    expect(updates).toContain("by its own ID");
  });

  test("holds an ask, a change of its items and a reply as tagged blocks, in that order", () => {
    const blocks = taggedBlocks(updates);
    expect(blocks.map(({ kind }) => kind)).toEqual(["ask", "update", "update"]);
    expect(examples.filter(({ file }) => file === "references/updates.md")).toHaveLength(3);
  });

  test("the change example keeps the question's item and adds one", () => {
    type Item = { id: string };
    const [ask, change] = taggedBlocks(updates);
    const asked = ask?.value as { items: { props: { items: Item[] } }[] };
    const changed = change?.value as { actions: { props: { items: Item[] } }[] };
    const kept = asked.items[0]?.props.items ?? [];
    const sent = changed.actions[0]?.props.items ?? [];
    expect(sent.length).toBe(kept.length + 1);
    for (const item of kept) expect(sent.map(({ id }) => id)).toContain(item.id);
  });

  test("stays far below the reference budget", () => {
    expect(updates.length).toBeLessThan(3000);
  });
});

describe("SKILL.md's link", () => {
  test("After you ask links the updates reference in one line", () => {
    const start = skill.indexOf("## After you ask");
    const after = skill.slice(start, skill.indexOf("\n## ", start + 1));
    expect(after).toContain("[updates](references/updates.md)");
    expect(skill.match(/references\/updates\.md/g)).toHaveLength(1);
  });

  test("the reply line names the question and the follow-up's cursor", () => {
    expect(skill).toContain("`update` (`reply`");
    expect(skill).toContain("`itemId`");
  });
});
