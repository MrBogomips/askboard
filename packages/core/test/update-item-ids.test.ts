import { describe, expect, test } from "bun:test";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";

const field = (id: string) => ({ type: "text-field", id, props: { label: id } });
const question = (id: string, child: string) => ({
  type: "question",
  id,
  props: { text: id, items: [field(child)] },
});
const setup = async () => {
  const core = new AskCore(fakePorts().ports);
  expect(
    (await core.ask({ askId: "ids", items: [question("q1", "first"), question("q2", "second")] }))
      .kind,
  ).toBe("created");
  return core;
};

describe("item IDs stay unique through updates", () => {
  test.each([
    { action: "add", item: question("q3", "first") },
    { action: "add", item: question("first", "third") },
    { action: "change", itemId: "q2", props: { items: [field("first")] } },
    { action: "change", itemId: "q2", props: { items: [field("q1")] } },
  ])("refuses a collision with the existing board: %j", async (action) => {
    const core = await setup();
    const before = core.lifecycleBoard("ids");
    const result = await core.update({ askId: "ids", actions: [action] });
    expect(result).toMatchObject({ kind: "refused", index: 0, refusal: "in-use" });
    expect(core.lifecycleBoard("ids")).toEqual(before);
  });

  test("a widget keeps its ID when its own question changes", async () => {
    const core = await setup();
    expect(
      await core.update({
        askId: "ids",
        actions: [
          {
            action: "change",
            itemId: "q1",
            props: { items: [{ ...field("first"), props: { label: "New label" } }] },
          },
        ],
      }),
    ).toMatchObject({ kind: "updated" });
  });

  test("a collision between actions refuses the whole update", async () => {
    const core = await setup();
    const before = core.lifecycleBoard("ids");
    expect(
      await core.update({
        askId: "ids",
        actions: [
          { action: "add", item: question("q3", "third") },
          { action: "add", item: question("q4", "third") },
        ],
      }),
    ).toMatchObject({ kind: "refused", index: 1, refusal: "in-use" });
    expect(core.lifecycleBoard("ids")).toEqual(before);
  });

  test("an item removed with its question cannot be reused", async () => {
    const core = await setup();
    await core.update({ askId: "ids", actions: [{ action: "delete", itemId: "q1" }] });
    expect(
      await core.update({
        askId: "ids",
        actions: [{ action: "add", item: question("q3", "first") }],
      }),
    ).toMatchObject({ kind: "refused", refusal: "in-use" });
  });
});
