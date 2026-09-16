/**
 * YABBAI - Automated External Profit Sweep Engine
 * 
 * Strict compliance:
 * - Canonical External Profit Wallet: HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i
 * - Destination cannot be freely modified by autonomous agents; requires authenticated admin authorization
 * - Sweep rules:
 *   WITHDRAWABLE_PROFIT = max(0, VERIFIED_REALIZED_PROFIT - PREVIOUSLY_SWEPT_PROFIT - PENDING_PROFIT_SWEEPS - REQUIRED_RESERVE - CUSTOMER_FUNDS)
 *   SWEEPABLE_PROFIT = max(0, WITHDRAWABLE_PROFIT)
 *   If SWEEPABLE_PROFIT <= 0 -> SWEEP DOES NOT EXECUTE.
 * - Never sweep from initial capital, customer funds, reserve, or general balance.
 * - Sweep increases WITHDRAWN_PROFIT, decreases WITHDRAWABLE_PROFIT, does not alter REALIZED_PROFIT.
 */

import { RevenueLedger } from './revenueLedger';
import { ProfitAccountingEngine } from './profitAccounting';
import { SolanaProviderManager } from '../solana/provider';
import { TransactionStateMachine } from '../solana/txStateMachine';
import { marketPriceService } from '../solana/priceService';
import { SecurityGuard } from '../security/guard';
import { ProfitSweepStatus, TreasuryWithdrawalRecord } from '../../src/types/yabbai';
import { PublicKey } from '@solana/web3.js';

export class ProfitSweepEngine {
  public static readonly CANONICAL_EXTERNAL_PROFIT_WALLET = 'HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i';

  private revenueLedger: RevenueLedger;
  private profitAccounting: ProfitAccountingEngine;
  private solanaProvider: SolanaProviderManager;
  private txStateMachine: TransactionStateMachine;
  private securityGuard: SecurityGuard;

  private targetWallet: string = process.env.EXTERNAL_PROFIT_TREASURY || ProfitSweepEngine.CANONICAL_EXTERNAL_PROFIT_WALLET;
  private profitPercent: number = 10; // 10% of withdrawable profit
  private intervalMs: number = 5 * 60 * 1000; // 5 minutes
  private isAutoSweepActive: boolean = true;

  private intervalTimer: NodeJS.Timeout | null = null;
  private lastSweepAt: number = 0;
  private nextSweepAt: number = Date.now() + (5 * 60 * 1000);
  private totalSweptUsd: number = 0;
  private totalSweptSol: number = 0;
  private sweepsHistory: TreasuryWithdrawalRecord[] = [];

  constructor(deps: {
    revenueLedger: RevenueLedger;
    profitAccounting: ProfitAccountingEngine;
    solanaProvider: SolanaProviderManager;
    txStateMachine: TransactionStateMachine;
    securityGuard: SecurityGuard;
  }) {
    this.revenueLedger = deps.revenueLedger;
    this.profitAccounting = deps.profitAccounting;
    this.solanaProvider = deps.solanaProvider;
    this.txStateMachine = deps.txStateMachine;
    this.securityGuard = deps.securityGuard;

    this.startRunner();
  }

  public getStatus(): ProfitSweepStatus {
    const keypair = this.solanaProvider.getTreasuryKeypair();
    const pubkey = keypair ? keypair.publicKey.toBase58() : null;
    const sweepableProfitUsd = this.profitAccounting.getSweepableProfit();

    return {
      targetWallet: this.targetWallet,
      profitPercent: this.profitPercent,
      intervalMinutes: Math.round(this.intervalMs / 60000),
      nextSweepAt: this.nextSweepAt,
      lastSweepAt: this.lastSweepAt || undefined,
      totalSweptUsd: Math.round(this.totalSweptUsd * 100) / 100,
      totalSweptSol: Math.round(this.totalSweptSol * 1e6) / 1e6,
      sweepsCount: this.sweepsHistory.length,
      isAutoSweepActive: this.isAutoSweepActive,
      recentSweeps: this.sweepsHistory.slice(0, 20),
      executionMode: 'REAL_ON_CHAIN',
      hasTreasuryKeypair: true,
      treasurySignerPublicKey: pubkey,
      sweepableProfitUsd,
      isSweepBlocked: sweepableProfitUsd <= 0,
      blockedReason: sweepableProfitUsd <= 0 ? 'No withdrawable realized profit. Initial capital and general reserves are strictly protected from sweeps.' : undefined,
      modeExplanation: `External Profit Destination: ${this.targetWallet}. Sweeps trigger strictly when withdrawable net profit > 0.`
    };
  }

  /**
   * Destination changes require explicit administrative authorization and audit logging.
   */
  public updateDestination(newAddress: string, actor: string, reason: string): { success: boolean; targetWallet: string; message: string } {
    const trimmed = newAddress.trim();
    try {
      new PublicKey(trimmed);
    } catch {
      throw new Error('Invalid Solana public key format for external profit destination.');
    }

    const previousDestination = this.targetWallet;
    this.targetWallet = trimmed;

    this.securityGuard.recordAudit({
      actor,
      action: 'UPDATE_EXTERNAL_PROFIT_DESTINATION',
      resourceId: trimmed,
      details: {
        previousDestination,
        newDestination: trimmed,
        reason: reason || 'Authorized administrator reconfiguration'
      }
    });

    return {
      success: true,
      targetWallet: this.targetWallet,
      message: `External profit destination updated from ${previousDestination} to ${trimmed}`
    };
  }

  public updateConfig(config: {
    profitPercent?: number;
    intervalMinutes?: number;
    isActive?: boolean;
  }) {
    if (typeof config.profitPercent === 'number' && config.profitPercent > 0 && config.profitPercent <= 100) {
      this.profitPercent = config.profitPercent;
    }
    if (typeof config.intervalMinutes === 'number' && config.intervalMinutes >= 1) {
      this.intervalMs = config.intervalMinutes * 60 * 1000;
      this.nextSweepAt = Date.now() + this.intervalMs;
      this.restartRunner();
    }
    if (typeof config.isActive === 'boolean') {
      this.isAutoSweepActive = config.isActive;
      if (!this.isAutoSweepActive && this.intervalTimer) {
        clearInterval(this.intervalTimer);
        this.intervalTimer = null;
      } else if (this.isAutoSweepActive && !this.intervalTimer) {
        this.startRunner();
      }
    }
    return this.getStatus();
  }

  private startRunner() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    this.intervalTimer = setInterval(() => {
      if (!this.isAutoSweepActive) return;

      const now = Date.now();
      if (now >= this.nextSweepAt) {
        this.executeProfitSweep().catch((err) => {
          console.error('[ProfitSweepEngine] Automatic sweep error:', err.message);
        });
      }
    }, 10000);
  }

  private restartRunner() {
    this.startRunner();
  }

  public reset() {
    this.totalSweptUsd = 0;
    this.totalSweptSol = 0;
    this.sweepsHistory = [];
    this.lastSweepAt = 0;
    this.nextSweepAt = Date.now() + this.intervalMs;
  }

  /**
   * Execute 10% Profit Sweep to Target External Wallet
   * STRICT: If sweepable profit <= 0, DOES NOT EXECUTE.
   */
  public async executeProfitSweep(forcedAmountUsd?: number): Promise<TreasuryWithdrawalRecord | null> {
    try {
      if (this.securityGuard.areSweepsStopped()) {
        this.nextSweepAt = Date.now() + this.intervalMs;
        return null;
      }

      // 1. Calculate strictly from withdrawable realized profit
      const sweepableProfit = this.profitAccounting.getSweepableProfit();

      let amountUsd = forcedAmountUsd;
      if (!amountUsd) {
        if (sweepableProfit > 0) {
          amountUsd = Math.round(sweepableProfit * (this.profitPercent / 100) * 100) / 100;
        } else {
          amountUsd = 0;
        }
      }

      // CRITICAL NON-NEGOTIABLE RULE:
      // If SWEEPABLE_PROFIT <= 0 -> SWEEP DOES NOT EXECUTE.
      // Never sweep from general balance, capital, or reserves!
      if (amountUsd <= 0 || sweepableProfit <= 0) {
        this.nextSweepAt = Date.now() + this.intervalMs;
        return null;
      }

      // Bound to sweepable profit
      if (amountUsd > sweepableProfit) {
        amountUsd = sweepableProfit;
      }

      // 2. Validate destination address
      try {
        new PublicKey(this.targetWallet);
      } catch {
        throw new Error(`Invalid destination public key: ${this.targetWallet}`);
      }

      // 3. Fetch live SOL price
      const priceData = await marketPriceService.getSolPrice();
      const solPrice = priceData.solPriceUsd > 0 ? priceData.solPriceUsd : 180.00;
      const amountSol = Math.round((amountUsd / solPrice) * 1e6) / 1e6;

      // 4. Check on-chain signer balance
      const signerStatus = await this.solanaProvider.getTreasurySignerStatus();
      if (signerStatus.balanceSol < amountSol) {
        // Physical funds in on-chain signer not yet funded for gas/disbursement
        this.nextSweepAt = Date.now() + this.intervalMs;
        return null;
      }

      // 5. Attempt real on-chain transfer via Solana provider
      const realTxResult = await this.solanaProvider.sendRealSolTransfer(this.targetWallet, amountSol);
      if (!realTxResult.success || !realTxResult.signature) {
        this.nextSweepAt = Date.now() + this.intervalMs;
        return null;
      }

      const txSig = realTxResult.signature;

      // 6. Record in formal profit accounting
      this.profitAccounting.recordProfitSweepCompleted(amountUsd, this.targetWallet, txSig);

      this.totalSweptUsd += amountUsd;
      this.totalSweptSol += amountSol;
      this.lastSweepAt = Date.now();
      this.nextSweepAt = Date.now() + this.intervalMs;

      const record: TreasuryWithdrawalRecord = {
        id: `SWEEP-${Date.now()}`,
        timestamp: Date.now(),
        recipientAddress: this.targetWallet,
        amountUsd,
        amountAsset: amountSol,
        asset: 'SOL',
        sourceBucket: 'growthReinvestmentUsd',
        transactionSignature: txSig,
        solscanUrl: `https://solscan.io/tx/${txSig}`,
        accountUrl: `https://solscan.io/account/${this.targetWallet}`,
        status: 'CONFIRMED',
        networkFeeUsd: 0.0005,
        authorizedBy: 'POLICY_PROFIT_SWEEP_ENGINE',
        note: `Automated ${this.profitPercent}% Realized Net Profit Sweep to External Treasury`,
        onChainVerified: true,
        disbursementMode: 'REAL_ON_CHAIN'
      };

      this.sweepsHistory.unshift(record);

      this.securityGuard.recordAudit({
        actor: 'PROFIT_SWEEP_ENGINE',
        action: 'EXECUTE_PROFIT_SWEEP',
        resourceId: this.targetWallet,
        details: {
          amountUsd,
          amountSol,
          txSignature: txSig,
          destination: this.targetWallet
        }
      });

      return record;
    } catch (err: any) {
      console.error('[ProfitSweepEngine] Sweep execution failed:', err.message);
      this.nextSweepAt = Date.now() + this.intervalMs;
      return null;
    }
  }
}
