# Local build and check entry points. They run the same steps as .github/workflows/pr.yaml.

default:
    @just --list

# Vet, type-check and build every service.
build: candidates interviews web

# candidates (Go): vet and build a local binary into dist/.
candidates:
    cd services/candidates && go vet ./... && go build -o dist/candidates .

# interviews (TypeScript): install and compile.
interviews:
    cd services/interviews && npm ci --no-audit --no-fund && npx tsc -p .

# web (SvelteKit): install, type-check and build the Node server into build/.
web:
    cd services/web && npm ci --no-audit --no-fund && npm run check && npm run build

# Build every service and migration image for both platforms the publish workflow pushes.
images:
    for dir in services/candidates services/candidates/migrations services/interviews services/interviews/migrations services/web; do \
        docker buildx build --platform linux/amd64,linux/arm64 "$dir"; \
    done
