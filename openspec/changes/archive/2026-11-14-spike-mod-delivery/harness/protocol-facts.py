"""Criteria 12, 14, 16 across runs: server processes, probe requests, _meta, client info, leftovers.

Usage: python3 -I protocol-facts.py <run> [<run> ...]
"""
import json
import pathlib
import sys

RUNS = pathlib.Path("/private/tmp/claude-501/-Users-mr-git-MrBogomips-askboard/c62fdf42-198f-4102-861b-31731cc74555/scratchpad/runs")


def main(runs):
    print("run | starts | exits (reason) | first methods | discover ids | tools/call _meta keys | toolUseId = hook tool_use_id | clientInfo version | session files left | sockets left")
    for run in runs:
        rows = [json.loads(l) for l in (RUNS / run / "logs/server.jsonl").read_text().splitlines()]
        hooks = [json.loads(l) for l in (RUNS / run / "logs/hooks.jsonl").read_text().splitlines()] if (RUNS / run / "logs/hooks.jsonl").exists() else []
        starts = [r for r in rows if r.get("kind") == "start"]
        exits = [f"{r.get('reason')}" for r in rows if r.get("kind") == "exit"]
        methods = [r["method"] for r in rows if r.get("kind") == "rpc-in"][:5]
        discover = sorted({str(r["id"]) for r in rows if r.get("kind") == "rpc-in" and r.get("method") == "server/discover"})
        calls = [r for r in rows if r.get("kind") == "rpc-in" and r.get("method") == "tools/call"]
        meta_keys = sorted({k for c in calls for k in ((c.get("params") or {}).get("_meta") or {})})
        hook_ids = {(h.get("input") or {}).get("tool_use_id") for h in hooks if h.get("event") == "PreToolUse"}
        call_ids = {((c.get("params") or {}).get("_meta") or {}).get("claudecode/toolUseId") for c in calls}
        same = all(i in hook_ids for i in call_ids if i) and bool(call_ids - {None})
        versions = sorted({((c.get("params") or {}).get("_meta") or {}).get("io.modelcontextprotocol/clientInfo", {}).get("version") for c in calls})
        sessions = len(list((RUNS / run / "sessions").glob("*.json"))) if (RUNS / run / "sessions").exists() else 0
        sockets = len(list((RUNS / run).glob("api-*.sock")))
        print(f"{run} | {len(starts)} | {', '.join(exits)} | {', '.join(methods)} | {', '.join(discover)} | {', '.join(meta_keys)} | {same} | {', '.join(map(str, versions))} | {sessions} | {sockets}")


if __name__ == "__main__":
    main(sys.argv[1:])
