import { useState, useCallback, useEffect } from 'react';
import { Terminal, Play, Square, RefreshCw, FileText, AlertCircle } from 'lucide-react';
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
      <div className="empty-state">
        <Terminal className="w-10 h-10 empty-state-icon mx-auto" />
        <p className="empty-state-title">No project selected</p>
        <p className="empty-state-text">Select a project to manage local server</p>
      </div>
    );
  }

  if (!project.localCommand) {
    return (
      <div className="empty-state">
        <Terminal className="w-10 h-10 empty-state-icon mx-auto" />
        <p className="empty-state-title">No local command configured</p>
        <p className="empty-state-text">Add a local command in Settings</p>
      </div>
    );
  }

  if (nativeAvailable === false) {
    return (
      <div className="empty-state">
        <AlertCircle className="w-10 h-10 empty-state-icon mx-auto" />
        <p className="empty-state-title">Native messaging not installed</p>
        <p className="empty-state-text mb-4">Install to control local servers</p>
        <code className="text-xs bg-secondary px-3 py-1.5 rounded mono text-secondary">
          make install-native ID=&lt;ext-id&gt;
        </code>
      </div>
    );
  }

  return (
    <div>
      {/* Section header */}
      <div className="section-header flex items-center justify-between">
        <span className="section-title">Local Server</span>
        <button onClick={checkStatus} className="btn btn-ghost btn-sm">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Status box */}
      <div className="m-4">
        <div className="box">
          <div className="box-header">
            <div className="flex items-center gap-2">
              <span className={`status-dot ${
                status === 'running' ? 'status-dot-success' :
                status === 'stopped' ? 'status-dot-neutral' : 'status-dot-warning'
              }`} />
              <span className="box-header-title">
                {status === 'running' ? 'Running' : status === 'stopped' ? 'Stopped' : 'Unknown'}
              </span>
              {pid && <span className="text-xs text-muted">PID {pid}</span>}
            </div>
          </div>
          <div className="box-body">
            <div className="mono text-xs text-secondary bg-secondary px-3 py-2 rounded mb-4 truncate">
              {project.localCommand}
            </div>
            <div className="flex gap-2">
              {status !== 'running' ? (
                <button onClick={startProcess} disabled={busy} className="btn btn-primary flex-1">
                  <Play className="w-3.5 h-3.5" />
                  Start
                </button>
              ) : (
                <button onClick={stopProcess} disabled={busy} className="btn btn-danger flex-1">
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
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-4">
          <div className="box border-danger/30 bg-danger/5">
            <div className="box-body py-3">
              <p className="text-xs text-danger">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Logs */}
      {logTail && (
        <div className="mx-4 mb-4">
          <div className="box">
            <div className="box-header">
              <span className="box-header-title">Recent Logs</span>
            </div>
            <pre className="p-3 text-[11px] leading-relaxed text-secondary overflow-auto max-h-48 whitespace-pre-wrap mono">
              {logTail}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
