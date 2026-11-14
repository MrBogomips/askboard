"""Fails if the OAuth token's value shows up in any file under a results folder, and deletes those files.

Usage: python3 -I token-scan.py <folder>
The value is read from the environment, never from the command line, and is never printed.
"""
import os
import pathlib
import sys


def main(folder):
    token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "").encode()
    if not token:
        print("token-scan: no token in the environment, nothing to scan")
        return 0
    hits = [p for p in pathlib.Path(folder).rglob("*") if p.is_file() and not p.is_symlink() and token in p.read_bytes()]
    for path in hits:
        path.unlink()
        print(f"token-scan: the token was in {path}; file deleted", file=sys.stderr)
    print(f"token-scan: {len(hits)} files held the token")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
