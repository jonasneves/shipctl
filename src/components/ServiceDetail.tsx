import React, { memo, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Rocket,
  Power,
  Terminal,
  Package,
  Activity,
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

  // Status display - combines health check status with workflow status
  const getStatusInfo = () => {
    // Workflow stopped/failed takes priority (service is down even if last health check succeeded)
    if (workflowStatus === 'stopped') return { label: 'Stopped', color: 'text-red-400', bg: 'bg-red-500/10' };
    if (workflowStatus === 'failed') return { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/10' };
    if (isStarting) return { label: 'Starting', color: 'text-blue-400', bg: 'bg-blue-500/10' };
    if (isHealthy) return { label: 'Healthy', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (isDown) return { label: 'Down', color: 'text-red-400', bg: 'bg-red-500/10' };
    return { label: 'Checking', color: 'text-amber-400', bg: 'bg-amber-500/10' };
  };

  const statusInfo = getStatusInfo();

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
          {/* Status Card */}
          <div className={`p-4 rounded-xl ${statusInfo.bg} border border-[#1e2832]`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-lg font-semibold ${statusInfo.color}`}>
                  {statusInfo.label}
                </div>
                {isHealthy && latency && (
                  <div className="text-sm text-slate-400 mt-0.5">
                    {formatLatency(latency)} response time
                  </div>
                )}
              </div>
              {backendPid && backendProcess === 'running' && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Activity className="w-3.5 h-3.5" />
                  PID {backendPid}
                </div>
              )}
            </div>

            {/* Latency sparkline */}
            {latencyHistory.length > 1 && isHealthy && (
              <div className="mt-4">
                <Sparkline data={latencyHistory} width={280} height={40} />
              </div>
            )}
          </div>

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
