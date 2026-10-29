import React, { useState } from 'react';
import { X, MessageSquare, Smartphone, Copy, Check, Send } from 'lucide-react';
import { encodeCashuToken, generateProof } from '../utils/cashuEngine';

interface SmsBeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAmountSats?: number;
}

export const SmsBeamModal: React.FC<SmsBeamModalProps> = ({
  isOpen,
  onClose,
  defaultAmountSats = 500,
}) => {
  const [amount, setAmount] = useState<string>(defaultAmountSats.toString());
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const parsedAmount = parseInt(amount, 10) || 500;
  const token = encodeCashuToken([generateProof(parsedAmount)], undefined, 'BitFriend Feature-Phone Voucher');
  const messageText = `BitFriend Cashu Voucher: Receive ${parsedAmount.toLocaleString()} satoshis! Claim code: ${token.slice(0, 48)}... Full token: ${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');
  };

  const handleSendSms = () => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const url = cleanPhone
      ? `sms:${cleanPhone}?body=${encodeURIComponent(messageText)}`
      : `sms:?body=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '480px', width: '92%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} color="var(--btc-orange)" />
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Feature-Phone & SMS Beam</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Transmit Cashu bearer tokens directly to non-smartphone users via GSM SMS or WhatsApp.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '10px', marginBottom: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Amount (Sats)
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'white',
                fontSize: '14px',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Customer Phone Number
            </label>
            <input
              type="tel"
              placeholder="+234 803 123 4567"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'white',
                fontSize: '13px',
              }}
            />
          </div>
        </div>

        {/* Message Preview */}
        <div
          style={{
            background: 'var(--bg-primary)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            wordBreak: 'break-all',
            marginBottom: '16px',
            maxHeight: '80px',
            overflowY: 'auto',
          }}
        >
          {messageText}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              className="btn-primary"
              style={{ padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={handleSendWhatsApp}
            >
              <Send size={15} /> Send WhatsApp
            </button>

            <button
              className="btn-secondary"
              style={{ padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={handleSendSms}
            >
              <Smartphone size={15} /> Send via SMS
            </button>
          </div>

          <button
            className="btn-secondary"
            style={{ width: '100%', fontSize: '12px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={handleCopy}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Voucher Text Copied!' : 'Copy Full Message Text'}
          </button>
        </div>
      </div>
    </div>
  );
};
