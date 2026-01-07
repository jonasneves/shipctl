import React from 'react';
import { AlertCircle, Activity, Clock } from 'lucide-react';

interface HealthBadgeProps {
  variant: 'error' | 'uptime' | 'deploy';
  value: string | number;
  className?: string;
}

const HealthBadge: React.FC<HealthBadgeProps> = ({ variant, value, className = '' }) => {
  const configs = {
    error: {
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
    uptime: {
      icon: Activity,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    deploy: {
      icon: Clock,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
  };

  const config = configs[variant];
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${config.bg} border ${config.border} ${className}`}
    >
      <Icon className={`w-2.5 h-2.5 ${config.color}`} />
      <span className={`text-[9px] font-medium ${config.color}`}>{value}</span>
    </div>
  );
};

export default HealthBadge;
