// IronCalc's module, inlined in the chunk as base64 (the view may load nothing), decoded with
// atob, which every supported engine has (Uint8Array.fromBase64 is newer).

import base64 from "probe:ironcalc-wasm-base64";

export function wasmBytes(): Uint8Array {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}
