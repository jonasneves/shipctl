import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import Sparkline from './Sparkline';
import HealthBadge from './HealthBadge';

interface AppCardProps {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'building' | 'deploying' | 'ok' | 'down' | 'checking';
  deploymentStatus?: 'success' | 'failure' | 'in_progress' | 'queued' | 'unknown';
  localStatus?: 'ok' | 'down' | 'checking';
  latency?: number;
  publicEndpoint: string;
  endpointUrl?: string;
  localEndpointUrl?: string;
  deploymentUrl?: string;
  latencyHistory?: number[];
  errorCount?: number;
  uptimePercent?: number;
  lastDeployAt?: string;
  deployButton?: React.ReactNode;
  buildActions?: React.ReactNode;
  observeLogs?: React.ReactNode;
  defaultExpanded?: boolean;
}

const formatLatency = (latency?: number) => {
  if (!latency) return null;
  if (latency < 1000) return `${latency}ms`;
  return `${(latency / 1000).toFixed(1)}s`;
};

const formatRelativeTime = (isoString: string) => {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMins > 0) return `${diffMins}m`;
  return 'now';
};

const STATUS_COLORS = {
  ok: 'bg-emerald-400',
  running: 'bg-emerald-400',
  down: 'bg-red-400',
  stopped: 'bg-red-400',
  checking: 'bg-amber-400',
  building: 'bg-amber-400',
  deploying: 'bg-blue-400',
  unknown: 'bg-slate-600',
} as const;

const ACCENT_COLORS = {
  deploying: 'border-l-blue-500',
  healthy: 'border-l-emerald-500',
  down: 'border-l-red-400',
  checking: 'border-l-amber-400',
} as const;

const getLatencyColor = (latency?: number) => {
  if (!latency) return 'text-slate-500';
  if (latency < 500) return 'text-emerald-400';
  if (latency < 1500) return 'text-amber-400';
  return 'text-red-400';
};

const StatusDot: React.FC<{
  status: 'ok' | 'down' | 'checking' | 'deploying' | 'running' | 'stopped' | 'building' | 'unknown';
  size?: 'sm' | 'md';
  pulse?: boolean;
}> = ({ status, size = 'sm', pulse }) => {
  const sizeClasses = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  const colorClasses = STATUS_COLORS[status] || STATUS_COLORS.unknown;
  const shouldPulse = pulse || status === 'deploying' || status === 'building';

  return (
    <span className="relative flex">
      <span className={`${sizeClasses} rounded-full ${colorClasses}`} />
      {shouldPulse && (
        <span className={`absolute inset-0 ${sizeClasses} rounded-full ${colorClasses} animate-ping opacity-75`} />
      )}
    </span>
  );
};

const AppCard: React.FC<AppCardProps> = ({
  name,
  status,
  deploymentStatus,
  localStatus,
  latency,
  publicEndpoint,
  endpointUrl,
  localEndpointUrl,
  deploymentUrl,
  latencyHistory = [],
  errorCount = 0,
  uptimePercent,
  lastDeployAt,
  deployButton,
  buildActions,
  observeLogs,
  defaultExpanded = false,
}) => {
  const isDeploying = deploymentStatus === 'in_progress' || deploymentStatus === 'queued';
  const isHealthy = status === 'running' || status === 'ok';
  const isDown = status === 'stopped' || status === 'down';
  const hasFailed = deploymentStatus === 'failure';

  const shouldAutoExpand = () => {
    if (isDeploying) return true;
    if (isDown) return true;
    if (hasFailed) return true;
    if (errorCount > 0) return true;
    return false;
  };

  const [expanded, setExpanded] = useState(defaultExpanded || shouldAutoExpand());

  useEffect(() => {
    if (shouldAutoExpand() && !expanded) {
      setExpanded(true);
    }
  }, [status, deploymentStatus, errorCount, expanded]);

  const getAccentClass = () => {
    if (isDeploying) return ACCENT_COLORS.deploying;
    if (isHealthy) return ACCENT_COLORS.healthy;
    if (isDown) return ACCENT_COLORS.down;
    return ACCENT_COLORS.checking;
  };

  return (
    <div
      className={`
        rounded-xl bg-slate-800/40 border border-slate-700/30 overflow-hidden
        border-l-2 ${getAccentClass()}
        transition-colors
        hover:bg-slate-800/60
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Status Indicator */}
        <div className="relative flex-shrink-0">
          <StatusDot
            status={isDeploying ? 'building' : status}
            size="md"
            pulse={isDeploying}
          />
        </div>

        {/* Name & Metrics */}
        <div className="flex flex-col items-start min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100">
              {name}
            </span>
            {latency && isHealthy && (
              <span className={`text-[10px] font-mono tabular-nums ${getLatencyColor(latency)}`}>
                {formatLatency(latency)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full">
            <span className="text-[10px] text-slate-500 truncate">
              {publicEndpoint}
            </span>
            {latencyHistory.length > 0 && isHealthy && (
              <Sparkline data={latencyHistory} width={50} height={16} />
            )}
          </div>
        </div>

        {/* Expand Chevron */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-slate-700/50 rounded transition-colors"
        >
          <ChevronRight
            className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-700/30">
          {/* Deploy Section */}
          {deployButton && (
            <div className="px-3 py-2 bg-slate-900/20">
              <h4 className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Deploy</h4>
              {deployButton}
            </div>
          )}

          {/* Build Section */}
          {buildActions && (
            <div className="px-3 py-2 bg-slate-900/20 border-t border-slate-700/30">
              <h4 className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Build</h4>
              {buildActions}
            </div>
          )}

          {/* Observe Section */}
          {observeLogs && (
            <div className="px-3 py-2 bg-slate-900/20 border-t border-slate-700/30">
              <h4 className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Observe</h4>
              {observeLogs}
            </div>
          )}
        </div>
      )}

      {/* Compact Footer Status */}
      <div className="border-t border-slate-700/30 px-3 py-1.5 bg-slate-900/40">
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <div className="flex items-center gap-2">
            {/* Local Status */}
            {localEndpointUrl ? (
              <a
                href={localEndpointUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 hover:text-slate-300 transition-colors"
                title={localEndpointUrl}
              >
                <StatusDot status={localStatus || 'down'} size="sm" />
                <span className="text-slate-500 hover:text-slate-300 transition-colors">Local</span>
              </a>
            ) : (
              <div className="flex items-center gap-1.5 opacity-50 cursor-not-allowed">
                <StatusDot status={localStatus || 'down'} size="sm" />
                <span className="text-slate-500">Local</span>
              </div>
            )}

            <span className="text-slate-700">•</span>

            {/* Deploy Status */}
            <a
              href={deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 hover:text-slate-300 transition-colors"
              title="View deployment"
            >
              <StatusDot
                status={
                  deploymentStatus === 'success' ? 'ok' :
                    deploymentStatus === 'failure' ? 'down' :
                      deploymentStatus === 'in_progress' ? 'deploying' :
                        deploymentStatus === 'queued' ? 'deploying' :
                          'unknown'
                }
                size="sm"
                pulse={isDeploying}
              />
              <span className="text-slate-500 hover:text-slate-300 transition-colors">
                Pipeline
              </span>
            </a>
          </div>

          {/* Health Badges */}
          <div className="flex items-center gap-1.5">
            {uptimePercent !== undefined && uptimePercent > 0 && (
              <HealthBadge variant="uptime" value={`${uptimePercent.toFixed(0)}%`} />
            )}
            {errorCount > 0 && (
              <HealthBadge variant="error" value={errorCount} />
            )}
            {lastDeployAt && (
              <HealthBadge variant="deploy" value={formatRelativeTime(lastDeployAt)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppCard;
