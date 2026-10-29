import React, { useState } from 'react';
import { X, AtSign, Copy, Check, ExternalLink, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface LightningAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchantName?: string;
}

export const LightningAddressModal: React.FC<LightningAddressModalProps> = ({
  isOpen,
  onClose,
  merchantName = 'kasuwanbarci',
}) => {
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [copiedLnurl, setCopiedLnurl] = useState<boolean>(false);

  if (!isOpen) return null;

  const cleanHandle = merchantName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'vendor';
  const lightningAddress = `${cleanHandle}@bitfriend.me`;
  
  // Standard LNURL-pay bech32 encoded fallback
  const mockLnurl = `lnurl1dp68gurn8ghj7mr0vdskc6r0wd68ytnzv9hxgtmzvd3ksetj93exgetj9e5k7mrw9ekxsefwv3skgdn4v4exgmen8y6rwdep8qcnqer98gupqwfdv56nyvm9xsmr2vnqvgenxvrpx3jnqv3ex5crzcfk8y6r2vnq893rvwpevg6nzcmqv4e5uery8yenwd3cxgenzdps`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '440px', width: '92%', textAlign: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AtSign size={20} color="var(--btc-orange)" />
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Lightning Address & LNURL-Pay</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Receive Lightning payments and global remittances directly to your merchant alias.
        </p>

        {/* Big Address Pill */}
        <div
          style={{
            background: 'var(--bg-primary)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-focus)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          <Zap size={16} color="var(--btc-orange)" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'white', letterSpacing: '0.3px' }}>
            {lightningAddress}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(lightningAddress);
              setCopiedAddress(true);
              setTimeout(() => setCopiedAddress(false), 2500);
            }}
            style={{ background: 'transparent', color: 'var(--btc-orange)', padding: '2px' }}
          >
            {copiedAddress ? <Check size={16} color="var(--color-success)" /> : <Copy size={16} />}
          </button>
        </div>

        {/* QR Code */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <div style={{ background: 'white', padding: '10px', borderRadius: 'var(--radius-md)' }}>
            <QRCodeSVG value={`lightning:${lightningAddress}`} size={160} />
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Compatible with Blink, Cash App, Strike, WoS, Phoenix, Blixt & Alby.
        </div>

        <button
          className="btn-secondary"
          style={{ width: '100%', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          onClick={() => {
            navigator.clipboard.writeText(mockLnurl);
            setCopiedLnurl(true);
            setTimeout(() => setCopiedLnurl(false), 2500);
          }}
        >
          {copiedLnurl ? <Check size={14} /> : <ExternalLink size={14} />}
          {copiedLnurl ? 'LNURL Copied!' : 'Copy Raw LNURL-Pay Bech32 Code'}
        </button>
      </div>
    </div>
  );
};
