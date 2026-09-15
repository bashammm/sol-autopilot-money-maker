import React, { useState } from 'react';
import { 
  Target, 
  Calculator, 
  CheckCircle, 
  Lock, 
  ExternalLink, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { Opportunity } from '../types/yabbai';

interface OpportunityEngineViewProps {
  opportunities: Opportunity[];
  onTriggerOpportunity: (opp: Opportunity) => void;
}

export const OpportunityEngineView: React.FC<OpportunityEngineViewProps> = ({
  opportunities,
  onTriggerOpportunity,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);

  const filteredOpps = filterCategory === 'ALL'
    ? opportunities
    : opportunities.filter(o => o.category === filterCategory || (filterCategory === 'ZERO' && o.isZeroCapital));

  return (
    <section className="space-y-3">
      {/* Header & Formula Explanation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
              YieldRanker &amp; Opportunity Registry
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Mathematical Expected Value Formula: <code className="text-emerald-400 font-mono text-[11px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
              EV - network_fees - trading_fees - slippage - risk_cost - capital_cost
            </code>
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['ALL', 'ZERO', 'security_analysis', 'analytics', 'arbitrage', 'defi_yield', 'liquidity_provision'].map(f => (
            <button
              key={f}
              onClick={() => setFilterCategory(f)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition cursor-pointer ${
                filterCategory === f
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {f === 'ALL' ? 'All Opportunities' : f === 'ZERO' ? '$0 Zero Capital' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table of Opportunities */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[11px]">
              <th className="py-2.5 px-3">Opportunity</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Req. Tier</th>
              <th className="py-2.5 px-3">Gross EV</th>
              <th className="py-2.5 px-3">Deductions (Fees + Risk)</th>
              <th className="py-2.5 px-3 font-semibold text-emerald-400">Net EV</th>
              <th className="py-2.5 px-3">Confidence</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {filteredOpps.map((opp) => {
              const deductions = opp.networkFeesUsd + opp.tradingFeesUsd + opp.slippageUsd + opp.riskCostUsd + opp.capitalCostUsd;
              const isBlocked = opp.status === 'BLOCKED_BY_CAPITAL';

              return (
                <tr 
                  key={opp.id} 
                  className={`hover:bg-slate-800/40 transition ${isBlocked ? 'opacity-65' : ''}`}
                >
                  <td className="py-2.5 px-3 font-sans">
                    <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                      {opp.title}
                      {opp.isZeroCapital && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          $0 Mode
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-sm mt-0.5">
                      Source: {opp.authoritativeSource}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      {opp.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    <span className="font-bold text-slate-200">{opp.tierRequirement}</span>
                    {opp.capitalRequiredUsd > 0 && (
                      <span className="text-slate-400 block text-[10px]">${opp.capitalRequiredUsd} capital</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    ${opp.rawExpectedValueUsd.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-rose-400/90" title={`Fees: $${(opp.networkFeesUsd + opp.tradingFeesUsd).toFixed(2)} | Slip: $${opp.slippageUsd.toFixed(2)} | Risk: $${opp.riskCostUsd.toFixed(2)} | CapCost: $${opp.capitalCostUsd.toFixed(2)}`}>
                    -${deductions.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-emerald-400 text-xs">
                    ${opp.netEvUsd.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${opp.confidenceScore}%` }} 
                        />
                      </div>
                      <span className="text-slate-300 text-[10px]">{opp.confidenceScore}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onTriggerOpportunity(opp)}
                      className="px-2.5 py-1 rounded text-[10px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
                    >
                      Inspect &amp; Exec
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
