import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ERROR_TEXT_MAX_CHARS } from "@askboard/contract";
import type { MoleculeSource } from "@askboard/core";
import { createMoleculeSource } from "../src/molecule-source/index.ts";
import { plainChoiceAsk } from "./board-host/helpers.ts";
import { composedSessions } from "./composed-session.ts";

// Board-host spec: The session's molecule source (widget-answers task 3.1), with the real units: the
// shipped definitions, read from the imported JSON, looked up at the first ask that holds a
// reference and never before (AD-2).

const uj2 = (await Bun.file(
  join(import.meta.dir, "../../contract/test/fixtures/asks/uj2-wbs-gantt.json"),
).json()) as {
  askId: string;
  items: { props: { items?: { id: string; props: { data: Record<string, unknown> } }[] } }[];
};

const { recorder, start, remove } = composedSessions();
afterAll(remove);

// The shipped source, recording each molecule looked up.
const spied = () => {
  const looked: string[] = [];
  const inner = createMoleculeSource();
  const source: MoleculeSource = {
    lookup: (molecule, version) => {
      looked.push(molecule);
      return inner.lookup(molecule, version);
    },
  };
  return { source, looked };
};

const textOf = (result: { content?: unknown }): string =>
  ((result.content as { text: string }[])[0] ?? { text: "" }).text;

describe("molecules in the composed session process", () => {
  test("nothing is looked up before the first ask, and the UJ-2 ask finds both molecules", async () => {
    const { script } = recorder("browser-widgets");
    const { source, looked } = spied();
    const run = await start(
      { BROWSER: script },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      source,
    );
    await run.client.listTools();
    await run.call("ask", plainChoiceAsk());
    expect(looked).toEqual([]);
    const asked = await run.call("ask", structuredClone(uj2));
    expect(asked.board).toStartWith("http://127.0.0.1:");
    expect(
      asked.warnings?.some((warning: { code: string }) => warning.code === "formula"),
    ).not.toBe(true);
    expect([...new Set(looked)].sort()).toEqual(["gantt-plan", "wbs-pert"]);
    await run.client.close();
    await run.session.ended;
  });

  test("data outside a molecule's parameters is an error naming the reference and the field", async () => {
    const { script } = recorder("browser-widgets-bad");
    const run = await start({ BROWSER: script });
    const request = structuredClone(uj2);
    const schedule = request.items[0]?.props.items?.[1];
    if (schedule !== undefined) schedule.props.data.start = "11/02/2026";
    const result = await run.callRaw("ask", request);
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain("schedule");
    expect(text).toContain("data.start");
    expect(text.length).toBeLessThan(ERROR_TEXT_MAX_CHARS);
    await run.client.close();
    await run.session.ended;
  });
});
