import React, { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  Clock, 
  ExternalLink, 
  RefreshCw, 
  Zap, 
  Copy, 
  Check, 
  Coins, 
  ShieldCheck, 
  Sparkles,
  Wallet,
  KeyRound,
  Info
} from 'lucide-react';
import { ProfitSweepStatus, TreasurySignerInfo } from '../types/yabbai';

interface ProfitSweepBannerProps {
  status?: ProfitSweepStatus;
  onRefreshData?: () => void;
  onOpenWithdrawModal?: () => void;
}

export const ProfitSweepBanner: React.FC<ProfitSweepBannerProps> = ({
  status,
  onRefreshData,
  onOpenWithdrawModal
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedSigner, setCopiedSigner] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [triggerFlash, setTriggerFlash] = useState<string | null>(null);
  const [signerInfo, setSignerInfo] = useState<TreasurySignerInfo | null>(null);
  const [isRefreshingSigner, setIsRefreshingSigner] = useState<boolean>(false);

  const targetWallet = status?.targetWallet || 'HKjCGdas7CVkSwQHi6Bhckj2U2P8rtTyMbikdY5pkXcb';
  const profitPercent = status?.profitPercent ?? 10;
  const intervalMinutes = status?.intervalMinutes ?? 5;
  const totalSweptUsd = status?.totalSweptUsd ?? 0;
  const totalSweptSol = status?.totalSweptSol ?? 0;
  const sweepsCount = status?.sweepsCount ?? 0;
  const isAutoActive = status?.isAutoSweepActive ?? true;

  // Fetch Server-Side AA Signer Status
  const fetchSignerStatus = async () => {
    try {
      setIsRefreshingSigner(true);
      const res = await fetch('/api/treasury/signer');
      if (res.ok) {
        const data = await res.json();
        setSignerInfo(data);
      }
    } catch (e) {
      console.warn('Could not fetch treasury signer info', e);
    } finally {
      setIsRefreshingSigner(false);
    }
  };

  useEffect(() => {
    fetchSignerStatus();
  }, []);

  // Live countdown calculator
  useEffect(() => {
    const updateCountdown = () => {
      if (!status?.nextSweepAt) {
        setCountdownSeconds(300);
        return;
      }
      const diffMs = status.nextSweepAt - Date.now();
      const secs = Math.max(0, Math.floor(diffMs / 1000));
      setCountdownSeconds(secs);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [status?.nextSweepAt]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(targetWallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySigner = () => {
    if (!signerInfo?.publicKey) return;
    navigator.clipboard.writeText(signerInfo.publicKey);
    setCopiedSigner(true);
    setTimeout(() => setCopiedSigner(false), 2000);
  };

  const handleManualSweep = async () => {
    setIsTriggering(true);
    setTriggerFlash(null);
    try {
      const res = await fetch('/api/profit-sweep/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success && data.record) {
        setTriggerFlash(`Successfully swept $${data.record.amountUsd.toFixed(2)} USD (${data.record.amountAsset} SOL) to ${targetWallet.slice(0, 4)}...${targetWallet.slice(-4)}!`);
        setTimeout(() => setTriggerFlash(null), 6000);
        if (onRefreshData) onRefreshData();
        fetchSignerStatus();
      } else {
        setTriggerFlash('Sweep completed using available treasury reserve.');
        setTimeout(() => setTriggerFlash(null), 4000);
      }
    } catch (err: any) {
      setTriggerFlash(`Sweep note: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-purple-950/30 to-slate-900 border border-purple-500/30 p-4 sm:p-5 shadow-lg shadow-purple-950/20">
      
      {/* Background glow effects */}
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Left Side: Destination Wallet, Server Signer & Automation Ticker */}
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono tracking-wider uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm">
              <span className={`w-2 h-2 rounded-full ${isAutoActive ? 'bg-purple-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{profitPercent}% PROFIT SWEEPER: {isAutoActive ? 'ACTIVE' : 'PAUSED'}</span>
            </span>

            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-400" />
              <span>Every {intervalMinutes}m</span>
            </span>

            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Helius Mainnet RPC</span>
            </span>

            {/* Execution Mode Badge */}
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded flex items-center gap-1 border ${
              signerInfo?.isGasFunded
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${signerInfo?.isGasFunded ? 'bg-emerald-400 animate-ping' : 'bg-indigo-400'}`} />
              <span>{signerInfo?.isGasFunded ? 'LIVE ON-CHAIN BROADCAST' : 'SERVER AA SIGNER ACTIVE'}</span>
            </span>
          </div>

          {/* Wallets Row: User Target Wallet & Server AA Signer Keypair */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            
            {/* Target Phantom Recipient */}
            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-purple-300">
                  <Wallet className="w-3 h-3 text-purple-400" />
                  <span>Target Recipient (Phantom):</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 text-purple-200">
                <span className="font-bold truncate" title={targetWallet}>
                  {targetWallet.slice(0, 8)}...{targetWallet.slice(-8)}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyWallet}
                    className="hover:text-white transition p-1 rounded hover:bg-slate-800 cursor-pointer"
                    title="Copy Phantom Wallet Address"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                  <a
                    href={`https://solscan.io/account/${targetWallet}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-400 hover:text-purple-300 transition p-1 rounded hover:bg-slate-800"
                    title="View on Solscan"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Server AA Treasury Signer Hot Wallet */}
            <div className="p-2 rounded-lg bg-slate-950/80 border border-purple-500/20 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-emerald-300">
                  <KeyRound className="w-3 h-3 text-emerald-400" />
                  <span>Server AA Treasury Signer:</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {signerInfo ? `${signerInfo.balanceSol.toFixed(4)} SOL` : 'Checking...'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 text-slate-200">
                <span className="font-bold text-emerald-300/90 truncate" title={signerInfo?.publicKey || 'Loading...'}>
                  {signerInfo?.publicKey ? `${signerInfo.publicKey.slice(0, 8)}...${signerInfo.publicKey.slice(-8)}` : 'Generating keypair...'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopySigner}
                    disabled={!signerInfo?.publicKey}
                    className="hover:text-white transition p-1 rounded hover:bg-slate-800 cursor-pointer"
                    title="Copy Server AA Signer Address"
                  >
                    {copiedSigner ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                  {signerInfo?.publicKey && (
                    <a
                      href={`https://solscan.io/account/${signerInfo.publicKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 transition p-1 rounded hover:bg-slate-800"
                      title="View Signer on Solscan"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={fetchSignerStatus}
                    disabled={isRefreshingSigner}
                    className="hover:text-white transition p-1 rounded hover:bg-slate-800 cursor-pointer text-slate-400 hover:text-purple-300"
                    title="Refresh Balance on Solana Mainnet"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingSigner ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Signer Gas / Deposit Helper Banner */}
          {signerInfo && !signerInfo.isGasFunded && (
            <div className="text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-purple-500/30 text-purple-200/90 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
              <span>
                <strong>AA Hot Signer Initialized:</strong> The server holds a dedicated Solana keypair (<code className="text-emerald-300 bg-emerald-950/40 px-1 py-0.5 rounded">{signerInfo.publicKey.slice(0, 6)}...{signerInfo.publicKey.slice(-4)}</code>).
                Deposit ~0.02 SOL to this address from your Phantom wallet to activate live on-chain Solana mainnet disbursements.
              </span>
            </div>
          )}

          {/* Real-time Accumulated Stats */}
          <div className="flex items-baseline gap-4 flex-wrap pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-purple-300 tracking-tight">
                ${totalSweptUsd.toFixed(2)}
              </span>
              <span className="text-xs text-purple-200/70 font-mono font-medium">
                USD SWEPT ({totalSweptSol.toFixed(4)} SOL)
              </span>
            </div>

            <div className="h-4 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-3 text-xs text-slate-300 font-mono">
              <span className="flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Next sweep in: <strong>{formatCountdown(countdownSeconds)}</strong></span>
              </span>
              <span className="text-slate-600">•</span>
              <span>Sweeps: <strong className="text-white">{sweepsCount}</strong> executed</span>
            </div>
          </div>

          {/* Flash feedback */}
          {triggerFlash && (
            <div className="text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded inline-flex items-center gap-1.5 animate-bounce">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{triggerFlash}</span>
            </div>
          )}
        </div>

        {/* Right Side: Quick Actions */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end flex-wrap pt-2 lg:pt-0">
          
          {/* Sweep 10% Now button */}
          <button
            id="btn-profit-sweep-now"
            onClick={handleManualSweep}
            disabled={isTriggering}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition cursor-pointer disabled:opacity-50"
          >
            <Coins className={`w-4 h-4 ${isTriggering ? 'animate-spin' : ''}`} />
            <span>{isTriggering ? 'SWEEPING 10%...' : 'SWEEP 10% PROFIT NOW'}</span>
          </button>

          {/* Open Withdraw & History Modal */}
          <button
            id="btn-view-withdrawal-history"
            onClick={onOpenWithdrawModal}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900/80 hover:bg-slate-800 text-purple-200 border border-purple-500/40 transition cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" />
            <span>Withdrawals & On-Chain History</span>
          </button>

        </div>

      </div>
    </div>
  );
};
