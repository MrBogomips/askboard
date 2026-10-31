import { describe, expect, test } from "bun:test";
import { type Detection, detect } from "../../src/notifier/index.ts";

// Board-host spec, When no board can be shown and Opening a board in the browser (task 6.5): AD-18's
// detection rule as a table over the platform, the environment, the two marker files and `PATH`,
// row by row in the rule's order. E1 has no container opt-in, so a container never shows a board.

type Row = {
  readonly what: string;
  readonly platform: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly files?: readonly string[];
  readonly path?: readonly string[];
  readonly expected: Detection;
};

const opener = (command: string): Detection => ({ showable: true, opener: command });
const unavailable = (reason: string, detail: RegExp) => ({ reason, detail });

const ROWS: readonly (Omit<Row, "expected"> & {
  expected: Detection | { reason: string; detail: RegExp };
})[] = [
  // 1. A remote host, whatever else holds.
  {
    what: "SSH_CONNECTION",
    platform: "darwin",
    env: { SSH_CONNECTION: "10.0.0.2 52000 10.0.0.1 22", BROWSER: "/bin/rec" },
    path: ["open"],
    expected: unavailable("remote-host", /SSH_CONNECTION/),
  },
  {
    what: "SSH_TTY",
    platform: "linux",
    env: { SSH_TTY: "/dev/pts/0", DISPLAY: ":0" },
    path: ["xdg-open"],
    expected: unavailable("remote-host", /SSH_TTY/),
  },
  {
    what: "CODESPACES",
    platform: "linux",
    env: { CODESPACES: "true" },
    files: ["/.dockerenv"],
    expected: unavailable("remote-host", /CODESPACES/),
  },
  // 2. A container, even with BROWSER and a display: E1 has no opt-in.
  {
    what: "/.dockerenv",
    platform: "linux",
    env: { BROWSER: "/bin/rec", DISPLAY: ":0" },
    files: ["/.dockerenv"],
    path: ["xdg-open"],
    expected: unavailable("container", /\/\.dockerenv/),
  },
  {
    what: "/run/.containerenv",
    platform: "linux",
    files: ["/run/.containerenv"],
    expected: unavailable("container", /\/run\/\.containerenv/),
  },
  {
    what: "REMOTE_CONTAINERS",
    platform: "linux",
    env: { REMOTE_CONTAINERS: "true", CI: "true" },
    expected: unavailable("container", /REMOTE_CONTAINERS/),
  },
  {
    what: "DEVCONTAINER",
    platform: "darwin",
    env: { DEVCONTAINER: "1" },
    path: ["open"],
    expected: unavailable("container", /DEVCONTAINER/),
  },
  // 3. CI without BROWSER.
  {
    what: "CI without BROWSER",
    platform: "darwin",
    env: { CI: "true" },
    path: ["open"],
    expected: unavailable("ci", /CI.*BROWSER/),
  },
  {
    what: "GITHUB_ACTIONS without BROWSER",
    platform: "linux",
    env: { GITHUB_ACTIONS: "true", DISPLAY: ":0" },
    path: ["xdg-open"],
    expected: unavailable("ci", /GITHUB_ACTIONS.*BROWSER/),
  },
  {
    what: "CI with an empty BROWSER",
    platform: "linux",
    env: { CI: "1", BROWSER: "" },
    expected: unavailable("ci", /BROWSER/),
  },
  // 4. The openers, in order.
  {
    what: "CI with BROWSER",
    platform: "linux",
    env: { CI: "true", BROWSER: "/opt/recorder" },
    expected: opener("/opt/recorder"),
  },
  {
    what: "BROWSER before open, taken as one command",
    platform: "darwin",
    env: { BROWSER: "firefox --new-tab" },
    path: ["open"],
    expected: opener("firefox --new-tab"),
  },
  { what: "open on macOS", platform: "darwin", path: ["open"], expected: opener("open") },
  {
    what: "macOS without open",
    platform: "darwin",
    expected: unavailable("no-browser", /BROWSER/),
  },
  {
    what: "wslview under WSL",
    platform: "linux",
    env: { WSL_DISTRO_NAME: "Ubuntu", DISPLAY: ":0" },
    path: ["wslview", "explorer.exe", "xdg-open"],
    expected: opener("wslview"),
  },
  {
    what: "explorer.exe under WSL",
    platform: "linux",
    env: { WSL_INTEROP: "/run/WSL/1_interop" },
    path: ["explorer.exe", "xdg-open"],
    expected: opener("explorer.exe"),
  },
  {
    what: "xdg-open under WSL with a display",
    platform: "linux",
    env: { WSL_DISTRO_NAME: "Ubuntu", WAYLAND_DISPLAY: "wayland-0" },
    path: ["xdg-open"],
    expected: opener("xdg-open"),
  },
  {
    what: "xdg-open with DISPLAY",
    platform: "linux",
    env: { DISPLAY: ":0" },
    path: ["xdg-open"],
    expected: opener("xdg-open"),
  },
  {
    what: "xdg-open with WAYLAND_DISPLAY",
    platform: "linux",
    env: { WAYLAND_DISPLAY: "wayland-0" },
    path: ["xdg-open"],
    expected: opener("xdg-open"),
  },
  {
    what: "Linux with xdg-open but no display",
    platform: "linux",
    env: { DISPLAY: "", PATH: "/usr/bin" },
    path: ["xdg-open"],
    expected: unavailable("no-browser", /DISPLAY.*WAYLAND_DISPLAY/),
  },
  {
    what: "Linux with a display but no xdg-open",
    platform: "linux",
    env: { DISPLAY: ":0" },
    expected: unavailable("no-browser", /xdg-open/),
  },
  { what: "native Windows", platform: "win32", expected: unavailable("no-browser", /BROWSER/) },
  // An empty variable counts as unset.
  {
    what: "empty remote and container variables",
    platform: "darwin",
    env: { SSH_CONNECTION: "", SSH_TTY: "", CODESPACES: "", DEVCONTAINER: "", CI: "" },
    path: ["open"],
    expected: opener("open"),
  },
];

describe("the detection rule", () => {
  for (const row of ROWS) {
    test(row.what, () => {
      const looked: string[] = [];
      const detection = detect({
        platform: row.platform,
        env: row.env ?? {},
        exists: (file) => {
          looked.push(file);
          return (row.files ?? []).includes(file);
        },
        onPath: (command) => (row.path ?? []).includes(command),
      });
      if ("detail" in row.expected && row.expected.detail instanceof RegExp) {
        expect(detection.showable).toBe(false);
        if (detection.showable) return;
        expect(detection.reason).toBe(row.expected.reason as never);
        expect(detection.detail).toMatch(row.expected.detail);
        // The detail names only variables, files and opener commands, never a value.
        for (const value of Object.values(row.env ?? {})) {
          if (value.length > 3) expect(detection.detail).not.toContain(value);
        }
      } else {
        expect(detection).toEqual(row.expected as Detection);
      }
    });
  }

  test("looks only at the two marker files", () => {
    const looked: string[] = [];
    detect({
      platform: "linux",
      env: {},
      exists: (file) => {
        looked.push(file);
        return false;
      },
      onPath: () => false,
    });
    expect(looked.sort()).toEqual(["/.dockerenv", "/run/.containerenv"]);
  });
});
