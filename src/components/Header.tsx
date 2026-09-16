import React from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  PlayCircle, 
  RefreshCw, 
  Terminal, 
  Activity, 
  Database,
  Lock,
  Layers,
  Wallet,
  Globe,
  TrendingUp,
  ShoppingBag,
  Scale
} from 'lucide-react';
import { CurrentPredicament, SystemSecurityState, MarketPriceInfo } from '../types/yabbai';

interface HeaderProps {
  predicament?: CurrentPredicament;
  securityState?: SystemSecurityState;
  activeProviderName: string;
  solPrice?: MarketPriceInfo;
  solCluster?: 'mainnet-beta' | 'devnet';
  onSwitchCluster?: (cluster: 'mainnet-beta' | 'devnet') => void;
  isEmergencyStopped: boolean;
  onEmergencyStopToggle: () => void;
  onOpenTestModal: () => void;
  onOpenAuditModal: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  connectedPhantomAddress?: string;
  onConnectPhantom?: () => void;
  onOpenWithdrawModal?: () => void;
  onOpenStore?: () => void;
  onOpenReconciliation?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  predicament,
  securityState,
  activeProviderName,
  solPrice,
  solCluster = 'mainnet-beta',
  onSwitchCluster,
  isEmergencyStopped,
  onEmergencyStopToggle,
  onOpenTestModal,
  onOpenAuditModal,
  onRefreshData,
  isRefreshing,
  connectedPhantomAddress,
  onConnectPhantom,
  onOpenWithdrawModal,
  onOpenStore,
  onOpenReconciliation,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand & Mode */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-950">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white font-mono">YABBAI</span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v2.0 PROD
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  EVIDENCE-FIRST
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Autonomous Crypto Revenue &amp; Yield Operating System
              </p>
            </div>
          </div>

          {/* Current Tier Chip */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400">Mode:</span>
            <span className={`font-mono font-semibold ${predicament?.zeroCapitalModeActive ? 'text-amber-400' : 'text-emerald-400'}`}>
              {predicament ? `${predicament.currentTier} Capital` : '$0 Capital Mode'}
            </span>
            {predicament?.zeroCapitalModeActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            )}
          </div>
        </div>

        {/* RPC Status, Live SOL Price & Controls */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end w-full md:w-auto">
          
          {/* Live SOL Market Price Ticker */}
          {solPrice && (
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-xs"
              title={`Live market feed from ${solPrice.source}. Updated: ${new Date(solPrice.timestamp).toLocaleTimeString()}`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">SOL:</span>
              <span className="font-mono font-bold text-white text-xs">
                ${solPrice.solPriceUsd.toFixed(2)}
              </span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                LIVE
              </span>
            </div>
          )}

          {/* Solana Cluster Badge / Toggle */}
          <div className="flex items-center rounded-md bg-slate-900/90 border border-slate-800 p-0.5 text-xs">
            <button
              onClick={() => onSwitchCluster && onSwitchCluster('mainnet-beta')}
              className={`px-2 py-0.5 rounded font-mono text-[11px] transition cursor-pointer ${
                solCluster === 'mainnet-beta'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Solana Mainnet-Beta Production Cluster"
            >
              Mainnet
            </button>
            <button
              onClick={() => onSwitchCluster && onSwitchCluster('devnet')}
              className={`px-2 py-0.5 rounded font-mono text-[11px] transition cursor-pointer ${
                solCluster === 'devnet'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Solana Devnet Test Cluster"
            >
              Devnet
            </button>
          </div>

          {/* RPC Provider Chip */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400 hidden lg:inline">RPC:</span>
            <span className="font-mono text-emerald-300 text-[11px] truncate max-w-[130px]">{activeProviderName}</span>
          </div>

          {/* Phantom Wallet & Treasury Withdraw */}
          {connectedPhantomAddress ? (
            <button
              id="btn-phantom-connected"
              onClick={onOpenWithdrawModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition cursor-pointer"
              title="Connected Phantom Wallet - Click to Withdraw"
            >
              <Wallet className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-mono text-[11px]">{connectedPhantomAddress.slice(0, 4)}...{connectedPhantomAddress.slice(-4)}</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-200 font-mono">Withdraw</span>
            </button>
          ) : (
            <button
              id="btn-connect-phantom"
              onClick={onOpenWithdrawModal || onConnectPhantom}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition cursor-pointer"
              title="Connect Phantom & Withdraw Treasury"
            >
              <Wallet className="w-3.5 h-3.5 text-purple-400" />
              <span>Withdraw Treasury</span>
            </button>
          )}

          {/* Storefront & Inbound Revenue */}
          {onOpenStore && (
            <button
              id="btn-header-store"
              onClick={onOpenStore}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition cursor-pointer shadow-sm"
              title="Open Storefront & Inbound Revenue Checkout"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
              <span>Storefront</span>
            </button>
          )}

          {/* Treasury Reconciliation */}
          {onOpenReconciliation && (
            <button
              id="btn-header-reconciliation"
              onClick={onOpenReconciliation}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 transition cursor-pointer"
              title="Treasury Reconciliation & Policy Audit"
            >
              <Scale className="w-3.5 h-3.5 text-blue-400" />
              <span>Reconcile</span>
            </button>
          )}

          {/* Verification Tests */}
          <button
            id="btn-run-tests"
            onClick={onOpenTestModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audit &amp; Tests (22)</span>
          </button>

          {/* Immutable Audit Log */}
          <button
            id="btn-view-audit"
            onClick={onOpenAuditModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span>Audit Trail</span>
          </button>

          {/* Refresh */}
          <button
            id="btn-refresh"
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition cursor-pointer disabled:opacity-50"
            title="Refresh All Engine Feeds"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {/* Emergency Stop / Circuit Breaker */}
          <button
            id="btn-emergency-stop"
            onClick={onEmergencyStopToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border transition cursor-pointer shadow-sm ${
              isEmergencyStopped
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 hover:bg-rose-900 animate-pulse'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{isEmergencyStopped ? 'DISENGAGE STOP' : 'EMERGENCY STOP'}</span>
          </button>

        </div>

      </div>
    </header>
  );
};
