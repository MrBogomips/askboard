// How a request's wording reads a Scale's props (approval-scale-ranking, design decision 1): the
// expected shape and the field list of its one object, keyed `scale.props…`. Nothing here validates.

import { text } from "../wording-parts.ts";
import {
  SCALE_BOUND,
  SCALE_LABEL_MAX_CHARS,
  SCALE_MAX_STEPS,
  SCALE_RATING_MAX_VALUES,
  SCALE_UNIT_MAX_CHARS,
} from "./constants.ts";

export const SCALE_EXPECTED: Readonly<Record<string, string>> = {
  "scale.props": "a Scale's props {min, max, step?, range?, display?, minLabel?, maxLabel?, unit?}",
  "scale.props.min": `a number from -${SCALE_BOUND} to ${SCALE_BOUND}, below max`,
  "scale.props.max": `a number from -${SCALE_BOUND} to ${SCALE_BOUND}, above min`,
  "scale.props.step": `a number above 0 that divides max minus min into at most ${SCALE_MAX_STEPS} whole steps, 1 when absent`,
  "scale.props.range": "true, for a slider that takes two values, low and high",
  "scale.props.display": `"slider" or "rating": a rating takes one value out of at most ${SCALE_RATING_MAX_VALUES}`,
  "scale.props.minLabel": text(SCALE_LABEL_MAX_CHARS),
  "scale.props.maxLabel": text(SCALE_LABEL_MAX_CHARS),
  "scale.props.unit": text(SCALE_UNIT_MAX_CHARS),
};

export const SCALE_FIELDS: Readonly<Record<string, string>> = {
  "scale.props":
    "a Scale's props hold only min, max, step, range, display, minLabel, maxLabel and unit",
};
