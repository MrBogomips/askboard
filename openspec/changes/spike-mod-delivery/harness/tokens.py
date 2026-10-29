"""Criterion 4: per-request token usage of one transcript, to compare a pushed answer with a collected one.

Each assistant request row prints its total input (input + cache creation + cache read), its output,
the growth of the total input since the previous request, and what arrived in between
(a tool result, a pushed attachment, a woken user turn, a collect result).
Usage: python3 -I tokens.py <session-id> [agent-id|main]
"""
import json
import pathlib
import sys

PROJECTS = pathlib.Path.home() / ".claude/projects"


def find(session_id, agent):
    for folder in PROJECTS.glob("*scratchpad-project*"):
        path = folder / f"{session_id}.jsonl" if agent == "main" else folder / session_id / "subagents" / f"agent-{agent}.jsonl"
        if path.exists():
            return path
    raise SystemExit("transcript not found")


def describe(row):
    if row.get("type") == "attachment":
        return "PUSH:" + (row.get("attachment") or {}).get("type", "?")
    message = row.get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        return "user-text:" + content[:60].replace("\n", " ")
    kinds = []
    for block in content or []:
        if block.get("type") == "tool_result":
            text = json.dumps(block.get("content"))
            kinds.append("collect-result" if "events" in text else "tool_result")
        elif block.get("type") == "text":
            kinds.append("text:" + block["text"][:50].replace("\n", " "))
        else:
            kinds.append(block.get("type", "?"))
    return ",".join(kinds)


def main():
    session_id = sys.argv[1]
    agent = sys.argv[2] if len(sys.argv) > 2 else "main"
    previous_total = None
    between = []
    seen_ids = set()
    for line in find(session_id, agent).read_text().splitlines():
        row = json.loads(line)
        if row.get("type") == "assistant":
            message = row["message"]
            if message.get("id") in seen_ids:
                continue
            seen_ids.add(message.get("id"))
            usage = message.get("usage") or {}
            total = usage.get("input_tokens", 0) + usage.get("cache_creation_input_tokens", 0) + usage.get("cache_read_input_tokens", 0)
            growth = total - previous_total if previous_total is not None else None
            blocks = [b.get("type") + (":" + b.get("name", "") if b.get("type") == "tool_use" else "") for b in message.get("content", [])]
            print(f"total {total:6d} growth {str(growth):>6} out {usage.get('output_tokens', 0):4d} | after: {' + '.join(between) or '-'} | {' '.join(blocks)}")
            previous_total = total
            between = []
        elif row.get("type") in ("user", "attachment"):
            between.append(describe(row))


if __name__ == "__main__":
    main()
