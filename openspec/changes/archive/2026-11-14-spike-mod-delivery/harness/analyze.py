"""Analyse one probe run: identifiers, deliveries, and where each nonce first shows up.

Usage: python3 -I analyze.py <run-name>
"""
import json
import pathlib
import sys
from datetime import datetime

SCRATCH = pathlib.Path("/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad")
PROJECTS = pathlib.Path.home() / ".claude/projects"


def jsonl(path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def ms(iso):
    return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)


def transcripts(session_id):
    found = []
    for folder in PROJECTS.glob("*scratchpad-project*"):
        main = folder / f"{session_id}.jsonl"
        if main.exists():
            found.append(("main", main))
            for sub in sorted((folder / session_id / "subagents").glob("agent-*.jsonl")):
                found.append((sub.stem.removeprefix("agent-"), sub))
    return found


def first_hit(path, nonce):
    for line in path.read_text().splitlines():
        if nonce not in line:
            continue
        row = json.loads(line)
        text = json.dumps(row.get("message", row))
        at = text.find(nonce)
        return {
            "type": row.get("type"),
            "role": (row.get("message") or {}).get("role"),
            "isMeta": row.get("isMeta"),
            "origin": row.get("origin"),
            "at": ms(row["timestamp"]) if "timestamp" in row else None,
            "snippet": text[max(0, at - 220): at + 60],
        }
    return None


def main(run):
    run_dir = SCRATCH / "runs" / run
    result_path = run_dir / "result.json"
    result = json.loads(result_path.read_text()) if result_path.exists() else {}
    session_id = result.get("session_id") or next(
        (m["sessionId"] for m in jsonl(run_dir / "logs/mod.jsonl") if m.get("kind") == "session.start"), None
    )
    print(f"run {run}: session {session_id}, turns {result.get('num_turns')}, is_error {result.get('is_error')}")
    print("result:", (result.get("result") or "")[-300:])
    logs = run_dir / "logs"
    print("\n# hook records (event, agent_id, agent_type, tool_use_id, cwd)")
    for h in jsonl(logs / "hooks.jsonl"):
        i = h.get("input") or {}
        if "event" in h and "input" in h:
            print(" ", h["event"], i.get("agent_id"), i.get("agent_type"), i.get("tool_use_id"), i.get("cwd"), "stop_hook_active=" + str(i.get("stop_hook_active")))
        elif "decision" in h:
            print("  guard:", h)
    print("\n# mod events")
    for m in jsonl(logs / "mod.jsonl"):
        if m.get("kind") in ("tool.call", "session-match", "skip-finished", "submit-started", "submit-error", "poll-error", "session.start", "session.end"):
            print(" ", {k: v for k, v in m.items() if k not in ("iso", "pid", "source")})
    server = jsonl(logs / "server.jsonl")
    print("\n# binds")
    for s in server:
        if s.get("kind") == "bind":
            print(" ", s)
    answers = [s for s in server if s.get("kind") == "answer"]
    print("\n# deliveries (seq, via, agentId, result, t1, t2)")
    for s in server:
        if s.get("kind") == "delivered":
            print(" ", s.get("seq"), s.get("via"), s.get("agentId"), s.get("result"), s.get("t1"), s.get("t2"))
    print("\n# answers and where each nonce first shows up")
    paths = transcripts(session_id)
    for a in answers:
        print(f"  seq {a['seq']} {a['nonce']} ask {a['askId']} owner {a['owner']} t0 {a['t0']}")
        for name, path in paths:
            hit = first_hit(path, a["nonce"])
            if hit:
                lag = hit["at"] - a["t0"] if hit["at"] else None
                print(f"    in {name}: +{lag} ms type={hit['type']} role={hit['role']} isMeta={hit['isMeta']}")
                print(f"      ...{hit['snippet']}")
    print("\n# exit")
    for s in server:
        if s.get("kind") in ("start", "exit"):
            print(" ", s.get("kind"), s.get("pid"), s.get("ppid"), s.get("reason"))


if __name__ == "__main__":
    main(sys.argv[1])
