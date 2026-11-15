import { describe, expect, test } from "bun:test";
import { createHeldKeyGuard } from "./held-key-guard.ts";

// A held key never reaches the card the board moved to (answering-flow-guidance, design decision 3;
// NFR-10): the repeats of a key that was down at the act are ignored on the moved-to card and on
// "Continue" until that key's keyup.

const ON_TARGET = { card: "q4", continue: false } as const;
const ON_CONTINUE = { card: "q3", continue: true } as const;
const ELSEWHERE = { card: "q1", continue: false } as const;

describe("the held-key guard", () => {
  test("ignores the repeats of a key held at the act, on the card the board moved to", () => {
    const guard = createHeldKeyGuard();
    guard.keydown({ key: "Enter", repeat: false, at: ELSEWHERE });
    guard.arm("q4");
    expect(guard.keydown({ key: "Enter", repeat: true, at: ON_TARGET })).toBe("ignore");
    expect(guard.keydown({ key: "Enter", repeat: true, at: ON_TARGET })).toBe("ignore");
  });

  test("ignores them on Continue, whichever card it stands in", () => {
    const guard = createHeldKeyGuard();
    guard.keydown({ key: "Enter", repeat: false, at: ELSEWHERE });
    guard.arm("q4");
    expect(guard.keydown({ key: "Enter", repeat: true, at: ON_CONTINUE })).toBe("ignore");
  });

  test("lets pass a first press, another key, and a repeat anywhere else", () => {
    const guard = createHeldKeyGuard();
    guard.keydown({ key: "Enter", repeat: false, at: ELSEWHERE });
    guard.arm("q4");
    expect(guard.keydown({ key: "Enter", repeat: true, at: ELSEWHERE })).toBe("pass");
    expect(guard.keydown({ key: " ", repeat: true, at: ON_TARGET })).toBe("pass");
    // A press that is not a repeat is the user's: it is never ignored.
    expect(guard.keydown({ key: "Enter", repeat: false, at: ON_TARGET })).toBe("pass");
  });

  test("ends with that key's keyup, and the other keys' guards stay until theirs", () => {
    const guard = createHeldKeyGuard();
    guard.keydown({ key: "Control", repeat: false, at: ELSEWHERE });
    guard.keydown({ key: "Enter", repeat: false, at: ELSEWHERE });
    guard.arm("q4");
    guard.keyup("Enter");
    expect(guard.keydown({ key: "Enter", repeat: true, at: ON_TARGET })).toBe("pass");
    expect(guard.keydown({ key: "Control", repeat: true, at: ON_TARGET })).toBe("ignore");
    guard.keyup("Control");
    expect(guard.keydown({ key: "Control", repeat: true, at: ON_TARGET })).toBe("pass");
  });

  test("no key held at the act (a click) guards nothing", () => {
    const guard = createHeldKeyGuard();
    guard.arm("q4");
    expect(guard.keydown({ key: "Enter", repeat: true, at: ON_TARGET })).toBe("pass");
  });

  test("a later move replaces the earlier guard, and losing focus forgets the held keys", () => {
    const guard = createHeldKeyGuard();
    guard.keydown({ key: "Enter", repeat: false, at: ELSEWHERE });
    guard.arm("q4");
    guard.arm("q7");
    expect(guard.keydown({ key: "Enter", repeat: true, at: ON_TARGET })).toBe("pass");
    expect(guard.keydown({ key: "Enter", repeat: true, at: { card: "q7", continue: false } })).toBe(
      "ignore",
    );
    guard.reset();
    expect(guard.keydown({ key: "Enter", repeat: true, at: { card: "q7", continue: false } })).toBe(
      "pass",
    );
  });
});
