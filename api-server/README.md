## ShipCtl API Server

FastAPI HTTP server to replace Chrome native messaging for the ShipCtl extension.

### Installation

```bash
pip install -r requirements.txt
```

### Running

```bash
python server.py
```

The server will start on `http://127.0.0.1:9876`

### API Endpoints

- `GET /health` - Health check
- `POST /api/status` - Get backend status
- `POST /api/start` - Start backend server
- `POST /api/stop` - Stop backend server
- `POST /api/logs` - Get backend logs
- `POST /api/make` - Run make targets (build-playground, build-extension)
- `POST /api/config` - Save configuration

### Development

Run with auto-reload:
```bash
uvicorn server:app --reload --host 127.0.0.1 --port 9876
```
