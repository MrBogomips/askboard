"""Read latency: for each answer of a run, t0 (answer created) to the first assistant row quoting its nonce.

Also prints the row type that carried the nonce and what sits around it, to check placement.
Usage: python3 -I readlat.py <run> [agent-id|main]
"""
import datetime
import json
import pathlib
import sys

SCRATCH = pathlib.Path("/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad")
PROJECTS = pathlib.Path.home() / ".claude/projects"


def ts(row):
    return datetime.datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00")).timestamp() * 1000


def main():
    run, agent = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "main")
    logs = SCRATCH / "runs" / run / "logs"
    answers = [json.loads(l) for l in (logs / "server.jsonl").read_text().splitlines() if '"kind":"answer"' in l]
    session = next(json.loads(l)["sessionId"] for l in (logs / "mod.jsonl").read_text().splitlines() if '"session.start"' in l)
    for folder in PROJECTS.glob("*scratchpad-project*"):
        path = folder / f"{session}.jsonl" if agent == "main" else folder / session / "subagents" / f"agent-{agent}.jsonl"
        if path.exists():
            break
    rows = [json.loads(l) for l in path.read_text().splitlines()]
    for a in answers:
        nonce = a["nonce"]
        carried = next((i for i, r in enumerate(rows) if r.get("type") != "assistant" and nonce in json.dumps(r)), None)
        read = next((r for r in rows if r.get("type") == "assistant" and nonce in json.dumps(r.get("message", {}).get("content"))), None)
        around = [rows[j].get("type") + ":" + ",".join(b.get("type", "?") for b in (rows[j].get("message", {}).get("content") or []) if isinstance(b, dict)) for j in range(max(0, (carried or 0) - 1), min(len(rows), (carried or 0) + 2))] if carried is not None else []
        print(nonce, "read", f"{(ts(read) - a['t']) / 1000:.1f} s" if read else "never quoted", "| carried by", rows[carried].get("type") if carried is not None else None, "| around", around)


if __name__ == "__main__":
    main()
