import { describe, expect, test } from "bun:test";
import { ownerRefusalText } from "../../src/mcp-tools/owner-refusal.ts";

// The refusal of a call on an owned ask that is not its owner's (core spec, "Only the owner acts on
// an owned ask", "Re-sending comes from the owner"; AD-5): one text per refusal and tool, naming
// the ask and what the agent can do, for `ask`, `collect` and the tools that later check owners.

const ASK_ID = "order-db-choice-x7k2";

describe("the owner refusal text", () => {
  test("for collect: another agent's ask is left out; a call with no record is sent again", () => {
    expect(ownerRefusalText("other-owner", ASK_ID, "collect")).toBe(
      `the ask "${ASK_ID}" belongs to another agent: leave it out`,
    );
    expect(ownerRefusalText("no-record", ASK_ID, "collect")).toBe(
      `the ask "${ASK_ID}" belongs to an agent, and this call carried no agent record, so AskBoard cannot tell that it is yours: send the collect again`,
    );
  });

  test("for ask: another agent's ID needs a new one; a call with no record is sent again", () => {
    expect(ownerRefusalText("other-owner", ASK_ID, "ask")).toBe(
      `The ask ID "${ASK_ID}" is in use in this session by another agent's ask, which sending this request again cannot get: choose a new ID for your ask and send it with that ID.`,
    );
    expect(ownerRefusalText("no-record", ASK_ID, "ask")).toBe(
      `The ask "${ASK_ID}" belongs to an agent, and this call carried no agent record, so AskBoard cannot tell that it is yours. Send the identical request again.`,
    );
  });

  test("for update and fetch: the whole call is refused; a call with no record is sent again", () => {
    expect(ownerRefusalText("other-owner", ASK_ID, "update")).toBe(
      `The ask "${ASK_ID}" belongs to another agent, so this update was refused: send update only for asks you sent.`,
    );
    expect(ownerRefusalText("no-record", ASK_ID, "fetch")).toBe(
      `The ask "${ASK_ID}" belongs to an agent, and this call carried no agent record, so AskBoard cannot tell that it is yours. Send the fetch again.`,
    );
  });

  test("for snapshot (E7): the whole call is refused, as for update and fetch", () => {
    expect(ownerRefusalText("other-owner", ASK_ID, "snapshot")).toBe(
      `The ask "${ASK_ID}" belongs to another agent, so this snapshot was refused: send snapshot only for asks you sent.`,
    );
    expect(ownerRefusalText("no-record", ASK_ID, "snapshot")).toBe(
      `The ask "${ASK_ID}" belongs to an agent, and this call carried no agent record, so AskBoard cannot tell that it is yours. Send the snapshot again.`,
    );
  });

  test("for another tool: the same as collect's, naming that tool", () => {
    expect(ownerRefusalText("other-owner", ASK_ID, "draw")).toBe(
      ownerRefusalText("other-owner", ASK_ID, "collect"),
    );
    expect(ownerRefusalText("no-record", ASK_ID, "draw")).toEndWith(": send the draw again");
  });
});
