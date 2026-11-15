import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { expectMedianWithin, judgeMedians, median, PERF_RUNS, perfLine, perfRuns } from "./perf.ts";

// What the helpers print goes to stdout, where the runner shows it; the tests keep it.
const written: string[] = [];
const spy = spyOn(process.stdout, "write").mockImplementation(((chunk: string | Uint8Array) => {
  written.push(String(chunk));
  return true;
}) as typeof process.stdout.write);

afterEach(() => {
  written.length = 0;
});

// Restores the real writer once this file's tests are done (bun runs a file's hooks in order).
import { afterAll } from "bun:test";

afterAll(() => spy.mockRestore());

describe("median", () => {
  test("is the middle of three, whatever their order", () => {
    expect(median([92, 131, 97])).toBe(97);
    expect(median([131, 97, 92])).toBe(97);
    expect(median([5, 5, 5])).toBe(5);
  });

  test("is the mean of the two middle samples for an even count, and the sample for one", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
  });

  test("refuses no samples, and a sample that is not a finite number", () => {
    expect(() => median([])).toThrow(/no samples/);
    expect(() => median([1, Number.NaN, 3])).toThrow(/finite/);
    expect(() => median([1, Number.POSITIVE_INFINITY])).toThrow(/finite/);
  });

  test("does not reorder the caller's samples", () => {
    const samples = [3, 1, 2];
    median(samples);
    expect(samples).toEqual([3, 1, 2]);
  });
});

describe("PERF_RUNS", () => {
  test("is three", () => {
    expect(PERF_RUNS).toBe(3);
  });
});

describe("expectMedianWithin", () => {
  test("passes on [92, 131, 97] against 100: one slow run of three (spec scenario 1)", () => {
    expect(() =>
      expectMedianWithin("table-bounds worst webkit edit", [92, 131, 97], 100),
    ).not.toThrow();
    expect(written.join("")).toBe(
      "perf table-bounds worst webkit edit [92, 131, 97] median 97 gate 100\n",
    );
  });

  test("fails on [1,900, 2,300, 2,450] against 2,000, printing all three figures (spec scenario 2)", () => {
    let message = "";
    try {
      expectMedianWithin("latex-bounds nest chromium", [1_900, 2_300, 2_450], 2_000);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("1900");
    expect(message).toContain("2300");
    expect(message).toContain("2450");
    expect(message).toContain("latex-bounds nest chromium");
    expect(written.join("")).toBe(
      "perf latex-bounds nest chromium [1900, 2300, 2450] median 2300 gate 2000\n",
    );
  });

  test("a median equal to the gate passes, and fails when `below` is set", () => {
    expect(() => expectMedianWithin("x", [90, 100, 110], 100)).not.toThrow();
    expect(() => expectMedianWithin("x", [90, 100, 110], 100, true)).toThrow(/100/);
    expect(() => expectMedianWithin("x", [90, 99, 110], 100, true)).not.toThrow();
  });

  test("shows fractional samples to one decimal and whole ones as they are", () => {
    expect(perfLine("k", [2.04, 0.9, 1], 150)).toBe("perf k [2.0, 0.9, 1] median 1 gate 150");
  });

  test("refuses no samples, printing nothing", () => {
    expect(() => expectMedianWithin("x", [], 100)).toThrow(/no samples/);
    expect(written).toEqual([]);
  });
});

describe("judgeMedians", () => {
  test("prints a line for every check, then fails once naming each check that failed", () => {
    let message = "";
    try {
      judgeMedians([
        { label: "a", samples: [1, 2, 3], gate: 10 },
        { label: "b", samples: [50, 60, 70], gate: 10 },
        { label: "c", samples: [5, 5, 5], gate: 5, below: true },
      ]);
    } catch (error) {
      message = String(error);
    }
    expect(written).toEqual([
      "perf a [1, 2, 3] median 2 gate 10\n",
      "perf b [50, 60, 70] median 60 gate 10\n",
      "perf c [5, 5, 5] median 5 gate 5\n",
    ]);
    expect(message).toContain("b:");
    expect(message).toContain("c:");
    expect(message).not.toContain("a:");
  });

  test("passes when every check holds", () => {
    expect(() => judgeMedians([{ label: "a", samples: [1, 2, 3], gate: 10 }])).not.toThrow();
  });
});

describe("perfRuns", () => {
  test("runs the body three times in turn, and judges each gate once on its median", async () => {
    const order: number[] = [];
    const figures = [92, 131, 97];
    await perfRuns("t", async (run, gate) => {
      order.push(run);
      gate("edit", figures[run] as number, 100);
    });
    expect(order).toEqual([0, 1, 2]);
    expect(written).toEqual(["perf t edit [92, 131, 97] median 97 gate 100\n"]);
  });

  test("fails on the median, not on one slow run, and shows the three figures", async () => {
    const figures = [1_900, 2_300, 2_450];
    await expect(
      perfRuns("t", async (run, gate) => gate("render", figures[run] as number, 2_000, true)),
    ).rejects.toThrow(/2300/);
    expect(written.join("")).toContain("[1900, 2300, 2450]");
  });

  test("a functional failure in any run fails the scenario, whatever the medians, and judges nothing", async () => {
    await expect(
      perfRuns("t", async (run, gate) => {
        gate("edit", 1, 100);
        if (run === 1) throw new Error("no field error naming \\def");
      }),
    ).rejects.toThrow(/\\def/);
    expect(written).toEqual([]);
  });

  test("keeps the figures of gates with different labels apart, and a gate keeps its limit", async () => {
    await perfRuns("t", async (run, gate) => {
      gate("a", run, 10);
      gate("b", run + 100, 200, true);
    });
    expect(written).toEqual([
      "perf t a [0, 1, 2] median 1 gate 10\n",
      "perf t b [100, 101, 102] median 101 gate 200\n",
    ]);
    await expect(
      perfRuns("t", async (run, gate) => gate("a", 1, run === 0 ? 10 : 20)),
    ).rejects.toThrow(/limit/);
  });

  test("refuses a gate that some runs did not record", async () => {
    await expect(
      perfRuns("t", async (run, gate) => {
        if (run !== 2) gate("a", 1, 10);
      }),
    ).rejects.toThrow(/2 of 3 runs/);
  });
});
