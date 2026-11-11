---
name: End-to-end test result
about: One finding of an end-to-end test session
title: ""
labels: ["type:defect", "source:e2e"]
---

<!--
One finding per Issue. Search open and closed Issues for a duplicate first. Add one area label or
more: area:<name>, the function or module (CLAUDE.md, Labels). A defect adds one
severity label (sev:H, sev:M, sev:L); a request takes type:feature instead of type:defect, a
decision type:question and needs-po. Keep the Issue self-contained: the steps, the expected and
observed behaviour and the evidence written here, the report's relevant lines quoted, screenshots
attached or linked from the repository, never a path on the tester's machine. Never paste a board
link (it carries the token), a token or a session file. The session reports only the Issue number to
its coordinator.
-->

## Origin

<!-- The test ID, the date, the commit tested (main <sha>), the engine and the runtime. -->

## Steps to reproduce

1.
2.
3.

## Expected

<!-- What should happen, with the requirement, scenario or design decision that says so. -->

## Observed

<!-- What happens instead, with the evidence: error text, request and answer, the report's lines. -->

## Severity

<!-- H, M or L, and why. Leave out for a request or a question. -->

## Decision needed

<!-- Leave out when nothing is open. Otherwise the question, the options and the proposed default,
and add the needs-po label. -->

## References

<!-- The test ID and report section the quotes come from, screenshots attached, related Issues. -->
