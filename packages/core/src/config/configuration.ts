// ask-core's one reader of the configuration (settings-languages design decisions 3, 4, 6 and 13):
// both files are read the first time a setting is needed, once, and the settings in effect are kept
// for the session (AD-2, AD-14); a board reads the user file's presentation keys again, and writes
// one; the first accepted ask creates the project folders.

import type { PresentationSetting, WriteOutcome } from "@askboard/contract";
import type { Report } from "../ports.ts";
import type { Diagnose } from "../push/ports.ts";
import { configurationDiagnostics, foldersFailed } from "./diagnostics.ts";
import { type FileState, fileState } from "./file.ts";
import type { Config, FileRead } from "./ports.ts";
import { boardSettings, isPresentationSetting, outcomeOf, withSetting } from "./presentation.ts";
import { mergeSettings, type SettingsInEffect } from "./settings.ts";

const ABSENT = { status: "absent" } as const;

/** A read or write the adapter could not finish counts as an I/O error (NFR-10). */
const EIO = "EIO";
const FAILED_READ: FileRead = { kind: "unreadable", code: EIO };

/** The settings in effect, with the project file as first read, which a board's settings keep. */
type FirstRead = { readonly settings: SettingsInEffect; readonly project: FileState };

export type ConfigurationPorts = {
  readonly config?: Config;
  readonly report: Report;
  readonly diagnose?: Diagnose;
};

export class Configuration {
  readonly #ports: ConfigurationPorts;
  #first: Promise<FirstRead> | undefined;
  #settled: SettingsInEffect | undefined;
  #folders = false;
  // Writes run one after the other: each re-reads the file, so two at once would lose one change.
  #writes: Promise<unknown> = Promise.resolve();

  constructor(ports: ConfigurationPorts) {
    this.#ports = ports;
  }

  /** The settings in effect, read on the first call; every later call gets the same. */
  inEffect(): Promise<SettingsInEffect> {
    return this.#firstRead().then(({ settings }) => settings);
  }

  /** The settings in effect once the first read has settled, without waiting; else undefined. */
  get settled(): SettingsInEffect | undefined {
    return this.#settled;
  }

  /** The settings a board opens with: the user file's presentation keys as they are now. */
  async forBoard(): Promise<SettingsInEffect> {
    const first = await this.#firstRead();
    const { config } = this.#ports;
    if (config === undefined) return first.settings;
    const user = await this.#file(() => config.userFile());
    const fresh = mergeSettings({ user, project: first.project, paths: config.paths });
    return boardSettings(first.settings, fresh);
  }

  /** Writes one presentation key into the user file, unless the project file sets it. */
  write(setting: PresentationSetting): Promise<WriteOutcome> {
    const turn = this.#writes.then(() => this.#write(setting));
    this.#writes = turn.catch(() => undefined);
    return turn;
  }

  async #write(setting: PresentationSetting): Promise<WriteOutcome> {
    const { key } = setting;
    if (!isPresentationSetting(setting)) return { key, outcome: "refused", reason: "invalid" };
    const { config, report } = this.#ports;
    if (config === undefined) return { key, outcome: "failed", reason: "no-user-file" };
    const { settings } = await this.#firstRead();
    if (!settings.rows[key].writable) return { key, outcome: "refused", reason: "set-by-project" };
    try {
      return outcomeOf(key, await config.replaceUserFile(withSetting(setting)), config.paths.user);
    } catch (error) {
      report(error);
      return outcomeOf(key, { kind: "failed", code: EIO }, config.paths.user);
    }
  }

  /**
   * Creates the project folders, once, at the first accepted ask, without waiting for them: a
   * failure is said on stderr and never refuses the ask (design decision 13).
   */
  ensureFolders(): void {
    const { config, report } = this.#ports;
    if (config === undefined || this.#folders) return;
    this.#folders = true;
    config.ensureProjectFolders().then((result) => {
      if (result.kind === "failed") this.#say(foldersFailed(result));
    }, report);
  }

  // A line for stderr, through `diagnose`, else as a failure `Report` takes.
  #say(line: string): void {
    const { diagnose, report } = this.#ports;
    if (diagnose === undefined) report(new Error(line));
    else diagnose(line);
  }

  #firstRead(): Promise<FirstRead> {
    this.#first ??= this.#read().then((first) => {
      this.#settled = first.settings;
      for (const line of configurationDiagnostics(first.settings)) this.#ports.diagnose?.(line);
      return first;
    });
    return this.#first;
  }

  async #read(): Promise<FirstRead> {
    const { config } = this.#ports;
    if (config === undefined) {
      return {
        settings: mergeSettings({ user: ABSENT, project: ABSENT, paths: {} }),
        project: ABSENT,
      };
    }
    const [user, project] = await Promise.all([
      this.#file(() => config.userFile()),
      this.#file(() => config.projectFile()),
    ]);
    return { settings: mergeSettings({ user, project, paths: config.paths }), project };
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
