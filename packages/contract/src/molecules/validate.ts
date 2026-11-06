// The molecule formats' validators (design decision 2), each the contract's shared validation of
// its schema, a set part since widget-answers (design decision 3), returning E1's `Checked`; no
// Ajv and no error mapping of their own. A definition's format major and item count are refused
// first, saying what this contract reads, as E1's versioned validators refuse a major; then the
// schema; then the checks. Only a definition's parameters, which are data, go through the widget
// validator. Nothing is called at import: `src/validate.ts` re-exports this module and
// `../widgets/validator.ts` imports from it, and the cycle is safe only while no module of it makes
// a call at its top level.

import type { AnySchemaObject } from "ajv/dist/2020";
import { createAjv } from "../compiled.ts";
import { SCHEMA_IDS } from "../sets.ts";
import { type Checked, type Problem, validateAgainst } from "../validate.ts";
import { widgetValidator } from "../widgets/validator.ts";
import { moleculeDefinitionProblems } from "./checks.ts";
import {
  MOLECULE_FORMAT_VERSION,
  MOLECULE_FORMATS_SUPPORTED,
  MOLECULE_VERSION_PATTERN,
  type MoleculeDefinition,
  type MoleculeProps,
} from "./index.ts";

const VERSION = new RegExp(MOLECULE_VERSION_PATTERN);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Validates a molecule reference's props (AD-9). */
export const validateMoleculeProps = (value: unknown): Checked<MoleculeProps> => {
  return validateAgainst<MoleculeProps>(SCHEMA_IDS.moleculeProps, value);
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

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// The parameters compile in strict mode beside the widget props schemas, as the data validator
// will compile them, but in an Ajv of their own: parameters that fail never reach the shared
// widget validator, which would keep their `$id` for the life of the process.
const compileProblems = (parameters: AnySchemaObject): Problem[] => {
  try {
    // The contract's sets already hold every widget props schema.
    createAjv().compile(parameters);
    return [];
  } catch (error) {
    const message = `the parameters do not compile in strict mode beside the contract's widget schemas: ${messageOf(error)}`;
    return [{ path: "/parameters", message }];
  }
};

/**
 * Validates a molecule definition: its format, its schema, its checks, then its parameters'
 * compilation (design decision 2).
 */
export const validateMoleculeDefinition = (value: unknown): Checked<MoleculeDefinition> => {
  const refusal = formatRefusal(value);
  if (refusal !== undefined) return refusal;
  const checked = validateAgainst<MoleculeDefinition>(SCHEMA_IDS.moleculeDefinition, value);
  if (!checked.ok) return checked;
  const checks = moleculeDefinitionProblems(checked.value);
  const problems = checks.length > 0 ? checks : compileProblems(checked.value.parameters);
  return problems.length === 0 ? checked : { ok: false, reason: "schema", problems };
};

/**
 * The validator of a reference's data against its definition's parameters (contract spec,
 * "Molecule data validation"), in the shared widget validator beside every widget props schema,
 * so that the parameters may reference them. Nothing compiles until its first call. Problems name
 * the path in the data; the caller names the reference. For a definition that passed
 * `validateMoleculeDefinition`: the widget validator keeps the first schema of an `$id`, and
 * AskBoard ships one version per major of a molecule (design decision 2).
 */
export const moleculeDataValidator = (
  definition: MoleculeDefinition,
): ((data: unknown) => Checked<Readonly<Record<string, unknown>>>) =>
  widgetValidator<Readonly<Record<string, unknown>>>(
    [definition.parameters],
    String(definition.parameters.$id),
  );
