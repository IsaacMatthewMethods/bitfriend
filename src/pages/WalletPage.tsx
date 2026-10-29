import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Building2,
  QrCode,
  Download,
  Copy,
  Check,
  Plus,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useMarket } from '../context/MarketContext';
import { ReceiptModal, exportTransactionsToCsv } from '../components/ReceiptModal';
import { QrScannerModal } from '../components/QrScannerModal';
import { WithdrawToBankModal } from '../components/WithdrawToBankModal';
import type { PaymentTransaction } from '../types';

export const WalletPage: React.FC = () => {
  const {
    totalBalanceNgn,
    totalBalanceSats,
    ecashBalanceSats,
    lightningBalanceSats,
    proofs,
    transactions,
    hideBalance,
    setHideBalance,
    claimCashuToken,
    updateProofs,
    addTransaction,
    lang,
  } = useWallet();

  const { btcPriceNgn, satsToNgn } = useMarket();

  // Modals
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<PaymentTransaction | null>(null);
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [showQuickClaimModal, setShowQuickClaimModal] = useState<boolean>(false);
  const [claimInput, setClaimInput] = useState<string>('');
  const [claimStatus, setClaimStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType === 'incoming') return tx.type === 'incoming';
    if (filterType === 'outgoing') return tx.type === 'outgoing';
    return true;
  });

  const handleClaim = () => {
    if (!claimInput.trim()) return;
    const res = claimCashuToken(claimInput.trim());
    if (res.success) {
      setClaimStatus(`Successfully claimed ${res.amountSats?.toLocaleString()} sats to vault!`);
      setClaimInput('');
      setTimeout(() => {
        setClaimStatus('');
        setShowQuickClaimModal(false);
      }, 2000);
    } else {
      setClaimStatus(`Error: ${res.error}`);
    }
  };

  const copyBelloAddress = () => {
    navigator.clipboard.writeText('bello.bitfriend.me');
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="page-container wallet-page">
      <div className="fintech-grid-2col">
        {/* LEFT COLUMN: HERO TREASURY & PORTFOLIO ALLOCATION */}
        <div className="grid-col-primary">
          {/* Hero Treasury Card */}
          <div className="treasury-hero-card">
            <div className="hero-top-row">
              <div className="hero-label-group">
                <span className="hero-label">Total Treasury Balance</span>
                <button
                  type="button"
                  className="eye-toggle-btn"
                  onClick={() => setHideBalance(!hideBalance)}
                  title={hideBalance ? 'Reveal Balance' : 'Hide Balance'}
                >
                  {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="rate-badge">
                1 BTC ≈ ₦{(btcPriceNgn / 1_000_000).toFixed(1)}M
              </div>
            </div>

            <div className="hero-balance-row">
              {hideBalance ? (
                <div className="hidden-balance">₦ ••••••••</div>
              ) : (
                <div className="main-fiat-balance">
                  ₦{totalBalanceNgn.toLocaleString()}{' '}
                  <span className="currency-tag">NGN</span>
                </div>
              )}
            </div>

            <div className="hero-sats-row">
              {hideBalance ? (
                <span className="hidden-sats">•••••• sats</span>
              ) : (
                <div className="sats-pill">
                  <span className="sats-amount mono-num">{totalBalanceSats.toLocaleString()} sats</span>
                  <span className="sound-money-tag">⚡ Sound Money</span>
                </div>
              )}
            </div>

            {/* 4 Circular Action Buttons */}
            <div className="hero-actions-row">
              <Link to="/pos" className="action-circle-item">
                <div className="circle-btn orange">
                  <Plus size={22} />
                </div>
                <span>Collect (POS)</span>
              </Link>

              <button
                type="button"
                className="action-circle-item"
                onClick={() => setShowWithdrawModal(true)}
              >
                <div className="circle-btn emerald">
                  <Building2 size={22} />
                </div>
                <span>Cash Out</span>
              </button>

              <button
                type="button"
                className="action-circle-item"
                onClick={() => setShowQuickClaimModal(true)}
              >
                <div className="circle-btn violet">
                  <ArrowDownLeft size={22} />
                </div>
                <span>Claim Token</span>
              </button>

              <button
                type="button"
                className="action-circle-item"
                onClick={() => setShowScanner(true)}
              >
                <div className="circle-btn blue">
                  <QrCode size={22} />
                </div>
                <span>Scan QR</span>
              </button>
            </div>
          </div>

          {/* Dual Portfolio Breakdown Cards */}
          <div className="portfolio-accounts-grid">
            {/* Account 1: Offline Ecash Vault */}
            <div className="account-card ecash-card">
              <div className="account-top">
                <div className="account-title-group">
                  <ShieldCheck size={18} className="account-icon ecash" />
                  <h4>Offline Ecash Vault</h4>
                </div>
                <span className="pill-badge green">Zero-Data Bearer</span>
              </div>

              <div className="account-balance">
                <div className="sats-val mono-num">
                  {hideBalance ? '••••' : ecashBalanceSats.toLocaleString()} <span className="sats-unit">sats</span>
                </div>
                <div className="fiat-sub mono-num">
                  ≈ ₦{hideBalance ? '••••' : satsToNgn(ecashBalanceSats).toLocaleString()} NGN ({proofs.length} notes)
                </div>
              </div>

              <div className="account-footer">
                <span className="status-note">🔒 Encrypted AES-GCM 256-bit</span>
                <Link to="/settings" className="footer-link">Manage Vault →</Link>
              </div>
            </div>

            {/* Account 2: Lightning Channel */}
            <div className="account-card lightning-card">
              <div className="account-top">
                <div className="account-title-group">
                  <Zap size={18} className="account-icon lightning" />
                  <h4>Lightning Network</h4>
                </div>
                <span className="pill-badge orange">Instant L2</span>
              </div>

              <div className="account-balance">
                <div className="sats-val mono-num">
                  {hideBalance ? '••••' : lightningBalanceSats.toLocaleString()} <span className="sats-unit">sats</span>
                </div>
                <div className="fiat-sub mono-num">
                  ≈ ₦{hideBalance ? '••••' : satsToNgn(lightningBalanceSats).toLocaleString()} NGN
                </div>
              </div>

              <div className="account-footer">
                <span className="status-note">⚡ Blink & Alby Connected</span>
                <button type="button" className="footer-link-btn" onClick={copyBelloAddress}>
                  {copiedAddress ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedAddress ? 'Copied' : 'Copy Address'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RECENT BANKING ACTIVITY & AUDIT LOG */}
        <div className="grid-col-secondary">
          <div className="card activity-ledger-card">
            <div className="card-header-between">
              <div>
                <h3>Banking & Transfer Ledger</h3>
                <p className="card-subtitle">Real-time audit log of local peer-to-peer and bank settlements.</p>
              </div>

              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => exportTransactionsToCsv(transactions)}
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="filter-chips-row">
              <button
                type="button"
                className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All ({transactions.length})
              </button>
              <button
                type="button"
                className={`filter-chip ${filterType === 'incoming' ? 'active' : ''}`}
                onClick={() => setFilterType('incoming')}
              >
                Incoming
              </button>
              <button
                type="button"
                className={`filter-chip ${filterType === 'outgoing' ? 'active' : ''}`}
                onClick={() => setFilterType('outgoing')}
              >
                Outgoing
              </button>
            </div>

            {/* Transaction List */}
            <div className="tx-ledger-list">
              {filteredTransactions.length === 0 ? (
                <div className="empty-ledger">
                  <p>No transactions match this filter.</p>
                </div>
              ) : (
                filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="ledger-item"
                    onClick={() => setSelectedReceiptTx(tx)}
                    title="Click to view full printable receipt"
                  >
                    <div className="ledger-left">
                      <div className={`tx-icon-badge ${tx.type}`}>
                        {tx.type === 'incoming' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </div>
                      <div>
                        <div className="tx-memo-text">{tx.memo}</div>
                        <div className="tx-date-meta">
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                          {tx.offline ? (
                            <span className="badge-offline">Offline Bearer</span>
                          ) : (
                            <span className="badge-lightning">Lightning L2</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ledger-right">
                      <div className={`tx-sats-amount mono-num ${tx.type}`}>
                        {tx.type === 'incoming' ? '+' : '-'}{tx.amountSats.toLocaleString()} sats
                      </div>
                      <div className="tx-fiat-amount mono-num">
                        ≈ ₦{tx.amountNgn.toLocaleString()} NGN
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: CLAIM CASHU TOKEN */}
      {showQuickClaimModal && (
        <div className="modal-overlay" onClick={() => setShowQuickClaimModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Claim Offline Cashu Voucher</h3>
              <button type="button" className="close-btn" onClick={() => setShowQuickClaimModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <p className="modal-desc">
                Paste a Cashu bearer token string (`cashuA...`) or token drop received from a peer or via SMS.
              </p>
              <textarea
                className="input-textarea"
                rows={4}
                placeholder="Paste cashuA... voucher token here"
                value={claimInput}
                onChange={(e) => setClaimInput(e.target.value)}
              />

              {claimStatus && (
                <div className={`status-banner ${claimStatus.includes('Error') ? 'error' : 'success'}`}>
                  {claimStatus}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleClaim}
                  disabled={!claimInput.trim()}
                >
                  Deposit to Vault Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRINTABLE RECEIPT */}
      <ReceiptModal
        isOpen={Boolean(selectedReceiptTx)}
        onClose={() => setSelectedReceiptTx(null)}
        tx={selectedReceiptTx}
      />

      {/* MODAL: QR SCANNER */}
      <QrScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={(val) => {
          setShowScanner(false);
          setClaimInput(val);
          setShowQuickClaimModal(true);
        }}
        title="Scan Customer Token / QR Code"
      />

      {/* MODAL: AFRICAN BANK CASH OUT */}
      <WithdrawToBankModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        vaultProofs={proofs}
        onVaultProofsChanged={updateProofs}
        onTransactionRecorded={addTransaction}
        lang={lang}
      />
    </div>
  );
};
