#!/usr/bin/env python3
"""
ShipCTL API Server - FastAPI HTTP server to replace Chrome native messaging.
Provides REST API for managing backend deployment workflows.
"""

import json
import os
import signal
import subprocess
import time
import urllib.request
from pathlib import Path
from shutil import which
from typing import Any, Dict, Optional, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="ShipCtl API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartRequest(BaseModel):
    mode: str = "dev-chat"
    repoPath: Optional[str] = None


class MakeRequest(BaseModel):
    target: str
    repoPath: Optional[str] = None


class StatusRequest(BaseModel):
    chatApiBaseUrl: Optional[str] = None
    repoPath: Optional[str] = None


class ConfigRequest(BaseModel):
    pythonPath: str = ""
    repoPath: str = ""


def _read_env_config() -> Dict[str, str]:
    """Read configuration from .shipctl.env file"""
    config = {}
    here = Path(__file__).resolve()
    env_file = here.parent.parent / ".shipctl.env"

    if not env_file.exists():
        return config

    try:
        for line in env_file.read_text("utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                config[key.strip()] = value.strip()
    except Exception:
        pass

    return config


def _find_repo_root(custom_path: Optional[str] = None) -> Path:
    if custom_path:
        candidate = Path(custom_path).expanduser().resolve()
        if (candidate / "Makefile").exists():
            return candidate
        raise RuntimeError(f"Custom repo path invalid: {custom_path}")

    env_config = _read_env_config()
    if "REPO_PATH" in env_config and env_config["REPO_PATH"]:
        candidate = Path(env_config["REPO_PATH"]).expanduser().resolve()
        if (candidate / "Makefile").exists():
            return candidate

    here = Path(__file__).resolve()
    for parent in [here.parent, *here.parents]:
        if (parent / "Makefile").exists():
            return parent

    raise RuntimeError("Could not locate repo root. Set REPO_PATH in .shipctl.env")


def _state_paths(repo_root: Path) -> Tuple[Path, Path]:
    state_dir = repo_root / ".native-host"
    state_dir.mkdir(exist_ok=True)
    return state_dir / "state.json", state_dir / "backend.log"


def _is_pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _read_state(state_path: Path) -> dict:
    if not state_path.exists():
        return {}
    try:
        return json.loads(state_path.read_text("utf-8"))
    except Exception:
        return {}


def _write_state(state_path: Path, state: Dict[str, Any]) -> None:
    state_path.write_text(json.dumps(state, indent=2), "utf-8")


def _health_check(url: str, timeout_s: float = 1.5) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout_s) as resp:
            return 200 <= resp.status < 300
    except Exception:
        return False


def _tail_file(path: Path, max_lines: int = 50) -> str:
    if not path.exists():
        return ""
    try:
        lines = path.read_text("utf-8", errors="replace").splitlines()
        return "\n".join(lines[-max_lines:])
    except Exception:
        return ""


def _augment_path_for_node(env: Dict[str, str]) -> Dict[str, str]:
    path_entries = []

    def add_entry(entry: Path) -> None:
        try:
            if entry.is_dir():
                path_entries.append(str(entry))
        except Exception:
            return

    home = Path.home()
    for entry in (
        Path("/opt/homebrew/bin"),
        Path("/usr/local/bin"),
        Path("/usr/bin"),
        Path("/bin"),
        home / ".local" / "bin",
        home / ".bun" / "bin",
        home / ".volta" / "bin",
        home / ".asdf" / "shims",
        home / ".local" / "share" / "mise" / "shims",
        home / ".fnm",
        home / ".fnm" / "current" / "bin",
    ):
        add_entry(entry)

    nvm_root = home / ".nvm" / "versions" / "node"
    try:
        if nvm_root.is_dir():
            for version_dir in sorted(nvm_root.iterdir(), reverse=True):
                add_entry(version_dir / "bin")
    except Exception:
        pass

    existing = env.get("PATH", "")
    combined = ":".join([*path_entries, existing]) if existing else ":".join(path_entries)
    env = dict(env)
    if combined:
        env["PATH"] = combined
    return env


def _stop_process_tree(pid: int) -> bool:
    try:
        os.killpg(pid, signal.SIGTERM)
    except Exception:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            return False

    deadline = time.time() + 3.0
    while time.time() < deadline:
        if not _is_pid_alive(pid):
            return True
        time.sleep(0.1)

    try:
        os.killpg(pid, signal.SIGKILL)
    except Exception:
        try:
            os.kill(pid, signal.SIGKILL)
        except Exception:
            return False
    return True


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/status")
async def status(request: StatusRequest):
    try:
        repo_root = _find_repo_root(request.repoPath)
        state_path, _ = _state_paths(repo_root)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    state = _read_state(state_path)
    pid = state.get("pid")
    alive = isinstance(pid, int) and _is_pid_alive(pid)
    health_url = None
    healthy = None

    if request.chatApiBaseUrl:
        base = request.chatApiBaseUrl.strip().rstrip("/")
        if base:
            health_url = f"{base}/health"
            healthy = _health_check(health_url)

    return {
        "ok": True,
        "status": "running" if alive else "stopped",
        "pid": pid if alive else None,
        "healthUrl": health_url,
        "healthy": healthy,
        "mode": state.get("mode"),
        "startedAt": state.get("startedAt"),
    }


@app.post("/api/start")
async def start(request: StartRequest):
    if request.mode not in ("dev-chat", "dev-interface-local"):
        raise HTTPException(status_code=400, detail=f"Unknown mode: {request.mode}")

    try:
        repo_root = _find_repo_root(request.repoPath)
        state_path, log_path = _state_paths(repo_root)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    state = _read_state(state_path)
    pid = state.get("pid")
    if isinstance(pid, int) and _is_pid_alive(pid):
        return {"ok": True, "status": "running", "pid": pid}

    command = ["make", "dev-chat"] if request.mode == "dev-chat" else ["make", "dev-interface-local"]

    log_path.parent.mkdir(exist_ok=True)
    log_f = open(log_path, "a", buffering=1)
    log_f.write(f"\n--- start {time.strftime('%Y-%m-%d %H:%M:%S')} mode={request.mode} ---\n")
    log_f.flush()

    try:
        proc = subprocess.Popen(
            command,
            cwd=str(repo_root),
            stdout=log_f,
            stderr=log_f,
            start_new_session=True,
            env=os.environ.copy(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start backend: {e}")

    time.sleep(0.8)
    if proc.poll() is not None:
        tail = _tail_file(log_path, max_lines=60)
        raise HTTPException(status_code=500, detail=f"Backend failed to start: {tail}")

    state = {"pid": proc.pid, "mode": request.mode, "startedAt": int(time.time())}
    _write_state(state_path, state)
    return {"ok": True, "status": "running", "pid": proc.pid}


@app.post("/api/stop")
async def stop(repoPath: Optional[str] = None):
    try:
        repo_root = _find_repo_root(repoPath)
        state_path, _ = _state_paths(repo_root)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    state = _read_state(state_path)
    pid = state.get("pid")
    if not isinstance(pid, int):
        return {"ok": True, "status": "stopped"}
    if not _is_pid_alive(pid):
        _write_state(state_path, {})
        return {"ok": True, "status": "stopped"}

    ok = _stop_process_tree(pid)
    _write_state(state_path, {})
    return {"ok": ok, "status": "stopped" if ok else "error", "pid": pid}


@app.post("/api/logs")
async def logs(repoPath: Optional[str] = None):
    try:
        repo_root = _find_repo_root(repoPath)
        _, log_path = _state_paths(repo_root)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"ok": True, "logTail": _tail_file(log_path, max_lines=120)}


@app.post("/api/make")
async def make(request: MakeRequest):
    allowed_targets = {"build-playground", "build-extension"}
    if request.target not in allowed_targets:
        raise HTTPException(status_code=400, detail=f"Unsupported make target: {request.target}")

    try:
        repo_root = _find_repo_root(request.repoPath)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    make_log_path = repo_root / ".native-host" / f"make-{request.target}.log"
    command = ["make", request.target]

    make_log_path.parent.mkdir(exist_ok=True)
    with open(make_log_path, "a", buffering=1) as log_f:
        log_f.write(f"\n--- make {request.target} {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
        log_f.flush()

        env = _augment_path_for_node(os.environ.copy())
        npm_path = which("npm", path=env.get("PATH", ""))
        if npm_path is None:
            msg = "npm not found in PATH for the API server."
            log_f.write(f"{msg}\n")
            log_f.flush()
            raise HTTPException(status_code=500, detail=msg)
        log_f.write(f"Using npm at: {npm_path}\n")
        log_f.flush()

        try:
            proc = subprocess.run(
                command,
                cwd=str(repo_root),
                stdout=log_f,
                stderr=log_f,
                env=env,
                text=True,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to run make {request.target}: {e}")

    ok = proc.returncode == 0
    return {
        "ok": ok,
        "status": "success" if ok else "error",
        "exitCode": proc.returncode,
        "logTail": _tail_file(make_log_path, 120),
    }


@app.post("/api/config")
async def save_config(request: ConfigRequest):
    try:
        here = Path(__file__).resolve()
        env_file = here.parent.parent / ".shipctl.env"

        lines = []
        lines.append("# shipctl configuration")
        lines.append("# Auto-generated by extension settings")
        lines.append("")
        lines.append("# Path to Python interpreter (for native host)")
        lines.append(f"PYTHON_PATH={request.pythonPath.strip()}")
        lines.append("")
        lines.append("# Path to serverless-llm repository (for backend operations)")
        lines.append(f"REPO_PATH={request.repoPath.strip()}")
        lines.append("")

        env_file.write_text("\n".join(lines), "utf-8")
        return {"ok": True, "status": "saved", "path": str(env_file)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=9876, log_level="info")
