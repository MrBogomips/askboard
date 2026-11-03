// AD-18's detection rule as a pure function (design decision 6): whether a board can be shown on
// this machine and with which opener, in the rule's order. A remote host, then a container, then CI
// without `BROWSER` are unshowable; otherwise the first opener found: `BROWSER`, `open` on macOS,
// `wslview` or `explorer.exe` under WSL, `xdg-open` on Linux with a display. E1 has no container
// opt-in, so a container never shows a board. A detail names only variables, files and opener
// commands, never a value: it reaches the agent.

import type { UnavailableReason } from "@askboard/contract";

export type Environment = Readonly<Record<string, string | undefined>>;

export type DetectionInput = {
  /** `process.platform`. */
  readonly platform: string;
  readonly env: Environment;
  /** Whether a file exists; asked only of the container marker files. */
  readonly exists: (path: string) => boolean;
  /** Whether a command is found on `PATH`. */
  readonly onPath: (command: string) => boolean;
};

export type Detection =
  | { readonly showable: true; readonly opener: string }
  | { readonly showable: false; readonly reason: UnavailableReason; readonly detail: string };

const REMOTE_VARIABLES = ["SSH_CONNECTION", "SSH_TTY", "CODESPACES"] as const;
const CONTAINER_FILES = ["/.dockerenv", "/run/.containerenv"] as const;
const CONTAINER_VARIABLES = ["REMOTE_CONTAINERS", "DEVCONTAINER"] as const;
const CI_VARIABLES = ["CI", "GITHUB_ACTIONS"] as const;
const WSL_VARIABLES = ["WSL_DISTRO_NAME", "WSL_INTEROP"] as const;
const DISPLAY_VARIABLES = ["DISPLAY", "WAYLAND_DISPLAY"] as const;
const WSL_OPENERS = ["wslview", "explorer.exe"] as const;

// An empty variable counts as unset.
const isSet = (env: Environment, name: string) => (env[name] ?? "") !== "";

/** Whether the environment is WSL's, where Linux runs under Windows. */
export const isWsl = (env: Environment): boolean => WSL_VARIABLES.some((name) => isSet(env, name));

const unshowable = (reason: UnavailableReason, detail: string): Detection => ({
  showable: false,
  reason,
  detail,
});

/** Whether a board can be shown, and with which opener. */
export const detect = ({ platform, env, exists, onPath }: DetectionInput): Detection => {
  const set = (name: string) => isSet(env, name);
  const remote = REMOTE_VARIABLES.find(set);
  if (remote !== undefined) return unshowable("remote-host", `${remote} is set`);
  const marker = CONTAINER_FILES.find((file) => exists(file));
  if (marker !== undefined) return unshowable("container", `${marker} exists`);
  const container = CONTAINER_VARIABLES.find(set);
  if (container !== undefined) return unshowable("container", `${container} is set`);
  const browser = env.BROWSER ?? "";
  const ci = CI_VARIABLES.find(set);
  if (ci !== undefined && browser === "") {
    return unshowable("ci", `${ci} is set and BROWSER is not`);
  }
  // `BROWSER` is one command, never split.
  if (browser !== "") return { showable: true, opener: browser };
  if (platform === "darwin") {
    return onPath("open")
      ? { showable: true, opener: "open" }
      : unshowable("no-browser", "BROWSER is not set and open is not on PATH");
  }
  if (platform !== "linux") {
    return unshowable("no-browser", `BROWSER is not set and ${platform} has no opener`);
  }
  if (isWsl(env)) {
    const wsl = WSL_OPENERS.find(onPath);
    if (wsl !== undefined) return { showable: true, opener: wsl };
  }
  if (!DISPLAY_VARIABLES.some(set)) {
    return unshowable(
      "no-browser",
      "BROWSER is not set, and xdg-open needs DISPLAY or WAYLAND_DISPLAY, neither of which is set",
    );
  }
  return onPath("xdg-open")
    ? { showable: true, opener: "xdg-open" }
    : unshowable("no-browser", "BROWSER is not set and xdg-open is not on PATH");
};
