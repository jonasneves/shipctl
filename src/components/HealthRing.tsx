import React, { memo, useState, useRef, useEffect } from 'react';
import { RefreshCw, Settings, Zap, RotateCcw, Package, ExternalLink, Power, Github } from 'lucide-react';

interface HealthRingProps {
  online: number;
  down: number;
  total: number;
  loading: boolean;
  repoName?: string;
  onRefresh: () => void;
  onSettings?: () => void;
  onRestartAll?: () => void;
  onStopAll?: () => void;
  onBuildImages?: () => void;
  isRestarting?: boolean;
  isStopping?: boolean;
  isBuildingImages?: boolean;
  actionsDisabled?: boolean;
  githubActionsUrl?: string;
}

/**
 * Visual health ring showing aggregate system status
 * Uses an SVG arc to show proportion of healthy/down/deploying services
 */
const HealthRing: React.FC<HealthRingProps> = ({
  online,
  down,
  total,
  loading,
  repoName,
  onRefresh,
  onSettings,
  onRestartAll,
  onStopAll,
  onBuildImages,
  isRestarting,
  isStopping,
  isBuildingImages,
  actionsDisabled,
  githubActionsUrl,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const hasActions = onRestartAll || onStopAll || onBuildImages;
  // SVG arc calculations
  const size = 52;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate arc segments (as percentages)
  const segments = [
    { count: online, color: '#34d399' },  // emerald-400
    { count: down, color: '#f87171' },    // red-400
  ].filter(s => s.count > 0);

  // Create arc paths
  let currentOffset = 0;
  const arcs = segments.map((segment, i) => {
    const percentage = segment.count / total;
    const dashLength = percentage * circumference;
    const dashOffset = -currentOffset;
    currentOffset += dashLength;

    return (
      <circle
        key={i}
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={segment.color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dashLength} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        className="transition-all duration-500 ease-out"
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: 'center',
        }}
      />
    );
  });

  // Status text
  const getStatusText = () => {
    if (loading) return 'Checking...';
    if (total === 0) return 'No services';
    return `${online} running`;
  };

  const getStatusColor = () => {
    if (down > 0) return 'text-red-400';
    if (online > 0) return 'text-emerald-400';
    return 'text-slate-400';
  };

  return (
    <div className="bg-[#0f1419] rounded-xl border border-[#1e2832]">
      {/* Header - Repo name and actions */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2832]">
        <div className="flex items-center gap-2 min-w-0">
          <Github className="w-4 h-4 text-slate-500 flex-shrink-0" />
          {repoName ? (
            <span className="text-sm font-medium text-slate-200 truncate">{repoName}</span>
          ) : (
            <span className="text-sm text-slate-500">No repository configured</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasActions && !actionsDisabled && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={`p-1.5 rounded-lg transition-all duration-150 ${
                  menuOpen
                    ? 'text-white bg-[#1a232e]'
                    : 'text-slate-400 hover:text-white hover:bg-[#1a232e]'
                }`}
                title="Actions"
                aria-label="Open actions menu"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 py-1 bg-[#1a232e] border border-[#2a3544] rounded-lg shadow-xl z-50">
                  {onRestartAll && (
                    <button
                      onClick={() => { onRestartAll(); setMenuOpen(false); }}
                      disabled={isRestarting || isStopping}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-[#252f3d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
                      {isRestarting ? 'Restarting...' : 'Restart All'}
                    </button>
                  )}
                  {onStopAll && (
                    <button
                      onClick={() => { onStopAll(); setMenuOpen(false); }}
                      disabled={isRestarting || isStopping}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-[#252f3d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Power className={`w-3.5 h-3.5 ${isStopping ? 'animate-pulse' : ''}`} />
                      {isStopping ? 'Stopping...' : 'Stop All'}
                    </button>
                  )}
                  {onBuildImages && (
                    <button
                      onClick={() => { onBuildImages(); setMenuOpen(false); }}
                      disabled={isBuildingImages}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-[#252f3d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Package className={`w-3.5 h-3.5 ${isBuildingImages ? 'animate-pulse' : ''}`} />
                      {isBuildingImages ? 'Building...' : 'Build Images'}
                    </button>
                  )}
                  {githubActionsUrl && (
                    <>
                      <div className="my-1 border-t border-[#2a3544]" />
                      <a
                        href={githubActionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-[#252f3d] transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View All Actions
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            className={`p-1.5 rounded-lg transition-all duration-150 ${
              loading
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 hover:text-white hover:bg-[#1a232e]'
            }`}
            title="Refresh (R)"
            aria-label="Refresh status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {onSettings && (
            <button
              onClick={onSettings}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a232e] transition-all duration-150"
              title="Settings"
              aria-label="Open settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Health Ring SVG */}
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#1e2832"
              strokeWidth={strokeWidth}
            />
            {arcs}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-semibold ${loading ? 'text-slate-500' : getStatusColor()}`}>
              {loading ? '...' : total > 0 ? `${online}` : '0'}
            </span>
          </div>
        </div>

        {/* Status Info */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {total} service{total !== 1 ? 's' : ''}
            {down > 0 && ` · ${down} down`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(HealthRing);
