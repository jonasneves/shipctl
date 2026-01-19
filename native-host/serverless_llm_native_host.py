#!/Users/jonasneves/Documents/GitHub/serverless-llm/venv/bin/python

import json
import os
import signal
import struct
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from shutil import which
from typing import Any, Dict, Optional, Tuple


HOST_NAME = "io.neevs.serverless_llm"


def _read_env_config() -> Dict[str, str]:
    config = {}
    env_file = Path(__file__).resolve().parent / ".shipctl.env"

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


def _read_message() -> Optional[Dict[str, Any]]:
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack("<I", raw_length)[0]
    if message_length <= 0:
        return None
    data = sys.stdin.buffer.read(message_length)
    if not data:
        return None
    return json.loads(data.decode("utf-8"))


def _write_message(message: Dict[str, Any]) -> None:
    encoded = json.dumps(message).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def _find_repo_root(custom_path: Optional[str] = None) -> Path:
    if custom_path:
        candidate = Path(custom_path).expanduser().resolve()
        if (candidate / "Makefile").exists() and (candidate / "app" / "chat" / "backend" / "chat_server.py").exists():
            return candidate
        raise RuntimeError(f"Custom repo path invalid: {custom_path} (expected Makefile and app/chat/backend/chat_server.py)")

    env_config = _read_env_config()
    if "REPO_PATH" in env_config and env_config["REPO_PATH"]:
        candidate = Path(env_config["REPO_PATH"]).expanduser().resolve()
        if (candidate / "Makefile").exists() and (candidate / "app" / "chat" / "backend" / "chat_server.py").exists():
            return candidate

    here = Path(__file__).resolve()
    for parent in [here.parent, *here.parents]:
        if (parent / "Makefile").exists() and (parent / "app" / "chat" / "backend" / "chat_server.py").exists():
            return parent

    raise RuntimeError("Could not locate repo root (expected Makefile and app/chat/backend/chat_server.py). Set REPO_PATH in .shipctl.env or extension settings.")


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
    home = Path.home()

    candidates = [
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
    ]

    nvm_root = home / ".nvm" / "versions" / "node"
    try:
        if nvm_root.is_dir():
            candidates.extend(v / "bin" for v in sorted(nvm_root.iterdir(), reverse=True))
    except Exception:
        pass

    for entry in candidates:
        try:
            if entry.is_dir():
                path_entries.append(str(entry))
        except Exception:
            pass

    existing = env.get("PATH", "")
    combined = ":".join([*path_entries, existing]) if existing else ":".join(path_entries)
    env = dict(env)
    if combined:
        env["PATH"] = combined
    return env


def _find_extension_dir() -> Path:
    env_config = _read_env_config()
    if "EXTENSION_DIR" in env_config and env_config["EXTENSION_DIR"]:
        candidate = Path(env_config["EXTENSION_DIR"]).expanduser().resolve()
        if (candidate / "Makefile").exists() and (candidate / "package.json").exists():
            return candidate

    raise RuntimeError("Extension directory not configured. Re-run the native host install script.")


def _run_make_target(repo_root: Path, target: str, log_path: Path) -> dict:
    allowed_targets = {"build-playground", "build-extension"}
    if target not in allowed_targets:
        return {"ok": False, "error": f"Unsupported make target: {target}"}

    if target == "build-extension":
        try:
            working_dir = _find_extension_dir()
        except Exception as e:
            return {"ok": False, "error": str(e)}
    else:
        working_dir = repo_root

    command = ["make", target]

    log_path.parent.mkdir(exist_ok=True)
    with open(log_path, "a", buffering=1) as log_f:
        log_f.write(f"\n--- make {target} {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
        log_f.write(f"Working directory: {working_dir}\n")
        log_f.flush()

        env = _augment_path_for_node(os.environ.copy())
        npm_path = which("npm", path=env.get("PATH", ""))
        if npm_path is None:
            msg = (
                "npm not found in PATH for the native host. "
                "Install Node.js (npm) and re-run the native-host install script so the browser picks it up."
            )
            log_f.write(f"{msg}\n")
            log_f.write(f"PATH={env.get('PATH','')}\n")
            log_f.flush()
            return {"ok": False, "error": msg, "logTail": _tail_file(log_path, 120)}
        log_f.write(f"Using npm at: {npm_path}\n")
        log_f.flush()

        try:
            proc = subprocess.run(
                command,
                cwd=str(working_dir),
                stdout=log_f,
                stderr=log_f,
                env=env,
                text=True,
            )
        except Exception as e:
            return {"ok": False, "error": f"Failed to run make {target}: {e}", "logTail": _tail_file(log_path, 120)}

    ok = proc.returncode == 0
    return {
        "ok": ok,
        "status": "success" if ok else "error",
        "exitCode": proc.returncode,
        "logTail": _tail_file(log_path, 120),
    }


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


def _start_backend(repo_root: Path, state_path: Path, log_path: Path, mode: str) -> dict:
    state = _read_state(state_path)
    pid = state.get("pid")
    if isinstance(pid, int) and _is_pid_alive(pid):
        return {"ok": True, "status": "running", "pid": pid}

    command = ["make", "dev-chat"] if mode == "dev-chat" else ["make", "dev-interface-local"]

    log_path.parent.mkdir(exist_ok=True)
    log_f = open(log_path, "a", buffering=1)
    log_f.write(f"\n--- start {time.strftime('%Y-%m-%d %H:%M:%S')} mode={mode} ---\n")
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
        return {"ok": False, "error": f"Failed to start backend: {e}"}

    time.sleep(0.8)
    if proc.poll() is not None:
        tail = _tail_file(log_path, max_lines=60)
        return {"ok": False, "error": "Backend failed to start", "logTail": tail}

    state = {"pid": proc.pid, "mode": mode, "startedAt": int(time.time())}
    _write_state(state_path, state)
    return {"ok": True, "status": "running", "pid": proc.pid}


def _status(repo_root: Path, state_path: Path, chat_base_url: Optional[str]) -> dict:
    state = _read_state(state_path)
    pid = state.get("pid")
    alive = isinstance(pid, int) and _is_pid_alive(pid)
    health_url = None
    healthy = None

    if chat_base_url:
        base = chat_base_url.strip().rstrip("/")
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


def _stop(state_path: Path) -> dict:
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


def main() -> None:
    message = _read_message()
    if message is None:
        return

    custom_repo_path = message.get("repoPath")

    try:
        repo_root = _find_repo_root(custom_repo_path)
        state_path, log_path = _state_paths(repo_root)
    except Exception as e:
        _write_message({"ok": False, "error": str(e)})
        return

    action = message.get("action")
    if action == "make":
        target = message.get("target")
        if not isinstance(target, str) or not target.strip():
            _write_message({"ok": False, "error": "Missing make target"})
            return
        target = target.strip()

        if target == "build-extension":
            try:
                extension_dir = _find_extension_dir()
                log_dir = extension_dir / ".native-host"
                log_dir.mkdir(exist_ok=True)
                make_log_path = log_dir / f"make-{target}.log"
            except Exception as e:
                _write_message({"ok": False, "error": str(e)})
                return
        else:
            make_log_path = repo_root / ".native-host" / f"make-{target}.log"

        _write_message(_run_make_target(repo_root, target, make_log_path))
        return

    if action == "start":
        mode = message.get("mode") or "dev-chat"
        if mode not in ("dev-chat", "dev-interface-local"):
            _write_message({"ok": False, "error": f"Unknown mode: {mode}"})
            return
        _write_message(_start_backend(repo_root, state_path, log_path, mode))
        return

    if action == "stop":
        _write_message(_stop(state_path))
        return

    if action == "status":
        _write_message(_status(repo_root, state_path, message.get("chatApiBaseUrl")))
        return

    if action == "logs":
        _write_message({"ok": True, "logTail": _tail_file(log_path, max_lines=120)})
        return

    if action == "get_config":
        # Auto-detect configuration values
        detected = {}

        # Detect repo path (already found above)
        detected["repoPath"] = str(repo_root)

        # Detect python path
        python_path = which("python3") or which("python")
        if python_path:
            detected["pythonPath"] = python_path

        # Detect GitHub repo owner/name from git remote
        git_config = repo_root / ".git" / "config"
        if git_config.exists():
            try:
                content = git_config.read_text("utf-8")
                import re
                # Match: url = git@github.com:owner/repo.git or url = https://github.com/owner/repo.git
                match = re.search(r'url\s*=\s*(?:git@github\.com:|https://github\.com/)([^/]+)/([^/\s]+?)(?:\.git)?$', content, re.MULTILINE)
                if match:
                    detected["githubRepoOwner"] = match.group(1)
                    detected["githubRepoName"] = match.group(2)
            except Exception:
                pass

        _write_message({"ok": True, **detected})
        return

    if action == "save_config":
        try:
            env_file = Path(__file__).resolve().parent / ".shipctl.env"
            existing_config = _read_env_config()
            extension_dir = existing_config.get("EXTENSION_DIR", "")
            python_path = message.get("pythonPath", "").strip()
            repo_path = message.get("repoPath", "").strip()

            content = f"""# shipctl configuration
# Auto-generated by extension settings / install script

# Path to Python interpreter (for native host)
PYTHON_PATH={python_path}

# Path to serverless-llm repository (for backend operations)
REPO_PATH={repo_path}

# Path to extension source directory (set by install script)
EXTENSION_DIR={extension_dir}
"""
            env_file.write_text(content, "utf-8")
            _write_message({"ok": True, "status": "saved", "path": str(env_file)})
            return
        except Exception as e:
            _write_message({"ok": False, "error": f"Failed to save config: {e}"})
            return

    _write_message({"ok": False, "error": f"Unknown action: {action}"})


if __name__ == "__main__":
    main()
