import { afterAll, describe, expect, test } from "bun:test";
import {
  type ActCommand,
  BOARD_PROTOCOL_VERSION,
  DRAFT_RECORD_MAX_CHARS,
  type DraftRecord,
} from "@askboard/contract";
import { validateBoardMessage } from "@askboard/contract/validate";
import { MESSAGE_MAX_BYTES } from "../../src/board-host/boards.ts";
import { createBoardHost } from "../../src/board-host/index.ts";
import { type FakeHostCore, fakeHostCore, plainView } from "./fake-core.ts";
import { freeRange, openSocket, removeViews, writeView } from "./helpers.ts";

// Board-host spec, Draft mirror and Board protocol over a WebSocket (document-review, task 3.1,
// review U-1): two Document reviews of one question, each filled to every bound with 100
// annotations (`exact` 2,000, `prefix` and `suffix` 200, `text` 2,000 and `replacement` 4,000 code
// points), are over what the board accepts. With emoji throughout, the draft record that mirrors
// them is 3,384,911 characters of JSON against the 2,000,000 a draft takes and 6.7 million UTF-8
// bytes against `MESSAGE_MAX_BYTES` (6,004,096), and the act that sends them is 6,744,897 bytes:
// board-host ends the socket (1009) before it reads either. With the replacements in euro signs
// (three bytes, one unit) the draft passes the byte limit and is refused by the draft limit, the
// socket staying open. One filled review is 1,692,490 characters of draft and is held. Each
// over-size message is refused whole: nothing is held, logged or published (NFR-10).

const version = BOARD_PROTOCOL_VERSION;
const EMOJI = "\u{1F600}";
const QUESTION = plainView.questions[0]?.itemId as string;
const ITEMS = ["review-a", "review-b"].map((id) => ({
  type: "document-review",
  id,
  props: { markdown: "a".repeat(10_000) },
}));

// The plain-choice ask with its question holding both Document reviews, as the board shows it.
const boardWithReviews = (): FakeHostCore["view"] => {
  const document = structuredClone(plainView.document) as unknown as {
    items: { props: Record<string, unknown> }[];
  };
  const [question] = document.items;
  if (question === undefined) throw new Error("no question");
  question.props = { ...question.props, items: ITEMS };
  return { ...plainView, document } as unknown as FakeHostCore["view"];
};
const token = "tR3mB8vKq2NxD6wYe1aJcZ";

afterAll(removeViews);

const filled = () => ({
  annotations: Array.from({ length: 100 }, (_, at) => ({
    id: `u-${at + 1}`,
    target: {
      selector: {
        type: "quote",
        exact: EMOJI.repeat(2_000),
        prefix: EMOJI.repeat(200),
        suffix: EMOJI.repeat(200),
      },
    },
    body: { text: EMOJI.repeat(2_000), replacement: EMOJI.repeat(4_000) },
  })),
});

const reviews = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, filled()]));

const draftOf = (...ids: string[]): DraftRecord => ({
  delivery: "immediate",
  inView: QUESTION,
  questions: { [QUESTION]: { rev: 1, results: reviews(...ids) } },
});

const started = async (fake: FakeHostCore) => {
  const host = createBoardHost({
    core: () => fake.core,
    view: writeView(),
    report: () => undefined,
    ports: await freeRange(1),
    token: () => token,
  });
  const link = new URL(await host.address.link(plainView.askId));
  const socket = await openSocket(Number(link.port), plainView.askId);
  socket.send({ version, type: "connect", token });
  await socket.next();
  await socket.next();
  return { host, socket };
};

const held = (fake: FakeHostCore, kind: "holdDraft" | "act") =>
  fake.calls.filter(([call]) => call === kind);

describe("two Document reviews filled to every bound", () => {
  test("one filled review's draft is within the draft limit and is held", async () => {
    const fake = fakeHostCore({ view: boardWithReviews() });
    const { host, socket } = await started(fake);
    try {
      const record = draftOf("review-a");
      expect(JSON.stringify(record).length).toBeLessThanOrEqual(DRAFT_RECORD_MAX_CHARS);
      socket.send({ version, type: "draft", record });
      await Bun.sleep(300);
      expect(held(fake, "holdDraft")).toHaveLength(1);
      expect(fake.draft).toEqual(record);
    } finally {
      await host.close();
    }
  });

  test("two filled reviews' draft in emoji is over the message limit: the socket closes and nothing is held", async () => {
    const fake = fakeHostCore({ view: boardWithReviews() });
    const { host, socket } = await started(fake);
    try {
      const record = draftOf("review-a", "review-b");
      const message = JSON.stringify({ version, type: "draft", record });
      expect(JSON.stringify(record).length).toBeGreaterThan(DRAFT_RECORD_MAX_CHARS);
      expect(Buffer.byteLength(message)).toBeGreaterThan(MESSAGE_MAX_BYTES);
      socket.send({ version, type: "draft", record });
      expect(await socket.closed()).toBe(1009);
      expect(held(fake, "holdDraft")).toHaveLength(0);
      expect(fake.draft).toBeUndefined();
    } finally {
      await host.close();
    }
  });

  test("a draft over the draft limit but within the message limit is refused whole, the socket staying open", async () => {
    const fake = fakeHostCore({ view: boardWithReviews() });
    const { host, socket } = await started(fake);
    try {
      const mixed = () => {
        const { annotations } = filled();
        return {
          annotations: annotations.map((one) => ({
            ...one,
            body: { ...one.body, replacement: "\u20AC".repeat(4_000) },
          })),
        };
      };
      const record: DraftRecord = {
        delivery: "immediate",
        inView: QUESTION,
        questions: {
          [QUESTION]: { rev: 1, results: { "review-a": mixed(), "review-b": mixed() } },
        },
      };
      const message = JSON.stringify({ version, type: "draft", record });
      expect(JSON.stringify(record).length).toBeGreaterThan(DRAFT_RECORD_MAX_CHARS);
      expect(Buffer.byteLength(message)).toBeLessThanOrEqual(MESSAGE_MAX_BYTES);
      socket.send({ version, type: "draft", record });
      const refused = await socket.next();
      expect(refused).toMatchObject({ type: "refused", reason: "message" });
      expect((refused as { detail: string }).detail).toContain("the draft record takes");
      expect(validateBoardMessage("toPage", refused).ok).toBe(true);
      expect(held(fake, "holdDraft")).toHaveLength(0);
      expect(fake.draft).toBeUndefined();
      socket.send({ version, type: "draft", record: draftOf() });
      await Bun.sleep(100);
      expect(held(fake, "holdDraft")).toHaveLength(1);
    } finally {
      await host.close();
    }
  });

  test("the act that sends two filled reviews is over the message limit: the socket closes, nothing reaches the core", async () => {
    const fake = fakeHostCore({ view: boardWithReviews() });
    const { host, socket } = await started(fake);
    try {
      const command = {
        version,
        type: "act",
        actionId: "tR3mB8vKq2NxD6wYe1aJcZ",
        acts: [
          {
            type: "answer",
            itemId: QUESTION,
            rev: 1,
            when: "2026-11-08T09:30:00Z",
            results: reviews("review-a", "review-b"),
          },
        ],
      } as unknown as ActCommand;
      expect(Buffer.byteLength(JSON.stringify(command))).toBeGreaterThan(MESSAGE_MAX_BYTES);
      socket.send(command);
      expect(await socket.closed()).toBe(1009);
      expect(held(fake, "act")).toHaveLength(0);
    } finally {
      await host.close();
    }
  });
});
