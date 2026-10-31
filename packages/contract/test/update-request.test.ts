import { describe, expect, test } from "bun:test";
import { SCHEMA_IDS } from "../src/index.ts";
import {
  type RequestProblem,
  validateAgainst,
  validateFetchRequest,
  validateUpdateRequest,
} from "../src/validate.ts";

// The update request (contract spec: The update request): actions applied in order, each holding
// only the fields it uses; a refusal names the action's index. And the fetch request.
const question = (id: string, props: Record<string, unknown> = {}) => ({
  type: "question",
  id,
  props: { text: `Question ${id}?`, options: [{ label: "Yes" }, { label: "No" }], ...props },
});

const ACTIONS = {
  add: { action: "add", item: question("q4"), parentId: "scope", after: "q2" },
  change: { action: "change", itemId: "q2", props: { text: "Which region?" } },
  delete: { action: "delete", itemId: "q3" },
  reopen: { action: "reopen", itemId: "q1" },
  answer: {
    action: "answer",
    itemId: "erp-export",
    answer: { choice: ["Yes"], other: "Only the invoices", note: "Said in the terminal." },
  },
  reply: { action: "reply", itemId: "q2", followUp: "k3x9.4", text: "Because of the GDPR rule." },
  close: { action: "close" },
} as const;

const update = (...actions: readonly object[]) => ({ askId: "checkout-plan-p8r3", actions });

const problemsOf = (value: unknown): readonly RequestProblem[] => {
  const checked = validateUpdateRequest(value);
  return checked.ok ? [] : checked.problems;
};
const only = (value: unknown): RequestProblem => {
  const problems = problemsOf(value);
  expect(problems).toHaveLength(1);
  return problems[0] as RequestProblem;
};

describe("the update request", () => {
  test("a request of every action, in order, passes, and passes the tool's generic schema", () => {
    const value = update(...Object.values(ACTIONS));
    expect(validateUpdateRequest(value)).toEqual({ ok: true, value: value as never });
    expect(validateAgainst(SCHEMA_IDS.updateRequest, value).ok).toBe(true);
  });

  test.each(Object.entries(ACTIONS))("a lone %s action passes", (_, action) => {
    expect(validateUpdateRequest(update(action)).ok).toBe(true);
  });

  test("adding a question to an area, or an area or a question at the top level, passes", () => {
    const area = {
      type: "area",
      id: "rollout",
      props: { title: "Rollout", items: [question("q9")] },
    };
    for (const action of [
      { action: "add", item: question("q4"), parentId: "scope" },
      { action: "add", item: question("q0") },
      { action: "add", item: area, after: "scope" },
    ]) {
      expect({ action, ok: validateUpdateRequest(update(action)).ok }).toEqual({
        action,
        ok: true,
      });
    }
  });

  test.each([
    ["add", { ...ACTIONS.add, itemId: "q4" }, "itemId", "action, item, parentId and after"],
    ["change", { ...ACTIONS.change, item: question("q2") }, "item", "action, itemId and props"],
    ["delete", { ...ACTIONS.delete, props: {} }, "props", "action and itemId"],
    ["reopen", { ...ACTIONS.reopen, answer: {} }, "answer", "action and itemId"],
    ["answer", { ...ACTIONS.answer, text: "x" }, "text", "action, itemId and answer"],
    ["reply", { ...ACTIONS.reply, props: {} }, "props", "action, itemId, followUp and text"],
    ["close", { ...ACTIONS.close, itemId: "q1" }, "itemId", "only action"],
  ])(
    "a %s action with a field it does not use is refused, naming the action's index",
    (_, action, field, allowed) => {
      const problem = only(update(ACTIONS.delete, action));
      expect(problem).toMatchObject({ path: `/actions/1/${field}`, field: `actions[1].${field}` });
      expect(problem.message).toStartWith(`actions[1].${field} is not accepted`);
      expect(problem.expected).toContain(allowed);
      expect(problem.itemId).toBeUndefined();
    },
  );

  test("a reply without its follow-up is refused, naming the index and saying followUp is required", () => {
    const { followUp: _, ...noFollowUp } = ACTIONS.reply;
    const problem = only(update(noFollowUp));
    expect(problem).toMatchObject({ path: "/actions/0/followUp", field: "actions[0].followUp" });
    expect(problem.message).toStartWith("actions[0].followUp is required");
  });

  test.each([
    ["no action", { itemId: "q1" }, "is required"],
    ["an action the request does not define", { action: "approve", itemId: "q1" }, "must be"],
    ["an action that is not text", { action: 7 }, "must be"],
  ])("%s is refused at the action's action field", (_, action, says) => {
    const problem = only(update(ACTIONS.close, action));
    expect(problem).toMatchObject({ path: "/actions/1/action", field: "actions[1].action" });
    expect(problem.message).toContain(says);
    expect(problem.expected).toContain('"add"');
  });

  test.each([
    ["a null parentId", { ...ACTIONS.add, parentId: null }, "parentId"],
    ["a null after", { ...ACTIONS.add, after: null }, "after"],
    ["a malformed itemId", { ...ACTIONS.delete, itemId: "q 3" }, "itemId"],
    ["a followUp that is no cursor", { ...ACTIONS.reply, followUp: "4" }, "followUp"],
    ["an empty reply", { ...ACTIONS.reply, text: "" }, "text"],
    ["a reply of 10,001 characters", { ...ACTIONS.reply, text: "r".repeat(10_001) }, "text"],
    ["props that are not an object", { ...ACTIONS.change, props: "x" }, "props"],
  ])("%s is refused, naming the action's index and the field", (_, action, field) => {
    expect(only(update(action))).toMatchObject({
      path: `/actions/0/${field}`,
      field: `actions[0].${field}`,
    });
  });

  test("a reply of 10,000 characters passes", () => {
    expect(validateUpdateRequest(update({ ...ACTIONS.reply, text: "r".repeat(10_000) })).ok).toBe(
      true,
    );
  });

  test.each([
    ["an empty choice", { choice: [] }, "choice"],
    ["a repeated label", { choice: ["Yes", "Yes"] }, "choice"],
    ["Other text of 10,001 characters", { other: "o".repeat(10_001) }, "other"],
    ["a note of 10,001 characters", { note: "n".repeat(10_001) }, "note"],
    ["a decline, which only the user gives", { declined: true }, "declined"],
  ])("a recorded answer with %s is refused, naming the field", (_, answer, field) => {
    const problem = only(update({ ...ACTIONS.answer, answer }));
    expect(problem).toMatchObject({
      path: `/actions/0/answer/${field}`,
      field: `actions[0].answer.${field}`,
    });
  });

  test("an area added inside an area is refused, naming the action's index", () => {
    const area = {
      type: "area",
      id: "rollout",
      props: { title: "Rollout", items: [question("q9")] },
    };
    const problem = only(update({ action: "add", item: area, parentId: "scope" }));
    expect(problem).toMatchObject({ path: "/actions/0/parentId", field: "actions[0].parentId" });
    expect(problem.message).toContain("top level");
  });

  test("an added item is checked as an ask's item is: labels, prefix, IDs, recommended", () => {
    const repeated = question("q4", { options: [{ label: "A" }, { label: "A" }] });
    expect(only(update({ action: "add", item: repeated })).field).toBe(
      "actions[0].item.props.options[1].label",
    );
    expect(only(update({ action: "add", item: question("u-4") })).message).toContain(
      'the prefix "u-" is reserved',
    );
    const area = {
      type: "area",
      id: "rollout",
      props: { title: "Rollout", items: [question("q9"), question("q9")] },
    };
    expect(only(update({ action: "add", item: area })).path).toBe(
      "/actions/0/item/props/items/1/id",
    );
    const two = question("q4", {
      options: [
        { label: "A", recommended: true },
        { label: "B", recommended: true },
      ],
    });
    expect(only(update({ action: "add", item: two })).message).toContain('"A" and "B"');
  });

  test("a problem in an added question names its field from the action", () => {
    const problem = only(update({ action: "add", item: question("q4", { text: "" }) }));
    expect(problem).toMatchObject({ field: "actions[0].item.props.text" });
    expect(problem.message).toStartWith("actions[0].item.props.text must be");
    expect(problem.expected).toBe("non-empty text");
  });

  test.each([
    ["no actions", { askId: "a", actions: [] }, "/actions"],
    ["no ask ID", { actions: [ACTIONS.close] }, "/askId"],
    ["an unknown field", { ...update(ACTIONS.close), versions: {} }, "/versions"],
  ])("a request with %s is refused", (_, value, path) => {
    expect(problemsOf(value).map((problem) => problem.path)).toEqual([path]);
  });

  test("a request that is not an object is refused", () => {
    expect(only(null)).toMatchObject({ path: "/", field: "(the request)" });
  });

  test("problems come in document order, each naming its action", () => {
    const value = update(
      { ...ACTIONS.delete, props: {} },
      { action: "approve" },
      { ...ACTIONS.reply, text: "" },
    );
    expect(problemsOf(value).map((problem) => problem.field)).toEqual([
      "actions[0].props",
      "actions[1].action",
      "actions[2].text",
    ]);
  });
});

describe("the fetch request", () => {
  const ok = { askId: "checkout-plan-p8r3", itemId: "q2" };

  test("a request of the approved shape passes, with or without a continuation", () => {
    expect(validateFetchRequest(ok)).toEqual({ ok: true, value: ok });
    const next = { ...ok, continuation: "eyJpdGVtSWQiOiJxMiJ9" };
    expect(validateFetchRequest(next)).toEqual({ ok: true, value: next });
  });

  test.each([
    ["no item", { askId: ok.askId }, "/itemId"],
    ["a malformed item ID", { ...ok, itemId: "q 2" }, "/itemId"],
    ["a continuation that is not base64url", { ...ok, continuation: "a+b/c=" }, "/continuation"],
    ["an empty continuation", { ...ok, continuation: "" }, "/continuation"],
    ["an unknown field", { ...ok, page: 2 }, "/page"],
  ])("%s is refused, naming the field", (_, request, path) => {
    const checked = validateFetchRequest(request);
    expect(checked.ok ? [] : checked.problems.map((problem) => problem.path)).toEqual([path]);
  });
});

describe("an area added with an area inside it", () => {
  test("is refused once, naming the inner area at its type", () => {
    const inner = { type: "area", id: "inner", props: { title: "Inner", items: [question("q8")] } };
    const area = { type: "area", id: "rollout", props: { title: "Rollout", items: [inner] } };
    const problem = only(update({ action: "add", item: area }));
    expect(problem).toMatchObject({
      path: "/actions/0/item/props/items/0/type",
      field: "actions[0].item.props.items[0].type",
    });
    expect(problem.message).toContain("an area cannot hold an area");
  });
});
