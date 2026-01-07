import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

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
  children?: React.ReactNode;
  defaultExpanded?: boolean;
}

const formatLatency = (latency?: number) => {
  if (!latency) return null;
  if (latency < 1000) return `${latency}ms`;
  return `${(latency / 1000).toFixed(1)}s`;
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
      <span className={`${sizeClasses} rounded-full ${colorClasses} ring-1 ring-slate-950`} />
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
  children,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isDeploying = deploymentStatus === 'in_progress' || deploymentStatus === 'queued';
  const isHealthy = status === 'running' || status === 'ok';
  const isDown = status === 'stopped' || status === 'down';

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
        shadow
        transition-all duration-200 ease-out
        hover:bg-slate-800/60
      `}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors group"
      >
        {/* Status Indicator */}
        <div className="relative flex-shrink-0">
          <StatusDot
            status={isDeploying ? 'building' : status}
            size="md"
            pulse={isDeploying}
          />
        </div>

        {/* Name & Endpoint */}
        <div className="flex flex-col items-start min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100 group-hover:text-white transition-colors">
              {name}
            </span>
            {latency && isHealthy && (
              <span className={`text-[10px] font-mono tabular-nums ${getLatencyColor(latency)}`}>
                {formatLatency(latency)}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 truncate max-w-full">
            {publicEndpoint}
          </span>
        </div>



        {/* Expand Chevron */}
        <ChevronRight
          className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''
            }`}
        />
      </button>

      {/* Expanded Content */}
      <div className={`
        overflow-hidden transition-all duration-200 ease-out
        ${expanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}
      `}>
        {children && (
          <div className="border-t border-slate-700/30">
            {children}
          </div>
        )}
      </div>

      {/* Compact Footer Status */}
      <div className="border-t border-slate-700/30 px-3 py-2 bg-slate-900/40">
        <div className="flex items-center gap-3 text-[10px]">
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
      </div>
    </div>
  );
};

export default AppCard;
