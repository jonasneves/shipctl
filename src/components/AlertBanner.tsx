import React, { memo } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';

interface AlertItem {
  id: string;
  name: string;
  status: 'down' | 'failed';
  reason?: string;
}

interface AlertBannerProps {
  alerts: AlertItem[];
  onViewLogs?: (id: string) => void;
}

const AlertBanner: React.FC<AlertBannerProps> = ({ alerts, onViewLogs }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="relative p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
        >
          <div className="flex items-start gap-2">
            <div className="p-1.5 bg-red-500/20 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-red-300">
                  {alert.name}
                </span>
                <span className="text-xs text-red-400/70">
                  {alert.status === 'failed' ? 'failed' : 'is down'}
                </span>
              </div>
              {alert.reason && (
                <div className="text-[11px] text-red-400/60 mt-0.5">
                  {alert.reason}
                </div>
              )}
            </div>
          </div>

          {onViewLogs && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onViewLogs(alert.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-300/70 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <FileText className="w-3 h-3" />
                Logs
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default memo(AlertBanner);
