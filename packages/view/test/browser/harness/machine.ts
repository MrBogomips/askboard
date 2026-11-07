// The machine a measurement ran on, for the notes of the probe's tasks.

import { cpus, platform, release, totalmem } from "node:os";

export const machineOf = (): string =>
  `${platform()} ${release()}, ${cpus()[0]?.model ?? "?"} x${cpus().length}, ${Math.round(totalmem() / 2 ** 30)} GiB`;
