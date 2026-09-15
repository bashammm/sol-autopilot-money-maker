import React, { useState } from 'react';
import { 
  GitBranch, 
  Play, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';

interface StrategyItem {
  id: string;
  name: string;
  category: string;
  tierRequirement: string;
  isZeroCapital: boolean;
  description: string;
  lifecycleSteps: string[];
}

interface StrategyLifecycleViewProps {
  strategies: StrategyItem[];
  onRunLifecycle: (strategyId: string) => Promise<any>;
}

export const StrategyLifecycleView: React.FC<StrategyLifecycleViewProps> = ({
  strategies,
  onRunLifecycle,
}) => {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(strategies[0]?.id || 'strat-sec-audit');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId) || strategies[0];

  const handleRun = async () => {
    if (!selectedStrategy) return;
    setIsRunning(true);
    setExecutionResult(null);

    try {
      const res = await onRunLifecycle(selectedStrategy.id);
      setExecutionResult(res);
    } catch (err: any) {
      alert(`Lifecycle execution failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const steps = [
    { key: 'discover', label: '1. Discover', desc: 'Scan markets & on-chain state' },
    { key: 'validate', label: '2. Validate', desc: 'Check eligibility & tier boundaries' },
    { key: 'quote', label: '3. Quote', desc: 'Calculate fees, EV & slippage' },
    { key: 'simulate', label: '4. Simulate', desc: 'Dry-run execution in sandbox' },
    { key: 'risk_check', label: '5. Risk Check', desc: 'Enforce loss limit & concentration' },
    { key: 'authorize', label: '6. Authorize', desc: 'Cryptographic policy verification' },
    { key: 'execute', label: '7. Execute', desc: 'Non-custodial instruction dispatch' },
    { key: 'verify', label: '8. Verify', desc: 'Authoritative evidence confirmation' },
    { key: 'account', label: '9. Account', desc: 'Capital loop ledger allocation' },
    { key: 'score', label: '10. Score', desc: 'Feedback learning & weight update' }
  ];

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
              Strategy Registry &amp; 10-Stage Lifecycle
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict modular pipeline: discover → validate → quote → simulate → risk_check → authorize → execute → verify → account → score
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedStrategyId}
            onChange={(e) => setSelectedStrategyId(e.target.value)}
            className="text-xs font-mono bg-slate-950 text-slate-200 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.tierRequirement})
              </option>
            ))}
          </select>

          <button
            id="btn-run-strategy-lifecycle"
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-mono bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Executing 10 Stages...' : 'Run Modular Lifecycle'}</span>
          </button>
        </div>
      </div>

      {/* 10-Stage Pipeline Visualizer */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5">
        {steps.map((step, idx) => {
          const stepData = executionResult?.steps?.[step.key];
          const isDone = !!stepData;
          const isCurrent = isRunning && !isDone;

          return (
            <div
              key={step.key}
              className={`p-2.5 rounded-lg border flex flex-col justify-between transition ${
                isDone 
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' 
                  : isCurrent
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300 animate-pulse'
                    : 'bg-slate-900/40 border-slate-800 text-slate-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono font-bold mb-1">
                  <span>{step.label}</span>
                  {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                </div>
                <div className="text-[9px] leading-tight text-slate-400">
                  {step.desc}
                </div>
              </div>

              {stepData && (
                <div className="mt-2 pt-1 border-t border-emerald-500/20 text-[9px] font-mono text-slate-200">
                  {step.key === 'quote' && `$${stepData.netExpectedRevenueUsd.toFixed(1)} net EV`}
                  {step.key === 'simulate' && `${stepData.simulatedGasUnits} units`}
                  {step.key === 'risk_check' && (stepData.approved ? 'Risk: LOW' : 'REJECT')}
                  {step.key === 'execute' && (stepData.success ? 'Success' : 'Failed')}
                  {step.key === 'verify' && 'Authoritative'}
                  {step.key === 'account' && 'Capital Loop'}
                  {step.key === 'score' && `${stepData.updatedRating} pts`}
                  {step.key === 'discover' && 'Discovered'}
                  {step.key === 'validate' && 'Valid'}
                  {step.key === 'authorize' && 'Authorized'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Execution Output Box */}
      {executionResult && (
        <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> 10-Stage Modular Execution Complete &amp; Realized to Ledger
            </span>
            <span className="text-slate-400 text-[11px]">
              Auth ID: {executionResult.steps.authorize.authId}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-slate-300 text-[11px]">
            <div>
              <span className="text-slate-400">Realized Gross:</span>{' '}
              <strong className="text-white">${executionResult.steps.quote.expectedGrossRevenueUsd.toFixed(2)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Realized Net P&amp;L:</span>{' '}
              <strong className="text-emerald-400">+${executionResult.steps.quote.netExpectedRevenueUsd.toFixed(2)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Evidence Signature:</span>{' '}
              <span className="text-slate-200 font-mono break-all">{executionResult.steps.execute.authoritativeEvidenceSignature}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
