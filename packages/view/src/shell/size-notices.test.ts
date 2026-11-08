import { describe, expect, mock, test } from "bun:test";
import { createSizeNotices, noticeText } from "./size-notices.ts";

// The lines on the question cards for a message too large (oversized-acts, design decisions 2, 3
// and 4; view spec, An answer too large to send, Work too large to keep across a reload).

const size = { bytes: 6_800_000, max: 6_004_096 };

// Each question's work as the references the stores hold: a change replaces one of them.
const work = (initial: Record<string, readonly unknown[]> = {}) => {
  const refs = new Map<string, readonly unknown[]>(Object.entries(initial));
  return {
    refsOf: (id: string) => refs.get(id) ?? [],
    edit: (id: string, next: readonly unknown[]) => refs.set(id, next),
  };
};

describe("the notices of a refused command", () => {
  test("a refused reply with a size sets an answer notice on each question the acts name", () => {
    const notices = createSizeNotices(() => []);
    notices.refused(["a", "b"], size, "answer");
    expect(notices.noticeOf("a")).toEqual({ kind: "answer", size });
    expect(notices.noticeOf("b")).toEqual({ kind: "answer", size });
    expect(notices.noticeOf("c")).toBeUndefined();
  });

  test("a Submit's refusal sets a submit notice on each question in it", () => {
    const notices = createSizeNotices(() => []);
    notices.refused(["a", "b"], size, "submit");
    expect(notices.noticeOf("a")).toEqual({ kind: "submit", size });
    expect(notices.noticeOf("b")).toEqual({ kind: "submit", size });
  });

  test("a settled command that was too large sets a closed notice", () => {
    const notices = createSizeNotices(() => []);
    notices.closed(["a"]);
    expect(notices.noticeOf("a")).toEqual({ kind: "closed" });
  });

  test("the latest notice of a question replaces the one before", () => {
    const notices = createSizeNotices(() => []);
    notices.refused(["a"], size, "answer");
    notices.closed(["a"]);
    expect(notices.noticeOf("a")).toEqual({ kind: "closed" });
  });

  test("a notice goes when its question's work changes, and no other question's does", () => {
    const stores = work({ a: [1, 2], b: [3] });
    const notices = createSizeNotices(stores.refsOf);
    notices.refused(["a", "b"], size, "answer");
    notices.sync();
    expect(notices.noticeOf("a")).toBeDefined();
    stores.edit("a", [1, 5]);
    notices.sync();
    expect(notices.noticeOf("a")).toBeUndefined();
    expect(notices.noticeOf("b")).toEqual({ kind: "answer", size });
  });

  test("a notice goes when a later command of its question is sent", () => {
    const notices = createSizeNotices(() => []);
    notices.refused(["a", "b"], size, "answer");
    notices.clear(["a"]);
    expect(notices.noticeOf("a")).toBeUndefined();
    expect(notices.noticeOf("b")).toBeDefined();
  });

  test("a change is heard once, and nothing is heard when nothing changed", () => {
    const stores = work({ a: [1] });
    const notices = createSizeNotices(stores.refsOf);
    const heard = mock(() => {});
    notices.subscribe(heard);
    notices.sync();
    notices.clear(["a"]);
    expect(heard).toHaveBeenCalledTimes(0);
    notices.refused(["a"], size, "answer");
    expect(heard).toHaveBeenCalledTimes(1);
    notices.sync();
    expect(heard).toHaveBeenCalledTimes(1);
    stores.edit("a", [2]);
    notices.sync();
    expect(heard).toHaveBeenCalledTimes(2);
  });

  test("a listener that left hears nothing more", () => {
    const notices = createSizeNotices(() => []);
    const heard = mock(() => {});
    notices.subscribe(heard)();
    notices.closed(["a"]);
    expect(heard).toHaveBeenCalledTimes(0);
  });
});

describe("the line of a question left out of the draft", () => {
  test("a draft reply's leftOut sets it on those questions, and the latest reply wins", () => {
    const notices = createSizeNotices(() => []);
    notices.draftReply(["a", "b"]);
    expect(notices.leftOut("a")).toBe(true);
    expect(notices.leftOut("b")).toBe(true);
    notices.draftReply(["b"]);
    expect(notices.leftOut("a")).toBe(false);
    expect(notices.leftOut("b")).toBe(true);
    notices.draftReply([]);
    expect(notices.leftOut("b")).toBe(false);
  });

  test("a reply of the same size naming other questions moves the line, and the listener hears it", () => {
    const notices = createSizeNotices(() => []);
    notices.draftReply(["a"]);
    const heard = mock(() => {});
    notices.subscribe(heard);
    notices.draftReply(["b"]);
    expect(notices.leftOut("a")).toBe(false);
    expect(notices.leftOut("b")).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  test("a reply that names the same questions changes nothing and is not heard", () => {
    const notices = createSizeNotices(() => []);
    const heard = mock(() => {});
    notices.subscribe(heard);
    notices.draftReply([]);
    notices.draftReply(["a"]);
    notices.draftReply(["a"]);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  test("a sent command or a change of work does not take it away: only the next reply does", () => {
    const stores = work({ a: [1] });
    const notices = createSizeNotices(stores.refsOf);
    notices.draftReply(["a"]);
    stores.edit("a", [2]);
    notices.sync();
    notices.clear(["a"]);
    expect(notices.leftOut("a")).toBe(true);
  });
});

describe("the text of a notice", () => {
  const text = (notice: Parameters<typeof noticeText>[0], language: "en-US" | "it-IT") =>
    noticeText(notice, language, language);

  test("an answer too large: its size rounded up and the limit rounded down, in megabytes", () => {
    expect(text({ kind: "answer", size }, "en-US")).toBe(
      "Not sent: this answer is too large (6.8 MB, at most 6 MB). Shorten your work on this question, then answer again.",
    );
  });

  test("the limit and the size never read equal: a size just over the limit rounds up past it", () => {
    const just = { bytes: 6_004_097, max: 6_004_096 };
    expect(text({ kind: "answer", size: just }, "en-US")).toContain("(6.1 MB, at most 6 MB)");
  });

  test("a Submit too large names Immediate delivery", () => {
    expect(text({ kind: "submit", size }, "en-US")).toBe(
      "Not sent: Submit is too large to send at once (6.8 MB, at most 6 MB). Switch to Immediate and answer the questions one at a time, or shorten your work.",
    );
  });

  test("a socket closed as too large says the board refused the answer", () => {
    expect(text({ kind: "closed" }, "en-US")).toBe(
      "Not sent: the board refused this answer as too large. Shorten your work on this question, then answer again.",
    );
  });

  test("in Italian the sizes use the decimal comma", () => {
    expect(text({ kind: "answer", size }, "it-IT")).toContain("(6,8 MB, al massimo 6 MB)");
    expect(text({ kind: "submit", size }, "it-IT")).toContain("(6,8 MB, al massimo 6 MB)");
    expect(text({ kind: "closed" }, "it-IT")).toContain("troppo grande");
  });
});
