import React, { useState, useEffect, useCallback } from 'react';
import { 
  Layers, 
  Cpu, 
  Target, 
  Workflow, 
  Shield, 
  Radio, 
  Server, 
  GitBranch, 
  TrendingUp,
  AlertCircle,
  FileText
} from 'lucide-react';

import { 
  CurrentPredicament, 
  SystemSecurityState, 
  CapitalBuckets, 
  Opportunity, 
  WalletAgent, 
  StrategySignal, 
  TransactionStateRecord, 
  SquadsProposal, 
  RpcProviderHealth, 
  AuditLogEntry,
  DecisionRecord,
  StrategyCategory,
  AutopilotStatus,
  AutopilotExecutionRecord,
  ProfitSweepStatus
} from './types/yabbai';

import { Header } from './components/Header';
import { CapitalOverview } from './components/CapitalOverview';
import { AutopilotControlBanner } from './components/AutopilotControlBanner';
import { ProfitSweepBanner } from './components/ProfitSweepBanner';
import { FleetGrid } from './components/FleetGrid';
import { OpportunityEngineView } from './components/OpportunityEngineView';
import { SignalBusView } from './components/SignalBusView';
import { StrategyLifecycleView } from './components/StrategyLifecycleView';
import { TransactionsView } from './components/TransactionsView';
import { TreasurySquadsView } from './components/TreasurySquadsView';
import { ProviderHealthView } from './components/ProviderHealthView';
import { TestSuiteModal } from './components/TestSuiteModal';
import { AuditTrailModal } from './components/AuditTrailModal';
import { NewRevenueModal } from './components/NewRevenueModal';
import { TreasuryWithdrawModal } from './components/TreasuryWithdrawModal';

type NavTab = 
  | 'overview' 
  | 'opportunities' 
  | 'fleet' 
  | 'lifecycle' 
  | 'transactions' 
  | 'squads' 
  | 'signals' 
  | 'infrastructure';

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Core Data States
  const [predicament, setPredicament] = useState<CurrentPredicament | undefined>();
  const [securityState, setSecurityState] = useState<SystemSecurityState | undefined>();
  const [capitalBuckets, setCapitalBuckets] = useState<CapitalBuckets | undefined>();
  const [activeProviderName, setActiveProviderName] = useState<string>('QuickNode Solana Dedicated');
  const [realizedRevenueTotal, setRealizedRevenueTotal] = useState<number>(0);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [agents, setAgents] = useState<WalletAgent[]>([]);
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<TransactionStateRecord[]>([]);
  const [proposals, setProposals] = useState<SquadsProposal[]>([]);
  const [providers, setProviders] = useState<RpcProviderHealth[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Modals
  const [showTestModal, setShowTestModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // Phantom Wallet Connection
  const [connectedPhantomAddress, setConnectedPhantomAddress] = useState<string>('');

  // Autopilot Autonomous State
  const [autopilotStatus, setAutopilotStatus] = useState<AutopilotStatus | undefined>();
  const [profitSweepStatus, setProfitSweepStatus] = useState<ProfitSweepStatus | undefined>();
  const [isExecutingAutopilot, setIsExecutingAutopilot] = useState(false);

  // Auto-detect Phantom wallet connection if trusted
  useEffect(() => {
    try {
      const solana = (window as any).phantom?.solana || (window as any).solana;
      if (solana?.isPhantom && solana.publicKey) {
        setConnectedPhantomAddress(solana.publicKey.toString());
      } else if (solana?.isPhantom && solana.connect) {
        solana.connect({ onlyIfTrusted: true }).then((resp: any) => {
          if (resp?.publicKey) {
            setConnectedPhantomAddress(resp.publicKey.toString());
          }
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  const handleConnectPhantom = async (): Promise<string | null> => {
    try {
      const solana = (window as any).phantom?.solana || (window as any).solana;
      if (solana?.isPhantom && solana.connect) {
        const resp = await solana.connect();
        const pubkey = resp.publicKey.toString();
        setConnectedPhantomAddress(pubkey);
        return pubkey;
      } else {
        setShowWithdrawModal(true);
        return null;
      }
    } catch (err: any) {
      setErrorNotice(`Phantom connection notice: ${err.message}`);
      return null;
    }
  };

  // Fetch all live data from backend APIs
  const fetchAllData = useCallback(async () => {
    setIsRefreshing(true);
    setErrorNotice(null);
    try {
      const [
        statusRes,
        oppsRes,
        fleetRes,
        signalsRes,
        stratsRes,
        revenueRes,
        txsRes,
        propsRes,
        provsRes,
        auditRes
      ] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/opportunities').then(r => r.json()),
        fetch('/api/fleet').then(r => r.json()),
        fetch('/api/signals').then(r => r.json()),
        fetch('/api/strategies').then(r => r.json()),
        fetch('/api/revenue').then(r => r.json()),
        fetch('/api/transactions').then(r => r.json()),
        fetch('/api/treasury/proposals').then(r => r.json()),
        fetch('/api/providers/health').then(r => r.json()),
        fetch('/api/audit-logs').then(r => r.json())
      ]);

      if (statusRes.predicament) setPredicament(statusRes.predicament);
      if (statusRes.securityState) setSecurityState(statusRes.securityState);
      if (statusRes.capitalBuckets) setCapitalBuckets(statusRes.capitalBuckets);
      if (statusRes.autopilot) setAutopilotStatus(statusRes.autopilot);
      if (statusRes.profitSweep) setProfitSweepStatus(statusRes.profitSweep);
      if (statusRes.activeProvider) {
        setActiveProviderName(statusRes.activeProvider.name);
      } else if (statusRes.activeRpcProvider) {
        setActiveProviderName(statusRes.activeRpcProvider);
      }

      if (oppsRes.opportunities) setOpportunities(oppsRes.opportunities);
      if (fleetRes.agents) setAgents(fleetRes.agents);
      
      const rawSignals = Array.isArray(signalsRes) ? signalsRes : (signalsRes.signals || []);
      setSignals(rawSignals);

      const rawStrats = Array.isArray(stratsRes) ? stratsRes : (stratsRes.strategies || []);
      setStrategies(rawStrats);

      const revTotal = revenueRes.totalRealizedRevenueUsd ?? revenueRes.totalRealizedUsd ?? 0;
      setRealizedRevenueTotal(revTotal);

      const rawTxs = Array.isArray(txsRes) ? txsRes : (txsRes.transactions || []);
      setTransactions(rawTxs);

      if (propsRes.proposals) setProposals(propsRes.proposals);
      if (provsRes.providers) setProviders(provsRes.providers);
      if (auditRes.logs) setAuditLogs(auditRes.logs);
    } catch (err: any) {
      setErrorNotice(`Network or backend sync warning: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const timer = setInterval(fetchAllData, 15000); // 15-second background refresh
    return () => clearInterval(timer);
  }, [fetchAllData]);

  // Actions
  const handleEmergencyStopToggle = async () => {
    const isCurrentlyStopped = securityState?.emergencyStopEngaged || false;
    const action = isCurrentlyStopped ? 'disengage' : 'engage';
    try {
      await fetch('/api/security/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: isCurrentlyStopped ? 'Operator manual clearance' : 'Operator manual emergency stop',
          secretKey: 'Admin-Key'
        })
      });
      await fetchAllData();
    } catch (err: any) {
      alert(`Emergency stop failed: ${err.message}`);
    }
  };

  const handleEvaluateAgent = async (agentId: string, opportunityId: string): Promise<DecisionRecord> => {
    const res = await fetch('/api/fleet/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, opportunityId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Evaluation failed');
    return data.decision;
  };

  const handleEmitSignal = async (payload: {
    sourceAgentId: string;
    category: StrategyCategory;
    expectedValueUsd: number;
    confidence: number;
  }) => {
    const res = await fetch('/api/signals/emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Signal emit failed');
    }
    await fetchAllData();
  };

  const handleRunLifecycle = async (strategyId: string) => {
    const res = await fetch('/api/strategies/run-lifecycle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategyId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lifecycle execution failed');
    await fetchAllData();
    return data;
  };

  const handleAuthorizeTx = async (txId: string) => {
    const res = await fetch('/api/transactions/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intentId: txId,
        clientSignature: `sig_client_${Date.now()}_non_custodial_proof`
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Authorization failed');
    }
    await fetchAllData();
  };

  const handleSubmitNewIntent = async (recipient: string, amountLamports: number) => {
    const res = await fetch('/api/transactions/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-10',
        targetRecipient: recipient,
        amountLamports,
        strategyCategory: 'arbitrage'
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Dispatch failed');
    }
    await fetchAllData();
    setActiveTab('transactions');
  };

  const handleVoteProposal = async (proposalId: string, signatory: string) => {
    const res = await fetch('/api/treasury/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId, signatory })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Vote failed');
    }
    await fetchAllData();
  };

  const handleExecuteProposal = async (proposalId: string) => {
    const res = await fetch('/api/treasury/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Execution failed');
    }
    await fetchAllData();
  };

  const handleCreateProposal = async (params: any) => {
    const res = await fetch('/api/treasury/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Proposal creation failed');
    }
    await fetchAllData();
  };

  const handleIngestRevenue = async (params: any) => {
    const res = await fetch('/api/revenue/verify-onchain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        assetMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        network: 'solana-mainnet'
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Revenue verification failed');
    }
    await fetchAllData();
  };

  const handleForceFailover = async (targetProviderId: string) => {
    const res = await fetch('/api/providers/failover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetProviderId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failover failed');
    }
    await fetchAllData();
  };

  const handleRunAllTests = async () => {
    const res = await fetch('/api/run-tests', { method: 'POST' });
    const data = await res.json();
    return data.report;
  };

  const handleToggleAutopilot = async () => {
    try {
      const res = await fetch('/api/autopilot/toggle', { method: 'POST' });
      const data = await res.json();
      if (data.status) setAutopilotStatus(data.status);
    } catch (err: any) {
      setErrorNotice(`Autopilot toggle error: ${err.message}`);
    }
  };

  const handleExecuteAutopilotCycle = async (): Promise<AutopilotExecutionRecord> => {
    setIsExecutingAutopilot(true);
    try {
      const res = await fetch('/api/autopilot/execute', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.execution?.reason || 'Autopilot cycle execution failed');
      }
      if (data.status) setAutopilotStatus(data.status);
      await fetchAllData();
      return data.execution;
    } catch (err: any) {
      setErrorNotice(`Autopilot cycle failed: ${err.message}`);
      throw err;
    } finally {
      setIsExecutingAutopilot(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Header */}
      <Header
        predicament={predicament}
        securityState={securityState}
        activeProviderName={activeProviderName}
        isEmergencyStopped={securityState?.emergencyStopEngaged || false}
        onEmergencyStopToggle={handleEmergencyStopToggle}
        onOpenTestModal={() => setShowTestModal(true)}
        onOpenAuditModal={() => setShowAuditModal(true)}
        onRefreshData={fetchAllData}
        isRefreshing={isRefreshing}
        connectedPhantomAddress={connectedPhantomAddress}
        onConnectPhantom={handleConnectPhantom}
        onOpenWithdrawModal={() => setShowWithdrawModal(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        
        {/* Error / Warning Notice */}
        {errorNotice && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}

        {/* Autonomous Autopilot Execution & Revenue Harvesting Hub */}
        <AutopilotControlBanner
          status={autopilotStatus}
          onToggleAutopilot={handleToggleAutopilot}
          onExecuteCycleNow={handleExecuteAutopilotCycle}
          isExecutingManual={isExecutingAutopilot}
        />

        {/* Real 10% Profit Sweeper Banner (Target: HKjCGdas7CVkSwQHi6Bhckj2U2P8rtTyMbikdY5pkXcb) */}
        <ProfitSweepBanner
          status={profitSweepStatus}
          onRefreshData={fetchAllData}
          onOpenWithdrawModal={() => setShowWithdrawModal(true)}
        />

        {/* Capital Overview Bar */}
        <CapitalOverview
          buckets={capitalBuckets}
          predicament={predicament}
          realizedRevenueTotal={realizedRevenueTotal}
          onOpenVerifyModal={() => setShowRevenueModal(true)}
          onOpenWithdrawModal={() => setShowWithdrawModal(true)}
        />

        {/* Navigation Tabs */}
        <nav className="border-b border-slate-800 flex items-center gap-1 overflow-x-auto pb-1 text-xs font-mono">
          {[
            { id: 'overview', label: 'Dashboard & Fleet', icon: Cpu },
            { id: 'opportunities', label: 'Yield Ranker', icon: Target },
            { id: 'lifecycle', label: '10-Stage Lifecycle', icon: GitBranch },
            { id: 'transactions', label: '15-Stage Tx Engine', icon: Workflow },
            { id: 'squads', label: 'Squads Multisig', icon: Shield },
            { id: 'signals', label: 'Signal Bus', icon: Radio },
            { id: 'infrastructure', label: 'RPC Failover', icon: Server }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as NavTab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg transition cursor-pointer border-b-2 font-medium ${
                  isActive
                    ? 'border-emerald-400 text-emerald-400 bg-slate-900/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Tab View */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <>
              <FleetGrid
                agents={agents}
                opportunities={opportunities}
                onEvaluateAgent={handleEvaluateAgent}
              />
              <OpportunityEngineView
                opportunities={opportunities}
                onTriggerOpportunity={(opp) => {
                  setActiveTab('lifecycle');
                }}
              />
            </>
          )}

          {activeTab === 'opportunities' && (
            <OpportunityEngineView
              opportunities={opportunities}
              onTriggerOpportunity={(opp) => {
                setActiveTab('lifecycle');
              }}
            />
          )}

          {activeTab === 'fleet' && (
            <FleetGrid
              agents={agents}
              opportunities={opportunities}
              onEvaluateAgent={handleEvaluateAgent}
            />
          )}

          {activeTab === 'lifecycle' && (
            <StrategyLifecycleView
              strategies={strategies}
              onRunLifecycle={handleRunLifecycle}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsView
              transactions={transactions}
              onAuthorizeTransaction={handleAuthorizeTx}
              onSubmitNewIntent={handleSubmitNewIntent}
            />
          )}

          {activeTab === 'squads' && (
            <TreasurySquadsView
              proposals={proposals}
              onVoteProposal={handleVoteProposal}
              onExecuteProposal={handleExecuteProposal}
              onCreateProposal={handleCreateProposal}
              onOpenWithdrawModal={() => setShowWithdrawModal(true)}
            />
          )}

          {activeTab === 'signals' && (
            <SignalBusView
              signals={signals}
              onEmitSignal={handleEmitSignal}
            />
          )}

          {activeTab === 'infrastructure' && (
            <ProviderHealthView
              providers={providers}
              onPingAll={fetchAllData}
              onForceFailover={handleForceFailover}
            />
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-4 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-mono">
          <div>
            <span>YABBAI Autonomous Revenue OS • Non-Custodial • </span>
            <span className="text-emerald-400">Squads v4 Multisig Governed</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Zero-Server-Side-Keys Policy Enforced</span>
            <span>•</span>
            <button 
              onClick={() => setShowTestModal(true)}
              className="text-slate-400 hover:text-white underline cursor-pointer"
            >
              Verify 16 Invariants
            </button>
          </div>
        </div>
      </footer>

      {/* Verification Test Suite Modal */}
      <TestSuiteModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        onRunTests={handleRunAllTests}
      />

      {/* Immutable Chained Audit Trail Modal */}
      <AuditTrailModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        auditLogs={auditLogs}
      />

      {/* Ingest Verified Revenue Modal */}
      <NewRevenueModal
        isOpen={showRevenueModal}
        onClose={() => setShowRevenueModal(false)}
        onIngestRevenue={handleIngestRevenue}
      />

      {/* Treasury Withdrawal to Phantom Wallet Modal */}
      <TreasuryWithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        capitalBuckets={capitalBuckets}
        connectedPhantomAddress={connectedPhantomAddress}
        onConnectPhantom={handleConnectPhantom}
        onWithdrawSuccess={fetchAllData}
      />

    </div>
  );
}

export default App;
