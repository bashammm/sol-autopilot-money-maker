/**
 * YABBAI - Opportunity Engine & Yield Ranker
 * Mathematical EV Formula:
 * net_ev = expected_value - network_fees - trading_fees - slippage - risk_cost - capital_cost
 * Supports Capability Thresholds:
 * $0 -> $20 -> $50 -> $100 -> $250 -> $500 -> $1K -> $2.5K -> $5K -> $10K+
 */

import { Opportunity, ExecutionTier, StrategyCategory, CurrentPredicament } from '../../src/types/yabbai';

export const THRESHOLD_LEVELS: { tier: ExecutionTier; minCapitalUsd: number }[] = [
  { tier: '$0', minCapitalUsd: 0 },
  { tier: '$20', minCapitalUsd: 20 },
  { tier: '$50', minCapitalUsd: 50 },
  { tier: '$100', minCapitalUsd: 100 },
  { tier: '$250', minCapitalUsd: 250 },
  { tier: '$500', minCapitalUsd: 500 },
  { tier: '$1K', minCapitalUsd: 1000 },
  { tier: '$2.5K', minCapitalUsd: 2500 },
  { tier: '$5K', minCapitalUsd: 5000 },
  { tier: '$10K+', minCapitalUsd: 10000 },
];

export class YieldRanker {
  /**
   * Authoritative EV ranking formula:
   * expected_value - network_fees - trading_fees - slippage - risk_cost - capital_cost
   */
  public static calculateNetEv(opp: {
    rawExpectedValueUsd: number;
    networkFeesUsd: number;
    tradingFeesUsd: number;
    slippageUsd: number;
    riskCostUsd: number;
    capitalCostUsd: number;
  }): number {
    const net = opp.rawExpectedValueUsd -
      opp.networkFeesUsd -
      opp.tradingFeesUsd -
      opp.slippageUsd -
      opp.riskCostUsd -
      opp.capitalCostUsd;

    return Math.round(net * 100) / 100;
  }

  public static rankByNetEv(opps: Opportunity[]): Opportunity[] {
    return [...opps].sort((a, b) => {
      const netA = a.netEvUsd !== undefined ? a.netEvUsd : YieldRanker.calculateNetEv(a);
      const netB = b.netEvUsd !== undefined ? b.netEvUsd : YieldRanker.calculateNetEv(b);
      return netB - netA;
    });
  }
}

export class OpportunityRegistry {
  private opportunities: Map<string, Opportunity> = new Map();

  constructor() {
    this.seedInitialOpportunities();
  }

  private seedInitialOpportunities() {
    const initial: Opportunity[] = [
      // $0 Capital Opportunities (Research, Security, Data, Analytics, Alerting)
      {
        id: 'opp-zero-01',
        title: 'Solana SPL Token Mint Authority Security Audit',
        category: 'security_analysis',
        tierRequirement: '$0',
        capitalRequiredUsd: 0,
        gasRequiredSol: 0,
        rawExpectedValueUsd: 35.00,
        networkFeesUsd: 0,
        tradingFeesUsd: 0,
        slippageUsd: 0,
        riskCostUsd: 1.50,
        capitalCostUsd: 0,
        netEvUsd: 33.50,
        confidenceScore: 94,
        isZeroCapital: true,
        requiresGas: false,
        authoritativeSource: 'On-chain Metadata & Revocation Indexer',
        status: 'ACTIVE',
        createdAt: Date.now() - 120000,
        expiresAt: Date.now() + 3600000 * 8,
        description: 'Comprehensive static bytecode & metadata vulnerability scan for newly deployed Solana programs, generating client-payable security report.'
      },
      {
        id: 'opp-zero-02',
        title: 'DEX Pool Liquidity Imbalance Telemetry Feed',
        category: 'analytics',
        tierRequirement: '$0',
        capitalRequiredUsd: 0,
        gasRequiredSol: 0,
        rawExpectedValueUsd: 25.00,
        networkFeesUsd: 0,
        tradingFeesUsd: 0,
        slippageUsd: 0,
        riskCostUsd: 0.80,
        capitalCostUsd: 0,
        netEvUsd: 24.20,
        confidenceScore: 91,
        isZeroCapital: true,
        requiresGas: false,
        authoritativeSource: 'Raydium & Orca Whirlpool Depth Stream',
        status: 'ACTIVE',
        createdAt: Date.now() - 60000,
        expiresAt: Date.now() + 3600000 * 6,
        description: 'Publish low-latency liquidity variance alerts to enterprise subscribers via authenticated webhook channel.'
      },
      {
        id: 'opp-zero-03',
        title: 'Whale Portfolio Flow & Rebalancing Brief',
        category: 'portfolio_analytics',
        tierRequirement: '$0',
        capitalRequiredUsd: 0,
        gasRequiredSol: 0,
        rawExpectedValueUsd: 40.00,
        networkFeesUsd: 0,
        tradingFeesUsd: 0,
        slippageUsd: 0,
        riskCostUsd: 2.00,
        capitalCostUsd: 0,
        netEvUsd: 38.00,
        confidenceScore: 89,
        isZeroCapital: true,
        requiresGas: false,
        authoritativeSource: 'Helius Enhanced Webhook Cluster',
        status: 'ACTIVE',
        createdAt: Date.now() - 180000,
        expiresAt: Date.now() + 3600000 * 12,
        description: 'Synthesize clustering analysis on top 100 Solana treasury wallets into structured quarterly intelligence reports.'
      },
      {
        id: 'opp-zero-04',
        title: 'RPC Provider Latency Benchmark & Indexing Service',
        category: 'api_data_services',
        tierRequirement: '$0',
        capitalRequiredUsd: 0,
        gasRequiredSol: 0,
        rawExpectedValueUsd: 30.00,
        networkFeesUsd: 0,
        tradingFeesUsd: 0,
        slippageUsd: 0,
        riskCostUsd: 1.00,
        capitalCostUsd: 0,
        netEvUsd: 29.00,
        confidenceScore: 96,
        isZeroCapital: true,
        requiresGas: false,
        authoritativeSource: 'Multi-Region RPC Probe Matrix',
        status: 'ACTIVE',
        createdAt: Date.now() - 300000,
        expiresAt: Date.now() + 3600000 * 24,
        description: 'Provide realtime SLA uptime and latency proofs to node operators and validator consortia.'
      },

      // $20 - $50 Threshold Opportunities (Micro-Arbitrage & Gas-Funded Tasks)
      {
        id: 'opp-tier20-01',
        title: 'Micro Raydium-Meteora Direct Route Triangular Arbitrage',
        category: 'arbitrage',
        tierRequirement: '$20',
        capitalRequiredUsd: 20,
        gasRequiredSol: 0.005,
        rawExpectedValueUsd: 22.40,
        networkFeesUsd: 0.75,
        tradingFeesUsd: 0.12,
        slippageUsd: 0.25,
        riskCostUsd: 0.40,
        capitalCostUsd: 0.10,
        netEvUsd: 20.78,
        confidenceScore: 82,
        isZeroCapital: false,
        requiresGas: true,
        authoritativeSource: 'Jupiter Routing Quote Matrix API',
        status: 'ACTIVE',
        createdAt: Date.now() - 90000,
        expiresAt: Date.now() + 300000,
        description: 'Single-atomic-bundle triangular swap routing between SOL/USDC pools with guaranteed revert on slippage breach.'
      },
      {
        id: 'opp-tier50-01',
        title: 'Concentrated Liquidity Rebalancing (USDC/USDT Stable Range)',
        category: 'liquidity_provision',
        tierRequirement: '$50',
        capitalRequiredUsd: 50,
        gasRequiredSol: 0.008,
        rawExpectedValueUsd: 53.20,
        networkFeesUsd: 1.20,
        tradingFeesUsd: 0.15,
        slippageUsd: 0.10,
        riskCostUsd: 0.50,
        capitalCostUsd: 0.25,
        netEvUsd: 51.00,
        confidenceScore: 88,
        isZeroCapital: false,
        requiresGas: true,
        authoritativeSource: 'Orca Whirlpools SDK V2',
        status: 'ACTIVE',
        createdAt: Date.now() - 45000,
        expiresAt: Date.now() + 1800000,
        description: 'Provide tight-tick stablecoin liquidity during high volume peg volatility windows with dynamic stop-loss.'
      },

      // $100 - $500 Threshold Opportunities (DeFi Yield & Automated Vaults)
      {
        id: 'opp-tier100-01',
        title: 'Kamino Automated JupSOL-SOL Lending Yield Loop',
        category: 'defi_yield',
        tierRequirement: '$100',
        capitalRequiredUsd: 100,
        gasRequiredSol: 0.012,
        rawExpectedValueUsd: 105.80,
        networkFeesUsd: 1.80,
        tradingFeesUsd: 0.30,
        slippageUsd: 0.20,
        riskCostUsd: 0.90,
        capitalCostUsd: 0.60,
        netEvUsd: 102.00,
        confidenceScore: 92,
        isZeroCapital: false,
        requiresGas: true,
        authoritativeSource: 'Kamino Finance Protocol Yield API',
        status: 'ACTIVE',
        createdAt: Date.now() - 75000,
        expiresAt: Date.now() + 86400000,
        description: 'Optimized LST lending vault compounding with target LTV under 45% to eliminate liquidation vulnerability.'
      },
      {
        id: 'opp-tier250-01',
        title: 'Marinade mSOL Native Validator Stake-Deleveraging Cycle',
        category: 'defi_yield',
        tierRequirement: '$250',
        capitalRequiredUsd: 250,
        gasRequiredSol: 0.015,
        rawExpectedValueUsd: 262.50,
        networkFeesUsd: 2.25,
        tradingFeesUsd: 0.50,
        slippageUsd: 0.40,
        riskCostUsd: 1.20,
        capitalCostUsd: 1.50,
        netEvUsd: 256.65,
        confidenceScore: 95,
        isZeroCapital: false,
        requiresGas: true,
        authoritativeSource: 'Marinade Stake Auction Protocol',
        status: 'ACTIVE',
        createdAt: Date.now() - 110000,
        expiresAt: Date.now() + 86400000 * 2,
        description: 'Epoch-boundary delegation rebalancing capturing validator MEV rewards without lockup penalties.'
      },

      // $1K - $10K+ Threshold Opportunities
      {
        id: 'opp-tier1K-01',
        title: 'Cross-Venue Drift Protocol Funding Rate Basis Arbitrage',
        category: 'arbitrage',
        tierRequirement: '$1K',
        capitalRequiredUsd: 1000,
        gasRequiredSol: 0.03,
        rawExpectedValueUsd: 1048.00,
        networkFeesUsd: 4.50,
        tradingFeesUsd: 2.50,
        slippageUsd: 1.80,
        riskCostUsd: 5.00,
        capitalCostUsd: 4.20,
        netEvUsd: 1030.00,
        confidenceScore: 90,
        isZeroCapital: false,
        requiresGas: true,
        authoritativeSource: 'Drift v2 WebSocket Market Data',
        status: 'ACTIVE',
        createdAt: Date.now() - 15000,
        expiresAt: Date.now() + 14400000,
        description: 'Delta-neutral perpetual funding rate spread capture hedging spot SOL against 8-hour perp funding rate imbalance.'
      }
    ];

    for (const opp of initial) {
      opp.netEvUsd = YieldRanker.calculateNetEv(opp);
      this.opportunities.set(opp.id, opp);
    }
  }

  public getAll(): Opportunity[] {
    return Array.from(this.opportunities.values());
  }

  public getActiveOpportunities(): Opportunity[] {
    return Array.from(this.opportunities.values()).filter(o => o.status === 'ACTIVE' || !o.status);
  }

  public getRanked(availableCapitalUsd: number, availableGasSol: number): Opportunity[] {
    const all = Array.from(this.opportunities.values());

    return all.map(opp => {
      // Re-evaluate net EV
      const netEv = YieldRanker.calculateNetEv(opp);
      const isBlocked = (opp.capitalRequiredUsd > availableCapitalUsd) || (opp.requiresGas && availableGasSol < opp.gasRequiredSol);

      return {
        ...opp,
        netEvUsd: netEv,
        status: isBlocked ? 'BLOCKED_BY_CAPITAL' : opp.status
      };
    }).sort((a, b) => {
      // High net EV first, prioritize non-blocked if equal
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
      return b.netEvUsd - a.netEvUsd;
    });
  }

  public getById(id: string): Opportunity | undefined {
    return this.opportunities.get(id);
  }

  public addOpportunity(opp: Opportunity) {
    opp.netEvUsd = YieldRanker.calculateNetEv(opp);
    this.opportunities.set(opp.id, opp);
  }
}

export class CurrentPredicamentEngine {
  /**
   * Assesses current available capital, capability tier, blockers, and gas constraints
   */
  public static evaluate(
    verifiedCapitalUsd: number,
    activeGasBalanceSol: number
  ): CurrentPredicament {
    // Determine current tier from verified capital
    let currentTier: ExecutionTier = '$0';
    let nextTier: ExecutionTier = '$20';
    let nextTierCapital = 20;

    for (let i = THRESHOLD_LEVELS.length - 1; i >= 0; i--) {
      if (verifiedCapitalUsd >= THRESHOLD_LEVELS[i].minCapitalUsd) {
        currentTier = THRESHOLD_LEVELS[i].tier;
        if (i < THRESHOLD_LEVELS.length - 1) {
          nextTier = THRESHOLD_LEVELS[i + 1].tier;
          nextTierCapital = THRESHOLD_LEVELS[i + 1].minCapitalUsd;
        } else {
          nextTier = '$10K+';
          nextTierCapital = 10000;
        }
        break;
      }
    }

    const isZeroCapital = verifiedCapitalUsd < 20;
    const blockers: string[] = [];
    const recommendations: string[] = [];

    if (isZeroCapital) {
      blockers.push('Active Capital: $0 Mode engaged. Capital-requiring on-chain transactions are blocked by safety guardrails.');
      recommendations.push('Run zero-capital strategies: Token security auditing, on-chain telemetry, and API data feeds.');
      recommendations.push('Accumulate verified off-chain/billing revenues into Operating Reserve before activating gas strategies.');
    }

    if (activeGasBalanceSol < 0.05) {
      blockers.push(`Gas Shortfall: Fleet SOL balance is ${(activeGasBalanceSol).toFixed(4)} SOL (< 0.05 SOL required for safety reserves).`);
      recommendations.push('Reserve 5% of verified earnings for on-chain gas fueling before deploying on-chain transactions.');
    }

    const capitalNeeded = Math.max(0, nextTierCapital - verifiedCapitalUsd);

    const eligibleCategories: StrategyCategory[] = isZeroCapital
      ? ['security_analysis', 'analytics', 'portfolio_analytics', 'api_data_services', 'research', 'wallet_reports']
      : [
          'security_analysis', 'analytics', 'portfolio_analytics', 'api_data_services',
          'arbitrage', 'defi_yield', 'liquidity_provision', 'automation', 'treasury_reporting'
        ];

    return {
      currentTier,
      availableCapitalUsd: verifiedCapitalUsd,
      verifiedRevenueUsd: verifiedCapitalUsd,
      unrealizedEstimatedUsd: 0, // Estimates never enter realized P&L!
      activeGasBalanceSol,
      gasReserveShortfallSol: Math.max(0, 0.05 - activeGasBalanceSol),
      zeroCapitalModeActive: isZeroCapital,
      blockers,
      eligibleCategories,
      nextMilestoneTier: nextTier,
      capitalNeededForNextTierUsd: capitalNeeded,
      recommendations
    };
  }
}
