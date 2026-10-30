"""Criterion 13: the session ID each component saw, per server process (one per invocation).

Usage: python3 -I c13-ids.py <run>
"""
import json
import pathlib
import sys

RUNS = pathlib.Path("/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad/runs")


def rows(path):
    return [json.loads(l) for l in path.read_text().splitlines()] if path.exists() else []


def main(run):
    base = RUNS / run
    for step in ("first", "continue", "resume", "fork", "clear", "resume-ui"):
        result = base / f"result-{step}.json"
        if result.exists():
            print(f"result-{step}: session_id {json.loads(result.read_text()).get('session_id')}")
    server = rows(base / "logs/server.jsonl")
    hooks = rows(base / "logs/hooks.jsonl")
    mod = rows(base / "logs/mod.jsonl")
    print("\nserver starts: pid, ppid, env CLAUDE_CODE_SESSION_ID")
    for s in server:
        if s.get("kind") == "start":
            print(" ", s["pid"], s["ppid"], s["env"]["CLAUDE_CODE_SESSION_ID"])
        if s.get("kind") == "exit":
            print("   exit", s["pid"], s.get("reason"))
    print("\nhooks: event, ppid, env CLAUDE_CODE_SESSION_ID, input session_id, session file")
    for h in hooks:
        if "input" in h:
            print(" ", h["event"], h["ppid"], h["env"]["CLAUDE_CODE_SESSION_ID"], (h["input"] or {}).get("session_id"), h.get("sessionFile"), (h["input"] or {}).get("tool_input", {}).get("askId"))
    print("\nmod: kind, $.session.id, env key, rule, file pid, reason")
    for m in mod:
        if m.get("kind") in ("session.start", "session-match", "session.end"):
            print(" ", m["kind"], m.get("sessionId"), m.get("envKey"), "claudePid=" + str(m.get("claudePid")), m.get("rule"), m.get("filePid"), m.get("reason"))
    print("\nbinds:")
    for s in server:
        if s.get("kind") == "bind":
            print(" ", s["pid"], s["askId"], s["rule"])


if __name__ == "__main__":
    main(sys.argv[1])
