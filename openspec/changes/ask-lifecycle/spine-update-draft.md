# Spine update draft: ask lifecycle (E3)

Five blocks. Blocks 1 to 3 are clarifications that change no rule's intent; block 4 records a value the spine left to implementation. Block 1 applies only if the PO accepts the proposal's open question 2 (areas as container items), block 2 only if the PO accepts open question 3 (recorded answers are not logged), block 4 only if the PO accepts open question 4 (the grace period); block 3 has no open question of its own, since E1 handed the action ID to E3. Block 5 applies only if the PO accepts open question 12 (the "More" menu on Radix Dropdown Menu), which the implementation's review raised on 2026-11-01; blocks 1 to 4 were applied by task 7.1, block 5 by task 0.1 on 2026-11-03, after the PO accepted open question 12. If the PO decides otherwise, that block does not apply and the spine stays as it is for that point. Each block quotes the current text exactly, then gives the replacement; ADs are amended in place, with their IDs unchanged. No PRD change is needed, and no block touches AD-6: listing four tools until E7 is an interim reading like E1's two (open question 1).

Files: `docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md` and, for block 4, `SOLUTION-DESIGN.md` beside it.

How to apply: replace each quoted text, set `updated:` to the apply date and add a `sources` line for this change in the spine's front matter, then run `openspec validate --all --strict --no-interactive` and `bun run check`. Task 7.1 checks that each quoted text still matches; nothing here is applied before it.

## Block 1: AD-7, Rule, Content, Questions

Current:

```text
    - **Questions:** a question's props hold its `text`, an optional `header`, its `options` and `multiSelect`; its widgets, excerpts and molecules go in its `items`, each an item as in AD-6. The agent sends no layout: an excerpt goes beside its question because of its type (FR-13).
```

Replacement:

```text
    - **Questions:** a question's props hold its `text`, an optional `header`, its `options` and `multiSelect`; its widgets, excerpts and molecules go in its `items`, each an item as in AD-6. The agent sends no layout: an excerpt goes beside its question because of its type (FR-13).
    - **Areas:** an area is an item `{type: "area", id, props: {title, items}}` at the top level of an ask, whose `items` hold its questions. Areas do not nest, and either every top-level item of an ask is an area or none is; an ask without areas shows its questions as one group (FR-2). `update` adds a question to an area by naming the area as its parent.
```

## Block 2: AD-10, Rule, What becomes an answer, first bullet

Current:

```text
    - An answer event comes only from an explicit user action on its question on the board, or from an `update` the agent marks as recorded on the user's behalf (FR-19).
```

Replacement:

```text
    - An answer event comes only from an explicit user action on its question on the board. An answer the agent records on the user's behalf with `update` (FR-19) is held by `ask-core` as that question's answer, marked recorded, with `who` and the core's time, and reported in that call's result; like every change the agent's own call makes, it is not logged (AD-3): no event carries it, so neither push nor `collect` delivers it; `fetch` returns it marked `recorded`.
```

## Block 3: AD-20, Rule, Delivery modes, second bullet

Current:

```text
    - A submit appends one event per held action, in the order the user produced them, as one atomic append that `collect` pages never split.
```

Replacement:

```text
    - A submit appends one event per held action, in the order the user produced them, as one atomic append that `collect` pages never split.
    - Every board command carries an action ID that the board page makes. `ask-core` applies each action ID once per ask, so a command resent after a dropped connection, a submit or a revision included, is never appended twice.
```

## Block 4: the reconnect grace period

In the spine's Deferred table, the row that starts "Default port range". Current:

```text
| Default port range, the container opt-in setting, the host-side address and port in printed links, whether VS Code Dev Containers' `BROWSER` helper and port forwarding make the container opt-in unnecessary there, the reconnect grace period, the record timeout, where the file path and line sit in the user's `editor` command | AD-5, AD-8, AD-11 and AD-21 fix the rules; the keys are named in the configuration schema | Implementation |
```

Replacement:

```text
| Default port range, the container opt-in setting, the host-side address and port in printed links, whether VS Code Dev Containers' `BROWSER` helper and port forwarding make the container opt-in unnecessary there, the record timeout, where the file path and line sit in the user's `editor` command | AD-5, AD-8 and AD-11 fix the rules; the keys are named in the configuration schema. The reconnect grace period is a `contract` constant of 120 s (OpenSpec change `ask-lifecycle`), above the 90 s floor of SOLUTION-DESIGN §8 | Implementation |
```

In `SOLUTION-DESIGN.md` §12, the row `| Implementation | … |`. Current:

```text
| Implementation | Default port range, container opt-in setting, host-side link address and port, VS Code Dev Containers' `BROWSER` helper and port forwarding, grace period, record timeout, where the file path and line sit in the user's `editor` command |
```

Replacement:

```text
| Implementation | Default port range, container opt-in setting, host-side link address and port, VS Code Dev Containers' `BROWSER` helper and port forwarding, record timeout, where the file path and line sit in the user's `editor` command (the grace period is 120 s since the `ask-lifecycle` change) |
```

## Block 5: Stack, the `radix-ui` row

Current:

```text
| `radix-ui` (view primitives: Radio Group, Checkbox, Switch, Tabs, Slider, Toggle Group, Popover, Dialog, Alert Dialog; not Select) | 1.8.1 |
```

Replacement:

```text
| `radix-ui` (view primitives: Radio Group, Checkbox, Switch, Tabs, Slider, Toggle Group, Popover, Dialog, Alert Dialog, Dropdown Menu; not Select) | 1.8.1 |
```
