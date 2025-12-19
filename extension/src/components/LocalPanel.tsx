import { useState, useCallback, useEffect } from 'react';
import {
  Terminal,
  Play,
  Square,
  RefreshCw,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Project, NativeResponse } from '../types';

interface LocalPanelProps {
  project: Project | null;
}

export default function LocalPanel({ project }: LocalPanelProps) {
  const [status, setStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown');
  const [pid, setPid] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [logTail, setLogTail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nativeAvailable, setNativeAvailable] = useState<boolean | null>(null);

  const sendNativeMessage = async (payload: object): Promise<NativeResponse> => {
    return new Promise((resolve) => {
      if (!chrome.runtime?.sendMessage) {
        resolve({ ok: false, error: 'Extension runtime not available' });
        return;
      }

      chrome.runtime.sendMessage(
        { type: 'NATIVE_MESSAGE', payload },
        (response: NativeResponse) => {
          const err = chrome.runtime.lastError?.message;
          if (err) {
            resolve({ ok: false, error: err });
          } else {
            resolve(response || { ok: false, error: 'No response' });
          }
        }
      );
    });
  };

  const checkStatus = useCallback(async () => {
    if (!project) return;

    const response = await sendNativeMessage({
      action: 'status',
      projectId: project.id,
    });

    if (response.ok) {
      setNativeAvailable(true);
      setStatus(response.status || 'stopped');
      setPid(response.pid || null);
      setError(null);
    } else {
      if (response.error?.includes('Native host')) {
        setNativeAvailable(false);
      }
      setError(response.error || null);
    }
  }, [project]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const startProcess = async () => {
    if (!project?.localCommand) return;

    setBusy(true);
    setLogTail(null);
    setError(null);

    const response = await sendNativeMessage({
      action: 'start',
      projectId: project.id,
      command: project.localCommand,
      cwd: project.localDir,
    });

    if (response.ok) {
      setStatus('running');
      setPid(response.pid || null);
    } else {
      setError(response.error || 'Failed to start');
      if (response.logTail) setLogTail(response.logTail);
    }

    setBusy(false);
  };

  const stopProcess = async () => {
    if (!project) return;

    setBusy(true);
    setError(null);

    const response = await sendNativeMessage({
      action: 'stop',
      projectId: project.id,
    });

    if (response.ok) {
      setStatus('stopped');
      setPid(null);
    } else {
      setError(response.error || 'Failed to stop');
    }

    setBusy(false);
  };

  const fetchLogs = async () => {
    if (!project) return;

    const response = await sendNativeMessage({
      action: 'logs',
      projectId: project.id,
    });

    if (response.ok && response.logTail) {
      setLogTail(response.logTail);
    }
  };

  if (!project) {
    return (
      <div className="text-center py-12">
        <Terminal className="w-12 h-12 mx-auto mb-3 text-muted" />
        <p className="text-secondary">Select a project to manage local server</p>
      </div>
    );
  }

  if (!project.localCommand) {
    return (
      <div className="text-center py-12">
        <Terminal className="w-12 h-12 mx-auto mb-3 text-muted" />
        <p className="text-secondary mb-1">No local command configured</p>
        <p className="text-xs text-muted">Add a local command in Settings</p>
      </div>
    );
  }

  if (nativeAvailable === false) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-warning opacity-50" />
        <p className="text-secondary mb-2">Native messaging not installed</p>
        <p className="text-xs text-muted mb-4">
          Install the native host to control local servers
        </p>
        <code className="text-xs bg-tertiary px-3 py-1.5 rounded text-secondary">
          make install-native ID=&lt;ext-id&gt;
        </code>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`status-dot ${
                status === 'running'
                  ? 'status-dot-success'
                  : status === 'stopped'
                  ? 'status-dot-neutral'
                  : 'status-dot-warning'
              }`}
            />
            <span className="text-sm font-medium text-primary">
              {status === 'running' ? 'Running' : status === 'stopped' ? 'Stopped' : 'Unknown'}
            </span>
            {pid && <span className="text-xs text-muted">PID {pid}</span>}
          </div>
          <button onClick={checkStatus} className="btn-ghost p-1">
            <RefreshCw className="w-3.5 h-3.5 text-secondary" />
          </button>
        </div>

        <div className="text-xs text-muted font-mono bg-tertiary px-2 py-1.5 rounded mb-4 truncate">
          {project.localCommand}
        </div>

        <div className="flex gap-2">
          {status !== 'running' ? (
            <button
              onClick={startProcess}
              disabled={busy}
              className="btn btn-primary flex-1"
            >
              <Play className="w-3.5 h-3.5" />
              Start
            </button>
          ) : (
            <button
              onClick={stopProcess}
              disabled={busy}
              className="btn btn-danger flex-1"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          )}
          <button onClick={fetchLogs} className="btn btn-secondary">
            <FileText className="w-3.5 h-3.5" />
            Logs
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-3 border-l-4 border-l-red-500">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Logs */}
      {logTail && (
        <div className="card overflow-hidden">
          <div className="px-3 py-2 bg-tertiary border-b border-default">
            <span className="text-xs font-medium text-secondary">Recent Logs</span>
          </div>
          <pre className="p-3 text-[11px] leading-relaxed text-secondary overflow-auto max-h-48 whitespace-pre-wrap bg-primary">
            {logTail}
          </pre>
        </div>
      )}
    </div>
  );
}
