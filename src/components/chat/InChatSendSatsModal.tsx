import React, { useState } from 'react';
import { X, Zap, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import type { CashuProof, InlinePaymentPayload, Language } from '../../types';
import { satsToNgn, ngnToSats, spendProofs, encodeCashuToken, getCustomMint } from '../../utils/cashuEngine';
import { soundController } from '../../utils/audioVoice';

interface InChatSendSatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactName: string;
  vaultProofs: CashuProof[];
  onPaymentCreated: (payload: InlinePaymentPayload, remainingProofs: CashuProof[]) => void;
  lang: Language;
}

export const InChatSendSatsModal: React.FC<InChatSendSatsModalProps> = ({
  isOpen,
  onClose,
  contactName,
  vaultProofs,
  onPaymentCreated,
  lang,
}) => {
  const [satsInput, setSatsInput] = useState<string>('500');
  const [nairaInput, setNairaInput] = useState<string>(() => satsToNgn(500).toString());
  const [memo, setMemo] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const totalVaultSats = vaultProofs.reduce((sum, p) => sum + p.amount, 0);

  const handleSatsChange = (val: string) => {
    setSatsInput(val);
    setError('');
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      setNairaInput(satsToNgn(num).toString());
    } else {
      setNairaInput('');
    }
  };

  const handleNairaChange = (val: string) => {
    setNairaInput(val);
    setError('');
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setSatsInput(ngnToSats(num).toString());
    } else {
      setSatsInput('');
    }
  };

  const selectPreset = (sats: number) => {
    setSatsInput(sats.toString());
    setNairaInput(satsToNgn(sats).toString());
    setError('');
    soundController.playClick();
  };

  const handleSend = () => {
    const amt = parseInt(satsInput, 10);
    if (isNaN(amt) || amt <= 0) {
      setError(lang === 'ha' ? 'Shigar da adadin satoshi daidai.' : 'Please enter a valid satoshi amount.');
      return;
    }

    if (amt > totalVaultSats) {
      setError(
        lang === 'ha'
          ? `Satoshin asusunka bai isa ba. Kana da ${totalVaultSats.toLocaleString()} sats.`
          : `Insufficient vault balance. You currently have ${totalVaultSats.toLocaleString()} sats.`
      );
      return;
    }

    const mintUrl = getCustomMint();
    const result = spendProofs(amt, vaultProofs);

    if (!result) {
      setError('Unable to assemble token coins for this amount.');
      return;
    }

    const memoText = memo.trim() || `In-Chat Payment to ${contactName}`;
    const tokenStr = encodeCashuToken(result.spent, mintUrl, memoText);

    const payload: InlinePaymentPayload = {
      amountSats: amt,
      amountNgn: satsToNgn(amt),
      tokenString: tokenStr,
      mintUrl,
      memo: memoText,
      status: 'pending',
    };

    soundController.playPaymentChime();
    onPaymentCreated(payload, result.remaining);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '420px',
          width: '92%',
          background: 'linear-gradient(145deg, #161c28, #0e121a)',
          border: '1px solid rgba(247, 147, 26, 0.4)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(247, 147, 26, 0.15)',
          color: '#f8fafc',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--btc-orange)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000',
                fontWeight: 900,
                fontSize: '16px',
              }}
            >
              ₿
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                {lang === 'ha' ? 'Aika Satoshi a Chat' : 'Send Sats in Chat'}
              </h3>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Recipient: <strong>{contactName}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Vault balance pill */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
            <ShieldCheck size={14} color="var(--btc-orange)" />
            <span>Vault Ecash Balance:</span>
          </div>
          <span style={{ fontWeight: 800, color: '#f8fafc' }}>
            {totalVaultSats.toLocaleString()} sats (₦{satsToNgn(totalVaultSats).toLocaleString()})
          </span>
        </div>

        {/* Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
              Amount in Satoshis (sats)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={satsInput}
                onChange={e => handleSatsChange(e.target.value)}
                placeholder="500"
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(247, 147, 26, 0.3)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '11px',
                  color: 'var(--btc-orange)',
                  fontWeight: 700,
                }}
              >
                sats
              </span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
              Naira Equivalent (NGN)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={nairaInput}
                onChange={e => handleNairaChange(e.target.value)}
                placeholder="800"
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: '#fbbf24',
                  fontSize: '16px',
                  fontWeight: 700,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '11px',
                  color: '#fbbf24',
                  fontWeight: 700,
                }}
              >
                ₦
              </span>
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[200, 500, 1000, 2500, 5000].map(amt => (
            <button
              key={amt}
              type="button"
              onClick={() => selectPreset(amt)}
              style={{
                flex: 1,
                minWidth: '55px',
                padding: '6px',
                borderRadius: '8px',
                border: satsInput === amt.toString() ? '1px solid var(--btc-orange)' : '1px solid rgba(255, 255, 255, 0.1)',
                background: satsInput === amt.toString() ? 'rgba(247, 147, 26, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: satsInput === amt.toString() ? 'var(--btc-orange)' : '#cbd5e1',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {amt >= 1000 ? `${amt / 1000}k` : amt} sats
            </button>
          ))}
        </div>

        {/* Memo note */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
            Note / Purpose (Optional)
          </label>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="e.g., Fabric deposit, Lunch, Transport fare"
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '10px 12px',
              color: '#ffffff',
              fontSize: '13px',
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#ef4444',
              fontSize: '12px',
              marginBottom: '14px',
              background: 'rgba(239, 68, 68, 0.1)',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Send Action Button */}
        <button
          type="button"
          onClick={handleSend}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #F7931A 0%, #D97706 100%)',
            color: '#000000',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 15px rgba(247, 147, 26, 0.4)',
          }}
        >
          <Zap size={18} fill="#000" />
          <span>Send {satsInput ? parseInt(satsInput, 10).toLocaleString() : 0} sats</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
