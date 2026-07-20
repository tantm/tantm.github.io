# tantm.github.io — blog workflow
# make dev / build / preview / new-post TITLE="..." [CATEGORY=...] [LANG=vi] / publish [MSG="..."]

SHELL := /bin/bash

# Astro 7 cần Node >=22 — nạp nvm (.nvmrc) nếu có, fallback node hệ thống
NODE_ENV = export NVM_DIR="$$HOME/.nvm"; \
	[ -s "$$NVM_DIR/nvm.sh" ] && source "$$NVM_DIR/nvm.sh" >/dev/null && nvm use --silent >/dev/null || true

.PHONY: dev build preview install new-post push publish clean

install:
	@$(NODE_ENV); npm install

dev: node_modules
	@$(NODE_ENV); npm run dev -- --host

build: node_modules
	@$(NODE_ENV); npm run build

preview: node_modules
	@$(NODE_ENV); npm run preview -- --host

node_modules: package.json
	@$(NODE_ENV); npm install
	@touch node_modules

# make new-post TITLE="My post title" [CATEGORY=Data] [LANG=vi]
new-post:
	@bash scripts/new-post.sh "$(TITLE)" "$(CATEGORY)" "$(LANG)"

# make publish [MSG="post: my new article"] — build → commit → push → chờ deploy → verify site live
publish: node_modules
	@$(NODE_ENV); bash scripts/publish.sh "$(MSG)"

# make push MSG="..." — chỉ commit + push, không build/verify (dùng publish thay thế)
push:
	git add -A
	git commit -m "$(if $(MSG),$(MSG),update blog)"
	git push origin master

clean:
	rm -rf dist .astro
