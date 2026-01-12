import React, { memo } from 'react';
import { Rocket, Package, ExternalLink, Loader2 } from 'lucide-react';

interface QuickActionsProps {
  onRestartAll: () => void;
  onBuildImages: () => void;
  githubActionsUrl?: string;
  isRestarting: boolean;
  isBuildingImages: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onRestartAll,
  onBuildImages,
  githubActionsUrl,
  isRestarting,
  isBuildingImages,
}) => (
  <div className="flex gap-2">
    <button
      onClick={onRestartAll}
      disabled={isRestarting}
      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isRestarting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Rocket className="w-4 h-4" />
      )}
      <span>{isRestarting ? 'Restarting...' : 'Restart All'}</span>
    </button>

    <button
      onClick={onBuildImages}
      disabled={isBuildingImages}
      className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-white bg-[#1a232e] hover:bg-[#232d3b] rounded-xl border border-[#2a3544] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      title="Build Docker images for all services"
    >
      {isBuildingImages ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Package className="w-4 h-4" />
      )}
      <span>{isBuildingImages ? 'Building...' : 'Build Images'}</span>
    </button>

    {githubActionsUrl && (
      <a
        href={githubActionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2.5 text-slate-400 hover:text-white bg-[#1a232e] hover:bg-[#232d3b] rounded-xl border border-[#2a3544] transition-all"
        title="View Actions"
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    )}
  </div>
);

export default memo(QuickActions);
