import { register } from "../port/index.ts";
import { formFor, noopValidator } from "./_form.tsx";

// Form (EXPERIENCE.md, Components) on RJSF 6.11.0: `tagName="div"`, no submit button, the no-op
// validator and `extraErrors` (S-4, S-7, S-8; D13, D14).
register("Form", formFor(noopValidator));
