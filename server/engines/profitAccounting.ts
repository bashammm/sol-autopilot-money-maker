/**
 * YABBAI - Formal Profit & Capital Accounting Engine
 * 
 * Strict non-negotiable accounting rules:
 * 1. REALIZED_PROFIT = VERIFIED_REALIZED_REVENUE - VERIFIED_COSTS (fees, slippage, losses, refunds)
 * 2. Balance increase without verifiable economic source -> UNATTRIBUTED_INFLOW (never profit)
 * 3. Capital deposits -> INITIAL_CAPITAL / OPERATING_CAPITAL (never profit)
 * 4. WITHDRAW_REALIZED_PROFIT: only up to WITHDRAWABLE_PROFIT
 * 5. WITHDRAW_CAPITAL: decreases INITIAL_CAPITAL or OPERATING_CAPITAL, leaves profit untouched
 * 6. WITHDRAWABLE_PROFIT = max(0, REALIZED_PROFIT - WITHDRAWN_PROFIT - PENDING_SWEEP - REQUIRED_RESERVE - CUSTOMER_FUNDS)
 */

import { FormalAccountingLedger } from '../../src/types/yabbai';
import { SecurityGuard } from '../security/guard';

export interface VerifiedRevenueEvent {
  id: string;
  source: 'CUSTOMER_ORDER' | 'SETTLED_ARBITRAGE' | 'DEX_YIELD' | 'SERVICE_FEE';
  grossAmountUsd: number;
  networkFeeUsd: number;
  executionFeeUsd: number;
  platformFeeUsd: number;
  slippageUsd: number;
  otherCostUsd: number;
  signature: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class ProfitAccountingEngine {
  private ledger: FormalAccountingLedger = {
    initialCapitalUsd: 0.0,
    operatingCapitalUsd: 0.0,
    reserveUsd: 0.0,
    customerFundsUsd: 0.0,
    realizedRevenueUsd: 0.0,
    verifiedCostsUsd: 0.0,
    realizedProfitUsd: 0.0,
    unrealizedPnlUsd: 0.0,
    unattributedInflowUsd: 0.0,
    withdrawnProfitUsd: 0.0,
    withdrawnCapitalUsd: 0.0,
    pendingSweepUsd: 0.0,
    withdrawableProfitUsd: 0.0,
    totalBalanceUsd: 0.0,
    lastReconciliationTimestamp: Date.now()
  };

  private revenueEvents: Map<string, VerifiedRevenueEvent> = new Map();
  private securityGuard: SecurityGuard;

  constructor(securityGuard: SecurityGuard) {
    this.securityGuard = securityGuard;
  }

  public getLedger(): FormalAccountingLedger {
    this.recalculateWithdrawableProfit();
    return { ...this.ledger };
  }

  /**
   * Deposit Initial or Added Working Capital
   * Capital deposits increase INITIAL_CAPITAL / OPERATING_CAPITAL, never REALIZED_PROFIT
   */
  public depositCapital(params: { amountUsd: number; source: string; actor: string; txSignature?: string }): FormalAccountingLedger {
    if (params.amountUsd <= 0) throw new Error('Deposit capital amount must be positive');

    this.ledger.initialCapitalUsd += params.amountUsd;
    this.ledger.operatingCapitalUsd += params.amountUsd;
    this.ledger.totalBalanceUsd += params.amountUsd;
    this.ledger.lastReconciliationTimestamp = Date.now();

    this.securityGuard.recordAudit({
      actor: params.actor,
      action: 'DEPOSIT_WORKING_CAPITAL',
      details: {
        amountUsd: params.amountUsd,
        txSignature: params.txSignature,
        source: params.source
      }
    });

    this.recalculateWithdrawableProfit();
    return this.getLedger();
  }

  /**
   * Record Authoritative Realized Revenue with Itemized Verified Costs
   * REALIZED_PROFIT = VERIFIED_REALIZED_REVENUE - VERIFIED_COSTS
   */
  public recordVerifiedRevenue(event: VerifiedRevenueEvent): { netProfitUsd: number; ledger: FormalAccountingLedger } {
    if (this.revenueEvents.has(event.signature)) {
      throw new Error(`Revenue event with signature ${event.signature} already accounted for.`);
    }

    const totalCost = Math.round(
      (event.networkFeeUsd +
       event.executionFeeUsd +
       event.platformFeeUsd +
       event.slippageUsd +
       event.otherCostUsd) * 100
    ) / 100;

    const netProfit = Math.round((event.grossAmountUsd - totalCost) * 100) / 100;

    this.revenueEvents.set(event.signature, event);

    this.ledger.realizedRevenueUsd = Math.round((this.ledger.realizedRevenueUsd + event.grossAmountUsd) * 100) / 100;
    this.ledger.verifiedCostsUsd = Math.round((this.ledger.verifiedCostsUsd + totalCost) * 100) / 100;
    this.ledger.realizedProfitUsd = Math.round((this.ledger.realizedProfitUsd + netProfit) * 100) / 100;
    this.ledger.totalBalanceUsd = Math.round((this.ledger.totalBalanceUsd + netProfit) * 100) / 100;
    this.ledger.lastReconciliationTimestamp = Date.now();

    this.securityGuard.recordAudit({
      actor: 'ACCOUNTING_ENGINE',
      action: 'RECORD_VERIFIED_REVENUE',
      resourceId: event.signature,
      details: {
        grossUsd: event.grossAmountUsd,
        totalCostUsd: totalCost,
        netProfitUsd: netProfit,
        source: event.source
      }
    });

    this.recalculateWithdrawableProfit();
    return { netProfitUsd: netProfit, ledger: this.getLedger() };
  }

  /**
   * Handle On-Chain Balance Inflow
   * If balance increases without verifiable economic source (order/settlement),
   * classify as UNATTRIBUTED_INFLOW. NEVER classify as profit!
   */
  public recordUnattributedInflow(amountUsd: number, txSignature?: string, note?: string): FormalAccountingLedger {
    if (amountUsd <= 0) return this.getLedger();

    this.ledger.unattributedInflowUsd = Math.round((this.ledger.unattributedInflowUsd + amountUsd) * 100) / 100;
    this.ledger.totalBalanceUsd = Math.round((this.ledger.totalBalanceUsd + amountUsd) * 100) / 100;
    this.ledger.lastReconciliationTimestamp = Date.now();

    this.securityGuard.recordAudit({
      actor: 'RECONCILIATION_ENGINE',
      action: 'UNATTRIBUTED_INFLOW_DETECTED',
      details: {
        amountUsd,
        txSignature,
        note: note || 'Balance increased without verified order or execution settlement. Quarantined in unattributed inflow.'
      }
    });

    this.recalculateWithdrawableProfit();
    return this.getLedger();
  }

  /**
   * Recalculate Withdrawable Profit
   * WITHDRAWABLE_PROFIT = max(0, REALIZED_PROFIT - WITHDRAWN_PROFIT - PENDING_SWEEP - REQUIRED_RESERVE - CUSTOMER_FUNDS)
   */
  private recalculateWithdrawableProfit() {
    const rawWithdrawable = 
      this.ledger.realizedProfitUsd - 
      this.ledger.withdrawnProfitUsd - 
      this.ledger.pendingSweepUsd - 
      this.ledger.reserveUsd - 
      this.ledger.customerFundsUsd;

    this.ledger.withdrawableProfitUsd = Math.max(0, Math.round(rawWithdrawable * 100) / 100);
  }

  /**
   * Withdraw Realized Profit
   * Only up to WITHDRAWABLE_PROFIT. Decreases WITHDRAWABLE_PROFIT, increases WITHDRAWN_PROFIT,
   * leaves INITIAL_CAPITAL untouched.
   */
  public withdrawRealizedProfit(amountUsd: number, recipientAddress: string, txSignature?: string): FormalAccountingLedger {
    this.recalculateWithdrawableProfit();

    if (amountUsd <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }

    if (amountUsd > this.ledger.withdrawableProfitUsd) {
      throw new Error(
        `Insufficient withdrawable profit. Requested $${amountUsd.toFixed(2)}, but available withdrawable profit is $${this.ledger.withdrawableProfitUsd.toFixed(2)} (Realized Profit: $${this.ledger.realizedProfitUsd.toFixed(2)}, Already Withdrawn: $${this.ledger.withdrawnProfitUsd.toFixed(2)})`
      );
    }

    this.ledger.withdrawnProfitUsd = Math.round((this.ledger.withdrawnProfitUsd + amountUsd) * 100) / 100;
    this.ledger.totalBalanceUsd = Math.max(0, Math.round((this.ledger.totalBalanceUsd - amountUsd) * 100) / 100);
    this.ledger.lastReconciliationTimestamp = Date.now();

    this.securityGuard.recordAudit({
      actor: 'ADMIN_OPERATOR',
      action: 'WITHDRAW_REALIZED_PROFIT',
      resourceId: recipientAddress,
      details: {
        amountUsd,
        txSignature,
        recipientAddress,
        remainingWithdrawableProfit: this.ledger.withdrawableProfitUsd
      }
    });

    this.recalculateWithdrawableProfit();
    return this.getLedger();
  }

  /**
   * Withdraw Capital
   * Decreases INITIAL_CAPITAL or OPERATING_CAPITAL, increases WITHDRAWN_CAPITAL,
   * does NOT touch profit ledger.
   */
  public withdrawCapital(amountUsd: number, recipientAddress: string, txSignature?: string): FormalAccountingLedger {
    const availableCapital = Math.max(0, this.ledger.operatingCapitalUsd);

    if (amountUsd <= 0) {
      throw new Error('Withdrawal capital amount must be positive');
    }

    if (amountUsd > availableCapital) {
      throw new Error(
        `Insufficient working capital. Requested $${amountUsd.toFixed(2)}, but operating capital available is $${availableCapital.toFixed(2)}`
      );
    }

    this.ledger.operatingCapitalUsd = Math.round((this.ledger.operatingCapitalUsd - amountUsd) * 100) / 100;
    this.ledger.withdrawnCapitalUsd = Math.round((this.ledger.withdrawnCapitalUsd + amountUsd) * 100) / 100;
    this.ledger.totalBalanceUsd = Math.max(0, Math.round((this.ledger.totalBalanceUsd - amountUsd) * 100) / 100);
    this.ledger.lastReconciliationTimestamp = Date.now();

    this.securityGuard.recordAudit({
      actor: 'ADMIN_OPERATOR',
      action: 'WITHDRAW_WORKING_CAPITAL',
      resourceId: recipientAddress,
      details: {
        amountUsd,
        txSignature,
        recipientAddress,
        remainingOperatingCapital: this.ledger.operatingCapitalUsd
      }
    });

    this.recalculateWithdrawableProfit();
    return this.getLedger();
  }

  /**
   * Check if Profit Sweep can execute
   * Returns sweepable amount
   */
  public getSweepableProfit(): number {
    this.recalculateWithdrawableProfit();
    return this.ledger.withdrawableProfitUsd;
  }

  /**
   * Mark Profit Swept
   * Increases withdrawnProfitUsd, decreases withdrawableProfitUsd, does NOT alter realizedProfitUsd
   */
  public recordProfitSweepCompleted(amountUsd: number, destinationAddress: string, txSignature: string): FormalAccountingLedger {
    this.ledger.withdrawnProfitUsd = Math.round((this.ledger.withdrawnProfitUsd + amountUsd) * 100) / 100;
    this.ledger.totalBalanceUsd = Math.max(0, Math.round((this.ledger.totalBalanceUsd - amountUsd) * 100) / 100);
    this.ledger.lastReconciliationTimestamp = Date.now();

    this.securityGuard.recordAudit({
      actor: 'PROFIT_SWEEP_ENGINE',
      action: 'RECORD_PROFIT_SWEEP_COMPLETED',
      resourceId: destinationAddress,
      details: {
        amountUsd,
        txSignature,
        destinationAddress
      }
    });

    this.recalculateWithdrawableProfit();
    return this.getLedger();
  }
}
