import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  checkArchives,
  checkPackages,
  classify,
  type Installed,
  licenceOf,
  main,
  type Override,
  parseOverrides,
  readRegistry,
  repositoryOf,
  type Verdict,
} from "./check-licences.ts";

const installed = (name: string, licence: string | undefined, version = "1.0.0"): Installed => ({
  name,
  version,
  licence,
  repository: undefined,
});
const override = (fields: Partial<Override> = {}): Override => ({
  package: "odd",
  version: "1.0.0",
  found: "",
  licence: "MIT",
  evidence: "LICENSE file in the published tarball is MIT",
  ...fields,
});

describe("licence classes (design decision 7)", () => {
  test.each(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "mit"])(
    "%s passes",
    (licence) => {
      expect(classify(licence)).toBe("permissive");
    },
  );

  test.each(["MPL-2.0", "EPL-2.0"])("%s passes for unmodified packages only", (licence) => {
    expect(classify(licence)).toBe("unmodified-only");
  });

  test.each([
    "GPL-3.0-only",
    "GPL-2.0-or-later",
    "AGPL-3.0-only",
    "LGPL-2.1-only",
    "LGPL-3.0-or-later",
    "UNLICENSED",
    "SEE LICENSE IN LICENSE.md",
    "BUSL-1.1",
    "CC-BY-NC-4.0",
    "Apache-2.0 WITH LLVM-exception",
    "",
    undefined,
  ])("%p fails", (licence) => {
    expect(classify(licence)).toBe("outside");
  });

  test.each<[string, Verdict]>([
    ["MIT OR GPL-3.0-only", "permissive"],
    ["(MIT OR Apache-2.0)", "permissive"],
    ["GPL-2.0-only OR AGPL-3.0-only", "outside"],
    ["MPL-2.0 OR GPL-3.0-only", "unmodified-only"],
    ["MPL-2.0 OR MIT", "permissive"],
    ["MIT AND ISC", "permissive"],
    ["MIT AND GPL-3.0-only", "outside"],
    ["MIT AND MPL-2.0", "unmodified-only"],
    ["(MIT OR GPL-3.0-only) AND BSD-3-Clause", "permissive"],
    ["MIT OR GPL-3.0-only AND AGPL-3.0-only", "permissive"],
    ["(GPL-3.0-only OR MIT) AND (LGPL-2.1-only OR EPL-2.0)", "unmodified-only"],
  ])("SPDX expression %s is %s", (expression, verdict) => {
    expect(classify(expression)).toBe(verdict);
  });

  test.each(["MIT OR", "(MIT", "MIT)", "MIT ISC", "AND MIT", "()"])(
    "malformed expression %p fails",
    (expression) => {
      expect(classify(expression)).toBe("outside");
    },
  );
});

describe("licence metadata", () => {
  test("reads the license field, a legacy object and a legacy list", () => {
    expect(licenceOf({ license: "MIT" })).toBe("MIT");
    expect(licenceOf({ license: { type: "ISC" } })).toBe("ISC");
    expect(licenceOf({ licenses: [{ type: "MIT" }, { type: "Apache-2.0" }] })).toBe(
      "(MIT) AND (Apache-2.0)",
    );
    expect(licenceOf({ licenses: [{ type: "MIT" }, { type: "GPL-2.0-only" }] })).toBe(
      "(MIT) AND (GPL-2.0-only)",
    );
    expect(licenceOf({ license: " MIT " })).toBe("MIT");
    expect(licenceOf({ license: "" })).toBeUndefined();
    expect(licenceOf({})).toBeUndefined();
    expect(licenceOf({ license: 3 })).toBeUndefined();
    expect(licenceOf({ licenses: [] })).toBeUndefined();
  });
});

describe("packages against the rule", () => {
  test("permissive packages pass", () => {
    expect(checkPackages([installed("a", "MIT"), installed("b", "ISC")], [], new Set())).toEqual(
      [],
    );
  });

  test("a package outside the rule fails, naming it and its licence", () => {
    const problems = checkPackages([installed("copyleft", "GPL-3.0-only", "2.0.0")], [], new Set());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("copyleft@2.0.0");
    expect(problems[0]).toContain("GPL-3.0-only");
  });

  test("a package with no licence fails", () => {
    const problems = checkPackages([installed("bare", undefined)], [], new Set());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("no licence");
  });

  test("an unmodified MPL-2.0 package passes, a patched one fails", () => {
    const mpl = installed("mozilla", "MPL-2.0");
    expect(checkPackages([mpl], [], new Set())).toEqual([]);
    const problems = checkPackages([mpl], [], new Set(["mozilla@1.0.0"]));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("patched");
  });

  test("an override corrects wrong metadata", () => {
    const odd = installed("odd", undefined);
    expect(checkPackages([odd], [override()], new Set())).toEqual([]);
    const wrong = installed("odd", "UNKNOWN");
    expect(checkPackages([wrong], [override({ found: "UNKNOWN" })], new Set())).toEqual([]);
  });

  test("an override that would admit a licence outside the rule is refused", () => {
    const problems = checkPackages(
      [installed("odd", undefined)],
      [override({ licence: "GPL-3.0-only" })],
      new Set(),
    );
    expect(problems.some((problem) => problem.includes("refused"))).toBe(true);
  });

  test("an override must match the metadata it corrects and an installed package", () => {
    const stale = checkPackages(
      [installed("odd", "Apache-2.0")],
      [override({ found: "UNKNOWN" })],
      new Set(),
    );
    expect(stale.some((problem) => problem.includes("does not match"))).toBe(true);
    const unused = checkPackages([installed("a", "MIT")], [override()], new Set());
    expect(unused.some((problem) => problem.includes("matches no installed package"))).toBe(true);
  });

  test("an overridden MPL-2.0 package is still refused when patched", () => {
    const problems = checkPackages(
      [installed("odd", undefined)],
      [override({ licence: "MPL-2.0" })],
      new Set(["odd@1.0.0"]),
    );
    expect(problems.some((problem) => problem.includes("patched"))).toBe(true);
  });
});

describe("the overrides file", () => {
  test("an empty list is valid", () => {
    expect(parseOverrides([])).toEqual({ overrides: [], errors: [] });
  });

  test("a complete entry is read", () => {
    expect(parseOverrides([override()])).toEqual({ overrides: [override()], errors: [] });
  });

  test("a file that is not a list, or an entry missing a field, is an error", () => {
    expect(parseOverrides({}).errors).toHaveLength(1);
    const { evidence: _evidence, ...noEvidence } = override();
    expect(parseOverrides([noEvidence]).errors[0]).toContain("evidence");
    expect(parseOverrides([{ ...override(), licence: "" }]).errors[0]).toContain("licence");
    expect(parseOverrides(["MIT"]).errors).toHaveLength(1);
  });
});

describe("repositories", () => {
  test.each([
    ["git+https://github.com/biomejs/biome.git", "biomejs/biome"],
    ["https://github.com/microsoft/TypeScript", "microsoft/TypeScript"],
    ["git://github.com/owner/repo.git", "owner/repo"],
    ["git@github.com:owner/repo.git", "owner/repo"],
    ["git+ssh://git@github.com/owner/repo.git#main", "owner/repo"],
    ["github:owner/repo", "owner/repo"],
    ["owner/repo", "owner/repo"],
  ])("%s is %s", (url, expected) => {
    const repository = repositoryOf(url);
    expect(repository && `${repository.owner}/${repository.repo}`).toBe(expected);
  });

  test("an object with a url is read; a directory inside a monorepo is ignored", () => {
    const repository = repositoryOf({
      type: "git",
      url: "https://github.com/DefinitelyTyped/DefinitelyTyped.git",
      directory: "types/bun",
    });
    expect(repository).toEqual({ owner: "DefinitelyTyped", repo: "DefinitelyTyped" });
  });

  test.each([
    undefined,
    "",
    "gitlab:owner/repo",
    "https://gitlab.com/owner/repo",
    "https://gitlab.com/owner/github.com/live/repo",
    { type: "git" },
  ])("%p has no GitHub repository", (value) => {
    expect(repositoryOf(value)).toBeUndefined();
  });
});

describe("the archive step", () => {
  type Reply = { status: number; body?: unknown };
  const github = (replies: Record<string, Reply>) => {
    const calls: { url: string; authorization: string | null }[] = [];
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, authorization: new Headers(init?.headers).get("authorization") });
      const reply = replies[url.replace("https://api.github.com/repos/", "")] ?? { status: 404 };
      return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status });
    };
    return { calls, fetch: fetcher as typeof fetch };
  };
  const direct = (name: string, repository: unknown) => ({ name, repository });

  test("a direct dependency whose repository is not archived passes", async () => {
    const api = github({ "owner/live": { status: 200, body: { archived: false } } });
    const result = await checkArchives([direct("live", "github:owner/live")], {
      token: "t0ken",
      ci: false,
      fetch: api.fetch,
    });
    expect(result).toEqual({ problems: [], skipped: false });
    expect(api.calls).toEqual([
      { url: "https://api.github.com/repos/owner/live", authorization: "Bearer t0ken" },
    ]);
  });

  test("an archived repository fails", async () => {
    const api = github({ "owner/old": { status: 200, body: { archived: true } } });
    const result = await checkArchives([direct("old", "github:owner/old")], {
      token: "t0ken",
      ci: false,
      fetch: api.fetch,
    });
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain("archived");
  });

  test("a dependency with no repository, or one GitHub cannot find, fails", async () => {
    const api = github({});
    const result = await checkArchives(
      [direct("nowhere", undefined), direct("gone", "github:owner/gone")],
      { token: "t0ken", ci: false, fetch: api.fetch },
    );
    expect(result.problems).toHaveLength(2);
    expect(result.problems[0]).toContain("no GitHub repository");
    expect(result.problems[1]).toContain("404");
  });

  test("a failed request or a malformed reply fails", async () => {
    const failing = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const down = await checkArchives([direct("a", "github:owner/a")], {
      token: "t0ken",
      ci: false,
      fetch: failing,
    });
    expect(down.problems[0]).toContain("network down");
    const odd = github({ "owner/a": { status: 200, body: { name: "a" } } });
    const malformed = await checkArchives([direct("a", "github:owner/a")], {
      token: "t0ken",
      ci: false,
      fetch: odd.fetch,
    });
    expect(malformed.problems[0]).toContain("archived");
  });

  test("dependencies from one repository are looked up once", async () => {
    const api = github({ "owner/mono": { status: 200, body: { archived: false } } });
    await checkArchives([direct("a", "github:owner/mono"), direct("b", "github:owner/mono")], {
      token: "t0ken",
      ci: false,
      fetch: api.fetch,
    });
    expect(api.calls).toHaveLength(1);
  });

  test("without a token a local run skips the step", async () => {
    const api = github({});
    const result = await checkArchives([direct("a", "github:owner/a")], {
      token: undefined,
      ci: false,
      fetch: api.fetch,
    });
    expect(result).toEqual({ problems: [], skipped: true });
    expect(api.calls).toHaveLength(0);
  });

  test("without a token a CI run fails", async () => {
    const api = github({});
    const result = await checkArchives([direct("a", "github:owner/a")], {
      token: undefined,
      ci: true,
      fetch: api.fetch,
    });
    expect(result.skipped).toBe(false);
    expect(result.problems[0]).toContain("GITHUB_TOKEN");
  });
});

const NPM = "https://registry.npmjs.org/";

describe("the registry step (packages for other platforms)", () => {
  const replying = (reply: () => Promise<Response>) => reply as unknown as typeof fetch;

  test("reads the licence of the exact version", async () => {
    const urls: string[] = [];
    const fetcher = (async (input: string | URL | Request) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ license: "Apache-2.0", repository: "github:o/r" }));
    }) as unknown as typeof fetch;
    const result = await readRegistry(["@scope/native-x64@2.0.0"], fetcher);
    expect(urls).toEqual([`${NPM}@scope/native-x64/2.0.0`]);
    expect(result).toEqual({
      packages: [
        {
          name: "@scope/native-x64",
          version: "2.0.0",
          licence: "Apache-2.0",
          repository: "github:o/r",
        },
      ],
      problems: [],
    });
  });

  test("a failed request, an error status or a reply that is not a manifest fails", async () => {
    const down = await readRegistry(
      ["a@1.0.0"],
      replying(async () => {
        throw new Error("offline");
      }),
    );
    expect(down.problems[0]).toContain("offline");
    const missing = await readRegistry(
      ["a@1.0.0"],
      replying(async () => new Response("{}", { status: 404 })),
    );
    expect(missing.problems[0]).toContain("404");
    const odd = await readRegistry(
      ["a@1.0.0"],
      replying(async () => new Response('"text"')),
    );
    expect(odd.problems[0]).toContain("not a package manifest");
    expect(odd.packages).toEqual([]);
  });

  test("a registry manifest that bundles dependencies fails", async () => {
    const reply = JSON.stringify({ license: "MIT", bundleDependencies: ["g"] });
    const result = await readRegistry(
      ["a@1.0.0"],
      replying(async () => new Response(reply)),
    );
    expect(result.problems[0]).toContain("bundles");
  });
});

describe("the installed tree and the command", () => {
  type Fake = {
    name: string;
    version: string;
    manifest?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    installed?: boolean;
  };
  let root = "";
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const makeTree = (options: {
    packages: Fake[];
    direct: Record<string, string>;
    workspaceDirect?: Record<string, string>;
    patched?: string[];
    overrides?: string;
    // Nested lockfile keys that repeat a package, as Bun writes them, mapped to its name.
    nested?: Record<string, string>;
    // Rewrites the lockfile before it is written, to model other formats.
    reshape?: (lock: Record<string, unknown>) => Record<string, unknown>;
  }) => {
    root = mkdtempSync(join(tmpdir(), "check-licences-"));
    const patchedDependencies = Object.fromEntries(
      (options.patched ?? []).map((id) => [id, `patches/${id}.patch`]),
    );
    write(
      "package.json",
      JSON.stringify({ name: "fake", private: true, patchedDependencies }, null, 2),
    );
    const entries: Record<string, unknown[]> = {
      "@askboard/core": ["@askboard/core@workspace:packages/core"],
    };
    for (const fake of options.packages) {
      entries[fake.name] = [`${fake.name}@${fake.version}`, "", fake.meta ?? {}, "sha512-x"];
      if (fake.installed === false) continue;
      const directory = `${fake.name.replace("/", "+")}@${fake.version}`;
      write(
        `node_modules/.bun/${directory}/node_modules/${fake.name}/package.json`,
        JSON.stringify({ name: fake.name, version: fake.version, ...fake.manifest }),
      );
    }
    for (const [key, name] of Object.entries(options.nested ?? {})) {
      entries[key] = entries[name] ?? [];
    }
    const lock: Record<string, unknown> = {
      lockfileVersion: 2,
      workspaces: {
        "": { name: "fake", devDependencies: options.direct },
        "packages/core": {
          name: "@askboard/core",
          dependencies: { "@askboard/contract": "workspace:*", ...options.workspaceDirect },
        },
      },
      packages: entries,
    };
    // bun.lock is JSON with trailing commas.
    const shaped = options.reshape ? options.reshape(lock) : lock;
    write("bun.lock", JSON.stringify(shaped, null, 2).replace(/\n(\s*)([}\]])/g, ",\n$1$2"));
    if (options.overrides !== undefined) write("tools/licence-overrides.json", options.overrides);
  };
  // The npm registry replies with `registry[<name>/<version>]`, MIT when unlisted, 404 when null;
  // GitHub replies with `archived`.
  const run = async (
    env: Record<string, string | undefined>,
    archived = false,
    registry: Record<string, unknown> = {},
  ) => {
    const lines: string[] = [];
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      if (!url.startsWith(NPM)) return new Response(JSON.stringify({ archived }), { status: 200 });
      const key = url.slice(NPM.length);
      const manifest = key in registry ? registry[key] : { license: "MIT" };
      return new Response(JSON.stringify(manifest), { status: manifest === null ? 404 : 200 });
    }) as unknown as typeof fetch;
    const code = await main([root], { env, fetch: fetcher, log: (line) => lines.push(line) });
    return { code, output: lines.join("\n") };
  };
  const permissive = (name: string, extra: Partial<Fake> = {}): Fake => ({
    name,
    version: "1.0.0",
    manifest: { license: "MIT", repository: `github:owner/${name.replace(/\W/g, "")}` },
    ...extra,
  });

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = "";
  });

  test("a clean tree passes with the archive step", async () => {
    makeTree({
      packages: [permissive("direct-a"), permissive("@scope/direct-b"), permissive("transitive")],
      direct: { "direct-a": "1.0.0" },
      workspaceDirect: { "@scope/direct-b": "1.0.0" },
      overrides: "[]\n",
    });
    const { code, output } = await run({ GITHUB_TOKEN: "t0ken" });
    expect(code).toBe(0);
    expect(output).toContain("3 installed packages, 0 for other platforms");
    expect(output).toContain("2 direct dependencies");
    expect(output).toContain("archive step: checked");
  });

  test("a local run without a token says it skipped the archive step", async () => {
    makeTree({ packages: [permissive("a")], direct: { a: "1.0.0" }, overrides: "[]" });
    const { code, output } = await run({});
    expect(code).toBe(0);
    expect(output).toContain("skipped");
  });

  test("an archived direct dependency fails the command", async () => {
    makeTree({ packages: [permissive("a")], direct: { a: "1.0.0" }, overrides: "[]" });
    const { code, output } = await run({ GITHUB_TOKEN: "t0ken" }, true);
    expect(code).toBe(1);
    expect(output).toContain("archived");
  });

  test("a patch on any version of an MPL-2.0 package counts", async () => {
    makeTree({
      packages: [
        permissive("a"),
        { name: "mpl", version: "1.0.0", manifest: { license: "MPL-2.0" } },
      ],
      direct: { a: "1.0.0" },
      patched: ["mpl@^1.0.0"],
      overrides: "[]",
    });
    const { code, output } = await run({ GITHUB_TOKEN: "t0ken" });
    expect(code).toBe(1);
    expect(output).toContain("patched");
  });

  test("a package outside the rule, or a patched MPL-2.0 one, fails the command", async () => {
    makeTree({
      packages: [
        permissive("a"),
        { name: "gpl", version: "2.0.0", manifest: { license: "GPL-3.0-only" } },
        { name: "mpl", version: "1.0.0", manifest: { license: "MPL-2.0" } },
      ],
      direct: { a: "1.0.0" },
      patched: ["mpl@1.0.0"],
      overrides: "[]",
    });
    const { code, output } = await run({ GITHUB_TOKEN: "t0ken" });
    expect(code).toBe(1);
    expect(output).toContain("gpl@2.0.0");
    expect(output).toContain("mpl@1.0.0");
  });

  test("a package missing for another platform is skipped; any other missing one fails", async () => {
    makeTree({
      packages: [
        permissive("a"),
        {
          name: "native-other",
          version: "1.0.0",
          meta: { os: "aix", cpu: "ppc64" },
          installed: false,
        },
      ],
      direct: { a: "1.0.0" },
      overrides: "[]",
      nested: { "x/native-other": "native-other", "x/a": "a" },
    });
    const skipped = await run({ GITHUB_TOKEN: "t0ken" });
    expect(skipped.code).toBe(0);
    expect(skipped.output).toContain("1 installed packages, 1 for other platforms");
    rmSync(root, { recursive: true, force: true });

    makeTree({
      packages: [
        permissive("a"),
        { name: "native-other", version: "1.0.0", meta: { os: "aix" }, installed: false },
      ],
      direct: { a: "1.0.0" },
      overrides: "[]",
    });
    const gpl = await run({ GITHUB_TOKEN: "t0ken" }, false, {
      "native-other/1.0.0": { license: "GPL-3.0-only" },
    });
    expect(gpl.code).toBe(1);
    expect(gpl.output).toContain("native-other@1.0.0: licence GPL-3.0-only");
    const unknown = await run({ GITHUB_TOKEN: "t0ken" }, false, { "native-other/1.0.0": null });
    expect(unknown.code).toBe(1);
    expect(unknown.output).toContain("404");
    rmSync(root, { recursive: true, force: true });

    makeTree({
      packages: [permissive("a"), { name: "lost", version: "1.0.0", installed: false }],
      direct: { a: "1.0.0" },
      overrides: "[]",
    });
    const missing = await run({ GITHUB_TOKEN: "t0ken" });
    expect(missing.code).toBe(1);
    expect(missing.output).toContain("lost@1.0.0");
  });

  test("an invalid or missing overrides file fails the command", async () => {
    makeTree({ packages: [permissive("a")], direct: { a: "1.0.0" }, overrides: "{}" });
    expect((await run({ GITHUB_TOKEN: "t0ken" })).code).toBe(1);
    rmSync(root, { recursive: true, force: true });
    makeTree({ packages: [permissive("a")], direct: { a: "1.0.0" }, overrides: "not json" });
    expect((await run({ GITHUB_TOKEN: "t0ken" })).code).toBe(1);
    rmSync(root, { recursive: true, force: true });
    makeTree({ packages: [permissive("a")], direct: { a: "1.0.0" } });
    expect((await run({ GITHUB_TOKEN: "t0ken" })).code).toBe(1);
  });

  test("a missing lockfile fails the command", async () => {
    root = mkdtempSync(join(tmpdir(), "check-licences-"));
    write("package.json", "{}");
    write("tools/licence-overrides.json", "[]");
    const { code, output } = await run({ GITHUB_TOKEN: "t0ken" });
    expect(code).toBe(1);
    expect(output).toContain("bun.lock");
  });

  test("a package for this platform that is not installed fails; another platform's is skipped", async () => {
    const native = (meta: Record<string, unknown>): Fake => ({
      name: "native",
      version: "1.0.0",
      meta,
      installed: false,
    });
    const outcome = async (meta: Record<string, unknown>) => {
      makeTree({
        packages: [permissive("a"), native(meta)],
        direct: { a: "1.0.0" },
        overrides: "[]",
      });
      const result = await run({ GITHUB_TOKEN: "t0ken" });
      rmSync(root, { recursive: true, force: true });
      return result;
    };
    const here = await outcome({ os: process.platform, cpu: process.arch });
    expect(here.code).toBe(1);
    expect(here.output).toContain("native@1.0.0");
    expect((await outcome({ os: [process.platform], cpu: [process.arch] })).code).toBe(1);
    expect((await outcome({ os: "!aix", cpu: process.arch })).code).toBe(1);
    expect((await outcome({ os: `!${process.platform}`, cpu: process.arch })).code).toBe(0);
    expect((await outcome({ os: process.platform, cpu: "none" })).code).toBe(0);
    // The libc of this machine is not detected, so a libc-specific package is skipped.
    expect((await outcome({ os: process.platform, cpu: process.arch, libc: "musl" })).code).toBe(0);
  });

  test.each<[string, (lock: Record<string, unknown>) => Record<string, unknown>]>([
    ["another lockfile version", (lock) => ({ ...lock, lockfileVersion: 3 })],
    ["no packages", ({ packages: _packages, ...lock }) => lock],
    ["no workspaces", ({ workspaces: _workspaces, ...lock }) => lock],
    ["no root workspace", (lock) => ({ ...lock, workspaces: {} })],
    ["an empty package map", (lock) => ({ ...lock, packages: {} })],
    ["a malformed entry", (lock) => ({ ...lock, packages: { a: "a@1.0.0" } })],
    [
      "workspace packages only",
      (lock) => ({
        ...lock,
        packages: { "@askboard/core": ["@askboard/core@workspace:packages/core"] },
      }),
    ],
  ])("a lockfile with %s fails the command", async (_case, reshape) => {
    makeTree({ packages: [permissive("a")], direct: { a: "1.0.0" }, overrides: "[]", reshape });
    const { code, output } = await run({ GITHUB_TOKEN: "t0ken" });
    expect(code).toBe(1);
    expect(output).toContain("bun.lock");
  });

  test("a package that bundles dependencies fails the command", async () => {
    const bundler = (field: string, value: unknown): Fake =>
      permissive("bundler", {
        manifest: { license: "MIT", repository: "github:owner/bundler", [field]: value },
      });
    for (const [field, value] of [
      ["bundleDependencies", ["g"]],
      ["bundledDependencies", ["g"]],
      ["bundleDependencies", true],
    ] as const) {
      makeTree({
        packages: [permissive("a"), bundler(field, value)],
        direct: { a: "1.0.0" },
        overrides: "[]",
      });
      const { code, output } = await run({ GITHUB_TOKEN: "t0ken" });
      expect(code).toBe(1);
      expect(output).toContain("bundles");
      rmSync(root, { recursive: true, force: true });
    }
    makeTree({
      packages: [permissive("a"), bundler("bundleDependencies", [])],
      direct: { a: "1.0.0" },
      overrides: "[]",
    });
    expect((await run({ GITHUB_TOKEN: "t0ken" })).code).toBe(0);
  });

  test("a CI run without a token fails the command", async () => {
    makeTree({ packages: [permissive("a")], direct: { a: "1.0.0" }, overrides: "[]" });
    const { code, output } = await run({ CI: "true" });
    expect(code).toBe(1);
    expect(output).toContain("GITHUB_TOKEN");
    expect(output).toContain("archive step: not run");
    expect((await run({ CI: "false" })).code).toBe(0);
  });
});
