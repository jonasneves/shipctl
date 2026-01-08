import React from 'react';
import { RefreshCw, Settings } from 'lucide-react';

interface StatusRingProps {
    online: number;
    down: number;
    checking: number;
    deploying: number;
    total: number;
    loading: boolean;
    onRefresh: () => void;
    onSettings?: () => void;
}

/**
 * Visual health ring showing aggregate system status
 */
const StatusRing: React.FC<StatusRingProps> = ({
    online,
    down,
    checking,
    deploying,
    total,
    loading,
    onRefresh,
    onSettings,
}) => {
    const getStatusText = () => {
        if (loading) return 'Checking...';
        if (down > 0) return `${down} down`;
        if (online === total) return 'All operational';
        return `${online}/${total} online`;
    };

    const getStatusBadges = () => {
        const badges = [];
        if (online > 0) badges.push(`${online} online`);
        if (checking > 0) badges.push(`${checking} checking`);
        if (deploying > 0) badges.push(`${deploying} deploying`);
        if (down > 0) badges.push(`${down} down`);
        return badges.join(' • ');
    };

    return (
        <div className="flex items-center justify-between px-3 py-2.5 bg-slate-800/50 rounded-lg border border-slate-700/30">
            {/* Left: System Health */}
            <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    System Health
                </span>
                <span className="text-sm font-medium text-white">
                    {getStatusText()}
                </span>
                <span className="text-[10px] text-slate-400">
                    {getStatusBadges()}
                </span>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className={`p-1.5 rounded-lg transition-colors ${loading ? 'text-slate-500' : 'text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
                    title="Refresh all (R)"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {onSettings && (
                    <button
                        onClick={onSettings}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/30 transition-colors"
                        title="Settings"
                    >
                        <Settings className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default StatusRing;
