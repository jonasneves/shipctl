import React, { memo, useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
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
  onStopCloud?: () => void;
  onBuildCloud?: () => void;
  cloudTriggering?: boolean;
  cloudStopping?: boolean;
  cloudBuilding?: boolean;
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
  onRestart?: () => void;
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
  onStopCloud,
  onBuildCloud,
  cloudTriggering,
  cloudStopping,
  cloudBuilding,
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
  onRestart,
  onFetchLogs,
  onBack,
}) => {
  const [logsExpanded, setLogsExpanded] = useState(false);
  const logsRef = useRef<HTMLPreElement>(null);
  const buildLogsRef = useRef<HTMLPreElement>(null);

  // Auto-fetch logs when local backend is shown
  useEffect(() => {
    if (isLocalChat && backendProcess === 'running' && onFetchLogs) {
      onFetchLogs();
    }
  }, [isLocalChat, backendProcess, onFetchLogs]);

  // Auto-refresh logs when expanded
  useEffect(() => {
    if (!logsExpanded || !onFetchLogs || backendProcess !== 'running') return;
    const interval = setInterval(onFetchLogs, 3000);
    return () => clearInterval(interval);
  }, [logsExpanded, onFetchLogs, backendProcess]);

  // Auto-scroll logs to bottom when expanded or logs change
  useEffect(() => {
    if (logsExpanded && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logsExpanded, backendLogTail]);

  // Auto-scroll build logs to bottom
  useEffect(() => {
    if (buildLogsRef.current) {
      buildLogsRef.current.scrollTop = buildLogsRef.current.scrollHeight;
    }
  }, [buildLogTail]);

  // Get last line of logs
  const lastLogLine = backendLogTail?.trim().split('\n').pop() || null;
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

  // Format duration from timestamps
  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const diffMs = endTime - startTime;

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Cloud status helpers
  const isWorkflowBad = workflowStatus === 'stopped' || workflowStatus === 'failed';

  const getCloudBannerBg = () => {
    if (isHealthy) return 'bg-emerald-500/10';
    if (isStarting) return 'bg-blue-500/10';
    if (isDown || isWorkflowBad) return 'bg-red-500/10';
    return 'bg-slate-500/10';
  };

  const getCloudDotClass = () => {
    if (isHealthy) return 'bg-emerald-400';
    if (isStarting) return 'bg-blue-400 animate-pulse';
    if (isDown || isWorkflowBad) return 'bg-red-400';
    return 'bg-slate-400';
  };

  const getCloudTextClass = () => {
    if (isHealthy) return 'text-emerald-400';
    if (isStarting) return 'text-blue-400';
    if (isDown || isWorkflowBad) return 'text-red-400';
    return 'text-slate-400';
  };

  const getCloudStatusText = () => {
    if (isHealthy) return 'Healthy';
    if (isStarting) return 'Starting...';
    if (workflowStatus === 'stopped') return 'Stopped';
    if (workflowStatus === 'failed') return 'Failed';
    if (isDown) return 'Down';
    return 'Checking...';
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
              <div className={`p-3 rounded-xl border border-[#1e2832] ${getCloudBannerBg()}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getCloudDotClass()}`} />
                    <span className={`text-sm font-medium ${getCloudTextClass()}`}>
                      {getCloudStatusText()}
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

              {/* Buttons based on health status */}
              {isHealthy || workflowStatus === 'running' ? (
                <div className="flex gap-2">
                  {onBuildCloud && (
                    <button
                      onClick={onBuildCloud}
                      disabled={cloudBuilding || cloudTriggering || cloudStopping}
                      className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-200 bg-[#1a232e] hover:bg-[#232d3b] rounded-xl border border-[#2a3544] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cloudBuilding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Package className="w-4 h-4" />
                      )}
                      Build
                    </button>
                  )}
                  <button
                    onClick={onStartCloud}
                    disabled={cloudTriggering || cloudStopping || cloudBuilding}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-200 bg-[#1a232e] hover:bg-[#232d3b] rounded-xl border border-[#2a3544] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cloudTriggering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Restart
                  </button>
                  {onStopCloud && (
                    <button
                      onClick={onStopCloud}
                      disabled={cloudTriggering || cloudStopping || cloudBuilding}
                      className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cloudStopping ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                      Stop
                    </button>
                  )}
                </div>
              ) : isStarting ? (
                <div className="flex gap-2">
                  {onBuildCloud && (
                    <button
                      onClick={onBuildCloud}
                      disabled={cloudBuilding}
                      className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-200 bg-[#1a232e] hover:bg-[#232d3b] rounded-xl border border-[#2a3544] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cloudBuilding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Package className="w-4 h-4" />
                      )}
                      Build
                    </button>
                  )}
                  <button
                    disabled
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-blue-400 bg-blue-500/10 rounded-xl border border-blue-500/20 cursor-not-allowed"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  {onBuildCloud && (
                    <button
                      onClick={onBuildCloud}
                      disabled={cloudBuilding || cloudTriggering}
                      className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-200 bg-[#1a232e] hover:bg-[#232d3b] rounded-xl border border-[#2a3544] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cloudBuilding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Package className="w-4 h-4" />
                      )}
                      Build
                    </button>
                  )}
                  <button
                    onClick={onStartCloud}
                    disabled={cloudTriggering || cloudBuilding}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cloudTriggering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Rocket className="w-4 h-4" />
                    )}
                    Start
                  </button>
                </div>
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
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {lastRun.status === 'in_progress' || lastRun.status === 'queued'
                        ? formatDuration(lastRun.created_at)
                        : formatDuration(lastRun.created_at, lastRun.updated_at)}
                    </span>
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

              {/* Local status banner with logs */}
              {isLocalChat && (
                <div className={`rounded-xl border border-[#1e2832] overflow-hidden ${
                  backendProcess === 'running' ? 'bg-emerald-500/10' : 'bg-slate-500/10'
                }`}>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        backendProcess === 'running' ? 'bg-emerald-400' : 'bg-slate-400'
                      }`} />
                      <span className={`text-sm font-medium ${
                        backendProcess === 'running' ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {backendProcess === 'running' ? 'Running' : backendProcess === 'stopped' ? 'Stopped' : 'Unknown'}
                      </span>
                    </div>
                    {backendPid && backendProcess === 'running' && (
                      <span className="text-xs text-slate-500 font-mono">
                        PID {backendPid}
                      </span>
                    )}
                  </div>

                  {/* Logs preview/expanded */}
                  <div className="border-t border-[#1e2832]">
                    <button
                      onClick={() => {
                        if (!logsExpanded) onFetchLogs?.();
                        setLogsExpanded(!logsExpanded);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                    >
                      <Terminal className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <span className="flex-1 text-[10px] text-slate-500 font-mono truncate">
                        {lastLogLine || 'View logs'}
                      </span>
                      {logsExpanded ? (
                        <ChevronUp className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      )}
                    </button>

                    {logsExpanded && (
                      <div className="px-3 pb-3">
                        <div className="flex items-center justify-end mb-1.5">
                          <button
                            onClick={onFetchLogs}
                            disabled={backendBusy}
                            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            Refresh
                          </button>
                        </div>
                        <pre
                          ref={logsRef}
                          className="max-h-48 overflow-auto text-[10px] leading-relaxed bg-[#0a0f14] border border-[#1e2832] rounded-lg p-2 text-slate-400 whitespace-pre-wrap font-mono"
                        >
                          {backendLogTail || 'No logs available'}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Server control */}
              {isLocalChat && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {onBuild && (
                      <button
                        onClick={onBuild}
                        disabled={buildBusy}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-200 bg-[#1a232e] hover:bg-[#232d3b] rounded-xl border border-[#2a3544] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {buildBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Package className="w-4 h-4" />
                        )}
                        Build
                      </button>
                    )}
                    {backendProcess === 'running' ? (
                      <>
                        <button
                          onClick={onRestart}
                          disabled={backendBusy}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-200 bg-[#1a232e] hover:bg-[#232d3b] rounded-xl border border-[#2a3544] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {backendBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          Restart
                        </button>
                        <button
                          onClick={onStop}
                          disabled={backendBusy}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {backendBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                          Stop
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={onStart}
                        disabled={backendBusy}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {backendBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Rocket className="w-4 h-4" />
                        )}
                        Start
                      </button>
                    )}
                  </div>

                  {/* Build logs */}
                  {buildLogTail && (
                    <pre
                      ref={buildLogsRef}
                      className="max-h-32 overflow-auto text-[10px] leading-relaxed bg-[#0a0f14] border border-[#1e2832] rounded-xl p-3 text-slate-400 whitespace-pre-wrap font-mono"
                    >
                      {buildLogTail}
                    </pre>
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
