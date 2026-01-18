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

> **IMPORTANT: macOS Security Restriction**
>
> On macOS, Chrome cannot execute scripts from arbitrary directories due to security restrictions. If you get "Native host has exited" or "Operation not permitted" errors, the native host must be installed to `~/.config/shipctl-native-host/` (which the install script does automatically).
>
> After installing, you must **restart Chrome completely** (Cmd+Q, then reopen).
>
> To debug native host issues, run Chrome from Terminal:
> ```bash
> /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --enable-logging=stderr 2>&1 | grep -i native
> ```

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
