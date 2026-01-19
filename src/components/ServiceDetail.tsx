import React, { memo, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Rocket,
  Power,
  Terminal,
  Package,
  CheckCircle,
  XCircle,
  Loader2,
  Globe,
  Monitor,
  RefreshCw,
} from 'lucide-react';
import Sparkline from './Sparkline';
import type { ServiceStatus } from '../constants/status';
import type { WorkflowRun } from '../services/github';

interface ServiceDetailProps {
  name: string;
  status: ServiceStatus;
  latency?: number;
  latencyHistory?: number[];
  publicEndpoint: string;
  endpointUrl?: string;
  localEndpoint?: string;
  localEndpointUrl?: string;
  workflowStatus?: 'running' | 'stopped' | 'failed' | 'starting' | 'unknown';
  lastRun?: WorkflowRun | null;
  onStartCloud?: () => void;
  cloudTriggering?: boolean;
  onBuild?: () => void;
  buildBusy?: boolean;
  buildLogTail?: string | null;
  backendProcess?: 'running' | 'stopped' | 'unknown';
  backendPid?: number | null;
  backendBusy?: boolean;
  backendLogTail?: string | null;
  isLocalChat?: boolean;
  onStart?: () => void;
  onStop?: () => void;
  onFetchLogs?: () => void;
  onBack: () => void;
}

const ServiceDetail: React.FC<ServiceDetailProps> = ({
  name,
  status,
  latency,
  latencyHistory = [],
  publicEndpoint,
  endpointUrl,
  localEndpoint,
  localEndpointUrl,
  workflowStatus,
  lastRun,
  onStartCloud,
  cloudTriggering,
  onBuild,
  buildBusy,
  buildLogTail,
  backendProcess,
  backendPid,
  backendBusy,
  backendLogTail,
  isLocalChat,
  onStart,
  onStop,
  onFetchLogs,
  onBack,
}) => {
  const [showLogs, setShowLogs] = useState(false);
  const isHealthy = status === 'running' || status === 'ok';
  const isDown = status === 'stopped' || status === 'down';
  const isStarting = workflowStatus === 'starting';
  const showLocalSection = onBuild || isLocalChat;

  // Format latency
  const formatLatency = (ms?: number) => {
    if (!ms) return '--';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Deployment status icon
  const DeployStatusIcon = () => {
    if (!lastRun) return null;
    if (lastRun.status === 'in_progress' || lastRun.status === 'queued') {
      return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
    }
    if (lastRun.conclusion === 'success') {
      return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    }
    if (lastRun.conclusion === 'failure') {
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f14]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2832]">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a232e] transition-all"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{name}</h2>
          <p className="text-[11px] text-slate-500 truncate">{publicEndpoint}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Local endpoint link */}
          {localEndpointUrl && (
            <a
              href={localEndpointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a232e] transition-all"
              title={`Local: ${localEndpoint}`}
            >
              <Monitor className="w-4 h-4" />
            </a>
          )}
          {/* Public endpoint link */}
          {endpointUrl && (
            <a
              href={endpointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a232e] transition-all"
              title={`Public: ${publicEndpoint}`}
            >
              <Globe className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Cloud Section - Start/Restart service via GitHub Actions */}
          {onStartCloud && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Cloud
                </h3>
                {publicEndpoint && (
                  <span className="text-[10px] text-slate-600 font-mono">{publicEndpoint}</span>
                )}
              </div>

              {/* Cloud status banner */}
              <div className={`p-3 rounded-xl border border-[#1e2832] ${
                isHealthy ? 'bg-emerald-500/10' :
                isStarting ? 'bg-blue-500/10' :
                isDown || workflowStatus === 'stopped' || workflowStatus === 'failed' ? 'bg-red-500/10' :
                'bg-slate-500/10'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isHealthy ? 'bg-emerald-400' :
                      isStarting ? 'bg-blue-400 animate-pulse' :
                      isDown || workflowStatus === 'stopped' || workflowStatus === 'failed' ? 'bg-red-400' :
                      'bg-slate-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      isHealthy ? 'text-emerald-400' :
                      isStarting ? 'text-blue-400' :
                      isDown || workflowStatus === 'stopped' || workflowStatus === 'failed' ? 'text-red-400' :
                      'text-slate-400'
                    }`}>
                      {isHealthy ? 'Healthy' :
                       isStarting ? 'Starting...' :
                       workflowStatus === 'stopped' ? 'Stopped' :
                       workflowStatus === 'failed' ? 'Failed' :
                       isDown ? 'Down' :
                       'Checking...'}
                    </span>
                  </div>
                  {isHealthy && latency && (
                    <span className="text-xs text-slate-400 font-mono">
                      {formatLatency(latency)}
                    </span>
                  )}
                </div>
                {latencyHistory.length > 1 && isHealthy && (
                  <div className="mt-2">
                    <Sparkline data={latencyHistory} width={260} height={32} />
                  </div>
                )}
              </div>

              {/* Show Start when not running, Restart when running */}
              {workflowStatus === 'running' ? (
                <button
                  onClick={onStartCloud}
                  disabled={cloudTriggering}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-200 bg-[#1a232e] hover:bg-[#232d3b] rounded-xl border border-[#2a3544] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cloudTriggering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Restart
                </button>
              ) : (
                <button
                  onClick={onStartCloud}
                  disabled={cloudTriggering || workflowStatus === 'starting'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cloudTriggering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : workflowStatus === 'starting' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4" />
                  )}
                  {workflowStatus === 'starting' ? 'Starting...' : 'Start'}
                </button>
              )}

              {/* Last deployment info */}
              {lastRun && (
                <div className="flex items-center justify-between px-3 py-2.5 bg-[#0f1419] rounded-xl border border-[#1e2832]">
                  <div className="flex items-center gap-2">
                    <DeployStatusIcon />
                    <div>
                      <div className="text-xs text-slate-400">Last run</div>
                      <div className={`text-xs font-medium ${
                        lastRun.conclusion === 'success' ? 'text-emerald-400' :
                        lastRun.conclusion === 'failure' ? 'text-red-400' :
                        'text-blue-400'
                      }`}>
                        {lastRun.conclusion || lastRun.status}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {lastRun.html_url && (
                      <a
                        href={lastRun.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-500 hover:text-white hover:bg-[#1a232e] rounded-lg transition-all"
                        title="View on GitHub"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Local Section - Build & Server Control */}
          {showLocalSection && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Monitor className="w-3.5 h-3.5 text-slate-500" />
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Local
                </h3>
                {localEndpoint && (
                  <span className="text-[10px] text-slate-600 font-mono">{localEndpoint}</span>
                )}
              </div>

              {/* Local status banner */}
              {isLocalChat && (
                <div className={`p-3 rounded-xl border border-[#1e2832] ${
                  backendProcess === 'running' ? 'bg-emerald-500/10' :
                  backendProcess === 'stopped' ? 'bg-slate-500/10' :
                  'bg-slate-500/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        backendProcess === 'running' ? 'bg-emerald-400' :
                        backendProcess === 'stopped' ? 'bg-slate-400' :
                        'bg-slate-400'
                      }`} />
                      <span className={`text-sm font-medium ${
                        backendProcess === 'running' ? 'text-emerald-400' :
                        'text-slate-400'
                      }`}>
                        {backendProcess === 'running' ? 'Running' :
                         backendProcess === 'stopped' ? 'Stopped' :
                         'Unknown'}
                      </span>
                    </div>
                    {backendPid && backendProcess === 'running' && (
                      <span className="text-xs text-slate-500 font-mono">
                        PID {backendPid}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Build button */}
              {onBuild && (
                <div className="space-y-2">
                  <button
                    onClick={onBuild}
                    disabled={buildBusy}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-200 bg-[#1a232e] hover:bg-[#232d3b] rounded-xl border border-[#2a3544] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {buildBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Package className="w-4 h-4" />
                    )}
                    Build
                  </button>

                  {buildLogTail && (
                    <pre className="max-h-32 overflow-auto text-[10px] leading-relaxed bg-[#0a0f14] border border-[#1e2832] rounded-xl p-3 text-slate-400 whitespace-pre-wrap font-mono">
                      {buildLogTail}
                    </pre>
                  )}
                </div>
              )}

              {/* Server control */}
              {isLocalChat && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {backendProcess !== 'running' ? (
                      <button
                        onClick={onStart}
                        disabled={backendBusy}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl border border-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {backendBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                        Start
                      </button>
                    ) : (
                      <button
                        onClick={onStop}
                        disabled={backendBusy}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {backendBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                        Stop
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onFetchLogs?.();
                        setShowLogs(true);
                      }}
                      disabled={backendBusy}
                      className="px-3 py-2.5 text-slate-400 hover:text-white bg-[#1a232e] hover:bg-[#232d3b] rounded-xl border border-[#2a3544] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="View logs"
                    >
                      <Terminal className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Server logs */}
                  {showLogs && backendLogTail && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] text-slate-500 font-medium">Logs</span>
                        <button
                          onClick={onFetchLogs}
                          disabled={backendBusy}
                          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          Refresh
                        </button>
                      </div>
                      <pre className="max-h-48 overflow-auto text-[10px] leading-relaxed bg-[#0a0f14] border border-[#1e2832] rounded-xl p-3 text-slate-400 whitespace-pre-wrap font-mono">
                        {backendLogTail}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default memo(ServiceDetail);
