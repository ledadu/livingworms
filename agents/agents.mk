# The commands of the agents framework, for the Makefile of the project: `include agents/agents.mk` (AGENTS_DIR is the
# folder, agents by default). The project's own targets stay in its Makefile; `make help` lists both when the project
# defines it as below:
#
#   help: ## This list
#   	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

AGENTS_DIR ?= agents
AGENT := $(AGENTS_DIR)/agent/agent.sh
# Agent name: NAME=... on the command line (the shell's own NAME is ignored), else the worktree we are in (.env.agent).
ID := $(if $(filter command line,$(origin NAME)),$(NAME),)
BASE ?= HEAD
FILTER ?=
LINES ?= 80
VERSION ?=

.PHONY: changes-new changes-check whats-new release release-branches release-patch \
	agent-help agent-new agent-list agent-env agent-up agent-down agent-restart agent-logs agent-logs-client agent-url \
	agent-check agent-test agent-sync agent-shot agent-chrome agent-rm agent-dashboard agent-dashboard-token agent-mirror agent-mirror-act agent-ask agent-queue agent-queue-wait \
	agent-clean backlog backlog-link up down restart logs url shot

# --- Changes, « what's new » and versions ($(AGENTS_DIR)/docs/changes.md) ------------------------------------------------

changes-new: ## Starts changes/unreleased/NAME/entry.md
	@test -n "$(ID)" || { echo "NAME=... required"; exit 2; }
	@node $(AGENTS_DIR)/release/changes.mjs new $(ID)

changes-check: ## Validates every entry of changes/
	@node $(AGENTS_DIR)/release/changes.mjs check

whats-new: ## Regenerates the changelog from changes/
	@node $(AGENTS_DIR)/release/changes.mjs build

release: ## Publishes a release: VERSION=x.y.z planned in changes/planned.json publishes its entries only, else all of changes/unreleased (TITLE=..., INTRO=...): commit of its paths only, tag, no push; X.Y.0 starts release/X.Y (NO_BRANCH=1 not to)
	@TITLE="$(TITLE)" INTRO="$(INTRO)" NO_BRANCH="$(NO_BRANCH)" node $(AGENTS_DIR)/release/publish.mjs $(VERSION)

release-branches: ## The version branches release/X.Y: tag, ahead/behind the integration and main branches, fixes not reported yet
	@node $(AGENTS_DIR)/release/branches.mjs list

release-patch: ## Publishes the fixes of release/LINE (LINE=0.2 [VERSION=0.2.1] TITLE=...) from that branch, in a temporary worktree
	@TITLE="$(TITLE)" INTRO="$(INTRO)" node $(AGENTS_DIR)/release/branches.mjs publish $(LINE) $(VERSION)

# --- Agents: one worktree, branch, port pair, data and log folder each ---------------------------------------------------

agent-help: ## Every agent command, in detail
	@$(AGENT) help

agent-new: ## New agent: make agent-new NAME=x [BASE=branch] [EFFORT=low|medium|high|xhigh|max] [MODEL=sonnet] -> worktree ../<project>.worktrees/x, branch agent/x
	@test -n "$(ID)" || { echo "NAME=... required"; exit 2; }
	@AGENT_EFFORT="$(EFFORT)" AGENT_MODEL="$(MODEL)" $(AGENT) new $(ID) $(BASE)

agent-list: ## Agents, their ports, state, commits and uncommitted files
	@$(AGENT) list

agent-env: ## Agent variables, to eval
	@$(AGENT) env $(ID)

agent-up: ## Starts the agent's server and client in the background
	@$(AGENT) up $(ID)

agent-down: ## Stops them
	@$(AGENT) down $(ID)

agent-restart: ## Restarts them
	@$(AGENT) restart $(ID)

agent-logs: ## Server log (LINES=80)
	@$(AGENT) logs "$(ID)" server $(LINES)

agent-logs-client: ## Client log
	@$(AGENT) logs "$(ID)" client $(LINES)

agent-url: ## Client URL of the agent
	@$(AGENT) url $(ID)

agent-check: ## Typecheck and tests in the agent's worktree
	@$(AGENT) check $(ID)

agent-test: ## Tests in the agent's worktree (FILTER=...)
	@$(AGENT) test "$(ID)" $(FILTER)

agent-sync: ## Merges BASE (default: the main branch) into the agent's branch
	@$(AGENT) sync "$(ID)" $(if $(filter HEAD,$(BASE)),,$(BASE))

agent-shot: ## Screenshot of the agent's client in the Windows Chrome (.agent/shot.png)
	@$(AGENT) shot $(ID)

agent-chrome: ## Opens the Windows Chrome with remote debugging (9222)
	@$(AGENT) chrome

agent-dashboard: ## Live view of every agent worktree on http://localhost:7800 (PORT=...)
	node $(AGENTS_DIR)/agent/dashboard.mjs $(or $(PORT),7800)

agent-dashboard-token: ## The dashboard's token, for a visit from another machine: <address>/?token=<it> once (a cookie keeps it)
	@node $(AGENTS_DIR)/agent/access.mjs

agent-mirror: ## Snapshot of the dashboard for its mirror on claude.ai (agent/mirror.html): .git/agents/mirror.json, that Claude sends to the page (PORT=... of the dashboard)
	@node $(AGENTS_DIR)/agent/mirror.mjs --port $(or $(PORT),7800)

agent-mirror-act: ## Runs an action of the mirror page (FILE=the comment sent to Claude, saved), then takes a new snapshot (PORT=... of the dashboard)
	@test -n "$(FILE)" || { echo "FILE=... required"; exit 2; }
	@node $(AGENTS_DIR)/agent/mirror-act.mjs --port $(or $(PORT),7800) --file $(FILE)

agent-ask: ## An agent asks the user through the dashboard: make agent-ask ARGS='choice --title "…" --option "*A" --option B' (ARGS=--help)
	@node $(AGENTS_DIR)/agent/ask.mjs $(or $(ARGS),--help)

agent-queue: ## Tasks queued from the dashboard's Roadmap page, with their status (MARK="name launched|done" to change one)
	@node $(AGENTS_DIR)/agent/queue.mjs $(if $(MARK),mark $(MARK),list)

agent-queue-wait: ## Blocks until a task is queued from the Roadmap page, prints the queued ones (JSON) and exits
	@node $(AGENTS_DIR)/agent/queue.mjs wait

agent-clean: ## Removes the worktrees of finished agents (archived, merged, clean, stopped), their branch and runs (DRY=1 lists)
	@node $(AGENTS_DIR)/agent/clean.mjs $(if $(DRY),--dry-run,)

backlog: ## Tasks of the backlog and their state (SYNC=1 brings the status lines up to date)
	@node $(AGENTS_DIR)/agent/backlog.mjs $(if $(SYNC),sync,list)

backlog-link: ## Ties a backlog task to an agent launched by hand: make backlog-link TASK=<task id> NAME=<agent>
	@node $(AGENTS_DIR)/agent/backlog.mjs link $(TASK) $(NAME)

agent-rm: ## Removes the agent's worktree and frees its ports (branch kept)
	@test -n "$(ID)" || { echo "NAME=... required"; exit 2; }
	@$(AGENT) rm $(ID)

# Short forms, for use inside an agent worktree.
up: agent-up
down: agent-down
restart: agent-restart
logs: agent-logs
url: agent-url
shot: agent-shot
