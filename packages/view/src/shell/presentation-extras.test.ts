import { describe, expect, test } from "bun:test";
import type { BootData } from "../boot-data.ts";
import type { ViewMessage, ViewPresentation } from "../view-protocol.ts";
import type { ViewChannel } from "./channel.ts";
import { DEFAULT_PRESENTATION } from "./presentation-controls.ts";
import { startPresentation } from "./presentation-extras.ts";

const data = (presentation?: ViewPresentation) =>
  ({
    document: {},
    state: {},
    ...(presentation === undefined ? {} : { presentation }),
  }) as BootData;

const channelOf = () => {
  const listeners: ((update: { presentation?: ViewPresentation }) => void)[] = [];
  const channel = {
    send: async () => undefined,
    onUpdate: (listener: (update: { presentation?: ViewPresentation }) => void) => {
      listeners.push(listener);
      return () => undefined;
    },
    onTheme: () => () => undefined,
  } as unknown as ViewChannel;
  return {
    channel,
    update: (presentation: ViewPresentation) => {
      for (const listener of listeners) listener({ presentation });
    },
  };
};

const dark: ViewPresentation = {
  theme: "dark",
  density: "comfortable",
  contextPlacement: "inline",
  locked: ["density"],
};

describe("the quick toggles' presentation in a hosted view", () => {
  test("starts from the boot data, or from the defaults, and follows the board page's updates", () => {
    const { channel, update } = channelOf();
    const withData = startPresentation(data(dark), channel, {
      hosted: true,
      report: () => undefined,
    });
    expect(withData.presentation.get()).toEqual(dark);
    const without = startPresentation(data(), channel, { hosted: true, report: () => undefined });
    expect(without.presentation.get()).toEqual(DEFAULT_PRESENTATION);
    update({ ...dark, theme: "light" });
    expect(without.presentation.get().theme).toBe("light");
  });

  test("a toggle and Settings are reported to the board page, which answers with the update", () => {
    const { channel } = channelOf();
    const reported: ViewMessage[] = [];
    const controls = startPresentation(data(), channel, {
      hosted: true,
      report: (message) => reported.push(message),
    });
    controls.set({ key: "theme", value: "light" });
    controls.openSettings();
    expect(reported).toEqual([
      { type: "setting", key: "theme", value: "light" },
      { type: "open-settings" },
    ]);
    expect(controls.presentation.get().theme).toBe("system");
  });
});

describe("the quick toggles' presentation in a Snapshot", () => {
  test("the Theme toggle acts on the view alone, and nothing is reported", () => {
    const { channel } = channelOf();
    const reported: ViewMessage[] = [];
    const followed: string[] = [];
    const controls = startPresentation(data(), channel, {
      hosted: false,
      report: (message) => reported.push(message),
      followTheme: (preference) => followed.push(preference),
    });
    expect(controls.hosted).toBe(false);
    controls.set({ key: "theme", value: "dark" });
    controls.set({ key: "density", value: "comfortable" });
    controls.openSettings();
    expect(followed).toEqual(["dark"]);
    expect(reported).toEqual([]);
    expect(controls.presentation.get()).toEqual({ ...DEFAULT_PRESENTATION, theme: "dark" });
  });
});
