# La Lignée: the game's commands, and those of the agents framework (agents/agents.mk). `make help` lists them all.

.DEFAULT_GOAL := help
.PHONY: help dev check typecheck test build play

help: ## This list
	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

dev: ## The game with hot reload on http://localhost:5180
	@npm run dev

check: ## Typecheck, then every test (the game's and the agents framework's)
	@npm run typecheck --silent && npx vitest run

typecheck: ## Typecheck only
	@npm run typecheck --silent

test: ## Tests only (FILTER=file)
	@npx vitest run $(FILTER)

build: ## The single self-contained file, in dist/index.html
	@npm run build

play: ## Rebuilds the playable page play/lignee-monde.html
	@npm run play

# the dashboard of La Lignée's agents: http://localhost:8200 (Allèle's is on 7800)
PORT ?= 8200

include agents/agents.mk
