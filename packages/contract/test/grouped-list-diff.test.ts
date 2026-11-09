import { describe, expect, test } from "bun:test";
import {
  applyElementChanges,
  type Change,
  type ElementShape,
  elementChanges,
  SCHEMA_IDS,
} from "../src/index.ts";
import { validateAgainst } from "../src/validate.ts";

// The grouped flat list of the generic diff (kanban-order, design decision 1; contract spec,
// "Grouped lists in the generic diff" and "The inverse of a grouped list"), over a test-only probe
// shape: a list of `cards` whose elements name their group in `column`, order counting within a
// group only.
const ITEM = "probe";
const GROUPED: ElementShape = { elements: "cards", group: "column" };
const CHANGE = `${SCHEMA_IDS.answerEvent}#/$defs/change`;

type Card = { id: string; column: unknown; [key: string]: unknown };
type Value = { cards: Card[] };

// "a:todo" is the card `a` in the group `todo`.
const list = (...specs: string[]): Value => ({
  cards: specs.map((spec) => {
    const [id = "", column = ""] = spec.split(":");
    return { id, column };
  }),
});

const validated = (changes: readonly Change[]): readonly Change[] => {
  for (const change of changes) {
    const checked = validateAgainst(CHANGE, change);
    expect({ change, ok: checked.ok }).toEqual({ change, ok: true });
  }
  return changes;
};
const diff = (sent: Value, edited: Value): readonly Change[] =>
  validated(elementChanges(ITEM, sent, edited, GROUPED));
const apply = (sent: Value, changes: readonly Change[]): Value =>
  applyElementChanges(ITEM, sent, changes, GROUPED);

// The IDs of one group, in the list's order.
const orderOf = (value: Value, group: string): string[] =>
  value.cards.filter((card) => card.column === group).map(({ id }) => id);

describe("the diff of a grouped list", () => {
  test("a group reordered gives one move naming the in-group predecessor, or none for the first", () => {
    const sent = list("a:todo", "x:doing", "b:todo", "c:todo", "y:doing", "d:todo", "z:doing");
    // `a` goes last in `todo`: after `d`, whatever stands between them in the flat list.
    const last = list("x:doing", "b:todo", "c:todo", "y:doing", "d:todo", "z:doing", "a:todo");
    expect(diff(sent, last)).toEqual([{ op: "move", target: "probe.a", after: "d" }]);
    // `d` goes first in `todo`: no `after`.
    const first = list("d:todo", "a:todo", "x:doing", "b:todo", "c:todo", "y:doing", "z:doing");
    expect(diff(sent, first)).toEqual([{ op: "move", target: "probe.d" }]);
    // `c` goes between `a` and `b`: after `a`, though `x` follows `a` in the flat list.
    const between = list("a:todo", "c:todo", "x:doing", "b:todo", "y:doing", "d:todo", "z:doing");
    expect(diff(sent, between)).toEqual([{ op: "move", target: "probe.c", after: "a" }]);
    for (const edited of [last, first, between]) {
      expect(orderOf(apply(sent, diff(sent, edited)), "todo")).toEqual(orderOf(edited, "todo"));
    }
  });

  test("the cards of a reordered group that keep their order stay put", () => {
    const sent = list("a:todo", "b:todo", "c:todo");
    const edited = list("c:todo", "a:todo", "b:todo");
    const changes = diff(sent, edited);
    expect(changes).toEqual([{ op: "move", target: "probe.c" }]);
    expect(apply(sent, changes)).toEqual(edited);
  });

  test("a group whose cards keep order and group gives no change, interleaved with a reordered group's", () => {
    const sent = list("a:todo", "x:doing", "b:todo", "y:doing", "c:todo", "z:doing");
    const edited = list("x:doing", "c:todo", "y:doing", "a:todo", "z:doing", "b:todo");
    const changes = diff(sent, edited);
    expect(changes.length).toBeGreaterThan(0);
    for (const change of changes) expect(change.target).toMatch(/^probe\.[abc]$/);
    expect(orderOf(apply(sent, changes), "todo")).toEqual(["c", "a", "b"]);
    expect(orderOf(apply(sent, changes), "doing")).toEqual(["x", "y", "z"]);
  });

  test("a group a card only left gives no change of its own, and an untouched list none at all", () => {
    const sent = list("a:todo", "b:todo", "c:todo", "x:doing");
    expect(diff(sent, sent)).toEqual([]);
    // `b` leaves `todo` for `doing`, ahead of `x`, where the sent order puts it: one `set`.
    const edited = list("a:todo", "c:todo", "b:doing", "x:doing");
    const changes = diff(sent, edited);
    expect(changes.map(({ target }) => target)).toEqual(["probe.b.column"]);
  });

  test("a card moved to another group where its sent index puts it gives one set", () => {
    const sent = list("a:todo", "b:todo", "x:doing", "y:doing");
    const edited = list("a:todo", "b:doing", "x:doing", "y:doing");
    const changes = diff(sent, edited);
    expect(changes).toEqual([{ op: "set", target: "probe.b.column", value: "doing" }]);
    expect(apply(sent, changes)).toEqual(edited);
  });

  test("a card placed elsewhere in another group gives its set, then its move", () => {
    const sent = list("x:doing", "a:todo", "b:todo", "y:doing");
    const top = list("a:todo", "b:doing", "x:doing", "y:doing");
    const changes = diff(sent, top);
    expect(changes).toEqual([
      { op: "set", target: "probe.b.column", value: "doing" },
      { op: "move", target: "probe.b" },
    ]);
    expect(orderOf(apply(sent, changes), "doing")).toEqual(["b", "x", "y"]);
    const afterX = list("x:doing", "y:doing", "a:todo", "b:todo");
    const placedAfterX = list("a:todo", "x:doing", "b:doing", "y:doing");
    const [set, move, ...rest] = diff(afterX, placedAfterX);
    expect(rest).toEqual([]);
    expect(set).toEqual({ op: "set", target: "probe.b.column", value: "doing" });
    expect(move).toEqual({ op: "move", target: "probe.b", after: "x" });
  });

  test("the sets of a card come before its move, a field's set among them", () => {
    const sent: Value = {
      cards: [
        { id: "a", column: "todo", label: "A" },
        { id: "b", column: "todo", label: "B" },
      ],
    };
    const edited: Value = {
      cards: [
        { id: "b", column: "todo", label: "B2" },
        { id: "a", column: "todo", label: "A" },
      ],
    };
    const changes = diff(sent, edited);
    expect(changes).toEqual([
      { op: "set", target: "probe.b.label", value: "B2" },
      { op: "move", target: "probe.b" },
    ]);
  });

  test("an add names its in-group predecessor, a remove is as in a flat list", () => {
    const sent = list("a:todo", "x:doing", "b:todo");
    const added = list("a:todo", "x:doing", "n:todo", "b:todo", "m:doing");
    const changes = diff(sent, added);
    // The groups in the order of their names: `doing`, then `todo`.
    expect(changes).toEqual([
      { op: "add", target: "probe.m", after: "x", value: { column: "doing" } },
      { op: "add", target: "probe.n", after: "a", value: { column: "todo" } },
    ]);
    // Each group's order is the edited one; the flat interleaving of the groups is the inverse's own.
    for (const group of ["todo", "doing"]) {
      expect(orderOf(apply(sent, changes), group)).toEqual(orderOf(added, group));
    }
    const first = list("n:todo", "a:todo", "x:doing", "b:todo");
    expect(diff(sent, first)).toEqual([
      { op: "add", target: "probe.n", value: { column: "todo" } },
    ]);
    const removed = list("a:todo", "b:todo");
    expect(diff(sent, removed)).toEqual([{ op: "remove", target: "probe.x" }]);
    expect(apply(sent, diff(sent, removed))).toEqual(removed);
  });

  test("a group value that is an inherited object name is a group like any other", () => {
    const sent = list("a:__proto__", "b:constructor", "c:__proto__", "d:toString", "e:__proto__");
    const edited = list(
      "c:__proto__",
      "e:__proto__",
      "b:__proto__",
      "a:__proto__",
      "d:constructor",
    );
    const changes = diff(sent, edited);
    const rebuilt = apply(sent, changes);
    for (const group of ["__proto__", "constructor", "toString"]) {
      expect(orderOf(rebuilt, group), group).toEqual(orderOf(edited, group));
    }
    expect(Object.getPrototypeOf(rebuilt)).toBe(Object.prototype);
    expect(diff(sent, rebuilt)).toEqual(changes);
  });

  test("the inputs stay untouched and the output is frozen", () => {
    const sent = Object.freeze(list("a:todo", "b:todo"));
    const edited = Object.freeze(list("b:todo", "a:todo"));
    const changes = elementChanges(ITEM, sent, edited, GROUPED);
    expect(Object.isFrozen(changes)).toBe(true);
    expect(Object.isFrozen(apply(sent, changes))).toBe(true);
  });

  test("a card whose group is no string is refused, naming the card", () => {
    const sent = list("a:todo", "b:todo");
    const edited: Value = {
      cards: [
        { id: "b", column: 3 },
        { id: "a", column: "todo" },
      ],
    };
    expect(() => elementChanges(ITEM, sent, edited, GROUPED)).toThrow(/"b"/);
  });
});

describe("the inverse of a grouped list", () => {
  const sent = list("a:todo", "x:doing", "b:todo", "y:doing");
  const refusal = (changes: Change[]) => {
    try {
      apply(sent, changes);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    return undefined;
  };

  test("a move or an add goes right after its after, or first without one", () => {
    expect(
      apply(sent, [{ op: "move", target: "probe.b", after: "a" }]).cards.map(({ id }) => id),
    ).toEqual(["a", "b", "x", "y"]);
    expect(apply(sent, [{ op: "move", target: "probe.b" }]).cards.map(({ id }) => id)).toEqual([
      "b",
      "a",
      "x",
      "y",
    ]);
    const added = apply(sent, [
      { op: "add", target: "probe.n", after: "b", value: { column: "todo" } },
    ]);
    expect(added.cards.map(({ id }) => id)).toEqual(["a", "x", "b", "n", "y"]);
  });

  test("an after in another group fails, naming the operation", () => {
    expect(refusal([{ op: "move", target: "probe.a", after: "x" }])).toContain(
      'change 1 (move "probe.a")',
    );
    expect(
      refusal([{ op: "add", target: "probe.n", after: "x", value: { column: "todo" } }]),
    ).toContain('change 1 (add "probe.n")');
  });

  test("an after in the group the card's own set just gave it holds", () => {
    const placed = apply(sent, [
      { op: "set", target: "probe.a.column", value: "doing" },
      { op: "move", target: "probe.a", after: "x" },
    ]);
    expect(orderOf(placed, "doing")).toEqual(["x", "a", "y"]);
    // The same move before the set names a card of another group at that point.
    expect(
      refusal([
        { op: "move", target: "probe.a", after: "x" },
        { op: "set", target: "probe.a.column", value: "doing" },
      ]),
    ).toContain('change 1 (move "probe.a")');
  });

  test("an after equal to the card, an unknown after and a missing card fail", () => {
    expect(refusal([{ op: "move", target: "probe.a", after: "a" }])).toContain(
      'change 1 (move "probe.a")',
    );
    expect(refusal([{ op: "move", target: "probe.a", after: "nope" }])).toContain(
      'change 1 (move "probe.a")',
    );
    expect(refusal([{ op: "move", target: "probe.nope", after: "a" }])).toContain(
      'change 1 (move "probe.nope")',
    );
  });

  test("a card whose group is no string fails, in a move and in an add", () => {
    const odd: Value = {
      cards: [
        { id: "a", column: 3 },
        { id: "b", column: "todo" },
      ],
    };
    expect(() =>
      applyElementChanges(ITEM, odd, [{ op: "move", target: "probe.b", after: "a" }], GROUPED),
    ).toThrow('change 1 (move "probe.b")');
    expect(() =>
      applyElementChanges(ITEM, odd, [{ op: "move", target: "probe.a" }], GROUPED),
    ).toThrow('change 1 (move "probe.a")');
    expect(() => apply(sent, [{ op: "add", target: "probe.n", value: { column: 3 } }])).toThrow(
      'change 1 (add "probe.n")',
    );
  });

  test("a parent fails, a grouped list being flat", () => {
    expect(refusal([{ op: "move", target: "probe.a", parent: "b" }])).toContain(
      'change 1 (move "probe.a")',
    );
  });
});

describe("a grouped list that also names children", () => {
  const TREE = { elements: "cards", group: "column", children: "sub" } as ElementShape;
  const value = list("a:todo");

  test("the diff and the inverse fail, saying a grouped list is flat", () => {
    expect(() => elementChanges(ITEM, value, value, TREE)).toThrow("a grouped list is flat");
    expect(() => applyElementChanges(ITEM, value, [], TREE)).toThrow("a grouped list is flat");
  });
});

// mulberry32, a small seeded generator (as element-diff-property.test.ts).
const generator = (seed: number) => {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (count: number): number => Math.floor(next() * count);
  return { int };
};

// The same edit the board makes: the card goes into `group`, right after the group's `slot`-th
// card among the others (before the first for slot 0), so that the edited flat order interleaves
// the groups as the user left them.
const placed = (value: Value, id: string, group: string, slot: number): Value => {
  const moving = value.cards.find((card) => card.id === id) as Card;
  const rest = value.cards.filter((card) => card.id !== id);
  const members = rest.filter((card) => card.column === group);
  const at =
    members.length === 0
      ? rest.length
      : slot === 0
        ? rest.indexOf(members[0] as Card)
        : rest.indexOf(members[Math.min(slot, members.length) - 1] as Card) + 1;
  return { cards: [...rest.slice(0, at), { ...moving, column: group }, ...rest.slice(at)] };
};

const randomValue = (
  random: ReturnType<typeof generator>,
  count: number,
  groups: number,
): Value => ({
  cards: Array.from({ length: count }, (_, at) => ({
    id: `c${at}`,
    column: `g${random.int(groups)}`,
  })),
});

// What makes the changes a grouped list's: each `after` is the preceding card of the card's own
// group in the edited value, and no change names a card of a group whose members and order the user
// kept.
const groupedChangesProblems = (
  sent: Value,
  edited: Value,
  changes: readonly Change[],
  at: string,
) => {
  const groups = new Set(sent.cards.map((card) => card.column as string));
  for (const card of edited.cards) groups.add(card.column as string);
  const kept = new Set(
    [...groups].filter(
      (group) => JSON.stringify(orderOf(sent, group)) === JSON.stringify(orderOf(edited, group)),
    ),
  );
  const groupOf = (id: string) => edited.cards.find((card) => card.id === id)?.column as string;
  for (const change of changes) {
    const id = change.target.split(".")[1] as string;
    if (change.op === "move" || change.op === "add") {
      const members = orderOf(edited, groupOf(id));
      const before = members[members.indexOf(id) - 1];
      expect(change.after, `${at}: ${change.op} of ${id}`).toBe(before);
    }
    if (change.op === "move") expect(kept.has(groupOf(id)), `${at}: move of ${id}`).toBe(false);
  }
};

// Runs `edits` random edits from `sent`, each against the same sent value, and checks the round trip
// of each: the changes rebuild every group's order, and the diff of the rebuilt value gives the
// same changes, so that the rebuilt value is the one the board can hold and ask-core can take back.
const roundTrips = (seed: number, count: number, groups: number, edits: number) => {
  const random = generator(seed);
  const sent = randomValue(random, count, groups);
  let edited = sent;
  for (let edit = 0; edit < edits; edit += 1) {
    const card = edited.cards[random.int(count)] as Card;
    edited = placed(edited, card.id, `g${random.int(groups)}`, random.int(count));
    const changes = diff(sent, edited);
    groupedChangesProblems(sent, edited, changes, `seed ${seed} edit ${edit}`);
    const rebuilt = apply(sent, changes);
    for (let group = 0; group < groups; group += 1) {
      expect(orderOf(rebuilt, `g${group}`), `seed ${seed} edit ${edit} group ${group}`).toEqual(
        orderOf(edited, `g${group}`),
      );
    }
    expect(diff(sent, rebuilt), `seed ${seed} edit ${edit}: the rebuilt value's changes`).toEqual(
      changes,
    );
    expect(apply(sent, diff(sent, rebuilt)), `seed ${seed} edit ${edit}: a fixed point`).toEqual(
      rebuilt,
    );
  }
};

describe("the round trip of a grouped list", () => {
  test("200 cards in 12 groups, 500 edits of moves within and between groups", () => {
    roundTrips(79, 200, 12, 500);
  });

  test("small lists in few groups, where the edits interleave most", () => {
    for (let seed = 1; seed <= 60; seed += 1) roundTrips(seed, 6 + (seed % 7), 2 + (seed % 3), 30);
  });

  test("reversing two interleaved groups gives changes that rebuild a value they rebuild again", () => {
    const sent = list("a1:a", "a2:a", "b1:b", "b2:b");
    const edited = list("b2:b", "b1:b", "a2:a", "a1:a");
    const changes = diff(sent, edited);
    // The scenario's own changes: a move of a2, then a move of b2.
    expect(changes).toEqual([
      { op: "move", target: "probe.a2" },
      { op: "move", target: "probe.b2" },
    ]);
    const rebuilt = apply(sent, changes);
    expect(orderOf(rebuilt, "a")).toEqual(["a2", "a1"]);
    expect(orderOf(rebuilt, "b")).toEqual(["b2", "b1"]);
    expect(diff(sent, rebuilt)).toEqual(changes);
    expect(apply(sent, diff(sent, rebuilt))).toEqual(rebuilt);
  });

  test("the changes do not depend on how the edited list interleaves the groups", () => {
    const sent = list("a1:a", "a2:a", "b1:b", "b2:b");
    const one = list("b2:b", "b1:b", "a2:a", "a1:a");
    const other = list("a2:a", "b2:b", "a1:a", "b1:b");
    expect(diff(sent, other)).toEqual(diff(sent, one));
  });
});
