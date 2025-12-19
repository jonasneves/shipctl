# shipctl

Ship from your browser. A Chrome extension control plane for modern developers.

## What is shipctl?

shipctl is a browser-native DevOps control plane that lets you:

- **Trigger deployments** — Start GitHub Actions workflows with one click
- **Monitor services** — Health checks for all your endpoints
- **Control local dev** — Start/stop local servers via native messaging
- **Switch environments** — One-click profiles for dev/staging/prod

Built for developers who vibe-code with AI assistants and want deployment to be just as easy.

## Quick Start

### 1. Install the Extension

```bash
# Clone and build
git clone https://github.com/jonasneves/shipctl.git
cd shipctl/extension
npm install
npm run build

# Load in Chrome
# 1. Go to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the dist/ folder
```

### 2. Configure Your Projects

Click the extension icon → Settings → Add your first project:

```json
{
  "name": "My API",
  "repo": "username/my-api",
  "workflows": ["deploy.yml"],
  "localCommand": "npm run dev",
  "localPort": 3000,
  "healthEndpoint": "/health"
}
```

### 3. (Optional) Enable Local Server Control

For starting/stopping local dev servers from the browser:

```bash
cd native-host
./install.sh <extension-id> chrome
```

## Features

### Side Panel Dashboard

Access everything from Chrome's side panel:

| Tab | Description |
|-----|-------------|
| **Projects** | Switch between configured projects |
| **Deploy** | Trigger GitHub Actions workflows |
| **Services** | Health status of all endpoints |
| **Local** | Start/stop local dev servers |

### GitHub Actions Integration

- View workflow status (running, success, failed)
- Trigger deployments with custom inputs
- Quick actions for common workflows

### Native Messaging (Optional)

Control local processes directly from the browser:

- Start dev servers (`npm run dev`, `make dev`, etc.)
- Stop running processes
- View logs
- Auto-detect project type

### Environment Profiles

One-click switching between:

- **Production** — All cloud endpoints
- **Development** — Local server + cloud services
- **Local** — Fully offline

## Project Structure

```
shipctl/
├── extension/           # Chrome extension
│   ├── public/
│   │   ├── manifest.json
│   │   └── background.js
│   └── src/
│       ├── components/  # React components
│       ├── hooks/       # Custom hooks
│       └── lib/         # Utilities
├── native-host/         # Native messaging helper
│   ├── shipctl_host.py
│   └── install.sh
└── docs/
    ├── getting-started.md
    └── configuration.md
```

## Configuration

### Project Config

Projects are stored in `chrome.storage.local`:

```typescript
interface Project {
  id: string;
  name: string;
  repo: string;                    // GitHub repo (owner/name)
  workflows: string[];             // Workflow files to monitor/trigger
  localCommand?: string;           // Command to start local server
  localPort?: number;              // Port for health checks
  localDir?: string;               // Working directory
  healthEndpoint?: string;         // Health check path
  environments?: {
    production?: string;           // Production URL
    staging?: string;              // Staging URL
  };
}
```

### GitHub Token

Required for GitHub Actions integration:

1. Create a [Personal Access Token](https://github.com/settings/tokens/new?scopes=repo,workflow)
2. Add it in Settings → GitHub Token

## Requirements

- Chrome/Chromium-based browser
- Node.js 18+ (for building)
- Python 3.8+ (for native messaging, optional)

## Roadmap

- [ ] Multi-project support
- [ ] Workflow run history
- [ ] Log streaming
- [ ] Firefox support
- [ ] Team sharing (sync configs)

## License

MIT
