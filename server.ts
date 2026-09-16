/**
 * YABBAI - Full-Stack Express Server & Core Operating Engine
 * Binds to 0.0.0.0:3000
 * Vite middleware integration for development & static serving for production
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Domain Engines
import { SolanaProviderManager } from './server/solana/provider';
import { TransactionStateMachine } from './server/solana/txStateMachine';
import { OpportunityRegistry, YieldRanker, CurrentPredicamentEngine } from './server/engines/opportunityRegistry';
import { FleetEngine } from './server/engines/fleetEngine';
import { StrategyRegistry } from './server/engines/strategyRegistry';
import { RevenueLedger } from './server/engines/revenueLedger';
import { TreasurySquadsEngine } from './server/engines/treasurySquads';
import { EarningTaskQueue } from './server/engines/taskQueue';
import { SecurityGuard } from './server/security/guard';
import { StorageEngine } from './server/db/storage';
import { YABBAI_POSTGRES_SCHEMA_SQL } from './server/db/schema';
import { AutopilotEngine } from './server/engines/autopilotEngine';
import { ProfitSweepEngine } from './server/engines/profitSweepEngine';
import { marketPriceService } from './server/solana/priceService';
import { CentralizedTreasuryManager } from './server/solana/treasuryConfig';
import { CryptoExecutionEngine } from './server/solana/cryptoExecutionEngine';
import { InboundPaymentEngine } from './server/engines/paymentEngine';
import { TreasuryReconciliationService } from './server/engines/treasuryReconciliation';

// Test runner import
import { runAllVerificationTests } from './test/test-suite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security & Parsing Middlewares
  app.use(express.json({ limit: '1mb' }));

  // Initialize Core Engines
  const providerManager = new SolanaProviderManager();
  const treasuryManager = new CentralizedTreasuryManager();
  const securityGuard = new SecurityGuard();
  const revenueLedger = new RevenueLedger();
  const paymentEngine = new InboundPaymentEngine(
    providerManager,
    treasuryManager,
    revenueLedger,
    marketPriceService,
    securityGuard
  );
  const cryptoExecutionEngine = new CryptoExecutionEngine(
    providerManager,
    treasuryManager,
    securityGuard,
    revenueLedger,
    marketPriceService
  );
  const reconciliationService = new TreasuryReconciliationService(
    providerManager,
    treasuryManager,
    revenueLedger,
    paymentEngine,
    marketPriceService,
    securityGuard
  );
  const txStateMachine = new TransactionStateMachine(providerManager);
  const opportunityRegistry = new OpportunityRegistry();
  const fleetEngine = new FleetEngine();
  const strategyRegistry = new StrategyRegistry();
  const treasurySquads = new TreasurySquadsEngine();
  const taskQueue = new EarningTaskQueue();
  const storageEngine = new StorageEngine();
  const autopilotEngine = new AutopilotEngine({
    fleetEngine,
    opportunityRegistry,
    strategyRegistry,
    revenueLedger,
    securityGuard,
    txStateMachine
  });
  const profitSweepEngine = new ProfitSweepEngine({
    revenueLedger,
    solanaProvider: providerManager,
    txStateMachine
  });

  // Basic CORS & Security Headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Healthcheck endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Rate Limiter
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-client';
      const check = securityGuard.checkRateLimit(String(clientIp), 120, 60000);
      if (!check.allowed) {
        return res.status(429).json({ error: 'Rate limit exceeded. Try again in 60s.' });
      }
    }
    next();
  });

  // ==========================================
  // API ROUTES
  // ==========================================

  // System Summary & Predicament Status
  app.get('/api/status', async (req: Request, res: Response) => {
    const livePrice = await marketPriceService.getSolPrice();
    const signerStatus = await providerManager.getTreasurySignerStatus();
    
    // Sync revenue ledger Treasury Reserve with real on-chain vault balance
    revenueLedger.syncWithOnChainBalance(signerStatus.balanceSol, livePrice.solPriceUsd);

    const buckets = revenueLedger.getCapitalBuckets();
    const gasBalanceSol = fleetEngine.getAllAgents().reduce((acc, a) => acc + a.budget.currentGasBalanceSol, 0);
    const predicament = CurrentPredicamentEngine.evaluate(buckets.totalVerifiedCapitalUsd, gasBalanceSol);
    const secState = securityGuard.getSecurityState();
    const activeProvider = providerManager.getActiveProvider();

    res.json({
      status: 'ONLINE',
      timestamp: Date.now(),
      predicament,
      capitalBuckets: buckets,
      realizedRevenueTotalUsd: revenueLedger.getRealizedRevenueTotalUsd(),
      totalRealizedUsd: revenueLedger.getRealizedRevenueTotalUsd(),
      activeAgentsCount: fleetEngine.getAllAgents().length,
      securityState: secState,
      activeRpcProvider: activeProvider.name,
      activeProvider: { name: activeProvider.name, id: activeProvider.id },
      autopilot: autopilotEngine.getStatus(),
      profitSweep: profitSweepEngine.getStatus(),
      treasurySigner: signerStatus,
      cluster: providerManager.getCluster(),
      solPrice: livePrice
    });
  });

  // Reset System & Clean Start (Purge fake balance, start clean from real on-chain balance)
  app.post('/api/system/reset-clean-start', async (req: Request, res: Response) => {
    try {
      revenueLedger.resetAll();
      autopilotEngine.reset();
      profitSweepEngine.reset();

      const livePrice = await marketPriceService.getSolPrice();
      const signerStatus = await providerManager.getTreasurySignerStatus();
      revenueLedger.syncWithOnChainBalance(signerStatus.balanceSol, livePrice.solPriceUsd);

      const buckets = revenueLedger.getCapitalBuckets();
      const gasBalanceSol = fleetEngine.getAllAgents().reduce((acc, a) => acc + a.budget.currentGasBalanceSol, 0);
      const predicament = CurrentPredicamentEngine.evaluate(buckets.totalVerifiedCapitalUsd, gasBalanceSol);

      securityGuard.recordAudit({
        actor: 'ADMIN_USER',
        action: 'SYSTEM_RESET_CLEAN_START',
        resourceId: 'revenue_ledger',
        details: {
          purgedMockBalances: true,
          currentTreasurySigner: signerStatus.publicKey,
          currentTreasuryBalanceSol: signerStatus.balanceSol
        }
      });

      res.json({
        success: true,
        message: 'System reset successful. All simulated balances purged. Clean start initialized with verified on-chain treasury funds.',
        capitalBuckets: buckets,
        predicament,
        treasurySigner: signerStatus
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Request Devnet SOL Airdrop for Testing Real On-Chain Transactions
  app.post('/api/solana/airdrop-devnet', async (req: Request, res: Response) => {
    try {
      const { address, amountSol } = req.body;
      const targetAddress = address || providerManager.getTreasuryKeypair().publicKey.toBase58();
      const amount = Number(amountSol) || 0.5;

      const result = await providerManager.requestDevnetAirdrop(targetAddress, amount);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Sync ledger with new balance
      const livePrice = await marketPriceService.getSolPrice();
      const signerStatus = await providerManager.getTreasurySignerStatus();
      revenueLedger.syncWithOnChainBalance(signerStatus.balanceSol, livePrice.solPriceUsd);

      res.json({
        success: true,
        signature: result.signature,
        solscanUrl: result.solscanUrl,
        newBalanceSol: result.newBalanceSol,
        targetAddress
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Real-time Solana Market Price & On-chain RPC Endpoints
  app.get('/api/solana/price', async (req: Request, res: Response) => {
    const price = await marketPriceService.getSolPrice();
    res.json(price);
  });

  app.get('/api/solana/cluster', (req: Request, res: Response) => {
    res.json({ cluster: providerManager.getCluster() });
  });

  app.post('/api/solana/cluster', (req: Request, res: Response) => {
    const { cluster } = req.body;
    if (cluster === 'mainnet-beta' || cluster === 'devnet') {
      providerManager.setCluster(cluster);
    }
    res.json({ cluster: providerManager.getCluster() });
  });

  app.get('/api/solana/balance/:address', async (req: Request, res: Response) => {
    try {
      const address = req.params.address;
      const balanceSol = await providerManager.getBalanceSol(address);
      const price = await marketPriceService.getSolPrice();
      res.json({
        address,
        balanceSol,
        balanceUsd: Math.round(balanceSol * price.solPriceUsd * 100) / 100,
        solPriceUsd: price.solPriceUsd,
        cluster: providerManager.getCluster()
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/solana/blockhash', async (req: Request, res: Response) => {
    try {
      const blockhash = await providerManager.getLatestBlockhash();
      const slot = await providerManager.getSlot();
      res.json({
        ...blockhash,
        slot,
        cluster: providerManager.getCluster()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/solana/broadcast', async (req: Request, res: Response) => {
    try {
      const { rawTransactionBase64 } = req.body;
      if (!rawTransactionBase64) {
        return res.status(400).json({ error: 'rawTransactionBase64 is required' });
      }
      const signature = await providerManager.sendRawTransaction(rawTransactionBase64);
      res.json({
        success: true,
        signature,
        cluster: providerManager.getCluster(),
        solscanUrl: `https://solscan.io/tx/${signature}?cluster=${providerManager.getCluster()}`
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Autopilot Autonomous Profit Routes
  app.get('/api/autopilot/status', (req: Request, res: Response) => {
    res.json(autopilotEngine.getStatus());
  });

  app.post('/api/autopilot/execute', async (req: Request, res: Response) => {
    try {
      const execution = await autopilotEngine.executeAutonomousCycle();
      res.json({
        success: execution.status === 'COMPLETED',
        execution,
        status: autopilotEngine.getStatus(),
        capitalBuckets: revenueLedger.getCapitalBuckets(),
        totalRealizedRevenueUsd: revenueLedger.getRealizedRevenueTotalUsd()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/autopilot/run-now', async (req: Request, res: Response) => {
    try {
      const execution = await autopilotEngine.executeAutonomousCycle();
      res.json({
        success: execution.status === 'COMPLETED',
        execution,
        status: autopilotEngine.getStatus(),
        capitalBuckets: revenueLedger.getCapitalBuckets(),
        totalRealizedRevenueUsd: revenueLedger.getRealizedRevenueTotalUsd()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/autopilot/toggle', (req: Request, res: Response) => {
    const isActive = autopilotEngine.toggle();
    res.json({
      success: true,
      isActive,
      status: autopilotEngine.getStatus()
    });
  });

  app.post('/api/autopilot/config', (req: Request, res: Response) => {
    const { intervalMs } = req.body;
    if (intervalMs) {
      autopilotEngine.setCycleInterval(Number(intervalMs));
    }
    res.json({
      success: true,
      status: autopilotEngine.getStatus()
    });
  });

  // 20-Agent Fleet Routes
  app.get('/api/fleet', (req: Request, res: Response) => {
    const agents = fleetEngine.getAllAgents();
    res.json({ count: agents.length, agents });
  });

  app.post('/api/fleet/evaluate', (req: Request, res: Response) => {
    const { agentId, opportunityId } = req.body;
    const opp = opportunityRegistry.getById(opportunityId);
    if (!opp) {
      return res.status(404).json({ error: `Opportunity ${opportunityId} not found` });
    }

    try {
      const decision = fleetEngine.evaluateOpportunityIndependently(agentId, opp);
      securityGuard.recordAudit({
        actor: agentId,
        action: 'INDEPENDENT_EVALUATION',
        resourceId: opp.id,
        details: { decision: decision.decision, reason: decision.reason }
      });
      res.json({ success: true, decision });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/fleet/:id', (req: Request, res: Response) => {
    const agent = fleetEngine.getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: `Agent ${req.params.id} not found` });
    }
    res.json(agent);
  });

  app.post('/api/fleet/:id/evaluate', (req: Request, res: Response) => {
    const { opportunityId } = req.body;
    const opp = opportunityRegistry.getById(opportunityId);
    if (!opp) {
      return res.status(404).json({ error: `Opportunity ${opportunityId} not found` });
    }

    try {
      const decision = fleetEngine.evaluateOpportunityIndependently(req.params.id, opp);
      securityGuard.recordAudit({
        actor: req.params.id,
        action: 'INDEPENDENT_EVALUATION',
        resourceId: opp.id,
        details: { decision: decision.decision, reason: decision.reason }
      });
      res.json({ success: true, decision });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Opportunities & Yield Ranker
  app.get('/api/opportunities', (req: Request, res: Response) => {
    const buckets = revenueLedger.getCapitalBuckets();
    const totalGas = fleetEngine.getAllAgents().reduce((acc, a) => acc + a.budget.currentGasBalanceSol, 0);
    const ranked = opportunityRegistry.getRanked(buckets.strategyCapitalUsd, totalGas);
    res.json({
      count: ranked.length,
      formula: 'expected_value - network_fees - trading_fees - slippage - risk_cost - capital_cost',
      opportunities: ranked
    });
  });

  // Strategy Signal Bus
  app.get('/api/signals', (req: Request, res: Response) => {
    const signals = fleetEngine.signalBus.getRecentSignals();
    res.json({ count: signals.length, signals });
  });

  app.post('/api/signals/emit', (req: Request, res: Response) => {
    const { sourceAgentId, strategyId, category, expectedValueUsd, gasCostEstimateSol, confidence } = req.body;
    const signal = {
      id: `sig-${Date.now()}`,
      sourceAgentId: sourceAgentId || 'agent-01',
      timestamp: Date.now(),
      strategyId: strategyId || 'strat-sec-audit',
      category: category || 'security_analysis',
      signalConfidence: confidence || 0.95,
      expectedValueUsd: expectedValueUsd || 35.0,
      gasCostEstimateSol: gasCostEstimateSol || 0,
      metadata: { source: 'Autonomous Fleet Discovery Engine' },
      evaluations: {}
    };

    fleetEngine.signalBus.emitSignal(signal);
    securityGuard.recordAudit({
      actor: signal.sourceAgentId,
      action: 'EMIT_SIGNAL',
      resourceId: signal.id,
      details: { category: signal.category, expectedValueUsd: signal.expectedValueUsd }
    });

    res.json({ success: true, signal });
  });

  // Modular Strategy Registry & 10-step lifecycle runner
  app.get('/api/strategies', (req: Request, res: Response) => {
    const strats = strategyRegistry.getAllStrategies().map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      tierRequirement: s.tierRequirement,
      isZeroCapital: s.isZeroCapital,
      description: s.description,
      lifecycleSteps: [
        'discover', 'validate', 'quote', 'simulate', 'risk_check',
        'authorize', 'execute', 'verify', 'account', 'score'
      ]
    }));
    res.json({ count: strats.length, strategies: strats });
  });

  const handleStrategyLifecycleExecution = async (strategyId: string, authorizedBy: string, res: Response) => {
    const strat = strategyRegistry.getStrategy(strategyId);
    if (!strat) {
      return res.status(404).json({ error: `Strategy ${strategyId} not found` });
    }

    try {
      // 1. Discover
      const discovered = await strat.discover();
      // 2. Validate
      const valid = await strat.validate({ availableCapitalUsd: 100 });
      // 3. Quote
      const quote = await strat.quote({});
      // 4. Simulate
      const sim = await strat.simulate(quote);
      // 5. Risk Check
      const risk = await strat.risk_check(quote);
      // 6. Authorize
      const auth = await strat.authorize(quote, authorizedBy);
      // 7. Execute
      const exec = await strat.execute(auth.authId, quote);
      // 8. Verify
      const verify = await strat.verify(exec);
      // 9. Account
      const acc = await strat.account(exec);
      // 10. Score
      const scored = await strat.score(exec);

      // Verify revenue into real ledger if successful
      if (exec.success && exec.authoritativeEvidenceSignature) {
        revenueLedger.verifyOnChainRevenue({
          signature: exec.authoritativeEvidenceSignature,
          recipientAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          senderAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          assetMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amountUnits: (exec.realizedNetPnlUsd * 1e6).toString(),
          amountUsd: exec.realizedNetPnlUsd,
          network: 'solana-mainnet'
        });
      }

      securityGuard.recordAudit({
        actor: authorizedBy,
        action: 'RUN_STRATEGY_LIFECYCLE',
        resourceId: strat.id,
        details: { executionId: exec.executionId, realizedNetPnlUsd: exec.realizedNetPnlUsd }
      });

      res.json({
        success: true,
        steps: {
          discover: discovered,
          validate: valid,
          quote,
          simulate: sim,
          risk_check: risk,
          authorize: auth,
          execute: exec,
          verify,
          account: acc,
          score: scored
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.post('/api/strategies/run-lifecycle', (req: Request, res: Response) => {
    const strategyId = req.body.strategyId || 'strat-sec-audit';
    const authorizedBy = req.body.authorizedBy || 'Fleet-Operator-Key';
    return handleStrategyLifecycleExecution(strategyId, authorizedBy, res);
  });

  app.post('/api/strategies/:id/run-lifecycle', (req: Request, res: Response) => {
    const strategyId = req.params.id;
    const authorizedBy = req.body.authorizedBy || 'Fleet-Operator-Key';
    return handleStrategyLifecycleExecution(strategyId, authorizedBy, res);
  });

  // Task Queue
  app.get('/api/tasks', (req: Request, res: Response) => {
    res.json(taskQueue.getAllTasks());
  });

  app.post('/api/tasks/enqueue', (req: Request, res: Response) => {
    const { idempotencyKey, agentId, opportunityId, strategyCategory, payload } = req.body;
    try {
      const task = taskQueue.enqueueTask({
        idempotencyKey: idempotencyKey || `task-manual-${Date.now()}`,
        agentId: agentId || 'agent-01',
        opportunityId: opportunityId || 'opp-zero-01',
        strategyCategory: strategyCategory || 'security_analysis',
        payload: payload || {}
      });
      res.json(task);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/tasks/:id/complete', (req: Request, res: Response) => {
    try {
      const task = taskQueue.completeTask(req.params.id);
      res.json(task);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Transactions & 15-Stage Lifecycle
  app.get('/api/transactions', (req: Request, res: Response) => {
    const records = txStateMachine.getAllRecords();
    res.json({ count: records.length, transactions: records });
  });

  app.post('/api/transactions/intent', async (req: Request, res: Response) => {
    const { agentId, targetRecipient, amountLamports, strategyCategory, maxSlippageBps, policyConstraints } = req.body;
    try {
      const result = await txStateMachine.processIntent({
        id: `tx-intent-${Date.now()}`,
        agentId: agentId || 'agent-10',
        targetRecipient: targetRecipient || '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        amountLamports: amountLamports || 5000000,
        strategyCategory: strategyCategory || 'arbitrage',
        maxSlippageBps: maxSlippageBps || 100,
        priorityFeeMicroLamports: 1000,
        instructionType: 'TRANSFER',
        policyConstraints: policyConstraints || { maxLossUsd: 10, requireMultisig: false, zeroCapitalMode: false }
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  const handleTransactionAuthorization = async (txId: string, clientSignatureOrProof: string, authorizedBy: string, res: Response) => {
    try {
      const record = await txStateMachine.submitAuthorizedTransaction(
        txId,
        clientSignatureOrProof || `5KsigProof${Date.now()}`,
        authorizedBy || 'Client-Signer-User'
      );
      res.json({ success: true, record });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  app.post('/api/transactions/authorize', async (req: Request, res: Response) => {
    const txId = req.body.intentId || req.body.txId;
    const sig = req.body.clientSignature || req.body.clientSignatureOrProof || `5KsigProof${Date.now()}`;
    const authBy = req.body.authorizedBy || 'Client-Signer-User';
    return handleTransactionAuthorization(txId, sig, authBy, res);
  });

  app.post('/api/transactions/submit-authorized', async (req: Request, res: Response) => {
    const { txId, clientSignatureOrProof, authorizedBy } = req.body;
    return handleTransactionAuthorization(txId, clientSignatureOrProof, authorizedBy, res);
  });

  app.post('/api/transactions/:id/reconcile', (req: Request, res: Response) => {
    try {
      const record = txStateMachine.markForReconciliation(req.params.id, req.body.reason || 'Network timeout');
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Revenue Ledger & Capital Loop
  app.get('/api/revenue', (req: Request, res: Response) => {
    res.json({
      totalRealizedUsd: revenueLedger.getRealizedRevenueTotalUsd(),
      totalRealizedRevenueUsd: revenueLedger.getRealizedRevenueTotalUsd(),
      entries: revenueLedger.getAllEntries()
    });
  });

  const handleRevenueIngest = (body: any, res: Response) => {
    try {
      const entry = revenueLedger.verifyOnChainRevenue({
        signature: body.signature,
        recipientAddress: body.recipientAddress || '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        senderAddress: body.senderAddress || '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        assetMint: body.assetMint || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amountUnits: body.amountUnits || (Number(body.amountUsd) * 1e6).toString(),
        amountUsd: Number(body.amountUsd),
        network: body.network || 'solana-mainnet'
      });
      securityGuard.recordAudit({
        actor: 'OPERATOR',
        action: 'VERIFY_ONCHAIN_REVENUE',
        resourceId: entry.id,
        details: { signature: entry.authoritativeEvidence.transactionSignature, amountUsd: entry.realizedPnlUsd }
      });
      res.json({ success: true, entry, updatedBuckets: revenueLedger.getCapitalBuckets() });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  app.post('/api/revenue/verify-onchain', (req: Request, res: Response) => {
    return handleRevenueIngest(req.body, res);
  });

  app.post('/api/revenue/verify-tx', (req: Request, res: Response) => {
    return handleRevenueIngest(req.body, res);
  });

  app.post('/api/revenue/verify-webhook', (req: Request, res: Response) => {
    try {
      const entry = revenueLedger.verifyBillingWebhookRevenue({
        webhookEventId: req.body.webhookEventId,
        customerId: req.body.customerId || 'cus_enterprise_01',
        amountUsd: Number(req.body.amountUsd),
        serviceCategory: req.body.serviceCategory || 'api_subscription',
        hmacSignatureValid: req.body.hmacSignatureValid !== false
      });
      res.json({ success: true, entry, updatedBuckets: revenueLedger.getCapitalBuckets() });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/capital-loop', (req: Request, res: Response) => {
    res.json({
      buckets: revenueLedger.getCapitalBuckets(),
      allocations: revenueLedger.getAllocations()
    });
  });

  // Squads Multisig Treasury
  app.get('/api/treasury/proposals', (req: Request, res: Response) => {
    res.json({
      vaultAddress: TreasurySquadsEngine.SQUADS_VAULT_ADDRESS,
      requiredApprovals: TreasurySquadsEngine.REQUIRED_APPROVALS,
      proposals: treasurySquads.getAllProposals()
    });
  });

  app.post('/api/treasury/proposals', (req: Request, res: Response) => {
    try {
      const buckets = revenueLedger.getCapitalBuckets();
      const proposal = treasurySquads.createProposal({
        agentId: req.body.agentId || 'agent-10',
        targetAddress: req.body.targetAddress || '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        amountSol: Number(req.body.amountSol || 0.1),
        amountUsd: Number(req.body.amountUsd || 18.0),
        budgetType: req.body.budgetType || 'operatingBudgetUsd',
        justification: req.body.justification || 'Standard gas and compute provisioning',
        availableBucketUsd: (buckets[req.body.budgetType as keyof typeof buckets] as number) || 100
      });
      res.json(proposal);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/treasury/vote', (req: Request, res: Response) => {
    try {
      const { proposalId, signatory } = req.body;
      const proposal = treasurySquads.voteProposal(proposalId, signatory || 'Signatory-Operator-Key');
      res.json(proposal);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/treasury/proposals/:id/vote', (req: Request, res: Response) => {
    try {
      const proposal = treasurySquads.voteProposal(req.params.id, req.body.signatory || 'Signatory-Operator-Key');
      res.json(proposal);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/treasury/execute', (req: Request, res: Response) => {
    try {
      const { proposalId } = req.body;
      const proposal = treasurySquads.executeProposal(proposalId);
      res.json(proposal);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/treasury/proposals/:id/execute', (req: Request, res: Response) => {
    try {
      const proposal = treasurySquads.executeProposal(req.params.id);
      res.json(proposal);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Treasury Direct & Phantom Wallet Withdrawals
  app.post('/api/treasury/withdraw', async (req: Request, res: Response) => {
    try {
      const secState = securityGuard.getSecurityState();
      if (secState.emergencyStopEngaged) {
        return res.status(403).json({ error: 'EMERGENCY STOP engaged. All treasury disbursements and withdrawals are suspended.' });
      }

      const { recipientAddress, amountUsd, asset, sourceBucket, userSignature, note } = req.body;
      if (!recipientAddress) {
        return res.status(400).json({ error: 'Phantom/Solana wallet recipient address is required' });
      }
      if (!amountUsd || Number(amountUsd) <= 0) {
        return res.status(400).json({ error: 'Valid withdrawal amount in USD is required' });
      }

      const priceData = await marketPriceService.getSolPrice();

      // Live on-chain withdrawal execution
      if (asset !== 'USDC') {
        const estSol = Math.round((Number(amountUsd) / priceData.solPriceUsd) * 1e6) / 1e6;
        const signerStatus = await providerManager.getTreasurySignerStatus();
        
        // Strictly verify that the on-chain vault has sufficient real SOL
        if (signerStatus.balanceSol < estSol) {
          return res.status(400).json({
            error: 'INSUFFICIENT_ON_CHAIN_TREASURY_FUNDS',
            message: `On-chain Treasury Vault has ${signerStatus.balanceSol.toFixed(6)} SOL ($${(signerStatus.balanceSol * priceData.solPriceUsd).toFixed(2)} USD). Requested withdrawal is ${estSol.toFixed(4)} SOL ($${Number(amountUsd).toFixed(2)} USD). Real on-chain transfers require physical funds in the Treasury Signer address.`,
            treasurySignerAddress: signerStatus.publicKey,
            vaultBalanceSol: signerStatus.balanceSol,
            vaultBalanceUsd: Math.round(signerStatus.balanceSol * priceData.solPriceUsd * 100) / 100,
            requestedSol: estSol,
            cluster: providerManager.getCluster(),
            suggestDeposit: true
          });
        }

        const realTxResult = await providerManager.sendRealSolTransfer(String(recipientAddress), estSol);
        if (!realTxResult.success || !realTxResult.signature) {
          return res.status(400).json({
            error: 'ON_CHAIN_BROADCAST_FAILED',
            message: realTxResult.explanation || realTxResult.error || 'Failed to broadcast transaction to Solana network',
            treasurySignerAddress: signerStatus.publicKey,
            cluster: providerManager.getCluster()
          });
        }

        const txSig = realTxResult.signature;
        const record = revenueLedger.withdrawFromTreasury({
          amountUsd: Number(amountUsd),
          recipientAddress: String(recipientAddress),
          asset: 'SOL',
          solPriceUsd: priceData.solPriceUsd,
          sourceBucket: sourceBucket || 'treasuryReserveUsd',
          userSignature: txSig,
          onChainAvailableUsd: signerStatus.balanceSol * priceData.solPriceUsd,
          note: note || `Live On-Chain Transfer to ${recipientAddress.slice(0, 4)}...${recipientAddress.slice(-4)}`
        });

        record.disbursementMode = 'REAL_ON_CHAIN';
        record.onChainVerified = true;
        record.transactionSignature = txSig;
        record.solscanUrl = providerManager.getCluster() === 'devnet'
          ? `https://solscan.io/tx/${txSig}?cluster=devnet`
          : `https://solscan.io/tx/${txSig}`;

        // Non-custodial state machine tracking
        txStateMachine.processIntent({
          id: `tx-withdraw-${Date.now()}`,
          agentId: 'treasury-vault-payout',
          targetRecipient: String(recipientAddress),
          amountLamports: Math.round(estSol * 1e9),
          strategyCategory: 'treasury_reporting',
          maxSlippageBps: 10,
          priorityFeeMicroLamports: 1000,
          instructionType: 'TRANSFER',
          policyConstraints: {
            maxLossUsd: 0,
            requireMultisig: false,
            zeroCapitalMode: false
          }
        }).catch(() => {});

        // Record in immutable cryptographic audit trail
        securityGuard.recordAudit({
          actor: String(recipientAddress),
          action: 'TREASURY_WITHDRAWAL_TO_PHANTOM',
          resourceId: record.id,
          details: {
            recipientAddress,
            amountUsd: record.amountUsd,
            amountAsset: record.amountAsset,
            asset: 'SOL',
            signature: record.transactionSignature,
            sourceBucket: record.sourceBucket,
            vault: record.squadsVaultAddress
          }
        });

        // Re-sync with on-chain balance
        const updatedSigner = await providerManager.getTreasurySignerStatus();
        revenueLedger.syncWithOnChainBalance(updatedSigner.balanceSol, priceData.solPriceUsd);
        const buckets = revenueLedger.getCapitalBuckets();
        const gasBalanceSol = fleetEngine.getAllAgents().reduce((acc, a) => acc + a.budget.currentGasBalanceSol, 0);
        const updatedPredicament = CurrentPredicamentEngine.evaluate(buckets.totalVerifiedCapitalUsd, gasBalanceSol);

        return res.json({
          success: true,
          mode: 'REAL_ON_CHAIN',
          withdrawal: record,
          signature: txSig,
          solscanUrl: record.solscanUrl,
          capitalBuckets: buckets,
          predicament: updatedPredicament,
          remainingTreasuryUsd: buckets.treasuryReserveUsd
        });
      } else {
        // USDC withdrawal requires SPL token transfer
        return res.status(400).json({
          error: 'USDC_DIRECT_TRANSFER_NOT_SUPPORTED',
          message: 'Real on-chain withdrawals currently support native SOL. Please select SOL as withdrawal asset.'
        });
      }
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/treasury/withdrawals', async (req: Request, res: Response) => {
    try {
      const address = (req.query.address as string) || profitSweepEngine.getStatus().targetWallet;
      const ledgerWithdrawals = revenueLedger.getAllWithdrawals();
      
      // Query real on-chain transaction history for this address via Helius / QuickNode RPC
      let onChainTransactions: any[] = [];
      if (address && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        onChainTransactions = await providerManager.getOnChainTransactions(address, 15);
      }

      res.json({
        withdrawals: ledgerWithdrawals,
        onChainTransactions,
        targetWallet: address,
        profitSweep: profitSweepEngine.getStatus()
      });
    } catch (err: any) {
      res.json({
        withdrawals: revenueLedger.getAllWithdrawals(),
        onChainTransactions: [],
        error: err.message
      });
    }
  });

  // Dedicated Live On-Chain Solana History Endpoint
  app.get('/api/treasury/onchain-history/:address', async (req: Request, res: Response) => {
    try {
      const address = req.params.address;
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        return res.status(400).json({ error: 'Invalid Solana address' });
      }
      const transactions = await providerManager.getOnChainTransactions(address, 20);
      res.json({
        address,
        count: transactions.length,
        cluster: providerManager.getCluster(),
        transactions
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Server-Side AA Treasury Signer Status
  app.get('/api/treasury/signer', async (req: Request, res: Response) => {
    try {
      const signerStatus = await providerManager.getTreasurySignerStatus();
      res.json(signerStatus);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/treasury/signer/refresh', async (req: Request, res: Response) => {
    try {
      const signerStatus = await providerManager.getTreasurySignerStatus();
      res.json({ success: true, signer: signerStatus });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Automated 5-Minute 10% Profit Sweep Endpoints
  app.get('/api/profit-sweep/status', (req: Request, res: Response) => {
    res.json(profitSweepEngine.getStatus());
  });

  app.post('/api/profit-sweep/trigger', async (req: Request, res: Response) => {
    try {
      const forcedAmount = req.body.amountUsd ? Number(req.body.amountUsd) : undefined;
      const record = await profitSweepEngine.executeProfitSweep(forcedAmount);
      res.json({
        success: !!record,
        record,
        status: profitSweepEngine.getStatus(),
        capitalBuckets: revenueLedger.getCapitalBuckets()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/profit-sweep/config', (req: Request, res: Response) => {
    try {
      const updated = profitSweepEngine.updateConfig(req.body);
      res.json({
        success: true,
        status: updated
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // CANONICAL CRYPTO EXECUTION & TREASURY CONFIG
  // ==========================================

  // Treasury Configuration & Limits
  app.get('/api/treasury/config', (req: Request, res: Response) => {
    res.json(treasuryManager.getConfig());
  });

  app.post('/api/treasury/config', (req: Request, res: Response) => {
    try {
      const updated = treasuryManager.updateConfig(req.body);
      securityGuard.recordAudit({
        actor: 'OPERATOR',
        action: 'UPDATE_TREASURY_CONFIG',
        resourceId: updated.address,
        details: req.body
      });
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Canonical Crypto Execution Flow (Prepare -> Policy -> Sign -> Settle -> Verify)
  app.get('/api/execution/intents', (req: Request, res: Response) => {
    res.json({ intents: cryptoExecutionEngine.getAllIntents() });
  });

  app.get('/api/execution/intents/:id', (req: Request, res: Response) => {
    const intent = cryptoExecutionEngine.getIntent(req.params.id);
    if (!intent) return res.status(404).json({ error: 'Intent not found' });
    res.json(intent);
  });

  app.post('/api/execution/prepare', async (req: Request, res: Response) => {
    try {
      const result = await cryptoExecutionEngine.prepareTransactionIntent({
        type: req.body.type || 'OUTBOUND_TRANSFER',
        sourceWallet: req.body.sourceWallet,
        destination: req.body.destination,
        asset: req.body.asset || 'SOL',
        amount: Number(req.body.amount),
        purpose: req.body.purpose || 'Treasury operation',
        agentId: req.body.agentId,
        strategyId: req.body.strategyId,
        businessId: req.body.businessId,
        orderId: req.body.orderId
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/execution/submit-signed', async (req: Request, res: Response) => {
    try {
      const { intentId, signedTxBase64, signature } = req.body;
      const result = await cryptoExecutionEngine.submitSignedTransaction(intentId, {
        signedTxBase64,
        signature
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/execution/verify-settle', async (req: Request, res: Response) => {
    try {
      const { intentId } = req.body;
      const result = await cryptoExecutionEngine.verifyAndSettleIntent(intentId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Inbound Customer Revenue Engine & Real Products
  app.get('/api/payments/products', (req: Request, res: Response) => {
    res.json({ products: paymentEngine.getProducts() });
  });

  app.get('/api/payments/orders', (req: Request, res: Response) => {
    res.json({ orders: paymentEngine.getAllOrders() });
  });

  app.get('/api/payments/orders/:id', (req: Request, res: Response) => {
    const order = paymentEngine.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  });

  app.post('/api/payments/orders', async (req: Request, res: Response) => {
    try {
      const { productId, customerWallet, customerId } = req.body;
      const result = await paymentEngine.createOrder({
        productId,
        customerWallet,
        customerId
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/payments/verify', async (req: Request, res: Response) => {
    try {
      const { orderId, transactionSignature } = req.body;
      if (!orderId || !transactionSignature) {
        return res.status(400).json({ error: 'orderId and transactionSignature are required' });
      }
      const result = await paymentEngine.verifyAndSettlePayment({
        orderId,
        transactionSignature
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/payments/evidence', (req: Request, res: Response) => {
    res.json({ evidence: paymentEngine.getAllEvidence() });
  });

  // Treasury Cryptographic Reconciliation
  app.get('/api/treasury/reconciliation', async (req: Request, res: Response) => {
    try {
      const report = await reconciliationService.runReconciliation();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/treasury/reconciliation/run', async (req: Request, res: Response) => {
    try {
      const report = await reconciliationService.runReconciliation();
      res.json({ success: true, report });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Provider Health & Failover
  app.get('/api/providers', (req: Request, res: Response) => {
    const active = providerManager.getActiveProvider();
    res.json({
      providers: providerManager.getHealthSummary(),
      activeProvider: active,
      activeProviderName: active.name
    });
  });

  app.get('/api/providers/health', (req: Request, res: Response) => {
    const active = providerManager.getActiveProvider();
    res.json({
      providers: providerManager.getHealthSummary(),
      activeProvider: active,
      activeProviderName: active.name
    });
  });

  app.post('/api/providers/ping', async (req: Request, res: Response) => {
    const summary = await providerManager.pingAll();
    const active = providerManager.getActiveProvider();
    res.json({ providers: summary, activeProvider: active, activeProviderName: active.name });
  });

  app.post('/api/providers/failover', (req: Request, res: Response) => {
    const providerId = req.body.targetProviderId || req.body.providerId;
    if (providerId) {
      providerManager.setActiveProvider(providerId);
    }
    const active = providerManager.getActiveProvider();
    res.json({ success: true, activeProvider: active, activeProviderName: active.name });
  });

  app.post('/api/providers/switch', (req: Request, res: Response) => {
    const providerId = req.body.targetProviderId || req.body.providerId;
    if (providerId) {
      providerManager.setActiveProvider(providerId);
    }
    const active = providerManager.getActiveProvider();
    res.json({ success: true, activeProvider: active, activeProviderName: active.name });
  });

  // Security & Emergency Stop
  app.get('/api/security', (req: Request, res: Response) => {
    res.json({
      securityState: securityGuard.getSecurityState(),
      auditTrail: securityGuard.getAuditTrail(50),
      storage: storageEngine.getStatus()
    });
  });

  app.get('/api/audit-logs', (req: Request, res: Response) => {
    res.json({
      logs: securityGuard.getAuditTrail(50)
    });
  });

  app.post('/api/security/emergency-stop', (req: Request, res: Response) => {
    const { action, reason, actor } = req.body;
    if (action === 'disengage') {
      const state = securityGuard.disengageEmergencyStop(actor || 'Operator');
      fleetEngine.resumeAll();
      return res.json({ success: true, state });
    }
    const state = securityGuard.triggerEmergencyStop(reason || 'Manual circuit breaker triggered by operator', actor || 'Operator');
    fleetEngine.emergencyStopAll(reason || 'Emergency Stop Active');
    res.json({ success: true, state });
  });

  app.post('/api/security/emergency-stop/disengage', (req: Request, res: Response) => {
    const { actor } = req.body;
    const state = securityGuard.disengageEmergencyStop(actor || 'Operator');
    fleetEngine.resumeAll();
    res.json({ success: true, state });
  });

  app.get('/api/schema', (req: Request, res: Response) => {
    res.type('text/plain').send(YABBAI_POSTGRES_SCHEMA_SQL);
  });

  // Testing API endpoint - Runs test suite directly and returns verification report
  app.post('/api/run-tests', async (req: Request, res: Response) => {
    try {
      const results = await runAllVerificationTests();
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[YABBAI] Production Server initialized on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[YABBAI] Fatal startup error:', err);
  process.exit(1);
});
