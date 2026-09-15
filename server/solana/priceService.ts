/**
 * YABBAI - Real Live Market Price Service
 * Fetches real-time market data for SOL/USD from Binance and CoinGecko APIs
 * Features caching, auto-failover, and sub-second retrieval.
 */

export interface MarketPriceResult {
  solPriceUsd: number;
  source: 'binance' | 'coingecko' | 'cache' | 'fallback';
  timestamp: number;
  change24h?: number;
}

export class MarketPriceService {
  private cachedSolPrice: number = 96.80;
  private cachedSource: 'binance' | 'coingecko' | 'cache' | 'fallback' = 'fallback';
  private lastFetched: number = 0;
  private readonly cacheTtlMs: number = 20000; // 20-second cache

  constructor() {
    // Initial warmup
    this.refreshSolPrice().catch(() => {});
  }

  public async getSolPrice(): Promise<MarketPriceResult> {
    const now = Date.now();
    if (now - this.lastFetched < this.cacheTtlMs && this.cachedSolPrice > 0) {
      return {
        solPriceUsd: this.cachedSolPrice,
        source: 'cache',
        timestamp: this.lastFetched
      };
    }

    return this.refreshSolPrice();
  }

  public getCachedSolPrice(): number {
    return this.cachedSolPrice;
  }

  public async refreshSolPrice(): Promise<MarketPriceResult> {
    const now = Date.now();

    // 1. Try Binance API
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT', {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json() as { symbol: string; price: string };
        const price = parseFloat(data.price);
        if (price > 0) {
          this.cachedSolPrice = Math.round(price * 100) / 100;
          this.cachedSource = 'binance';
          this.lastFetched = now;
          return {
            solPriceUsd: this.cachedSolPrice,
            source: 'binance',
            timestamp: now
          };
        }
      }
    } catch {
      // Proceed to fallback
    }

    // 2. Try CoinGecko Public API
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json() as { solana?: { usd?: number; usd_24h_change?: number } };
        if (data?.solana?.usd && data.solana.usd > 0) {
          this.cachedSolPrice = Math.round(data.solana.usd * 100) / 100;
          this.cachedSource = 'coingecko';
          this.lastFetched = now;
          return {
            solPriceUsd: this.cachedSolPrice,
            source: 'coingecko',
            timestamp: now,
            change24h: data.solana.usd_24h_change
          };
        }
      }
    } catch {
      // Proceed to fallback
    }

    return {
      solPriceUsd: this.cachedSolPrice,
      source: this.cachedSource,
      timestamp: this.lastFetched || now
    };
  }
}

export const marketPriceService = new MarketPriceService();
