import validator from "@rjsf/validator-ajv8";
import { register } from "../port/index.ts";
import { formFor } from "./_form.tsx";

// S-4's negative control, in a chunk of its own: the Form with `@rjsf/validator-ajv8`, validating
// live, so a change makes Ajv compile the schema, which the CSP should block.
register("FormAjv", formFor(validator, true));
