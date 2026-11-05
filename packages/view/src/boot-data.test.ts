import { describe, expect, test } from "bun:test";
import {
  BOARD_PROTOCOL_VERSION,
  type BoardState,
  type HostMessage,
  SNAPSHOT_DATA_ELEMENT,
} from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { bootDataOf, EMPTY_MODEL, type PassedOn, withHostMessage } from "./board-page/model.ts";
import { BOOT_DATA_ID, type BootData, type BootField, parseBootData } from "./boot-data.ts";
import { readViewUpdate, type ViewUpdate } from "./view-protocol.ts";

const data: BootData = {
  document: plainChoiceBoardDocument,
  state: { ask: "waiting", questions: [{ itemId: "database", rev: 1, state: "open" }] },
};

describe("the askboard-data block the view boots from (AD-9)", () => {
  test("has the id the view looks for, the contract's Snapshot data element (snapshot task 1.4)", () => {
    expect(BOOT_DATA_ID).toBe("askboard-data");
    expect(BOOT_DATA_ID).toBe(SNAPSHOT_DATA_ELEMENT);
  });

  test("holds the board document and the state", () => {
    expect(parseBootData(JSON.stringify(data))).toEqual(data);
  });

  test("may hold a question with widget items, as the view document allows (design decision 7)", () => {
    const [question] = plainChoiceBoardDocument.items;
    const { options: _, ...props } = question.props;
    const widgets: BootData = {
      ...data,
      document: {
        ...plainChoiceBoardDocument,
        items: [
          { ...question, props: { ...props, items: [{ type: "probe", id: "sketch", props: {} }] } },
        ],
      },
    };
    expect(parseBootData(JSON.stringify(widgets))).toEqual(widgets);
  });

  test("a missing or empty block fails", () => {
    expect(() => parseBootData(null)).toThrow("askboard-data");
    expect(() => parseBootData("")).toThrow("askboard-data");
  });

  test("a block without a board document and a state fails", () => {
    expect(() => parseBootData("[]")).toThrow("board document");
    expect(() => parseBootData(JSON.stringify({ document: data.document }))).toThrow("state");
  });
});

describe("who asked and where, and the agent status, in the block (task 8.4)", () => {
  test("are kept when the board page had them", () => {
    const full: BootData = {
      ...data,
      origin: { who: { label: "Main agent" }, project: "order-service", directory: "." },
      agent: "waiting",
    };
    expect(parseBootData(JSON.stringify(full))).toEqual(full);
  });

  test("are left out when the view cannot show them", () => {
    const wrong = { ...data, origin: { who: {} }, agent: "idle" };
    expect(parseBootData(JSON.stringify(wrong))).toEqual(data);
  });
});

describe("the fields the view boots from, as the table of update fields marks them (review M4)", () => {
  // A value the view can show of each field it boots from: a change that marks a field `atBoot` in
  // `UPDATE_FIELDS` adds its value here, which the type requires.
  const AT_BOOT: { readonly [K in BootField]: NonNullable<ViewUpdate[K]> } = {
    origin: { who: { label: "Main agent" }, project: "order-service", directory: "." },
    agent: "waiting",
  };
  const version = BOARD_PROTOCOL_VERSION;
  const board: HostMessage = { version, type: "board", document: plainChoiceBoardDocument };
  const state: HostMessage = { version, type: "state", state: data.state as BoardState };
  const known = withHostMessage(withHostMessage(EMPTY_MODEL, board), state);

  test("each goes from the board page's model into the block, and reads back from it and from an update", () => {
    const boot = bootDataOf({ ...known, passedOn: AT_BOOT });
    expect(boot).toEqual({ ...data, ...AT_BOOT });
    expect(parseBootData(JSON.stringify(boot))).toEqual({ ...data, ...AT_BOOT });
    const update = { type: "state", state: data.state, ...AT_BOOT } as const;
    expect(readViewUpdate(update)).toEqual(update);
  });

  test("a field the board page passes on that the view does not boot from stays out of the block", () => {
    // A test-only field, as a later change's that goes in the updates only.
    const passedOn = { ...AT_BOOT, later: "x" } as PassedOn;
    expect(bootDataOf({ ...known, passedOn })).toEqual({ ...data, ...AT_BOOT });
  });

  test("the block's other fields pass through, unchecked", () => {
    const extra = { ...data, later: { at: 1 } };
    expect(parseBootData(JSON.stringify(extra))).toEqual(extra);
  });
});

describe("a Snapshot's record in the block (snapshot task 8.1)", () => {
  test("is kept when it names when and by whom", () => {
    const agent = {
      ...data,
      snapshot: { takenAt: "2026-10-31T14:30:00Z", takenBy: "agent" },
    } as const;
    expect(parseBootData(JSON.stringify(agent))).toEqual(agent);
    const user = {
      ...data,
      snapshot: { takenAt: "2026-10-31T14:30:00Z", takenBy: "user", who: "Sara Conti" },
    } as const;
    expect(parseBootData(JSON.stringify(user))).toEqual(user);
  });

  test("a malformed record fails the boot", () => {
    for (const snapshot of [{ takenBy: "agent" }, { takenAt: "x", takenBy: "user" }, "now"]) {
      expect(() => parseBootData(JSON.stringify({ ...data, snapshot }))).toThrow(/snapshot record/);
    }
  });
});
