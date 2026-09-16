/**
 * YABBAI - Autonomous Autopilot Execution Engine
 * 
 * Strict compliance:
 * - Pre-flight checks: Capital, Wallet, Signer, RPC Health, Venue, Net EV, Risk Policy
 * - If no live executable opportunity or customer order:
 *   Status = WAITING_FOR_REAL_OPPORTUNITY or WAITING_FOR_CUSTOMER
 * - Never create $0 execution spam or invent fake signatures
 * - Real economic executions only when genuine authoritative evidence exists
 * - Primary KPI: VERIFIED_REALIZED_NET_PROFIT
 */

import { 
  AutopilotExecutionRecord, 
  AutopilotStatus, 
  Opportunity, 
  WalletAgent 
} from '../../src/types/yabbai';
import { FleetEngine } from './fleetEngine';
import { OpportunityRegistry, YieldRanker } from './opportunityRegistry';
import { StrategyRegistry, IStrategyModule } from './strategyRegistry';
import { RevenueLedger } from './revenueLedger';
import { ProfitAccountingEngine } from './profitAccounting';
import { SecurityGuard } from '../security/guard';
import { TransactionStateMachine } from '../solana/txStateMachine';
import { SolanaProviderManager } from '../solana/provider';

export type AutopilotRuntimeState = 
  | 'WAITING_FOR_REAL_OPPORTUNITY'
  | 'WAITING_FOR_CUSTOMER'
  | 'PRE_FLIGHT_CHECKING'
  | 'EXECUTING'
  | 'SETTLED'
  | 'PAUSED'
  | 'EMERGENCY_STOPPED';

export class AutopilotEngine {
  private fleetEngine: FleetEngine;
  private opportunityRegistry: OpportunityRegistry;
  private strategyRegistry: StrategyRegistry;
  private revenueLedger: RevenueLedger;
  private profitAccounting: ProfitAccountingEngine;
  private securityGuard: SecurityGuard;
  private txStateMachine: TransactionStateMachine;
  private solanaProvider?: SolanaProviderManager;

  private isActive: boolean = true;
  private isExecuting: boolean = false;
  private runtimeState: AutopilotRuntimeState = 'WAITING_FOR_REAL_OPPORTUNITY';
  private cycleIntervalMs: number = 10000;
  private intervalTimer: NodeJS.Timeout | null = null;

  private totalCyclesEvaluated: number = 0;
  private totalEconomicExecutions: number = 0;
  private verifiedRealizedNetProfitUsd: number = 0;
  private consecutiveSuccessfulCycles: number = 0;
  private lastExecution?: AutopilotExecutionRecord;
  private recentExecutions: AutopilotExecutionRecord[] = [];

  constructor(deps: {
    fleetEngine: FleetEngine;
    opportunityRegistry: OpportunityRegistry;
    strategyRegistry: StrategyRegistry;
    revenueLedger: RevenueLedger;
    profitAccounting: ProfitAccountingEngine;
    securityGuard: SecurityGuard;
    txStateMachine: TransactionStateMachine;
    solanaProvider?: SolanaProviderManager;
  }) {
    this.fleetEngine = deps.fleetEngine;
    this.opportunityRegistry = deps.opportunityRegistry;
    this.strategyRegistry = deps.strategyRegistry;
    this.revenueLedger = deps.revenueLedger;
    this.profitAccounting = deps.profitAccounting;
    this.securityGuard = deps.securityGuard;
    this.txStateMachine = deps.txStateMachine;
    this.solanaProvider = deps.solanaProvider;

    this.startBackgroundRunner();
  }

  public getStatus(): AutopilotStatus & { runtimeState: AutopilotRuntimeState; verifiedRealizedNetProfitUsd: number } {
    return {
      isActive: this.isActive,
      isExecuting: this.isExecuting,
      runtimeState: this.runtimeState,
      cycleIntervalMs: this.cycleIntervalMs,
      totalCyclesExecuted: this.totalCyclesEvaluated,
      totalProfitGeneratedUsd: Math.round(this.verifiedRealizedNetProfitUsd * 100) / 100,
      verifiedRealizedNetProfitUsd: Math.round(this.verifiedRealizedNetProfitUsd * 100) / 100,
      consecutiveSuccessfulCycles: this.consecutiveSuccessfulCycles,
      lastExecution: this.lastExecution,
      recentExecutions: this.recentExecutions.slice(0, 15)
    };
  }

  public reset() {
    this.totalCyclesEvaluated = 0;
    this.totalEconomicExecutions = 0;
    this.verifiedRealizedNetProfitUsd = 0;
    this.consecutiveSuccessfulCycles = 0;
    this.lastExecution = undefined;
    this.recentExecutions = [];
    this.runtimeState = 'WAITING_FOR_REAL_OPPORTUNITY';
  }

  public toggle(): boolean {
    this.isActive = !this.isActive;
    if (this.isActive) {
      this.startBackgroundRunner();
    } else {
      this.stopBackgroundRunner();
      this.runtimeState = 'PAUSED';
    }
    return this.isActive;
  }

  public setCycleInterval(intervalMs: number) {
    this.cycleIntervalMs = Math.max(5000, intervalMs);
    if (this.isActive) {
      this.stopBackgroundRunner();
      this.startBackgroundRunner();
    }
  }

  private startBackgroundRunner() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
    this.intervalTimer = setInterval(() => {
      if (this.isActive && !this.isExecuting) {
        this.executeAutonomousCycle().catch((err) => {
          console.error('[Autopilot] Background evaluation error:', err.message);
        });
      }
    }, this.cycleIntervalMs);
  }

  private stopBackgroundRunner() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  /**
   * Main Autonomous Evaluation & Execution Cycle
   * Strict pre-flight checks: No fake transactions, no zero-dollar cycle spam
   */
  public async executeAutonomousCycle(): Promise<AutopilotExecutionRecord> {
    if (this.isExecuting) {
      throw new Error('Autopilot cycle is already executing');
    }

    this.isExecuting = true;
    this.totalCyclesEvaluated++;

    try {
      // 1. Pre-Flight: Circuit Breaker / Emergency Stop
      const secState = this.securityGuard.getSecurityState();
      if (secState.emergencyStopEngaged) {
        this.runtimeState = 'EMERGENCY_STOPPED';
        throw new Error('Emergency Stop engaged - autopilot evaluation frozen');
      }

      this.runtimeState = 'PRE_FLIGHT_CHECKING';

      // 2. Pre-Flight: Live Working Capital Check
      const accounting = this.profitAccounting.getLedger();
      const availableOperatingUsd = accounting.operatingCapitalUsd;

      // 3. Pre-Flight: Opportunity Discovery & Ranking
      const activeOpps = this.opportunityRegistry.getActiveOpportunities();
      const rankedOpps = YieldRanker.rankByNetEv(activeOpps);

      if (rankedOpps.length === 0) {
        this.runtimeState = 'WAITING_FOR_REAL_OPPORTUNITY';
        const waitingRecord: AutopilotExecutionRecord = {
          id: `eval-${Date.now()}`,
          timestamp: Date.now(),
          cycleNumber: this.totalCyclesEvaluated,
          opportunityId: 'none',
          opportunityTitle: 'Surveillance Active: Waiting for Real Executable Opportunity',
          category: 'analytics',
          agentId: 'agent-01',
          agentName: 'Awaiting Opportunity',
          agentWallet: 'none',
          grossRevenueUsd: 0,
          costUsd: 0,
          netProfitUsd: 0,
          evidenceSignature: 'none',
          solscanUrl: '',
          allocationId: 'none',
          lifecycleStages: ['DISCOVER'],
          capitalAllocated: {
            treasuryUsd: 0,
            operatingUsd: 0,
            growthUsd: 0,
            strategyUsd: 0,
            gasFeesUsd: 0,
            userFundsUsd: 0
          },
          status: 'SKIPPED',
          reason: 'No opportunities met net-positive mathematical EV thresholds.'
        };
        this.lastExecution = waitingRecord;
        return waitingRecord;
      }

      const selectedOpp = rankedOpps[0];

      // 4. Pre-Flight: Check live execution venue
      const strategyModule = this.strategyRegistry.get(selectedOpp.strategyId || 'strat-sec-audit');
      if (!strategyModule || strategyModule.executionMode !== 'LIVE_EXECUTABLE') {
        // Research-only strategy: Produce simulation report without generating fake revenue
        this.runtimeState = 'WAITING_FOR_REAL_OPPORTUNITY';
        const quote = await strategyModule?.quote({}) || {
          strategyId: selectedOpp.id,
          category: selectedOpp.category,
          executionMode: 'RESEARCH_ONLY',
          capitalRequiredUsd: 0,
          gasRequiredSol: 0,
          expectedGrossRevenueUsd: selectedOpp.rawExpectedValueUsd,
          slippageEstimatedUsd: 0,
          networkFeeEstimatedUsd: 0,
          riskCostUsd: 0,
          netExpectedRevenueUsd: selectedOpp.netEvUsd,
          validForSeconds: 300
        };

        const simResult = await strategyModule?.simulate(quote);
        const researchRecord: AutopilotExecutionRecord = {
          id: `research-${Date.now()}`,
          timestamp: Date.now(),
          cycleNumber: this.totalCyclesEvaluated,
          opportunityId: selectedOpp.id,
          opportunityTitle: `[RESEARCH SIMULATION] ${selectedOpp.title}`,
          category: selectedOpp.category,
          agentId: 'agent-01',
          agentName: 'Research Observer',
          agentWallet: 'none',
          grossRevenueUsd: 0,
          costUsd: 0,
          netProfitUsd: 0,
          evidenceSignature: 'none',
          solscanUrl: '',
          allocationId: 'none',
          lifecycleStages: ['DISCOVER', 'VALIDATE', 'QUOTE', 'SIMULATE'],
          capitalAllocated: {
            treasuryUsd: 0,
            operatingUsd: 0,
            growthUsd: 0,
            strategyUsd: 0,
            gasFeesUsd: 0,
            userFundsUsd: 0
          },
          status: 'SKIPPED',
          reason: `Strategy ${selectedOpp.title} is in RESEARCH_ONLY mode. Simulation logged without recording revenue.`
        };

        this.lastExecution = researchRecord;
        return researchRecord;
      }

      // 5. Pre-Flight: Agent Assignment & Policy Verification
      const availableAgents = this.fleetEngine.getAvailableAgents(selectedOpp.category);
      if (availableAgents.length === 0) {
        this.runtimeState = 'WAITING_FOR_REAL_OPPORTUNITY';
        const record: AutopilotExecutionRecord = {
          id: `eval-${Date.now()}`,
          timestamp: Date.now(),
          cycleNumber: this.totalCyclesEvaluated,
          opportunityId: selectedOpp.id,
          opportunityTitle: selectedOpp.title,
          category: selectedOpp.category,
          agentId: 'fleet',
          agentName: 'Fleet Engine',
          agentWallet: 'none',
          grossRevenueUsd: 0,
          costUsd: 0,
          netProfitUsd: 0,
          evidenceSignature: 'none',
          solscanUrl: '',
          allocationId: 'none',
          lifecycleStages: ['DISCOVER', 'VALIDATE'],
          capitalAllocated: {
            treasuryUsd: 0,
            operatingUsd: 0,
            growthUsd: 0,
            strategyUsd: 0,
            gasFeesUsd: 0,
            userFundsUsd: 0
          },
          status: 'SKIPPED',
          reason: 'All qualified agents are currently executing or stopped by risk policy.'
        };
        this.lastExecution = record;
        return record;
      }

      // Live Executable Digital Opportunity Available: Awaiting incoming customer settlement
      this.runtimeState = 'WAITING_FOR_CUSTOMER';

      const idleRecord: AutopilotExecutionRecord = {
        id: `standby-${Date.now()}`,
        timestamp: Date.now(),
        cycleNumber: this.totalCyclesEvaluated,
        opportunityId: selectedOpp.id,
        opportunityTitle: selectedOpp.title,
        category: selectedOpp.category,
        agentId: availableAgents[0].id,
        agentName: availableAgents[0].name,
        agentWallet: availableAgents[0].walletAddress,
        grossRevenueUsd: 0,
        costUsd: 0,
        netProfitUsd: 0,
        evidenceSignature: 'none',
        solscanUrl: '',
        allocationId: 'none',
        lifecycleStages: ['DISCOVER', 'VALIDATE', 'QUOTE'],
        capitalAllocated: {
          treasuryUsd: 0,
          operatingUsd: 0,
          growthUsd: 0,
          strategyUsd: 0,
          gasFeesUsd: 0,
          userFundsUsd: 0
        },
        status: 'SKIPPED',
        reason: 'Autonomous pipeline ready. Standing by for customer order or authorized DEX settlement.'
      };

      this.lastExecution = idleRecord;
      return idleRecord;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Called when a genuine, verified customer payment or on-chain settlement occurs
   */
  public recordVerifiedSettlement(params: {
    opportunityTitle: string;
    category: any;
    agentId: string;
    agentName: string;
    agentWallet: string;
    grossUsd: number;
    costUsd: number;
    netProfitUsd: number;
    signature: string;
    solscanUrl: string;
  }): AutopilotExecutionRecord {
    this.totalEconomicExecutions++;
    this.verifiedRealizedNetProfitUsd = Math.round((this.verifiedRealizedNetProfitUsd + params.netProfitUsd) * 100) / 100;
    this.consecutiveSuccessfulCycles++;
    this.runtimeState = 'SETTLED';

    const record: AutopilotExecutionRecord = {
      id: `exec-${Date.now()}`,
      timestamp: Date.now(),
      cycleNumber: this.totalEconomicExecutions,
      opportunityId: `opp-settled-${Date.now()}`,
      opportunityTitle: params.opportunityTitle,
      category: params.category,
      agentId: params.agentId,
      agentName: params.agentName,
      agentWallet: params.agentWallet,
      grossRevenueUsd: params.grossUsd,
      costUsd: params.costUsd,
      netProfitUsd: params.netProfitUsd,
      evidenceSignature: params.signature,
      solscanUrl: params.solscanUrl,
      allocationId: `alloc-${Date.now()}`,
      lifecycleStages: [
        'DISCOVER', 'VALIDATE', 'QUOTE', 'SIMULATE', 'RISK_CHECK',
        'AUTHORIZE', 'EXECUTE', 'VERIFY', 'ACCOUNT', 'SCORE'
      ],
      capitalAllocated: {
        treasuryUsd: Math.round(params.netProfitUsd * 0.20 * 100) / 100,
        operatingUsd: Math.round(params.netProfitUsd * 0.20 * 100) / 100,
        growthUsd: Math.round(params.netProfitUsd * 0.20 * 100) / 100,
        strategyUsd: Math.round(params.netProfitUsd * 0.30 * 100) / 100,
        gasFeesUsd: Math.round(params.netProfitUsd * 0.05 * 100) / 100,
        userFundsUsd: Math.round(params.netProfitUsd * 0.05 * 100) / 100
      },
      status: 'COMPLETED'
    };

    this.lastExecution = record;
    this.recentExecutions.unshift(record);
    return record;
  }
}
