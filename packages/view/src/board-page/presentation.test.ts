import { describe, expect, test } from "bun:test";
import type { SettingsMessage } from "@askboard/contract";
import { settingsWithAfterAnswer, settingsWithEveryKey } from "@askboard/contract/fixtures";
import { presentationOf } from "./presentation.ts";

// The presentation a settings message gives (settings-languages, design decision 10;
// answering-flow-guidance, design decision 9): each presentation key in effect, and the fixed ones.

describe("the presentation a settings message gives", () => {
  test("reads the after-answer row, the user's value in effect", () => {
    const presentation = presentationOf(settingsWithAfterAnswer);
    expect(presentation.afterAnswer).toBe("stay");
    expect(presentation.locked).toEqual(["contextPlacement"]);
  });

  test("is next when the message holds no after-answer row, and the other keys are as before", () => {
    expect(settingsWithEveryKey.keys.afterAnswer).toBeUndefined();
    expect(presentationOf(settingsWithEveryKey)).toEqual({
      theme: "dark",
      density: "compact",
      contextPlacement: "inline",
      afterAnswer: "next",
      palette: "carta",
      locked: ["contextPlacement"],
    });
  });

  test("locks the key when the project file sets it, and keeps the project's value", () => {
    const project: SettingsMessage = {
      ...settingsWithAfterAnswer,
      keys: {
        ...settingsWithAfterAnswer.keys,
        afterAnswer: { value: "stay", from: "project", writable: false },
      },
    };
    const presentation = presentationOf(project);
    expect(presentation.afterAnswer).toBe("stay");
    expect(presentation.locked).toEqual(["contextPlacement", "afterAnswer"]);
  });

  test("a row with no value in effect reads as the default", () => {
    const empty: SettingsMessage = {
      ...settingsWithAfterAnswer,
      keys: { ...settingsWithAfterAnswer.keys, afterAnswer: { from: "default", writable: true } },
    };
    expect(presentationOf(empty).afterAnswer).toBe("next");
  });
});
