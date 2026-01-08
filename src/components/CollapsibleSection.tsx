import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  defaultExpanded = true,
  children,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-800/30 rounded-lg transition-colors group"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <div className="flex flex-col items-start">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
              {title}
            </span>
            {subtitle && (
              <span className="text-[10px] text-slate-500">
                {subtitle}
              </span>
            )}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="space-y-1">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
