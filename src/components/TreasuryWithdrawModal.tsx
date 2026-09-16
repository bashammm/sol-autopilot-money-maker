import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  CheckCircle2, 
  ExternalLink, 
  AlertCircle, 
  X, 
  Coins, 
  ShieldCheck, 
  Clock, 
  Copy, 
  Check,
  RefreshCw,
  Sparkles,
  Link2,
  HelpCircle,
  KeyRound
} from 'lucide-react';
import { CapitalBuckets, TreasuryWithdrawalRecord, TreasurySignerInfo } from '../types/yabbai';

interface TreasuryWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  capitalBuckets?: CapitalBuckets;
  connectedPhantomAddress?: string;
  onConnectPhantom?: () => Promise<string | null>;
  onWithdrawSuccess?: () => void;
}

// Base58 encoder for Phantom raw signatures
const encodeBase58 = (bytes: Uint8Array): string => {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += bytes[i];
    let carry = 0;
    for (let j = 0; j < digits.length; ++j) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let res = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) res += '1';
  for (let i = digits.length - 1; i >= 0; i--) res += ALPHABET[digits[i]];
  return res;
};

const TARGET_WALLET_ADDRESS = 'HKjCGdas7CVkSwQHi6Bhckj2U2P8rtTyMbikdY5pkXcb';

export const TreasuryWithdrawModal: React.FC<TreasuryWithdrawModalProps> = ({
  isOpen,
  onClose,
  capitalBuckets,
  connectedPhantomAddress = '',
  onConnectPhantom,
  onWithdrawSuccess
}) => {
  const [recipientAddress, setRecipientAddress] = useState(connectedPhantomAddress || TARGET_WALLET_ADDRESS);
  const [amountUsd, setAmountUsd] = useState('');
  const [asset, setAsset] = useState<'SOL' | 'USDC'>('SOL');
  const [sourceBucket, setSourceBucket] = useState<keyof CapitalBuckets>('treasuryReserveUsd');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRecord, setSuccessRecord] = useState<TreasuryWithdrawalRecord | null>(null);
  const [withdrawalsHistory, setWithdrawalsHistory] = useState<TreasuryWithdrawalRecord[]>([]);
  const [onChainTransactions, setOnChainTransactions] = useState<any[]>([]);
  const [profitSweepStatus, setProfitSweepStatus] = useState<any>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [copiedSig, setCopiedSig] = useState(false);
  const [activeTab, setActiveTab] = useState<'withdraw' | 'history'>('withdraw');
  const [historyFilter, setHistoryFilter] = useState<'onchain' | 'sweeps' | 'all'>('onchain');
  const [isConnectingPhantom, setIsConnectingPhantom] = useState(false);

  // Real-time On-chain & Market Data States
  const [liveSolPrice, setLiveSolPrice] = useState<number>(96.80);
  const [priceSource, setPriceSource] = useState<string>('binance');
  const [cluster, setCluster] = useState<'mainnet-beta' | 'devnet'>('mainnet-beta');
  const [walletBalanceSol, setWalletBalanceSol] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [signerInfo, setSignerInfo] = useState<TreasurySignerInfo | null>(null);
  const [copiedSigner, setCopiedSigner] = useState(false);
  const [isRequestingAirdrop, setIsRequestingAirdrop] = useState(false);
  const [airdropSuccessMsg, setAirdropSuccessMsg] = useState<string | null>(null);

  // Sync recipient address if connected wallet changes
  useEffect(() => {
    if (connectedPhantomAddress) {
      setRecipientAddress(connectedPhantomAddress);
    }
  }, [connectedPhantomAddress]);

  // Load live market price and cluster status when modal opens
  useEffect(() => {
    if (isOpen) {
      loadMarketPriceAndCluster();
      loadHistory();
      fetchSignerInfo();
      setError(null);
      setSuccessRecord(null);
    }
  }, [isOpen]);

  const fetchSignerInfo = async () => {
    try {
      const res = await fetch('/api/treasury/signer');
      if (res.ok) {
        const data = await res.json();
        setSignerInfo(data);
      }
    } catch {
      // ignore
    }
  };

  const handleRequestDevnetAirdrop = async (targetAddr?: string) => {
    setIsRequestingAirdrop(true);
    setError(null);
    setAirdropSuccessMsg(null);
    try {
      const res = await fetch('/api/solana/airdrop-devnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: targetAddr || signerInfo?.publicKey,
          amountSol: 0.5
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request Devnet SOL airdrop');
      }
      setAirdropSuccessMsg(`Airdropped 0.5 SOL! On-chain balance: ${data.newBalanceSol} SOL`);
      fetchSignerInfo();
      if (recipientAddress) fetchWalletBalance(recipientAddress);
      if (onWithdrawSuccess) onWithdrawSuccess();
    } catch (err: any) {
      setError(err.message || 'Devnet airdrop request failed');
    } finally {
      setIsRequestingAirdrop(false);
    }
  };

  // Query on-chain wallet balance when recipient address changes and is valid
  useEffect(() => {
    const trimmed = recipientAddress.trim();
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
      fetchWalletBalance(trimmed);
    } else {
      setWalletBalanceSol(null);
    }
  }, [recipientAddress, cluster]);

  const loadMarketPriceAndCluster = async () => {
    try {
      const [priceRes, clusterRes] = await Promise.all([
        fetch('/api/solana/price').then(r => r.json()).catch(() => null),
        fetch('/api/solana/cluster').then(r => r.json()).catch(() => null)
      ]);

      if (priceRes?.solPriceUsd) {
        setLiveSolPrice(priceRes.solPriceUsd);
        if (priceRes.source) setPriceSource(priceRes.source);
      }
      if (clusterRes?.cluster) {
        setCluster(clusterRes.cluster);
      }
    } catch {
      // fallback to cached
    }
  };

  const fetchWalletBalance = async (addr: string) => {
    setIsLoadingBalance(true);
    try {
      const res = await fetch(`/api/solana/balance/${encodeURIComponent(addr)}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.balanceSol === 'number') {
          setWalletBalanceSol(data.balanceSol);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleClusterToggle = async (newCluster: 'mainnet-beta' | 'devnet') => {
    setCluster(newCluster);
    try {
      await fetch('/api/solana/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cluster: newCluster })
      });
      if (recipientAddress.trim()) {
        fetchWalletBalance(recipientAddress.trim());
      }
    } catch {
      // ignore
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const queryAddr = recipientAddress.trim() || TARGET_WALLET_ADDRESS;
      const res = await fetch(`/api/treasury/withdrawals?address=${encodeURIComponent(queryAddr)}`);
      if (res.ok) {
        const data = await res.json();
        setWithdrawalsHistory(data.withdrawals || []);
        setOnChainTransactions(data.onChainTransactions || []);
        if (data.profitSweep) setProfitSweepStatus(data.profitSweep);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const currentAvailableUsd = capitalBuckets ? (capitalBuckets[sourceBucket] || 0) : 0;
  const parsedAmountUsd = parseFloat(amountUsd) || 0;
  const calculatedAssetAmount = asset === 'SOL' 
    ? (parsedAmountUsd / liveSolPrice).toFixed(4)
    : parsedAmountUsd.toFixed(2);

  // Validate Solana Base58 address (32-44 chars)
  const isValidAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(recipientAddress.trim());

  const handleConnectPhantomInternal = async () => {
    setIsConnectingPhantom(true);
    setError(null);
    try {
      if (onConnectPhantom) {
        const addr = await onConnectPhantom();
        if (addr) {
          setRecipientAddress(addr);
          return;
        }
      }

      // Check window.phantom or window.solana directly
      const solana = (window as any).phantom?.solana || (window as any).solana;
      if (solana?.isPhantom) {
        const resp = await solana.connect();
        const pubkey = resp.publicKey.toString();
        setRecipientAddress(pubkey);
      } else {
        setError('Phantom wallet extension not detected in your browser. You can install it at phantom.app, or paste your Solana wallet address directly below.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Phantom wallet');
    } finally {
      setIsConnectingPhantom(false);
    }
  };

  const handleApplyPreset = (percent: number) => {
    const calculated = (currentAvailableUsd * (percent / 100));
    setAmountUsd(calculated.toFixed(2));
    setError(null);
  };

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessRecord(null);

    if (!isValidAddress) {
      setError('Please enter a valid Solana/Phantom wallet public key (32-44 base58 characters).');
      return;
    }

    if (parsedAmountUsd <= 0) {
      setError('Please enter a withdrawal amount greater than $0.');
      return;
    }

    if (parsedAmountUsd > currentAvailableUsd) {
      setError(`Requested amount ($${parsedAmountUsd.toFixed(2)}) exceeds available ${sourceBucket === 'treasuryReserveUsd' ? 'Treasury' : 'Customer'} funds ($${currentAvailableUsd.toFixed(2)}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if Phantom is connected to optionally request non-custodial signature
      let userSig: string | undefined = undefined;
      const solana = (window as any).phantom?.solana || (window as any).solana;
      if (solana?.isPhantom && solana.publicKey?.toString() === recipientAddress.trim() && solana.signMessage) {
        try {
          const message = `YABBAI Treasury Withdrawal\nRecipient: ${recipientAddress}\nAmount: $${parsedAmountUsd.toFixed(2)} USD\nAsset: ${asset}\nTimestamp: ${Date.now()}`;
          const encoded = new TextEncoder().encode(message);
          const signed = await solana.signMessage(encoded, 'utf8');
          if (signed?.signature) {
            // Encode raw signature directly to valid Solana Base58 format
            userSig = encodeBase58(new Uint8Array(signed.signature));
          }
        } catch {
          // If user rejects signMessage, proceed with vault instruction
        }
      }

      const res = await fetch('/api/treasury/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientAddress: recipientAddress.trim(),
          amountUsd: parsedAmountUsd,
          asset,
          sourceBucket,
          userSignature: userSig,
          note: `Autonomous Treasury payout to Phantom wallet`
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to process treasury withdrawal');
      }

      setSuccessRecord(data.withdrawal);
      setAmountUsd('');
      if (onWithdrawSuccess) onWithdrawSuccess();
      loadHistory();
    } catch (err: any) {
      setError(err.message || 'Withdrawal transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSig(true);
    setTimeout(() => setCopiedSig(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>Withdraw to Phantom Wallet</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  SOLANA NON-CUSTODIAL
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Disburse verified earnings from Squads v4 Treasury Vault to your personal wallet
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Cluster Switcher */}
            <div className="flex items-center rounded-md bg-slate-950 border border-slate-800 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleClusterToggle('mainnet-beta')}
                className={`px-2 py-0.5 rounded font-mono text-[10px] transition cursor-pointer ${
                  cluster === 'mainnet-beta'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mainnet
              </button>
              <button
                type="button"
                onClick={() => handleClusterToggle('devnet')}
                className={`px-2 py-0.5 rounded font-mono text-[10px] transition cursor-pointer ${
                  cluster === 'devnet'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Devnet
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-800 bg-slate-950/20 px-6 pt-2">
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'withdraw'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            New Withdrawal
          </button>
          <button
            onClick={() => { setActiveTab('history'); loadHistory(); }}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Withdrawal History</span>
            {withdrawalsHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {withdrawalsHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {activeTab === 'withdraw' ? (
            <>
              {/* Success Notification Banner */}
              {successRecord && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="font-bold text-sm text-emerald-300">
                        Withdrawal Successfully Confirmed!
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {successRecord.onChainVerified && successRecord.disbursementMode === 'REAL_ON_CHAIN'
                        ? 'MAINNET ON-CHAIN BROADCAST'
                        : 'STRATEGY SIMULATION LEDGER'}
                    </span>
                  </div>

                  <p className="text-xs text-emerald-300/80">
                    {successRecord.onChainVerified && successRecord.disbursementMode === 'REAL_ON_CHAIN' ? (
                      <>Transferred <span className="font-mono font-bold text-white">{successRecord.amountAsset} {successRecord.asset}</span> (${successRecord.amountUsd.toFixed(2)} USD) directly on Solana blockchain.</>
                    ) : (
                      <>Allocated <span className="font-mono font-bold text-white">{successRecord.amountAsset} {successRecord.asset}</span> (${successRecord.amountUsd.toFixed(2)} USD) in the non-custodial strategy ledger.</>
                    )}
                  </p>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-emerald-500/20 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        {successRecord.onChainVerified && !successRecord.transactionSignature.startsWith('internal-') ? 'Solana Tx Hash:' : 'Disbursement Reference:'}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-300 truncate max-w-[200px]">{successRecord.transactionSignature}</span>
                        <button
                          onClick={() => copyToClipboard(successRecord.transactionSignature)}
                          className="p-1 hover:text-white text-slate-400 transition"
                          title="Copy Reference"
                        >
                          {copiedSig ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Solscan Verification:</span>
                      <a
                        href={successRecord.onChainVerified && !successRecord.transactionSignature.startsWith('internal-') && successRecord.transactionSignature.length >= 64
                          ? `https://solscan.io/tx/${successRecord.transactionSignature}`
                          : `https://solscan.io/account/${successRecord.recipientAddress}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1"
                      >
                        <span>
                          {successRecord.onChainVerified && !successRecord.transactionSignature.startsWith('internal-') && successRecord.transactionSignature.length >= 64
                            ? 'Verify Tx on Solscan'
                            : 'View Wallet on Solscan'
                          }
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Server-Side AA Treasury Signer Card */}
              <div className="p-3 rounded-xl bg-slate-950/90 border border-purple-500/30 text-xs space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-purple-300 font-bold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                    <span>SERVER AA TREASURY SIGNER</span>
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${
                    signerInfo?.isGasFunded
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-bold'
                      : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                  }`}>
                    {signerInfo?.isGasFunded ? 'LIVE ON-CHAIN BROADCAST ACTIVE' : 'AA SIGNER INITIALIZED (SERVER)'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="space-y-0.5 truncate">
                    <span className="text-slate-400 block text-[10px]">Signer Address (Hot Wallet):</span>
                    <span className="text-emerald-300 font-bold truncate block" title={signerInfo?.publicKey || ''}>
                      {signerInfo?.publicKey || 'Loading keypair...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (signerInfo?.publicKey) {
                          navigator.clipboard.writeText(signerInfo.publicKey);
                          setCopiedSigner(true);
                          setTimeout(() => setCopiedSigner(false), 2000);
                        }
                      }}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                      title="Copy Signer Address"
                    >
                      {copiedSigner ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                    {signerInfo?.publicKey && (
                      <a
                        href={`https://solscan.io/account/${signerInfo.publicKey}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition"
                        title="View Signer on Solscan"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-300 pt-0.5">
                  <span>Signer On-Chain Balance:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">
                      {signerInfo ? `${signerInfo.balanceSol.toFixed(4)} SOL ($${signerInfo.balanceUsd.toFixed(2)})` : '...'}
                    </span>
                    {cluster === 'devnet' && (
                      <button
                        type="button"
                        onClick={() => handleRequestDevnetAirdrop()}
                        disabled={isRequestingAirdrop}
                        className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition cursor-pointer"
                      >
                        {isRequestingAirdrop ? 'Airdropping...' : '+ Airdrop 0.5 SOL'}
                      </button>
                    )}
                  </div>
                </div>

                {airdropSuccessMsg && (
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{airdropSuccessMsg}</span>
                  </div>
                )}

                <div className="text-slate-400 text-[10px] leading-relaxed pt-1 border-t border-slate-800/80 space-y-1">
                  <p className="text-purple-300/90 font-medium">
                    🔐 <strong>Private Key Security:</strong> You do <em>not</em> need to share your private key. YABBAI uses its own server-side AA Treasury Keypair to sign transactions and transfer real SOL directly to your destination Phantom wallet.
                  </p>
                  <p className="text-slate-400">
                    To execute live transfers, the Treasury Signer address above needs SOL. On Devnet, click &quot;+ Airdrop 0.5 SOL&quot;. On Mainnet, send SOL to the Signer address above.
                  </p>
                </div>
              </div>

              {/* Error Notice */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-rose-300">Withdrawal Notice</p>
                    <p className="text-rose-300/80">{error}</p>
                    {error.includes('phantom.app') && (
                      <a
                        href="https://phantom.app"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-purple-300 underline hover:text-purple-200 text-xs mt-1"
                      >
                        <span>Download Phantom Extension</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
                
                {/* Available Capital Source Banner */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Available Source Bucket:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <select
                        value={sourceBucket}
                        onChange={(e) => setSourceBucket(e.target.value as keyof CapitalBuckets)}
                        className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1 font-mono focus:outline-none focus:border-purple-500"
                      >
                        <option value="treasuryReserveUsd">Treasury Reserve (20%)</option>
                        <option value="userCustomerFundsUsd">User / Customer Funds (5%)</option>
                        <option value="growthReinvestmentUsd">Growth Reinvestment (20%)</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Available Balance:</span>
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      ${currentAvailableUsd.toFixed(2)} <span className="text-xs text-slate-500">USD</span>
                    </span>
                  </div>
                </div>

                {/* Recipient Phantom Address */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-purple-400" />
                      <span>Phantom / Solana Wallet Recipient</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRecipientAddress(TARGET_WALLET_ADDRESS)}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded border transition cursor-pointer flex items-center gap-1 ${
                          recipientAddress === TARGET_WALLET_ADDRESS
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span>Target: HKjCG...Xcb</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleConnectPhantomInternal}
                        disabled={isConnectingPhantom}
                        className="text-xs font-semibold text-purple-300 hover:text-purple-200 flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition cursor-pointer"
                      >
                        <Link2 className="w-3 h-3" />
                        <span>{isConnectingPhantom ? 'Connecting...' : connectedPhantomAddress ? 'Re-connect Phantom' : 'Auto-fill Phantom'}</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      value={recipientAddress}
                      onChange={(e) => { setRecipientAddress(e.target.value); setError(null); }}
                      placeholder="e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                      className={`w-full bg-slate-950 text-slate-200 font-mono text-xs px-3 py-2.5 rounded-lg border focus:outline-none transition ${
                        recipientAddress && !isValidAddress 
                          ? 'border-rose-500 focus:border-rose-400' 
                          : recipientAddress && isValidAddress 
                          ? 'border-emerald-500/60 focus:border-emerald-500' 
                          : 'border-slate-700 focus:border-purple-500'
                      }`}
                      required
                    />
                    {recipientAddress && isValidAddress && (
                      <span className="absolute right-3 top-2.5 text-emerald-400 text-xs flex items-center gap-1 font-mono">
                        <Check className="w-3.5 h-3.5" />
                        <span>Valid Solana Key</span>
                      </span>
                    )}
                  </div>
                  {recipientAddress && isValidAddress && (
                    <div className="flex items-center justify-between text-[11px] font-mono px-1 py-0.5 rounded bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>Live On-Chain Balance ({cluster}):</span>
                      </span>
                      <span className="text-emerald-400 font-semibold">
                        {isLoadingBalance ? (
                          <span className="text-slate-500 animate-pulse">Querying Solana RPC...</span>
                        ) : walletBalanceSol !== null ? (
                          `${walletBalanceSol.toFixed(4)} SOL ($${(walletBalanceSol * liveSolPrice).toFixed(2)} USD)`
                        ) : (
                          <span className="text-slate-500">0.0000 SOL</span>
                        )}
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Vault will send funds directly from Squads v4 vault (<code className="text-purple-300 font-mono text-[10px]">SQDv4XwZ...</code>) to this address.
                  </p>
                </div>

                {/* Asset & Amount Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Asset */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span>Payout Asset</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAsset('SOL')}
                        className={`px-3 py-2 rounded-lg text-xs font-mono font-semibold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          asset === 'SOL'
                            ? 'bg-purple-500/20 text-purple-200 border-purple-500 shadow-sm'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                        <span>SOL (${liveSolPrice.toFixed(2)})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAsset('USDC')}
                        className={`px-3 py-2 rounded-lg text-xs font-mono font-semibold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          asset === 'USDC'
                            ? 'bg-blue-500/20 text-blue-200 border-blue-500 shadow-sm'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        <span>USDC (SPL)</span>
                      </button>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">Amount (USD)</label>
                      <span className="text-[10px] text-slate-500 font-mono">Max: ${currentAvailableUsd.toFixed(2)}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-mono text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max={currentAvailableUsd}
                        value={amountUsd}
                        onChange={(e) => { setAmountUsd(e.target.value); setError(null); }}
                        placeholder="0.00"
                        className="w-full bg-slate-950 text-slate-200 font-mono text-xs pl-7 pr-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>
                  </div>

                </div>

                {/* Quick Fill Preset Buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Quick fill:</span>
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleApplyPreset(pct)}
                      className="px-2.5 py-1 rounded text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                    >
                      {pct === 100 ? 'MAX' : `${pct}%`}
                    </button>
                  ))}
                </div>

                {/* Live Settlement Breakdown */}
                {parsedAmountUsd > 0 && (
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-2">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-slate-400">Treasury Payout:</span>
                      <span className="text-white font-bold">${parsedAmountUsd.toFixed(2)} USD</span>
                    </div>
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-slate-400">You Receive in Phantom:</span>
                      <span className="text-purple-300 font-bold">
                        {calculatedAssetAmount} {asset}
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Live Market Rate:</span>
                      <span className="text-slate-300">1 SOL = ${liveSolPrice.toFixed(2)} USD ({priceSource})</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px] border-t border-slate-800/60 pt-1.5">
                      <span className="text-slate-500">Solana Network Fee:</span>
                      <span className="text-emerald-400">0.000005 SOL (~$0.0005)</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-500">Estimated Settlement:</span>
                      <span className="text-slate-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Instant (&lt; 400ms finality)</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || parsedAmountUsd <= 0 || !isValidAddress || parsedAmountUsd > currentAvailableUsd}
                    className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-purple-900/20"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Broadcasting to Solana...</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Confirm Withdrawal to Phantom</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
                <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('onchain')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      historyFilter === 'onchain'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Live On-Chain ({onChainTransactions.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('sweeps')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      historyFilter === 'sweeps'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>10% Sweeps</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('all')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      historyFilter === 'all'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>All ({withdrawalsHistory.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-mono text-[11px] truncate max-w-[150px]">
                    {recipientAddress.slice(0, 4)}...{recipientAddress.slice(-4)}
                  </span>
                  <button
                    onClick={loadHistory}
                    className="hover:text-white text-slate-400 flex items-center gap-1 transition cursor-pointer"
                    title="Refresh from Solana RPC"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    <span>Sync RPC</span>
                  </button>
                </div>
              </div>

              {/* Solscan Verification Guide Info Banner */}
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-200">Solscan Verification Integrity</span>
                  <p className="text-slate-400 leading-relaxed text-[10.5px]">
                    • <strong className="text-emerald-400">Live On-Chain</strong>: Confirmed Solana transactions streamed from Helius RPC. Links open verified block receipts directly on Solscan.
                    <br />
                    • <strong className="text-purple-400">10% Sweeps &amp; Ledger Settlements</strong>: Algorithmic yield harvests credited to your treasury balance. Links open your public Solana wallet overview on Solscan.
                  </p>
                </div>
              </div>

              {/* View 1: Real Live On-Chain Solana Mainnet Transactions */}
              {historyFilter === 'onchain' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Helius RPC Confirmed Mainnet Transactions</span>
                    </span>
                    <span>Target: {TARGET_WALLET_ADDRESS.slice(0, 6)}...{TARGET_WALLET_ADDRESS.slice(-4)}</span>
                  </div>

                  {onChainTransactions.length === 0 ? (
                    <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs space-y-2">
                      <Coins className="w-6 h-6 mx-auto text-slate-600" />
                      <p>Querying real on-chain transaction history from Helius / QuickNode...</p>
                      <p className="text-[11px] text-slate-500 font-mono">Address: {recipientAddress}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {onChainTransactions.map((tx, idx) => (
                        <div
                          key={tx.signature || idx}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs space-y-1.5 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-sm">
                                {tx.amountSol ? tx.amountSol.toFixed(4) : '0.0001'} SOL
                              </span>
                              <span className="text-emerald-400 font-mono text-[11px]">
                                (~${tx.amountUsd ? tx.amountUsd.toFixed(2) : (0.0001 * liveSolPrice).toFixed(2)} USD)
                              </span>
                            </div>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                              tx.status === 'CONFIRMED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>{tx.status}</span>
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                            <div>
                              <span className="text-slate-500">Slot:</span>{' '}
                              <span className="text-slate-300">{tx.slot?.toLocaleString() || 'Confirmed'}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-500">Time:</span>{' '}
                              <span className="text-slate-300">
                                {new Date(tx.timestamp || tx.blockTime * 1000).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                            <span className="text-slate-500 font-mono text-[10px] truncate max-w-[180px]">
                              Sig: {tx.signature ? `${tx.signature.slice(0, 8)}...${tx.signature.slice(-8)}` : 'On-Chain Proof'}
                            </span>
                            <a
                              href={tx.solscanUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 font-mono text-[10px]"
                            >
                              <span>Verify on Solscan</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* View 2: Automated 10% Profit Sweeps */}
              {historyFilter === 'sweeps' && (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200 flex items-center justify-between">
                    <span>Automated Profit Share: <strong>10% of earnings</strong></span>
                    <span className="font-mono">Every 5 min</span>
                  </div>

                  {withdrawalsHistory.filter(w => w.note?.includes('Profit Sweep') || w.note?.includes('5m cycle')).length === 0 ? (
                    <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs space-y-2">
                      <Clock className="w-6 h-6 mx-auto text-slate-600" />
                      <p>The 5-minute automated profit sweep loop is running in the background.</p>
                      <button
                        onClick={async () => {
                          await fetch('/api/profit-sweep/trigger', { method: 'POST' });
                          loadHistory();
                        }}
                        className="text-purple-400 hover:underline font-semibold"
                      >
                        Trigger immediate test sweep now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {withdrawalsHistory
                        .filter(w => w.note?.includes('Profit Sweep') || w.note?.includes('5m cycle'))
                        .map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl bg-slate-950 border border-purple-500/20 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-white text-sm">
                                  {item.amountAsset} {item.asset}
                                </span>
                                <span className="text-purple-300 font-mono text-[11px]">
                                  (${item.amountUsd.toFixed(2)} USD)
                                </span>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>10% SWEPT</span>
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 font-mono">
                              {item.note || 'Automated 10% Profit Sweep'}
                            </p>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                              <span className="text-slate-500 font-mono text-[10px]">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <a
                                href={`https://solscan.io/account/${item.recipientAddress || TARGET_WALLET_ADDRESS}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 font-mono text-[10px]"
                                title="View Recipient Public Solana Account on Solscan"
                              >
                                <span>View Wallet on Solscan</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* View 3: All Disbursements */}
              {historyFilter === 'all' && (
                <div className="space-y-2">
                  {withdrawalsHistory.length === 0 ? (
                    <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs space-y-2">
                      <Coins className="w-6 h-6 mx-auto text-slate-600" />
                      <p>No treasury withdrawals executed yet.</p>
                      <button
                        onClick={() => setActiveTab('withdraw')}
                        className="text-purple-400 hover:underline font-semibold"
                      >
                        Initiate withdrawal now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {withdrawalsHistory.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-sm">
                                {item.amountAsset} {item.asset}
                              </span>
                              <span className="text-slate-500 font-mono text-[11px]">
                                (${item.amountUsd.toFixed(2)} USD)
                              </span>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>{item.status}</span>
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                            <div>
                              <span className="text-slate-500">Recipient:</span>{' '}
                              <span className="text-slate-300 truncate inline-block max-w-[140px] align-bottom">
                                {item.recipientAddress}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-500">Date:</span>{' '}
                              <span className="text-slate-300">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                            <span className="text-slate-500 font-mono text-[10px]">
                              Vault: {item.squadsVaultAddress?.slice(0, 8)}...
                            </span>
                            <a
                              href={item.onChainVerified && item.transactionSignature && !item.transactionSignature.startsWith('internal-') && item.transactionSignature.length >= 64
                                ? `https://solscan.io/tx/${item.transactionSignature}`
                                : `https://solscan.io/account/${item.recipientAddress || TARGET_WALLET_ADDRESS}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 font-mono text-[10px]"
                              title={item.onChainVerified ? 'Verify On-Chain Transaction on Solscan' : 'View Recipient Wallet on Solscan'}
                            >
                              <span>
                                {item.onChainVerified && item.transactionSignature && !item.transactionSignature.startsWith('internal-') && item.transactionSignature.length >= 64
                                  ? 'Verify Tx on Solscan'
                                  : 'View Wallet on Solscan'
                                }
                              </span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
