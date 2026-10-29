"""Print a transcript's timeline: user and assistant rows, and any row mentioning a nonce.

Usage: python3 -I timeline.py <session-id> [agent-id] [nonce...]
"""
import json
import pathlib
import sys

PROJECTS = pathlib.Path.home() / ".claude/projects"


def find(session_id, agent):
    for folder in PROJECTS.glob("*scratchpad-project*"):
        path = folder / session_id / "subagents" / f"agent-{agent}.jsonl" if agent and agent != "main" else folder / f"{session_id}.jsonl"
        if path.exists():
            return path
    raise SystemExit(f"no transcript for {session_id} {agent}")


def main():
    session_id = sys.argv[1]
    agent = sys.argv[2] if len(sys.argv) > 2 else "main"
    nonces = sys.argv[3:]
    for line in find(session_id, agent).read_text().splitlines():
        row = json.loads(line)
        text = json.dumps(row)
        hit = [n for n in nonces if n in text]
        if not hit and row.get("type") not in ("user", "assistant"):
            continue
        message = row.get("message") or {}
        content = message.get("content")
        if isinstance(content, list):
            parts = []
            for block in content:
                kind = block.get("type")
                if kind == "text":
                    parts.append("text:" + block["text"])
                elif kind == "tool_use":
                    parts.append("tool_use:" + block.get("name", "") + json.dumps(block.get("input"))[:80])
                elif kind == "tool_result":
                    parts.append("tool_result:" + json.dumps(block.get("content"))[:80])
                else:
                    parts.append(kind or "?")
            summary = " | ".join(parts)
        else:
            summary = str(content) if content else text[:200]
        usage = message.get("usage") or {}
        tokens = f" [in {usage.get('input_tokens')} cr {usage.get('cache_creation_input_tokens')} rd {usage.get('cache_read_input_tokens')} out {usage.get('output_tokens')}]" if usage else ""
        mark = " <<" + ",".join(hit) if hit else ""
        print(row.get("timestamp"), row.get("type"), row.get("operation") or "", (summary or "")[:260].replace("\n", " "), tokens, mark)


if __name__ == "__main__":
    main()
