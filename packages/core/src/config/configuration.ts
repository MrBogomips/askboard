// ask-core's one reader of the configuration (settings-languages design decisions 3 and 4): both
// files are read the first time a setting is needed, once, and the settings in effect are kept for
// the session (AD-2, AD-14).

import type { Report } from "../ports.ts";
import type { Diagnose } from "../push/ports.ts";
import { configurationDiagnostics } from "./diagnostics.ts";
import { fileState } from "./file.ts";
import type { Config, FileRead } from "./ports.ts";
import { mergeSettings, type SettingsInEffect } from "./settings.ts";

const ABSENT = { status: "absent" } as const;

/** A read the adapter could not finish counts as a file that cannot be read (NFR-10). */
const FAILED_READ: FileRead = { kind: "unreadable", code: "EIO" };

export type ConfigurationPorts = {
  readonly config?: Config;
  readonly report: Report;
  readonly diagnose?: Diagnose;
};

export class Configuration {
  readonly #ports: ConfigurationPorts;
  #first: Promise<SettingsInEffect> | undefined;

  constructor(ports: ConfigurationPorts) {
    this.#ports = ports;
  }

  /** The settings in effect, read on the first call; every later call gets the same. */
  inEffect(): Promise<SettingsInEffect> {
    this.#first ??= this.#read().then((settings) => {
      for (const line of configurationDiagnostics(settings)) this.#ports.diagnose?.(line);
      return settings;
    });
    return this.#first;
  }

  async #read(): Promise<SettingsInEffect> {
    const { config } = this.#ports;
    if (config === undefined) return mergeSettings({ user: ABSENT, project: ABSENT, paths: {} });
    const [user, project] = await Promise.all([
      this.#file(() => config.userFile()),
      this.#file(() => config.projectFile()),
    ]);
    return mergeSettings({ user, project, paths: config.paths });
  }

  async #file(read: () => Promise<FileRead>) {
    try {
      return fileState(await read());
    } catch (error) {
      this.#ports.report(error);
      return fileState(FAILED_READ);
    }
  }
}
