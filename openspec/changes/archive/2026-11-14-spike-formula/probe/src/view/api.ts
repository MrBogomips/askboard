// The instrument script's API as the engine chunks see it.

export interface ViewApi {
  post(kind: string, data?: Record<string, unknown>): void;
  done(): void;
  now(): number;
  readonly snapshot: boolean;
}

export function view(): ViewApi {
  const api = (globalThis as { __probeView?: ViewApi }).__probeView;
  if (!api) throw new Error("the instrument script did not run");
  return api;
}

/** The run's parameters, from the view document's JSON data block. */
export interface ViewParams {
  readonly mode: "smoke" | "suite" | "timing" | "latency" | "async-loader";
  readonly repeats?: number;
}

export function params(): ViewParams {
  const block = document.getElementById("probe-data");
  return JSON.parse(block?.textContent ?? "{}") as ViewParams;
}
