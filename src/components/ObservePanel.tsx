import React from 'react';
import { Power, Terminal, AlertCircle, Activity } from 'lucide-react';
import { MODEL_SERVICE_KEYS } from '../hooks/useExtensionConfig';
import { STATUS_DOT_COLORS, STATUS_TEXT_COLORS, HEALTH_LABELS, type HealthStatus } from '../constants/status';

interface ObservePanelProps {
  appId: string;
  backendHealth: HealthStatus;
  backendProcess: 'running' | 'stopped' | 'unknown';
  backendPid: number | null;
  backendBusy: boolean;
  backendLogTail: string | null;
  backendNativeError: string | null;
  chatApiBaseUrl: string;
  onStart: () => void;
  onStop: () => void;
  onFetchLogs: () => void;
}

const HealthDisplay: React.FC<{ health: HealthStatus; showPid?: number | null }> = ({ health, showPid }) => {
  const dotColor = STATUS_DOT_COLORS[health];
  const textColor = STATUS_TEXT_COLORS[health];
  const label = HEALTH_LABELS[health];
  const shouldPulse = health === 'checking';

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-slate-900/40 border border-slate-700/30 rounded-lg">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dotColor} ${shouldPulse ? 'animate-pulse' : ''}`} />
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500">Health</span>
          <span className={`text-xs font-medium ${textColor}`}>{label}</span>
        </div>
      </div>
      {showPid && (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Activity className="w-3 h-3" />
          <span>PID {showPid}</span>
        </div>
      )}
    </div>
  );
};

const ObservePanel: React.FC<ObservePanelProps> = ({
  appId,
  backendHealth,
  backendProcess,
  backendPid,
  backendBusy,
  backendLogTail,
  backendNativeError,
  chatApiBaseUrl,
  onStart,
  onStop,
  onFetchLogs,
}) => {
  const isModelApp = MODEL_SERVICE_KEYS.has(appId);

  if (!isModelApp && appId !== 'chat-api') {
    return (
      <div className="text-[10px] text-slate-500 py-2">
        No observability available for this app
      </div>
    );
  }

  const isLocalChat = chatApiBaseUrl.includes('localhost') || chatApiBaseUrl.includes('127.0.0.1');

  if (isModelApp) {
    return (
      <>
        <HealthDisplay health={backendHealth} />
        <div className="text-[10px] text-slate-500 px-3 py-2 mt-2">
          Model inference endpoint monitoring
        </div>
      </>
    );
  }

  return (
    <>
      <HealthDisplay
        health={backendHealth}
        showPid={backendProcess === 'running' ? backendPid : null}
      />

      {/* Controls */}
      <div className="flex gap-2 mt-2">
        {backendProcess !== 'running' ? (
          <button
            onClick={onStart}
            disabled={backendBusy || !isLocalChat}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Start Server</span>
          </button>
        ) : (
          <button
            onClick={onStop}
            disabled={backendBusy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-300 bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Stop Server</span>
          </button>
        )}
        <button
          onClick={onFetchLogs}
          disabled={backendBusy}
          className="px-3 py-2 text-slate-400 hover:text-white bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="View Logs"
        >
          <Terminal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Logs */}
      {backendLogTail && (
        <div className="space-y-1 mt-2">
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Terminal className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500 font-medium">Logs</span>
          </div>
          <pre className="max-h-32 overflow-auto text-[9px] leading-relaxed bg-slate-950/60 border border-slate-700/30 rounded-lg p-2 text-slate-400 whitespace-pre-wrap font-mono">
            {backendLogTail}
          </pre>
        </div>
      )}

      {/* Error */}
      {backendNativeError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg mt-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-[10px] text-amber-300">{backendNativeError}</span>
        </div>
      )}

      {!isLocalChat && backendProcess !== 'running' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg mt-2">
          <AlertCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <span className="text-[10px] text-blue-300">Server control only available for localhost</span>
        </div>
      )}
    </>
  );
};

export default ObservePanel;
