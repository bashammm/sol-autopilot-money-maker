/**
 * YABBAI - Crypto Revenue & Yield Operating System
 * Domain Types, Enums & Protocol Interfaces
 */

export type ExecutionTier = 
  | '$0' 
  | '$20' 
  | '$50' 
  | '$100' 
  | '$250' 
  | '$500' 
  | '$1K' 
  | '$2.5K' 
  | '$5K' 
  | '$10K+';

export type RiskProfile = 'LOW' | 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';

export type AgentStatus = 
  | 'ACTIVE' 
  | 'IDLE' 
  | 'EVALUATING' 
  | 'EXECUTING' 
  | 'PAUSED' 
  | 'RECONCILIATION_REQUIRED' 
  | 'EMERGENCY_STOPPED';

export type StrategyCategory = 
  | 'analytics'
  | 'wallet_reports'
  | 'security_analysis'
  | 'launch_packages'
  | 'premium_alerts'
  | 'api_data_services'
  | 'research'
  | 'treasury_reporting'
  | 'portfolio_analytics'
  | 'liquidity_monitoring'
  | 'risk_monitoring'
  | 'indexing'
  | 'automation'
  | 'data_quality'
  | 'defi_yield'
  | 'arbitrage'
  | 'liquidity_provision';

export type VerificationState = 'VERIFIED' | 'PENDING' | 'ESTIMATED' | 'UNKNOWN';

export type TxLifecycleState = 
  | 'REQUEST'
  | 'VALIDATE'
  | 'FETCH_STATE'
  | 'BUILD'
  | 'SIMULATE'
  | 'RISK'
  | 'POLICY'
  | 'PREVIEW'
  | 'AUTHORIZATION'
  | 'SIGN'
  | 'SUBMIT'
  | 'CONFIRM'
  | 'VERIFY'
  | 'RECONCILE'
  | 'AUDIT'
  | 'UNKNOWN'
  | 'RECONCILIATION_REQUIRED'
  | 'FAILED';

export interface DecisionRecord {
  id: string;
  timestamp: number;
  agentId: string;
  opportunityId: string;
  decision: 'ACCEPT' | 'REJECT' | 'DEFER';
  reason: string;
  evaluatedMetrics: {
    expectedValueUsd: number;
    estimatedCostUsd: number;
    netEvUsd: number;
    gasRequirementSol: number;
    availableGasSol: number;
    riskScore: number;
    slippageBps: number;
    budgetAvailableUsd: number;
    dailyLossRemainingUsd: number;
  };
  policyCheckPassed: boolean;
  correlationCheckPassed: boolean;
}

export interface WalletAgent {
  id: string; // e.g. "agent-01"
  slotNumber: number; // 1 to 20
  name: string;
  walletAddress: string;
  strategyPermissions: StrategyCategory[];
  budget: {
    allocatedUsd: number;
    availableUsd: number;
    reservedGasSol: number;
    currentGasBalanceSol: number;
  };
  riskProfile: RiskProfile;
  supportedNetworks: string[];
  minExpectedReturnBps: number; // e.g. 150 = 1.5%
  gasReserveRequirementSol: number; // e.g. 0.05 SOL
  dailyLossLimitUsd: number;
  dailyLossCurrentUsd: number;
  exposureLimits: {
    maxPerStrategyUsd: number;
    maxAssetConcentrationPercent: number;
  };
  performanceHistory: {
    totalEvaluations: number;
    totalTasksExecuted: number;
    successfulExecutions: number;
    verifiedRevenueUsd: number;
    realizedPnlUsd: number;
    winRate: number;
  };
  status: AgentStatus;
  heartbeat: number;
  lastDecision?: DecisionRecord;
}

export interface StrategySignal {
  id: string;
  sourceAgentId: string;
  timestamp: number;
  strategyId: string;
  category: StrategyCategory;
  assetPair?: string;
  signalConfidence: number; // 0 - 1.0
  expectedValueUsd: number;
  gasCostEstimateSol: number;
  evidenceSignature?: string;
  metadata: Record<string, any>;
  evaluations: Record<string, {
    evaluatedAt: number;
    agentId: string;
    accepted: boolean;
    rejectionReason?: string;
  }>;
}

export interface Opportunity {
  id: string;
  title: string;
  category: StrategyCategory;
  tierRequirement: ExecutionTier;
  capitalRequiredUsd: number;
  gasRequiredSol: number;
  rawExpectedValueUsd: number;
  networkFeesUsd: number;
  tradingFeesUsd: number;
  slippageUsd: number;
  riskCostUsd: number;
  capitalCostUsd: number;
  netEvUsd: number; // calculated: expected_value - network_fees - trading_fees - slippage - risk_cost - capital_cost
  confidenceScore: number; // 0 - 100
  isZeroCapital: boolean;
  requiresGas: boolean;
  authoritativeSource: string;
  status: 'ACTIVE' | 'CLAIMED' | 'EXPIRED' | 'BLOCKED_BY_CAPITAL';
  createdAt: number;
  expiresAt: number;
  description: string;
}

export interface TaskQueueItem {
  id: string;
  idempotencyKey: string;
  agentId: string;
  opportunityId: string;
  strategyCategory: StrategyCategory;
  status: 'PENDING' | 'LEASED' | 'EXECUTING' | 'VERIFYING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';
  leaseExpiry: number;
  retryCount: number;
  maxRetries: number;
  payload: Record<string, any>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RevenueLedgerEntry {
  id: string;
  allocationId: string;
  timestamp: number;
  source: 'ON_CHAIN_TX' | 'WEBHOOK_BILLING' | 'API_SUBSCRIPTION' | 'RESEARCH_REPORT';
  authoritativeEvidence: {
    transactionSignature?: string;
    webhookEventId?: string;
    recipientAddress: string;
    senderAddress: string;
    assetMint: string;
    amount: string; // precise string representation
    amountUsd: number;
    network: string;
    slotConfirmed?: number;
    verifiedAt: number;
  };
  state: VerificationState; // strictly VERIFIED only if authoritative signature/webhook confirms
  pnlCategory: 'REVENUE' | 'YIELD' | 'SERVICE_FEE' | 'WITHDRAWAL';
  allocatedCapitalUsd: number;
  realizedPnlUsd: number;
  verificationEvidenceUrl?: string;
}

export interface CapitalBuckets {
  treasuryReserveUsd: number;     // 20%
  operatingBudgetUsd: number;     // 20%
  growthReinvestmentUsd: number;  // 20%
  strategyCapitalUsd: number;     // 30%
  networkAndGasFeesUsd: number;   // 5%
  userCustomerFundsUsd: number;   // 5%
  totalVerifiedCapitalUsd: number;
}

export interface SquadsProposal {
  id: string;
  agentId: string;
  targetAddress: string;
  amountSol: number;
  amountUsd: number;
  budgetType: keyof CapitalBuckets;
  riskCheckNotes: string;
  policyApproved: boolean;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
  requiredSignatures: number;
  currentSignatures: number;
  squadsVaultAddress: string;
  transactionHash?: string;
  createdAt: number;
}

export interface ProviderHealth {
  id: 'quicknode' | 'alchemy' | 'helius';
  name: string;
  url: string;
  isActive: boolean;
  isHealthy: boolean;
  latencyMs: number;
  errorRatePercent: number;
  lastChecked: number;
  supportedFeatures: string[];
}

export interface TransactionAuditRecord {
  id: string;
  txHash?: string;
  agentId: string;
  stage: TxLifecycleState;
  blockhashUsed?: string;
  simulationSuccess?: boolean;
  simulatedUnitsConsumed?: number;
  riskChecksPassed: boolean;
  authorizationRequired: boolean;
  authorizedBy?: string;
  submittedAt?: number;
  confirmedAt?: number;
  finalizedAt?: number;
  status: 'SUCCESS' | 'RECONCILIATION_REQUIRED' | 'FAILED' | 'PENDING';
  errorDetails?: string;
  payload?: {
    targetRecipient?: string;
    amountLamports?: number;
    strategyCategory?: string;
    [key: string]: any;
  };
}

export interface CurrentPredicament {
  currentTier: ExecutionTier;
  availableCapitalUsd: number;
  verifiedRevenueUsd: number;
  unrealizedEstimatedUsd: number;
  activeGasBalanceSol: number;
  gasReserveShortfallSol: number;
  zeroCapitalModeActive: boolean;
  blockers: string[];
  eligibleCategories: StrategyCategory[];
  nextMilestoneTier: ExecutionTier;
  capitalNeededForNextTierUsd: number;
  recommendations: string[];
}

export interface AuditLog {
  id: string;
  timestamp: number;
  actor: string;
  actorId?: string;
  action: string;
  resourceId: string;
  details: Record<string, any>;
  payload?: Record<string, any>;
  previousHash?: string;
  ipAddress?: string;
  hash: string;
}

export interface SystemSecurityState {
  emergencyStopEngaged: boolean;
  emergencyStopReason?: string;
  emergencyStopTimestamp?: number;
  totalGlobalExposureUsd: number;
  globalMaxExposureLimitUsd: number;
  correlationDetectionScore: number; // 0 - 1.0 (anti-wash trading)
  activeRpcProvider: string;
  corsOriginPolicy: string;
}

export type TransactionStage = TxLifecycleState;
export type RpcProviderHealth = ProviderHealth;

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  actorId: string;
  actor?: string;
  action: string;
  previousHash: string;
  hash: string;
  payload: Record<string, any>;
  details?: Record<string, any>;
  resourceId?: string;
}

export interface TransactionStateRecord {
  id: string;
  stage: TxLifecycleState;
  status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'RECONCILIATION_REQUIRED' | 'SUCCESS';
  agentId: string;
  payload?: {
    targetRecipient?: string;
    amountLamports?: number;
    strategyCategory?: string;
    maxSlippageBps?: number;
    priorityFeeMicroLamports?: number;
    [key: string]: any;
  };
  history?: Array<{ stage: TxLifecycleState; timestamp: number; note?: string }>;
  errorDetails?: string;
  signature?: string;
}

export interface AutopilotExecutionRecord {
  id: string;
  timestamp: number;
  cycleNumber: number;
  opportunityId: string;
  opportunityTitle: string;
  category: StrategyCategory;
  agentId: string;
  agentName: string;
  agentWallet: string;
  grossRevenueUsd: number;
  costUsd: number;
  netProfitUsd: number;
  evidenceSignature: string;
  solscanUrl: string;
  allocationId: string;
  lifecycleStages: string[];
  capitalAllocated: {
    treasuryUsd: number;
    operatingUsd: number;
    growthUsd: number;
    strategyUsd: number;
    gasFeesUsd: number;
    userFundsUsd: number;
  };
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  reason?: string;
}

export interface AutopilotStatus {
  isActive: boolean;
  isExecuting: boolean;
  cycleIntervalMs: number;
  totalCyclesExecuted: number;
  totalProfitGeneratedUsd: number;
  consecutiveSuccessfulCycles: number;
  lastExecution?: AutopilotExecutionRecord;
  recentExecutions: AutopilotExecutionRecord[];
}

export interface MarketPriceInfo {
  solPriceUsd: number;
  source: 'binance' | 'coingecko' | 'cache' | 'fallback';
  timestamp: number;
  change24h?: number;
}

export interface WalletOnChainBalance {
  address: string;
  balanceSol: number;
  balanceUsd: number;
  solPriceUsd: number;
  cluster: 'mainnet-beta' | 'devnet';
}

export interface TreasuryWithdrawalRecord {
  id: string;
  timestamp: number;
  recipientAddress: string;
  amountUsd: number;
  amountAsset: number;
  asset: 'SOL' | 'USDC';
  sourceBucket: keyof CapitalBuckets;
  transactionSignature: string;
  solscanUrl: string;
  accountUrl?: string;
  status: 'CONFIRMED' | 'SUBMITTED' | 'FAILED';
  networkFeeUsd: number;
  authorizedBy: string;
  squadsVaultAddress?: string;
  note?: string;
  onChainVerified?: boolean;
  slot?: number;
  cluster?: 'mainnet-beta' | 'devnet';
  source?: string;
  disbursementMode?: 'REAL_ON_CHAIN' | 'SIMULATION_LEDGER';
}

export interface TreasurySignerInfo {
  hasKeypair: boolean;
  publicKey: string;
  balanceSol: number;
  balanceUsd: number;
  solPriceUsd: number;
  mode: 'REAL_ON_CHAIN' | 'SIMULATION_LEDGER';
  explanation: string;
  cluster: string;
  solscanUrl: string;
  isGasFunded: boolean;
  minFundingForLiveGas: number;
  signerType: 'SERVER_SIDE_AA_KEYPAIR';
}

export interface ProfitSweepStatus {
  targetWallet: string;
  profitPercent: number;
  intervalMinutes: number;
  nextSweepAt: number;
  lastSweepAt?: number;
  totalSweptUsd: number;
  totalSweptSol: number;
  sweepsCount: number;
  isAutoSweepActive: boolean;
  recentSweeps: TreasuryWithdrawalRecord[];
  executionMode?: 'REAL_ON_CHAIN' | 'SIMULATION_LEDGER';
  hasTreasuryKeypair?: boolean;
  treasurySignerPublicKey?: string | null;
  treasurySignerBalanceSol?: number | null;
  modeExplanation?: string;
  treasurySigner?: TreasurySignerInfo;
}

