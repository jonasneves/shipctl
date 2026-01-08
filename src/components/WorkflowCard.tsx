import React from 'react';
import { Play, ExternalLink, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

interface WorkflowCardProps {
  name: string;
  status?: 'completed' | 'in_progress' | 'queued' | 'waiting' | 'failure';
  conclusion?: 'success' | 'failure' | 'cancelled' | null;
  updatedAt?: string;
  htmlUrl?: string;
  onTrigger?: () => void;
  triggering?: boolean;
  disabled?: boolean;
}

const formatRelativeTime = (isoString?: string) => {
  if (!isoString) return null;
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
};

const WorkflowCard: React.FC<WorkflowCardProps> = ({
  name,
  status,
  conclusion,
  updatedAt,
  htmlUrl,
  onTrigger,
  triggering = false,
  disabled = false,
}) => {
  const isActive = status === 'in_progress' || status === 'queued' || status === 'waiting';
  const isSuccess = conclusion === 'success';
  const isFailed = conclusion === 'failure';

  const getStatusIcon = () => {
    if (isActive) {
      return <Loader className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
    }
    if (isSuccess) {
      return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    }
    if (isFailed) {
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    }
    return <Clock className="w-3.5 h-3.5 text-slate-500" />;
  };

  const getStatusText = () => {
    if (isActive) return status === 'queued' ? 'Queued' : 'Running';
    if (isSuccess) return 'Success';
    if (isFailed) return 'Failed';
    if (conclusion === 'cancelled') return 'Cancelled';
    return 'Unknown';
  };

  const getStatusColor = () => {
    if (isActive) return 'text-blue-400';
    if (isSuccess) return 'text-emerald-400';
    if (isFailed) return 'text-red-400';
    return 'text-slate-500';
  };

  const getAccentClass = () => {
    if (isActive) return 'border-l-blue-500';
    if (isSuccess) return 'border-l-emerald-500';
    if (isFailed) return 'border-l-red-400';
    return 'border-l-slate-700';
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
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        {/* Left: Status + Name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getStatusIcon()}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-100 truncate">
              {name}
            </span>
            <div className="flex items-center gap-2 text-[10px]">
              <span className={getStatusColor()}>
                {getStatusText()}
              </span>
              {updatedAt && (
                <>
                  <span className="text-slate-700">•</span>
                  <span className="text-slate-500">
                    {formatRelativeTime(updatedAt)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5">
          {/* Trigger Workflow */}
          {onTrigger && (
            <button
              onClick={onTrigger}
              disabled={disabled || triggering}
              className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-slate-700/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Run workflow"
            >
              <Play className={`w-4 h-4 ${triggering ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* View on GitHub */}
          {htmlUrl && (
            <a
              href={htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
              title="View on GitHub"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowCard;
