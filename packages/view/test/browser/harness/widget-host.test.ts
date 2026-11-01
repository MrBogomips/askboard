import { afterEach, describe, expect, test } from "bun:test";
import { BOARD_HOST, BOARD_RESPONSES, cspHashSource } from "@askboard/contract";
import { fixtureViewManifest, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { WIDGET_HOST_DATA_ID } from "../fixtures/widget-host-data.ts";
import { parsePolicy } from "./policy.ts";
import { assembledSrcdoc, EVAL_PROBE, fixtureViewBuild, sha256Hex } from "./view-build.ts";
import { startWidgetHost, type WidgetHost, type WidgetHostOptions } from "./widget-host.ts";

const build = fixtureViewBuild();
const hosts: WidgetHost[] = [];
afterEach(async () => {
  for (const host of hosts.splice(0)) await host.close();
});

const start = async (options?: WidgetHostOptions): Promise<WidgetHost> => {
  const host = await startWidgetHost(build, plainChoiceBoardDocument, options);
  hosts.push(host);
  return host;
};

const page = async (host: WidgetHost) => {
  const response = await fetch(host.url);
  const html = await response.text();
  const policy = response.headers.get("Content-Security-Policy") ?? "";
  return { response, html, policy, directives: parsePolicy(policy) };
};

const inline = (html: string, tag: "script" | "style") =>
  [...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((match) => match[1]);
const dataBlock = (html: string) =>
  new RegExp(`<script type="application/json" id="${WIDGET_HOST_DATA_ID}">([\\s\\S]*?)</script>`)
    .exec(html)
    ?.at(1);

describe("the widget host's page (design decision 9)", () => {
  test("is served under the board page's policy, the host script's hash in place of the board page's", async () => {
    const { response, html, policy, directives } = await page(await start());
    expect(response.status).toBe(BOARD_RESPONSES.boardPage.status);
    expect(response.headers.get("Content-Type")).toBe(BOARD_RESPONSES.boardPage.contentType);
    const scripts = inline(html, "script");
    expect(scripts).toHaveLength(1);
    const scriptSources = directives.get("script-src") ?? [];
    expect(scriptSources).toContain(cspHashSource(sha256Hex(scripts[0] ?? "")));
    expect(scriptSources).not.toContain(cspHashSource(fixtureViewManifest.boardPage.script.sha256));
    const styleSources = directives.get("style-src") ?? [];
    for (const chunk of Object.values(fixtureViewManifest.chunks)) {
      expect(scriptSources).toContain(cspHashSource(chunk.script.sha256));
      for (const style of chunk.styles) expect(styleSources).toContain(cspHashSource(style.sha256));
    }
    for (const style of inline(html, "style")) {
      expect(styleSources).toContain(cspHashSource(sha256Hex(style ?? "")));
    }
    expect(policy).not.toContain("unsafe-");
    expect(directives.get("default-src")).toEqual(["'none'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
  });

  test("holds the view's srcdoc and the open state in a JSON block with every < escaped", async () => {
    const { html } = await page(await start());
    const block = dataBlock(html) ?? "";
    expect(block).not.toContain("<");
    expect(JSON.parse(block)).toEqual({
      srcdoc: assembledSrcdoc(build, plainChoiceBoardDocument),
      state: { ask: "waiting", questions: [{ itemId: "database", rev: 1, state: "open" }] },
    });
    expect(html.replace(block, "")).not.toContain("PostgreSQL");
  });

  test("runs a caught eval before the host script when asked to: a negative control", async () => {
    const { html, directives } = await page(await start({ probe: true }));
    const [script] = inline(html, "script");
    expect(script?.startsWith(EVAL_PROBE)).toBe(true);
    expect(directives.get("script-src")).toContain(cspHashSource(sha256Hex(script ?? "")));
  });

  test("answers 404 for any other path, and nothing but GET and HEAD", async () => {
    const host = await start();
    for (const path of ["/m", `/c/${"a".repeat(64)}`, "/b/order-db-choice-x7k2", "/favicon.ico"]) {
      const response = await fetch(new URL(path, host.url));
      expect([path, response.status]).toEqual([path, BOARD_RESPONSES.notFound.status]);
    }
    expect((await fetch(host.url, { method: "POST" })).status).toBe(404);
    const head = await fetch(host.url, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });

  test("listens on 127.0.0.1 only", async () => {
    const host = await start();
    const url = new URL(host.url);
    expect(url.hostname).toBe(BOARD_HOST);
    expect(url.pathname).toBe("/");
    await expect(fetch(`http://[::1]:${url.port}/`)).rejects.toThrow();
  });
});
