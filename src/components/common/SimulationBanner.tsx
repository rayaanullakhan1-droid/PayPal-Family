import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SimulationBanner: React.FC = () => {
  const { currentUser, isCustomUser, resetDemoData } = useApp();

  // For real/custom account logins, remove demo-only banners, notices, and controls
  if (isCustomUser) {
    return null;
  }

  const isOwner = currentUser?.role === 'owner';

  return (
    <div className="bg-gradient-to-r from-slate-900 via-fintech-navy to-slate-900 text-white text-xs px-4 py-2 sm:py-2.5 shadow-inner">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold tracking-wide text-amber-300 uppercase text-[11px] bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 rounded">
            SIMULATION MODE
          </span>
          <span className="text-slate-300">
            All balances and transactions are <strong className="text-white font-medium">simulated demo play money</strong>. Not connected to real PayPal accounts or real funds.
          </span>
        </div>

        {/* Reset Demo Data button: strictly visible ONLY to Administrator of built-in demo accounts */}
        {isOwner && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                if (window.confirm('Reset all demo balances, family members, and transaction history back to defaults?')) {
                  resetDemoData();
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded transition-colors cursor-pointer"
              title="Reset to factory demo state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo Data</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

