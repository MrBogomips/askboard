// The skill's hand-written prose, read from `templates/` (askboard-skills, design decision 2): the
// text with `{{slot}}` markers that the generator fills. Read when this module loads, so that the
// generator itself touches no file system.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Templates = {
  readonly skill: string;
  readonly answers: string;
  readonly updates: string;
};

const read = (name: string): string =>
  readFileSync(join(import.meta.dir, "templates", name), "utf8");

/** The templates as they stand on disk. */
export const DISK_TEMPLATES: Templates = {
  skill: read("SKILL.md"),
  answers: read("answers.md"),
  updates: read("updates.md"),
};
