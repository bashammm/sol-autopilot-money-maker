import React from 'react';
import { 
  ArrowRight, 
  ShieldCheck, 
  Wallet, 
  CheckCircle2, 
  Cpu, 
  Lock, 
  ShoppingBag, 
  Scale, 
  ExternalLink 
} from 'lucide-react';

interface ExecutionPipelineBannerProps {
  onOpenStore: () => void;
  onOpenReconciliation: () => void;
  cluster: 'mainnet-beta' | 'devnet';
  treasurySignerAddress?: string;
}

export const ExecutionPipelineBanner: React.FC<ExecutionPipelineBannerProps> = ({
  onOpenStore,
  onOpenReconciliation,
  cluster,
  treasurySignerAddress
}) => {
  const steps = [
    { title: 'YABBAI PREPARES', desc: 'Transaction Intent' },
    { title: 'POLICY CHECKS', desc: 'Pre-flight Limits' },
    { title: 'PHANTOM SIGNS', desc: 'Non-Custodial' },
    { title: 'SOLANA SETTLES', desc: 'On-Chain Block' },
    { title: 'YABBAI VERIFIES', desc: 'Exact Tx Evidence' },
    { title: 'LEDGER RECORDS', desc: 'Capital Loop Split' },
    { title: 'P&L UPDATES', desc: 'Realized Revenue' }
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Title & Badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="font-bold text-xs text-white uppercase tracking-wider font-mono">
              Canonical Crypto Execution &amp; Settlement Architecture
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              REAL {cluster.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            Every transaction strictly follows the verified 7-stage non-custodial pipeline. Zero balance-delta estimation.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="btn-open-store-banner"
            onClick={onOpenStore}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-emerald-950"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Storefront &amp; Inbound Revenue</span>
          </button>

          <button
            id="btn-open-reconciliation-banner"
            onClick={onOpenReconciliation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition cursor-pointer"
          >
            <Scale className="w-3.5 h-3.5 text-blue-400" />
            <span>Treasury Reconciliation</span>
          </button>
        </div>

      </div>

      {/* 7-Step Pipeline Visualizer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-3.5 pt-3 border-t border-slate-800/80">
        {steps.map((step, idx) => (
          <div 
            key={idx}
            className="flex items-center gap-1.5 p-2 rounded bg-slate-950/60 border border-slate-800/80"
          >
            <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
              {idx + 1}
            </div>
            <div className="truncate">
              <div className="font-mono text-[10px] font-bold text-slate-200 truncate">{step.title}</div>
              <div className="text-[9px] text-slate-400 truncate">{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
