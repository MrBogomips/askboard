// The render queue (latex-kanban-timeline, task 4.17; view-and-widgets spec: LaTeX previews one at a
// time; design decision 7, Many items): one draw per scheduled task, in the order asked, so that the
// board answers input between draws. A manual scheduler stands in for `setTimeout(…, 0)`.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Glob } from "bun";
import { createRenderQueue, renderQueue } from "./queue.ts";

// A scheduler that runs nothing until asked, one task at a time, and counts what was scheduled.
const manual = () => {
  const tasks: (() => void)[] = [];
  let scheduled = 0;
  return {
    schedule: (task: () => void) => {
      scheduled += 1;
      tasks.push(task);
    },
    get pending() {
      return tasks.length;
    },
    get scheduled() {
      return scheduled;
    },
    /** Runs the one scheduled task, if any. */
    step: () => {
      const task = tasks.shift();
      task?.();
      return task !== undefined;
    },
    /** Runs tasks until none is scheduled. */
    drain: () => {
      let ran = 0;
      while (tasks.length > 0) {
        tasks.shift()?.();
        ran += 1;
        if (ran > 1_000) throw new Error("the queue never empties");
      }
      return ran;
    },
  };
};

const draws = () => {
  const order: string[] = [];
  return { order, draw: (name: string) => () => order.push(name) };
};

describe("the order of draws", () => {
  test("three keys asked in turn draw one per scheduled task, in that order", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    const { order, draw } = draws();
    queue.ask("a", draw("a"));
    queue.ask("b", draw("b"));
    queue.ask("c", draw("c"));
    expect(order).toEqual([]);
    scheduler.step();
    expect(order).toEqual(["a"]);
    scheduler.step();
    expect(order).toEqual(["a", "b"]);
    scheduler.step();
    expect(order).toEqual(["a", "b", "c"]);
    expect(scheduler.step()).toBe(false);
  });

  test("a key asked again before its turn draws once, the newer draw, in its first place", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    const { order, draw } = draws();
    queue.ask("a", draw("a1"));
    queue.ask("b", draw("b"));
    queue.ask("c", draw("c"));
    queue.ask("a", draw("a2"));
    scheduler.drain();
    expect(order).toEqual(["a2", "b", "c"]);
  });

  test("a draw asked with edit goes before every pending draw asked without it, after earlier edits", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    const { order, draw } = draws();
    queue.ask("a", draw("a"));
    queue.ask("b", draw("b"));
    queue.ask("c", draw("c"), { edit: true });
    queue.ask("d", draw("d"));
    queue.ask("e", draw("e"), { edit: true });
    scheduler.drain();
    expect(order).toEqual(["c", "e", "a", "b", "d"]);
  });

  test("a pending draw asked again as an edit moves to the edits, and never back", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    const { order, draw } = draws();
    queue.ask("a", draw("a"));
    queue.ask("b", draw("b1"));
    queue.ask("c", draw("c"));
    queue.ask("b", draw("b2"), { edit: true });
    queue.ask("d", draw("d"), { edit: true });
    queue.ask("b", draw("b3"));
    scheduler.drain();
    expect(order).toEqual(["b3", "d", "a", "c"]);
  });

  test("a draw asked while another runs waits for its turn behind the pending ones", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    const order: string[] = [];
    queue.ask("a", () => {
      order.push("a");
      queue.ask("a", () => order.push("a again"));
    });
    queue.ask("b", () => order.push("b"));
    scheduler.drain();
    expect(order).toEqual(["a", "b", "a again"]);
  });
});

describe("drop and failure", () => {
  test("drop removes a pending draw, and a key that is not pending is no matter", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    const { order, draw } = draws();
    queue.ask("a", draw("a"));
    queue.ask("b", draw("b"));
    queue.drop("a");
    queue.drop("never asked");
    scheduler.drain();
    expect(order).toEqual(["b"]);
  });

  test("a queue whose only draw was dropped runs an empty task and schedules nothing more", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    queue.ask("a", () => undefined);
    queue.drop("a");
    expect(scheduler.pending).toBe(1);
    scheduler.step();
    expect(scheduler.pending).toBe(0);
  });

  test("a draw that throws does not stop the queue, and is reported", () => {
    const scheduler = manual();
    const failures: unknown[] = [];
    const queue = createRenderQueue(scheduler.schedule, (error) => failures.push(error));
    const { order, draw } = draws();
    const boom = new RangeError("boom");
    queue.ask("a", () => {
      throw boom;
    });
    queue.ask("b", draw("b"));
    scheduler.drain();
    expect(order).toEqual(["b"]);
    expect(failures).toEqual([boom]);
  });

  test("a draw that throws is dropped quietly when nobody listens", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    const { order, draw } = draws();
    queue.ask("a", () => {
      throw new Error("boom");
    });
    queue.ask("b", draw("b"));
    expect(() => scheduler.drain()).not.toThrow();
    expect(order).toEqual(["b"]);
  });

  test("a report that throws does not stop the queue either", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule, () => {
      throw new Error("the listener");
    });
    const { order, draw } = draws();
    queue.ask("a", () => {
      throw new Error("boom");
    });
    queue.ask("b", draw("b"));
    expect(() => scheduler.drain()).not.toThrow();
    expect(order).toEqual(["b"]);
  });
});

describe("a draw's own failure handler (task 5.1: the item's draw that throws fails the item)", () => {
  test("a draw that throws is reported to the handler it was asked with, not to the queue's", () => {
    const scheduler = manual();
    const queueFailures: unknown[] = [];
    const queue = createRenderQueue(scheduler.schedule, (error) => queueFailures.push(error));
    const { order, draw } = draws();
    const own: unknown[] = [];
    const boom = new RangeError("boom");
    queue.ask(
      "a",
      () => {
        throw boom;
      },
      { onError: (error) => own.push(error) },
    );
    queue.ask("b", draw("b"));
    scheduler.drain();
    expect(own).toEqual([boom]);
    expect(queueFailures).toEqual([]);
    expect(order).toEqual(["b"]);
  });

  test("a draw asked again replaces the handler with its own", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    const first: unknown[] = [];
    const second: unknown[] = [];
    const throws = () => {
      throw new Error("boom");
    };
    queue.ask("a", throws, { onError: (error) => first.push(error) });
    queue.ask("a", throws, { onError: (error) => second.push(error) });
    scheduler.drain();
    expect(first).toEqual([]);
    expect(second).toHaveLength(1);
  });

  test("a draw asked without a handler keeps the queue's, and a handler that throws stops nothing", () => {
    const scheduler = manual();
    const queueFailures: unknown[] = [];
    const queue = createRenderQueue(scheduler.schedule, (error) => queueFailures.push(error));
    const { order, draw } = draws();
    const throws = () => {
      throw new Error("boom");
    };
    queue.ask("a", throws);
    queue.ask(
      "b",
      () => {
        throw new Error("boom");
      },
      {
        onError: () => {
          throw new Error("the handler");
        },
      },
    );
    queue.ask("c", draw("c"));
    expect(() => scheduler.drain()).not.toThrow();
    expect(queueFailures).toHaveLength(1);
    expect(order).toEqual(["c"]);
  });
});

describe("scheduling", () => {
  test("nothing is scheduled while the queue is empty, and at most one task at a time", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    expect(scheduler.scheduled).toBe(0);
    queue.drop("a");
    expect(scheduler.scheduled).toBe(0);
    for (const key of ["a", "b", "c", "d"]) {
      queue.ask(key, () => undefined);
      expect(scheduler.pending).toBe(1);
    }
    expect(scheduler.scheduled).toBe(1);
    scheduler.step();
    expect(scheduler.pending).toBe(1);
    scheduler.drain();
    expect(scheduler.scheduled).toBe(4);
    expect(scheduler.pending).toBe(0);
  });

  test("asking after the queue emptied schedules again", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    queue.ask("a", () => undefined);
    scheduler.drain();
    queue.ask("b", () => undefined);
    expect(scheduler.pending).toBe(1);
  });

  test("a draw's own asks never schedule a second task", () => {
    const scheduler = manual();
    const queue = createRenderQueue(scheduler.schedule);
    queue.ask("a", () => {
      queue.ask("b", () => undefined);
      queue.ask("c", () => undefined);
    });
    scheduler.step();
    expect(scheduler.pending).toBe(1);
  });
});

describe("the chunk's queue", () => {
  test("draws one per timeout of 0, in the order asked", async () => {
    const order: string[] = [];
    renderQueue.ask("a", () => order.push("a"));
    renderQueue.ask("b", () => order.push("b"));
    expect(order).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(order).toEqual(["a", "b"]);
  });

  test("no module outside latex/ imports it", async () => {
    const root = join(import.meta.dir, "..");
    const importers: string[] = [];
    for await (const file of new Glob("**/*.{ts,tsx}").scan(root)) {
      if (file.startsWith("latex/") || file.endsWith(".test.ts")) continue;
      if (/latex\/queue/.test(await Bun.file(join(root, file)).text())) importers.push(file);
    }
    expect(importers).toEqual([]);
  });
});
