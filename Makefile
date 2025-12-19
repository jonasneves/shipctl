.PHONY: install dev build clean lint install-native help

# Default target
help:
	@echo "shipctl - Ship from your browser"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Development:"
	@echo "  install       Install dependencies"
	@echo "  dev           Start development server"
	@echo "  build         Build extension for production"
	@echo "  lint          Run linter"
	@echo "  clean         Remove build artifacts"
	@echo ""
	@echo "Extension:"
	@echo "  build-ext     Build and prepare for Chrome"
	@echo "  open-ext      Open chrome://extensions in Chrome"
	@echo ""
	@echo "Native Host:"
	@echo "  install-native ID=<ext-id> [BROWSER=chrome]  Install native messaging host"
	@echo ""
	@echo "Examples:"
	@echo "  make install dev                    # First time setup + dev server"
	@echo "  make build-ext                      # Build for loading in Chrome"
	@echo "  make install-native ID=abc123       # Install native host for Chrome"

# Install dependencies
install:
	cd extension && npm install

# Development server
dev:
	cd extension && npm run dev

# Production build
build:
	cd extension && npm run build

# Build extension (alias)
build-ext: build
	@echo ""
	@echo "✓ Extension built to extension/dist/"
	@echo ""
	@echo "To load in Chrome:"
	@echo "  1. Open chrome://extensions"
	@echo "  2. Enable 'Developer mode'"
	@echo "  3. Click 'Load unpacked'"
	@echo "  4. Select: $(PWD)/extension/dist"

# Open Chrome extensions page (macOS)
open-ext:
	@open -a "Google Chrome" "chrome://extensions" 2>/dev/null || \
	open -a "Arc" "chrome://extensions" 2>/dev/null || \
	echo "Could not open Chrome. Navigate to chrome://extensions manually."

# Run linter
lint:
	cd extension && npm run lint

# Clean build artifacts
clean:
	rm -rf extension/dist extension/node_modules

# Install native messaging host
# Usage: make install-native ID=<extension-id> [BROWSER=chrome]
install-native:
ifndef ID
	@echo "Error: Extension ID required"
	@echo "Usage: make install-native ID=<extension-id> [BROWSER=chrome]"
	@echo ""
	@echo "Get your extension ID from chrome://extensions after loading the extension."
	@exit 1
endif
	./native-host/install.sh $(ID) $(or $(BROWSER),chrome)

# Quick start: install + build
setup: install build-ext

# Full dev setup
dev-setup: install
	@echo ""
	@echo "✓ Dependencies installed"
	@echo ""
	@echo "Next steps:"
	@echo "  1. make build-ext    # Build the extension"
	@echo "  2. Load extension/dist in chrome://extensions"
	@echo "  3. make dev          # Start dev server for hot reload"
