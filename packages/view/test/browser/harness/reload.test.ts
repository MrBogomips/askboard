import { describe, expect, test } from "bun:test";
import { LOST_FRAME_NOTICE, type ReloadSteps, reloadAndWait, viewFrameLost } from "./reload.ts";

describe("viewFrameLost", () => {
  test("is lost when the srcdoc is set and Playwright tracks no frame at it", () => {
    expect(viewFrameLost("<!doctype html>", ["about:blank"])).toBe(true);
    expect(viewFrameLost("<!doctype html>", [])).toBe(true);
  });

  test("is not lost once Playwright tracks the frame at the srcdoc", () => {
    expect(viewFrameLost("<!doctype html>", ["about:srcdoc"])).toBe(false);
  });

  test("is not lost while the board page has set no srcdoc: the view is still loading", () => {
    expect(viewFrameLost(null, ["about:blank"])).toBe(false);
  });
});

// Steps that record what ran: `waits` fail in turn with the given errors, then load.
const steps = (waits: readonly (Error | undefined)[], lost: boolean) => {
  const ran: string[] = [];
  let wait = 0;
  const recorded: ReloadSteps = {
    reload: async () => ran.push("reload"),
    loaded: async () => {
      ran.push("wait");
      const error = waits[wait];
      wait += 1;
      if (error !== undefined) throw error;
    },
    frameLost: async () => {
      ran.push("lost?");
      return lost;
    },
    failure: async (error) => new Error(`failed: ${(error as Error).message}`),
    warn: (text) => ran.push(`warn: ${text}`),
  };
  return { ran, recorded };
};

describe("reloadAndWait", () => {
  test("reloads once when the view shows", async () => {
    const { ran, recorded } = steps([undefined], false);
    await reloadAndWait(recorded);
    expect(ran).toEqual(["reload", "wait"]);
  });

  test("reloads once more, saying so, when Playwright lost the view's frame", async () => {
    const { ran, recorded } = steps([new Error("timeout")], true);
    await reloadAndWait(recorded);
    expect(ran).toEqual([
      "reload",
      "wait",
      "lost?",
      `warn: ${LOST_FRAME_NOTICE}`,
      "reload",
      "wait",
    ]);
  });

  test("fails with the wait's error when the frame was not lost, with no second reload", async () => {
    const { ran, recorded } = steps([new Error("timeout")], false);
    await expect(reloadAndWait(recorded)).rejects.toThrow("failed: timeout");
    expect(ran).toEqual(["reload", "wait", "lost?"]);
  });

  test("fails with the second wait's error when the view does not show after the second reload", async () => {
    const { ran, recorded } = steps([new Error("first"), new Error("second")], true);
    await expect(reloadAndWait(recorded)).rejects.toThrow("failed: second");
    expect(ran).toEqual([
      "reload",
      "wait",
      "lost?",
      `warn: ${LOST_FRAME_NOTICE}`,
      "reload",
      "wait",
    ]);
  });
});
