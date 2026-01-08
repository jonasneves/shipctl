import React, { useState } from 'react';
import { ChevronRight, ExternalLink, Rocket, Terminal } from 'lucide-react';
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
  onDeploy?: () => void;
  deployTriggering?: boolean;
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
  latency,
  publicEndpoint,
  endpointUrl,
  latencyHistory = [],
  errorCount = 0,
  deployButton,
  buildActions,
  observeLogs,
  onDeploy,
  deployTriggering = false,
}) => {
  const isDeploying = deploymentStatus === 'in_progress' || deploymentStatus === 'queued';
  const isHealthy = status === 'running' || status === 'ok';
  const isDown = status === 'stopped' || status === 'down';

  const [expanded, setExpanded] = useState(false);

  const getAccentClass = () => {
    if (isDeploying) return ACCENT_COLORS.deploying;
    if (isHealthy) return ACCENT_COLORS.healthy;
    if (isDown) return ACCENT_COLORS.down;
    return ACCENT_COLORS.checking;
  };

  const handleRowClick = () => {
    setExpanded(!expanded);
  };

  const handleQuickAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <div
      className={`
        rounded-lg bg-slate-800/40 border border-slate-700/30 overflow-hidden
        border-l-2 ${getAccentClass()}
        transition-colors
        hover:bg-slate-800/60
      `}
    >
      {/* Compact Header - Single Line */}
      <div
        className="flex items-center gap-2 px-3 py-1 cursor-pointer"
        onClick={handleRowClick}
      >
        {/* Status Dot */}
        <div className="relative flex-shrink-0">
          <StatusDot
            status={isDeploying ? 'building' : status}
            size="sm"
            pulse={isDeploying}
          />
        </div>

        {/* Name */}
        <span className="text-xs font-medium text-slate-100 truncate">
          {name}
        </span>

        {/* Error Badge */}
        {errorCount > 0 && (
          <HealthBadge variant="error" value={errorCount} />
        )}

        {/* Spacer */}
        <div className="flex-1 min-w-[8px]" />

        {/* Latency */}
        {isHealthy && (
          <span className={`text-[10px] font-mono tabular-nums ${getLatencyColor(latency)}`}>
            {formatLatency(latency) || '--ms'}
          </span>
        )}

        {/* Sparkline */}
        {latencyHistory.length > 0 && isHealthy && (
          <Sparkline data={latencyHistory} width={40} height={14} />
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-1 ml-2">
          {/* Open Endpoint */}
          {endpointUrl && (
            <a
              href={endpointUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
              title="Open endpoint"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Deploy Now */}
          {onDeploy && (
            <button
              onClick={(e) => handleQuickAction(e, onDeploy)}
              disabled={deployTriggering}
              className="p-1 text-slate-500 hover:text-emerald-400 hover:bg-slate-700/50 rounded transition-colors disabled:opacity-50"
              title="Deploy now"
            >
              <Rocket className={`w-3.5 h-3.5 ${deployTriggering ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* View Logs */}
          {observeLogs && (
            <button
              onClick={(e) => handleQuickAction(e, () => setExpanded(true))}
              className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-700/50 rounded transition-colors"
              title="View logs"
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Expand Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Endpoint URL - Second Line */}
      <div className="px-3 pb-1">
        <span className="text-[10px] text-slate-500 truncate block">
          {publicEndpoint}
        </span>
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
    </div>
  );
};

export default AppCard;
