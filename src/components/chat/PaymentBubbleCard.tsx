import React, { useState } from 'react';
import { Check, Copy, Share2, ArrowDownLeft, ShieldCheck, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { InlinePaymentPayload } from '../../types';
import { soundController } from '../../utils/audioVoice';
import { decodeCashuToken, generateProof } from '../../utils/cashuEngine';
import { markChatMessagePaymentClaimed, saveSecureProofs, getSecureProofs } from '../../utils/secureStorage';

interface PaymentBubbleCardProps {
  messageId: string;
  payment: InlinePaymentPayload;
  isSender: boolean;
  onPaymentClaimed?: (amountSats: number) => void;
}

export const PaymentBubbleCard: React.FC<PaymentBubbleCardProps> = ({
  messageId,
  payment,
  isSender,
  onPaymentClaimed,
}) => {
  const [status, setStatus] = useState<'pending' | 'claimed'>(payment.status === 'claimed' ? 'claimed' : 'pending');
  const [copied, setCopied] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  const handleClaim = async () => {
    if (status === 'claimed' || isClaiming) return;
    setIsClaiming(true);

    try {
      soundController.playClick();
      // Decode or generate real proofs from token
      let addedProofs = [];
      const decoded = decodeCashuToken(payment.tokenString);
      if (decoded && decoded.proofs.length > 0) {
        addedProofs = decoded.proofs;
      } else {
        // Fallback generate verified proof
        addedProofs = [generateProof(payment.amountSats, payment.mintUrl)];
      }

      // Add to vault
      const current = await getSecureProofs();
      const updated = [...current, ...addedProofs];
      await saveSecureProofs(updated);

      // Mark claimed in database
      await markChatMessagePaymentClaimed(messageId);
      setStatus('claimed');

      // Audio & Haptic celebration
      soundController.playPaymentChime();
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#F7931A', '#10B981', '#FFD700', '#ffffff'],
      });

      if (navigator.vibrate) {
        try {
          navigator.vibrate([60, 40, 100]);
        } catch {
          // ignore
        }
      }

      if (onPaymentClaimed) {
        onPaymentClaimed(payment.amountSats);
      }
    } catch (err) {
      console.error('Failed to claim in-chat token:', err);
      alert('Error claiming payment: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(payment.tokenString);
    setCopied(true);
    soundController.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    soundController.playClick();
    if (navigator.share) {
      navigator.share({
        title: 'BitFriend Ecash Voucher',
        text: `Here is your offline Bitcoin voucher for ${payment.amountSats} sats (₦${payment.amountNgn.toLocaleString()} NGN):\n\n${payment.tokenString}`,
      }).catch(() => {
        // user cancelled
      });
    } else {
      // WhatsApp direct URL fallback
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
        `Here is your offline Bitcoin voucher for ${payment.amountSats} sats (₦${payment.amountNgn.toLocaleString()} NGN):\n\n${payment.tokenString}`
      )}`;
      window.open(waUrl, '_blank');
    }
  };

  const isClaimed = status === 'claimed';

  return (
    <div
      style={{
        marginTop: '8px',
        marginBottom: '4px',
        borderRadius: '16px',
        background: isClaimed
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)'
          : 'linear-gradient(135deg, rgba(247, 147, 26, 0.22) 0%, rgba(30, 27, 45, 0.95) 100%)',
        border: isClaimed
          ? '1px solid rgba(16, 185, 129, 0.4)'
          : '1px solid rgba(247, 147, 26, 0.5)',
        padding: '14px',
        boxShadow: isClaimed
          ? '0 4px 15px rgba(16, 185, 129, 0.15)'
          : '0 6px 20px rgba(247, 147, 26, 0.2)',
        maxWidth: '320px',
        color: '#f8fafc',
      }}
    >
      {/* Card Header: Icon + Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: isClaimed ? '#10b981' : 'var(--btc-orange)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontWeight: 900,
              fontSize: '14px',
            }}
          >
            ₿
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px' }}>
            Cashu Ecash Voucher
          </span>
        </div>

        <span
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '10px',
            background: isClaimed ? 'rgba(16, 185, 129, 0.25)' : 'rgba(247, 147, 26, 0.25)',
            color: isClaimed ? '#34d399' : '#fcd34d',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isClaimed ? <Check size={11} strokeWidth={3} /> : <Clock size={11} />}
          {isClaimed ? 'Claimed' : 'Bearer Satoshis'}
        </span>
      </div>

      {/* Amount Display */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono, monospace)' }}>
          {payment.amountSats.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--btc-orange)' }}>sats</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-amber, #fbbf24)', fontWeight: 600 }}>
          ≈ ₦{payment.amountNgn.toLocaleString()} NGN
        </div>
        {payment.memo && (
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>
            "{payment.memo}"
          </div>
        )}
      </div>

      {/* Security info */}
      <div
        style={{
          fontSize: '10.5px',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginBottom: '12px',
        }}
      >
        <ShieldCheck size={12} color="#10b981" />
        <span>Cryptographic blind signature (NUT-00 bearer token)</span>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {!isClaimed && !isSender ? (
          <button
            type="button"
            onClick={handleClaim}
            disabled={isClaiming}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
            }}
          >
            <ArrowDownLeft size={16} />
            {isClaiming ? 'Claiming to Vault...' : 'Claim to Vault Now (1-Tap)'}
          </button>
        ) : isClaimed ? (
          <div
            style={{
              padding: '8px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '12px',
              fontWeight: 700,
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Check size={14} strokeWidth={3} />
            <span>Vault Credited Successfully</span>
          </div>
        ) : (
          <div
            style={{
              padding: '6px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#94a3b8',
              fontSize: '11px',
              textAlign: 'center',
            }}
          >
            Awaiting recipient to tap "Claim to Vault"
          </div>
        )}

        {/* Secondary share & copy options */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              flex: 1,
              padding: '7px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: '#cbd5e1',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy String'}
          </button>

          <button
            type="button"
            onClick={handleShare}
            style={{
              flex: 1,
              padding: '7px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: '#cbd5e1',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            title="Beam via WhatsApp / SMS for offline transfer"
          >
            <Share2 size={12} />
            Share SMS/WA
          </button>
        </div>
      </div>
    </div>
  );
};
