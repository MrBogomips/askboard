import { describe, expect, test } from "bun:test";
import {
  ASKBOARD_FOLDER,
  ASKBOARD_GITIGNORE,
  ASKBOARD_SUBFOLDERS,
  SERVER_INSTRUCTIONS,
  SNAPSHOT_FOLDER,
} from "../src/index.ts";

// The `.askboard/` folder under the session project root (settings-languages design decision 13;
// AD-14, Project folders). The names and values are E7's (`snapshot` design decision 2).

describe("the .askboard folder", () => {
  test("is .askboard, with the subfolders created at the first ask", () => {
    expect(ASKBOARD_FOLDER).toBe(".askboard");
    expect(ASKBOARD_SUBFOLDERS).toEqual(["snapshots", "media", "patches"]);
  });

  test("its .gitignore is the four lines, bench/ among them though bench/ is not created", () => {
    expect(ASKBOARD_GITIGNORE).toEqual(["snapshots/", "media/", "patches/", "bench/"]);
    expect(ASKBOARD_SUBFOLDERS).not.toContain("bench" as never);
  });

  test("ignores every subfolder it creates", () => {
    for (const folder of ASKBOARD_SUBFOLDERS) expect(ASKBOARD_GITIGNORE).toContain(`${folder}/`);
  });

  test("the default Snapshot folder is its snapshots subfolder", () => {
    expect(SNAPSHOT_FOLDER).toBe(".askboard/snapshots");
    expect(SNAPSHOT_FOLDER).toBe(`${ASKBOARD_FOLDER}/${ASKBOARD_SUBFOLDERS[0]}`);
  });

  test("the server instructions name its media subfolder for screenshots", () => {
    expect(SERVER_INSTRUCTIONS).toContain(`\`${ASKBOARD_FOLDER}/media/\``);
  });
});
