import React, { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ServiceStatus } from '../constants/status';

interface ServiceRowProps {
  name: string;
  status: ServiceStatus;
  workflowStatus?: 'running' | 'stopped' | 'failed' | 'starting' | 'unknown';
  latency?: number;
  onClick: () => void;
}

const ServiceRow: React.FC<ServiceRowProps> = ({
  name,
  status,
  workflowStatus,
  latency,
  onClick,
}) => {
  const isHealthy = status === 'running' || status === 'ok';
  const isDown = status === 'stopped' || status === 'down';
  const isChecking = status === 'checking';
  const isStarting = workflowStatus === 'starting';
  const isWorkflowStopped = workflowStatus === 'stopped' || workflowStatus === 'failed';

  // Status dot color - prioritize health check, then workflow status
  const getDotColor = () => {
    if (isDown || isWorkflowStopped) return 'bg-red-400';
    if (isStarting) return 'bg-blue-400';
    if (isHealthy) return 'bg-emerald-400';
    if (isChecking) return 'bg-amber-400';
    return 'bg-slate-600';
  };

  // Latency display
  const formatLatency = (ms?: number) => {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getLatencyColor = (ms?: number) => {
    if (!ms) return 'text-slate-600';
    if (ms < 500) return 'text-emerald-400';
    if (ms < 1500) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1a232e] transition-all duration-150 group text-left"
    >
      {/* Status dot */}
      <div className="relative flex-shrink-0">
        <div className={`w-2 h-2 rounded-full ${getDotColor()}`} />
        {isStarting && (
          <div className={`absolute inset-0 w-2 h-2 rounded-full ${getDotColor()} animate-ping opacity-75`} />
        )}
      </div>

      {/* Name */}
      <span className="flex-1 text-sm text-slate-200 truncate">
        {name}
      </span>

      {/* Right side: latency or status text */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isHealthy && latency && (
          <span className={`text-xs font-mono tabular-nums ${getLatencyColor(latency)}`}>
            {formatLatency(latency)}
          </span>
        )}
        {isStarting && (
          <span className="text-[11px] text-blue-400">
            starting
          </span>
        )}
        {isWorkflowStopped && (
          <span className="text-[11px] text-red-400">
            {workflowStatus === 'failed' ? 'failed' : 'stopped'}
          </span>
        )}
        {isDown && !isWorkflowStopped && (
          <span className="text-[11px] text-red-400">
            down
          </span>
        )}
        {isChecking && !isStarting && (
          <span className="text-[11px] text-slate-500">
            ...
          </span>
        )}

        {/* Chevron */}
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>
    </button>
  );
};

export default memo(ServiceRow);
