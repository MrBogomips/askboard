import { expect, test } from "bun:test";
import { join } from "node:path";

// bun test's coverage counts only the files a test loads. Loading every module under tools/
// makes the 80% threshold count a module that no test exercises as well.
const modules = [...new Bun.Glob("**/*.ts").scanSync({ cwd: import.meta.dir })]
  .filter((path) => !path.endsWith(".test.ts"))
  .sort();

test("tools/ has modules to load", () => {
  expect(modules).toContain("check-imports.ts");
  expect(modules).toContain("check-licences.ts");
});

test.each(modules)("tools/%s loads", async (path) => {
  expect(await import(join(import.meta.dir, path))).toBeDefined();
});
