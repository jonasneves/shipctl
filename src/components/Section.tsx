import React, { useState, memo, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface SectionProps {
  title: string;
  badge?: string | number;
  badgeColor?: 'default' | 'success' | 'warning' | 'danger';
  defaultOpen?: boolean;
  children: ReactNode;
}

const BADGE_COLORS = {
  default: 'bg-slate-700/50 text-slate-400',
  success: 'bg-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/20 text-amber-400',
  danger: 'bg-red-500/20 text-red-400',
};

const Section: React.FC<SectionProps> = ({
  title,
  badge,
  badgeColor = 'default',
  defaultOpen = true,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-1 py-2 text-left group"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
              isOpen ? '' : '-rotate-90'
            }`}
          />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {title}
          </span>
          {badge !== undefined && (
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${BADGE_COLORS[badgeColor]}`}>
              {badge}
            </span>
          )}
        </div>
      </button>

      <div
        className={`transition-all duration-200 ease-out ${
          isOpen ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
        }`}
      >
        <div className="pt-1 pb-2">
          {children}
        </div>
      </div>
    </div>
  );
};

export default memo(Section);
