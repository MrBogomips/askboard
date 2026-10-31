import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  type ElementChange,
  type ElementShape,
  elementChanges,
} from "../src/index.ts";

// The generic element diff on a keyed shape (design decision 3): elements as an object from ID to
// fields, on a test-only `probe` item with an array field and a scalar field. Only `set`s.
const ITEM = "probe";
const KEYED: ElementShape = { elements: "plan", keyed: true };

type Value = Record<string, unknown>;

const keyed = (): Value => ({
  title: "kept as it is",
  plan: {
    t1: { links: ["t0"], start: 3 },
    t2: { start: 5 },
  },
});

const edit = (value: Value, change: (plan: Record<string, Record<string, unknown>>) => void) => {
  const copy = structuredClone(value);
  change(copy.plan as Record<string, Record<string, unknown>>);
  return copy;
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
};
const deeplyFrozen = (value: unknown): boolean =>
  typeof value !== "object" ||
  value === null ||
  (Object.isFrozen(value) && Object.values(value).every(deeplyFrozen));

const roundTrip = (sent: Value, edited: Value) =>
  applyElementChanges(ITEM, sent, elementChanges(ITEM, sent, edited, KEYED), KEYED);

describe("the diff of a keyed shape", () => {
  test("an equal value, an equal array in a new instance included, gives nothing", () => {
    expect(elementChanges(ITEM, keyed(), keyed(), KEYED)).toEqual([]);
    const edited = edit(keyed(), (plan) => {
      plan.t1 = { start: 3, links: ["t0"] };
    });
    expect(elementChanges(ITEM, keyed(), edited, KEYED)).toEqual([]);
  });

  test("a new entry gives one set per field, and no add", () => {
    const edited = edit(keyed(), (plan) => {
      plan["u-1"] = { start: 1, links: ["t1", "t2"] };
    });
    expect(elementChanges(ITEM, keyed(), edited, KEYED)).toEqual([
      { op: "set", target: "probe.u-1.links", value: ["t1", "t2"] },
      { op: "set", target: "probe.u-1.start", value: 1 },
    ]);
  });

  test("a removed entry gives a null set per field it held, and no remove", () => {
    const edited = edit(keyed(), (plan) => {
      delete plan.t1;
    });
    expect(elementChanges(ITEM, keyed(), edited, KEYED)).toEqual([
      { op: "set", target: "probe.t1.links", value: null },
      { op: "set", target: "probe.t1.start", value: null },
    ]);
  });

  test("a changed array gives one set with the whole array, an emptied field a null set", () => {
    const edited = edit(keyed(), (plan) => {
      plan.t1 = { links: ["t0", "t2"] };
    });
    expect(elementChanges(ITEM, keyed(), edited, KEYED)).toEqual([
      { op: "set", target: "probe.t1.links", value: ["t0", "t2"] },
      { op: "set", target: "probe.t1.start", value: null },
    ]);
  });

  test("the sets come by ID, then by field, in UTF-16 code-unit order", () => {
    const edited = edit(keyed(), (plan) => {
      plan.t2 = { start: 6, links: ["t1"] };
      plan.a1 = { start: 0 };
      plan.Z9 = { links: [], start: 9 };
      plan.t1 = { links: ["t0"], start: 4 };
    });
    expect(elementChanges(ITEM, keyed(), edited, KEYED).map((change) => change.target)).toEqual([
      "probe.Z9.links",
      "probe.Z9.start",
      "probe.a1.start",
      "probe.t1.start",
      "probe.t2.links",
      "probe.t2.start",
    ]);
  });

  test("an ID that names a property of every object, such as constructor, is an entry", () => {
    const edited = edit(keyed(), (plan) => {
      Object.assign(plan, { constructor: { start: 1 } });
    });
    const changes = elementChanges(ITEM, keyed(), edited, KEYED);
    expect(changes).toEqual([{ op: "set", target: "probe.constructor.start", value: 1 }]);
    expect(roundTrip(keyed(), edited)).toEqual(edited);
  });

  test("elements that are not an object of entries fail, naming the key or the entry", () => {
    expect(() => elementChanges(ITEM, { plan: [] }, keyed(), KEYED)).toThrow('"plan"');
    const edited = edit(keyed(), (plan) => {
      (plan as Record<string, unknown>).t3 = 7;
    });
    expect(() => elementChanges(ITEM, keyed(), edited, KEYED)).toThrow('"t3"');
  });
});

describe("applying the sets of a keyed shape", () => {
  test("a set makes a missing entry, and a null set empties a field, then the entry", () => {
    const changes: ElementChange[] = [
      { op: "set", target: "probe.u-1.links", value: ["t1"] },
      { op: "set", target: "probe.t2.start", value: null },
      { op: "set", target: "probe.t1.start", value: null },
    ];
    expect(applyElementChanges(ITEM, keyed(), changes, KEYED)).toEqual({
      title: "kept as it is",
      plan: { t1: { links: ["t0"] }, "u-1": { links: ["t1"] } },
    });
  });

  test("a null set on an entry that is not there changes nothing", () => {
    const changes: ElementChange[] = [{ op: "set", target: "probe.u-9.start", value: null }];
    expect(applyElementChanges(ITEM, keyed(), changes, KEYED)).toEqual(keyed());
  });

  test("rebuilds the edited value, keeping the props' other keys", () => {
    const edited = edit(keyed(), (plan) => {
      delete plan.t2;
      plan.t1 = { links: ["u-1"] };
      plan["u-1"] = { links: ["t0", "t1"], start: 2 };
    });
    expect(roundTrip(keyed(), edited)).toEqual(edited);
  });

  for (const change of [
    { op: "add", target: "probe.u-2", parent: null, after: null, value: { start: 1 } },
    { op: "remove", target: "probe.t1" },
    { op: "move", target: "probe.t1", parent: null, after: "t2" },
  ] satisfies ElementChange[]) {
    test(`refuses ${change.op}, naming the operation`, () => {
      const call = () => applyElementChanges(ITEM, keyed(), [change], KEYED);
      expect(call).toThrow(`the change 1 (${change.op} "${change.target}") does not apply`);
      expect(call).toThrow("keyed");
    });
  }

  test("refuses an unknown kind and a target without a field, naming the operation", () => {
    const rename = { op: "rename", target: "probe.t1" } as unknown as ElementChange;
    expect(() => applyElementChanges(ITEM, keyed(), [rename], KEYED)).toThrow('"rename"');
    const whole: ElementChange = { op: "set", target: "probe.t1", value: {} };
    expect(() => applyElementChanges(ITEM, keyed(), [whole], KEYED)).toThrow("no field");
  });

  test("leaves its inputs untouched and freezes what it returns, as the diff does", () => {
    const sent = deepFreeze(keyed());
    const edited = deepFreeze(
      edit(keyed(), (plan) => {
        plan["u-1"] = { links: ["t1"] };
      }),
    );
    const before = structuredClone([sent, edited]);
    const changes = elementChanges(ITEM, sent, edited, KEYED);
    const applied = applyElementChanges(ITEM, sent, changes, KEYED);
    expect([sent, edited]).toEqual(before);
    expect(deeplyFrozen(changes)).toBe(true);
    expect(deeplyFrozen(applied)).toBe(true);
  });
});
