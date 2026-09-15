import React from 'react';
import { 
  TrendingUp, 
  Shield, 
  Wallet, 
  Flame, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  PiggyBank,
  Zap,
  Layers,
  Fuel
} from 'lucide-react';
import { CapitalBuckets, CurrentPredicament, ExecutionTier } from '../types/yabbai';

const TIERS: { tier: ExecutionTier; label: string; min: number }[] = [
  { tier: '$0', label: '$0', min: 0 },
  { tier: '$20', label: '$20', min: 20 },
  { tier: '$50', label: '$50', min: 50 },
  { tier: '$100', label: '$100', min: 100 },
  { tier: '$250', label: '$250', min: 250 },
  { tier: '$500', label: '$500', min: 500 },
  { tier: '$1K', label: '$1K', min: 1000 },
  { tier: '$2.5K', label: '$2.5K', min: 2500 },
  { tier: '$5K', label: '$5K', min: 5000 },
  { tier: '$10K+', label: '$10K+', min: 10000 },
];

interface CapitalOverviewProps {
  buckets?: CapitalBuckets;
  predicament?: CurrentPredicament;
  realizedRevenueTotal: number;
  onOpenVerifyModal: () => void;
  onOpenWithdrawModal?: () => void;
}

export const CapitalOverview: React.FC<CapitalOverviewProps> = ({
  buckets,
  predicament,
  realizedRevenueTotal,
  onOpenVerifyModal,
  onOpenWithdrawModal,
}) => {
  const currentTierIndex = TIERS.findIndex(t => t.tier === predicament?.currentTier);

  return (
    <section className="space-y-4">
      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Card 1: Verified Revenue */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-medium">Realized Revenue</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              <CheckCircle2 className="w-2.5 h-2.5" /> VERIFIED
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              ${realizedRevenueTotal.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 font-mono">USD</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>On-chain &amp; billing proofs</span>
            <button 
              onClick={onOpenVerifyModal}
              className="text-emerald-400 hover:text-emerald-300 font-medium text-[10px] underline underline-offset-2 cursor-pointer"
            >
              + Ingest Proof
            </button>
          </p>
        </div>

        {/* Card 2: Strategy Capital */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-medium">Strategy Capital (30%)</span>
            <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
              ALLOCATED
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              ${(buckets?.strategyCapitalUsd || 0).toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 font-mono">USD</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Governed by 20 autonomous agent slots
          </p>
        </div>

        {/* Card 3: Treasury Reserve */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-medium">Treasury &amp; Growth (40%)</span>
            <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
              SQUADS v4
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              ${((buckets?.treasuryReserveUsd || 0) + (buckets?.growthReinvestmentUsd || 0)).toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 font-mono">USD</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>Reserve: ${(buckets?.treasuryReserveUsd || 0).toFixed(2)}</span>
            {onOpenWithdrawModal && (
              <button
                onClick={onOpenWithdrawModal}
                className="text-purple-400 hover:text-purple-300 font-medium text-[10px] underline underline-offset-2 cursor-pointer flex items-center gap-1"
                title="Withdraw from Treasury to your Phantom wallet"
              >
                <Wallet className="w-3 h-3" />
                <span>Withdraw to Phantom</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 4: Gas Reserves */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-medium">Fleet Gas Balance</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              (predicament?.activeGasBalanceSol || 0) < 0.05
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            }`}>
              {(predicament?.activeGasBalanceSol || 0) < 0.05 ? 'BELOW RESERVE' : 'HEALTHY'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {(predicament?.activeGasBalanceSol || 0).toFixed(4)}
            </span>
            <span className="text-xs text-slate-500 font-mono">SOL</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Req: 0.05 SOL/agent</span>
            <span className="text-slate-500 font-mono">${(buckets?.networkAndGasFeesUsd || 0).toFixed(2)} fee pool</span>
          </p>
        </div>

      </div>

      {/* Capital Loop Buckets Visualizer */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Autonomous Capital Loop (Evidence-Verified Reinvestment)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Total Capital: <strong className="text-white">${(buckets?.totalVerifiedCapitalUsd || 0).toFixed(2)}</strong>
          </span>
        </div>

        {/* Proportional Split Bar */}
        <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden flex border border-slate-800 mb-3">
          <div style={{ width: '20%' }} className="bg-purple-500/80 hover:bg-purple-400 transition" title="Treasury Reserve (20%)" />
          <div style={{ width: '20%' }} className="bg-sky-500/80 hover:bg-sky-400 transition" title="Operating Budget (20%)" />
          <div style={{ width: '20%' }} className="bg-indigo-500/80 hover:bg-indigo-400 transition" title="Growth Reinvestment (20%)" />
          <div style={{ width: '30%' }} className="bg-emerald-500/80 hover:bg-emerald-400 transition" title="Strategy Capital (30%)" />
          <div style={{ width: '5%' }} className="bg-amber-500/80 hover:bg-amber-400 transition" title="Network & Gas Fees (5%)" />
          <div style={{ width: '5%' }} className="bg-rose-500/80 hover:bg-rose-400 transition" title="User / Customer Funds (5%)" />
        </div>

        {/* Legend grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <div className="flex items-center gap-1.5 p-2 rounded bg-slate-950/40 border border-slate-900">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <div>
              <div className="text-[10px] text-slate-400">Treasury (20%)</div>
              <div className="font-mono font-medium text-slate-200">${(buckets?.treasuryReserveUsd || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded bg-slate-950/40 border border-slate-900">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <div>
              <div className="text-[10px] text-slate-400">Operating (20%)</div>
              <div className="font-mono font-medium text-slate-200">${(buckets?.operatingBudgetUsd || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded bg-slate-950/40 border border-slate-900">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <div>
              <div className="text-[10px] text-slate-400">Growth (20%)</div>
              <div className="font-mono font-medium text-slate-200">${(buckets?.growthReinvestmentUsd || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded bg-slate-950/40 border border-slate-900">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-400">Strategy (30%)</div>
              <div className="font-mono font-medium text-slate-200">${(buckets?.strategyCapitalUsd || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded bg-slate-950/40 border border-slate-900">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <div>
              <div className="text-[10px] text-slate-400">Gas &amp; Fees (5%)</div>
              <div className="font-mono font-medium text-slate-200">${(buckets?.networkAndGasFeesUsd || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded bg-slate-950/40 border border-slate-900">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <div>
              <div className="text-[10px] text-slate-400">User Funds (5%)</div>
              <div className="font-mono font-medium text-slate-200">${(buckets?.userCustomerFundsUsd || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Capability Threshold Track */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Capability Threshold Progression (Available Capital States)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {predicament?.capitalNeededForNextTierUsd 
              ? `$${predicament.capitalNeededForNextTierUsd.toFixed(2)} needed for ${predicament.nextMilestoneTier}`
              : 'Maximum Tier Reached'}
          </span>
        </div>

        {/* Track Nodes */}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
          {TIERS.map((t, idx) => {
            const isPassed = currentTierIndex >= idx;
            const isCurrent = t.tier === predicament?.currentTier;

            return (
              <div 
                key={t.tier}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition ${
                  isCurrent 
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold shadow-sm shadow-emerald-950' 
                    : isPassed
                      ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                      : 'bg-slate-950/40 border-slate-900 text-slate-600'
                }`}
              >
                <span className="text-xs font-mono">{t.label}</span>
                <span className="text-[9px] uppercase tracking-wider mt-0.5">
                  {isCurrent ? 'ACTIVE' : isPassed ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current Predicament Engine Notes & Blockers */}
        {predicament?.blockers && predicament.blockers.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300/90 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-amber-300">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Current Predicament Assessment:</span>
            </div>
            {predicament.blockers.map((b, idx) => (
              <div key={idx} className="pl-5 text-slate-300 text-[11px]">• {b}</div>
            ))}
            {predicament.recommendations.map((r, idx) => (
              <div key={idx} className="pl-5 text-emerald-400/90 text-[11px]">→ {r}</div>
            ))}
          </div>
        )}
      </div>

    </section>
  );
};
