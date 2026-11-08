---
name: Defect
about: Behaviour that differs from the specs or the PO's intent
title: ""
labels: ["type:defect", "source:po"]
---

<!--
Search open and closed Issues for a duplicate first. Add one severity label: sev:H (a wrong or lost
answer, security, data loss), sev:M (a requirement or scenario not met), sev:L (wording, records,
minor gaps). Change source:po when the defect comes from an end-to-end test (source:e2e) or a review
(source:review). Keep the Issue self-contained: the steps, the expected and observed behaviour and
the evidence written here (quote what a local file holds), images attached or linked from the
repository, never a path on someone's machine. Never paste a board link (it carries the token), a
token or a session file.
-->

## Origin

<!-- Where it was found: the PO's words, an end-to-end test (ID and commit), a review finding. -->

## Steps to reproduce

1.
2.
3.

## Expected

<!-- What should happen, with the requirement, scenario or design decision that says so. -->

## Observed

<!-- What happens instead, with the evidence: error text, request and answer, the lines of a log. -->

## Severity

<!-- H, M or L, and why. -->

## Decision needed

<!-- Leave out when nothing is open. Otherwise the question, the options and the proposed default,
and add the needs-po label. -->

## References

<!-- Specs, documents in the repository, related Issues; screenshots attached. -->
