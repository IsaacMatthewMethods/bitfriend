import React, { useState } from 'react';
import {
  X,
  Building2,
  ArrowRight,
  Check,
  Share2,
  ShieldCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { CashuProof, PaymentTransaction, Language } from '../types';
import { satsToNgn, ngnToSats, spendProofs } from '../utils/cashuEngine';
import { soundController } from '../utils/audioVoice';

interface WithdrawToBankModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  vaultProofs: CashuProof[];
  onVaultProofsChanged: (updated: CashuProof[]) => void;
  onTransactionRecorded: (tx: PaymentTransaction) => void;
  lang: Language;
  isInline?: boolean;
}

interface BankOption {
  code: string;
  name: string;
  type: 'fintech' | 'commercial' | 'momo';
}

const SUPPORTED_BANKS: BankOption[] = [
  { code: 'opay', name: 'OPay Digital Services', type: 'fintech' },
  { code: 'palmpay', name: 'PalmPay Limited', type: 'fintech' },
  { code: 'moniepoint', name: 'Moniepoint MFB', type: 'fintech' },
  { code: 'kuda', name: 'Kuda Bank (MFB)', type: 'fintech' },
  { code: 'gtb', name: 'Guaranty Trust Bank (GTBank)', type: 'commercial' },
  { code: 'access', name: 'Access Bank Plc', type: 'commercial' },
  { code: 'zenith', name: 'Zenith Bank Plc', type: 'commercial' },
  { code: 'firstbank', name: 'First Bank of Nigeria', type: 'commercial' },
  { code: 'mpesa', name: 'M-Pesa (Kenya / East Africa)', type: 'momo' },
  { code: 'mtnmomo', name: 'MTN MoMo (Pan-Africa)', type: 'momo' },
];

export const WithdrawToBankModal: React.FC<WithdrawToBankModalProps> = ({
  isOpen = false,
  onClose = () => {},
  vaultProofs,
  onVaultProofsChanged,
  onTransactionRecorded,
  lang,
  isInline = false,
}) => {
  const [selectedBank, setSelectedBank] = useState<string>('opay');
  const [accountNumber, setAccountNumber] = useState<string>('7031234567');
  const [accountName, setAccountName] = useState<string>('IBRAHIM BELLO (VERIFIED)');
  const [isResolvingName, setIsResolvingName] = useState<boolean>(false);
  const [satsAmount, setSatsAmount] = useState<string>('2000');
  const [nairaAmount, setNairaAmount] = useState<string>(() => satsToNgn(2000).toString());
  const [error, setError] = useState<string>('');

  // Settlement flow
  const [settlementStep, setSettlementStep] = useState<'input' | 'processing' | 'success'>('input');
  const [settledData, setSettledData] = useState<{
    txId: string;
    amountSats: number;
    amountNgn: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
    sessionId: string;
    timestamp: number;
  } | null>(null);

  if (!isInline && !isOpen) return null;

  const totalVaultSats = vaultProofs.reduce((sum, p) => sum + p.amount, 0);

  const handleSatsChange = (val: string) => {
    setSatsAmount(val);
    setError('');
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      setNairaAmount(satsToNgn(num).toString());
    } else {
      setNairaAmount('');
    }
  };

  const handleNairaChange = (val: string) => {
    setNairaAmount(val);
    setError('');
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setSatsAmount(ngnToSats(num).toString());
    } else {
      setSatsAmount('');
    }
  };

  const handleAccountChange = (val: string) => {
    setAccountNumber(val);
    if (val.length === 10) {
      setIsResolvingName(true);
      setTimeout(() => {
        setIsResolvingName(false);
        const bank = SUPPORTED_BANKS.find(b => b.code === selectedBank)?.name || 'Bank';
        setAccountName(`ALHAJI USMAN GARBA - ${bank.toUpperCase()}`);
      }, 700);
    } else {
      setAccountName('');
    }
  };

  const handleExecuteCashout = () => {
    const amt = parseInt(satsAmount, 10);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid cashout amount.');
      return;
    }

    if (amt > totalVaultSats) {
      setError(`Insufficient vault satoshis. You currently have ${totalVaultSats.toLocaleString()} sats.`);
      return;
    }

    if (accountNumber.length < 9) {
      setError('Please enter a valid 10-digit NUBAN account number.');
      return;
    }

    // Spend proofs
    const result = spendProofs(amt, vaultProofs);
    if (!result) {
      setError('Unable to assemble coin denominations for this cashout.');
      return;
    }

    setSettlementStep('processing');
    soundController.playClick();

    // Simulate instant African Lightning Fiat off-ramp settlement (NIBSS/M-Pesa)
    setTimeout(() => {
      onVaultProofsChanged(result.remaining);

      const bank = SUPPORTED_BANKS.find(b => b.code === selectedBank)?.name || 'Bank';
      const txId = `cashout-${Date.now()}`;
      const sessionId = `NIBSS/${Date.now().toString().slice(-8)}/BF${Math.floor(1000 + Math.random() * 9000)}`;

      const data = {
        txId,
        amountSats: amt,
        amountNgn: satsToNgn(amt),
        bankName: bank,
        accountNumber,
        accountName: accountName || 'BENEFICIARY ACCOUNT',
        sessionId,
        timestamp: Date.now(),
      };

      setSettledData(data);
      setSettlementStep('success');

      // Record transaction
      const newTx: PaymentTransaction = {
        id: txId,
        timestamp: Date.now(),
        type: 'outgoing',
        amountSats: amt,
        amountNgn: satsToNgn(amt),
        memo: `Bank Cashout to ${bank} (${accountNumber})`,
        status: 'settled',
        method: 'lightning',
        offline: false,
      };
      onTransactionRecorded(newTx);

      soundController.playPaymentChime();
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10B981', '#F7931A', '#ffffff'],
      });

      if (navigator.vibrate) {
        try {
          navigator.vibrate([80, 50, 120]);
        } catch {
          // ignore
        }
      }
    }, 2000);
  };

  const handleShareReceipt = () => {
    if (!settledData) return;
    const shareText = `*BitFriend Bank Cashout Receipt*\nAmount: ₦${settledData.amountNgn.toLocaleString()} NGN (${settledData.amountSats.toLocaleString()} sats)\nBank: ${settledData.bankName}\nAccount: ${settledData.accountNumber}\nName: ${settledData.accountName}\nNIBSS Session: ${settledData.sessionId}\nDate: ${new Date(settledData.timestamp).toLocaleString()}\nStatus: SETTLED DIRECT TO BANK`;

    if (navigator.share) {
      navigator.share({
        title: 'Bank Cashout Receipt',
        text: shareText,
      }).catch(() => {});
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
    }
  };

  const innerContent = (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
              {lang === 'ha' ? 'Cire Kuɗi zuwa Asosun Banki' : 'Withdraw Satoshis to Bank'}
            </h3>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Instant African Lightning Fiat Off-Ramp Gateway
            </div>
          </div>
        </div>
        {!isInline && settlementStep !== 'processing' && (
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        )}
      </div>

        {settlementStep === 'input' && (
          <div>
            {/* Vault balance banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '8px 12px',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '12px',
              }}
            >
              <span style={{ color: '#94a3b8' }}>Available Vault Satoshis:</span>
              <span style={{ fontWeight: 800, color: 'var(--btc-orange)' }}>
                {totalVaultSats.toLocaleString()} sats (₦{satsToNgn(totalVaultSats).toLocaleString()})
              </span>
            </div>

            {/* Bank Select */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                Destination Bank / Mobile Money
              </label>
              <select
                value={selectedBank}
                onChange={e => setSelectedBank(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '14px',
                }}
              >
                {SUPPORTED_BANKS.map(b => (
                  <option key={b.code} value={b.code} style={{ background: '#111827', color: '#fff' }}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Account Number */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                NUBAN Account Number (10 Digits)
              </label>
              <input
                type="text"
                maxLength={10}
                value={accountNumber}
                onChange={e => handleAccountChange(e.target.value.replace(/\D/g, ''))}
                placeholder="0123456789"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '16px',
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '1px',
                }}
              />
              {isResolvingName ? (
                <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Loader2 size={12} className="spinner" /> Resolving NUBAN beneficiary name...
                </div>
              ) : accountName ? (
                <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: 700 }}>
                  ✓ {accountName}
                </div>
              ) : null}
            </div>

            {/* Amount Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                  Satoshis to Cash Out
                </label>
                <input
                  type="number"
                  value={satsAmount}
                  onChange={e => handleSatsChange(e.target.value)}
                  placeholder="2000"
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(247,147,26,0.35)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                  Bank Credit (NGN)
                </label>
                <input
                  type="number"
                  value={nairaAmount}
                  onChange={e => handleNairaChange(e.target.value)}
                  placeholder="3170"
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(16,185,129,0.35)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    color: '#34d399',
                    fontSize: '15px',
                    fontWeight: 700,
                  }}
                />
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#ef4444',
                  fontSize: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  marginBottom: '14px',
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Trust badge */}
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '16px',
              }}
            >
              <ShieldCheck size={14} color="#10b981" />
              <span>Instant direct bank settlement via Lightning (NIBSS Instant Payment / M-Pesa)</span>
            </div>

            {/* Submit button */}
            <button
              type="button"
              className="btn-primary"
              onClick={handleExecuteCashout}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
              }}
            >
              <Building2 size={18} />
              <span>Cash Out ₦{nairaAmount ? parseInt(nairaAmount, 10).toLocaleString() : 0} to Bank</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {settlementStep === 'processing' && (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <Loader2 size={44} className="spinner" color="#10b981" style={{ margin: '0 auto 16px auto' }} />
            <h4 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>
              Executing Lightning Settlement...
            </h4>
            <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '320px', margin: '0 auto' }}>
              Routing satoshis to African Fiat Gateway. Bank deposit is processing over NIBSS network.
            </p>
          </div>
        )}

        {settlementStep === 'success' && settledData && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '2px solid #10b981',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto',
                }}
              >
                <Check size={30} strokeWidth={3} />
              </div>
              <h4 style={{ fontSize: '19px', fontWeight: 800, color: '#10b981', margin: 0 }}>
                Bank Deposit Confirmed!
              </h4>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                Funds have been credited to beneficiary account.
              </div>
            </div>

            {/* Receipt Summary Card */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '16px',
                marginBottom: '16px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Amount Credited:</span>
                <span style={{ fontWeight: 800, color: '#34d399', fontSize: '15px' }}>
                  ₦{settledData.amountNgn.toLocaleString()} NGN
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Satoshis Melted:</span>
                <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                  {settledData.amountSats.toLocaleString()} sats
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Bank:</span>
                <span style={{ fontWeight: 600 }}>{settledData.bankName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Account Number:</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                  {settledData.accountNumber}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Account Name:</span>
                <span style={{ fontWeight: 600, fontSize: '12px' }}>{settledData.accountName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px', marginTop: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '11px' }}>NIBSS Session ID:</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: '#94a3b8' }}>
                  {settledData.sessionId}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleShareReceipt}
                style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Share2 size={15} />
                <span>Share WhatsApp</span>
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={isInline ? () => setSettlementStep('input') : onClose}
                style={{ flex: 1, padding: '10px' }}
              >
                {isInline ? 'New Cash Out' : 'Done'}
              </button>
            </div>
          </div>
        )}
    </>
  );

  if (isInline) {
    return (
      <div
        className="card"
        style={{
          maxWidth: '560px',
          margin: '0 auto',
          background: 'linear-gradient(145deg, #161c28, #0e121a)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(16, 185, 129, 0.15)',
          color: '#f8fafc',
        }}
      >
        {innerContent}
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={settlementStep !== 'processing' ? onClose : undefined}>
      <div
        className="modal-content"
        style={{
          maxWidth: '460px',
          width: '92%',
          background: 'linear-gradient(145deg, #161c28, #0e121a)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(16, 185, 129, 0.15)',
          color: '#f8fafc',
        }}
        onClick={e => e.stopPropagation()}
      >
        {innerContent}
      </div>
    </div>
  );
};
