/**
 * YABBAI - Centralized Treasury Configuration & Policy Guardian
 * 
 * Requirement #2: Single configurable public treasury destination.
 * Environment variable: NEXT_PUBLIC_REVENUE_TREASURY_ADDRESS
 * Production destination is the user's supplied Phantom public address or configured treasury.
 * Treat the value as PUBLIC information. All revenue destinations resolve through here.
 * Tracks actual verified spend limits (per_transaction_limit, daily_limit, weekly_limit).
 */

import { TreasuryConfig } from '../../src/types/yabbai';

export class CentralizedTreasuryManager {
  private config: TreasuryConfig;
  private settledTransactions: Array<{ timestamp: number; amountUsd: number; txSignature: string }> = [];

  constructor() {
    const envTreasuryAddress = 
      process.env.NEXT_PUBLIC_REVENUE_TREASURY_ADDRESS || 
      process.env.REVENUE_TREASURY_ADDRESS || 
      'HKjCGdas7CVkSwQHi6Bhckj2U2P8rtTyMbikdY5pkXcb'; // User's Phantom Public Address

    const initialNetwork = (process.env.SOLANA_NETWORK === 'devnet' ? 'devnet' : 'mainnet-beta') as 'mainnet-beta' | 'devnet';

    this.config = {
      address: envTreasuryAddress,
      network: initialNetwork,
      enabled: true,
      allowed_assets: ['SOL', 'USDC'],
      daily_limit: 500.0, // $500/day max spending guard
      per_transaction_limit: 100.0, // $100/tx max spending guard
      weekly_limit: 2500.0, // $2500/week max spending guard
      created_at: Date.now(),
      updated_at: Date.now(),
      destinationAllowlist: [
        envTreasuryAddress,
        'HKjCGdas7CVkSwQHi6Bhckj2U2P8rtTyMbikdY5pkXcb',
        'HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i',
        '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      ],
      destinationBlocklist: [
        'SCAM111111111111111111111111111111111111111',
        'EVIL111111111111111111111111111111111111111',
        'DRAIN11111111111111111111111111111111111111'
      ],
      spendingTracker: {
        verifiedDailySpendUsd: 0,
        verifiedWeeklySpendUsd: 0,
        lastResetTimestamp: Date.now()
      }
    };
  }

  public getConfig(): TreasuryConfig {
    this.refreshSpendingCalculations();
    return { ...this.config };
  }

  public getTreasuryAddress(): string {
    return this.config.address;
  }

  public getNetwork(): 'mainnet-beta' | 'devnet' | 'simulation' {
    return this.config.network;
  }

  public updateConfig(updates: Partial<TreasuryConfig>): TreasuryConfig {
    if (updates.address) {
      const trimmed = updates.address.trim();
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
      if (!base58Regex.test(trimmed)) {
        throw new Error('Invalid Solana public address format for Treasury Config.');
      }
      this.config.address = trimmed;
      if (!this.config.destinationAllowlist.includes(trimmed)) {
        this.config.destinationAllowlist.push(trimmed);
      }
    }

    if (updates.network) {
      this.config.network = updates.network;
    }

    if (typeof updates.enabled === 'boolean') {
      this.config.enabled = updates.enabled;
    }

    if (updates.allowed_assets && Array.isArray(updates.allowed_assets)) {
      this.config.allowed_assets = updates.allowed_assets;
    }

    if (typeof updates.per_transaction_limit === 'number' && updates.per_transaction_limit > 0) {
      this.config.per_transaction_limit = updates.per_transaction_limit;
    }

    if (typeof updates.daily_limit === 'number' && updates.daily_limit > 0) {
      this.config.daily_limit = updates.daily_limit;
    }

    if (typeof updates.weekly_limit === 'number' && updates.weekly_limit > 0) {
      this.config.weekly_limit = updates.weekly_limit;
    }

    if (updates.destinationAllowlist && Array.isArray(updates.destinationAllowlist)) {
      this.config.destinationAllowlist = updates.destinationAllowlist;
    }

    if (updates.destinationBlocklist && Array.isArray(updates.destinationBlocklist)) {
      this.config.destinationBlocklist = updates.destinationBlocklist;
    }

    this.config.updated_at = Date.now();
    return this.getConfig();
  }

  /**
   * Destination allowlist & blocklist check
   */
  public verifyDestinationPolicy(destinationAddress: string): { allowed: boolean; reason?: string } {
    const dest = destinationAddress.trim();

    // Check blocklist
    if (this.config.destinationBlocklist.includes(dest)) {
      return {
        allowed: false,
        reason: `Destination ${dest} is blocked by Treasury Security Blocklist policy.`
      };
    }

    // If allowlist is populated, destination must be on allowlist
    if (this.config.destinationAllowlist.length > 0) {
      const onAllowlist = this.config.destinationAllowlist.some(
        a => a.toLowerCase() === dest.toLowerCase()
      );
      if (!onAllowlist) {
        return {
          allowed: false,
          reason: `Destination ${dest} is NOT in the configured Treasury Destination Allowlist.`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Recalculates rolling 24-hour and 7-day verified settled spending.
   * Requirement #10: Calculate actual verified spend, not requested transactions.
   */
  private refreshSpendingCalculations() {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let dailySum = 0;
    let weeklySum = 0;

    for (const tx of this.settledTransactions) {
      if (tx.timestamp >= sevenDaysAgo) {
        weeklySum += tx.amountUsd;
        if (tx.timestamp >= oneDayAgo) {
          dailySum += tx.amountUsd;
        }
      }
    }

    this.config.spendingTracker = {
      verifiedDailySpendUsd: Math.round(dailySum * 100) / 100,
      verifiedWeeklySpendUsd: Math.round(weeklySum * 100) / 100,
      lastResetTimestamp: now
    };
  }

  /**
   * Spending policy check:
   * Checks per-transaction limit, 24h daily limit, and 7-day weekly limit.
   */
  public verifySpendingPolicy(amountUsd: number): { allowed: boolean; reason?: string } {
    if (amountUsd <= 0) {
      return { allowed: false, reason: 'Transaction amount must be strictly positive.' };
    }

    if (amountUsd > this.config.per_transaction_limit) {
      return {
        allowed: false,
        reason: `Amount ($${amountUsd.toFixed(2)}) exceeds per-transaction limit ($${this.config.per_transaction_limit.toFixed(2)}).`
      };
    }

    this.refreshSpendingCalculations();

    if (this.config.spendingTracker.verifiedDailySpendUsd + amountUsd > this.config.daily_limit) {
      return {
        allowed: false,
        reason: `Transaction of $${amountUsd.toFixed(2)} would exceed daily spending limit ($${this.config.daily_limit.toFixed(2)}). Current 24h spend: $${this.config.spendingTracker.verifiedDailySpendUsd.toFixed(2)}.`
      };
    }

    if (this.config.spendingTracker.verifiedWeeklySpendUsd + amountUsd > this.config.weekly_limit) {
      return {
        allowed: false,
        reason: `Transaction of $${amountUsd.toFixed(2)} would exceed weekly spending limit ($${this.config.weekly_limit.toFixed(2)}). Current 7d spend: $${this.config.spendingTracker.verifiedWeeklySpendUsd.toFixed(2)}.`
      };
    }

    return { allowed: true };
  }

  /**
   * Record verified on-chain settled transaction towards spending limits
   */
  public recordVerifiedSettledSpend(amountUsd: number, txSignature: string) {
    this.settledTransactions.push({
      timestamp: Date.now(),
      amountUsd,
      txSignature
    });
    this.refreshSpendingCalculations();
  }
}
