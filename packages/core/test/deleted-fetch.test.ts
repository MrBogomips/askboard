import { describe, expect, test } from "bun:test";
import { AskCore } from "../src/index.ts";
import { fakePorts } from "./fakes.ts";

// Core spec: Fetching an item (layouts review S-2): `fetch` of an item of a deleted question answers
// `deleted`, at every depth of its layouts, where it answered `missing` before layouts.

type Request = Parameters<AskCore["ask"]>[0];
type Update = Parameters<AskCore["update"]>[0];

const ASK_ID = "deleted-fetch";

const request = {
  askId: ASK_ID,
  items: [
    {
      type: "question",
      id: "plan",
      props: {
        text: "Plan?",
        items: [
          {
            type: "group",
            id: "estimate",
            props: {
              title: "Estimate",
              items: [{ type: "text-field", id: "t1", props: { label: "Note" } }],
            },
          },
          { type: "number-field", id: "days", props: { label: "Days", min: 0, max: 9 } },
        ],
      },
    },
    {
      type: "question",
      id: "other",
      props: { text: "Other?", items: [{ type: "toggle", id: "ok", props: { label: "Ok" } }] },
    },
  ],
} as unknown as Request;

describe("fetch of an item of a deleted question", () => {
  test("answers deleted for a nested item and a top-level one", async () => {
    const core = new AskCore(fakePorts().ports);
    const created = await core.ask(request);
    expect(JSON.stringify(created)).toContain("created");
    expect(core.fullValue(ASK_ID, "t1").kind).not.toBe("deleted");
    const outcome = await core.update({
      askId: ASK_ID,
      actions: [{ action: "delete", itemId: "plan" }],
    } as unknown as Update);
    expect(outcome.kind).toBe("updated");
    for (const itemId of ["t1", "estimate", "days"]) {
      expect(core.fullValue(ASK_ID, itemId)).toEqual({ kind: "deleted", askId: ASK_ID, itemId });
    }
  });
});
