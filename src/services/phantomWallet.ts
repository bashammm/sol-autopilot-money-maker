/**
 * YABBAI - Canonical Phantom Wallet Provider Service
 * 
 * Non-custodial Phantom Wallet Integration.
 * Absolutely NEVER requires or stores private keys or seed phrases.
 * All signing happens inside the Phantom browser extension.
 */

import { PhantomWalletState } from '../types/yabbai';

// Safe window accessor for Phantom
export function getPhantomProvider(): any {
  if (typeof window === 'undefined') return null;

  const anyWindow = window as any;
  if ('phantom' in anyWindow && anyWindow.phantom?.solana?.isPhantom) {
    return anyWindow.phantom.solana;
  }
  if ('solana' in anyWindow && anyWindow.solana?.isPhantom) {
    return anyWindow.solana;
  }
  return null;
}

export class PhantomWalletService {
  private static instance: PhantomWalletService;
  private state: PhantomWalletState = {
    connected: false,
    status: 'DISCONNECTED',
    address: null,
    network: 'mainnet-beta',
    balanceSol: 0,
    balanceUsd: 0,
    tokenBalances: [],
    lastUpdated: Date.now(),
    error: null
  };

  private listeners: Array<(state: PhantomWalletState) => void> = [];

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initEvents();
    }
  }

  public static getInstance(): PhantomWalletService {
    if (!PhantomWalletService.instance) {
      PhantomWalletService.instance = new PhantomWalletService();
    }
    return PhantomWalletService.instance;
  }

  public subscribe(fn: (state: PhantomWalletState) => void): () => void {
    this.listeners.push(fn);
    fn(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn({ ...this.state }));
  }

  public getState(): PhantomWalletState {
    return { ...this.state };
  }

  private initEvents() {
    const provider = getPhantomProvider();
    if (!provider) return;

    provider.on('connect', (publicKey: any) => {
      const address = publicKey?.toBase58?.() || publicKey?.toString();
      this.state.connected = true;
      this.state.status = 'CONNECTED';
      this.state.address = address;
      this.state.error = null;
      this.refreshBalance();
      this.notify();
    });

    provider.on('disconnect', () => {
      this.state.connected = false;
      this.state.status = 'DISCONNECTED';
      this.state.address = null;
      this.state.balanceSol = 0;
      this.state.balanceUsd = 0;
      this.notify();
    });

    provider.on('accountChanged', (publicKey: any) => {
      if (publicKey) {
        const address = publicKey?.toBase58?.() || publicKey?.toString();
        this.state.address = address;
        this.state.connected = true;
        this.state.status = 'CONNECTED';
        this.refreshBalance();
      } else {
        this.state.connected = false;
        this.state.status = 'DISCONNECTED';
        this.state.address = null;
      }
      this.notify();
    });

    // Auto-connect if already authorized
    if (provider.isConnected && provider.publicKey) {
      const address = provider.publicKey.toBase58();
      this.state.connected = true;
      this.state.status = 'CONNECTED';
      this.state.address = address;
      this.refreshBalance();
      this.notify();
    }
  }

  public async connect(): Promise<string> {
    const provider = getPhantomProvider();
    if (!provider) {
      const errorMsg = 'Phantom wallet extension is not installed. Please install Phantom at https://phantom.app';
      this.state.error = errorMsg;
      this.state.status = 'ERROR';
      this.notify();
      throw new Error(errorMsg);
    }

    try {
      this.state.status = 'CONNECTING';
      this.notify();

      const resp = await provider.connect();
      const address = resp.publicKey.toBase58();
      this.state.connected = true;
      this.state.status = 'CONNECTED';
      this.state.address = address;
      this.state.error = null;
      await this.refreshBalance();
      this.notify();
      return address;
    } catch (err: any) {
      this.state.status = 'ERROR';
      this.state.error = err.message || 'User rejected Phantom wallet connection';
      this.notify();
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    const provider = getPhantomProvider();
    if (provider) {
      try {
        await provider.disconnect();
      } catch {
        // Ignore
      }
    }
    this.state.connected = false;
    this.state.status = 'DISCONNECTED';
    this.state.address = null;
    this.state.balanceSol = 0;
    this.state.balanceUsd = 0;
    this.notify();
  }

  public async refreshBalance(): Promise<void> {
    if (!this.state.address) return;

    try {
      const res = await fetch(`/api/solana/balance/${this.state.address}`);
      if (res.ok) {
        const data = await res.json();
        this.state.balanceSol = data.balanceSol || 0;
        this.state.balanceUsd = data.balanceUsd || 0;
        this.state.network = data.cluster || 'mainnet-beta';
        this.state.lastUpdated = Date.now();
        this.notify();
      }
    } catch {
      // Non-blocking
    }
  }

  /**
   * Signs and sends a transaction using Phantom extension
   */
  public async signAndSendTransaction(transaction: any): Promise<{ signature: string }> {
    const provider = getPhantomProvider();
    if (!provider) {
      throw new Error('Phantom wallet is not connected.');
    }

    try {
      const { signature } = await provider.signAndSendTransaction(transaction);
      return { signature };
    } catch (err: any) {
      throw new Error(err.message || 'Phantom signature was rejected or failed.');
    }
  }

  /**
   * Signs a transaction without sending
   */
  public async signTransaction(transaction: any): Promise<any> {
    const provider = getPhantomProvider();
    if (!provider) {
      throw new Error('Phantom wallet is not connected.');
    }

    try {
      return await provider.signTransaction(transaction);
    } catch (err: any) {
      throw new Error(err.message || 'Phantom signature was rejected.');
    }
  }
}
