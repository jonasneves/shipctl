import React from 'react';
import { Package } from 'lucide-react';

interface BuildPanelProps {
  appId: string;
  buildBusy: boolean;
  buildLogTail: string | null;
  onBuild: (target: 'playground' | 'extension' | 'both') => void;
}

const BuildPanel: React.FC<BuildPanelProps> = ({
  appId,
  buildBusy,
  buildLogTail,
  onBuild,
}) => {
  if (appId !== 'chat-api') {
    return (
      <div className="text-[10px] text-slate-500 py-2">
        No build actions available for this app
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => onBuild('playground')}
        disabled={buildBusy}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Package className={`w-3.5 h-3.5 text-slate-400 ${buildBusy ? 'animate-pulse' : ''}`} />
        <span>Build Frontend</span>
      </button>

      {buildLogTail && (
        <pre className="max-h-32 overflow-auto text-[9px] leading-relaxed bg-slate-950/60 border border-slate-700/30 rounded-lg p-2 text-slate-400 whitespace-pre-wrap font-mono mt-2">
          {buildLogTail}
        </pre>
      )}
    </>
  );
};

export default BuildPanel;
