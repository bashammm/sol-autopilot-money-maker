import React, { useState } from 'react';
import { 
  Shield, 
  Users, 
  CheckCircle2, 
  FileText, 
  Plus, 
  Vote, 
  ExternalLink,
  Lock,
  ArrowUpRight,
  Wallet
} from 'lucide-react';
import { SquadsProposal } from '../types/yabbai';

interface TreasurySquadsViewProps {
  proposals: SquadsProposal[];
  onVoteProposal: (proposalId: string, signatory: string) => Promise<void>;
  onExecuteProposal: (proposalId: string) => Promise<void>;
  onCreateProposal: (params: {
    agentId: string;
    targetAddress: string;
    amountSol: number;
    amountUsd: number;
    budgetType: string;
    justification: string;
  }) => Promise<void>;
  onOpenWithdrawModal?: () => void;
}

export const TreasurySquadsView: React.FC<TreasurySquadsViewProps> = ({
  proposals,
  onVoteProposal,
  onExecuteProposal,
  onCreateProposal,
  onOpenWithdrawModal,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [agentId, setAgentId] = useState('agent-10');
  const [targetAddress, setTargetAddress] = useState('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
  const [amountSol, setAmountSol] = useState('0.05');
  const [justification, setJustification] = useState('Gas re-supply for high EV opportunity execution');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreateProposal({
        agentId,
        targetAddress,
        amountSol: parseFloat(amountSol),
        amountUsd: parseFloat(amountSol) * 180,
        budgetType: 'operatingBudgetUsd',
        justification
      });
      setShowCreateModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
              Squads v4 Multisig Governance (3 of 5 Signatures Required)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Vault: <code className="text-purple-300 font-mono text-[11px]">SQDSv4Vault11111111111111111111111111111111111</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenWithdrawModal && (
            <button
              onClick={onOpenWithdrawModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition cursor-pointer shadow-sm"
              title="Direct non-custodial withdrawal from Treasury to personal Phantom wallet"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Withdraw to Phantom</span>
            </button>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Squads Proposal</span>
          </button>
        </div>
      </div>

      {/* Proposals List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {proposals.map((prop) => {
          const isQuorumReached = prop.currentSignatures >= prop.requiredSignatures;
          const isExecuted = prop.status === 'EXECUTED';

          return (
            <div
              key={prop.id}
              className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      {prop.id}
                    </span>
                    <h4 className="text-xs font-semibold text-white mt-1">
                      {prop.riskCheckNotes}
                    </h4>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isExecuted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    isQuorumReached ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {prop.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono py-2 border-t border-slate-800/60">
                  <div>
                    <span className="text-slate-400 text-[10px]">Requested Amount:</span>
                    <div className="text-slate-200 font-semibold">{prop.amountSol} SOL (${prop.amountUsd.toFixed(2)})</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Agent &amp; Budget:</span>
                    <div className="text-slate-200 truncate">{prop.agentId} ({prop.budgetType})</div>
                  </div>
                </div>

                {/* Signatures Progress */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Signatures Collected:</span>
                    <span className="text-purple-300 font-bold">
                      {prop.currentSignatures} / {prop.requiredSignatures} required
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                    <div 
                      className="h-full bg-purple-500" 
                      style={{ width: `${(prop.currentSignatures / prop.requiredSignatures) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                {!isExecuted && !isQuorumReached && (
                  <button
                    onClick={() => onVoteProposal(prop.id, `Signatory-${prop.currentSignatures + 1}`)}
                    className="flex items-center gap-1 px-3 py-1 rounded text-xs font-mono font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition cursor-pointer"
                  >
                    <Vote className="w-3 h-3" />
                    <span>Cast Signature (#{prop.currentSignatures + 1})</span>
                  </button>
                )}

                {!isExecuted && isQuorumReached && (
                  <button
                    onClick={() => onExecuteProposal(prop.id)}
                    className="flex items-center gap-1 px-3 py-1 rounded text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer shadow-sm"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    <span>Execute Proposal On-Chain</span>
                  </button>
                )}

                {isExecuted && prop.transactionHash && (
                  <a
                    href={prop.transactionHash.startsWith('internal-') || prop.transactionHash.length < 64
                      ? `https://solscan.io/account/${prop.vaultAddress}`
                      : `https://solscan.io/tx/${prop.transactionHash}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>{prop.transactionHash.startsWith('internal-') || prop.transactionHash.length < 64 ? 'Vault Solscan' : 'Solscan Receipt'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Proposal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Create Squads Multisig Proposal</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Agent Requesting</label>
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-md p-2 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Target Recipient Address</label>
                <input
                  type="text"
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-md p-2 font-mono text-[11px]"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Amount (SOL)</label>
                <input
                  type="text"
                  value={amountSol}
                  onChange={(e) => setAmountSol(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-md p-2 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Justification / Audit Reason</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-md p-2 font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                {isSubmitting ? 'Submitting...' : 'Submit to Squads'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
