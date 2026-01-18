#!/usr/bin/env bash
set -euo pipefail

# Get script directory and extension root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOST_DIR="$SCRIPT_DIR"
# Find GitHub directory (serverless-llm sibling)
GITHUB_DIR="$(cd "$SCRIPT_DIR" && while [[ "$PWD" != "/" ]]; do if [[ -d "$PWD/../serverless-llm" ]]; then cd ..; pwd; exit 0; fi; cd ..; done; echo "")"
ROOT_DIR="${GITHUB_DIR:-$(cd "$EXT_DIR/../.." && pwd)}"

# Read config from .shipctl.env if it exists
read_env_config() {
  local env_file="$EXT_DIR/.shipctl.env"
  if [[ -f "$env_file" ]]; then
    while IFS='=' read -r key value; do
      # Skip comments and empty lines
      [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
      # Trim whitespace
      key=$(echo "$key" | xargs)
      value=$(echo "$value" | xargs)
      case "$key" in
        PYTHON_PATH) export CONFIG_PYTHON_PATH="$value" ;;
        REPO_PATH) export CONFIG_REPO_PATH="$value" ;;
      esac
    done < "$env_file"
  fi
}

read_env_config

# Read extension ID from .extension-id file if not provided
if [[ $# -eq 0 ]]; then
  if [[ -f "$EXT_DIR/.extension-id" ]]; then
    EXT_ID="$(cat "$EXT_DIR/.extension-id" | tr -d '[:space:]')"
    echo "Using extension ID from .extension-id: $EXT_ID"
  else
    echo "Usage: $0 [extension-id] [browser]"
    echo ""
    echo "No extension ID provided and .extension-id file not found."
    echo "Run 'make build' first to generate the extension with stable ID."
    exit 1
  fi
else
  EXT_ID="$1"
fi

BROWSER="${2:-chrome}"

PY="$HOST_DIR/serverless_llm_native_host.py"

pick_python() {
  # Try config file first
  if [[ -n "${CONFIG_PYTHON_PATH:-}" && -x "$CONFIG_PYTHON_PATH" ]]; then
    echo "$CONFIG_PYTHON_PATH"
    return
  fi
  # Try serverless-llm venv (sibling directory)
  if [[ -x "$ROOT_DIR/serverless-llm/venv/bin/python" ]]; then
    echo "$ROOT_DIR/serverless-llm/venv/bin/python"
    return
  fi
  # Try system python3
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return
  fi
  # Try system python
  if command -v python >/dev/null 2>&1; then
    command -v python
    return
  fi
  echo "Python not found. Install Python 3.11+ or set PYTHON_PATH in .shipctl.env" >&2
  exit 1
}

PYTHON_BIN="$(pick_python)"

# Update shebang in Python file directly (the working approach)
sed -i.bak "1s|.*|#!$PYTHON_BIN|" "$PY"
rm -f "$PY.bak"
chmod +x "$PY"

pick_dest_dir() {
  local base="$HOME/Library/Application Support"

  case "$BROWSER" in
    chrome)
      echo "$base/Google/Chrome/NativeMessagingHosts"
      ;;
    canary)
      echo "$base/Google/Chrome Canary/NativeMessagingHosts"
      ;;
    chromium)
      echo "$base/Chromium/NativeMessagingHosts"
      ;;
    brave)
      echo "$base/BraveSoftware/Brave-Browser/NativeMessagingHosts"
      ;;
    arc)
      echo "$base/Arc/NativeMessagingHosts"
      ;;
    edge)
      echo "$base/Microsoft Edge/NativeMessagingHosts"
      ;;
    *)
      echo "Unknown browser: $BROWSER" >&2
      echo "Options: chrome | canary | chromium | brave | arc | edge" >&2
      exit 1
      ;;
  esac
}

DEST_DIR="$(pick_dest_dir)"
mkdir -p "$DEST_DIR"

# IMPORTANT: On macOS, Chrome cannot execute scripts from arbitrary directories
# due to security restrictions ("Operation not permitted").
# We install to ~/.config/ which Chrome can access.
INSTALL_DIR="$HOME/.config/shipctl-native-host"
mkdir -p "$INSTALL_DIR"

# Copy the Python script to the install directory
cp "$PY" "$INSTALL_DIR/serverless_llm_native_host.py"
chmod +x "$INSTALL_DIR/serverless_llm_native_host.py"

# Create a bash wrapper (Chrome can execute bash which then runs Python)
WRAPPER_PATH="$INSTALL_DIR/native-host-wrapper"
cat > "$WRAPPER_PATH" <<EOF
#!/bin/bash
exec $PYTHON_BIN "$INSTALL_DIR/serverless_llm_native_host.py"
EOF
chmod +x "$WRAPPER_PATH"

MANIFEST_PATH="$DEST_DIR/io.neevs.serverless_llm.json"
cat > "$MANIFEST_PATH" <<EOF
{
  "name": "io.neevs.serverless_llm",
  "description": "Serverless LLM native host (start/stop local backend)",
  "path": "$WRAPPER_PATH",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
EOF

echo ""
echo "✓ Installed native host for $BROWSER"
echo "  Install dir: $INSTALL_DIR"
echo "  Manifest: $MANIFEST_PATH"
echo "  Extension ID: $EXT_ID"
echo ""
echo "NOTE: On macOS, the native host is installed to ~/.config/shipctl-native-host/"
echo "      to avoid Chrome security restrictions (Operation not permitted)."
echo ""
echo "Next steps:"
echo "  1) Restart Chrome completely (Cmd+Q, then reopen)"
echo "  2) Reload the extension in chrome://extensions"
echo "  3) Open the side panel and use Backend controls"
