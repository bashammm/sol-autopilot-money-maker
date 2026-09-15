import React, { useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Play, 
  RefreshCw, 
  Clock, 
  AlertTriangle 
} from 'lucide-react';

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

interface TestReport {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[];
}

interface TestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunTests: () => Promise<TestReport>;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({
  isOpen,
  onClose,
  onRunTests,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<TestReport | null>(null);

  if (!isOpen) return null;

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const res = await onRunTests();
      setReport(res);
    } catch (err: any) {
      alert(`Test execution failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-base text-white font-mono">
                Authoritative 16-Capability Test Suite
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Verifies ranking, zero-capital mode, 10-step lifecycle, wallet independence, correlation guard, and RLS.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Action Button & Summary Bar */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center gap-3 text-xs font-mono">
            {report ? (
              <>
                <span className="text-emerald-400 font-bold">
                  {report.passed}/{report.total} Passed
                </span>
                <span className="text-slate-400">Total: {report.durationMs}ms</span>
                {report.failed > 0 && (
                  <span className="text-rose-400 font-bold">{report.failed} Failed</span>
                )}
              </>
            ) : (
              <span className="text-slate-400">Click &apos;Execute Tests&apos; to verify system integrity</span>
            )}
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md font-mono text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Running (16)...' : 'Execute Tests'}</span>
          </button>
        </div>

        {/* Test List */}
        <div className="overflow-y-auto space-y-2 flex-1 pr-1 font-mono text-xs">
          {report?.results.map((r, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border transition flex items-start justify-between gap-2 ${
                r.passed
                  ? 'bg-slate-950/40 border-slate-800/80 text-slate-200'
                  : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-start gap-2">
                {r.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">{r.name}</div>
                  {r.error && (
                    <div className="text-[11px] text-rose-400 mt-1 font-sans">
                      Error: {r.error}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0">
                {r.durationMs}ms
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
