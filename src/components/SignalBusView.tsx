import React, { useState } from 'react';
import { 
  Radio, 
  Send, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Info
} from 'lucide-react';
import { StrategySignal, StrategyCategory } from '../types/yabbai';

interface SignalBusViewProps {
  signals: StrategySignal[];
  onEmitSignal: (payload: {
    sourceAgentId: string;
    category: StrategyCategory;
    expectedValueUsd: number;
    confidence: number;
  }) => Promise<void>;
}

export const SignalBusView: React.FC<SignalBusViewProps> = ({
  signals,
  onEmitSignal,
}) => {
  const [isEmitting, setIsEmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<StrategyCategory>('security_analysis');

  const handleEmit = async () => {
    setIsEmitting(true);
    try {
      await onEmitSignal({
        sourceAgentId: 'agent-01',
        category: selectedCategory,
        expectedValueUsd: 38.50,
        confidence: 0.94
      });
    } finally {
      setIsEmitting(false);
    }
  };

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            StrategySignalBus (Independent Evaluation Broadcast)
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            Copying = Independent Evaluation, NOT Herd Trading
          </span>
          <button
            onClick={handleEmit}
            disabled={isEmitting}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
            <span>{isEmitting ? 'Broadcasting...' : 'Broadcast Signal'}</span>
          </button>
        </div>
      </div>

      {/* Signals List */}
      <div className="space-y-2">
        {signals.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 rounded-xl bg-slate-900/30 border border-slate-800">
            No active strategy signals on bus. Broadcast a signal to observe independent evaluation.
          </div>
        ) : (
          signals.map((sig) => {
            const evals = Object.values(sig.evaluations || {}) as Array<{ agentId: string; accepted: boolean; rejectionReason?: string }>;
            const acceptedCount = evals.filter(e => e.accepted).length;

            return (
              <div 
                key={sig.id} 
                className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                      {sig.sourceAgentId}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                      Category: <span className="font-mono text-slate-300">{sig.category.replace('_', ' ')}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      EV: ${sig.expectedValueUsd.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-400">Confidence: {(sig.signalConfidence * 100).toFixed(0)}%</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">
                      Evaluated by {evals.length} agents ({acceptedCount} qualified)
                    </span>
                  </div>
                </div>

                {/* Agent Evaluation Pills */}
                {evals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60">
                    {evals.slice(0, 10).map((ev) => (
                      <span
                        key={ev.agentId}
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                          ev.accepted
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                        title={ev.rejectionReason || 'Accepted by independent policy check'}
                      >
                        {ev.accepted ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5 text-slate-500" />}
                        <span>{ev.agentId}: {ev.accepted ? 'ELIGIBLE' : 'DECLINED'}</span>
                      </span>
                    ))}
                    {evals.length > 10 && (
                      <span className="text-[10px] font-mono text-slate-500 px-1 py-0.5">
                        +{evals.length - 10} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
