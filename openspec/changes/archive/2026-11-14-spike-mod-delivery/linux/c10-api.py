"""Criterion 10 on Linux: the requests to the stub's local API per transport and client, with their headers.

Usage: python3 -I c10-api.py <run> [<run> ...]
The mod's requests are /events, /delivered and /log; the hooks send /record and /stop, the auto-answerer
/state and /answer. Under PROBE_TRANSPORT=unix only the mod uses the socket.
"""
import json
import os
import pathlib
import sys

RUNS = pathlib.Path(os.environ.get("WORK", pathlib.Path.home() / "work")) / "runs"
MOD_PATHS = ("/events", "/delivered", "/log")


def rows(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()] if path.exists() else []


def main(runs):
    for run in runs:
        base = RUNS / run
        server = rows(base / "logs/server.jsonl")
        mod = rows(base / "logs/mod.jsonl")
        start = next((m for m in mod if m.get("kind") == "session.start"), {})
        print(f"{run}: mod transport {start.get('transport')}, Claude Code {(start.get('version') or {}).get('version')}")
        api = [r for r in server if r.get("kind") == "api"]
        for transport in ("tcp", "unix"):
            mine = [r for r in api if r.get("transport") == transport and r.get("path", "").startswith(MOD_PATHS)]
            others = [r for r in api if r.get("transport") == transport and r not in mine]
            names = sorted({n for r in mine for n in r.get("headers", {})})
            origin = sum(1 for r in mine if "origin" in r.get("headers", {}))
            hosts = sorted({r.get("headers", {}).get("host") for r in mine})
            agents = sorted({r.get("headers", {}).get("user-agent") for r in mine})
            tokens = sorted({r.get("headers", {}).get("x-probe-token") for r in mine})
            print(f"  {transport}: mod requests {len(mine)}, other clients {len(others)}; Origin in {origin}")
            if mine:
                print(f"    headers: {', '.join(names)}; host {hosts}; user-agent {agents}; token {tokens}")
        answers = [r for r in server if r.get("kind") == "answer"]
        delivered = [f"{r.get('via')} {r.get('result')}" for r in server if r.get("kind") == "delivered"]
        result_path = base / "result.json"
        result = json.loads(result_path.read_text()).get("result", "") if result_path.exists() else ""
        for a in answers:
            print(f"  answer {a['nonce']}: in the final reply {a['nonce'] in result}")
        print(f"  deliveries: {delivered or 'none'}")
        print(f"  final reply: {result[-200:]!r}")


if __name__ == "__main__":
    main(sys.argv[1:])
