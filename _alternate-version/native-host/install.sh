#!/bin/bash
#
# Install shipctl native messaging host for Chrome/Chromium browsers
#
# Usage: ./install.sh <extension-id> [browser]
#   extension-id: The Chrome extension ID (from chrome://extensions)
#   browser: chrome (default), arc, brave, edge, chromium

set -e

EXTENSION_ID="${1:-}"
BROWSER="${2:-chrome}"

if [ -z "$EXTENSION_ID" ]; then
    echo "Usage: $0 <extension-id> [browser]"
    echo ""
    echo "  extension-id: The Chrome extension ID (from chrome://extensions)"
    echo "  browser: chrome, arc, brave, edge, chromium (default: chrome)"
    echo ""
    echo "Example:"
    echo "  $0 abcdefghijklmnopqrstuvwxyz chrome"
    exit 1
fi

# Determine paths based on browser and OS
HOST_NAME="io.shipctl.host"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_PATH="$SCRIPT_DIR/shipctl_host.py"

case "$(uname)" in
    Darwin)
        case "$BROWSER" in
            chrome)
                MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
                ;;
            arc)
                MANIFEST_DIR="$HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts"
                ;;
            brave)
                MANIFEST_DIR="$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
                ;;
            edge)
                MANIFEST_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
                ;;
            chromium)
                MANIFEST_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
                ;;
            *)
                echo "Unknown browser: $BROWSER"
                exit 1
                ;;
        esac
        ;;
    Linux)
        case "$BROWSER" in
            chrome)
                MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
                ;;
            brave)
                MANIFEST_DIR="$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
                ;;
            edge)
                MANIFEST_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
                ;;
            chromium)
                MANIFEST_DIR="$HOME/.config/chromium/NativeMessagingHosts"
                ;;
            *)
                echo "Unknown browser: $BROWSER"
                exit 1
                ;;
        esac
        ;;
    *)
        echo "Unsupported OS: $(uname)"
        exit 1
        ;;
esac

# Create manifest directory
mkdir -p "$MANIFEST_DIR"

# Find Python
PYTHON_PATH=$(which python3 2>/dev/null || which python 2>/dev/null)
if [ -z "$PYTHON_PATH" ]; then
    echo "Error: Python not found"
    exit 1
fi

# Create wrapper script (to ensure correct Python is used)
WRAPPER_PATH="$SCRIPT_DIR/shipctl_host_wrapper.sh"
cat > "$WRAPPER_PATH" << EOF
#!/bin/bash
exec "$PYTHON_PATH" "$HOST_PATH" "\$@"
EOF
chmod +x "$WRAPPER_PATH"

# Create manifest
MANIFEST_PATH="$MANIFEST_DIR/$HOST_NAME.json"
cat > "$MANIFEST_PATH" << EOF
{
  "name": "$HOST_NAME",
  "description": "shipctl native messaging host",
  "path": "$WRAPPER_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "✓ Installed native messaging host"
echo ""
echo "  Host name: $HOST_NAME"
echo "  Manifest:  $MANIFEST_PATH"
echo "  Python:    $PYTHON_PATH"
echo "  Browser:   $BROWSER"
echo ""
echo "Reload the extension in chrome://extensions to activate."
