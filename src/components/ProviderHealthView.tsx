import React, { useState } from 'react';
import { 
  Server, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Wifi, 
  ArrowRight
} from 'lucide-react';
import { RpcProviderHealth } from '../types/yabbai';

interface ProviderHealthViewProps {
  providers: RpcProviderHealth[];
  onPingAll: () => Promise<void>;
  onForceFailover: (targetProviderId: string) => Promise<void>;
}

export const ProviderHealthView: React.FC<ProviderHealthViewProps> = ({
  providers,
  onPingAll,
  onForceFailover,
}) => {
  const [isPinging, setIsPinging] = useState(false);

  const handlePing = async () => {
    setIsPinging(true);
    try {
      await onPingAll();
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
              RPC Failover Cascade Architecture
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Automatic cascade: QuickNode (Priority 1) → Alchemy (Priority 2) → Helius (Priority 3)
          </p>
        </div>

        <button
          onClick={handlePing}
          disabled={isPinging}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-emerald-400' : ''}`} />
          <span>{isPinging ? 'Checking Latencies...' : 'Health Ping'}</span>
        </button>
      </div>

      {/* 3 Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {providers.map((p, idx) => {
          const isPrimary = idx === 0;

          return (
            <div
              key={p.id}
              className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                p.isActive
                  ? 'bg-slate-900/90 border-emerald-500/50 shadow-sm shadow-emerald-950/40'
                  : 'bg-slate-900/40 border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-1 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                        Priority {p.priority}
                      </span>
                      <h3 className="font-semibold text-xs text-slate-100">{p.name}</h3>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    p.isActive 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold' 
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {p.isActive ? 'ACTIVE PRIMARY' : 'STANDBY'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono py-2 border-t border-slate-800/60 my-2">
                  <div>
                    <span className="text-slate-400 text-[10px]">Latency:</span>
                    <div className="text-slate-200 font-semibold">{p.latencyMs} ms</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Error Rate:</span>
                    <div className={p.errorRatePercent > 5 ? 'text-rose-400' : 'text-emerald-400'}>
                      {p.errorRatePercent.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Health indicator */}
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                  <Wifi className={`w-3.5 h-3.5 ${p.isHealthy ? 'text-emerald-400' : 'text-rose-400'}`} />
                  <span>{p.isHealthy ? 'Operational & Responsive' : 'Degraded or Rate Limited'}</span>
                </div>
              </div>

              {!p.isActive && (
                <div className="pt-3 border-t border-slate-800/60 mt-3">
                  <button
                    onClick={() => onForceFailover(p.id)}
                    className="w-full py-1 text-center rounded text-[11px] font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                  >
                    Set as Active Provider
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
