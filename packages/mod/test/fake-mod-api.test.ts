import { describe, expect, test } from "bun:test";
import { BENEATH_ROW } from "./fake-band.ts";
import { fakeModApi, fakeOn, PID_COMMAND } from "./fake-mod-api.ts";

// The fake `$` and `on` stand for Claude Code in every test of the mod, so they are tested too:
// each call is recorded and goes to its handler, and each hook runs as the engine runs it.

describe("the fake mod API", () => {
  test("records each call and answers from its handlers", async () => {
    const fake = fakeModApi({ pid: 9, uid: 7 });
    const { api, calls } = fake;
    expect(await api.process.run(PID_COMMAND)).toMatchObject({ stdout: "9 7" });
    expect(api.process.run(["true"])).rejects.toThrow("no handler");
    expect(api.http.fetch("http://x")).rejects.toThrow("no handler");
    const row = {
      message: { type: "user" as const, content: [{ type: "text" as const, text: "a" }] },
    };
    expect(await api.session.append(row)).toEqual({ uuid: "row-1" });
    expect(await api.prompt.submit({ text: "b" })).toEqual({ text: "b" });
    expect(await api.agent.list()).toEqual([]);
    api.ui.log("c");
    api.ui.toast("d");
    api.ui.status(undefined);
    api.ui.invalidate("ui.render");
    expect(await api.session.surfaces()).toEqual(["terminal"]);
    expect(calls).toMatchObject({
      invalidate: ["ui.render"],
      append: [row],
      submit: [{ text: "b" }],
      log: ["c"],
      toast: ["d"],
      status: [undefined],
      agentLists: 1,
    });
  });

  test("keeps files, folders and links, and a clock the test moves", async () => {
    const fake = fakeModApi();
    fake.dirs.add("/d");
    fake.files.set("/d/f", "text");
    fake.links.add("/d/f");
    expect(await fake.api.fs.stat("/d")).toMatchObject({ kind: "dir", isLink: false });
    expect(await fake.api.fs.stat("/d/f")).toMatchObject({ kind: "file", isLink: true });
    expect(await fake.api.fs.read("/d/f")).toBe("text");
    expect(fake.api.fs.read("/d/g")).rejects.toThrow("ENOENT");
    const before = await fake.api.clock.now();
    fake.advance(1_000);
    expect(await fake.api.clock.now()).toBeGreaterThan(before + 1_000);
  });

  test("answers find from its files, with each path's owner and mode, apart from other runs", async () => {
    const fake = fakeModApi({ uid: 501 });
    fake.dirs.add("/d");
    fake.files.set("/d/f", "{}");
    const find = (path: string, type: string, user: number, perm: string) =>
      fake.api.process.run([
        "find",
        path,
        "-maxdepth",
        "0",
        "-type",
        type,
        "-uid",
        `${user}`,
        "-perm",
        perm,
      ]);
    expect(await find("/d", "d", 501, "700")).toEqual({ exitCode: 0, stdout: "/d\n", stderr: "" });
    expect(await find("/d/f", "f", 501, "600")).toMatchObject({ stdout: "/d/f\n" });
    expect(await find("/d", "f", 501, "700")).toMatchObject({ exitCode: 0, stdout: "" });
    fake.owners.set("/d", 0);
    expect(await find("/d", "d", 501, "700")).toMatchObject({ exitCode: 0, stdout: "" });
    fake.owners.delete("/d");
    fake.modes.set("/d", 0o755);
    expect(await find("/d", "d", 501, "700")).toMatchObject({ exitCode: 0, stdout: "" });
    fake.links.add("/d/f");
    expect(await find("/d/f", "f", 501, "600")).toMatchObject({ exitCode: 0, stdout: "" });
    expect(await find("/gone", "d", 501, "700")).toMatchObject({ exitCode: 1, stdout: "" });
    expect(fake.api.process.run(["find", "/d", "-name", "x"])).rejects.toThrow(
      "only as the mod's check",
    );
    expect(fake.calls.find).toHaveLength(8);
    expect(fake.calls.run).toEqual([]);
  });

  test("runs the live intervals at each tick, and none once cancelled", async () => {
    const fake = fakeModApi();
    let runs = 0;
    const timer = fake.api.clock.every(1_000, () => {
      runs += 1;
    });
    await fake.tick();
    timer.cancel();
    await fake.tick();
    expect(runs).toBe(1);
  });
});

describe("the fake on", () => {
  test("passes each event on when no hook is registered", async () => {
    const fake = fakeModApi();
    const hooks = fakeOn(fake.api);
    expect(await hooks.sessionStart()).toEqual({ cwd: "/project" });
    expect(await hooks.turnStart({ turnId: "t" })).toEqual({ turnId: "t" });
    expect(await hooks.turnStep()).toBe("step-result");
    expect(await hooks.turnComplete()).toEqual({ text: "" });
  });

  test("runs the one hook of each event, and refuses two", async () => {
    const fake = fakeModApi();
    const hooks = fakeOn(fake.api);
    const seen: string[] = [];
    hooks.on("turn.start", async (_$, e, next) => {
      seen.push(e.turnId);
      return next(e);
    });
    hooks.on("turn.step", async function* (_$, e, next) {
      seen.push(`step ${e.index}`);
      return yield* next(e);
    });
    hooks.on("turn.complete", async (_$, e, next) => {
      seen.push(`complete ${e.isAborted}`);
      return next(e);
    });
    await hooks.turnStart({ turnId: "t" });
    expect(await hooks.turnStep({ index: 3 })).toBe("step-result");
    await hooks.turnComplete({ isAborted: true });
    expect(seen).toEqual(["t", "step 3", "complete true"]);
    hooks.on("turn.start", async (_$, e, next) => next(e));
    expect(hooks.turnStart()).rejects.toThrow("more than one");
  });

  test("draws the band through its one hook as rows, or passes without one", async () => {
    const fake = fakeModApi();
    const hooks = fakeOn(fake.api);
    expect(await hooks.drawBand()).toBeUndefined();
    hooks.on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
      const { Box, Text, Link } = $.ui.resolve(e);
      return Box({
        flexDirection: "column",
        children: [
          Text({ children: `${e.props.bodyColumns}` }),
          Link({ href: "h" }),
          await next(e),
        ],
      });
    });
    expect(await hooks.drawBand({ bodyColumns: 40 })).toEqual(["40", "h", BENEATH_ROW]);
    expect(() =>
      (hooks.on as (...args: unknown[]) => unknown)("ui.render", { component: "Pane" }, () => {}),
    ).toThrow("only the band");
    hooks.on("ui.render", { component: "AbovePrompt" }, async (_$, e, next) => next(e));
    expect(hooks.drawBand()).rejects.toThrow("more than one");
    expect(fake.calls.reached).toEqual(["ui.resolve"]);
  });
});
