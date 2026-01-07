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

    return (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700/30">
            {/* Left: Stats */}
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400">
                        System Health
                    </span>
                    <span className="text-sm font-medium text-white">
                        {getStatusText()}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    {online > 0 && (
                        <span className="text-emerald-400">{online}</span>
                    )}
                    {checking > 0 && (
                        <span className="text-amber-400">{checking}</span>
                    )}
                    {deploying > 0 && (
                        <span className="text-blue-400">{deploying}</span>
                    )}
                    {down > 0 && (
                        <span className="text-red-400">{down}</span>
                    )}
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
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
