# ShipCTL Extension

Chrome extension for GitHub Actions deployments with health monitoring and local backend control.

## Installation

```bash
npm install
npm run build:extension
./native-host/install-macos.sh
```

Load in Chrome:
1. Navigate to `chrome://extensions`
2. Enable Developer mode
3. Load unpacked from `dist/` directory

## Configuration

Required in Settings panel:
- **GitHub Token**: Personal access token with `repo` and `workflow` scopes
- **GitHub Repository**: Owner and repository name
- **Repository Path**: Local path to project (optional, auto-detected)
- **Python Path**: Python interpreter path (optional, auto-detected)

Configuration saved to `.shipctl.env`. Changes to Python path require reinstalling native host.

## Development

```bash
npm install
npm run type-check
npm run build:extension
```
