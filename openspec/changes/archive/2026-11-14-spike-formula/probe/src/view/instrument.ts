// The view's first inline script (design decision 4). It records CSP violations, errors,
// unhandled rejections and the view's timing marks, and posts each event to the board page.
// A Snapshot has no parent: events stay in `__probeEvents`, and `done` also writes them into
// the page as text, so the driver can read them either way.

type ProbeEvent = { askboardProbe: 1; kind: string; t: number; [key: string]: unknown };

const host = window.parent !== window ? window.parent : null;
const events: ProbeEvent[] = [];
// An absolute time, comparable with the board page's t0 (both share the wall clock).
const now = (): number => performance.timeOrigin + performance.now();

const post = (kind: string, data: Record<string, unknown> = {}): void => {
  const event: ProbeEvent = { askboardProbe: 1, kind, t: now(), ...data };
  events.push(event);
  if (!host) return;
  try {
    host.postMessage(event, "*");
  } catch (error) {
    events.push({ askboardProbe: 1, kind: "post-failed", t: now(), message: String(error) });
  }
};

document.addEventListener("securitypolicyviolation", (e) => {
  post("violation", {
    directive: e.effectiveDirective,
    violated: e.violatedDirective,
    blockedURI: e.blockedURI,
    sample: e.sample,
    source: e.sourceFile,
    disposition: e.disposition,
    policy: e.originalPolicy,
  });
});
window.addEventListener("error", (e) => {
  post("error", { message: e.message, source: e.filename, line: e.lineno });
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason as { message?: unknown; name?: unknown } | undefined;
  post("rejection", { name: String(reason?.name ?? ""), message: String(reason?.message ?? e.reason) });
});

// The smallest step of the clock: browsers coarsen it without cross-origin isolation, which
// bounds what a single-edit time can show.
const clockStep = (): number => {
  let step = Number.POSITIVE_INFINITY;
  for (let i = 0, last = performance.now(); i < 20000 && step > 0.001; i++) {
    const t = performance.now();
    if (t > last) step = Math.min(step, t - last);
    last = t;
  }
  return Math.round(step * 1000) / 1000;
};
// Measured after the run, so nothing here delays the chunk's timing marks.
const done = (): void => {
  // Intl's first use costs milliseconds in Chromium: read only after the run.
  post("done", {
    clockStepMs: clockStep(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    language: navigator.language,
    offsetMinutes: new Date(Date.UTC(2026, 0, 1)).getTimezoneOffset(),
  });
  const pre = document.createElement("pre");
  pre.id = "probe-results";
  pre.textContent = JSON.stringify(events);
  document.body.append(pre);
};

const api = { post, done, now, snapshot: host === null };
Object.assign(window, { __probeEvents: events, __probeView: api });
post("instrument");
