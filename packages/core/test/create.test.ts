import { describe, expect, test } from "bun:test";
import { EPOCH_PATTERN, TITLE_MAX_CHARS } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { validateBoardDocument } from "@askboard/contract/validate";
import { AskCore, BoardSetupError, deriveTitle } from "../src/index.ts";
import { askWith, coreWith, EN_US, fakePorts, plainChoiceAsk } from "./fakes.ts";

// Core spec: Epoch, Creating an ask, Derived title (task 4.1).

describe("the epoch", () => {
  test("is random per session process, from the Randomness port", () => {
    const first = new AskCore(fakePorts({ bytes: [1, 2, 3, 4, 5, 6, 7, 8] }).ports);
    const second = new AskCore(fakePorts({ bytes: [9, 10, 11, 12, 13, 14, 15, 16] }).ports);
    expect(first.epoch).toMatch(new RegExp(EPOCH_PATTERN));
    expect(second.epoch).toMatch(new RegExp(EPOCH_PATTERN));
    expect(first.epoch).not.toBe(second.epoch);
    expect(first.epoch).toBe("12345678");
  });

  test("draws without bias: bytes that would favour some characters are drawn again", () => {
    const { ports, calls } = fakePorts({ bytes: [255, 252, 35, 36, 71, 0, 1, 2, 3, 4, 5, 6] });
    const core = new AskCore(ports);
    expect(core.epoch).toBe("z0z01234");
    expect(calls.filter((call) => call.startsWith("bytes")).length).toBeGreaterThan(1);
  });
});

describe("creating an ask", () => {
  test("a plain ask is waiting, its question at rev 1, its first cursor <epoch>.0", async () => {
    const { core, opened } = coreWith();
    const outcome = await core.ask(plainChoiceAsk());
    expect(outcome).toEqual({
      kind: "created",
      ask: {
        askId: "order-db-choice-x7k2",
        state: "waiting",
        cursor: `${core.epoch}.0`,
        board: "http://127.0.0.1:47213/b/order-db-choice-x7k2?t=pV3xK9qLmT2wR7nB4cYh8A",
      },
    });
    const board = core.board("order-db-choice-x7k2");
    // settings-languages: ask-core names the ask's language and locale on every board document.
    expect(board?.document).toEqual({ ...plainChoiceBoardDocument, ...EN_US });
    expect(validateBoardDocument(board?.document).ok).toBe(true);
    expect(board?.state).toBe("waiting");
    expect(board?.questions).toEqual([{ itemId: "database", rev: 1 }]);
    expect(opened).toEqual([
      board ? "http://127.0.0.1:47213/b/order-db-choice-x7k2?t=pV3xK9qLmT2wR7nB4cYh8A" : "",
    ]);
  });

  test("validates, checks that a board can be shown, makes the link, then opens the board", async () => {
    const { core, calls } = coreWith({ git: "Paola Greco" });
    await core.ask(plainChoiceAsk());
    expect(calls.filter((call) => !call.startsWith("bytes"))).toEqual([
      "check",
      "git",
      "link order-db-choice-x7k2",
      "open",
    ]);
  });

  test("when no board can be shown, the result is unavailable and nothing is created", async () => {
    const showing = {
      showable: false,
      reason: "remote-host",
      detail: "SSH_CONNECTION is set",
    } as const;
    const { core, calls, heard } = coreWith({ showing });
    expect(await core.ask(plainChoiceAsk())).toEqual({
      kind: "unavailable",
      askId: "order-db-choice-x7k2",
      reason: "remote-host",
      detail: "SSH_CONNECTION is set",
    });
    expect(calls.filter((call) => !call.startsWith("bytes"))).toEqual(["check"]);
    expect(core.board("order-db-choice-x7k2")).toBeUndefined();
    expect(heard).toEqual([]);
  });

  test("an invalid request is refused with the contract's problems, and nothing is created", async () => {
    const { core, calls } = coreWith();
    const outcome = await core.ask({ askId: "order db", items: [] });
    expect(outcome.kind).toBe("invalid");
    expect(outcome.kind === "invalid" ? outcome.problems.map((p) => p.path) : []).toEqual([
      "/askId",
      "/items",
    ]);
    expect(calls.filter((call) => !call.startsWith("bytes"))).toEqual([]);
  });

  test("a link that cannot be made fails the ask, and nothing is created", async () => {
    const { core, opened } = coreWith({ linkFails: true });
    await expect(core.ask(plainChoiceAsk())).rejects.toThrow("no free port");
    expect(core.board("order-db-choice-x7k2")).toBeUndefined();
    expect(opened).toEqual([]);
  });

  test("a link that fails for the board's setup rejects with that failure, creating nothing", async () => {
    const fakes = fakePorts();
    const setup = new BoardSetupError("VIEW_MANIFEST_UNREADABLE", "cannot read manifest.json");
    const core = new AskCore({
      ...fakes.ports,
      address: {
        link: async () => {
          throw setup;
        },
      },
    });
    const failed = await core.ask(plainChoiceAsk()).catch((error: unknown) => error);
    expect(failed).toBe(setup);
    expect(failed).toBeInstanceOf(Error);
    expect(setup).toMatchObject({ name: "BoardSetupError", code: "VIEW_MANIFEST_UNREADABLE" });
    expect(core.board("order-db-choice-x7k2")).toBeUndefined();
    expect(fakes.opened).toEqual([]);
  });

  test("an opener that throws is reported, and the ask stands", async () => {
    const fakes = fakePorts();
    const failure = new Error("spawn failed");
    const core = new AskCore({
      ...fakes.ports,
      showing: {
        ...fakes.ports.showing,
        open: () => {
          throw failure;
        },
      },
    });
    expect((await core.ask(plainChoiceAsk())).kind).toBe("created");
    expect(fakes.reported).toEqual([failure]);
  });

  test("the board document is frozen and does not share the request's objects", async () => {
    const { core } = coreWith();
    const request = plainChoiceAsk();
    await core.ask(request);
    (request.items[0].props.options as { label: string }[])[0] = { label: "Changed" };
    const document = core.board(request.askId)?.document;
    expect(document?.items[0].props.options?.[0]?.label).toBe("PostgreSQL");
    expect(Object.isFrozen(document)).toBe(true);
    expect(Object.isFrozen(document?.items[0].props.options)).toBe(true);
  });
});

describe("the derived title", () => {
  test("an ask without a title takes its question's text", async () => {
    const { core } = coreWith();
    await core.ask(plainChoiceAsk());
    expect(core.board("order-db-choice-x7k2")?.document.title).toBe(
      "Which database should the order service use?",
    );
  });

  test("an agent's title is kept", async () => {
    const { core } = coreWith();
    await core.ask(askWith({ title: "Order service database" }));
    expect(core.board("order-db-choice-x7k2")?.document.title).toBe("Order service database");
  });

  test("a text longer than the title length is cut to it, ending in an ellipsis", () => {
    const text = `Which ${"very ".repeat(30)}long question?`;
    const title = deriveTitle(text);
    expect([...title].length).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    expect(title.endsWith("…")).toBe(true);
    expect(text.startsWith(title.slice(0, -1))).toBe(true);
    expect(title.at(-2)).not.toBe(" ");
  });

  test("a text of exactly the title length is kept whole, and characters are never split", () => {
    expect(deriveTitle("x".repeat(TITLE_MAX_CHARS))).toBe("x".repeat(TITLE_MAX_CHARS));
    const emoji = "😀".repeat(TITLE_MAX_CHARS + 1);
    expect(deriveTitle(emoji)).toBe(`${"😀".repeat(TITLE_MAX_CHARS - 1)}…`);
  });
});
