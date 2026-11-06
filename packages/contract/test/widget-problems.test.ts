import { describe, expect, test } from "bun:test";
import { ERROR_TEXT_MAX_CHARS } from "../src/constants.ts";
import { type RequestProblem, validateAskRequest, validateUpdateRequest } from "../src/validate.ts";

// Widget props problems for the agent (widget-answers, task 1.3; contract spec: Widget props
// problems for the agent): a Tree's and a Gantt's props refused with problems worded as every
// request problem is, naming the item, the element and the field, in document order.
type Item = { type: string; id: string; props: Record<string, unknown> };

const question = (id: string, items: Item[]): Item => ({
  type: "question",
  id,
  props: { text: `Question ${id}?`, items },
});
const ask = (...items: Item[]) => ({ askId: "widget-ask-a1b2", items });
const problemsOf = (value: unknown): readonly RequestProblem[] => {
  const checked = validateAskRequest(value);
  return checked.ok ? [] : checked.problems;
};
const tree = (id: string, nodes: unknown[], extra: Record<string, unknown> = {}): Item => ({
  type: "tree",
  id,
  props: { nodes, ...extra },
});
const gantt = (id: string, props: Record<string, unknown>): Item => ({ type: "gantt", id, props });

const ESTIMATES = ["optimistic", "mostLikely", "pessimistic"].map((field) => ({
  field,
  label: field,
  type: "number",
}));
const planTree = (id: string): Item =>
  tree(id, [{ id: "ux", label: "UX", optimistic: 1, mostLikely: 2, pessimistic: 3 }], {
    columns: ESTIMATES,
    pert: true,
  });
const plan = (id: string, tasks: Record<string, unknown> = {}): Item =>
  gantt(id, { start: "2026-11-02", workPackages: "wbs", tasks });

describe("a Tree's props refused", () => {
  test("a node without a label names the item, the node, the field and what a node holds", () => {
    const problems = problemsOf(ask(question("q", [tree("wbs", [{ id: "ux" }])])));
    expect(problems).toHaveLength(1);
    const [problem] = problems;
    expect(problem?.itemId).toBe("wbs");
    expect(problem?.field).toBe("props.nodes[0].label");
    expect(problem?.message).toContain('item "wbs"');
    expect(problem?.message).toContain('node "ux"');
    expect(problem?.message).toContain("props.nodes[0].label is required");
    expect(problem?.expected).toBe("text of 1 to 200 characters");
  });

  test("a child's field reads as a node's, at any depth", () => {
    const nodes = [
      { id: "a", label: "A", children: [{ id: "b", label: "B", children: [{ id: "c" }] }] },
    ];
    const [problem] = problemsOf(ask(question("q", [tree("wbs", nodes)])));
    expect(problem?.field).toBe("props.nodes[0].children[0].children[0].label");
    expect(problem?.message).toContain('node "c"');
    expect(problem?.expected).toBe("text of 1 to 200 characters");
  });

  test("a field no column declares is refused at the node's field", () => {
    const nodes = [{ id: "ux", label: "UX", cost: 3 }];
    const [problem] = problemsOf(ask(question("q", [tree("wbs", nodes)])));
    expect(problem?.itemId).toBe("wbs");
    expect(problem?.field).toBe("props.nodes[0].cost");
    expect(problem?.message).toContain("cost");
    expect(problem?.expected).toContain("column");
  });

  test("a widget check's problem is located under its item", () => {
    const nodes = [
      { id: "a", label: "A" },
      { id: "a", label: "B" },
    ];
    const [problem] = problemsOf(ask(question("q", [tree("wbs", nodes)])));
    expect(problem?.itemId).toBe("wbs");
    expect(problem?.path).toBe("/items/0/props/items/0/props/nodes/1/id");
    expect(problem?.message).toContain('item "wbs"');
  });

  test("a Tree's props with an unknown field list the fields it holds", () => {
    const item = tree("wbs", [{ id: "a", label: "A" }], { colour: "red" });
    const [problem] = problemsOf(ask(question("q", [item])));
    expect(problem?.message).toContain("props.colour is not accepted");
    expect(problem?.message).toContain("columns, nodes, pert and openDepth");
  });
});

describe("a Gantt's props refused", () => {
  test("a predecessor with the reserved prefix names the Gantt, the task and the prefix", () => {
    const tasks = [
      { id: "t1", label: "One", duration: 2 },
      { id: "t2", label: "Two", duration: 2, dependencies: ["u-3"] },
    ];
    const problems = problemsOf(
      ask(question("q", [gantt("sched", { start: "2026-11-02", tasks })])),
    );
    expect(problems.length).toBeGreaterThan(0);
    const [problem] = problems;
    expect(problem?.itemId).toBe("sched");
    expect(problem?.message).toContain('item "sched"');
    expect(problem?.message).toContain("t2");
    expect(problem?.message).toContain("u-");
    expect(problem?.message).toContain("reserved");
  });

  test("a plan whose Tree is missing names the plan and the Tree", () => {
    const [problem] = problemsOf(ask(question("q", [plan("sched")])));
    expect(problem?.itemId).toBe("sched");
    expect(problem?.field).toBe("props.workPackages");
    expect(problem?.message).toContain("plan sched");
    expect(problem?.message).toContain("wbs");
  });

  test("a plan whose Tree is in another question is refused as if its own held none", () => {
    const value = ask(question("tree-q", [planTree("wbs")]), question("plan-q", [plan("sched")]));
    const [problem] = problemsOf(value);
    expect(problem?.itemId).toBe("sched");
    expect(problem?.message).toContain("plan sched");
    expect(problem?.message).toContain("name no item of its question");
  });

  test("a plan beside its Tree passes", () => {
    const value = ask(question("q", [planTree("wbs"), plan("sched")]));
    expect(validateAskRequest(value).ok).toBe(true);
  });

  test("a task's duration out of range names the task and what a duration is", () => {
    const tasks = [{ id: "t1", label: "One", duration: 0 }];
    const [problem] = problemsOf(
      ask(question("q", [gantt("sched", { start: "2026-11-02", tasks })])),
    );
    expect(problem?.field).toBe("props.tasks[0].duration");
    expect(problem?.message).toContain('task "t1"');
    expect(problem?.expected).toContain("working days");
  });

  test("a plan entry with an unknown field names the task by its ID", () => {
    const value = ask(question("q", [planTree("wbs"), plan("sched", { ux: { colour: "red" } })]));
    const [problem] = problemsOf(value);
    expect(problem?.message).toContain('task "ux"');
    expect(problem?.message).toContain("colour is not accepted");
    expect(problem?.message).toContain("start and dependencies");
  });
});

describe("order and size", () => {
  test("problems of several items come in document order", () => {
    const first = tree("wbs", [{ id: "a" }]);
    const second = gantt("sched", {
      start: "2026-11-02",
      tasks: [{ id: "t", label: "T", duration: 0 }],
    });
    const problems = problemsOf(ask(question("q1", [first]), question("q2", [second])));
    expect(problems.map(({ itemId }) => itemId)).toEqual(["wbs", "sched"]);
  });

  test("a Tree at its limits keeps every problem under the error limit", () => {
    const id = "n".repeat(64);
    const label = "L".repeat(200);
    const nodes = Array.from({ length: 500 }, (_, index) => ({
      id: `${id.slice(0, 60)}${String(index).padStart(4, "0")}`,
      label,
      cost: 1,
    }));
    const problems = problemsOf(ask(question("q", [tree("t".repeat(64), nodes)])));
    expect(problems.length).toBeGreaterThan(0);
    for (const { message, expected } of problems) {
      expect(message.length).toBeLessThan(ERROR_TEXT_MAX_CHARS);
      expect(expected.length).toBeLessThan(ERROR_TEXT_MAX_CHARS);
    }
  });
});

describe("an added item", () => {
  const added = (item: Item) => ({
    askId: "widget-ask-a1b2",
    actions: [{ action: "add", item }],
  });

  test("an added Tree's problems are the ask's", () => {
    const checked = validateUpdateRequest(added(question("q2", [tree("wbs", [{ id: "ux" }])])));
    expect(checked.ok).toBe(false);
    const problems = checked.ok ? [] : checked.problems;
    expect(problems[0]?.message).toContain("label is required");
  });

  test("an added plan whose Tree is missing is refused", () => {
    const checked = validateUpdateRequest(added(question("q2", [plan("sched")])));
    expect(checked.ok).toBe(false);
    const problems = checked.ok ? [] : checked.problems;
    expect(problems[0]?.message).toContain("plan sched");
  });

  test("an added question with a valid Tree and plan passes", () => {
    const checked = validateUpdateRequest(added(question("q2", [planTree("wbs"), plan("sched")])));
    expect(checked.ok).toBe(true);
  });
});
