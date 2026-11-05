// The ask's root (excerpts, design decision 4, Root; core spec, "The ask's root"): the origin's root
// when the ask has one, else the session project root, and nothing at all without a project root,
// whatever the origin says.

import { describe, expect, test } from "bun:test";
import { type Binding, type CorePorts, rootOf } from "../src/index.ts";
import { MAIN_ORIGIN, REVIEWER_ORIGIN } from "./push-fakes.ts";

const PROJECT = "/home/paola/orders";

const owned = (origin?: Binding["origin"]): Binding => ({
  ownerKey: "agent-1",
  ...(origin === undefined ? {} : { origin }),
});

describe("rootOf", () => {
  test.each([
    [
      "an ask whose origin has a root uses it",
      PROJECT,
      owned(REVIEWER_ORIGIN),
      REVIEWER_ORIGIN.root,
    ],
    ["the main agent's origin gives its root", PROJECT, owned(MAIN_ORIGIN), MAIN_ORIGIN.root],
    ["an unchecked ask uses the project root", PROJECT, undefined, PROJECT],
    ["an owned ask without origin uses the project root", PROJECT, owned(), PROJECT],
    [
      "an origin without a root uses the project root",
      PROJECT,
      owned({ label: "Main agent", cwd: "/tmp/elsewhere" }),
      PROJECT,
    ],
    ["no project root gives no root for an unchecked ask", undefined, undefined, undefined],
    [
      "no project root gives no root, even with an origin's root",
      undefined,
      owned(REVIEWER_ORIGIN),
      undefined,
    ],
  ] as const)("%s", (_, projectRoot, owner, expected) => {
    expect(rootOf(projectRoot, owner)).toBe(expected);
  });
});

describe("CorePorts", () => {
  test("takes the SourceFiles port and the session project root, both optional", () => {
    const sources = {} as NonNullable<CorePorts["sources"]>;
    const ports: Pick<CorePorts, "sources" | "projectRoot"> = { sources, projectRoot: PROJECT };
    const none: Pick<CorePorts, "sources" | "projectRoot"> = {};
    expect(ports.projectRoot).toBe(PROJECT);
    expect(none.sources).toBeUndefined();
  });
});
