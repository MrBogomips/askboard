import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { join } from "node:path";
import {
  expectMedianWithin,
  judgeMedians,
  median,
  PERF_FACTOR,
  PERF_RUNNER_FACTORS,
  PERF_RUNS,
  perfFactor,
  perfLine,
  perfRuns,
  perfScaled,
} from "./perf.ts";

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

describe("perfFactor (ci-e2e-gates, decision 2)", () => {
  test("is 1 with no runner named, 2 on Linux and 3 on macOS", () => {
    expect(perfFactor(undefined)).toBe(1);
    expect(perfFactor("Linux")).toBe(2);
    expect(perfFactor("macOS")).toBe(3);
    expect(PERF_RUNNER_FACTORS).toEqual({ Linux: 2, macOS: 3 });
  });

  test("refuses any other value, the empty string included, naming it and both keys", () => {
    for (const value of ["Windows", "", "linux"]) {
      expect(() => perfFactor(value)).toThrow(new RegExp(`"${value}".*Linux.*macOS`));
    }
  });

  test("is 1 here, where the variable is not set", () => {
    expect(process.env.ASKBOARD_PERF_RUNNER).toBeUndefined();
    expect(PERF_FACTOR).toBe(1);
  });
});

describe("the factor on a judgement", () => {
  test("factor 3 passes [398, 214, 177] against gate 100, and the line says so", () => {
    expect(() => expectMedianWithin("t worst edit", [398, 214, 177], 100, false, 3)).not.toThrow();
    expect(written).toEqual([
      "perf t worst edit [398, 214, 177] median 214 gate 100 factor 3 bound 300\n",
    ]);
  });

  test("factor 2 fails [240, 260, 250] against gate 100, naming the bound 200", () => {
    expect(() => expectMedianWithin("t", [240, 260, 250], 100, false, 2)).toThrow(/bound 200/);
  });

  test("factor 1 prints today's line", () => {
    expect(perfLine("k", [1, 2, 3], 10)).toBe("perf k [1, 2, 3] median 2 gate 10");
    expect(perfLine("k", [1, 2, 3], 10, 1)).toBe("perf k [1, 2, 3] median 2 gate 10");
  });

  test("below stays strict at the scaled bound", () => {
    expect(() => expectMedianWithin("x", [250, 300, 350], 100, true, 3)).toThrow(/300/);
    expect(() => expectMedianWithin("x", [250, 299, 350], 100, true, 3)).not.toThrow();
  });

  test("a median at the scaled bound passes when below is not set", () => {
    expect(() => expectMedianWithin("x", [250, 300, 350], 100, false, 3)).not.toThrow();
    expect(() => expectMedianWithin("x", [250, 301, 350], 100, false, 3)).toThrow(/bound 300/);
  });

  test("judgeMedians applies the factor it is given", () => {
    judgeMedians([{ label: "a", samples: [150, 160, 170], gate: 100 }], 2);
    expect(written).toEqual(["perf a [150, 160, 170] median 160 gate 100 factor 2 bound 200\n"]);
    expect(() => judgeMedians([{ label: "a", samples: [250, 260, 270], gate: 100 }], 2)).toThrow(
      /bound 200/,
    );
  });

  test("perfRuns applies the factor it is given", async () => {
    const figures = [150, 160, 170];
    await perfRuns("t", async (run, gate) => gate("edit", figures[run] as number, 100), 2);
    expect(written).toEqual([
      "perf t edit [150, 160, 170] median 160 gate 100 factor 2 bound 200\n",
    ]);
    await expect(
      perfRuns("t", async (run, gate) => gate("edit", (figures[run] as number) + 100, 100), 2),
    ).rejects.toThrow(/bound 200/);
  });
});

describe("the factor from the environment, in a process of its own", () => {
  const PERF = join(import.meta.dir, "perf.ts");
  const child = (runner: string | undefined, body: string) => {
    const env: Record<string, string> = { PATH: process.env.PATH ?? "" };
    if (runner !== undefined) env.ASKBOARD_PERF_RUNNER = runner;
    const result = Bun.spawnSync(
      [process.execPath, "-e", `import * as perf from ${JSON.stringify(PERF)};\n${body}`],
      { env },
    );
    return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
  };

  test("perfScaled multiplies a wait by the runner's factor", () => {
    expect(perfScaled(120_000)).toBe(120_000);
    const body = "process.stdout.write(String(perf.perfScaled(120000)));";
    expect(child(undefined, body).out).toBe("120000");
    expect(child("Linux", body).out).toBe("240000");
    expect(child("macOS", body).out).toBe("360000");
  });

  test("an unknown runner fails the import, naming it, before any judgement prints", () => {
    const result = child(
      "Windows",
      "perf.expectMedianWithin('x', [1, 2, 3], 100); process.stdout.write('judged');",
    );
    expect(result.code).not.toBe(0);
    expect(result.out).toBe("");
    expect(result.err).toContain("Windows");
  });

  test("a child at factor 3 passes a median the gate alone would fail, and prints the factor", () => {
    const result = child("macOS", "perf.expectMedianWithin('x', [398, 214, 177], 100);");
    expect(result.code).toBe(0);
    expect(result.out).toBe("perf x [398, 214, 177] median 214 gate 100 factor 3 bound 300\n");
  });
});
