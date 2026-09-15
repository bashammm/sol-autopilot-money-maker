import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Receipt, 
  Layers, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface NewRevenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestRevenue: (params: {
    signature: string;
    recipientAddress: string;
    senderAddress: string;
    amountUsd: number;
    amountUnits: string;
  }) => Promise<void>;
}

export const NewRevenueModal: React.FC<NewRevenueModalProps> = ({
  isOpen,
  onClose,
  onIngestRevenue,
}) => {
  const [signature, setSignature] = useState(`5K${Date.now()}ProofSignatureValid99AuthoritativeOnChainSolanaTransactionSignature88chars`);
  const [recipientAddress, setRecipientAddress] = useState('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
  const [senderAddress, setSenderAddress] = useState('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
  const [amountUsd, setAmountUsd] = useState('45.00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsedAmount = parseFloat(amountUsd);
      await onIngestRevenue({
        signature,
        recipientAddress,
        senderAddress,
        amountUsd: parsedAmount,
        amountUnits: (parsedAmount * 1_000_000).toString()
      });
      onClose();
    } catch (err: any) {
      alert(`Revenue ingestion failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-base text-white font-mono">
                Ingest Authoritative Revenue Proof
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Only cryptographically verified Solana transactions or HMAC-signed billing webhooks can enter the realized revenue ledger.
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-mono">
              On-Chain Transaction Signature (Min 40 characters)
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-md p-2 font-mono text-[11px]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 mb-1 font-mono">Recipient Address</label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-md p-2 font-mono text-[11px]"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-mono">Sender / Payer Address</label>
              <input
                type="text"
                value={senderAddress}
                onChange={(e) => setSenderAddress(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-md p-2 font-mono text-[11px]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-mono">Verified Value (USD)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-md p-2 font-mono text-base font-bold text-emerald-400"
                required
              />
              <span className="text-slate-400 font-mono text-xs">USD</span>
            </div>
          </div>

          {/* Allocation Preview */}
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1 text-[11px] font-mono">
            <div className="font-semibold text-slate-300">Capital Loop Allocation on Ingest (100%):</div>
            <div className="grid grid-cols-3 gap-1 text-slate-400">
              <div>Treasury: <strong className="text-purple-300">${(parseFloat(amountUsd || '0') * 0.20).toFixed(2)}</strong></div>
              <div>Operating: <strong className="text-sky-300">${(parseFloat(amountUsd || '0') * 0.20).toFixed(2)}</strong></div>
              <div>Growth: <strong className="text-indigo-300">${(parseFloat(amountUsd || '0') * 0.20).toFixed(2)}</strong></div>
              <div>Strategy: <strong className="text-emerald-300">${(parseFloat(amountUsd || '0') * 0.30).toFixed(2)}</strong></div>
              <div>Gas Pool: <strong className="text-amber-300">${(parseFloat(amountUsd || '0') * 0.05).toFixed(2)}</strong></div>
              <div>User Funds: <strong className="text-rose-300">${(parseFloat(amountUsd || '0') * 0.05).toFixed(2)}</strong></div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Verifying...' : 'Verify & Allocate Capital'}
          </button>
        </div>
      </form>
    </div>
  );
};
