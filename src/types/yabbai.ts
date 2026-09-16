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
  strategyId?: string;
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

export interface FormalAccountingLedger {
  initialCapitalUsd: number;
  operatingCapitalUsd: number;
  reserveUsd: number;
  customerFundsUsd: number;
  realizedRevenueUsd: number;
  verifiedCostsUsd: number;
  realizedProfitUsd: number;
  unrealizedPnlUsd: number;
  unattributedInflowUsd: number;
  withdrawnProfitUsd: number;
  withdrawnCapitalUsd: number;
  pendingSweepUsd: number;
  withdrawableProfitUsd: number;
  totalBalanceUsd: number;
  lastReconciliationTimestamp: number;
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

export type TreasurySignerStatus = TreasurySignerInfo;

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
  isSweepBlocked?: boolean;
  blockedReason?: string;
  sweepableProfitUsd?: number;
  recentSweeps: TreasuryWithdrawalRecord[];
  executionMode?: 'REAL_ON_CHAIN' | 'SIMULATION_LEDGER';
  hasTreasuryKeypair?: boolean;
  treasurySignerPublicKey?: string | null;
  treasurySignerBalanceSol?: number | null;
  modeExplanation?: string;
  treasurySigner?: TreasurySignerInfo;
}

// ==========================================
// CANONICAL CRYPTO EXECUTION & SETTLEMENT TYPES
// ==========================================

export interface TreasuryConfig {
  address: string;
  network: 'mainnet-beta' | 'devnet' | 'simulation';
  enabled: boolean;
  allowed_assets: string[];
  daily_limit: number;
  per_transaction_limit: number;
  weekly_limit: number;
  created_at: number;
  updated_at: number;
  destinationAllowlist: string[];
  destinationBlocklist: string[];
  spendingTracker: {
    verifiedDailySpendUsd: number;
    verifiedWeeklySpendUsd: number;
    lastResetTimestamp: number;
  };
}

export type PhantomConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface PhantomWalletState {
  connected: boolean;
  status: PhantomConnectionStatus;
  address: string | null;
  network: 'mainnet-beta' | 'devnet' | 'simulation';
  balanceSol: number;
  balanceUsd: number;
  tokenBalances: Array<{ mint: string; symbol: string; amount: number; decimals: number }>;
  lastUpdated: number;
  error?: string | null;
}

export type TransactionIntentType = 
  | 'OUTBOUND_TRANSFER'
  | 'STRATEGY_ALLOCATION'
  | 'TREASURY_SWEEP'
  | 'PROFIT_DISTRIBUTION'
  | 'CUSTOMER_REFUND';

export type PolicyStatus = 
  | 'APPROVED'
  | 'BLOCKED'
  | 'REQUIRES_SIGNATURE'
  | 'REQUIRES_APPROVAL';

export type CanonicalTxStatus = 
  | 'PREPARED'
  | 'POLICY_APPROVED'
  | 'AWAITING_SIGNATURE'
  | 'SIGNED'
  | 'SUBMITTED'
  | 'CONFIRMING'
  | 'FINALIZED'
  | 'FAILED'
  | 'USER_REJECTED';

export interface TransactionIntent {
  id: string;
  type: TransactionIntentType;
  network: 'mainnet-beta' | 'devnet' | 'simulation';
  source_wallet: string;
  destination: string;
  asset: string;
  mint: string;
  amount: number;
  decimals: number;
  purpose: string;
  agent_id?: string;
  strategy_id?: string;
  business_id?: string;
  order_id?: string;
  policy_status: PolicyStatus;
  risk_status: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  transaction_status: CanonicalTxStatus;
  created_at: number;
  expires_at: number;
  rawTransactionBase64?: string;
  recentBlockhash?: string;
  txSignature?: string;
  solscanUrl?: string;
  feeLamports?: number;
  slotConfirmed?: number;
  blockTime?: number;
  error?: string;
  policyFailureReason?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  priceSol: number;
  priceUsd: number;
  asset: 'SOL' | 'USDC';
  mint: string;
  isLive: boolean;
  isTestProduct?: boolean;
  fulfillmentType: 'API_TOKEN' | 'SECURITY_REPORT' | 'ALPHA_TELEMETRY' | 'DATA_FEED';
}

export type OrderPaymentStatus = 
  | 'ORDER_CREATED'
  | 'PAYMENT_REQUEST_CREATED'
  | 'AWAITING_PAYMENT'
  | 'CHAIN_MONITORING'
  | 'TRANSACTION_DETECTED'
  | 'PAYMENT_VERIFYING'
  | 'PAYMENT_VERIFIED'
  | 'UNDERPAID'
  | 'WRONG_RECIPIENT'
  | 'WRONG_ASSET'
  | 'EXPIRED'
  | 'FULFILLMENT'
  | 'COMPLETED'
  | 'FAILED';

export interface CustomerOrder {
  order_id: string;
  customer_id: string;
  customer_wallet?: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  asset: string;
  mint: string;
  amountDue: number;
  amountDueUsd: number;
  amountPaid?: number;
  recipientTreasuryAddress: string;
  referenceKey: string;
  network: 'mainnet-beta' | 'devnet';
  status: OrderPaymentStatus;
  created_at: number;
  expires_at: number;
  transaction_signature?: string;
  evidence_id?: string;
  fulfillment?: {
    fulfilledAt: number;
    deliverableType: string;
    deliverableContent: string;
    accessKey?: string;
    solscanUrl?: string;
  };
  error_reason?: string;
}

export interface PaymentEvidence {
  id: string;
  order_id: string;
  transaction_signature: string;
  sender: string;
  recipient: string;
  asset: string;
  mint: string;
  amount: number;
  amountUsd: number;
  slot: number;
  block_time: number;
  verification_status: 'VERIFIED' | 'FAILED' | 'UNDERPAID' | 'WRONG_RECIPIENT' | 'WRONG_ASSET';
  verification_method: 'ON_CHAIN_TRANSACTION_QUERY';
  raw_reference: string;
  verified_at: number;
  solscanUrl: string;
  network: 'mainnet-beta' | 'devnet';
}

export interface TreasuryReconciliationReport {
  id: string;
  timestamp: number;
  network: string;
  onChainBalanceSol: number;
  onChainBalanceUsd: number;
  ledgerBalanceUsd: number;
  discrepancyUsd: number;
  totalVerifiedInboundOrders: number;
  totalVerifiedInboundRevenueUsd: number;
  totalOutboundDisbursementsUsd: number;
  unmatchedInboundCount: number;
  unmatchedInboundSignatures: string[];
  unmatchedOutboundCount: number;
  reconciliationStatus: 'BALANCED' | 'RECONCILIATION_REQUIRED';
  alerts: string[];
}


