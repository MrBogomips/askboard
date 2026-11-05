import { describe, expect, test } from "bun:test";
import type { BootData } from "../boot-data.ts";
import type { ViewPresentation } from "../view-protocol.ts";
import type { ViewChannel } from "./channel.ts";
import { placementOf } from "./context-placement.ts";
import { startPresentation } from "./presentation-extras.ts";

// The context-placement default at the seam the excerpts' epic reads (settings-languages, task
// 8.5, "Inline by default"): the view's presentation holds it from the boot data and from each
// update, and a question's own choice overrides it on that question alone.

const inline: ViewPresentation = {
  theme: "system",
  density: "compact",
  contextPlacement: "inline",
  locked: [],
};

const startWith = (boot: ViewPresentation) => {
  const listeners: ((update: { presentation?: ViewPresentation }) => void)[] = [];
  const channel = {
    send: async () => undefined,
    onUpdate: (listener: (update: { presentation?: ViewPresentation }) => void) => {
      listeners.push(listener);
      return () => undefined;
    },
  } as unknown as ViewChannel;
  const controls = startPresentation(
    { document: {}, state: {}, presentation: boot } as BootData,
    channel,
    {
      hosted: true,
      report: () => undefined,
    },
  );
  const update = (presentation: ViewPresentation) => {
    for (const listener of listeners) listener({ presentation });
  };
  return { controls, update };
};

describe("the context placement of a question", () => {
  test("inline by default puts every question's context under its text", () => {
    const { controls } = startWith(inline);
    for (const override of [undefined, undefined]) {
      expect(placementOf(controls.presentation.get(), override)).toBe("inline");
    }
  });

  test("a question's own choice overrides the default on that question only", () => {
    const { controls } = startWith(inline);
    const presentation = controls.presentation.get();
    expect(placementOf(presentation, "beside")).toBe("beside");
    expect(placementOf(presentation)).toBe("inline");
  });

  test("a change of the default in the settings panel reaches a question with no override", () => {
    const { controls, update } = startWith(inline);
    update({ ...inline, contextPlacement: "beside" });
    expect(placementOf(controls.presentation.get())).toBe("beside");
    expect(placementOf(controls.presentation.get(), "inline")).toBe("inline");
  });
});
