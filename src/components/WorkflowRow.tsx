import React, { memo } from 'react';
import { Play, ExternalLink, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface WorkflowRowProps {
  name: string;
  status?: string;
  conclusion?: string | null;
  htmlUrl?: string;
  onTrigger: () => void;
  triggering: boolean;
  disabled: boolean;
}

/**
 * Workflow row for the workflows section
 */
const WorkflowRow: React.FC<WorkflowRowProps> = ({
  name,
  status,
  conclusion,
  htmlUrl,
  onTrigger,
  triggering,
  disabled,
}) => {
  const isActive = status === 'in_progress' || status === 'queued';
  const isSuccess = conclusion === 'success';
  const isFailed = conclusion === 'failure';

  const getStatusIcon = () => {
    if (isActive) return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
    if (isSuccess) return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    if (isFailed) return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    return <div className="w-3.5 h-3.5 rounded-full bg-slate-600" />;
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1a232e] transition-all duration-150 group">
      {/* Status icon */}
      <div className="flex-shrink-0">
        {getStatusIcon()}
      </div>

      {/* Name */}
      <span className="flex-1 text-sm text-slate-200 truncate">
        {name}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onTrigger}
          disabled={disabled || triggering}
          className="p-1.5 text-slate-500 hover:text-white hover:bg-[#232d3b] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Run workflow"
        >
          {triggering ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>
        {htmlUrl && (
          <a
            href={htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-500 hover:text-white hover:bg-[#232d3b] rounded-lg transition-all"
            title="View on GitHub"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
};

export default memo(WorkflowRow);
