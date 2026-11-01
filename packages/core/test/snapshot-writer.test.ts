import { describe, expect, test } from "bun:test";
import type { SnapshotData } from "@askboard/contract";
import {
  PROJECT_ROOT_VARIABLE,
  SNAPSHOT_NO_PROJECT_ROOT,
  SnapshotWriteError,
  type SnapshotWriter,
} from "../src/index.ts";

// The `SnapshotWriter` port and its error (snapshot design decision 3; core spec, Taking a
// Snapshot): the types only. The command and the `CorePorts` field wait for group 0.

describe("SnapshotWriteError", () => {
  test("without a project root names CLAUDE_PROJECT_DIR and no folder", () => {
    const error = SnapshotWriteError.noProjectRoot();
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "SnapshotWriteError",
      code: "no-project-root",
      variable: "CLAUDE_PROJECT_DIR",
      folder: undefined,
    });
    expect(SNAPSHOT_NO_PROJECT_ROOT).toBe("no-project-root");
    expect(PROJECT_ROOT_VARIABLE).toBe("CLAUDE_PROJECT_DIR");
    expect(error.message).toContain("CLAUDE_PROJECT_DIR");
  });

  test("in a folder names the folder and the code, and keeps the cause", () => {
    const cause = Object.assign(new Error("permission denied, open '/p/.askboard/x'"), {
      code: "EACCES",
    });
    const error = SnapshotWriteError.inFolder("/p/.askboard/snapshots", "EACCES", { cause });
    expect(error).toMatchObject({
      name: "SnapshotWriteError",
      code: "EACCES",
      folder: "/p/.askboard/snapshots",
      variable: undefined,
    });
    expect(error.message).toBe("no Snapshot written to /p/.askboard/snapshots: EACCES");
    expect(error.cause).toBe(cause);
  });

  test("a folder refused as outside the project has the code outside-project", () => {
    const error = SnapshotWriteError.inFolder("/elsewhere", "outside-project");
    expect(error).toMatchObject({ code: "outside-project", folder: "/elsewhere" });
  });
});

describe("the SnapshotWriter port", () => {
  test("a writer resolves with the file's path, or rejects with a SnapshotWriteError", async () => {
    const paths: string[] = [];
    const writer: SnapshotWriter = {
      write: async (data: SnapshotData) => {
        if (data.askId === "refused") throw SnapshotWriteError.noProjectRoot();
        const path = `/p/.askboard/snapshots/${data.askId}.html`;
        paths.push(path);
        return { path };
      },
    };
    const data = { askId: "offer-k3x9" } as SnapshotData;
    expect(await writer.write(data)).toEqual({ path: "/p/.askboard/snapshots/offer-k3x9.html" });
    const refused = { askId: "refused" } as SnapshotData;
    await expect(writer.write(refused)).rejects.toBeInstanceOf(SnapshotWriteError);
    expect(paths).toEqual(["/p/.askboard/snapshots/offer-k3x9.html"]);
  });
});
