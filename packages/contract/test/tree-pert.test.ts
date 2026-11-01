import { describe, expect, test } from "bun:test";
import { treeBoardDocument, treeEditedValue } from "../src/fixtures/index.ts";
import {
  TREE_MAX_DEPTH,
  TREE_PERT_MAX_ESTIMATE,
  type TreeNode,
  type TreePertProps,
  treePropsProblems,
} from "../src/index.ts";
import { validateTreeProps } from "../src/validate.ts";

// The Tree's PERT props (molecules design decision 8; contract spec, "Tree PERT props"): `pert`
// makes a Tree a work breakdown whose estimates are working days from 0 to 100,000, and
// `openDepth`, from 1 to 8, comes only with it. The schema says the props' own types; the checks
// say the rest, and say it too for the props the Tree's chunk reads, which no schema has seen.

type Json = Record<string, unknown>;

const [question] = treeBoardDocument.items;
const [tree] = question.props.items;
const uj2: TreePertProps = { ...tree.props, pert: true, openDepth: 2 };

const withNodes = (nodes: readonly TreeNode[], props: Json = {}): Json => ({
  columns: tree.props.columns,
  nodes,
  pert: true,
  ...props,
});
const leaf = (estimates: Readonly<Record<string, number>>): TreeNode => ({
  id: "ux",
  label: "UX design",
  ...estimates,
});

describe("a Tree with pert", () => {
  test("the UJ-2 work breakdown with pert and openDepth 2 passes, as agent and as edited value", () => {
    expect(validateTreeProps(uj2, "agent")).toEqual({ ok: true, value: uj2 });
    const edited: TreePertProps = { ...treeEditedValue, pert: true, openDepth: 2 };
    expect(validateTreeProps(edited, "edited")).toEqual({ ok: true, value: edited });
  });

  test("without a pessimistic column it fails, naming pert and pessimistic", () => {
    const columns = tree.props.columns?.filter(({ field }) => field !== "pessimistic");
    const nodes = [leaf({ optimistic: 1, mostLikely: 2 })];
    expect(validateTreeProps({ columns, nodes, pert: true }, "agent")).toEqual({
      ok: false,
      reason: "schema",
      problems: [
        {
          path: "/pert",
          message:
            'a work breakdown with pert declares "pessimistic" as a number column, and no column declares it',
        },
      ],
    });
  });

  test("an estimate declared as text fails, naming pert and the field", () => {
    const columns = (tree.props.columns ?? []).map((column) =>
      column.field === "optimistic" ? { ...column, type: "text" as const } : column,
    );
    expect(treePropsProblems({ columns, nodes: [], pert: true }, "agent")).toEqual([
      {
        path: "/pert",
        message:
          'a work breakdown with pert declares "optimistic" as a number column, and its column is text',
      },
    ]);
  });

  test("with no columns at all it names each estimate", () => {
    const problems = treePropsProblems({ nodes: [], pert: true }, "agent");
    expect(problems.map(({ path }) => path)).toEqual(["/pert", "/pert", "/pert"]);
    expect(problems.map(({ message }) => message.split('"')[1])).toEqual([
      "optimistic",
      "mostLikely",
      "pessimistic",
    ]);
  });

  test("a negative estimate fails, naming the node and the field", () => {
    const nodes = [{ id: "design", label: "Design", children: [leaf({ optimistic: -2 })] }];
    expect(validateTreeProps(withNodes(nodes), "agent")).toEqual({
      ok: false,
      reason: "schema",
      problems: [
        {
          path: "/nodes/0/children/0/optimistic",
          message:
            'the estimate "optimistic" of the node "ux" is -2, where an estimate is 0 to 100,000 working days',
        },
      ],
    });
  });

  test("an estimate over 100,000 fails; 0 and 100,000 pass", () => {
    expect(TREE_PERT_MAX_ESTIMATE).toBe(100_000);
    const over = treePropsProblems(withNodes([leaf({ pessimistic: 100_001 })]), "agent");
    expect(over).toEqual([
      {
        path: "/nodes/0/pessimistic",
        message:
          'the estimate "pessimistic" of the node "ux" is 100001, where an estimate is 0 to 100,000 working days',
      },
    ]);
    const bounds = withNodes([leaf({ optimistic: 0, mostLikely: 0.5, pessimistic: 100_000 })]);
    expect(treePropsProblems(bounds, "agent")).toEqual([]);
  });

  test("estimates are unordered: an optimistic value above the pessimistic one passes", () => {
    const nodes = [leaf({ optimistic: 9, mostLikely: 5, pessimistic: 2 })];
    expect(treePropsProblems(withNodes(nodes), "agent")).toEqual([]);
  });

  test("a parent holding its own estimates passes, as agent and as edited value", () => {
    const parent = {
      id: "design",
      label: "Design",
      optimistic: 1,
      mostLikely: 2,
      pessimistic: 3,
      children: [leaf({ optimistic: 3, mostLikely: 5, pessimistic: 10 })],
    };
    for (const origin of ["agent", "edited"] as const) {
      expect(validateTreeProps(withNodes([parent]), origin).ok).toBe(true);
    }
  });

  test("a field that is no estimate keeps its own rules, with no range", () => {
    const columns = [
      ...(tree.props.columns ?? []),
      { field: "cost", label: "Cost", type: "number" },
    ];
    const nodes = [leaf({ cost: -500 })];
    expect(treePropsProblems({ columns, nodes, pert: true }, "agent")).toEqual([]);
  });
});

describe("pert and openDepth themselves", () => {
  test("openDepth on a Tree without pert fails, saying that it needs pert", () => {
    const plain = { ...tree.props, openDepth: 2 };
    const problem = {
      path: "/openDepth",
      message: "openDepth needs pert: a Tree without pert opens fully expanded",
    };
    expect(validateTreeProps(plain, "agent")).toEqual({
      ok: false,
      reason: "schema",
      problems: [problem],
    });
  });

  test("openDepth 9, 0 or 1.5 fails, naming openDepth; 1 to 8 pass", () => {
    for (const openDepth of [9, 0, 1.5, "2"]) {
      const props = { ...uj2, openDepth };
      const checked = validateTreeProps(props, "agent");
      expect(checked.ok).toBe(false);
      expect(checked.ok ? [] : checked.problems.map(({ path }) => path)).toEqual(["/openDepth"]);
      expect(treePropsProblems(props, "agent")).toEqual([
        {
          path: "/openDepth",
          message: `openDepth is a whole number of levels from 1 to ${TREE_MAX_DEPTH}`,
        },
      ]);
    }
    for (let openDepth = 1; openDepth <= TREE_MAX_DEPTH; openDepth += 1) {
      expect(validateTreeProps({ ...uj2, openDepth }, "agent").ok).toBe(true);
    }
  });

  test("pert false, or anything but true, fails, naming pert", () => {
    for (const pert of [false, "true", 1]) {
      const props = { ...tree.props, pert };
      const checked = validateTreeProps(props, "agent");
      expect(checked.ok ? [] : checked.problems.map(({ path }) => path)).toEqual(["/pert"]);
      expect(treePropsProblems(props, "agent")).toEqual([
        { path: "/pert", message: "pert is true when given: a Tree without it computes nothing" },
      ]);
    }
  });

  test("a plain Tree is checked as before: no estimate range and no estimate column needed", () => {
    expect(treePropsProblems(tree.props, "agent")).toEqual([]);
    const nodes = [leaf({ optimistic: -2 })];
    expect(treePropsProblems({ columns: tree.props.columns, nodes }, "agent")).toEqual([]);
    expect(treePropsProblems({ nodes: [] }, "agent")).toEqual([]);
  });

  test("garbage under pert is reported by the Tree's own checks and never throws", () => {
    const nodes = [
      null,
      { id: "a", label: "A", children: "none" },
      { id: "b", label: "B", children: [7] },
    ];
    expect(() => treePropsProblems({ pert: true, nodes, columns: "none" }, "agent")).not.toThrow();
  });
});
