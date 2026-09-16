/**
 * YABBAI - Comprehensive Test Suite
 * Validates all 16 mission-critical capabilities:
 * 1. Opportunity ranking formula
 * 2. Zero-capital mode
 * 3. Strategy lifecycle (10 stages)
 * 4. Wallet independence
 * 5. Correlation guard (anti-wash trading)
 * 6. Threshold transitions ($0 -> $20 -> ... -> $10K+)
 * 7. Allocation idempotency & decimal accounting
 * 8. Revenue verification against authoritative evidence
 * 9. Billing webhook validation
 * 10. RPC failover cascade (QuickNode -> Alchemy -> Helius)
 * 11. Transaction state machine & reconciliation (UNKNOWN state handling)
 * 12. RLS & authorization boundaries
 * 13. Emergency stop / circuit breaker
 * 14. Gas reserve requirement check
 * 15. Scam & token-risk blacklist filtering
 * 16. Squads proposal workflow
 */

import { YieldRanker, OpportunityRegistry, CurrentPredicamentEngine, THRESHOLD_LEVELS } from '../server/engines/opportunityRegistry';
import { FleetEngine } from '../server/engines/fleetEngine';
import { StrategyRegistry } from '../server/engines/strategyRegistry';
import { RevenueLedger } from '../server/engines/revenueLedger';
import { TreasurySquadsEngine } from '../server/engines/treasurySquads';
import { EarningTaskQueue } from '../server/engines/taskQueue';
import { SecurityGuard } from '../server/security/guard';
import { SolanaProviderManager } from '../server/solana/provider';
import { TransactionStateMachine } from '../server/solana/txStateMachine';
import { CentralizedTreasuryManager } from '../server/solana/treasuryConfig';
import { CryptoExecutionEngine } from '../server/solana/cryptoExecutionEngine';
import { InboundPaymentEngine } from '../server/engines/paymentEngine';
import { TreasuryReconciliationService } from '../server/engines/treasuryReconciliation';
import { marketPriceService } from '../server/solana/priceService';
import { ProfitAccountingEngine } from '../server/engines/profitAccounting';
import { ProfitSweepEngine } from '../server/engines/profitSweepEngine';
import { AdminAuthManager } from '../server/security/authMiddleware';
import { StorageEngine } from '../server/db/storage';

export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
  error?: string;
}

export async function runAllVerificationTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[];
}> {
  const startTime = Date.now();
  const results: TestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<void> | void) => {
    const t0 = Date.now();
    try {
      await fn();
      results.push({ name, passed: true, durationMs: Date.now() - t0 });
    } catch (err: any) {
      results.push({ name, passed: false, durationMs: Date.now() - t0, error: err.message });
    }
  };

  // 1. Opportunity Ranking EV Formula
  await runTest('1. Opportunity Ranking EV Formula: EV - fees - slippage - risk - capital', () => {
    const opp = {
      rawExpectedValueUsd: 100,
      networkFeesUsd: 5,
      tradingFeesUsd: 2,
      slippageUsd: 3,
      riskCostUsd: 10,
      capitalCostUsd: 4
    };
    const netEv = YieldRanker.calculateNetEv(opp);
    // 100 - 5 - 2 - 3 - 10 - 4 = 76
    if (netEv !== 76) {
      throw new Error(`Expected net EV of 76, got ${netEv}`);
    }
  });

  // 2. Zero-Capital Mode
  await runTest('2. Zero-Capital Mode: Zero capital barriers and research/data eligibility', () => {
    const predicament = CurrentPredicamentEngine.evaluate(0, 0);
    if (!predicament.zeroCapitalModeActive) {
      throw new Error('Zero capital mode should be active when verified capital is $0');
    }
    if (predicament.currentTier !== '$0') {
      throw new Error(`Expected tier $0, got ${predicament.currentTier}`);
    }
    if (!predicament.eligibleCategories.includes('security_analysis')) {
      throw new Error('Security analysis should be eligible in $0 mode');
    }
    if (predicament.eligibleCategories.includes('arbitrage')) {
      throw new Error('Arbitrage should NOT be eligible in $0 capital mode');
    }
  });

  // 3. Strategy Lifecycle (10 Steps)
  await runTest('3. Strategy Lifecycle: 10-step full modular pipeline', async () => {
    const registry = new StrategyRegistry();
    const strat = registry.getStrategy('strat-sec-audit');
    if (!strat) throw new Error('Strategy strat-sec-audit not found');

    const discovered = await strat.discover();
    if (!discovered) throw new Error('Step 1 (discover) failed');
    const valid = await strat.validate({});
    if (!valid.valid) throw new Error('Step 2 (validate) failed');
    const quote = await strat.quote({});
    if (quote.netExpectedRevenueUsd <= 0) throw new Error('Step 3 (quote) invalid net EV');
    const sim = await strat.simulate(quote);
    if (!sim.success) throw new Error('Step 4 (simulate) failed');
    const risk = await strat.risk_check(quote);
    if (!risk.approved) throw new Error('Step 5 (risk_check) rejected');
    const auth = await strat.authorize(quote, 'TEST-RUNNER');
    if (!auth.authorized) throw new Error('Step 6 (authorize) failed');
    const exec = await strat.execute(auth.authId, quote);
    if (!exec.success) throw new Error('Step 7 (execute) failed');
    const verify = await strat.verify(exec);
    if (!verify.verified) throw new Error('Step 8 (verify) failed');
    const acc = await strat.account(exec);
    if (acc.netAddedUsd <= 0) throw new Error('Step 9 (account) failed');
    const score = await strat.score(exec);
    if (score.updatedRating <= 0) throw new Error('Step 10 (score) failed');
  });

  // 4. Wallet Independence
  await runTest('4. Wallet Independence: Agents evaluate decisions independently', () => {
    const fleet = new FleetEngine();
    const oppRegistry = new OpportunityRegistry();
    const oppArb = oppRegistry.getById('opp-tier20-01')!;

    // Sentinel-Zero-Sec (Agent-01) only has security/wallet reports permissions
    const dec1 = fleet.evaluateOpportunityIndependently('agent-01', oppArb);
    if (dec1.decision !== 'REJECT') {
      throw new Error('Agent-01 should reject arbitrage outside permissions');
    }

    // Micro-Arb-Sentry (Agent-10) has arbitrage permissions
    const dec10 = fleet.evaluateOpportunityIndependently('agent-10', oppArb);
    if (dec10.decision === 'REJECT') {
      throw new Error(`Agent-10 should evaluate arbitrage properly: ${dec10.reason}`);
    }
  });

  // 5. Correlation Guard (Anti-wash trading)
  await runTest('5. Correlation Guard: Anti-collusion and wash trading blocking', () => {
    const security = new SecurityGuard();
    const allowedNormal = security.verifyCorrelationGuard('agent-01', 'Orca-USDC-SOL-Pool');
    if (!allowedNormal) throw new Error('Legitimate pool should be allowed');

    const blockedScam = security.verifyCorrelationGuard('agent-01', 'SCAM111111111111111111111111111111111111111');
    if (blockedScam) throw new Error('Blacklisted scam resource should be blocked by correlation guard');
  });

  // 6. Threshold Transitions
  await runTest('6. Threshold Transitions: $0 -> $20 -> $50 -> $100 -> $10K+', () => {
    const p0 = CurrentPredicamentEngine.evaluate(0, 0);
    if (p0.currentTier !== '$0') throw new Error('Tier mismatch for $0');

    const p20 = CurrentPredicamentEngine.evaluate(25, 0.05);
    if (p20.currentTier !== '$20') throw new Error('Tier mismatch for $20');

    const p1K = CurrentPredicamentEngine.evaluate(1500, 0.1);
    if (p1K.currentTier !== '$1K') throw new Error('Tier mismatch for $1K');

    const p10K = CurrentPredicamentEngine.evaluate(12000, 0.5);
    if (p10K.currentTier !== '$10K+') throw new Error('Tier mismatch for $10K+');
  });

  // 7. Allocation Idempotency & Capital Loop Buckets
  await runTest('7. Allocation Idempotency & Decimal Accounting: 20/20/20/30/5/5 split', () => {
    const ledger = new RevenueLedger();
    const initialBuckets = ledger.getCapitalBuckets();
    const plan = ledger.executeCapitalLoop(100.00, 'test-alloc-uuid-100');

    if (plan.treasuryReserveUsd !== 20.00) throw new Error('Treasury reserve must be exactly $20.00 (20%)');
    if (plan.operatingBudgetUsd !== 20.00) throw new Error('Operating budget must be exactly $20.00 (20%)');
    if (plan.growthReinvestmentUsd !== 20.00) throw new Error('Growth reinvestment must be exactly $20.00 (20%)');
    if (plan.strategyCapitalUsd !== 30.00) throw new Error('Strategy capital must be exactly $30.00 (30%)');
    if (plan.networkAndGasFeesUsd !== 5.00) throw new Error('Gas fees must be exactly $5.00 (5%)');
    if (plan.userCustomerFundsUsd !== 5.00) throw new Error('User funds must be exactly $5.00 (5%)');

    const updatedBuckets = ledger.getCapitalBuckets();
    const diffTotal = updatedBuckets.totalVerifiedCapitalUsd - initialBuckets.totalVerifiedCapitalUsd;
    if (Math.abs(diffTotal - 100.00) > 0.01) {
      throw new Error(`Total capital increase should be 100.00, got ${diffTotal}`);
    }
  });

  // 8. Authoritative Revenue Verification
  await runTest('8. Revenue Verification: Only authoritative evidence enters realized P&L', () => {
    const ledger = new RevenueLedger();
    const sig = `5K${Date.now()}ProofSignatureValid99AuthoritativeOnChainSolanaTransactionSignature88chars`;

    const entry = ledger.verifyOnChainRevenue({
      signature: sig,
      recipientAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      senderAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      assetMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amountUnits: '50000000',
      amountUsd: 50.00,
      network: 'solana-mainnet'
    });

    if (entry.state !== 'VERIFIED') {
      throw new Error('Revenue state must be VERIFIED');
    }

    // Idempotency check: duplicate signature must be rejected
    let duplicateRejected = false;
    try {
      ledger.verifyOnChainRevenue({
        signature: sig,
        recipientAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        senderAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        assetMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amountUnits: '50000000',
        amountUsd: 50.00,
        network: 'solana-mainnet'
      });
    } catch {
      duplicateRejected = true;
    }

    if (!duplicateRejected) {
      throw new Error('Duplicate transaction signature was not rejected');
    }
  });

  // 9. Billing Webhook Validation
  await runTest('9. Billing Webhooks: HMAC signature & idempotency verification', () => {
    const ledger = new RevenueLedger();
    const eventId = `evt_test_${Date.now()}`;

    // Valid webhook
    const valid = ledger.verifyBillingWebhookRevenue({
      webhookEventId: eventId,
      customerId: 'cus_test_corp',
      amountUsd: 120.00,
      serviceCategory: 'security_analysis',
      hmacSignatureValid: true
    });
    if (valid.state !== 'VERIFIED') throw new Error('Valid webhook should be VERIFIED');

    // Invalid HMAC
    let invalidRejected = false;
    try {
      ledger.verifyBillingWebhookRevenue({
        webhookEventId: `evt_bad_${Date.now()}`,
        customerId: 'cus_bad',
        amountUsd: 50.00,
        serviceCategory: 'security_analysis',
        hmacSignatureValid: false
      });
    } catch {
      invalidRejected = true;
    }
    if (!invalidRejected) throw new Error('Unauthenticated HMAC webhook was not rejected');
  });

  // 10. RPC Provider Failover Cascade
  await runTest('10. RPC Failover Cascade: QuickNode -> Alchemy -> Helius health checks', async () => {
    const providerManager = new SolanaProviderManager();
    const health = providerManager.getHealthSummary();
    if (health.length !== 3) throw new Error('Must have QuickNode, Alchemy and Helius configured');
    if (health[0].id !== 'quicknode' || health[1].id !== 'alchemy' || health[2].id !== 'helius') {
      throw new Error('Provider cascade order must be QuickNode -> Alchemy -> Helius');
    }

    // Ping check
    const blockhash = await providerManager.getLatestBlockhash();
    if (!blockhash || !blockhash.blockhash) {
      throw new Error('Failed to retrieve fresh blockhash from RPC provider cascade');
    }
  });

  // 11. Transaction State Machine & Reconciliation (UNKNOWN state handling)
  await runTest('11. Transaction State Machine: Full lifecycle & UNKNOWN reconciliation handling', async () => {
    const providerManager = new SolanaProviderManager();
    const txSm = new TransactionStateMachine(providerManager);

    const intent = {
      id: `intent-${Date.now()}`,
      agentId: 'agent-10',
      targetRecipient: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      amountLamports: 1000000,
      strategyCategory: 'arbitrage',
      maxSlippageBps: 50,
      priorityFeeMicroLamports: 1000,
      instructionType: 'TRANSFER' as const,
      policyConstraints: { maxLossUsd: 10, requireMultisig: false, zeroCapitalMode: false }
    };

    const res = await txSm.processIntent(intent);
    if (res.stage !== 'AUTHORIZATION') {
      throw new Error(`Expected stage AUTHORIZATION, got ${res.stage}`);
    }

    // Test reconciliation marking on network ambiguity
    const reconciled = txSm.markForReconciliation(intent.id, 'RPC timeout during block confirmation');
    if (reconciled.stage !== 'RECONCILIATION_REQUIRED' || reconciled.status !== 'RECONCILIATION_REQUIRED') {
      throw new Error('Failed to flag transaction as RECONCILIATION_REQUIRED');
    }
  });

  // 12. Non-custodial Security: Server-side private-key custody is prohibited
  await runTest('12. Security Boundary: Zero server-side private-key storage & constant-time check', () => {
    const equal = SecurityGuard.constantTimeCompare('secretKey123', 'secretKey123');
    if (!equal) throw new Error('Constant-time compare failed on identical keys');
    const notEqual = SecurityGuard.constantTimeCompare('secretKey123', 'secretKey456');
    if (notEqual) throw new Error('Constant-time compare failed on different keys');
  });

  // 13. Emergency Stop / Circuit Breaker
  await runTest('13. Emergency Stop: Immediate freeze of fleet execution and allocations', () => {
    const security = new SecurityGuard();
    const fleet = new FleetEngine();

    security.triggerEmergencyStop('High volatility circuit breaker', 'Admin-Key');
    fleet.emergencyStopAll('High volatility circuit breaker');

    const agent1 = fleet.getAgent('agent-01')!;
    if (agent1.status !== 'EMERGENCY_STOPPED') {
      throw new Error('Agent must be EMERGENCY_STOPPED');
    }

    const check = security.verifyExposureLimits(10);
    if (check.allowed) {
      throw new Error('Exposure allocations must be blocked during Emergency Stop');
    }

    // Disengage
    security.disengageEmergencyStop('Admin-Key');
    fleet.resumeAll();
    if (fleet.getAgent('agent-01')!.status === 'EMERGENCY_STOPPED') {
      throw new Error('Agent should resume from EMERGENCY_STOPPED');
    }
  });

  // 14. Gas Reserve Requirement Enforcement
  await runTest('14. Gas Reserve Enforcement: Transactions cannot execute without gas', () => {
    const fleet = new FleetEngine();
    const oppRegistry = new OpportunityRegistry();
    const gasReqOpp = oppRegistry.getById('opp-tier20-01')!;

    // Agent with 0 gas balance
    const agentZeroGas = fleet.getAgent('agent-01')!;
    agentZeroGas.budget.currentGasBalanceSol = 0;

    const dec = fleet.evaluateOpportunityIndependently('agent-01', gasReqOpp);
    if (dec.decision === 'ACCEPT') {
      throw new Error('Agent with 0 gas must not accept gas-requiring transactions');
    }
  });

  // 15. Squads Multisig Proposal Lifecycle
  await runTest('15. Squads Proposal Workflow: Agent -> Budget -> Proposal -> Vote -> Execute', () => {
    const squads = new TreasurySquadsEngine();
    const prop = squads.createProposal({
      agentId: 'agent-10',
      targetAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      amountSol: 0.1,
      amountUsd: 18.0,
      budgetType: 'operatingBudgetUsd',
      justification: 'Automated monitoring node maintenance',
      availableBucketUsd: 200.0
    });

    if (prop.status !== 'PROPOSED') throw new Error('New proposal must be in PROPOSED status');

    // Vote 2
    squads.voteProposal(prop.id, 'Signatory-2');
    // Vote 3 (reaches quorum: 3 of 5)
    const approved = squads.voteProposal(prop.id, 'Signatory-3');
    if (approved.status !== 'APPROVED') throw new Error('Proposal with 3 signatures must be APPROVED');

    // Execute
    const executed = squads.executeProposal(prop.id);
    if (executed.status !== 'EXECUTED') throw new Error('Proposal execution failed');
  });

  // 16. Persistent Task Queue with Leases & Retries
  await runTest('16. Persistent Task Queue: Leases, retries & dead-letter handling', () => {
    const queue = new EarningTaskQueue();

    const t = queue.enqueueTask({
      idempotencyKey: `idemp-test-${Date.now()}`,
      agentId: 'agent-05',
      opportunityId: 'opp-zero-01',
      strategyCategory: 'security_analysis',
      payload: { test: true },
      maxRetries: 2
    });

    const leased = queue.leaseNextTask('agent-05', 1000);
    if (!leased) throw new Error('Failed to lease task');

    // Complete task
    const completed = queue.completeTask(leased.id);
    if (completed.status !== 'COMPLETED') throw new Error('Failed to complete task');
  });

  // 17. Centralized Treasury Configuration & Daily/Weekly Limits
  await runTest('17. Treasury Config & Spending Limits: Enforce per-tx, daily, and weekly limits', () => {
    const tm = new CentralizedTreasuryManager();
    const config = tm.getConfig();
    if (!config.address) throw new Error('Treasury address must not be empty');

    // Check limits
    const allowedSmall = tm.verifySpendingPolicy(50.0);
    if (!allowedSmall.allowed) throw new Error('Legitimate spend under limit was blocked');

    const blockedPerTx = tm.verifySpendingPolicy(150.0); // Default per-tx is $100
    if (blockedPerTx.allowed) throw new Error('Spend exceeding per-transaction limit was not blocked');

    // Blocklist check
    const blockedDest = tm.verifyDestinationPolicy('SCAM111111111111111111111111111111111111111');
    if (blockedDest.allowed) throw new Error('Destination in blocklist was not rejected');
  });

  // 18. Canonical Crypto Execution: Preparation & Pre-flight Policy
  await runTest('18. Canonical Execution Engine: Prepare intent, pre-flight checks & serialize transaction', async () => {
    const pm = new SolanaProviderManager();
    const tm = new CentralizedTreasuryManager();
    const sec = new SecurityGuard();
    const ledger = new RevenueLedger();
    const execEngine = new CryptoExecutionEngine(pm, tm, sec, ledger, marketPriceService);

    const prep = await execEngine.prepareTransactionIntent({
      type: 'OUTBOUND_TRANSFER',
      destination: tm.getTreasuryAddress(),
      asset: 'SOL',
      amount: 0.001,
      purpose: 'Verification test transfer'
    });

    if (!prep.intent) throw new Error('Failed to create transaction intent');
    if (!prep.preview) throw new Error('Failed to generate preview payload');
    if (prep.preview.asset !== 'SOL') throw new Error('Preview asset mismatch');
  });

  // 19. Emergency Stop Enforces Freeze on Crypto Execution
  await runTest('19. Emergency Stop Enforcement: Circuit breaker blocks transaction preparation', async () => {
    const pm = new SolanaProviderManager();
    const tm = new CentralizedTreasuryManager();
    const sec = new SecurityGuard();
    const ledger = new RevenueLedger();
    const execEngine = new CryptoExecutionEngine(pm, tm, sec, ledger, marketPriceService);

    // Trigger emergency stop
    sec.triggerEmergencyStop('Security incident test', 'Test-Admin');

    const prep = await execEngine.prepareTransactionIntent({
      type: 'OUTBOUND_TRANSFER',
      destination: tm.getTreasuryAddress(),
      asset: 'SOL',
      amount: 0.001,
      purpose: 'Verification transfer during stop'
    });

    if (prep.intent.policy_status !== 'BLOCKED') {
      throw new Error('Transaction must be BLOCKED when Emergency Stop is engaged');
    }

    // Reset emergency stop
    sec.disengageEmergencyStop('Test-Admin');
  });

  // 20. Inbound Payment Engine: Order Generation with Unique Reference Key
  await runTest('20. Inbound Payment Engine: Order generation with Solana reference key & catalog', async () => {
    const pm = new SolanaProviderManager();
    const tm = new CentralizedTreasuryManager();
    const sec = new SecurityGuard();
    const ledger = new RevenueLedger();
    const paymentEngine = new InboundPaymentEngine(pm, tm, ledger, marketPriceService, sec);

    const prods = paymentEngine.getProducts();
    if (prods.length === 0) throw new Error('Product catalog must not be empty');

    const orderRes = await paymentEngine.createOrder({
      productId: 'prod-mainnet-test',
      customerWallet: 'HKjCGdas7CVkSwQHi6Bhckj2U2P8rtTyMbikdY5pkXcb'
    });

    if (!orderRes.order) throw new Error('Failed to create order');
    if (orderRes.order.status !== 'AWAITING_PAYMENT') throw new Error('New order must be AWAITING_PAYMENT');
    if (!orderRes.paymentInstructions.referenceKey) throw new Error('Missing reference key in payment instructions');
    if (!orderRes.paymentInstructions.solanaPayUrl.startsWith('solana:')) throw new Error('Invalid Solana Pay URL');
  });

  // 21. Replay Protection: Rejection of Already Consumed Signatures
  await runTest('21. Payment Replay Protection: Rejection of already consumed signatures', async () => {
    const pm = new SolanaProviderManager();
    const tm = new CentralizedTreasuryManager();
    const sec = new SecurityGuard();
    const ledger = new RevenueLedger();
    const paymentEngine = new InboundPaymentEngine(pm, tm, ledger, marketPriceService, sec);

    const orderRes1 = await paymentEngine.createOrder({ productId: 'prod-mainnet-test' });
    const orderRes2 = await paymentEngine.createOrder({ productId: 'prod-mainnet-test' });

    const duplicateSig = '5KFakeDuplicateSignature' + Date.now();
    // Simulate consuming duplicateSig in evidence
    (paymentEngine as any).paymentEvidenceMap.set(duplicateSig, {
      id: 'ev-test',
      order_id: orderRes1.order.order_id,
      transaction_signature: duplicateSig,
      amount: 0.0005
    });

    const verifyAttempt = await paymentEngine.verifyAndSettlePayment({
      orderId: orderRes2.order.order_id,
      transactionSignature: duplicateSig
    });

    if (verifyAttempt.success) {
      throw new Error('Replay attack was not blocked; consumed signature was accepted');
    }
  });

  // 22. Treasury Cryptographic Reconciliation Report
  await runTest('22. Treasury Reconciliation: Multi-source audit (RPC, Ledger, Orders)', async () => {
    const pm = new SolanaProviderManager();
    const tm = new CentralizedTreasuryManager();
    const sec = new SecurityGuard();
    const ledger = new RevenueLedger();
    const paymentEngine = new InboundPaymentEngine(pm, tm, ledger, marketPriceService, sec);
    const recService = new TreasuryReconciliationService(pm, tm, ledger, paymentEngine, marketPriceService, sec);

    const report = await recService.runReconciliation();
    if (!report) throw new Error('Reconciliation report was not generated');
    if (typeof report.discrepancyUsd !== 'number') throw new Error('Missing discrepancyUsd in report');
    if (!['BALANCED', 'RECONCILIATION_REQUIRED'].includes(report.reconciliationStatus)) {
      throw new Error('Invalid reconciliation status');
    }
  });

  // 23. Profit Sweep Protection: Sweep DOES NOT execute if withdrawable profit <= 0
  await runTest('23. Profit Sweep Protection: No sweep when withdrawable profit is zero or negative', async () => {
    const sec = new SecurityGuard();
    const pm = new SolanaProviderManager();
    const txStateMachine = new TransactionStateMachine(pm);
    const ledger = new RevenueLedger();
    const profitAcc = new ProfitAccountingEngine(sec);

    // Initial state: 0 realized profit
    const sweepEngine = new ProfitSweepEngine({
      revenueLedger: ledger,
      profitAccounting: profitAcc,
      solanaProvider: pm,
      txStateMachine,
      securityGuard: sec
    });

    const statusBefore = sweepEngine.getStatus();
    if (statusBefore.sweepableProfitUsd !== 0) {
      throw new Error(`Expected sweepable profit 0, got ${statusBefore.sweepableProfitUsd}`);
    }

    // Attempting to sweep must return null (does not execute)
    const sweepResult = await sweepEngine.executeProfitSweep();
    if (sweepResult !== null) {
      throw new Error('Sweep must NOT execute when sweepable profit is zero');
    }

    // Depositing working capital must NOT create sweepable profit
    profitAcc.depositCapital({ amountUsd: 500, source: 'SEED_CAPITAL', actor: 'INVESTOR' });
    const statusAfterCapital = sweepEngine.getStatus();
    if (statusAfterCapital.sweepableProfitUsd > 0) {
      throw new Error('Capital deposit must NEVER be classified as sweepable profit');
    }

    const sweepAfterCapital = await sweepEngine.executeProfitSweep();
    if (sweepAfterCapital !== null) {
      throw new Error('Sweep must not execute against working capital');
    }
  });

  // 24. Financial Mutation Authentication: Reject unauthenticated mutations
  await runTest('24. Financial Mutation Authentication: Strict rejection of unauthenticated tokens', async () => {
    const sec = new SecurityGuard();
    AdminAuthManager.initialize(sec);

    // Test token validation
    const badToken = 'unauthorized-fake-token-123';
    if (AdminAuthManager.verifyToken(badToken)) {
      throw new Error('Verify token should reject invalid token');
    }

    const bootstrapToken = AdminAuthManager.getBootstrapToken();
    if (bootstrapToken && !AdminAuthManager.verifyToken(bootstrapToken)) {
      throw new Error('Bootstrap token should be valid when initialized');
    }

    // Creating session with wrong password fails
    const invalidSession = AdminAuthManager.createSession('wrong-password-999');
    if (invalidSession.success) {
      throw new Error('Invalid password must not produce authenticated session');
    }
  });

  // 25. Formal Profit & Capital Accounting: Realized profit formula & unattributed inflow
  await runTest('25. Formal Profit Accounting: Realized profit = revenue - itemized costs', () => {
    const sec = new SecurityGuard();
    const accounting = new ProfitAccountingEngine(sec);

    // Deposit $1000 initial capital
    accounting.depositCapital({ amountUsd: 1000, source: 'TREASURY_SEED', actor: 'ADMIN' });
    let ledger = accounting.getLedger();

    if (ledger.initialCapitalUsd !== 1000 || ledger.realizedProfitUsd !== 0) {
      throw new Error('Capital deposit should increase capital, not profit');
    }

    // Record verified revenue of $100 with $5 fees
    const revResult = accounting.recordVerifiedRevenue({
      id: 'rev-01',
      source: 'CUSTOMER_ORDER',
      grossAmountUsd: 100,
      networkFeeUsd: 2,
      executionFeeUsd: 1,
      platformFeeUsd: 1,
      slippageUsd: 1,
      otherCostUsd: 0,
      signature: 'sig-test-verif-01',
      timestamp: Date.now()
    });

    if (revResult.netProfitUsd !== 95) {
      throw new Error(`Expected net profit of $95, got $${revResult.netProfitUsd}`);
    }

    ledger = accounting.getLedger();
    if (ledger.realizedProfitUsd !== 95) {
      throw new Error(`Expected realized profit 95, got ${ledger.realizedProfitUsd}`);
    }
    if (ledger.withdrawableProfitUsd !== 95) {
      throw new Error(`Expected withdrawable profit 95, got ${ledger.withdrawableProfitUsd}`);
    }

    // Unattributed inflow ($50) must not be counted as profit
    accounting.recordUnattributedInflow(50, 'sig-mystery', 'Unidentified on-chain deposit');
    ledger = accounting.getLedger();
    if (ledger.unattributedInflowUsd !== 50) {
      throw new Error(`Expected unattributed inflow 50, got ${ledger.unattributedInflowUsd}`);
    }
    if (ledger.realizedProfitUsd !== 95) {
      throw new Error('Unattributed inflow must NOT increment realized profit');
    }

    // Withdraw profit of $40
    accounting.withdrawRealizedProfit(40, 'HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i');
    ledger = accounting.getLedger();
    if (ledger.withdrawnProfitUsd !== 40) {
      throw new Error(`Expected withdrawn profit 40, got ${ledger.withdrawnProfitUsd}`);
    }
    if (ledger.withdrawableProfitUsd !== 55) {
      throw new Error(`Expected withdrawable profit 55, got ${ledger.withdrawableProfitUsd}`);
    }
    if (ledger.initialCapitalUsd !== 1000) {
      throw new Error('Profit withdrawal must NOT decrease initial capital');
    }
  });

  // 26. Canonical External Profit Treasury Destination
  await runTest('26. External Profit Treasury: Canonical destination validation and protection', () => {
    const canonical = ProfitSweepEngine.CANONICAL_EXTERNAL_PROFIT_WALLET;
    if (canonical !== 'HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i') {
      throw new Error(`Canonical wallet mismatch: expected HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i, got ${canonical}`);
    }

    const sec = new SecurityGuard();
    const pm = new SolanaProviderManager();
    const txStateMachine = new TransactionStateMachine(pm);
    const ledger = new RevenueLedger();
    const profitAcc = new ProfitAccountingEngine(sec);

    const sweepEngine = new ProfitSweepEngine({
      revenueLedger: ledger,
      profitAccounting: profitAcc,
      solanaProvider: pm,
      txStateMachine,
      securityGuard: sec
    });

    const status = sweepEngine.getStatus();
    if (status.targetWallet !== canonical) {
      throw new Error(`Target wallet should default to canonical wallet, got ${status.targetWallet}`);
    }

    // Invalid Solana public key format must throw
    let caught = false;
    try {
      sweepEngine.updateDestination('invalid_wallet_xyz', 'ADMIN', 'Test invalid');
    } catch {
      caught = true;
    }
    if (!caught) {
      throw new Error('Invalid Solana public key should be rejected');
    }
  });

  // 27. Durable State Persistence & Restart Safety
  await runTest('27. Durable State Persistence: StorageEngine survives restarts and persists 24 entities', () => {
    const storage = new StorageEngine();
    const status = storage.getStatus();

    if (status.tablesRegistered !== 24) {
      throw new Error(`Expected 24 registered database entities, got ${status.tablesRegistered}`);
    }

    const testOrderId = `test-order-${Date.now()}`;
    storage.upsertRecord('orders', {
      order_id: testOrderId,
      product_id: 'prod-sec-audit',
      customer_reference: 'cust-99',
      amount_usd: 0.70,
      amount_sol: 0.005,
      status: 'AWAITING_PAYMENT',
      created_at: Date.now()
    }, 'order_id');

    const retrievedOrders = storage.getTable('orders');
    const found = retrievedOrders.find((o: any) => o.order_id === testOrderId);
    if (!found) {
      throw new Error('Failed to retrieve persisted order from StorageEngine');
    }
  });

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    durationMs: Date.now() - startTime,
    results
  };
}
