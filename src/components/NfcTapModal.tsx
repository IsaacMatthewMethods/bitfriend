import React, { useState, useEffect } from 'react';
import { X, Smartphone, Wifi, Check, Zap } from 'lucide-react';
import { soundController } from '../utils/audioVoice';

interface NfcTapModalProps {
  isOpen: boolean;
  onClose: () => void;
  amountSats: number;
  onComplete: () => void;
}

export const NfcTapModal: React.FC<NfcTapModalProps> = ({
  isOpen,
  onClose,
  amountSats,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'ready' | 'tapping' | 'success'>('ready');

  useEffect(() => {
    if (isOpen) {
      setPhase('ready');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerTap = () => {
    setPhase('tapping');
    soundController.playClick();

    setTimeout(() => {
      setPhase('success');
      soundController.playPaymentChime();
      if (navigator.vibrate) {
        try {
          navigator.vibrate([80, 50, 100]);
        } catch {
          // ignore
        }
      }
      setTimeout(() => {
        onComplete();
        onClose();
      }, 1400);
    }, 1600);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '420px', width: '92%', textAlign: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wifi size={18} color="var(--btc-orange)" />
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Offline NFC / Acoustic Tap</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Simulates two local devices transferring Cashu bearer tokens offline via near-field or ultrasonic channel.
        </p>

        {/* Animated Tap Graphic */}
        <div
          style={{
            position: 'relative',
            height: '180px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            marginBottom: '20px',
          }}
        >
          {phase === 'ready' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Smartphone size={48} color="var(--text-secondary)" />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Buyer Phone</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--btc-orange)', fontWeight: 700 }}>
                  {amountSats.toLocaleString()} SATS
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Bearer Token</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Smartphone size={48} color="var(--btc-orange)" />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Vendor POS</span>
              </div>
            </div>
          )}

          {phase === 'tapping' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(247, 147, 26, 0.2)',
                  border: '2px solid var(--btc-orange)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 0.8s infinite',
                }}
              >
                <Zap size={32} color="var(--btc-orange)" />
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                Beaming Cashu Bearer Proofs...
              </div>
            </div>
          )}

          {phase === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--color-success-bg)',
                  border: '2px solid var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={32} color="var(--color-success)" strokeWidth={3} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-success)' }}>
                Tokens Transferred Offline!
              </div>
            </div>
          )}
        </div>

        <button
          className="btn-primary"
          style={{ width: '100%', fontSize: '14px', padding: '12px' }}
          disabled={phase !== 'ready'}
          onClick={triggerTap}
        >
          <Zap size={16} /> Tap Phones to Complete Transfer
        </button>
      </div>
    </div>
  );
};
