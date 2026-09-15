import React, { useState } from 'react';
import { 
  Terminal, 
  Lock, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink 
} from 'lucide-react';
import { AuditLogEntry } from '../types/yabbai';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AuditLogEntry[];
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  auditLogs,
}) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (hash: string) => {
    navigator.clipboard?.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-base text-white font-mono">
                Immutable Chained Audit Trail (SHA-256)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Every system event, evaluation, and capital allocation is cryptographically hashed and linked to its previous state.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Audit Log Entries List */}
        <div className="overflow-y-auto space-y-2 flex-1 pr-1 font-mono text-xs">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No audit logs recorded yet.</div>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-bold">
                      {log.action}
                    </span>
                    <span className="text-slate-400">Actor: {log.actorId}</span>
                  </div>
                  <span className="text-slate-500 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Hashes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                  <div className="truncate flex items-center gap-1">
                    <span className="text-slate-400">Prev Hash:</span>
                    <span className="text-slate-400 truncate">{log.previousHash}</span>
                  </div>
                  <div className="truncate flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 truncate">
                      <span className="text-slate-400">Hash:</span>
                      <span className="text-emerald-400 truncate">{log.hash}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(log.hash)}
                      className="text-slate-400 hover:text-white cursor-pointer ml-1"
                      title="Copy SHA-256 Hash"
                    >
                      {copiedHash === log.hash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Payload */}
                <div className="text-[10px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-900 overflow-x-auto">
                  <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
          >
            Close Audit Trail
          </button>
        </div>
      </div>
    </div>
  );
};
