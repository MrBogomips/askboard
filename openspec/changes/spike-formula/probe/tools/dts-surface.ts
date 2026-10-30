// Extracts the declared surface of a wasm-bindgen `wasm.d.ts` as a map from a stable key
// ("function initSync", "Model.evaluate", "interface Area") to a whitespace-normalised signature,
// so two releases can be diffed key by key. Line-and-brace based: the files are generated and regular.

export interface Surface {
  exported: Map<string, string>;
  // Non-exported declarations are invisible to importers, but exported signatures name them,
  // so a change there can still break a caller.
  local: Map<string, string>;
  // InitOutput lists the raw WebAssembly exports; it changes with every build and is not API.
  initOutputMembers: number;
}

const BLOCK_START = /^(export\s+)?(declare\s+)?(default\s+)?(abstract\s+)?(class|interface|enum|namespace|module)\b/;

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

export function normalise(sig: string): string {
  return sig
    .replace(/\s+/g, " ")
    .replace(/([([{<]) /g, "$1")
    .replace(/ ([)\]}>,;])/g, "$1")
    .replace(/;$/, "")
    .trim();
}

// Splits at `;` on depth 0, and after a block statement's closing brace.
function splitStatements(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") {
      depth--;
      if (ch === "}" && depth === 0 && BLOCK_START.test(text.slice(start, i).trim())) {
        out.push(text.slice(start, i + 1).trim());
        start = i + 1;
      }
    } else if (ch === ";" && depth === 0) {
      out.push(text.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out.filter((s) => s.length > 0 && s !== ";");
}

function body(stmt: string): string {
  return stmt.slice(stmt.indexOf("{") + 1, stmt.lastIndexOf("}"));
}

function memberKey(member: string): string {
  const m = member.match(/^(static\s+)?(readonly\s+)?(get\s+|set\s+)?(\[[^\]]+\]|[A-Za-z_$][\w$]*)/);
  if (!m) return normalise(member);
  return `${m[1] ? "static " : ""}${m[3] ? m[3].trim() + " " : ""}${m[4]}`;
}

function addEntry(map: Map<string, string>, key: string, sig: string): void {
  // Overloads share a key; keep them all, in a stable order.
  const prev = map.get(key);
  map.set(key, prev === undefined ? sig : [prev, sig].sort().join(" | "));
}

function addClass(map: Map<string, string>, name: string, stmt: string): void {
  addEntry(map, `class ${name}`, normalise(stmt.slice(0, stmt.indexOf("{"))));
  for (const member of splitStatements(body(stmt))) {
    addEntry(map, `${name}.${memberKey(member)}`, normalise(member));
  }
}

export function extractSurface(dts: string): Surface {
  const exported = new Map<string, string>();
  const local = new Map<string, string>();
  let initOutputMembers = 0;
  for (const stmt of splitStatements(stripComments(dts))) {
    const isExport = /^export\b/.test(stmt);
    const target = isExport ? exported : local;
    const head = stmt.replace(/^export\s+(declare\s+)?/, "").replace(/^declare\s+/, "");
    let m: RegExpMatchArray | null;
    if (/^default\s+function\b/.test(head)) addEntry(target, "default", normalise(head));
    else if ((m = head.match(/^(?:abstract\s+)?class\s+([\w$]+)/))) addClass(target, m[1] ?? "", head);
    else if ((m = head.match(/^interface\s+([\w$]+)/))) {
      if (m[1] === "InitOutput") initOutputMembers = splitStatements(body(head)).length;
      else addEntry(target, `interface ${m[1]}`, normalise(head));
    } else if ((m = head.match(/^(?:const\s+)?enum\s+([\w$]+)/))) addEntry(target, `enum ${m[1]}`, normalise(head));
    else if ((m = head.match(/^type\s+([\w$]+)/))) addEntry(target, `type ${m[1]}`, normalise(head));
    else if ((m = head.match(/^function\s+([\w$]+)/))) addEntry(target, `function ${m[1]}`, normalise(head));
    else if ((m = head.match(/^(?:const|let|var)\s+([\w$]+)/))) addEntry(target, `const ${m[1]}`, normalise(head));
    else addEntry(target, `other ${normalise(head).slice(0, 60)}`, normalise(head));
  }
  return { exported, local, initOutputMembers };
}

// Splits at a separator on depth 0 of (), [], {} and <>.
function splitTop(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? "";
    if ("([{<".includes(ch)) depth++;
    else if (")]}".includes(ch) || (ch === ">" && text[i - 1] !== "=")) depth--;
    else if (ch === sep && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter((p) => p.length > 0);
}

interface Param {
  optional: boolean;
  types: Set<string>;
}

function parseCallable(sig: string): { params: Param[]; ret: string } | null {
  const open = sig.indexOf("(");
  if (open < 0) return null;
  let depth = 0;
  let close = -1;
  for (let i = open; i < sig.length; i++) {
    if (sig[i] === "(") depth++;
    else if (sig[i] === ")" && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close < 0) return null;
  const params = splitTop(sig.slice(open + 1, close), ",").map((p) => {
    const colon = splitTop(p, ":");
    const name = colon[0] ?? "";
    const type = p.slice(p.indexOf(":") + 1).trim();
    return { optional: name.endsWith("?"), types: new Set(splitTop(type, "|")) };
  });
  return { params, ret: sig.slice(close + 1).replace(/^:\s*/, "").trim() };
}

// A caller written against `from` still compiles against `to` when no required parameter is
// added, no parameter is removed, every old parameter type is still accepted and the return
// type is unchanged. Parameter names do not matter to a caller.
export function classifyChange(from: string, to: string): { breaking: boolean; reason: string } {
  const isType = /^(interface|type|enum|class)\s/;
  const a = isType.test(from) ? null : parseCallable(from);
  const b = isType.test(to) ? null : parseCallable(to);
  if (!a || !b) return { breaking: true, reason: "type declaration changed (not analysed)" };
  const reasons: string[] = [];
  const requiredB = b.params.filter((p) => !p.optional).length;
  if (requiredB > a.params.length) reasons.push(`required parameters ${a.params.length} -> ${requiredB}`);
  if (b.params.length < a.params.length) reasons.push(`parameters removed (${a.params.length} -> ${b.params.length})`);
  a.params.forEach((p, i) => {
    const q = b.params[i];
    if (!q) return;
    if (q.types.has("any")) return;
    const lost = [...p.types].filter((t) => !q.types.has(t));
    if (lost.length > 0) reasons.push(`parameter ${i + 1} no longer accepts ${lost.join(" | ")}`);
  });
  if (a.ret !== b.ret) reasons.push(`return type ${a.ret} -> ${b.ret}`);
  if (reasons.length > 0) return { breaking: true, reason: reasons.join("; ") };
  return { breaking: false, reason: "compatible: parameter names or widened types only" };
}

export interface SurfaceDiff {
  added: string[];
  removed: string[];
  changed: { key: string; from: string; to: string }[];
}

export function diffSurface(prev: Map<string, string>, next: Map<string, string>): SurfaceDiff {
  const added = [...next.keys()].filter((k) => !prev.has(k)).sort();
  const removed = [...prev.keys()].filter((k) => !next.has(k)).sort();
  const changed = [...next.keys()]
    .filter((k) => prev.has(k) && prev.get(k) !== next.get(k))
    .sort()
    .map((key) => ({ key, from: prev.get(key) ?? "", to: next.get(key) ?? "" }));
  return { added, removed, changed };
}
