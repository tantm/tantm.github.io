# tantm.github.io — blog workflow
# make dev / build / preview / new-post TITLE="..." [CATEGORY=...] / push [MSG="..."]

.PHONY: dev build preview install new-post push clean

install:
	npm install

dev: node_modules
	npm run dev -- --host

build: node_modules
	npm run build

preview: node_modules
	npm run preview -- --host

node_modules: package.json
	npm install
	@touch node_modules

# make new-post TITLE="My post title" [CATEGORY=Data] [LANG=vi]
new-post:
	@bash scripts/new-post.sh "$(TITLE)" "$(CATEGORY)" "$(LANG)"

# make push MSG="post: my new article"  (chỉ chạy khi đã được duyệt)
push:
	git add -A
	git commit -m "$(if $(MSG),$(MSG),update blog)"
	git push origin master

clean:
	rm -rf dist .astro
