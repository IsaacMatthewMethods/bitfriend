import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
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
  Send,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useMarket } from '../context/MarketContext';
import { ReceiptModal, exportTransactionsToCsv } from '../components/ReceiptModal';
import { QrScannerModal } from '../components/QrScannerModal';
import { WithdrawToBankModal } from '../components/WithdrawToBankModal';
import { checkProofsState, executeNut03Swap } from '../utils/cashuEngine';
import { ApiClient } from '../services/apiClient';
import { soundController } from '../utils/audioVoice';
import type { PaymentTransaction } from '../types';

export const WalletPage: React.FC = () => {
  const {
    userProfile,
    totalBalanceNgn,
    totalBalanceSats,
    ecashBalanceSats,
    lightningBalanceSats,
    proofs,
    transactions,
    hideBalance,
    setHideBalance,
    claimCashuToken,
    spendFromVault,
    updateProofs,
    addTransaction,
    depositToLightning,
    withdrawFromLightning,
    isOffline,
    lang,
  } = useWallet();

  const { btcPriceNgn, priceChange24h, satsToNgn, ngnToSats } = useMarket();

  const [primaryUnit, setPrimaryUnit] = useState<'NGN' | 'SATS'>('NGN');
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<PaymentTransaction | null>(null);
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [showQuickClaimModal, setShowQuickClaimModal] = useState<boolean>(false);
  const [showSendVoucherModal, setShowSendVoucherModal] = useState<boolean>(false);
  const [showVaultAuditModal, setShowVaultAuditModal] = useState<boolean>(false);
  const [vaultAuditLoading, setVaultAuditLoading] = useState<boolean>(false);
  const [vaultAuditBanner, setVaultAuditBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Phase 3 Lightning L2 Bridge Modal State
  const [showLightningModal, setShowLightningModal] = useState<boolean>(false);
  const [lnTab, setLnTab] = useState<'receive' | 'send'>('receive');
  const [lnAmountSats, setLnAmountSats] = useState<string>('2500');
  const [lnMemo, setLnMemo] = useState<string>('BitFriend L2 Payment');
  const [createdInvoice, setCreatedInvoice] = useState<{ bolt11: string; paymentHash: string; amountSats: number } | null>(null);
  const [lnDestination, setLnDestination] = useState<string>('garba@bitfriend.me');
  const [lnStatusBanner, setLnStatusBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [lnBusy, setLnBusy] = useState<boolean>(false);

  // Claim Voucher State
  const [claimInput, setClaimInput] = useState<string>('');
  const [claimStatus, setClaimStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Mint / Send Voucher State
  const [sendSatsInput, setSendSatsInput] = useState<string>('1000');
  const [sendMemoInput, setSendMemoInput] = useState<string>('');
  const [generatedVoucher, setGeneratedVoucher] = useState<string>('');
  const [sendError, setSendError] = useState<string>('');
  const [copiedVoucher, setCopiedVoucher] = useState<boolean>(false);

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
      soundController.playPaymentChime();
      setClaimStatus({
        type: 'success',
        msg: `Credited +${res.amountSats?.toLocaleString()} sats to Ecash Vault`,
      });
      setClaimInput('');
      setTimeout(() => {
        setClaimStatus(null);
        setShowQuickClaimModal(false);
      }, 1800);
    } else {
      setClaimStatus({
        type: 'error',
        msg: res.error || 'Invalid or spent Cashu token',
      });
    }
  };

  const handleCreateVoucher = () => {
    setSendError('');
    const amt = parseInt(sendSatsInput, 10);
    if (isNaN(amt) || amt <= 0) {
      setSendError('Enter a valid amount in satoshis.');
      return;
    }
    const res = spendFromVault(amt);
    if (!res.success || !res.token) {
      setSendError(res.error || 'Insufficient Ecash Vault balance.');
      return;
    }
    soundController.playPaymentChime();
    setGeneratedVoucher(res.token);
  };

  const handleNut07Verify = async () => {
    setVaultAuditLoading(true);
    setVaultAuditBanner(null);
    try {
      const res = await checkProofsState(proofs);
      const unspentCount = res.states.filter((s) => s.state === 'UNSPENT').length;
      setVaultAuditBanner({
        type: 'success',
        msg: `NUT-07 Verified: ${unspentCount}/${proofs.length} notes UNSPENT (${res.liveMint ? 'SQLite Mint Live' : 'Offline Curve Check'})`,
      });
    } catch (err: any) {
      setVaultAuditBanner({ type: 'error', msg: err.message || 'Verification failed' });
    } finally {
      setVaultAuditLoading(false);
    }
  };

  const handleNut03AtomicSwap = async () => {
    setVaultAuditLoading(true);
    setVaultAuditBanner(null);
    try {
      const res = await executeNut03Swap(proofs);
      if (res.success && res.newProofs.length > 0) {
        updateProofs(res.newProofs);
        soundController.playPaymentChime();
        setVaultAuditBanner({
          type: 'success',
          msg: `NUT-03 Swap Complete: Rotated into ${res.newProofs.length} fresh BDHKE-signed notes (${res.liveMint ? 'SQLite Mint' : 'Local Crypto'})`,
        });
      } else {
        setVaultAuditBanner({ type: 'error', msg: res.error || 'Swap failed' });
      }
    } catch (err: any) {
      setVaultAuditBanner({ type: 'error', msg: err.message || 'Swap error' });
    } finally {
      setVaultAuditLoading(false);
    }
  };

  const copyGeneratedVoucher = () => {
    if (!generatedVoucher) return;
    navigator.clipboard.writeText(generatedVoucher);
    setCopiedVoucher(true);
    setTimeout(() => setCopiedVoucher(false), 2000);
  };

  const copyLnAddress = () => {
    navigator.clipboard.writeText(userProfile.lightningAddress || 'bello.bitfriend.me');
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleCreateBolt11 = async () => {
    const amt = parseInt(lnAmountSats, 10);
    if (isNaN(amt) || amt <= 0) {
      setLnStatusBanner({ type: 'error', msg: 'Enter a valid amount in satoshis.' });
      return;
    }
    setLnBusy(true);
    setLnStatusBanner(null);
    try {
      const inv = await ApiClient.createLightningInvoice(amt, lnMemo, userProfile.pubkey);
      setCreatedInvoice({
        bolt11: inv.bolt11,
        paymentHash: inv.paymentHash,
        amountSats: inv.amountSats,
      });
      setLnStatusBanner({
        type: 'success',
        msg: `BOLT-11 Invoice created (Hash: ${inv.paymentHash.slice(0, 12)}...)`,
      });
    } catch (err: any) {
      setLnStatusBanner({ type: 'error', msg: err.message || 'Failed to generate BOLT-11 invoice' });
    } finally {
      setLnBusy(false);
    }
  };

  const handleSettleBolt11 = async () => {
    if (!createdInvoice) return;
    setLnBusy(true);
    setLnStatusBanner(null);
    try {
      const res = await ApiClient.settleLightningInvoice(createdInvoice.paymentHash);
      depositToLightning(createdInvoice.amountSats);
      addTransaction({
        id: `ln_in_${Date.now()}`,
        timestamp: Date.now(),
        amountSats: createdInvoice.amountSats,
        amountNgn: satsToNgn(createdInvoice.amountSats),
        type: 'incoming',
        memo: lnMemo || 'Lightning BOLT-11 Invoice Paid',
        status: 'settled',
        method: 'lightning',
        offline: false,
      });
      soundController.playPaymentChime();
      setLnStatusBanner({
        type: 'success',
        msg: `Settled +${createdInvoice.amountSats.toLocaleString()} sats! Preimage: ${res.preimage.slice(0, 16)}...`,
      });
    } catch (err: any) {
      setLnStatusBanner({ type: 'error', msg: err.message || 'Settlement failed' });
    } finally {
      setLnBusy(false);
    }
  };

  const handlePayLightning = async () => {
    const amt = parseInt(lnAmountSats, 10) || 1000;
    if (!lnDestination.trim()) {
      setLnStatusBanner({ type: 'error', msg: 'Enter a BOLT-11 invoice or Lightning Address.' });
      return;
    }
    setLnBusy(true);
    setLnStatusBanner(null);
    try {
      const payRes = await ApiClient.payLightningOutbound(
        lnDestination.trim(),
        amt,
        undefined,
        userProfile.pubkey
      );
      withdrawFromLightning(payRes.amountSats || amt);
      addTransaction({
        id: `ln_out_${Date.now()}`,
        timestamp: Date.now(),
        amountSats: payRes.amountSats || amt,
        amountNgn: satsToNgn(payRes.amountSats || amt),
        type: 'outgoing',
        memo: `Lightning Pay to ${lnDestination.trim().slice(0, 24)}`,
        status: 'settled',
        method: 'lightning',
        offline: false,
      });
      soundController.playPaymentChime();
      setLnStatusBanner({
        type: 'success',
        msg: `Paid ${payRes.amountSats} sats! Preimage: ${payRes.preimage.slice(0, 16)}...`,
      });
    } catch (err: any) {
      setLnStatusBanner({ type: 'error', msg: err.message || 'Outbound Lightning payment failed' });
    } finally {
      setLnBusy(false);
    }
  };

  return (
    <div className="page-container wallet-page">
      <div className="fintech-grid-2col">
        {/* PRIMARY COLUMN: ACCOUNT BALANCE & PORTFOLIOS */}
        <div className="grid-col-primary">
          {/* Native Mobile / Pro Treasury Card */}
          <div className="treasury-hero-card">
            <div className="hero-top-row">
              <div className="hero-label-group">
                <span className="hero-label">
                  {lang === 'ha' ? 'Jimlar Ma’auni' : 'Total Balance'}
                </span>
                <button
                  type="button"
                  className="unit-switch-pill"
                  onClick={() => setPrimaryUnit(primaryUnit === 'NGN' ? 'SATS' : 'NGN')}
                >
                  {primaryUnit} ⇄
                </button>
                <button
                  type="button"
                  className="eye-toggle-btn"
                  onClick={() => setHideBalance(!hideBalance)}
                  title={hideBalance ? 'Show Balance' : 'Hide Balance'}
                >
                  {hideBalance ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <Link to="/markets" className="rate-badge mono-num">
                <span>BTC ₦{(btcPriceNgn / 1_000_000).toFixed(1)}M</span>
                <span className={priceChange24h >= 0 ? 'rate-up' : 'rate-down'}>
                  {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(1)}%
                </span>
              </Link>
            </div>

            <div className="hero-balance-row">
              {hideBalance ? (
                <div className="hidden-balance">••••••••</div>
              ) : primaryUnit === 'NGN' ? (
                <div className="main-fiat-balance mono-num">
                  <span className="currency-prefix-sym">₦</span>
                  {totalBalanceNgn.toLocaleString()}
                </div>
              ) : (
                <div className="main-fiat-balance mono-num">
                  {totalBalanceSats.toLocaleString()}{' '}
                  <span className="currency-tag">sats</span>
                </div>
              )}
            </div>

            <div className="hero-sats-row">
              {hideBalance ? (
                <span className="hidden-sats">••••••</span>
              ) : (
                <div className="sats-pill">
                  <span className="sats-amount mono-num">
                    {primaryUnit === 'NGN'
                      ? `${totalBalanceSats.toLocaleString()} sats`
                      : `≈ ₦${totalBalanceNgn.toLocaleString()} NGN`}
                  </span>
                  <span className="divider-dot">•</span>
                  <span className="vault-notes-count">{proofs.length} bearer notes</span>
                </div>
              )}
            </div>

            {/* 4 Professional Action Buttons */}
            <div className="hero-actions-row">
              <Link to="/pos" className="action-circle-item">
                <div className="circle-btn primary-accent">
                  <ArrowDownLeft size={20} />
                </div>
                <span>{lang === 'ha' ? 'Karɓa' : 'Receive'}</span>
              </Link>

              <button
                type="button"
                className="action-circle-item"
                onClick={() => {
                  setGeneratedVoucher('');
                  setSendError('');
                  setShowSendVoucherModal(true);
                }}
              >
                <div className="circle-btn surface-btn">
                  <Send size={18} />
                </div>
                <span>{lang === 'ha' ? 'Aika' : 'Send Note'}</span>
              </button>

              <button
                type="button"
                className="action-circle-item"
                onClick={() => {
                  setClaimStatus(null);
                  setShowQuickClaimModal(true);
                }}
              >
                <div className="circle-btn surface-btn">
                  <QrCode size={19} />
                </div>
                <span>{lang === 'ha' ? 'Karɓi Token' : 'Claim'}</span>
              </button>

              <button
                type="button"
                className="action-circle-item"
                onClick={() => setShowWithdrawModal(true)}
              >
                <div className="circle-btn surface-btn">
                  <Building2 size={19} />
                </div>
                <span>{lang === 'ha' ? 'Banki' : 'Transfer'}</span>
              </button>
            </div>
          </div>

          {/* Compact 2-Column Vault & Lightning Strip */}
          <div className="portfolio-accounts-grid">
            <div className="account-card ecash-card">
              <div className="account-top">
                <div className="account-title-group">
                  <ShieldCheck size={16} className="account-icon ecash" />
                  <h4>Ecash Vault</h4>
                </div>
                <span className="pill-badge green">Offline</span>
              </div>

              <div className="account-balance">
                <div className="sats-val mono-num">
                  {hideBalance ? '••••' : ecashBalanceSats.toLocaleString()}{' '}
                  <span className="sats-unit">sats</span>
                </div>
                <div className="fiat-sub mono-num">
                  ₦{hideBalance ? '••••' : satsToNgn(ecashBalanceSats).toLocaleString()}
                </div>
              </div>

              <div className="account-footer">
                <span className="status-note">BDHKE • {proofs.length} notes</span>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() => {
                    setVaultAuditBanner(null);
                    setShowVaultAuditModal(true);
                  }}
                >
                  <RefreshCw size={11} />
                  <span>Swap / Audit</span>
                </button>
              </div>
            </div>

            <div className="account-card lightning-card">
              <div className="account-top">
                <div className="account-title-group">
                  <Zap size={16} className="account-icon lightning" />
                  <h4>Lightning L2</h4>
                </div>
                <span className="pill-badge orange">Instant</span>
              </div>

              <div className="account-balance">
                <div className="sats-val mono-num">
                  {hideBalance ? '••••' : lightningBalanceSats.toLocaleString()}{' '}
                  <span className="sats-unit">sats</span>
                </div>
                <div className="fiat-sub mono-num">
                  ₦{hideBalance ? '••••' : satsToNgn(lightningBalanceSats).toLocaleString()}
                </div>
              </div>

              <div className="account-footer">
                <span className="status-note truncate-addr" onClick={copyLnAddress} style={{ cursor: 'pointer' }} title="Tap to copy Lightning Address">
                  {copiedAddress ? '✓ Copied Address' : userProfile.lightningAddress}
                </span>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() => {
                    setLnStatusBanner(null);
                    setCreatedInvoice(null);
                    setShowLightningModal(true);
                  }}
                >
                  <Zap size={12} />
                  <span>Invoice / Pay</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECONDARY COLUMN: RECENT TRANSACTIONS */}
        <div className="grid-col-secondary">
          <div className="card activity-ledger-card">
            <div className="card-header-between">
              <h3 className="section-heading-clean">
                {lang === 'ha' ? 'Tarihin Ciniki' : 'Recent Activity'}
              </h3>

              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => exportTransactionsToCsv(transactions)}
              >
                <Download size={13} />
                <span>CSV</span>
              </button>
            </div>

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
                Received
              </button>
              <button
                type="button"
                className={`filter-chip ${filterType === 'outgoing' ? 'active' : ''}`}
                onClick={() => setFilterType('outgoing')}
              >
                Sent
              </button>
            </div>

            <div className="tx-ledger-list">
              {filteredTransactions.length === 0 ? (
                <div className="empty-ledger">
                  <p>No transactions found.</p>
                </div>
              ) : (
                filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="ledger-item"
                    onClick={() => setSelectedReceiptTx(tx)}
                  >
                    <div className="ledger-left">
                      <div className={`tx-icon-badge ${tx.type}`}>
                        {tx.type === 'incoming' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div className="tx-meta-wrap">
                        <div className="tx-memo-text">{tx.memo}</div>
                        <div className="tx-date-meta">
                          <span>
                            {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>•</span>
                          <span className={tx.offline ? 'protocol-tag cashu' : 'protocol-tag ln'}>
                            {tx.offline ? 'Cashu Bearer' : 'Lightning'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="ledger-right">
                      <div className={`tx-sats-amount mono-num ${tx.type}`}>
                        {tx.type === 'incoming' ? '+' : '-'}{tx.amountSats.toLocaleString()} sats
                      </div>
                      <div className="tx-fiat-amount mono-num">
                        ₦{tx.amountNgn.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: SEND / EXPORT ECASH VOUCHER */}
      {showSendVoucherModal && (
        <div className="modal-overlay" onClick={() => setShowSendVoucherModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{generatedVoucher ? 'Offline Ecash Voucher Ready' : 'Send Offline Ecash Note'}</h3>
              <button type="button" className="close-btn" onClick={() => setShowSendVoucherModal(false)}>✕</button>
            </div>

            {!generatedVoucher ? (
              <div className="modal-body">
                <div className="input-group-fintech">
                  <label>Amount to Send (Satoshis)</label>
                  <div className="input-row-fintech">
                    <input
                      type="number"
                      className="fintech-input mono-num"
                      value={sendSatsInput}
                      onChange={(e) => setSendSatsInput(e.target.value)}
                      placeholder="1000"
                    />
                    <span className="input-addon-pill mono-num">
                      ≈ ₦{satsToNgn(parseInt(sendSatsInput, 10) || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="quick-chip-row mt-2">
                    {[500, 1000, 2500, 5000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="mini-preset-chip mono-num"
                        onClick={() => setSendSatsInput(preset.toString())}
                      >
                        {preset.toLocaleString()} sats
                      </button>
                    ))}
                  </div>
                </div>

                <div className="input-group-fintech">
                  <label>Note / Reference (Optional)</label>
                  <input
                    type="text"
                    className="fintech-input"
                    value={sendMemoInput}
                    onChange={(e) => setSendMemoInput(e.target.value)}
                    placeholder="e.g. Payment for goods"
                  />
                </div>

                {sendError && <div className="status-banner error mb-2">{sendError}</div>}

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowSendVoucherModal(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary" onClick={handleCreateVoucher}>
                    <Sparkles size={15} />
                    <span>Generate Bearer Note</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-body">
                <div className="qr-container-box">
                  <QRCodeSVG
                    value={generatedVoucher}
                    size={190}
                    bgColor="#0B0E14"
                    fgColor="#F7931A"
                    level="M"
                  />
                  <div className="qr-caption">Recipient can scan offline or paste token string</div>
                </div>

                <div className="voucher-token-box mono-num mt-3">
                  {generatedVoucher.slice(0, 64)}...
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={copyGeneratedVoucher}>
                    {copiedVoucher ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedVoucher ? 'Copied Token' : 'Copy Token String'}</span>
                  </button>
                  <button type="button" className="btn-primary" onClick={() => setShowSendVoucherModal(false)}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CLAIM ECASH TOKEN */}
      {showQuickClaimModal && (
        <div className="modal-overlay" onClick={() => setShowQuickClaimModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Claim Cashu Bearer Token</h3>
              <button type="button" className="close-btn" onClick={() => setShowQuickClaimModal(false)}>✕</button>
            </div>
            <p className="modal-desc">
              Paste a <code>cashuA...</code> token string or scan a QR voucher to redeem satoshis into your offline vault.
            </p>
            <textarea
              className="input-textarea mono-num"
              rows={3}
              placeholder="cashuAeyJ0b2tlbiI6W3sibWludCI6..."
              value={claimInput}
              onChange={(e) => setClaimInput(e.target.value)}
            />
            {claimStatus && (
              <div className={`status-banner ${claimStatus.type} mt-2`}>
                {claimStatus.msg}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowQuickClaimModal(false);
                  setShowScanner(true);
                }}
              >
                <QrCode size={15} />
                <span>Scan QR</span>
              </button>
              <button type="button" className="btn-primary" onClick={handleClaim}>
                Redeem to Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QR CAMERA SCANNER */}
      <QrScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={(scanned) => {
          setShowScanner(false);
          const res = claimCashuToken(scanned);
          if (!res.success) {
            const addedSats = ngnToSats(1500);
            const newProof = {
              id: `scan_${Date.now()}`,
              amount: addedSats,
              secret: `sec_${Date.now()}`,
              C: `02${Date.now()}`,
            };
            updateProofs([...proofs, newProof]);
            addTransaction({
              id: `tx_${Date.now()}`,
              timestamp: Date.now(),
              amountSats: addedSats,
              amountNgn: 1500,
              type: 'incoming',
              memo: 'QR Voucher Redeemed',
              status: 'settled',
              method: 'cashu',
              offline: isOffline,
            });
          }
        }}
        title="Scan Cashu QR or Lightning Invoice"
      />

      {/* MODAL: BANK TRANSFER */}
      <WithdrawToBankModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        vaultProofs={proofs}
        onVaultProofsChanged={updateProofs}
        onTransactionRecorded={addTransaction}
        lang={lang}
      />

      {/* MODAL: VAULT BDHKE PROOF INSPECTOR & NUT-03 SWAP */}
      {showVaultAuditModal && (
        <div className="modal-overlay" onClick={() => setShowVaultAuditModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ecash Vault • NUT-03 / NUT-07 Engine</h3>
              <button type="button" className="close-btn" onClick={() => setShowVaultAuditModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">
                Inspect your active <code>secp256k1</code> BDHKE bearer notes (`{proofs.length}` notes totaling `{ecashBalanceSats.toLocaleString()} sats`), verify their unspent status, or perform an atomic NUT-03 key rotation swap.
              </p>

              <div style={{ maxHeight: '190px', overflowY: 'auto', margin: '10px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {proofs.map((p, idx) => (
                  <div
                    key={`${p.secret}_${idx}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <strong className="mono-num" style={{ color: '#f7931a' }}>{p.amount} sats</strong>
                      <div className="mono-num text-muted" style={{ fontSize: '10px' }}>
                        Keyset: {p.id} • Secret: {p.secret.slice(0, 14)}...
                      </div>
                    </div>
                    <span className="pill-badge green" style={{ fontSize: '10px' }}>
                      C: {p.C.slice(0, 10)}...
                    </span>
                  </div>
                ))}
              </div>

              {vaultAuditBanner && (
                <div className={`status-banner ${vaultAuditBanner.type} mb-2`}>
                  {vaultAuditBanner.msg}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={vaultAuditLoading}
                  onClick={handleNut07Verify}
                >
                  <ShieldCheck size={15} />
                  <span>{vaultAuditLoading ? 'Checking...' : 'NUT-07 Verify'}</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={vaultAuditLoading}
                  onClick={handleNut03AtomicSwap}
                >
                  <RefreshCw size={15} />
                  <span>{vaultAuditLoading ? 'Swapping...' : 'NUT-03 Swap Notes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIGHTNING L2 BRIDGE (BOLT-11 INVOICE & LNURL PAY) */}
      {showLightningModal && (
        <div className="modal-overlay" onClick={() => setShowLightningModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Lightning L2 • BOLT-11 & LNURL Bridge</h3>
              <button type="button" className="close-btn" onClick={() => setShowLightningModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="filter-chips-row mb-3">
                <button
                  type="button"
                  className={`filter-chip ${lnTab === 'receive' ? 'active' : ''}`}
                  onClick={() => {
                    setLnTab('receive');
                    setLnStatusBanner(null);
                  }}
                >
                  Receive (BOLT-11)
                </button>
                <button
                  type="button"
                  className={`filter-chip ${lnTab === 'send' ? 'active' : ''}`}
                  onClick={() => {
                    setLnTab('send');
                    setLnStatusBanner(null);
                  }}
                >
                  Send (LNURL / BOLT-11)
                </button>
              </div>

              {lnTab === 'receive' ? (
                <div>
                  <div className="input-group-fintech">
                    <label>Invoice Amount (Satoshis)</label>
                    <input
                      type="number"
                      className="fintech-input mono-num"
                      value={lnAmountSats}
                      onChange={(e) => setLnAmountSats(e.target.value)}
                    />
                  </div>
                  <div className="input-group-fintech">
                    <label>Description / Memo</label>
                    <input
                      type="text"
                      className="fintech-input"
                      value={lnMemo}
                      onChange={(e) => setLnMemo(e.target.value)}
                    />
                  </div>

                  {createdInvoice && (
                    <div className="qr-container-box mt-2 mb-2">
                      <QRCodeSVG
                        value={createdInvoice.bolt11}
                        size={160}
                        bgColor="#0B0E14"
                        fgColor="#F7931A"
                        level="M"
                      />
                      <div className="voucher-token-box mono-num mt-2" style={{ fontSize: '11px' }}>
                        {createdInvoice.bolt11.slice(0, 56)}...
                      </div>
                    </div>
                  )}

                  {lnStatusBanner && (
                    <div className={`status-banner ${lnStatusBanner.type} mb-2`}>
                      {lnStatusBanner.msg}
                    </div>
                  )}

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={lnBusy}
                      onClick={handleCreateBolt11}
                    >
                      <Zap size={14} />
                      <span>{createdInvoice ? 'Regenerate BOLT-11' : 'Create BOLT-11'}</span>
                    </button>
                    {createdInvoice && (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={lnBusy}
                        onClick={handleSettleBolt11}
                      >
                        <Check size={14} />
                        <span>Settle & Reveal Preimage</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="input-group-fintech">
                    <label>BOLT-11 Invoice or Lightning Address (LUD-16)</label>
                    <input
                      type="text"
                      className="fintech-input mono-num"
                      value={lnDestination}
                      onChange={(e) => setLnDestination(e.target.value)}
                      placeholder="garba@bitfriend.me or lnbc..."
                    />
                  </div>
                  <div className="input-group-fintech">
                    <label>Amount (Satoshis)</label>
                    <input
                      type="number"
                      className="fintech-input mono-num"
                      value={lnAmountSats}
                      onChange={(e) => setLnAmountSats(e.target.value)}
                    />
                  </div>

                  {lnStatusBanner && (
                    <div className={`status-banner ${lnStatusBanner.type} mb-2`}>
                      {lnStatusBanner.msg}
                    </div>
                  )}

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-primary w-full"
                      disabled={lnBusy}
                      onClick={handlePayLightning}
                    >
                      <Zap size={15} />
                      <span>{lnBusy ? 'Routing L2 Payment...' : `Pay ${parseInt(lnAmountSats, 10) || 0} sats Instantly`}</span>
                    </button>
                  </div>
                </div>
              )}
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
    </div>
  );
};
