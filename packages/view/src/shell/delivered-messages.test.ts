import { describe, expect, test } from "bun:test";
import { createDeliveredGate, DELIVERED_WINDOW_MS } from "./delivered-messages.ts";

// The delivered count, said at most once every 5 seconds (answering-flow-guidance, design
// decision 6; requirement "Status messages for the guided flow"), with an injected clock.
const said = (d: number, s: number) => ({ key: "status.delivered", params: { d, s } }) as const;

describe("the delivered gate", () => {
  test("the window is 5 seconds", () => {
    expect(DELIVERED_WINDOW_MS).toBe(5000);
  });

  test("the first observation is the baseline: a board that loads with deliveries says nothing", () => {
    const gate = createDeliveredGate();
    gate.observe({ sent: 4, delivered: 2 }, 0);
    expect(gate.dueAt()).toBeUndefined();
    expect(gate.due(60_000)).toBeUndefined();
  });

  test("a change opens a window; its end gives one message with the latest count", () => {
    const gate = createDeliveredGate();
    gate.observe({ sent: 2, delivered: 0 }, 0);
    gate.observe({ sent: 2, delivered: 1 }, 1000);
    expect(gate.dueAt()).toBe(1000 + DELIVERED_WINDOW_MS);
    gate.observe({ sent: 2, delivered: 2 }, 3000);
    expect(gate.due(5999)).toBeUndefined();
    expect(gate.due(6000)).toEqual(said(2, 2));
    expect(gate.due(6001)).toBeUndefined();
    expect(gate.dueAt()).toBeUndefined();
  });

  test("an unchanged count says nothing", () => {
    const gate = createDeliveredGate();
    gate.observe({ sent: 3, delivered: 1 }, 0);
    gate.observe({ sent: 3, delivered: 1 }, 1000);
    gate.observe({ sent: 4, delivered: 1 }, 2000);
    expect(gate.dueAt()).toBeUndefined();
    expect(gate.due(10_000)).toBeUndefined();
  });

  test("a count that returns to what was said within the window says nothing", () => {
    const gate = createDeliveredGate();
    gate.observe({ sent: 3, delivered: 1 }, 0);
    gate.observe({ sent: 3, delivered: 2 }, 100);
    gate.observe({ sent: 3, delivered: 1 }, 200);
    expect(gate.due(5100)).toBeUndefined();
    expect(gate.dueAt()).toBeUndefined();
  });

  test("a count of zero is never said", () => {
    const gate = createDeliveredGate();
    gate.observe({ sent: 3, delivered: 2 }, 0);
    gate.observe({ sent: 3, delivered: 0 }, 100);
    expect(gate.due(5100)).toBeUndefined();
  });

  test("two messages are never closer than the window", () => {
    const gate = createDeliveredGate();
    gate.observe({ sent: 4, delivered: 0 }, 0);
    gate.observe({ sent: 4, delivered: 1 }, 10);
    expect(gate.due(5010)).toEqual(said(1, 4));
    gate.observe({ sent: 4, delivered: 3 }, 5011);
    expect(gate.due(5012)).toBeUndefined();
    expect(gate.due(10_011)).toEqual(said(3, 4));
  });

  test("a due call before any observation says nothing", () => {
    expect(createDeliveredGate().due(0)).toBeUndefined();
  });
});
