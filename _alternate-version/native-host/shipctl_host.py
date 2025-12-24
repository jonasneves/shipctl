#!/usr/bin/env python3
"""
shipctl native messaging host

Manages local development processes for the shipctl Chrome extension.
"""

import json
import os
import signal
import struct
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional


def read_message() -> Optional[Dict[str, Any]]:
    """Read a message from Chrome's native messaging protocol."""
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


def write_message(message: Dict[str, Any]) -> None:
    """Write a message using Chrome's native messaging protocol."""
    encoded = json.dumps(message).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def get_state_dir() -> Path:
    """Get the state directory for shipctl."""
    state_dir = Path.home() / ".shipctl"
    state_dir.mkdir(exist_ok=True)
    return state_dir


def get_project_state_file(project_id: str) -> Path:
    """Get the state file path for a project."""
    return get_state_dir() / f"{project_id}.json"


def get_project_log_file(project_id: str) -> Path:
    """Get the log file path for a project."""
    return get_state_dir() / f"{project_id}.log"


def is_pid_alive(pid: int) -> bool:
    """Check if a process is still running."""
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def read_state(project_id: str) -> Dict[str, Any]:
    """Read the state for a project."""
    state_file = get_project_state_file(project_id)
    if not state_file.exists():
        return {}
    try:
        return json.loads(state_file.read_text("utf-8"))
    except Exception:
        return {}


def write_state(project_id: str, state: Dict[str, Any]) -> None:
    """Write the state for a project."""
    state_file = get_project_state_file(project_id)
    state_file.write_text(json.dumps(state, indent=2), "utf-8")


def tail_file(path: Path, max_lines: int = 50) -> str:
    """Read the last N lines of a file."""
    if not path.exists():
        return ""
    try:
        lines = path.read_text("utf-8", errors="replace").splitlines()
        return "\n".join(lines[-max_lines:])
    except Exception:
        return ""


def stop_process(pid: int) -> bool:
    """Stop a process and its children."""
    try:
        os.killpg(pid, signal.SIGTERM)
    except Exception:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            return False

    # Wait for graceful shutdown
    deadline = time.time() + 3.0
    while time.time() < deadline:
        if not is_pid_alive(pid):
            return True
        time.sleep(0.1)

    # Force kill if still alive
    try:
        os.killpg(pid, signal.SIGKILL)
    except Exception:
        try:
            os.kill(pid, signal.SIGKILL)
        except Exception:
            return False

    return True


def handle_start(project_id: str, command: str, cwd: Optional[str] = None) -> Dict[str, Any]:
    """Start a local development process."""
    state = read_state(project_id)
    pid = state.get("pid")

    # Check if already running
    if isinstance(pid, int) and is_pid_alive(pid):
        return {"ok": True, "status": "running", "pid": pid}

    # Prepare log file
    log_file = get_project_log_file(project_id)
    log_f = open(log_file, "a", buffering=1)
    log_f.write(f"\n--- start {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
    log_f.write(f"command: {command}\n")
    log_f.write(f"cwd: {cwd or 'default'}\n")
    log_f.flush()

    # Determine working directory
    work_dir = cwd if cwd else str(Path.home())

    try:
        proc = subprocess.Popen(
            command,
            shell=True,
            cwd=work_dir,
            stdout=log_f,
            stderr=log_f,
            start_new_session=True,
            env=os.environ.copy(),
        )
    except Exception as e:
        return {"ok": False, "error": f"Failed to start: {e}"}

    # Wait briefly to check if it started
    time.sleep(0.5)
    if proc.poll() is not None:
        tail = tail_file(log_file, max_lines=30)
        return {"ok": False, "error": "Process exited immediately", "logTail": tail}

    # Save state
    write_state(project_id, {
        "pid": proc.pid,
        "command": command,
        "cwd": work_dir,
        "startedAt": int(time.time()),
    })

    return {"ok": True, "status": "running", "pid": proc.pid}


def handle_stop(project_id: str) -> Dict[str, Any]:
    """Stop a running process."""
    state = read_state(project_id)
    pid = state.get("pid")

    if not isinstance(pid, int):
        return {"ok": True, "status": "stopped"}

    if not is_pid_alive(pid):
        write_state(project_id, {})
        return {"ok": True, "status": "stopped"}

    ok = stop_process(pid)
    write_state(project_id, {})
    return {"ok": ok, "status": "stopped" if ok else "error", "pid": pid}


def handle_status(project_id: str) -> Dict[str, Any]:
    """Get the status of a project's process."""
    state = read_state(project_id)
    pid = state.get("pid")
    alive = isinstance(pid, int) and is_pid_alive(pid)

    return {
        "ok": True,
        "status": "running" if alive else "stopped",
        "pid": pid if alive else None,
        "command": state.get("command"),
        "startedAt": state.get("startedAt"),
    }


def handle_logs(project_id: str) -> Dict[str, Any]:
    """Get recent logs for a project."""
    log_file = get_project_log_file(project_id)
    return {"ok": True, "logTail": tail_file(log_file, max_lines=100)}


def main() -> None:
    """Main entry point."""
    message = read_message()
    if message is None:
        return

    action = message.get("action")
    project_id = message.get("projectId", "default")

    if action == "start":
        command = message.get("command")
        if not command:
            write_message({"ok": False, "error": "No command provided"})
            return
        write_message(handle_start(project_id, command, message.get("cwd")))
        return

    if action == "stop":
        write_message(handle_stop(project_id))
        return

    if action == "status":
        write_message(handle_status(project_id))
        return

    if action == "logs":
        write_message(handle_logs(project_id))
        return

    write_message({"ok": False, "error": f"Unknown action: {action}"})


if __name__ == "__main__":
    main()
