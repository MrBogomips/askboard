// The molecule formats' validators (design decision 2), each the shared widget validator of its
// schema, returning E1's `Checked`; no Ajv and no error mapping of their own. A definition's
// format major and item count are refused first, saying what this contract reads, as E1's
// versioned validators refuse a major; then the schema; then the checks. Each widget validator is
// made on the first call, not at import: `src/validate.ts` re-exports this module and
// `../widgets/validator.ts` imports from it, and the cycle is safe only while no module of it makes
// a call at its top level.

import type { Checked } from "../validate.ts";
import { widgetValidator } from "../widgets/validator.ts";
import { moleculeDefinitionProblems } from "./checks.ts";
import {
  MOLECULE_FORMAT_VERSION,
  MOLECULE_FORMATS_SUPPORTED,
  MOLECULE_VERSION_PATTERN,
  type MoleculeDefinition,
  type MoleculeProps,
} from "./index.ts";
import moleculeDefinition from "./molecule-definition.json" with { type: "json" };
import moleculeProps from "./molecule-props.json" with { type: "json" };

const VERSION = new RegExp(MOLECULE_VERSION_PATTERN);

let propsSchema: ((value: unknown) => Checked<MoleculeProps>) | undefined;
let definitionSchema: ((value: unknown) => Checked<MoleculeDefinition>) | undefined;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Validates a molecule reference's props (AD-9). */
export const validateMoleculeProps = (value: unknown): Checked<MoleculeProps> => {
  propsSchema ??= widgetValidator<MoleculeProps>([moleculeProps], moleculeProps.$id);
  return propsSchema(value);
};

// A format whose major this contract does not read, or a composition of other than one item.
const formatRefusal = (value: unknown): Checked<MoleculeDefinition> | undefined => {
  if (!isRecord(value)) return undefined;
  const { format, items } = value;
  if (typeof format === "string" && VERSION.test(format)) {
    if (!MOLECULE_FORMATS_SUPPORTED.includes(Number(format.split(".")[0]))) {
      const reads = MOLECULE_FORMATS_SUPPORTED.join(", ");
      const message = `the definition follows molecule format ${format}, which is not supported: this contract reads format ${reads} (${MOLECULE_FORMAT_VERSION})`;
      return { ok: false, reason: "version", problems: [{ path: "/format", message }] };
    }
  }
  if (Array.isArray(items) && items.length !== 1) {
    const message = `molecule format ${MOLECULE_FORMAT_VERSION} composes exactly one item, and this definition holds ${items.length}`;
    return { ok: false, reason: "schema", problems: [{ path: "/items", message }] };
  }
  return undefined;
};

/** Validates a molecule definition: its format, its schema, then its checks (design decision 2). */
export const validateMoleculeDefinition = (value: unknown): Checked<MoleculeDefinition> => {
  const refusal = formatRefusal(value);
  if (refusal !== undefined) return refusal;
  definitionSchema ??= widgetValidator<MoleculeDefinition>(
    [moleculeDefinition],
    moleculeDefinition.$id,
  );
  const checked = definitionSchema(value);
  if (!checked.ok) return checked;
  const problems = moleculeDefinitionProblems(checked.value);
  return problems.length === 0 ? checked : { ok: false, reason: "schema", problems };
};
