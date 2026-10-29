import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Unlock, KeyRound, AlertCircle, Delete, Eye, EyeOff } from 'lucide-react';
import {
  isPinConfigured,
  unlockVault,
  setVaultPin,
  isVaultLocked,
  recordActivity
} from '../utils/secureStorage';
import { soundController } from '../utils/audioVoice';
import type { Language } from '../types';

interface PinLockModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  lang: Language;
  allowDismiss?: boolean;
  onClose?: () => void;
  initialMode?: 'unlock' | 'setup';
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isOpen,
  onSuccess,
  lang,
  allowDismiss = false,
  onClose,
  initialMode,
}) => {
  const [mode, setMode] = useState<'unlock' | 'setup' | 'confirm'>('unlock');
  const [pin, setPin] = useState<string>('');
  const [setupPin, setSetupPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showNumbers, setShowNumbers] = useState<boolean>(false);
  const [hasConfiguredPin, setHasConfiguredPin] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    isPinConfigured().then(configured => {
      if (!mounted) return;
      setHasConfiguredPin(configured);
      if (initialMode === 'setup') {
        setMode('setup');
      } else {
        setMode(configured ? 'unlock' : 'setup');
      }
    });
    return () => {
      mounted = false;
    };
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length >= 6) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    soundController.playClick();
    recordActivity();

    if (nextPin.length === 6) {
      processCompletePin(nextPin);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
    soundController.playClick();
    recordActivity();
  };

  const handleClear = () => {
    setPin('');
    setError('');
    soundController.playClick();
    recordActivity();
  };

  const processCompletePin = async (completedPin: string) => {
    if (mode === 'unlock') {
      const ok = await unlockVault(completedPin);
      if (ok) {
        soundController.playPaymentChime();
        setPin('');
        setError('');
        onSuccess();
      } else {
        soundController.playClick();
        setError(lang === 'ha' ? 'PIN ba daidai ba ne! Gwada kuma.' : 'Incorrect 6-digit PIN. Please try again.');
        setTimeout(() => setPin(''), 400);
      }
    } else if (mode === 'setup') {
      setSetupPin(completedPin);
      setPin('');
      setMode('confirm');
      setError('');
    } else if (mode === 'confirm') {
      if (completedPin === setupPin) {
        try {
          await setVaultPin(completedPin);
          soundController.playPaymentChime();
          setPin('');
          setError('');
          onSuccess();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error setting PIN';
          setError(msg);
        }
      } else {
        soundController.playClick();
        setError(lang === 'ha' ? 'PIN biyun ba su zo daidai ba.' : 'PINs did not match. Please restart setup.');
        setTimeout(() => {
          setPin('');
          setSetupPin('');
          setMode('setup');
        }, 800);
      }
    }
  };

  const isSetup = mode === 'setup' || mode === 'confirm';

  return (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 10000,
        backgroundColor: 'rgba(10, 14, 23, 0.92)',
        backdropFilter: 'blur(10px)',
      }}
      onClick={allowDismiss && onClose ? onClose : undefined}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: '380px',
          width: '92%',
          background: 'linear-gradient(145deg, #161c28, #0e121a)',
          border: '1px solid rgba(247, 147, 26, 0.35)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(247, 147, 26, 0.15)',
          color: '#f8fafc',
          textAlign: 'center',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(247,147,26,0.25) 0%, rgba(247,147,26,0.05) 100%)',
            border: '2px solid var(--btc-orange)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
          }}
        >
          {isSetup ? (
            <KeyRound size={30} color="var(--btc-orange)" />
          ) : isVaultLocked() ? (
            <Lock size={30} color="var(--btc-orange)" />
          ) : (
            <Unlock size={30} color="#10b981" />
          )}
        </div>

        <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>
          {mode === 'setup'
            ? lang === 'ha'
              ? 'Ƙirƙiri Sabon PIN na Asusunka'
              : 'Create 6-Digit Vault PIN'
            : mode === 'confirm'
            ? lang === 'ha'
              ? 'Tabbatar da PIN ɗinka'
              : 'Confirm Your 6-Digit PIN'
            : lang === 'ha'
            ? 'Buɗe Asusun Tsaro na BitFriend'
            : 'Unlock BitFriend Vault'}
        </h3>

        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '20px' }}>
          {isSetup
            ? lang === 'ha'
              ? 'PIN ɗinka zai kare satoshi da bayanan asusunka ta amfani da AES-GCM 256-bit.'
              : 'Protects offline ecash tokens & seed phrase at rest using AES-GCM 256-bit encryption.'
            : lang === 'ha'
            ? 'Shigar da lambobin 6 don buɗe satoshin da ke cikin asusunka.'
            : 'Enter your 6-digit PIN to access bearer satoshis and encrypted vault storage.'}
        </p>

        {/* 6 Dots / Pin indicators */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          {[0, 1, 2, 3, 4, 5].map(idx => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: isFilled ? '2px solid var(--btc-orange)' : '2px solid rgba(255,255,255,0.2)',
                  background: isFilled
                    ? 'var(--btc-orange)'
                    : 'rgba(255,255,255,0.05)',
                  boxShadow: isFilled ? '0 0 10px rgba(247,147,26,0.6)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#000',
                }}
              >
                {showNumbers && isFilled ? pin[idx] : ''}
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '12px',
            }}
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Security badge & toggle visibility */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: '16px',
            fontSize: '11px',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>PBKDF2 + AES-GCM 256-bit</span>
          </div>
          <button
            type="button"
            onClick={() => setShowNumbers(!showNumbers)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
            }}
          >
            {showNumbers ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{showNumbers ? 'Hide' : 'Peek'}</span>
          </button>
        </div>

        {/* Numeric Keypad Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            marginBottom: '12px',
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              style={{
                height: '52px',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#f8fafc',
                fontSize: '22px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.94)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            style={{
              height: '52px',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            CLEAR
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            style={{
              height: '52px',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: '#f8fafc',
              fontSize: '22px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.94)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            style={{
              height: '52px',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.05)',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Switch mode / Dismiss options */}
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          {allowDismiss && onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Cancel / Close
            </button>
          )}

          {!hasConfiguredPin && mode === 'setup' && (
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Setting up your PIN will encrypt your ecash vault on this phone.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
