import React, { memo } from 'react';
import { RefreshCw, Settings } from 'lucide-react';

interface HealthRingProps {
  online: number;
  down: number;
  deploying: number;
  total: number;
  loading: boolean;
  onRefresh: () => void;
  onSettings?: () => void;
}

/**
 * Visual health ring showing aggregate system status
 * Uses an SVG arc to show proportion of healthy/down/deploying services
 */
const HealthRing: React.FC<HealthRingProps> = ({
  online,
  down,
  deploying,
  total,
  loading,
  onRefresh,
  onSettings,
}) => {
  // SVG arc calculations
  const size = 52;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate arc segments (as percentages)
  const segments = [
    { count: online, color: '#34d399' },      // emerald-400
    { count: deploying, color: '#60a5fa' },   // blue-400
    { count: down, color: '#f87171' },        // red-400
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
    if (down > 0) return `${down} down`;
    if (total === 0) return 'No services';
    return 'All operational';
  };

  const getStatusColor = () => {
    if (down > 0) return 'text-red-400';
    if (deploying > 0) return 'text-blue-400';
    return 'text-emerald-400';
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-[#0f1419] rounded-xl border border-[#1e2832]">
      {/* Health Ring SVG */}
      <div className="relative flex-shrink-0">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#1e2832"
            strokeWidth={strokeWidth}
          />
          {/* Colored arcs */}
          {arcs}
        </svg>
        {/* Center text */}
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
          {deploying > 0 && ` · ${deploying} deploying`}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onRefresh}
          disabled={loading}
          className={`p-2 rounded-lg transition-all duration-150 ${
            loading
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:text-white hover:bg-[#1a232e]'
          }`}
          title="Refresh (R)"
          aria-label="Refresh status"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        {onSettings && (
          <button
            onClick={onSettings}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a232e] transition-all duration-150"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default memo(HealthRing);
