"""Criterion 3: latency per answer from the answer (t0) to the push call (t2) and to the owner's transcript (t3).

For a subagent, t3 is the row carrying the nonce in its own transcript (an attachment between tool calls).
For the main conversation, t3 is the user row of the woken turn, not the queue entry.
Usage: python3 -I latency.py <run> [<run> ...]
"""
import json
import pathlib
import statistics
import sys
from datetime import datetime

SCRATCH = pathlib.Path("/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad")
PROJECTS = pathlib.Path.home() / ".claude/projects"


def jsonl(path):
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()] if path.exists() else []


def ms(iso):
    return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)


def transcript(session_id, owner):
    for folder in PROJECTS.glob("*scratchpad-project*"):
        path = folder / f"{session_id}.jsonl" if owner is None else folder / session_id / "subagents" / f"agent-{owner}.jsonl"
        if path.exists():
            return path
    return None


def seen_at(path, nonce, owner):
    for line in path.read_text().splitlines():
        if nonce not in line:
            continue
        row = json.loads(line)
        if owner is None and row.get("type") != "user":
            continue
        return ms(row["timestamp"])
    return None


def run_latencies(run):
    base = SCRATCH / "runs" / run
    result = base / "result.json"
    session_id = json.loads(result.read_text()).get("session_id") if result.exists() else None
    session_id = session_id or next((m["sessionId"] for m in jsonl(base / "logs/mod.jsonl") if m.get("kind") == "session.start"), None)
    server = jsonl(base / "logs/server.jsonl")
    pushes = {d["seq"]: d for d in server if d.get("kind") == "delivered"}
    rows = []
    for a in (s for s in server if s.get("kind") == "answer"):
        path = transcript(session_id, a["owner"])
        t3 = seen_at(path, a["nonce"], a["owner"]) if path else None
        push = pushes.get(a["seq"], {})
        rows.append({
            "seq": a["seq"],
            "owner": a["owner"] or "main",
            "via": push.get("via"),
            "push_ms": push["t2"] - a["t0"] if "t2" in push else None,
            "seen_ms": t3 - a["t0"] if t3 else None,
        })
    return rows


def main(runs):
    for run in runs:
        rows = run_latencies(run)
        seen = [r["seen_ms"] for r in rows if r["seen_ms"] is not None]
        pushed = [r["push_ms"] for r in rows if r["push_ms"] is not None]
        summary = f"median {statistics.median(seen) / 1000:.1f} s, max {max(seen) / 1000:.1f} s" if seen else "none seen"
        push_summary = f"push median {statistics.median(pushed)} ms, max {max(pushed)} ms" if pushed else "no push"
        print(f"{run}: answers {len(rows)}, seen {len(seen)}; t3-t0 {summary}; t2-t0 {push_summary}")
        for r in rows:
            print("   ", r)


if __name__ == "__main__":
    main(sys.argv[1:])
