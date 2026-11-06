// How a request's wording reads a widget item's props (widget-answers, design decision 4): the
// expected shape and the field list of each of a Tree's, a Gantt's and a molecule reference's
// objects, keyed as `itemKey` keys them (`tree.props.nodes[].label`; `paths.ts` turns a path into
// such a key). Nothing here validates: the schemas and the widgets' own checks do, and this words
// their problems.

import { ID_SHAPE, text } from "../ask-items.ts";
import {
  GANTT_LABEL_MAX_CHARS,
  GANTT_MAX_DURATION,
  GANTT_MAX_PREDECESSORS,
  GANTT_MAX_TASKS,
  GANTT_MIN_DURATION,
} from "./gantt/index.ts";
import {
  TREE_FIELD_PATTERN,
  TREE_LABEL_MAX_CHARS,
  TREE_MAX_COLUMNS,
  TREE_MAX_DEPTH,
  TREE_MAX_NODES,
  TREE_TEXT_MAX_CHARS,
} from "./tree/index.ts";

const DAY = "a day YYYY-MM-DD";
const TASK_ID = `${ID_SHAPE}, the ID of a task`;
const PREDECESSORS = `a list of at most ${GANTT_MAX_PREDECESSORS} task IDs, each once: the task's finish-to-start predecessors`;
const DURATION = `a whole number of working days from ${GANTT_MIN_DURATION} to ${GANTT_MAX_DURATION}`;

/** The expected shapes of a widget item's fields, by key. */
export const WIDGET_EXPECTED: Readonly<Record<string, string>> = {
  "tree.props": "a Tree's props {columns?, nodes, pert?, openDepth?}",
  "tree.props.columns": `a list of at most ${TREE_MAX_COLUMNS} columns, each {field, label, type}`,
  "tree.props.columns[]": "a column {field, label, type}",
  "tree.props.columns[].field": `a field name matching ${TREE_FIELD_PATTERN}, never id, label or children, unique among the columns`,
  "tree.props.columns[].label": text(TREE_LABEL_MAX_CHARS),
  "tree.props.columns[].type": '"text" or "number"',
  "tree.props.nodes": `a list of nodes, at most ${TREE_MAX_NODES} in all and ${TREE_MAX_DEPTH} levels deep`,
  "tree.props.nodes[]": "a node {id, label, children?} with a value for each column field it has",
  "tree.props.nodes[].id": `${ID_SHAPE}, unique among the Tree's nodes at every level`,
  "tree.props.nodes[].label": text(TREE_LABEL_MAX_CHARS),
  "tree.props.nodes[].children": "a non-empty list of nodes",
  "tree.props.nodes[].{field}": `a value for a field a column declares: text of 1 to ${TREE_TEXT_MAX_CHARS} characters for a text column, a number for a number column`,
  "tree.props.pert":
    "true, on a Tree whose columns declare optimistic, mostLikely and pessimistic as numbers",
  "tree.props.openDepth": `a whole number of 1 to ${TREE_MAX_DEPTH}, with pert only`,
  "gantt.props": "a Gantt's props {start, tasks, workPackages?}",
  "gantt.props.start": `${DAY}: the day the plan starts`,
  "gantt.props.workPackages": "the ID of the Tree of the same question whose leaves are the tasks",
  "gantt.props.tasks": `a list of at most ${GANTT_MAX_TASKS} tasks {id, label, duration, start?, dependencies?}, or with workPackages a map from task ID to {start?, dependencies?}`,
  "gantt.props.tasks[]": "a task {id, label, duration, start?, dependencies?}",
  "gantt.props.tasks[].id": `${TASK_ID}, unique in the Gantt`,
  "gantt.props.tasks[].label": text(GANTT_LABEL_MAX_CHARS),
  "gantt.props.tasks[].duration": DURATION,
  "gantt.props.tasks[].start": `${DAY}: the day on or after which the task starts`,
  "gantt.props.tasks[].dependencies": PREDECESSORS,
  "gantt.props.tasks[].dependencies[]": TASK_ID,
  "gantt.props.tasks.{task}": "what the plan says of the task {start?, dependencies?}",
  "gantt.props.tasks.{task}.start": `${DAY}: the day on or after which the task starts`,
  "gantt.props.tasks.{task}.dependencies": PREDECESSORS,
  "gantt.props.tasks.{task}.dependencies[]": TASK_ID,
  "molecule.props": "a reference's props {molecule, version?, data}",
  "molecule.props.molecule":
    "a molecule name: lowercase letters, digits and hyphens, starting with a letter, at most 64 characters",
  "molecule.props.version": "a semantic version major.minor.patch",
  "molecule.props.data": "an object holding the data the molecule's parameters describe",
};

/** What each of a widget item's objects holds, by key. */
export const WIDGET_FIELDS: Readonly<Record<string, string>> = {
  "tree.props": "a Tree's props hold only columns, nodes, pert and openDepth",
  "tree.props.columns[]": "a column holds only field, label and type",
  "tree.props.nodes[]": "a node holds only id, label, children and the fields its columns declare",
  "gantt.props": "a Gantt's props hold only start, workPackages and tasks",
  "gantt.props.tasks[]": "a task holds only id, label, duration, start and dependencies",
  "gantt.props.tasks.{task}": "a plan's task holds only start and dependencies",
  "molecule.props": "a reference's props hold only molecule, version and data",
};
