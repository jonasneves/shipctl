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
      <div className="text-center py-8">
        <Terminal className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400">Select a project to manage local server</p>
      </div>
    );
  }

  if (!project.localCommand) {
    return (
      <div className="text-center py-8">
        <Terminal className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-400 mb-2">No local command configured</p>
        <p className="text-xs text-slate-500">
          Add a local command in Settings
        </p>
      </div>
    );
  }

  if (nativeAvailable === false) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-500/50" />
        <p className="text-slate-400 mb-2">Native messaging not installed</p>
        <p className="text-xs text-slate-500 mb-4">
          Install the native host to control local servers
        </p>
        <code className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
          ./native-host/install.sh
        </code>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                status === 'running'
                  ? 'bg-green-500'
                  : status === 'stopped'
                  ? 'bg-slate-500'
                  : 'bg-yellow-500'
              }`}
            />
            <span className="text-sm text-slate-200">
              {status === 'running' ? 'Running' : status === 'stopped' ? 'Stopped' : 'Unknown'}
            </span>
            {pid && (
              <span className="text-xs text-slate-500">PID {pid}</span>
            )}
          </div>
          <button
            onClick={checkStatus}
            className="text-xs text-slate-400 hover:text-white"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        <div className="text-xs text-slate-500 font-mono truncate mb-3">
          {project.localCommand}
        </div>

        <div className="flex gap-2">
          {status !== 'running' ? (
            <button
              onClick={startProcess}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              Start
            </button>
          ) : (
            <button
              onClick={stopProcess}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
          )}
          <button
            onClick={fetchLogs}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <FileText className="w-3 h-3" />
            Logs
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-900/20 border border-red-700/50 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Logs */}
      {logTail && (
        <div className="rounded-lg bg-slate-900 border border-slate-700/50 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/50 text-xs text-slate-400">
            Recent Logs
          </div>
          <pre className="p-3 text-[10px] leading-relaxed text-slate-300 overflow-auto max-h-48 whitespace-pre-wrap">
            {logTail}
          </pre>
        </div>
      )}
    </div>
  );
}
