# ShipCTL Extension

Chrome extension for managing GitHub Actions deployments, workflows, and local backend services.

## Configuration

### `.shipctl.env` File

Configuration is managed via `.shipctl.env` file in the extension root directory. This file stores:

- **PYTHON_PATH**: Path to Python interpreter for the API server
- **REPO_PATH**: Path to your project repository

#### Creating Configuration

1. **Via UI (Recommended)**:
   - Click the Settings icon in the extension
   - Enter Repository Path and Python Path
   - Click "Save Configuration"
   - The extension will create/update `.shipctl.env` automatically

2. **Manual Setup**:
   ```bash
   cp .shipctl.env.example .shipctl.env
   # Edit .shipctl.env with your paths
   ```

#### Example

```bash
# shipctl configuration

# Path to Python interpreter (for native host)
# Leave empty to auto-detect: serverless-llm/venv/bin/python or system python3
PYTHON_PATH=/Users/yourname/Documents/GitHub/serverless-llm/venv/bin/python

# Path to serverless-llm repository (for backend operations)
# Leave empty to auto-detect
REPO_PATH=/Users/yourname/Documents/GitHub/serverless-llm
```

## Installation

1. Build the extension:
   ```bash
   npm install
   npm run build:extension
   ```

2. Install native host:
   ```bash
   ./native-host/install-macos.sh
   ```

3. Load extension in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` directory

## Updating Paths

If you change `PYTHON_PATH` in `.shipctl.env`, you must reinstall the native host:

```bash
./native-host/install-macos.sh
```

This updates the Python shebang in the native host script.

Changes to `REPO_PATH` take effect immediately without reinstallation.
