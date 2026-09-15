import React, { useState } from 'react';
import { 
  Bot, 
  Cpu, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink, 
  Copy, 
  ShieldAlert, 
  FileText,
  ChevronDown,
  Play
} from 'lucide-react';
import { WalletAgent, Opportunity, DecisionRecord } from '../types/yabbai';

interface FleetGridProps {
  agents: WalletAgent[];
  opportunities: Opportunity[];
  onEvaluateAgent: (agentId: string, opportunityId: string) => Promise<DecisionRecord>;
}

export const FleetGrid: React.FC<FleetGridProps> = ({
  agents,
  opportunities,
  onEvaluateAgent,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<WalletAgent | null>(null);
  const [evaluatingAgentId, setEvaluatingAgentId] = useState<string | null>(null);
  const [lastDecisionMap, setLastDecisionMap] = useState<Record<string, DecisionRecord>>({});
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleRunEvaluation = async (agent: WalletAgent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (opportunities.length === 0) return;
    setEvaluatingAgentId(agent.id);

    try {
      // Pick first relevant opportunity or first active
      const opp = opportunities[0];
      const res = await onEvaluateAgent(agent.id, opp.id);
      setLastDecisionMap(prev => ({ ...prev, [agent.id]: res }));
    } finally {
      setEvaluatingAgentId(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            20-Agent Autonomous Fleet (Independently Governed)
          </h2>
        </div>
        <span className="text-xs text-slate-400">
          Strict Anti-Collusion &amp; Anti-Wash Trading Guard: <span className="text-emerald-400 font-semibold font-mono">ACTIVE (0.04 Score)</span>
        </span>
      </div>

      {/* Grid of 20 Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {agents.map((agent) => {
          const decision = lastDecisionMap[agent.id] || agent.lastDecision;
          const isEvaluating = evaluatingAgentId === agent.id;

          return (
            <div
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Top Row: Slot, Name, Risk */}
                <div className="flex items-start justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                      #{agent.slotNumber.toString().padStart(2, '0')}
                    </span>
                    <span className="font-semibold text-xs text-slate-100 truncate max-w-[130px]" title={agent.name}>
                      {agent.name}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    agent.riskProfile === 'LOW' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    agent.riskProfile === 'CONSERVATIVE' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {agent.riskProfile}
                  </span>
                </div>

                {/* Address */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2.5 px-2 py-1 rounded bg-slate-950/60 border border-slate-900">
                  <span className="truncate max-w-[140px]">
                    {agent.walletAddress.substring(0, 6)}...{agent.walletAddress.substring(agent.walletAddress.length - 4)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopy(agent.walletAddress); }}
                      className="hover:text-slate-200 cursor-pointer"
                      title="Copy Solana Address"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <a
                      href={`https://solscan.io/account/${agent.walletAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-slate-200 cursor-pointer"
                      title="View on Solscan"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Strategy Permissions Tags */}
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {agent.strategyPermissions.slice(0, 2).map((cat) => (
                    <span key={cat} className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700/50">
                      {cat.replace('_', ' ')}
                    </span>
                  ))}
                  {agent.strategyPermissions.length > 2 && (
                    <span className="text-[9px] font-mono text-slate-500">
                      +{agent.strategyPermissions.length - 2}
                    </span>
                  )}
                </div>

                {/* Financial & Gas Status */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono py-2 border-t border-slate-800/80 mb-2">
                  <div>
                    <div className="text-[10px] text-slate-400">Available USD</div>
                    <div className="text-slate-100 font-semibold">${agent.budget.availableUsd.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Gas Balance</div>
                    <div className={agent.budget.currentGasBalanceSol >= agent.gasReserveRequirementSol ? 'text-emerald-400' : 'text-amber-400'}>
                      {agent.budget.currentGasBalanceSol.toFixed(3)} SOL
                    </div>
                  </div>
                </div>
              </div>

              {/* Action / Evaluation Footer */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                {decision ? (
                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    {decision.decision === 'ACCEPT' ? (
                      <span className="text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3" /> ACCEPT
                      </span>
                    ) : decision.decision === 'DEFER' ? (
                      <span className="text-amber-400 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> DEFER
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-0.5">
                        <XCircle className="w-3 h-3" /> REJECT
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">No prior eval</span>
                )}

                <button
                  onClick={(e) => handleRunEvaluation(agent, e)}
                  disabled={isEvaluating}
                  className="px-2 py-1 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  title="Run independent evaluation check"
                >
                  <Play className={`w-2.5 h-2.5 ${isEvaluating ? 'animate-spin' : ''}`} />
                  <span>{isEvaluating ? 'Checking...' : 'Eval Test'}</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    Slot #{selectedAgent.slotNumber}
                  </span>
                  <h3 className="font-bold text-lg text-white font-mono">{selectedAgent.name}</h3>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-1 break-all">
                  {selectedAgent.walletAddress}
                </p>
              </div>
              <button 
                onClick={() => setSelectedAgent(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Risk Profile:</span>
                <div className="text-slate-200 font-semibold">{selectedAgent.riskProfile}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Min Expected Return:</span>
                <div className="text-slate-200 font-semibold">{(selectedAgent.minExpectedReturnBps / 100).toFixed(2)}%</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Gas Reserve Requirement:</span>
                <div className="text-slate-200 font-semibold">{selectedAgent.gasReserveRequirementSol} SOL</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 text-[11px]">Daily Loss Limit:</span>
                <div className="text-slate-200 font-semibold">${selectedAgent.dailyLossLimitUsd.toFixed(2)}</div>
              </div>
            </div>

            {/* Performance History */}
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Audited Performance Record
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div>
                  <div className="text-[10px] text-slate-400">Total Evaluations</div>
                  <div className="text-slate-200 font-bold">{selectedAgent.performanceHistory.totalEvaluations}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Tasks Executed</div>
                  <div className="text-emerald-400 font-bold">{selectedAgent.performanceHistory.successfulExecutions}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Win Rate</div>
                  <div className="text-emerald-400 font-bold">{selectedAgent.performanceHistory.winRate}%</div>
                </div>
              </div>
            </div>

            {/* Last Decision Record */}
            {selectedAgent.lastDecision && (
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Last Independent Decision:</span>
                  <span className={`font-mono font-bold ${
                    selectedAgent.lastDecision.decision === 'ACCEPT' ? 'text-emerald-400' :
                    selectedAgent.lastDecision.decision === 'DEFER' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {selectedAgent.lastDecision.decision}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {selectedAgent.lastDecision.reason}
                </p>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-900">
                  <span>Policy Check: {selectedAgent.lastDecision.policyCheckPassed ? 'PASSED' : 'FAILED'}</span>
                  <span>Correlation Check: {selectedAgent.lastDecision.correlationCheckPassed ? 'PASSED' : 'FAILED'}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAgent(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
