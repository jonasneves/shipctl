import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface ErrorDisplayProps {
  message: string | null;
  variant?: 'error' | 'success';
  className?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, variant = 'error', className = '' }) => {
  if (!message) return null;

  const styles = {
    error: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-300',
      icon: <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />,
    },
    success: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-300',
      icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />,
    },
  };

  const style = styles[variant];

  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 ${style.bg} border ${style.border} rounded-xl ${className}`}>
      {style.icon}
      <span className={`text-xs ${style.text}`}>{message}</span>
    </div>
  );
};

export default ErrorDisplay;
