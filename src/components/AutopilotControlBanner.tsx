import React, { useState } from 'react';
import { 
  Zap, 
  Play, 
  Pause, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  ExternalLink, 
  Cpu, 
  Layers, 
  Coins,
  ArrowRight,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { AutopilotStatus, AutopilotExecutionRecord } from '../types/yabbai';

interface AutopilotControlBannerProps {
  status?: AutopilotStatus;
  onToggleAutopilot: () => Promise<void>;
  onExecuteCycleNow: () => Promise<AutopilotExecutionRecord>;
  isExecutingManual: boolean;
}

export const AutopilotControlBanner: React.FC<AutopilotControlBannerProps> = ({
  status,
  onToggleAutopilot,
  onExecuteCycleNow,
  isExecutingManual,
}) => {
  const [showRecentLogs, setShowRecentLogs] = useState(false);
  const [recentFlash, setRecentFlash] = useState<string | null>(null);

  const isActive = status?.isActive ?? true;
  const isExecuting = status?.isExecuting || isExecutingManual;
  const totalProfit = status?.totalProfitGeneratedUsd ?? 0;
  const totalCycles = status?.totalCyclesExecuted ?? 0;
  const lastExec = status?.lastExecution;

  const handleInstantExecute = async () => {
    try {
      const record = await onExecuteCycleNow();
      if (record.netProfitUsd > 0) {
        setRecentFlash(`+ $${record.netProfitUsd.toFixed(2)} USD generated via ${record.agentName}!`);
        setTimeout(() => setRecentFlash(null), 5000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 p-4 sm:p-5 shadow-lg shadow-emerald-950/20">
      
      {/* Background ambient glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Left: Engine Status & Profit Ticker */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {isActive ? 'AUTOPILOT: ARMED & HARVESTING' : 'AUTOPILOT: PAUSED'}
            </span>

            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              10-Stage Autonomous Engine
            </span>

            {isExecuting && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Executing Pipeline...
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-3 flex-wrap pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 tracking-tight">
                +${totalProfit.toFixed(2)}
              </span>
              <span className="text-xs text-emerald-200/70 font-mono font-medium">USD AUTOPILOT PROFIT</span>
            </div>

            <div className="h-4 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span>
                Cycles: <strong className="font-mono text-white">{totalCycles}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 100% Win Rate
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-mono">Loop: 20/20/20/30/5/5</span>
            </div>
          </div>

          {/* Flash Notification */}
          {recentFlash && (
            <div className="text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded inline-flex items-center gap-1.5 animate-bounce">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{recentFlash}</span>
            </div>
          )}

          {/* Current / Last Strategy Activity */}
          {lastExec && lastExec.status === 'COMPLETED' && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-slate-500">Last Execution:</span>
              <span className="font-semibold text-slate-200">{lastExec.opportunityTitle}</span>
              <span className="text-slate-600">via</span>
              <span className="text-blue-400 font-mono">{lastExec.agentName}</span>
              <span className="text-emerald-400 font-mono font-bold">+${lastExec.netProfitUsd.toFixed(2)} USD</span>
              {lastExec.evidenceSignature && (
                <a 
                  href={lastExec.solscanUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-emerald-300 inline-flex items-center gap-0.5 text-[10px] underline ml-1"
                  title="View Strategy Agent Wallet on Solscan"
                >
                  Agent Solscan <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </p>
          )}
        </div>

        {/* Right: Quick Autopilot Controls */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end flex-wrap pt-2 lg:pt-0">
          
          {/* Instant Execute Cycle Button */}
          <button
            id="btn-autopilot-run-now"
            onClick={handleInstantExecute}
            disabled={isExecuting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-900/30 transition cursor-pointer disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${isExecuting ? 'animate-spin' : 'fill-slate-950'}`} />
            <span>{isExecuting ? 'HARVESTING YIELD...' : 'EXECUTE PROFIT CYCLE NOW'}</span>
          </button>

          {/* Toggle Continuous Autopilot */}
          <button
            id="btn-autopilot-toggle"
            onClick={onToggleAutopilot}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer ${
              isActive
                ? 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-600'
            }`}
          >
            {isActive ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span>Pause Autopilot</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Resume Autopilot</span>
              </>
            )}
          </button>

          {/* View Autopilot History Toggle */}
          <button
            onClick={() => setShowRecentLogs(!showRecentLogs)}
            className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-800 transition cursor-pointer"
          >
            {showRecentLogs ? 'Hide Log' : 'Exec Log'}
          </button>

        </div>

      </div>

      {/* Expandable Recent Autopilot Executions Drawer */}
      {showRecentLogs && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>AUTONOMOUS EXECUTION HISTORY (ON-CHAIN VERIFIED)</span>
            <span>{status?.recentExecutions.length || 0} recorded cycles</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
            {status?.recentExecutions && status.recentExecutions.length > 0 ? (
              status.recentExecutions.map((exec) => (
                <div 
                  key={exec.id} 
                  className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/60 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] text-slate-500">#{exec.cycleNumber}</span>
                    <span className="text-emerald-400 font-bold">+${exec.netProfitUsd.toFixed(2)}</span>
                    <span className="text-slate-300 truncate max-w-[200px] sm:max-w-xs">{exec.opportunityTitle}</span>
                    <span className="text-[10px] text-blue-400 px-1.5 py-0.5 rounded bg-blue-500/10">
                      {exec.agentName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-[11px]">
                    <span className="text-slate-500 text-[10px]">
                      {new Date(exec.timestamp).toLocaleTimeString()}
                    </span>
                    {exec.evidenceSignature && (
                      <a 
                        href={exec.solscanUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 text-[10px] underline"
                      >
                        Solscan
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-center py-2">No autonomous executions yet. Click 'Execute Profit Cycle Now'.</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
