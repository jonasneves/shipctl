# ShipCTL Extension

Chrome extension for managing GitHub Actions deployments and infrastructure workflows.

## Features

- **Build Management**: Trigger and monitor Docker image builds
- **Deployment Control**: Start/stop GitHub Actions workflow deployments
- **Health Monitoring**: Real-time health checks and status of deployed services
- **Workflow Tracking**: View workflow runs, logs, and deployment history
- **Native Host Integration**: Local backend operations via Python native messaging

## Configuration

### `.shipctl.env` File

Configuration is managed via `.shipctl.env` file in the extension root directory. This file stores:

- **PYTHON_PATH**: Path to Python interpreter for the native host
- **REPO_PATH**: Path to your infrastructure repository

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

# Path to infrastructure repository (for backend operations)
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

## Updating Configuration

If you change `PYTHON_PATH` in `.shipctl.env`, you must reinstall the native host:

```bash
./native-host/install-macos.sh
```

This updates the Python shebang in the native host script.

Changes to `REPO_PATH` take effect immediately without reinstallation.

## Extension Configuration

The extension connects to your infrastructure repository via Chrome storage settings:

- **GitHub Token**: Personal access token with `repo` and `workflow` scopes
- **Repository**: Owner and name of your GitHub repository
- **Models Domain**: Base domain for deployed services
- **Profile**: Deployment profile (local_all, remote_all, custom)

Configure these in the Settings panel within the extension.

## Architecture

The extension consists of:

- **DeploymentsPanel**: Main control panel with Build/Deploy/Observe tabs
- **Native Host**: Python bridge for local filesystem operations
- **Chrome Storage**: Persisted configuration and state
- **GitHub API**: Workflow triggers and status monitoring

## Development

```bash
# Install dependencies
npm install

# Type check
npm run type-check

# Build for development
npm run build:extension

# Build and preview locally
npm run build:local
npm run preview
```

## Structure

```
shipctl/
├── src/
│   ├── components/        # React components
│   │   ├── DeploymentsPanel.tsx
│   │   ├── BuildPanel.tsx
│   │   ├── DeployPanel.tsx
│   │   └── ObservePanel.tsx
│   ├── hooks/            # React hooks
│   │   └── useExtensionConfig.ts
│   ├── services/         # API services
│   │   └── nativeHost.ts
│   ├── main.tsx          # Main entry point
│   └── sidepanel.tsx     # Side panel entry point
├── native-host/          # Python native messaging host
├── public/               # Static assets
└── dist/                 # Built extension (generated)
```
