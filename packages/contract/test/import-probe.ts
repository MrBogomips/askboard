// Run as its own process by push-schemas.test.ts: it counts every Ajv call while the contract's
// three entry modules load, then while one push delivery validator runs. A fresh process holds no
// module another test loaded, so the first count is what importing alone does.

import Ajv2020 from "ajv/dist/2020";

const calls: string[] = [];
const methods = ["addSchema", "addMetaSchema", "compile", "getSchema", "validate"] as const;
const prototype = Ajv2020.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
for (const method of methods) {
  const original = prototype[method];
  if (original === undefined) throw new Error(`Ajv has no method ${method}`);
  prototype[method] = function (this: unknown, ...args: unknown[]) {
    calls.push(method);
    return original.apply(this, args);
  };
}

await import("../src/index.ts");
await import("../src/fixtures/index.ts");
const { validateLocalApi } = await import("../src/validate.ts");
const atImport = calls.length;
validateLocalApi("recordsResponse", { version: "1.0" });
console.log(JSON.stringify({ atImport, afterValidation: calls.length }));
