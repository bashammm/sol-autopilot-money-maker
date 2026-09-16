import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShoppingBag, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  Copy, 
  ArrowRight, 
  Key, 
  ShieldCheck, 
  Zap, 
  FileText, 
  Wallet, 
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Product, CustomerOrder, PaymentEvidence } from '../types/yabbai';
import { getPhantomProvider } from '../services/phantomWallet';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

interface CustomerStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  solPriceUsd: number;
  cluster: 'mainnet-beta' | 'devnet';
  connectedWallet?: string;
  onPaymentVerified?: () => void;
}

export const CustomerStoreModal: React.FC<CustomerStoreModalProps> = ({
  isOpen,
  onClose,
  solPriceUsd,
  cluster,
  connectedWallet,
  onPaymentVerified
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Active Checkout State
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<any>(null);
  const [checkoutStep, setCheckoutStep] = useState<'SELECT' | 'PAYING' | 'VERIFYING' | 'FULFILLED' | 'FAILED'>('SELECT');
  const [txSignature, setTxSignature] = useState('');
  const [manualTxInput, setManualTxInput] = useState('');
  const [manualOrderIdInput, setManualOrderIdInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'MANUAL_VERIFY' | 'EVIDENCE'>('CATALOG');
  const [evidenceList, setEvidenceList] = useState<PaymentEvidence[]>([]);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      fetchEvidence();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/payments/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        if (data.products?.length > 0 && !selectedProduct) {
          setSelectedProduct(data.products[0]);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchEvidence = async () => {
    try {
      const res = await fetch('/api/payments/evidence');
      if (res.ok) {
        const data = await res.json();
        setEvidenceList(data.evidence || []);
      }
    } catch {
      // Ignore
    }
  };

  // STEP 1: CREATE ORDER
  const handleInitiateOrder = async (product: Product) => {
    setSelectedProduct(product);
    setIsProcessing(true);
    setErrorMessage(null);
    setCheckoutStep('PAYING');

    try {
      const res = await fetch('/api/payments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          customerWallet: connectedWallet
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      setOrder(data.order);
      setPaymentInstructions(data.paymentInstructions);
    } catch (err: any) {
      setErrorMessage(err.message);
      setCheckoutStep('FAILED');
    } finally {
      setIsProcessing(false);
    }
  };

  // STEP 2: PHANTOM SIGNS & BROADCASTS
  const handlePayWithPhantom = async () => {
    if (!order || !paymentInstructions) return;

    const provider = getPhantomProvider();
    if (!provider) {
      setErrorMessage('Phantom wallet extension is not detected. Please install Phantom or use the manual transfer instructions below.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Connect if not connected
      let senderPubkey = provider.publicKey;
      if (!senderPubkey) {
        const connectResp = await provider.connect();
        senderPubkey = connectResp.publicKey;
      }

      const sender = senderPubkey.toBase58();
      const recipient = new PublicKey(paymentInstructions.recipient);
      const referenceKey = new PublicKey(paymentInstructions.referenceKey);
      const lamports = Math.round(order.amountDue * LAMPORTS_PER_SOL);

      // Fetch fresh blockhash from backend RPC
      const bhRes = await fetch('/api/solana/blockhash');
      const bhData = await bhRes.json();

      const tx = new Transaction({
        recentBlockhash: bhData.blockhash,
        feePayer: senderPubkey
      });

      // Transfer instruction
      const transferIx = SystemProgram.transfer({
        fromPubkey: senderPubkey,
        toPubkey: recipient,
        lamports
      });

      // Append reference key as uncredited read-only key for Solana Pay correlation
      transferIx.keys.push({
        pubkey: referenceKey,
        isWritable: false,
        isSigner: false
      });

      tx.add(transferIx);

      // Prompt Phantom extension to sign and broadcast
      const { signature } = await provider.signAndSendTransaction(tx);
      setTxSignature(signature);
      setCheckoutStep('VERIFYING');

      // STEP 3: YABBAI VERIFIES ON-CHAIN TRANSACTION
      await pollAndVerifyTransaction(order.order_id, signature);
    } catch (err: any) {
      setErrorMessage(err.message || 'Phantom signing failed or was rejected.');
      setIsProcessing(false);
    }
  };

  // Poll & verify authoritative on-chain settlement
  const pollAndVerifyTransaction = async (orderId: string, signature: string) => {
    setIsProcessing(true);
    let attempts = 0;
    const maxAttempts = 15;

    const check = async () => {
      attempts++;
      try {
        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            transactionSignature: signature
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setOrder(data.order);
          setCheckoutStep('FULFILLED');
          setIsProcessing(false);
          fetchEvidence();
          if (onPaymentVerified) {
            onPaymentVerified();
          }
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(check, 2000);
        } else {
          setErrorMessage('Transaction broadcasted, but on-chain confirmation is taking longer than usual. You can verify it manually anytime.');
          setIsProcessing(false);
        }
      } catch (err: any) {
        if (attempts < maxAttempts) {
          setTimeout(check, 2000);
        } else {
          setErrorMessage(`Verification error: ${err.message}`);
          setIsProcessing(false);
        }
      }
    };

    check();
  };

  // Manual verification of transaction signature
  const handleManualVerify = async () => {
    if (!manualTxInput || !manualOrderIdInput) {
      setErrorMessage('Both Order ID and Transaction Signature are required.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: manualOrderIdInput.trim(),
          transactionSignature: manualTxInput.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setOrder(data.order);
      setTxSignature(manualTxInput.trim());
      setCheckoutStep('FULFILLED');
      fetchEvidence();
      if (onPaymentVerified) {
        onPaymentVerified();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                YABBAI STOREFRONT &amp; REVENUE ENGINE
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  REAL SETTLEMENT
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Purchase real cryptographic deliverables with Phantom. Verified on-chain into Realized P&amp;L.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/30 px-6">
          <button
            onClick={() => { setActiveTab('CATALOG'); setCheckoutStep('SELECT'); setErrorMessage(null); }}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'CATALOG'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Product Catalog
          </button>
          <button
            onClick={() => { setActiveTab('MANUAL_VERIFY'); setErrorMessage(null); }}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'MANUAL_VERIFY'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Manual Tx Verification
          </button>
          <button
            onClick={() => { setActiveTab('EVIDENCE'); setErrorMessage(null); }}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'EVIDENCE'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Settled Evidence ({evidenceList.length})
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-300 font-mono">{errorMessage}</div>
            </div>
          )}

          {/* TAB 1: PRODUCT CATALOG & CHECKOUT */}
          {activeTab === 'CATALOG' && (
            <>
              {checkoutStep === 'SELECT' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Select a cryptographic product to test real revenue settlement:</span>
                    <span className="font-mono text-emerald-400">1 SOL ≈ ${solPriceUsd.toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {products.map(product => {
                      const priceUsd = Math.round(product.priceSol * solPriceUsd * 100) / 100;
                      return (
                        <div
                          key={product.id}
                          className={`p-4 rounded-lg border transition text-left flex flex-col justify-between ${
                            product.isTestProduct
                              ? 'bg-slate-900/60 border-emerald-500/40 hover:border-emerald-400'
                              : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {product.sku}
                              </span>
                              {product.isTestProduct && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                  LOW-COST TEST
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-sm text-white mb-1">{product.name}</h3>
                            <p className="text-xs text-slate-400 mb-3">{product.description}</p>
                          </div>

                          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                            <div>
                              <div className="font-mono font-bold text-emerald-400 text-sm">
                                {product.priceSol} SOL
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                ≈ ${priceUsd} USD
                              </div>
                            </div>
                            <button
                              id={`btn-buy-${product.sku.toLowerCase()}`}
                              onClick={() => handleInitiateOrder(product)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <span>Purchase</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP: PAYING */}
              {checkoutStep === 'PAYING' && order && paymentInstructions && (
                <div className="space-y-5">
                  <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-[11px] text-slate-400 font-mono uppercase">Order ID:</span>
                        <div className="font-mono font-bold text-white text-xs">{order.order_id}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 font-mono uppercase">Amount Due:</span>
                        <div className="font-mono font-bold text-emerald-400 text-sm">
                          {order.amountDue} SOL (${order.amountDueUsd} USD)
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Recipient Treasury:</span>
                        <span className="text-slate-200 truncate max-w-[280px]" title={paymentInstructions.recipient}>
                          {paymentInstructions.recipient}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Unique Reference Key:</span>
                        <span className="text-slate-200 truncate max-w-[280px]" title={paymentInstructions.referenceKey}>
                          {paymentInstructions.referenceKey}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cluster:</span>
                        <span className="text-emerald-400 uppercase">{cluster}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Actions */}
                  <div className="space-y-3">
                    <button
                      id="btn-confirm-pay-phantom"
                      onClick={handlePayWithPhantom}
                      disabled={isProcessing}
                      className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-purple-950"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Requesting Phantom Signature...</span>
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4" />
                          <span>Pay {order.amountDue} SOL with Phantom</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-2 justify-center text-xs text-slate-400">
                      <span>Or pay directly using Solana Pay URI:</span>
                      <a
                        href={paymentInstructions.solanaPayUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-400 hover:underline flex items-center gap-1 font-mono"
                      >
                        solana:{paymentInstructions.recipient.slice(0, 8)}... <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="pt-2 text-center">
                    <button
                      onClick={() => setCheckoutStep('SELECT')}
                      className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      ← Back to Product Catalog
                    </button>
                  </div>
                </div>
              )}

              {/* STEP: VERIFYING */}
              {checkoutStep === 'VERIFYING' && (
                <div className="text-center py-10 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto animate-pulse">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Verifying On-Chain Settlement...</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      Querying Solana cluster nodes for transaction confirmation, recipient verification, and exact amount matching.
                    </p>
                  </div>
                  {txSignature && (
                    <div className="font-mono text-xs text-slate-400">
                      Tx Signature: <span className="text-emerald-400">{txSignature.slice(0, 16)}...{txSignature.slice(-8)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* STEP: FULFILLED */}
              {checkoutStep === 'FULFILLED' && order && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-emerald-300">Payment Verified &amp; Deliverable Fulfilled!</h3>
                    <p className="text-xs text-slate-300">
                      Transaction verified on-chain. Capital loop allocated 20/20/20/30/5/5 and Realized P&amp;L updated.
                    </p>
                  </div>

                  {/* Deliverable Access Card */}
                  {order.fulfillment && (
                    <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-emerald-400" />
                          Deliverable Access Token:
                        </span>
                        <span className="text-slate-400 font-mono">
                          {new Date(order.fulfillment.fulfilledAt).toLocaleTimeString()}
                        </span>
                      </div>

                      {order.fulfillment.accessKey && (
                        <div className="flex items-center gap-2 p-2.5 rounded bg-slate-950 border border-slate-800">
                          <code className="text-xs font-mono text-emerald-400 truncate flex-1">
                            {order.fulfillment.accessKey}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(order.fulfillment?.accessKey || '');
                              setCopiedKey(true);
                              setTimeout(() => setCopiedKey(false), 2000);
                            }}
                            className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                            title="Copy Access Key"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <div className="p-3 rounded bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-line">
                        {order.fulfillment.deliverableContent}
                      </div>

                      {order.fulfillment.solscanUrl && (
                        <div className="text-right">
                          <a
                            href={order.fulfillment.solscanUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-purple-400 hover:underline font-mono"
                          >
                            View on Solscan Explorer <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => { setCheckoutStep('SELECT'); setOrder(null); }}
                    className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer"
                  >
                    Purchase Another Deliverable
                  </button>
                </div>
              )}
            </>
          )}

          {/* TAB 2: MANUAL TRANSACTION VERIFICATION */}
          {activeTab === 'MANUAL_VERIFY' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white">Verify Existing On-Chain Solana Payment</h3>
                <p className="text-xs text-slate-400">
                  If you transferred SOL via a separate wallet or Phantom mobile, enter the Order ID and Solana Transaction Signature below. The verification engine will validate on-chain parameters.
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-mono">Order ID:</label>
                    <input
                      type="text"
                      value={manualOrderIdInput}
                      onChange={e => setManualOrderIdInput(e.target.value)}
                      placeholder="ord-172648... or from pending order"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-white font-mono focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-mono">Transaction Signature (Base58):</label>
                    <input
                      type="text"
                      value={manualTxInput}
                      onChange={e => setManualTxInput(e.target.value)}
                      placeholder="5Ksig... (64-88 character Solana signature)"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-white font-mono focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleManualVerify}
                  disabled={isProcessing}
                  className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Against Solana Nodes...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify &amp; Settle Inbound Revenue</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SETTLED EVIDENCE LEDGER */}
          {activeTab === 'EVIDENCE' && (
            <div className="space-y-3">
              {evidenceList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No verified customer payment evidence recorded yet. Complete a purchase above to generate verified evidence.
                </div>
              ) : (
                evidenceList.map(ev => (
                  <div key={ev.id} className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-bold">
                        +{ev.amount} SOL (${ev.amountUsd} USD)
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        VERIFIED ON-CHAIN
                      </span>
                    </div>
                    <div className="text-slate-400 truncate">
                      Signature: <span className="text-slate-200">{ev.transaction_signature}</span>
                    </div>
                    <div className="text-slate-400 truncate">
                      Recipient: <span className="text-slate-200">{ev.recipient}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                      <span className="text-slate-400">Slot: {ev.slot}</span>
                      <a
                        href={ev.solscanUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-400 hover:underline flex items-center gap-1"
                      >
                        Solscan <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Simulation Verification: Inbound payments require actual on-chain transaction matching.</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
