// The checks every request to the board listener passes first (AD-11): `Host` is a loopback name
// on any port, which defeats DNS rebinding; `Origin`, when present, is `http://` plus that `Host`,
// and WebSocket upgrades and requests other than GET or HEAD must carry it, which defeats CSRF and
// cross-site sockets. Browsers send no `Origin` on navigations and same-origin GETs [F31], so the
// user's own click on the link passes.

const LOOPBACK_NAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

// A name, or an IPv6 literal in brackets, with an optional port.
const HOST = /^(\[[0-9A-Fa-f:.]+\]|[^:[\]]+)(?::([0-9]{1,5}))?$/;

/** Whether a `Host` header names this machine's loopback, on any port. */
export const isLoopbackHost = (host: string | undefined): boolean => {
  const match = host === undefined ? null : HOST.exec(host);
  return match !== null && LOOPBACK_NAMES.has((match[1] ?? "").toLowerCase());
};

export type GateInput = {
  readonly host: string | undefined;
  readonly origin: string | undefined;
  readonly method: string | undefined;
  readonly upgrade: boolean;
};

/** Why a request is refused before any route sees it, or undefined when it passes. */
export const gateRefusal = ({ host, origin, method, upgrade }: GateInput): string | undefined => {
  if (!isLoopbackHost(host)) return "the Host header does not name the loopback interface";
  if (origin !== undefined && origin.toLowerCase() !== `http://${host}`.toLowerCase()) {
    return "the Origin header does not match the Host header";
  }
  const needsOrigin = upgrade || (method !== "GET" && method !== "HEAD");
  if (needsOrigin && origin === undefined) return "the request carries no Origin header";
  return undefined;
};
