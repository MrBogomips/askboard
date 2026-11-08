import { describe, expect, test } from "bun:test";
import { lifecycleSnapshotData, snapshotToolbarData } from "../src/fixtures/index.ts";
import { CONFIGURATION_DEFAULTS, type SnapshotData, snapshotDataSet } from "../src/index.ts";
import { configurationSet } from "../src/schemas/configuration/index.ts";
import { SNAPSHOT_DATA_VERSION } from "../src/schemas/snapshot-data/index.ts";
import { validateSnapshotData } from "../src/validate.ts";

// snapshot-toolbar's Snapshot data (contract spec: The presentation in the Snapshot data, This
// change's Snapshot data at its next minor; design decisions 2 and 6): the record's optional
// `presentation`, whose enums stay the configuration schema's.

type Json = Record<string, unknown>;

/** The data as plain JSON, with `change` applied to a copy. */
const changed = (change: (data: Json) => void, data: SnapshotData = snapshotToolbarData): Json => {
  const copy = structuredClone(data) as unknown as Json;
  change(copy);
  return copy;
};
const record = (data: Json) => data.snapshot as Json;
const presentationOf = (data: Json) => record(data).presentation as Json;

const check = (value: unknown) => validateSnapshotData(value);
const problemPaths = (value: unknown): string[] => {
  const checked = check(value);
  return checked.ok ? [] : checked.problems.map((problem) => problem.path);
};

/** The user's record of the same data, taking the presentation along. */
const userRecord = (data: Json) => {
  data.snapshot = {
    takenAt: "2026-11-08T10:00:00Z",
    takenBy: "user",
    who: "Giulia Rossi",
    unsentWork: true,
    presentation: { theme: "dark", density: "comfortable" },
  };
};

describe("the record's presentation", () => {
  test("the fixture is an agent's record with the light, comfortable presentation", () => {
    expect(snapshotToolbarData.snapshot).toMatchObject({
      takenBy: "agent",
      presentation: { theme: "light", density: "comfortable" },
    });
    expect(check(snapshotToolbarData).ok).toBe(true);
  });

  test("a user's record takes a presentation too", () => {
    expect(check(changed(userRecord)).ok).toBe(true);
  });

  test("every theme and density the configuration allows passes", () => {
    for (const theme of ["system", "light", "dark"]) {
      for (const density of ["compact", "comfortable"]) {
        const data = changed((d) => {
          record(d).presentation = { theme, density };
        });
        expect(check(data).ok).toBe(true);
      }
    }
  });

  test("a theme the configuration does not allow fails, naming the field", () => {
    const data = changed((d) => {
      presentationOf(d).theme = "sepia";
    });
    expect(problemPaths(data)).toContain("/snapshot/presentation/theme");
  });

  test("a presentation without a density fails, naming the field", () => {
    const data = changed((d) => {
      delete presentationOf(d).density;
    });
    expect(problemPaths(data)).toEqual(["/snapshot/presentation/density"]);
  });

  test("a presentation without a theme fails, naming the field", () => {
    const data = changed((d) => {
      delete presentationOf(d).theme;
    });
    expect(problemPaths(data)).toEqual(["/snapshot/presentation/theme"]);
  });

  test("a presentation with contextPlacement fails, naming the field", () => {
    const data = changed((d) => {
      presentationOf(d).contextPlacement = "beside";
    });
    expect(problemPaths(data)).toContain("/snapshot/presentation/contextPlacement");
  });

  test("a presentation that is null or not an object fails", () => {
    for (const bad of [null, "light", [], 3]) {
      const data = changed((d) => {
        record(d).presentation = bad;
      });
      expect(check(data).ok).toBe(false);
    }
  });

  test("the agent's record still refuses who and unsentWork beside a presentation", () => {
    for (const extra of [{ who: "Giulia Rossi" }, { unsentWork: true }]) {
      const data = changed((d) => {
        Object.assign(record(d), extra);
      });
      expect(check(data).ok).toBe(false);
    }
  });

  test("a user's record still needs who beside a presentation", () => {
    const data = changed((d) => {
      userRecord(d);
      delete record(d).who;
    });
    expect(check(data).ok).toBe(false);
  });

  test("a Snapshot written before, with no presentation, still passes", () => {
    expect(check(lifecycleSnapshotData).ok).toBe(true);
    expect(lifecycleSnapshotData.snapshot).not.toHaveProperty("presentation");
  });
});

describe("the presentation's enums", () => {
  const enumsOf = (set: { schemas: readonly object[] }, pick: (schema: Json) => Json) =>
    pick(set.schemas[0] as Json);

  const configured = (key: string) => {
    const properties = enumsOf(configurationSet, (schema) => schema.properties as Json);
    return (properties[key] as { enum: string[] }).enum;
  };
  const recorded = (key: string) => {
    const schema = snapshotDataSet.schemas[0] as Json;
    const defs = schema.$defs as Json;
    const presentation = ((defs.record as Json).properties as Json).presentation as Json;
    return ((presentation.properties as Json)[key] as { enum: string[] }).enum;
  };

  test("equal the configuration schema's theme and density enums", () => {
    expect(recorded("theme")).toEqual(configured("theme"));
    expect(recorded("density")).toEqual(configured("density"));
  });

  test("hold the configuration's defaults", () => {
    expect(recorded("theme")).toContain(CONFIGURATION_DEFAULTS.theme);
    expect(recorded("density")).toContain(CONFIGURATION_DEFAULTS.density);
  });

  test("the property's description names the change, not a number", () => {
    const schema = snapshotDataSet.schemas[0] as Json;
    const record = ((schema.$defs as Json).record as Json).properties as Json;
    const description = (record.presentation as { description: string }).description;
    expect(description).toContain("since snapshot-toolbar");
  });
});

describe("the Snapshot data's version", () => {
  test("is main's minor plus one (the one literal besides the constant)", () => {
    expect(SNAPSHOT_DATA_VERSION).toBe("1.2");
    expect(snapshotDataSet.version).toBe(SNAPSHOT_DATA_VERSION);
    expect(snapshotToolbarData.versions.snapshot).toBe(SNAPSHOT_DATA_VERSION);
  });

  test("a previous minor's data, naming the previous version, is accepted", () => {
    const data = changed((d) => {
      (d.versions as Json).snapshot = "1.1";
      delete record(d).presentation;
    }, lifecycleSnapshotData);
    expect(check(data).ok).toBe(true);
  });
});
