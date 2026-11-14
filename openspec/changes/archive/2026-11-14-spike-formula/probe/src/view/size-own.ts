// Size only (criterion 3): the own engine's factory, kept by a global so nothing is shaken out.

import { createOwnEngine } from "../own/engine.ts";

Object.assign(globalThis, { __formulaEngine: createOwnEngine });
