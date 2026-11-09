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
  const snapshotControls = (initial?: ViewPresentation) => {
    const { channel } = channelOf();
    const reported: ViewMessage[] = [];
    const followedTheme: string[] = [];
    const followedDensity: string[] = [];
    const controls = startPresentation(data(), channel, {
      hosted: false,
      report: (message) => reported.push(message),
      followTheme: (preference) => followedTheme.push(preference),
      followDensity: (density) => followedDensity.push(density),
      ...(initial === undefined ? {} : { initial }),
    });
    return { controls, reported, followedTheme, followedDensity };
  };

  test("the Theme toggle acts on the view alone, and nothing is reported", () => {
    const { controls, reported, followedTheme } = snapshotControls();
    expect(controls.hosted).toBe(false);
    controls.set({ key: "theme", value: "dark" });
    controls.openSettings();
    expect(followedTheme).toEqual(["dark"]);
    expect(reported).toEqual([]);
    expect(controls.presentation.get()).toEqual({ ...DEFAULT_PRESENTATION, theme: "dark" });
  });

  test("the density toggle follows the density on the page and sets the store, reporting nothing", () => {
    const { controls, reported, followedTheme, followedDensity } = snapshotControls();
    controls.set({ key: "density", value: "comfortable" });
    expect(followedDensity).toEqual(["comfortable"]);
    expect(followedTheme).toEqual([]);
    expect(reported).toEqual([]);
    expect(controls.presentation.get().density).toBe("comfortable");
  });

  test("starts from the initial presentation a Snapshot's record gave, not the block's", () => {
    const initial = { ...DEFAULT_PRESENTATION, theme: "light", density: "comfortable" } as const;
    expect(snapshotControls(initial).controls.presentation.get()).toEqual(initial);
  });

  test("a hosted density toggle is reported and followed by nothing", () => {
    const { channel } = channelOf();
    const reported: ViewMessage[] = [];
    const followed: string[] = [];
    const controls = startPresentation(data(), channel, {
      hosted: true,
      report: (message) => reported.push(message),
      followDensity: (density) => followed.push(density),
    });
    controls.set({ key: "density", value: "comfortable" });
    expect(reported).toEqual([{ type: "setting", key: "density", value: "comfortable" }]);
    expect(followed).toEqual([]);
  });
});
