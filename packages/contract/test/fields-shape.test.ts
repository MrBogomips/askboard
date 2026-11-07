import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  type Change,
  type ElementShape,
  elementChanges,
  type FieldsShape,
  SCHEMA_IDS,
} from "../src/index.ts";
import { validateAgainst } from "../src/validate.ts";

// The whole-field shape of the generic diff (latex-kanban-timeline, design decision 2; contract
// spec, "A whole field changes by one set"): named fields of the item itself, each changed one a
// single `set` of the whole field, on a test-only `probe` item.
const ITEM = "probe";
const EXPRESSION: FieldsShape = { fields: ["expression"] };
const TWO: FieldsShape = { fields: ["b", "a"] };

type Value = Record<string, unknown>;

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

// Every operation the diff writes is one of the output format's changes (AD-20, finding F4).
const CHANGE = `${SCHEMA_IDS.answerEvent}#/$defs/change`;
const problemsOf = (change: Change) => {
  const checked = validateAgainst(CHANGE, change);
  return checked.ok ? [] : checked.problems;
};
const diff = (sent: Value, edited: Value, shape: ElementShape = EXPRESSION): readonly Change[] => {
  const changes = elementChanges(ITEM, sent, edited, shape);
  for (const change of changes) {
    expect({ change, problems: problemsOf(change) }).toEqual({ change, problems: [] });
  }
  return changes;
};

describe("the diff of a fields shape", () => {
  test("a corrected expression gives one set of the whole field, which applies back", () => {
    const sent = { expression: "a^2+b^2" };
    const edited = { expression: "a^2+b^2=c^2" };
    const changes = diff(sent, edited);
    expect(changes).toEqual([{ op: "set", target: "probe.expression", value: "a^2+b^2=c^2" }]);
    expect(applyElementChanges(ITEM, sent, changes, EXPRESSION)).toEqual(edited);
  });

  test("an untouched field gives no change, an equal object or array in a new instance included", () => {
    expect(diff({ expression: "x" }, { expression: "x" })).toEqual([]);
    const shape: FieldsShape = { fields: ["data"] };
    const sent = { data: { list: [1, { k: "v" }], n: 2 } };
    expect(diff(sent, { data: { n: 2, list: [1, { k: "v" }] } }, shape)).toEqual([]);
  });

  test("a changed array or object field is one set holding the whole new value", () => {
    const shape: FieldsShape = { fields: ["list", "data"] };
    const sent = { list: [1, 2], data: { a: 1 } };
    const edited = { list: [1, 2, 3], data: { a: 1, b: 2 } };
    expect(diff(sent, edited, shape)).toEqual([
      { op: "set", target: "probe.list", value: [1, 2, 3] },
      { op: "set", target: "probe.data", value: { a: 1, b: 2 } },
    ]);
  });

  test("a key the shape does not name fails, naming the item and the key", () => {
    const edited = { expression: "x", display: true };
    expect(() => elementChanges(ITEM, { expression: "x" }, edited, EXPRESSION)).toThrow('"probe"');
    expect(() => elementChanges(ITEM, { expression: "x" }, edited, EXPRESSION)).toThrow(
      '"display"',
    );
  });

  test("an unnamed key that changes or goes fails, one that stays equal does not", () => {
    const sent = { expression: "x", display: false };
    expect(() =>
      elementChanges(ITEM, sent, { expression: "x", display: true }, EXPRESSION),
    ).toThrow('"display"');
    expect(() => elementChanges(ITEM, sent, { expression: "x" }, EXPRESSION)).toThrow('"display"');
    expect(diff(sent, { expression: "y", display: false })).toEqual([
      { op: "set", target: "probe.expression", value: "y" },
    ]);
  });

  test("a named field that is gone is a null set, and applying it takes the field away", () => {
    const sent: Value = { expression: "x", extra: 1 };
    const edited: Value = { extra: 1 };
    const changes = diff(sent, edited);
    expect(changes).toEqual([{ op: "set", target: "probe.expression", value: null }]);
    expect(applyElementChanges(ITEM, sent, changes, EXPRESSION)).toEqual(edited);
  });

  test("a named field the sent value lacks is a set of its value", () => {
    const changes = diff({}, { expression: "x" });
    expect(changes).toEqual([{ op: "set", target: "probe.expression", value: "x" }]);
    expect(applyElementChanges(ITEM, {}, changes, EXPRESSION)).toEqual({ expression: "x" });
  });

  test("the sets come in the shape's order, not the fields' or the keys'", () => {
    const sent = { a: 1, b: 1 };
    const edited = { a: 2, b: 2 };
    expect(diff(sent, edited, TWO).map(({ target }) => target)).toEqual(["probe.b", "probe.a"]);
    expect(diff(edited, sent, { fields: ["a", "b"] }).map(({ target }) => target)).toEqual([
      "probe.a",
      "probe.b",
    ]);
  });

  test("a field the shape names twice gives one set", () => {
    expect(diff({ a: 1 }, { a: 2 }, { fields: ["a", "a"] })).toEqual([
      { op: "set", target: "probe.a", value: 2 },
    ]);
  });

  test("an odd field name stays a key: __proto__ gives one set and applies as an own key", () => {
    const shape: FieldsShape = { fields: ["__proto__"] };
    const sent = JSON.parse('{"__proto__": "one"}') as Value;
    const edited = JSON.parse('{"__proto__": "two"}') as Value;
    const changes = diff(sent, edited, shape);
    expect(changes).toEqual([{ op: "set", target: "probe.__proto__", value: "two" }]);
    const applied = applyElementChanges(ITEM, sent, changes, shape);
    expect(Object.hasOwn(applied, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(applied)).toBe(Object.prototype);
    expect(JSON.stringify(applied)).toBe('{"__proto__":"two"}');
  });

  test("an odd name no value holds is no field: constructor, toString and __proto__ read as absent", () => {
    const shape: FieldsShape = { fields: ["constructor", "toString", "__proto__"] };
    expect(diff({}, {}, shape)).toEqual([]);
    expect(diff({ a: 1 }, { a: 1 }, shape)).toEqual([]);
    const edited = { constructor: 1 } as Value;
    expect(diff({}, edited, shape)).toEqual([{ op: "set", target: "probe.constructor", value: 1 }]);
  });

  test("an inherited name on a value is never read as a field it holds", () => {
    const shape: FieldsShape = { fields: ["toString"] };
    const edited = { toString: "x" };
    expect(diff({}, edited, shape)).toEqual([{ op: "set", target: "probe.toString", value: "x" }]);
    expect(applyElementChanges(ITEM, {}, diff({}, edited, shape), shape)).toEqual(edited);
  });

  test("the output is frozen and the inputs stay untouched", () => {
    const sent = deepFreeze({ expression: "a", extra: { k: [1] } });
    const edited = deepFreeze({ expression: "b", extra: { k: [1] } });
    const changes = elementChanges(ITEM, sent, edited, EXPRESSION);
    expect(deeplyFrozen(changes)).toBe(true);
    const applied = applyElementChanges(ITEM, sent, changes, EXPRESSION);
    expect(deeplyFrozen(applied)).toBe(true);
    expect(sent).toEqual({ expression: "a", extra: { k: [1] } });
  });

  test("the value of a set is a copy, never the edited value's own object", () => {
    const shape: FieldsShape = { fields: ["data"] };
    const edited = { data: { a: [1] } };
    const [change] = elementChanges(ITEM, { data: {} }, edited, shape);
    expect(change?.op).toBe("set");
    expect((change as { value: unknown }).value).not.toBe(edited.data);
    expect((change as { value: unknown }).value).toEqual(edited.data);
  });
});

describe("applying the sets of a fields shape", () => {
  const apply = (changes: readonly Change[], sent: Value = { expression: "x" }) =>
    applyElementChanges(ITEM, sent, changes, EXPRESSION);

  test("a set puts the whole value, a null set takes the field away, the other keys stay", () => {
    expect(
      apply([{ op: "set", target: "probe.expression", value: "y" }], { expression: "x", k: 1 }),
    ).toEqual({ expression: "y", k: 1 });
    expect(apply([{ op: "set", target: "probe.expression", value: null }])).toEqual({});
  });

  test("an add, a remove and a move fail, naming the operation and the change", () => {
    const refused = (change: Change, word: string) => expect(() => apply([change])).toThrow(word);
    refused({ op: "add", target: "probe.e", value: {} }, "add");
    refused({ op: "remove", target: "probe.e" }, "remove");
    refused({ op: "move", target: "probe.e" }, "move");
  });

  test("a set of a field the shape does not name fails, naming the target", () => {
    expect(() => apply([{ op: "set", target: "probe.display", value: true }])).toThrow(
      '"probe.display"',
    );
    expect(() => apply([{ op: "set", target: "probe.expression.deep", value: 1 }])).toThrow(
      "probe.expression.deep",
    );
  });

  test("a target that addresses another item fails", () => {
    expect(() => apply([{ op: "set", target: "other.expression", value: "y" }])).toThrow('"probe"');
  });

  test("an unknown operation fails", () => {
    expect(() => apply([{ op: "swap", target: "probe.expression" } as unknown as Change])).toThrow(
      "swap",
    );
  });

  test("a change never reaches a prototype: __proto__ is set as an own key", () => {
    const shape: FieldsShape = { fields: ["__proto__"] };
    const applied = applyElementChanges(
      ITEM,
      {},
      [{ op: "set", target: "probe.__proto__", value: { polluted: true } }],
      shape,
    );
    expect(Object.hasOwn(applied, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(applied)).toBe(Object.prototype);
    expect(({} as Value).polluted).toBeUndefined();
  });
});
