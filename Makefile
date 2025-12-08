# Add Hermit bin directory to PATH for all make targets
export PATH := $(shell pwd)/bin:$(PATH)

##@ General

.PHONY: all
all: ## Build and push all apps, their kustomizations, and OCM componentversions.
	$(MAKE) build-apps
	$(MAKE) build-kustomizations
	$(MAKE) scenario-1-ocm
	$(MAKE) scenario-2-ocm
	$(MAKE) scenario-3-ocm

# The help target prints out all targets with their descriptions organized
# beneath their categories. The categories are represented by '##@' and the
# target descriptions by '##'. The awk command is responsible for reading the
# entire set of makefiles included in this invocation, looking for lines of the
# file as xyz: ## something, and then pretty-format the target and help. Then,
# if there's a line with ##@ something, that gets pretty-printed as a category.
# More info on the usage of ANSI control characters for terminal formatting:
# https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_parameters
# More info on the awk command:
# http://linuxcommand.org/lc3_adv_awk.php

.PHONY: help
help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

.PHONY: build-apps
build-apps: hermit ## Build and push Docker images for bookinfo applications
	cd app-source && docker buildx bake -f docker-bake.hcl --push

.PHONY: build-kustomizations
build-kustomizations: hermit ## Build and push kustomizations for all bookinfo applications
	@./kustomizations/build-and-push-kustomizations.sh

.PHONY: scenario-1-ocm
scenario-1-ocm: hermit ## Build and push OCM componentversions for scenario-1
	@./scenario-1/build-and-transfer-ocm.sh

.PHONY: scenario-2-ocm
scenario-2-ocm: hermit ## Build and push OCM componentversions for scenario-2
	@./scenario-2/build-and-transfer-ocm.sh

.PHONY: scenario-3-ocm
scenario-3-ocm: hermit ## Build and push OCM componentversions for scenario-3
	@./scenario-3/build-and-transfer-ocm.sh

##@ Dependencies

.PHONY: hermit
hermit: ## Check if Hermit is installed and its environment is activated.
	@command -v hermit >/dev/null 2>&1 || { \
		echo "Hermit is not installed. Please install it from https://cashapp.github.io/hermit/"; \
		exit 1; \
	}
	@hermit status >/dev/null 2>&1 || { \
		echo "Hermit environment is not activated. Run 'source ./bin/activate-hermit' or 'eval \"$$(hermit env)\"'"; \
		exit 1; \
	}