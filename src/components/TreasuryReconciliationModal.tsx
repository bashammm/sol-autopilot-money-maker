import React, { useState, useEffect } from 'react';
import { 
  X, 
  Scale, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Database,
  Lock,
  DollarSign
} from 'lucide-react';
import { TreasuryReconciliationReport, TreasuryConfig } from '../types/yabbai';

interface TreasuryReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  solPriceUsd: number;
}

export const TreasuryReconciliationModal: React.FC<TreasuryReconciliationModalProps> = ({
  isOpen,
  onClose,
  solPriceUsd
}) => {
  const [report, setReport] = useState<TreasuryReconciliationReport | null>(null);
  const [config, setConfig] = useState<TreasuryConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadReconciliationData();
    }
  }, [isOpen]);

  const loadReconciliationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recRes, cfgRes] = await Promise.all([
        fetch('/api/treasury/reconciliation'),
        fetch('/api/treasury/config')
      ]);

      if (recRes.ok) {
        const recData = await recRes.json();
        setReport(recData);
      }

      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setConfig(cfgData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/treasury/reconciliation/run', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.report) {
        setReport(data.report);
      } else {
        throw new Error(data.error || 'Audit execution failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                TREASURY RECONCILIATION &amp; POLICY AUDIT
                {report && (
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    report.reconciliationStatus === 'BALANCED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                  }`}>
                    {report.reconciliationStatus}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Continuous cryptographic audit: On-Chain RPC ↔ Inbound Payments ↔ Revenue Ledger ↔ Spending Limits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {error && (
            <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 font-mono">
              {error}
            </div>
          )}

          {/* Metric Comparison Cards */}
          {report && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              
              {/* On-Chain Physical Vault */}
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>On-Chain RPC Vault</span>
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="font-mono font-bold text-white text-lg">
                  {report.onChainBalanceSol.toFixed(4)} SOL
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  ≈ ${report.onChainBalanceUsd} USD
                </div>
              </div>

              {/* Verified Ledger Capital */}
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Ledger Capital</span>
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="font-mono font-bold text-emerald-400 text-lg">
                  ${report.ledgerBalanceUsd.toFixed(2)} USD
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Verified Inbound Settled
                </div>
              </div>

              {/* Variance / Discrepancy */}
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Balance Variance</span>
                  {report.discrepancyUsd <= 1.0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>
                <div className={`font-mono font-bold text-lg ${
                  report.discrepancyUsd <= 1.0 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  ${report.discrepancyUsd.toFixed(2)}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {report.discrepancyUsd <= 1.0 ? '100% Cryptographically Reconciled' : 'Unmatched Delta'}
                </div>
              </div>

            </div>
          )}

          {/* Spending Limit Guards & Config */}
          {config && (
            <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center justify-between">
                <span>Treasury Spending Policy &amp; Limits</span>
                <span className="text-slate-400 lowercase font-normal">{config.network}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">PER-TX LIMIT</div>
                  <div className="text-white font-bold text-sm mt-0.5">${config.per_transaction_limit.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">Max per single transfer</div>
                </div>

                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">24H DAILY SPEND</div>
                  <div className="text-emerald-400 font-bold text-sm mt-0.5">
                    ${config.spendingTracker.verifiedDailySpendUsd.toFixed(2)} / ${config.daily_limit.toFixed(2)}
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded mt-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-400 h-full"
                      style={{ width: `${Math.min(100, (config.spendingTracker.verifiedDailySpendUsd / config.daily_limit) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">7D WEEKLY SPEND</div>
                  <div className="text-emerald-400 font-bold text-sm mt-0.5">
                    ${config.spendingTracker.verifiedWeeklySpendUsd.toFixed(2)} / ${config.weekly_limit.toFixed(2)}
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded mt-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-400 h-full"
                      style={{ width: `${Math.min(100, (config.spendingTracker.verifiedWeeklySpendUsd / config.weekly_limit) * 100)}%` }}
                    />
                  </div>
                </div>

              </div>

              <div className="text-[11px] font-mono text-slate-400 pt-1">
                Configured Treasury Destination: <span className="text-slate-200">{config.address}</span>
              </div>
            </div>
          )}

          {/* Activity Breakdown */}
          {report && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              
              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <ArrowDownLeft className="w-3.5 h-3.5" /> Inbound Customer Orders
                  </span>
                  <span>{report.totalVerifiedInboundOrders} orders</span>
                </div>
                <div className="text-slate-400">
                  Total Verified Revenue: <span className="text-white font-bold">${report.totalVerifiedInboundRevenueUsd} USD</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  All transactions validated against on-chain parsed transfer data.
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <ArrowUpRight className="w-3.5 h-3.5" /> Outbound Disbursements
                  </span>
                  <span>${report.totalOutboundDisbursementsUsd} USD</span>
                </div>
                <div className="text-slate-400">
                  Unmatched Inbound Txs: <span className="text-white font-bold">{report.unmatchedInboundCount}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Direct transfers detected on node without an associated order ID.
                </div>
              </div>

            </div>
          )}

          {/* Alerts section */}
          {report && report.alerts.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-950/30 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 font-mono">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Reconciliation Alerts ({report.alerts.length})</span>
              </div>
              <ul className="text-xs text-amber-200 space-y-1 font-mono list-disc pl-5">
                {report.alerts.map((alert, idx) => (
                  <li key={idx}>{alert}</li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Footer with Run Audit Button */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <button
            onClick={handleRunAudit}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Auditing Nodes...' : 'Run Cryptographic Audit Now'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
