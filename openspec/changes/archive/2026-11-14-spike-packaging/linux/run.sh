#!/bin/sh
# Linux harness of the packaging spike (tasks 5.1 to 5.4, design decisions 8 and 9).
# Usage: linux/run.sh <check>   with <check> one of: targets, nocurl, devcontainer, ci-sim, detect, cleanup
# Needs: Docker, Bun on the host, probe/dist built (bun run build), DOCKER_CONFIG pointing at a folder whose
# config.json is {} (the credential helper hangs otherwise). Containers are named p-pkg-* and run with --rm.
set -u

C=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
PROBE=$C/probe
DEBIAN=debian:12-slim@sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3
ALPINE=alpine:3.22@sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f
UBUNTU=ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852
RELEASE_PORT=${RELEASE_PORT:-47841}
RELEASE_URL=http://host.docker.internal:$RELEASE_PORT/askboard/askboard/releases/download
INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"linux-harness","version":"0"}}}'

# The pinned digest is an index: the platform picks the variant. Docker Desktop's image store keeps one variant
# per tag and refuses a second platform pulled by digest ("cannot overwrite digest"), so each run pulls the tag
# for its platform, checks that the index digest the registry returns is the pinned one, and runs the tag.
start() { # <name> <platform> <image@digest> [docker run options...]
  name=$1 platform=$2 tag=${3%@*} pinned=${3#*@}
  shift 3
  docker rm -f "$name" >/dev/null 2>&1
  got=$(docker pull --platform "$platform" "$tag" 2>&1 | sed -n 's/^Digest: //p')
  [ "$got" = "$pinned" ] || { echo "digest mismatch for $tag: $got" >&2; return 1; }
  docker run -d --rm --name "$name" --platform "$platform" \
    -v "$PROBE/dist:/dist:ro" -v "$PROBE/plugin:/plugin:ro" -v "$RUN_DIR:/runs" "$@" "$tag" sleep 3600 >/dev/null
}

in_box() { docker exec "$@"; }

# Launcher started from the host through docker exec, timed by the probe's handshake client.
launch() { # <container> [extra env...]
  box=$1
  shift
  (cd "$PROBE" && bun handshake.ts --timeout-ms 90000 docker exec -i \
    -e CLAUDE_PLUGIN_DATA=/tmp/data -e ASKBOARD_RELEASE_URL="$RELEASE_URL" -e ASKBOARD_RELEASE_FILE=/runs/release.txt "$@" \
    "$box" /plugin/scripts/askboard)
}

targets_one() { # <platform> <image-label> <image> <exe>
  platform=$1 label=$2 image=$3 exe=$4
  box=p-pkg-$label-${platform#linux/}
  out=$RUN_DIR/$label-${platform#linux/}.txt
  start "$box" "$platform" "$image"
  {
    echo "== $label $platform ($image)"
    echo "uname -m: $(in_box "$box" uname -m)"
    case $label in
      alpine)
        # Bun's musl executables link libstdc++ and libgcc, which Alpine does not install by default.
        echo "direct doctor, as shipped: $(in_box "$box" "/dist/$exe" doctor 2>&1 | head -1)"
        s=$(date +%s)
        in_box "$box" apk add -q libstdc++ libgcc >/dev/null 2>&1
        echo "installed libstdc++ libgcc in $(($(date +%s) - s)) s"
        ;;
      debian | ubuntu)
        s=$(date +%s)
        in_box "$box" sh -c 'apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends curl ca-certificates >/dev/null 2>&1'
        echo "installed curl in $(($(date +%s) - s)) s"
        ;;
    esac
    echo "tools: $(in_box "$box" sh -c 'for t in curl wget sha256sum shasum openssl; do command -v $t >/dev/null 2>&1 && printf "%s=%s " $t "$(command -v $t)"; done')"
    echo "musl loader: $(in_box "$box" sh -c 'ls /lib/ld-musl-* 2>/dev/null || echo none')"
    echo "direct doctor: $(in_box "$box" "/dist/$exe" doctor 2>&1)"
    echo "direct initialize: $(in_box "$box" sh -c "(printf '%s\n' '$INIT'; sleep 2) | /dist/$exe | head -c 300")"
    echo "launcher cold: $(launch "$box")"
    echo "launcher warm: $(launch "$box")"
    echo "cache: $(in_box "$box" sh -c 'ls -la /tmp/data/bin/*/')"
    echo "hook, executable present: $(in_box "$box" sh -c 'echo {} | CLAUDE_PLUGIN_DATA=/tmp/data ASKBOARD_RELEASE_FILE=/runs/release.txt /plugin/scripts/askboard hook PostToolUse; echo exit $?' 2>&1)"
  } >"$out" 2>&1
  docker rm -f "$box" >/dev/null 2>&1
  cat "$out"
}

check_targets() {
  for platform in linux/arm64 linux/amd64; do
    arch=${platform#linux/}
    [ "$arch" = amd64 ] && a=x64 || a=arm64
    targets_one "$platform" debian "$DEBIAN" "askboard-linux-$a"
    targets_one "$platform" alpine "$ALPINE" "askboard-linux-$a-musl"
  done
}

# Debian slim as shipped: neither curl nor wget. The launcher answers the handshake with the reason.
check_nocurl() {
  box=p-pkg-nocurl
  start "$box" linux/arm64 "$DEBIAN"
  {
    echo "tools: $(in_box "$box" sh -c 'for t in curl wget sha256sum; do command -v $t >/dev/null 2>&1 && printf "%s " $t; done')"
    echo "launcher: $(launch "$box")"
    echo "hook without executable: $(in_box "$box" sh -c 'echo {} | CLAUDE_PLUGIN_DATA=/tmp/data ASKBOARD_RELEASE_FILE=/runs/release.txt /plugin/scripts/askboard hook PostToolUse; echo exit $?' 2>&1)"
  } >"$RUN_DIR/nocurl.txt" 2>&1
  docker rm -f "$box" >/dev/null 2>&1
  cat "$RUN_DIR/nocurl.txt"
}

# Criterion 8: board listener in a container, port published to the host's loopback only.
board_case() { # <label> <publish> [env...]
  label=$1 publish=$2
  shift 2
  box=p-pkg-dev-$label
  start "$box" linux/arm64 "$DEBIAN" -p "$publish" "$@"
  docker exec -d "$box" sh -c '/dist/askboard-linux-arm64 serve-board >/runs/'"$label"'.link 2>/runs/'"$label"'.stderr; sleep 3600'
  sleep 2
  link=$(cat "$RUN_DIR/$label.link")
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$link" 2>/dev/null)
  host_port=$(echo "$publish" | awk -F: '{print $(NF-1)}')
  direct=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$host_port/b/x" 2>/dev/null)
  echo "| $label | -p $publish | $* | $link | ${status:-none} | ${direct:-none} | $(tr '\n' ' ' <"$RUN_DIR/$label.stderr") |"
  docker rm -f "$box" >/dev/null 2>&1
}

check_devcontainer() {
  {
    echo "| case | publish | env | printed link | printed link from the host | 127.0.0.1:<host port> from the host | stderr |"
    echo "| --- | --- | --- | --- | --- | --- | --- |"
    board_case loopback-default 127.0.0.1:47850:47850 -e ASKBOARD_PORT=47850
    board_case opt-in 127.0.0.1:47850:47850 -e ASKBOARD_PORT=47850 -e ASKBOARD_BIND_CONTAINER=1
    board_case opt-in-link-host 127.0.0.1:47850:47850 -e ASKBOARD_PORT=47850 -e ASKBOARD_BIND_CONTAINER=1 -e ASKBOARD_LINK_HOST=localhost
    board_case opt-in-other-host-port 127.0.0.1:47851:47850 -e ASKBOARD_PORT=47850 -e ASKBOARD_BIND_CONTAINER=1
    board_case all-interfaces-publish 47852:47850 -e ASKBOARD_PORT=47850 -e ASKBOARD_BIND_CONTAINER=1
  } >"$RUN_DIR/devcontainer.md" 2>&1
  cat "$RUN_DIR/devcontainer.md"
}

# Criterion 10, stand-in: a GitHub runner's environment variables in Ubuntu 24.04.
check_ci_sim() {
  box=p-pkg-ci
  start "$box" linux/arm64 "$UBUNTU" -e CI=true -e GITHUB_ACTIONS=true
  {
    s=$(date +%s)
    in_box "$box" sh -c 'apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends curl ca-certificates >/dev/null 2>&1'
    echo "installed curl in $(($(date +%s) - s)) s"
    echo "launcher cold: $(launch "$box")"
    echo "detect: $(in_box "$box" /dist/askboard-linux-arm64 detect)"
    echo "ask tool through the launcher: $(in_box "$box" sh -c "(printf '%s\n' '$INIT' '{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}' '{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"ask\",\"arguments\":{\"askId\":\"ci\",\"question\":\"q\"}}}'; sleep 2) | CLAUDE_PLUGIN_DATA=/tmp/data ASKBOARD_RELEASE_FILE=/runs/release.txt /plugin/scripts/askboard | tail -1")"
  } >"$RUN_DIR/ci-sim.txt" 2>&1
  docker rm -f "$box" >/dev/null 2>&1
  cat "$RUN_DIR/ci-sim.txt"
}

detect_row() { # <platform label> <inputs label> <command...>
  row_platform=$1 row_inputs=$2
  shift 2
  json=$("$@" 2>&1)
  reachable=$(printf '%s' "$json" | sed -n -E 's/.*"reachable":(true|false).*/\1/p')
  reason=$(printf '%s' "$json" | sed -n -E 's/.*"reason":"([^"]*)".*/\1/p')
  echo "| $row_platform | $row_inputs | $reachable | $reason |"
}

# Criterion 12: the detect rule on macOS and in containers, each input forced in turn.
check_detect() {
  mac=$PROBE/dist/askboard-darwin-arm64
  {
    echo "| platform | inputs | reachable | reason |"
    echo "| --- | --- | --- | --- |"
    detect_row macOS "as is" env -u SSH_CONNECTION -u SSH_TTY -u BROWSER -u CI -u GITHUB_ACTIONS "$mac" detect
    detect_row macOS "SSH_CONNECTION set" env SSH_CONNECTION="10.0.0.1 22 10.0.0.2 22" "$mac" detect
    detect_row macOS "BROWSER=firefox" env -u CI BROWSER=firefox "$mac" detect
    detect_row macOS "CI=true" env -u BROWSER CI=true "$mac" detect
    detect_row macOS "CODESPACES=true" env CODESPACES=true "$mac" detect
    for platform in linux/arm64; do
      for spec in "debian:$DEBIAN:askboard-linux-arm64" "alpine:$ALPINE:askboard-linux-arm64-musl"; do
        label=${spec%%:*}
        rest=${spec#*:}
        exe=${rest##*:}
        image=${rest%:*}
        box=p-pkg-detect-$label
        start "$box" "$platform" "$image"
        [ "$label" = alpine ] && in_box "$box" apk add -q libstdc++ libgcc >/dev/null 2>&1
        detect_row "$label container" "as is" in_box "$box" "/dist/$exe" detect
        detect_row "$label container" "ASKBOARD_BIND_CONTAINER=1" in_box -e ASKBOARD_BIND_CONTAINER=1 "$box" "/dist/$exe" detect
        detect_row "$label container" "BROWSER=firefox" in_box -e BROWSER=firefox "$box" "/dist/$exe" detect
        detect_row "$label container" "WSL_DISTRO_NAME=Ubuntu" in_box -e WSL_DISTRO_NAME=Ubuntu "$box" "/dist/$exe" detect
        # Without /.dockerenv the rule sees a plain Linux host: hide the marker to test the Linux opener rules.
        in_box "$box" sh -c 'mv /.dockerenv /.dockerenv.hidden 2>/dev/null; true'
        detect_row "$label, container marker hidden (plain Linux)" "no DISPLAY, no xdg-open" in_box "$box" "/dist/$exe" detect
        detect_row "$label, container marker hidden (plain Linux)" "CI=true GITHUB_ACTIONS=true" in_box -e CI=true -e GITHUB_ACTIONS=true "$box" "/dist/$exe" detect
        detect_row "$label, container marker hidden (plain Linux)" "DISPLAY=:0, no xdg-open" in_box -e DISPLAY=:0 "$box" "/dist/$exe" detect
        in_box "$box" sh -c 'printf "#!/bin/sh\nexit 0\n" >/usr/local/bin/xdg-open && chmod +x /usr/local/bin/xdg-open'
        detect_row "$label, container marker hidden (plain Linux)" "DISPLAY=:0, xdg-open (shim)" in_box -e DISPLAY=:0 "$box" "/dist/$exe" detect
        detect_row "$label, container marker hidden (plain Linux)" "xdg-open (shim), no DISPLAY" in_box "$box" "/dist/$exe" detect
        detect_row "$label, container marker hidden (plain Linux)" "CI=true, DISPLAY=:0, xdg-open (shim)" in_box -e CI=true -e DISPLAY=:0 "$box" "/dist/$exe" detect
        detect_row "$label, container marker hidden (plain Linux)" "WSL_DISTRO_NAME=Ubuntu, no wslview" in_box -e WSL_DISTRO_NAME=Ubuntu "$box" "/dist/$exe" detect
        in_box "$box" sh -c 'printf "#!/bin/sh\nexit 0\n" >/usr/local/bin/wslview && chmod +x /usr/local/bin/wslview'
        detect_row "$label, container marker hidden (plain Linux)" "WSL_DISTRO_NAME=Ubuntu, wslview (shim)" in_box -e WSL_DISTRO_NAME=Ubuntu "$box" "/dist/$exe" detect
        docker rm -f "$box" >/dev/null 2>&1
      done
    done
  } >"$RUN_DIR/detect.md" 2>&1
  cat "$RUN_DIR/detect.md"
}

check_cleanup() {
  docker ps -a --filter name=p-pkg- --format '{{.Names}}' | xargs -r docker rm -f
}

check=${1:-}
RUN_DIR=$PROBE/runs/${RUN:-linux-$check}
mkdir -p "$RUN_DIR"
[ -f "$RUN_DIR/release.txt" ] || cp "$PROBE/plugin/scripts/release.txt" "$RUN_DIR/release.txt"
case $check in
  targets) check_targets ;;
  nocurl) check_nocurl ;;
  devcontainer) check_devcontainer ;;
  ci-sim) check_ci_sim ;;
  detect) check_detect ;;
  cleanup) check_cleanup ;;
  *) echo "usage: $0 targets|nocurl|devcontainer|ci-sim|detect|cleanup" >&2; exit 2 ;;
esac
