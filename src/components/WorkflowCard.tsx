import React from 'react';
import { Play, ExternalLink, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';
import { ACCENT_COLORS } from '../constants/status';

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

function formatRelativeTime(isoString?: string): string | null {
  if (!isoString) return null;
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
}

type WorkflowState = 'active' | 'success' | 'failed' | 'default';

const STATUS_CONFIG = {
  active: {
    icon: <Loader className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
    color: 'text-blue-400',
    accent: ACCENT_COLORS.deploying,
  },
  success: {
    icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
    color: 'text-emerald-400',
    accent: ACCENT_COLORS.healthy,
  },
  failed: {
    icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,
    color: 'text-red-400',
    accent: ACCENT_COLORS.down,
  },
  default: {
    icon: <Clock className="w-3.5 h-3.5 text-slate-500" />,
    color: 'text-slate-500',
    accent: ACCENT_COLORS.default,
  },
} as const;

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

  const getState = (): WorkflowState => {
    if (isActive) return 'active';
    if (conclusion === 'success') return 'success';
    if (conclusion === 'failure') return 'failed';
    return 'default';
  };

  const getStatusText = (): string => {
    if (isActive) return status === 'queued' ? 'Queued' : 'Running';
    if (conclusion === 'success') return 'Success';
    if (conclusion === 'failure') return 'Failed';
    if (conclusion === 'cancelled') return 'Cancelled';
    return 'Unknown';
  };

  const state = getState();
  const config = STATUS_CONFIG[state];

  return (
    <div
      className={`
        rounded-lg bg-slate-800/40 border border-slate-700/30 overflow-hidden
        border-l-2 ${config.accent}
        transition-colors
        hover:bg-slate-800/60
      `}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {config.icon}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-100 truncate">
              {name}
            </span>
            <div className="flex items-center gap-2 text-[10px]">
              <span className={config.color}>
                {getStatusText()}
              </span>
              {updatedAt && (
                <>
                  <span className="text-slate-700">-</span>
                  <span className="text-slate-500">
                    {formatRelativeTime(updatedAt)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
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
