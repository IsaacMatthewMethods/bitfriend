import React, { useState, useEffect } from 'react';
import { X, Server, RefreshCw, Zap } from 'lucide-react';
import {
  getCustomMint,
  setCustomMint,
  DEFAULT_MINT,
  fetchMintInfo,
  requestMintQuote,
  type MintInfo,
} from '../utils/cashuEngine';
import { QRCodeSVG } from 'qrcode.react';

interface MintSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMintChanged: () => void;
}

export const MintSettingsModal: React.FC<MintSettingsModalProps> = ({
  isOpen,
  onClose,
  onMintChanged,
}) => {
  const [mintUrl, setMintUrl] = useState<string>('');
  const [mintInfo, setMintInfo] = useState<MintInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  // Deposit invoice test
  const [depositSats, setDepositSats] = useState<string>('500');
  const [depositInvoice, setDepositInvoice] = useState<string>('');
  const [invoiceLoading, setInvoiceLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const current = getCustomMint();
      setMintUrl(current);
      checkMint(current);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const checkMint = async (url: string) => {
    setLoading(true);
    const info = await fetchMintInfo(url);
    setMintInfo(info);
    setLoading(false);
  };

  const handleSaveMint = () => {
    if (!mintUrl.trim()) return;
    setCustomMint(mintUrl);
    setSavedNotice(true);
    onMintChanged();
    checkMint(mintUrl);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleResetDefault = () => {
    setMintUrl(DEFAULT_MINT);
    setCustomMint(DEFAULT_MINT);
    onMintChanged();
    checkMint(DEFAULT_MINT);
  };

  const handleGenerateDepositInvoice = async () => {
    const amt = parseInt(depositSats, 10);
    if (isNaN(amt) || amt <= 0) return;
    setInvoiceLoading(true);
    const quote = await requestMintQuote(amt, mintUrl);
    setDepositInvoice(quote.request);
    setInvoiceLoading(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '520px', width: '92%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={20} color="var(--btc-orange)" />
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Cashu Mint Gateway (NUT-00/04/05)</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Configure live Chaumian Ecash mint endpoints. BitFriend communicates with standard Cashu mints over REST or operates fully autonomously offline.
        </p>

        {/* Mint URL input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Cashu Mint Endpoint URL
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={mintUrl}
              onChange={e => setMintUrl(e.target.value)}
              placeholder="https://mint.minibits.cash/Bitcoin"
              style={{
                flex: 1,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'white',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
              }}
            />
            <button
              className="btn-primary"
              style={{ padding: '10px 16px', fontSize: '13px' }}
              onClick={handleSaveMint}
            >
              Save
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
            <button
              onClick={handleResetDefault}
              style={{ background: 'transparent', color: 'var(--btc-orange)', textDecoration: 'underline' }}
            >
              Reset to Default (Minibits Bitcoin)
            </button>
            <button
              onClick={() => checkMint(mintUrl)}
              style={{ background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RefreshCw size={11} /> Refresh Status
            </button>
          </div>
        </div>

        {savedNotice && (
          <div style={{ padding: '8px 12px', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-sm)', fontSize: '12px', marginBottom: '14px', fontWeight: 600 }}>
            ✓ Mint updated and saved to local storage!
          </div>
        )}

        {/* Mint Status Card */}
        <div
          style={{
            background: 'var(--bg-primary)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${mintInfo?.isLive ? 'var(--color-success)' : 'var(--border-subtle)'}`,
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
              {loading ? 'Checking status...' : mintInfo?.name || 'Local Cashu Engine'}
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                background: mintInfo?.isLive ? 'var(--color-success-bg)' : 'rgba(239, 68, 68, 0.15)',
                color: mintInfo?.isLive ? 'var(--color-success)' : 'var(--color-danger)',
                fontWeight: 700,
              }}
            >
              {mintInfo?.isLive ? '● ONLINE' : '○ OFFLINE FALLBACK'}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', marginBottom: '6px' }}>
            Pubkey: {mintInfo?.pubkey || 'N/A'}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {mintInfo?.description}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <span style={{ fontSize: '10px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: '#CBD5E1' }}>
              NUT-00 (Bearer Cryptography)
            </span>
            <span style={{ fontSize: '10px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: '#CBD5E1' }}>
              NUT-04 (Lightning Mint Quote)
            </span>
            <span style={{ fontSize: '10px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: '#CBD5E1' }}>
              NUT-05 (Melt Settlement)
            </span>
          </div>
        </div>

        {/* Test Minting Lightning Invoice */}
        <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={15} color="var(--btc-orange)" />
            Generate Real Lightning Deposit Invoice
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Test generating a BOLT-11 invoice to fund this vault from external Lightning wallets (e.g. Phoenix, Blink, WoS).
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input
              type="number"
              value={depositSats}
              onChange={e => setDepositSats(e.target.value)}
              placeholder="500"
              style={{
                width: '100px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                color: 'white',
                fontSize: '13px',
              }}
            />
            <button
              className="btn-secondary"
              style={{ flex: 1, fontSize: '12px', padding: '8px' }}
              disabled={invoiceLoading}
              onClick={handleGenerateDepositInvoice}
            >
              {invoiceLoading ? 'Requesting...' : 'Request Mint Invoice'}
            </button>
          </div>

          {depositInvoice && (
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', marginTop: '8px', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: 'white', padding: '6px', borderRadius: '4px', marginBottom: '8px' }}>
                <QRCodeSVG value={depositInvoice} size={130} />
              </div>
              <div className="mono-num" style={{ fontSize: '10px', color: 'var(--text-muted)', wordBreak: 'break-all', maxHeight: '50px', overflowY: 'auto' }}>
                {depositInvoice}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
