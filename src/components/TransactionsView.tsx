import React, { useState } from 'react';
import { 
  Workflow, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Clock, 
  HelpCircle,
  FileCheck,
  KeyRound
} from 'lucide-react';
import { TransactionStateRecord, TransactionStage } from '../types/yabbai';

const ALL_15_STAGES: TransactionStage[] = [
  'REQUEST',
  'VALIDATE',
  'FETCH_STATE',
  'BUILD',
  'SIMULATE',
  'RISK',
  'POLICY',
  'PREVIEW',
  'AUTHORIZATION',
  'SIGN',
  'SUBMIT',
  'CONFIRM',
  'VERIFY',
  'RECONCILE',
  'AUDIT'
];

interface TransactionsViewProps {
  transactions: TransactionStateRecord[];
  onAuthorizeTransaction: (txId: string) => Promise<void>;
  onSubmitNewIntent: (recipient: string, amountLamports: number) => Promise<void>;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  onAuthorizeTransaction,
  onSubmitNewIntent,
}) => {
  const [recipient, setRecipient] = useState('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
  const [amountSol, setAmountSol] = useState('0.005');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TransactionStateRecord | null>(transactions[0] || null);

  const handleSubmitIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const lamports = Math.floor(parseFloat(amountSol) * 1_000_000_000);
      await onSubmitNewIntent(recipient, lamports);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-3">
      {/* Header & Intent Launcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
              15-Stage Solana Transaction State Machine
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Zero server-side private keys. Authorizations require non-custodial client signatures or Squads multisig.
          </p>
        </div>

        {/* Quick Intent Generator */}
        <form onSubmit={handleSubmitIntent} className="flex items-center gap-2 flex-wrap text-xs">
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Recipient Address"
            className="w-48 bg-slate-950 font-mono text-[11px] text-slate-200 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          />
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={amountSol}
              onChange={(e) => setAmountSol(e.target.value)}
              placeholder="0.005"
              className="w-20 bg-slate-950 font-mono text-[11px] text-slate-200 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-slate-400 font-mono text-[11px]">SOL</span>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md font-mono text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
            <span>{isSubmitting ? 'Dispatching...' : 'Dispatch Intent'}</span>
          </button>
        </form>
      </div>

      {/* 15-Stage Flowchart for Selected Transaction */}
      {selectedTx ? (
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-300">
                Tx Intent: <span className="text-emerald-400">{selectedTx.id}</span>
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                selectedTx.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                selectedTx.status === 'RECONCILIATION_REQUIRED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold' :
                selectedTx.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}>
                {selectedTx.status}
              </span>
            </div>

            {selectedTx.stage === 'AUTHORIZATION' && (
              <button
                onClick={() => onAuthorizeTransaction(selectedTx.id)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold font-mono rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer shadow-sm"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Client Non-Custodial Authorize &amp; Sign</span>
              </button>
            )}
          </div>

          {/* Selected Tx Metadata */}
          {selectedTx.payload && (
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-400">
              <div>
                <span className="text-slate-500">Amount:</span>{' '}
                <span className="text-white font-bold font-mono">
                  {(((selectedTx.payload.amountLamports ?? 0)) / 1e9).toFixed(4)} SOL
                </span>
              </div>
              <div>
                <span className="text-slate-500">Recipient:</span>{' '}
                <span className="text-slate-300 truncate inline-block max-w-[180px] align-bottom">
                  {selectedTx.payload.targetRecipient || '—'}
                </span>
              </div>
              {selectedTx.payload.strategyCategory && (
                <div>
                  <span className="text-slate-500">Category:</span>{' '}
                  <span className="text-emerald-400">{selectedTx.payload.strategyCategory}</span>
                </div>
              )}
              {selectedTx.signature && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Sig:</span>{' '}
                  <span className="text-purple-300 truncate max-w-[140px]">{selectedTx.signature}</span>
                </div>
              )}
            </div>
          )}

          {/* 15 Stage Steps Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-15 gap-1 text-center font-mono">
            {ALL_15_STAGES.map((st, idx) => {
              const currentIdx = ALL_15_STAGES.indexOf(selectedTx.stage);
              const isPast = currentIdx >= idx;
              const isCurrent = selectedTx.stage === st;

              return (
                <div
                  key={st}
                  className={`p-1.5 rounded border text-[9px] truncate transition ${
                    isCurrent
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-sm shadow-emerald-950'
                      : isPast
                        ? 'bg-slate-800/60 border-slate-700 text-slate-300'
                        : 'bg-slate-950/40 border-slate-900 text-slate-400'
                  }`}
                  title={`${idx + 1}. ${st}`}
                >
                  <div className="text-[8px] opacity-70">#{idx + 1}</div>
                  <div className="truncate font-semibold">{st}</div>
                </div>
              );
            })}
          </div>

          {/* Reconcile Warning if UNKNOWN or ambigious */}
          {selectedTx.status === 'RECONCILIATION_REQUIRED' && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                <span>UNKNOWN STATE RECONCILIATION REQUIRED</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Network timeout or RPC ambiguity occurred. The system safely halts further actions on this transaction until an authoritative on-chain query confirms whether the signature landed. Never assumes success or failure without cryptographic proof.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Transaction Records List */}
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px]">
              <th className="py-2.5 px-3">Tx Intent ID</th>
              <th className="py-2.5 px-3">Agent</th>
              <th className="py-2.5 px-3">Stage / 15</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Amount</th>
              <th className="py-2.5 px-3">Recipient</th>
              <th className="py-2.5 px-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-[11px]">
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className={`hover:bg-slate-800/40 transition cursor-pointer ${
                  selectedTx?.id === tx.id ? 'bg-slate-800/60' : ''
                }`}
              >
                <td className="py-2 px-3 text-emerald-400 font-semibold truncate max-w-[120px]">
                  {tx.id}
                </td>
                <td className="py-2 px-3 text-slate-300">{tx.agentId}</td>
                <td className="py-2 px-3 text-slate-200">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">
                    {tx.stage}
                  </span>
                </td>
                <td className="py-2 px-3">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    tx.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    tx.status === 'RECONCILIATION_REQUIRED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                    'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {tx.status}
                  </span>
                </td>
                <td className="py-2 px-3 text-slate-300 font-mono">
                  {(((tx.payload?.amountLamports ?? 0)) / 1_000_000_000).toFixed(4)} SOL
                </td>
                <td className="py-2 px-3 text-slate-400 font-mono truncate max-w-[130px]">
                  {tx.payload?.targetRecipient || '—'}
                </td>
                <td className="py-2 px-3 text-right">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedTx(tx); }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                  >
                    View Flow
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
