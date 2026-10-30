// The environment a compiled run records (the executable has no run.ts).

export function exeEnvironment(): Record<string, unknown> {
  const versions = process.versions as Record<string, string | undefined>;
  return {
    runtime: `bun ${versions.bun} (compiled executable)`,
    platform: `${process.platform} ${process.arch}`,
    executable: process.execPath,
    cwd: process.cwd(),
    tz: process.env.TZ ?? null,
    lang: process.env.LANG ?? null,
    resolvedTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    date: new Date().toISOString(),
  };
}
