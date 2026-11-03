import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  type AgentRecord,
  LOCAL_API_ROUTES,
  SESSION_FILE_FORMAT,
  SESSION_TOKEN_HEADER,
  sessionFilePath,
  sessionFolder,
} from "@askboard/contract";
import { validateLocalApi } from "@askboard/contract/validate";
import type { Asker } from "./asker.ts";
import {
  type AskerPlace,
  findLocalApi,
  postRecord,
  prepareProject,
  recordsFor,
  SUBAGENT_ID,
} from "./asker-project.ts";

// What makes an asker real for the session process (task 8.5): its git project, worktree and
// working folder, the records its hooks send, and the local API they go to.

const base = { project: "order-service", gitUser: "Paola Greco" } as const;
const ASK = "order-db-choice-x7k2";
const uid = process.getuid?.() ?? 0;

const places: AskerPlace[] = [];
const folders: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const place of places.splice(0)) await place.cleanup();
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
  for (const server of servers.splice(0)) server.close();
});

const git = (cwd: string, ...args: string[]) =>
  Bun.spawnSync(["git", "-C", cwd, ...args])
    .stdout.toString()
    .trim();

describe("the asker's project", () => {
  test("is a git project with the git user, on main, with one commit", async () => {
    const place = await prepareProject({ ...base, agent: {} });
    places.push(place);
    expect(basename(place.projectDir)).toBe("order-service");
    expect(place.cwd).toBe(place.projectDir);
    expect(git(place.projectDir, "config", "user.name")).toBe("Paola Greco");
    expect(git(place.projectDir, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
  });

  test("has the worktree on its branch, and the working folder under it", async () => {
    const asker: Asker = {
      ...base,
      agent: {
        worktree: { folder: "order-service-fix-retry", branch: "fix/retry" },
        directory: "services/orders",
      },
    };
    const place = await prepareProject(asker);
    places.push(place);
    const top = git(place.cwd, "rev-parse", "--show-toplevel");
    expect(basename(top)).toBe("order-service-fix-retry");
    expect(git(place.cwd, "rev-parse", "--abbrev-ref", "HEAD")).toBe("fix/retry");
    expect(realpathSync(place.cwd)).toBe(join(realpathSync(top), "services", "orders"));
  });

  test("is gone after its cleanup, and a git failure leaves nothing behind", async () => {
    const place = await prepareProject(base);
    await place.cleanup();
    expect(existsSync(place.projectDir)).toBe(false);
    const broken: Asker = { ...base, agent: { worktree: { folder: "x", branch: "bad..name" } } };
    await expect(prepareProject(broken)).rejects.toThrow("git");
  });
});

describe("the records an asker's hooks send", () => {
  test("none for an unchecked ask", () => {
    expect(recordsFor(base, "ask", ASK, "/p")).toEqual([]);
  });

  test("the main conversation's names no agent", () => {
    const [record] = recordsFor({ ...base, agent: {} }, "collect", ASK, "/p");
    expect(record).toMatchObject({
      cwd: "/p",
      tool_name: "mcp__plugin_askboard_askboard__collect",
      askIds: [ASK],
    });
    expect(record).not.toHaveProperty("agent_id");
    expect(validateLocalApi("recordsRequest", record).ok).toBe(true);
  });

  test("a subagent's ask comes after one record of each earlier subagent of its type", () => {
    const asker: Asker = { ...base, agent: { subagent: { type: "code-reviewer", before: 2 } } };
    const records = recordsFor(asker, "ask", ASK, "/p");
    expect(records.map((record) => [record.agent_id, record.agent_type, record.tool_name])).toEqual(
      [
        ["e2e0earlier1", "code-reviewer", "mcp__plugin_askboard_askboard__collect"],
        ["e2e0earlier2", "code-reviewer", "mcp__plugin_askboard_askboard__collect"],
        [SUBAGENT_ID, "code-reviewer", "mcp__plugin_askboard_askboard__ask"],
      ],
    );
    for (const record of records) expect(validateLocalApi("recordsRequest", record).ok).toBe(true);
    expect(recordsFor(asker, "collect", ASK, "/p").map((record) => record.agent_id)).toEqual([
      SUBAGENT_ID,
    ]);
  });
});

describe("the local API", () => {
  const runtime = async () => {
    const root = await mkdtemp("/tmp/abh-");
    folders.push(root);
    const env = { XDG_RUNTIME_DIR: root };
    const folder = sessionFolder({ env, uid });
    await mkdir(folder, { recursive: true });
    return { env, folder };
  };

  const sessionFile = (folder: string, key: number, projectDir: string) =>
    writeFile(
      sessionFilePath(folder, key),
      JSON.stringify({
        format: SESSION_FILE_FORMAT,
        key,
        pid: 48250,
        epoch: "k3x9",
        apiAddress: join(folder, `${key}.sock`),
        sessionToken: "Hc4nQ8vLw2Zr7TxB5mKp9A",
        projectDir,
        startedAt: "2026-10-31T09:40:02.117Z",
      }),
    );

  test("is the one whose session file names the project, among others", async () => {
    const { env, folder } = await runtime();
    await writeFile(join(folder, "1.json"), "not json");
    await sessionFile(folder, 2, "/elsewhere");
    await sessionFile(folder, 3, "/the/project");
    expect(await findLocalApi(env, uid, "/the/project")).toEqual({
      apiAddress: join(folder, "3.sock"),
      sessionToken: "Hc4nQ8vLw2Zr7TxB5mKp9A",
    });
  });

  test("is found through a link to the project, since the session file holds its real path", async () => {
    const { env, folder } = await runtime();
    const real = await realpath(await mkdtemp(join(tmpdir(), "askboard-e2e-real-")));
    folders.push(real);
    const linked = `${real}-link`;
    await symlink(real, linked);
    folders.push(linked);
    await sessionFile(folder, 4, real);
    expect(await findLocalApi(env, uid, linked)).toEqual({
      apiAddress: join(folder, "4.sock"),
      sessionToken: "Hc4nQ8vLw2Zr7TxB5mKp9A",
    });
  });

  test("not found in time fails, naming the project", async () => {
    const { env } = await runtime();
    await expect(findLocalApi(env, uid, "/the/project", 50)).rejects.toThrow("/the/project");
  });

  test("takes a record with the session token, and a refusal fails", async () => {
    const { folder } = await runtime();
    const socketPath = join(folder, "api.sock");
    const received: { token: unknown; path: unknown; body: string }[] = [];
    const server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        received.push({
          token: request.headers[SESSION_TOKEN_HEADER.toLowerCase()],
          path: request.url,
          body,
        });
        response.statusCode = received.length === 1 ? 200 : 400;
        response.end("{}");
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    const api = { apiAddress: socketPath, sessionToken: "Hc4nQ8vLw2Zr7TxB5mKp9A" };
    const [record] = recordsFor({ ...base, agent: {} }, "ask", ASK, "/p") as [AgentRecord];
    await postRecord(api, record);
    expect(received).toEqual([
      {
        token: api.sessionToken,
        path: LOCAL_API_ROUTES.records.path,
        body: JSON.stringify(record),
      },
    ]);
    await expect(postRecord(api, record)).rejects.toThrow("400");
  });
});
