import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { SCHEMA_IDS, WIDGET_TYPES } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import { AskCore } from "@askboard/core";
import { createMoleculeSource } from "../src/molecule-source/index.ts";
import { LINK, runtimeClock } from "./mcp-tools/helpers.ts";

// Skills spec, Examples that validate (askboard-skills task 3.1, design decision 5): every tagged
// example block of the shipped skill is read from the committed files by path and checked by the
// real units: `json ask` and `json item` through AskCore.ask with the shipped molecule source,
// `json result` against the tool envelopes.

const SKILL = join(import.meta.dir, "../../../skills/askboard");

type Block = { kind: "ask" | "item" | "result"; value: unknown; where: string };

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  );

const BLOCK = /^```json (ask|item|result)\n([\s\S]*?)\n```$/gm;

const blocksOf = async (): Promise<Block[]> => {
  const found: Block[] = [];
  for (const path of filesUnder(SKILL)
    .filter((file) => file.endsWith(".md"))
    .sort()) {
    const text = await Bun.file(path).text();
    let index = 0;
    for (const match of text.matchAll(BLOCK)) {
      index += 1;
      found.push({
        kind: match[1] as Block["kind"],
        value: JSON.parse(match[2] ?? ""),
        where: `${relative(SKILL, path)} block ${index} (json ${match[1]})`,
      });
    }
  }
  return found;
};

const blocks = await blocksOf();

// An item example is asked inside a question of its own; an ask example as written.
const requestOf = (block: Block): unknown =>
  block.kind === "ask"
    ? block.value
    : {
        askId: "example-ask-q4m8",
        items: [
          {
            type: "question",
            id: "example",
            props: { text: "An example question.", items: [block.value] },
          },
        ],
      };

const core = () =>
  new AskCore({
    randomness: { bytes: (count) => crypto.getRandomValues(new Uint8Array(count)) },
    showing: { check: async () => ({ showable: true }), open: () => undefined },
    address: { link: async () => LINK },
    identity: { gitUserName: async () => "Paola Greco", loginName: async () => "paola" },
    report: () => undefined,
    clock: runtimeClock,
    molecules: createMoleculeSource(),
  });

// The failure text of an example: the file and the block, then what AskCore said.
const refusal = async (block: Block): Promise<string | undefined> => {
  const outcome = await core().ask(requestOf(block));
  if (outcome.kind === "invalid") {
    return `${block.where}: ${JSON.stringify(outcome.problems)}`;
  }
  if (outcome.kind !== "created") return `${block.where}: ${outcome.kind}`;
  const other = (outcome.warnings ?? []).filter(({ code }) => code !== "unresolved-pointer");
  return other.length === 0 ? undefined : `${block.where}: ${JSON.stringify(other)}`;
};

const typesIn = (value: unknown, found: Set<string>): Set<string> => {
  if (Array.isArray(value)) for (const entry of value) typesIn(entry, found);
  else if (typeof value === "object" && value !== null) {
    const { type, props } = value as { type?: unknown; props?: Record<string, unknown> };
    if (typeof type === "string") found.add(type);
    if (props?.molecule !== undefined) found.add(`molecule:${String(props.molecule)}`);
    for (const inner of Object.values(value)) typesIn(inner, found);
  }
  return found;
};

const asked = blocks.filter(({ kind }) => kind !== "result");
const results = blocks.filter(({ kind }) => kind === "result");

describe("the shipped skill's examples", () => {
  test("the skill carries example blocks of every kind", () => {
    expect(asked.length).toBeGreaterThan(0);
    expect(results.length).toBeGreaterThan(0);
  });

  test.each(asked.map((block) => [block.where, block] as const))(
    "%s is accepted by AskCore with only unresolved-pointer warnings",
    async (_, block) => {
      expect(await refusal(block)).toBeUndefined();
    },
  );

  test.each(results.map((block) => [block.where, block] as const))(
    "%s passes the collect result's schema",
    (_, block) => {
      expect(validateAgainst(SCHEMA_IDS.collectResult, block.value).ok).toBe(true);
    },
  );

  test("an ask-result-shaped block is refused by the collect result's schema", () => {
    const [source] = results;
    expect(source).toBeDefined();
    if (source === undefined) return;
    const askShaped = { ...(source.value as Record<string, unknown>) };
    delete askShaped.asks;
    askShaped.askId = "checkout-plan-p8r3";
    askShaped.state = "open";
    expect(validateAgainst(SCHEMA_IDS.collectResult, askShaped).ok).toBe(false);
  });

  test("a copy of a widget example with an unknown prop is refused, naming the file and the block", async () => {
    const widgetTypes = WIDGET_TYPES.map(({ type }) => type);
    const source = asked.find(
      ({ kind, value }) =>
        kind === "item" && widgetTypes.includes((value as { type: string }).type),
    );
    expect(source).toBeDefined();
    if (source === undefined) return;
    const copy = structuredClone(source);
    (copy.value as { props: Record<string, unknown> }).props.unknownProp = 1;
    const text = await refusal(copy);
    expect(text).toContain(copy.where);
    expect(text).toContain("unknownProp");
  });

  test("a block is found for every registered widget type and every ready molecule", () => {
    const found = new Set<string>();
    for (const block of asked) typesIn(block.value, found);
    for (const { type } of WIDGET_TYPES) expect([...found]).toContain(type);
    // The ready molecules are the names the shipped source lists for one it does not know.
    const unknown = createMoleculeSource().lookup("no-such-molecule");
    const ready = unknown.found ? [] : unknown.shipped;
    expect(ready.length).toBeGreaterThan(0);
    for (const molecule of ready) expect([...found]).toContain(`molecule:${molecule}`);
  });
});
