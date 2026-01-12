import React, { useState } from 'react';
import { ChevronRight, ExternalLink, Rocket, Terminal } from 'lucide-react';
import Sparkline from './Sparkline';
import HealthBadge from './HealthBadge';
import { STATUS_DOT_COLORS, ACCENT_COLORS, getLatencyColor, formatLatency, type ServiceStatus } from '../constants/status';

interface AppCardProps {
  name: string;
  status: ServiceStatus;
  deploymentStatus?: 'success' | 'failure' | 'in_progress' | 'queued' | 'unknown';
  latency?: number;
  publicEndpoint: string;
  endpointUrl?: string;
  latencyHistory?: number[];
  errorCount?: number;
  deployButton?: React.ReactNode;
  buildActions?: React.ReactNode;
  observeLogs?: React.ReactNode;
  onDeploy?: () => void;
  deployTriggering?: boolean;
}

const StatusDot: React.FC<{
  status: ServiceStatus;
  size?: 'sm' | 'md';
  pulse?: boolean;
}> = ({ status, size = 'sm', pulse }) => {
  const sizeClasses = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  const colorClasses = STATUS_DOT_COLORS[status] || STATUS_DOT_COLORS.unknown;
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
      {/* Two-Column Layout */}
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer"
        onClick={handleRowClick}
      >
        {/* Left: Status + Name + Endpoint (Stacked) */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <StatusDot
              status={isDeploying ? 'building' : status}
              size="sm"
              pulse={isDeploying}
            />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-100 truncate">
                {name}
              </span>
              {errorCount > 0 && (
                <HealthBadge variant="error" value={errorCount} />
              )}
            </div>
            <span className="text-[10px] text-slate-500 truncate">
              {publicEndpoint}
            </span>
          </div>
        </div>

        {/* Right: Metrics + Actions (Single Row, Centered) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Latency */}
          {isHealthy && (
            <span className={`text-xs font-mono tabular-nums ${getLatencyColor(latency)}`}>
              {formatLatency(latency) || '--ms'}
            </span>
          )}

          {/* Sparkline */}
          {latencyHistory.length > 0 && isHealthy && (
            <Sparkline data={latencyHistory} width={50} height={18} />
          )}

          {/* Quick Actions */}
          <div className="flex items-center gap-0.5">
            {/* Open Endpoint */}
            {endpointUrl && (
              <a
                href={endpointUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
                title="Open endpoint"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {/* Deploy Now */}
            {onDeploy && (
              <button
                onClick={(e) => handleQuickAction(e, onDeploy)}
                disabled={deployTriggering}
                className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-slate-700/50 rounded transition-colors disabled:opacity-50"
                title="Deploy now"
              >
                <Rocket className={`w-4 h-4 ${deployTriggering ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* View Logs */}
            {observeLogs && (
              <button
                onClick={(e) => handleQuickAction(e, () => setExpanded(true))}
                className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-700/50 rounded transition-colors"
                title="View logs"
              >
                <Terminal className="w-4 h-4" />
              </button>
            )}

            {/* Expand Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
              title={expanded ? "Collapse" : "Expand"}
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
              />
            </button>
          </div>
        </div>
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
