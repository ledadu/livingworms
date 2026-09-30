#!/usr/bin/env bash
# Parallel checkouts of the project for agents: each one gets a git worktree on its own branch, its own ports, its own
# copies of the dev data, and its own logs, so several can build, test and run the game at once without touching each
# other. Usage: agent/agent.sh help (or make agent-help). The project's commands, ports and data come from its
# agents.config.mjs (config.mjs shell).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# The main checkout, even when called from a worktree.
MAIN_ROOT="$(cd "$SCRIPT_DIR" && cd "$(git rev-parse --git-common-dir)/.." && pwd)"
REGISTRY="$MAIN_ROOT/.git/agents"
WORKTREES="${AGENTS_WORKTREES:-$(dirname "$MAIN_ROOT")/$(basename "$MAIN_ROOT").worktrees}"
# PROJECT_NAME, SERVER_COMMAND, CLIENT_COMMAND, SERVER_PORT_BASE, CLIENT_PORT_BASE, TYPECHECK_COMMAND, TEST_COMMAND,
# MAIN_BRANCH, AGENT_BRANCH_PREFIX, CHROME_EXE, CHROME_PROFILE, PLAYWRIGHT_CORE_DEFAULT, SEED_SQLITE (array), SEED_COPY
# (array). The default ports, 7800 and 5300, are clear of the ranges Windows reserves for Hyper-V (netsh interface ipv4
# show excludedportrange protocol=tcp), so the Windows Chrome reaches them through the WSL localhost relay.
eval "$(node "$SCRIPT_DIR/../config.mjs" shell)"
BRANCH_PREFIX="${AGENTS_BRANCH_PREFIX:-$AGENT_BRANCH_PREFIX}"
MAX_SLOTS=99

die() { echo "agent: $*" >&2; exit 1; }
info() { echo "agent: $*" >&2; }

usage() {
  cat <<EOF
Usage: agent/agent.sh <command> [name] [args]    ($PROJECT_NAME)

Inside a worktree created here, [name] may be left out: it is read from its .env.agent.

  new <name> [base]     worktree $WORKTREES/<name> on the branch ${BRANCH_PREFIX}<name> (from [base], default HEAD),
                        node_modules hard-linked, dev data copied (seed of agents.config.mjs), ports reserved
                        (AGENT_KIND=release AGENT_REF=<ref>: a version's test server, kept out of the agents page)
  list                  every agent: branch, ports, running or not, commits since its base, uncommitted files
  env [name]            the agent's variables (eval "\$(agent/agent.sh env <name>)")
  up [name]             starts its server and client in the background (logs in .agent/), waits until they answer
  down [name]           stops them
  restart [name]        down then up
  logs [name] [server|client] [lines]
  url [name]            the client URL
  check [name]          typecheck then the tests, in the worktree
  test [name] [filter]  the tests only (vitest, filter optional)
  exec <name> -- <cmd>  runs <cmd> in the worktree with its variables
  sync [name] [base]    merges [base] (default $MAIN_BRANCH) into the agent's branch
  shot [name] [out.png] [wait ms]   screenshot of the client in the Windows Chrome (see chrome)
  chrome                opens the Windows Chrome with remote debugging on 9222 if it is not open yet
  rm <name> [--force]   stops it, removes the worktree and frees its ports (the branch stays)
EOF
}

# The agent's name: the argument, else the worktree we are in.
resolve_name() {
  local name="${1:-}"
  if [[ -z "$name" ]]; then
    local top
    top="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    [[ -n "$top" && -f "$top/.env.agent" ]] || die "no agent name given and not inside an agent worktree"
    name="$(sed -n 's/^AGENT_NAME=//p' "$top/.env.agent")"
  fi
  [[ -f "$REGISTRY/$name.env" ]] || die "unknown agent '$name' (see: agent.sh list)"
  echo "$name"
}

load() {
  # shellcheck disable=SC1090
  source "$REGISTRY/$1.env"
}

port_in_use() {
  ss -ltnH "sport = :$1" 2>/dev/null | grep -q . && return 0
  return 1
}

free_slot() {
  local slot used
  for ((slot = 1; slot <= MAX_SLOTS; slot++)); do
    used=0
    if compgen -G "$REGISTRY/*.env" >/dev/null; then
      grep -qx "AGENT_SLOT=$slot" "$REGISTRY"/*.env && used=1
    fi
    ((used)) && continue
    port_in_use $((SERVER_PORT_BASE + slot)) && continue
    port_in_use $((CLIENT_PORT_BASE + slot)) && continue
    echo "$slot"
    return
  done
  die "no free slot left"
}

# node_modules of the main checkout, hard-linked (instant, no disk): the links of npm workspaces are relative, so they
# point into the worktree. Vite's cache is left out, each checkout builds its own.
link_node_modules() {
  local dir="$1" rel
  while IFS= read -r rel; do
    [[ -d "$MAIN_ROOT/$rel" ]] || continue
    mkdir -p "$(dirname "$dir/$rel")"
    cp -al "$MAIN_ROOT/$rel" "$dir/$rel"
    rm -rf "$dir/$rel/.vite"
  done < <(cd "$MAIN_ROOT" && find . -name node_modules -type d -prune -not -path './.git/*' | sed 's|^\./||')
}

# Copies of the dev data of the main checkout: its SQLite databases (consistent even while the main server writes to
# them) and its other files or folders (seed of agents.config.mjs).
seed_data() {
  local dir="$1" rel
  for rel in "${SEED_SQLITE[@]}"; do
    [[ -f "$MAIN_ROOT/$rel" ]] || continue
    mkdir -p "$(dirname "$dir/$rel")"
    node "$SCRIPT_DIR/copy-db.mjs" "$MAIN_ROOT/$rel" "$dir/$rel" || info "could not copy $rel, the agent starts without it"
  done
  for rel in "${SEED_COPY[@]}"; do
    [[ -e "$MAIN_ROOT/$rel" ]] || continue
    mkdir -p "$(dirname "$dir/$rel")"
    cp -r "$MAIN_ROOT/$rel" "$(dirname "$dir/$rel")/"
  done
  return 0
}

cmd_new() {
  local name="${1:-}" base="${2:-HEAD}"
  [[ "$name" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "name must be lowercase letters, digits and dashes"
  [[ -f "$REGISTRY/$name.env" ]] && die "agent '$name' already exists"
  local dir="$WORKTREES/$name" branch="$BRANCH_PREFIX$name" slot
  mkdir -p "$REGISTRY" "$WORKTREES"
  slot="$(free_slot)"
  local server_port=$((SERVER_PORT_BASE + slot)) client_port=$((CLIENT_PORT_BASE + slot))
  local base_sha
  base_sha="$(git -C "$MAIN_ROOT" rev-parse "$base")"

  if git -C "$MAIN_ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    info "branch $branch exists, reusing it"
    git -C "$MAIN_ROOT" worktree add "$dir" "$branch" >&2
  else
    git -C "$MAIN_ROOT" worktree add -b "$branch" "$dir" "$base_sha" >&2
  fi
  link_node_modules "$dir"
  seed_data "$dir"
  mkdir -p "$dir/.agent"

  cat >"$REGISTRY/$name.env" <<EOF
AGENT_NAME=$name
AGENT_SLOT=$slot
AGENT_BRANCH=$branch
AGENT_BASE=$base_sha
AGENT_DIR=$dir
SERVER_PORT=$server_port
CLIENT_PORT=$client_port
EOF
  # A test server of a version (release-servers.mjs): AGENT_KIND=release and the branch or tag it serves.
  [[ -n "${AGENT_KIND:-}" ]] && echo "AGENT_KIND=$AGENT_KIND" >>"$REGISTRY/$name.env"
  [[ -n "${AGENT_REF:-}" ]] && echo "AGENT_REF=$AGENT_REF" >>"$REGISTRY/$name.env"
  cp "$REGISTRY/$name.env" "$dir/.env.agent"
  info "ready: $dir (branch $branch, server $server_port, client http://localhost:$client_port)"
  echo "$dir"
}

cmd_env() {
  local name
  name="$(resolve_name "${1:-}")"
  load "$name"
  cat <<EOF
export AGENT_NAME=$AGENT_NAME AGENT_DIR='$AGENT_DIR' AGENT_BRANCH=$AGENT_BRANCH
export SERVER_PORT=$SERVER_PORT CLIENT_PORT=$CLIENT_PORT PORT=$SERVER_PORT
EOF
}

running_pid() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  local pid
  pid="$(cat "$file")"
  kill -0 "$pid" 2>/dev/null && echo "$pid"
}

wait_port() {
  local port="$1" what="$2" log="$3" i limit="${AGENT_UP_TIMEOUT:-240}"
  # A server that prepares its data may take a few seconds alone, minutes when a dozen agents share the machine.
  for ((i = 0; i < limit; i++)); do
    port_in_use "$port" && return 0
    sleep 1
  done
  tail -n 30 "$log" >&2
  die "$what did not open port $port within $limit s (log: $log)"
}

# Runs a command detached in its own session, from the worktree: <run>.pid holds its id, which is also its process
# group, <run>.log its output.
start_group() {
  local run="$1"
  shift
  (cd "$AGENT_DIR" && setsid bash -c 'echo $$ >"$0.pid"; exec "$@"' "$run" "$@" >"$run.log" 2>&1 </dev/null &)
  sleep 0.2
}

cmd_up() {
  local name
  name="$(resolve_name "${1:-}")"
  load "$name"
  local run="$AGENT_DIR/.agent"
  mkdir -p "$run"
  if running_pid "$run/server.pid" >/dev/null; then
    info "$name: server already running"
  else
    port_in_use "$SERVER_PORT" && die "port $SERVER_PORT is taken by another process"
    start_group "$run/server" env PORT="$SERVER_PORT" SERVER_PORT="$SERVER_PORT" CLIENT_PORT="$CLIENT_PORT" bash -c "$SERVER_COMMAND"
  fi
  if running_pid "$run/client.pid" >/dev/null; then
    info "$name: client already running"
  else
    port_in_use "$CLIENT_PORT" && die "port $CLIENT_PORT is taken by another process"
    start_group "$run/client" env CLIENT_PORT="$CLIENT_PORT" SERVER_PORT="$SERVER_PORT" bash -c "$CLIENT_COMMAND"
  fi
  wait_port "$SERVER_PORT" server "$run/server.log"
  wait_port "$CLIENT_PORT" client "$run/client.log"
  info "$name up: http://localhost:$CLIENT_PORT (server ws://localhost:$SERVER_PORT/ws)"
}

# The whole process group, since npm starts tsx or vite as children.
stop_group() {
  local file="$1" pid
  pid="$(running_pid "$file")" || { rm -f "$file"; return 0; }
  kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.5
  done
  kill -9 -- "-$pid" 2>/dev/null || true
  rm -f "$file"
}

cmd_down() {
  local name
  name="$(resolve_name "${1:-}")"
  load "$name"
  stop_group "$AGENT_DIR/.agent/client.pid"
  stop_group "$AGENT_DIR/.agent/server.pid"
  info "$name down"
}

cmd_logs() {
  local name
  name="$(resolve_name "${1:-}")"
  load "$name"
  local which="${2:-server}" lines="${3:-80}"
  [[ "$which" == server || "$which" == client ]] || die "logs: server or client"
  tail -n "$lines" "$AGENT_DIR/.agent/$which.log"
}

cmd_url() {
  local name
  name="$(resolve_name "${1:-}")"
  load "$name"
  echo "http://localhost:$CLIENT_PORT"
}

cmd_list() {
  printf '%-22s %-30s %6s %6s %-8s %6s %6s\n' NAME BRANCH SERVER CLIENT STATE AHEAD DIRTY
  compgen -G "$REGISTRY/*.env" >/dev/null || return 0
  local file
  for file in "$REGISTRY"/*.env; do
    (
      # shellcheck disable=SC1090
      source "$file"
      local state=stopped ahead='?' dirty='?'
      running_pid "$AGENT_DIR/.agent/server.pid" >/dev/null && state=running
      if [[ -d "$AGENT_DIR" ]]; then
        ahead="$(git -C "$AGENT_DIR" rev-list --count --first-parent --no-merges "$AGENT_BASE..HEAD" 2>/dev/null || echo '?')"
        dirty="$(git -C "$AGENT_DIR" status --porcelain 2>/dev/null | wc -l)"
      else
        state=missing
      fi
      printf '%-22s %-30s %6s %6s %-8s %6s %6s\n' "$AGENT_NAME" "$AGENT_BRANCH" "$SERVER_PORT" "$CLIENT_PORT" "$state" "$ahead" "$dirty"
    )
  done
}

cmd_check() {
  local name
  name="$(resolve_name "${1:-}")"
  load "$name"
  cd "$AGENT_DIR"
  bash -c "$TYPECHECK_COMMAND"
  bash -c "$TEST_COMMAND"
}

cmd_test() {
  local name
  name="$(resolve_name "${1:-}")"
  load "$name"
  cd "$AGENT_DIR"
  shift || true
  bash -c "$TEST_COMMAND \"\$@\"" test "$@"
}

cmd_exec() {
  local name="${1:-}"
  shift || true
  [[ "${1:-}" == "--" ]] && shift
  name="$(resolve_name "$name")"
  load "$name"
  cd "$AGENT_DIR"
  PORT=$SERVER_PORT SERVER_PORT=$SERVER_PORT CLIENT_PORT=$CLIENT_PORT AGENT_NAME=$AGENT_NAME "$@"
}

cmd_sync() {
  local name
  name="$(resolve_name "${1:-}")"
  load "$name"
  local base="${2:-$MAIN_BRANCH}"
  git -C "$AGENT_DIR" merge --no-edit "$base"
}

cmd_chrome() {
  if powershell.exe -NoProfile -Command "(Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:9222/json/version).StatusCode" >/dev/null 2>&1; then
    info "Windows Chrome already debuggable on 9222"
    return
  fi
  # A profile of its own, by default in the Windows temporary folder.
  local profile="$CHROME_PROFILE"
  [[ -n "$profile" ]] || profile="$(cmd.exe /c 'echo %TEMP%' 2>/dev/null | tr -d '\r')\\agents-chrome"
  "$CHROME_EXE" --remote-debugging-port=9222 \
    --user-data-dir="$profile" --no-first-run --no-default-browser-check \
    --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling \
    about:blank >/dev/null 2>&1 &
  sleep 3
  info "Windows Chrome started with remote debugging on 9222"
}

cmd_shot() {
  local name
  name="$(resolve_name "${1:-}")"
  load "$name"
  local out="${2:-$AGENT_DIR/.agent/shot.png}" wait_ms="${3:-6000}"
  mkdir -p "$(dirname "$out")"
  cmd_chrome
  node.exe "$(wslpath -w "$SCRIPT_DIR/browser.cjs")" "http://localhost:$CLIENT_PORT" "$(wslpath -w "$(realpath -m "$out")")" "$wait_ms" \
    "$(wslpath -w "${PLAYWRIGHT_CORE:-${PLAYWRIGHT_CORE_DEFAULT:-$MAIN_ROOT/node_modules/playwright-core}}")"
  echo "$out"
}

cmd_rm() {
  local name="${1:-}" force="${2:-}"
  [[ -n "$name" ]] || die "rm needs a name"
  name="$(resolve_name "$name")"
  load "$name"
  cmd_down "$name" || true
  if [[ -d "$AGENT_DIR" ]]; then
    if [[ "$force" == --force ]]; then
      git -C "$MAIN_ROOT" worktree remove --force "$AGENT_DIR"
    else
      git -C "$MAIN_ROOT" worktree remove "$AGENT_DIR" || die "uncommitted changes in $AGENT_DIR (rm $name --force to drop them)"
    fi
  fi
  rm -f "$REGISTRY/$name.env"
  info "$name removed (branch $AGENT_BRANCH kept)"
}

command="${1:-help}"
shift || true
case "$command" in
  new) cmd_new "$@" ;;
  list | ls | status) cmd_list ;;
  env) cmd_env "$@" ;;
  up) cmd_up "$@" ;;
  down) cmd_down "$@" ;;
  restart) cmd_down "$@"; cmd_up "$@" ;;
  logs) cmd_logs "$@" ;;
  url) cmd_url "$@" ;;
  check) cmd_check "$@" ;;
  test) cmd_test "$@" ;;
  exec) cmd_exec "$@" ;;
  sync) cmd_sync "$@" ;;
  shot) cmd_shot "$@" ;;
  chrome) cmd_chrome ;;
  rm) cmd_rm "$@" ;;
  help | -h | --help) usage ;;
  *) usage >&2; exit 2 ;;
esac
