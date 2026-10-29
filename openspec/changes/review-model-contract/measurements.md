# Measurements

Token counts of the worked model contract in `examples/`, and the findings that writing it exposed (design decisions 1, 3 and 4).

## Method

- **Counting method:** the Claude Code fallback of design decision 3, by input. No API key for the token-counting endpoint is available (product owner, 2026-10-29).
- **Model:** `claude-opus-5-5` (Opus 5.5), the model of the addendum's baselines. Tokenizers differ between models, so every count below holds for this model only.
- **Runs:** Claude Code 2.1.312, `claude -p --output-format json --model claude-opus-5-5 --effort low`, with `--setting-sources ""`, `--strict-mcp-config`, `--tools ""`, `--disable-slash-commands`, `--no-session-persistence` and a one-line system prompt, started from an empty directory outside the repository.
- **Input count:** the document, without its final newline, is the user message, and the system prompt asks for the reply `OK`. The count is the run's input tokens (`input_tokens` plus `cache_creation_input_tokens` plus `cache_read_input_tokens`) minus those of a baseline run whose message is `.`, plus 1 for that `.`.
- **Copy count (cross-check):** the system prompt asks the model to reproduce the message verbatim. The count is `output_tokens` minus that of a baseline copy of `.`, plus 1. A run whose copy differs from the document is rejected.
- **Date:** 2026-10-29.
- **Repeatability (task 1.1):** a fixed 135-character JSON text (a question, a header and two options) counted 53 tokens by input in two runs, and 53 tokens by copy.

## Counts

Filled by task 4.1.

## Scale

Filled by task 4.2.

## Findings

Filled by task 3.4.
