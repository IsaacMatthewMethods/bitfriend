import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Key,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Lock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  generate12WordMnemonic,
  deriveWalletIdentityFromMnemonic,
} from '../utils/bip39Vault';
import { useWallet } from '../context/WalletContext';
import { soundController } from '../utils/audioVoice';

export const SovereignAuthScreen: React.FC = () => {
  const { completeOnboarding } = useWallet();

  const [mode, setMode] = useState<'create' | 'recover'>('create');

  // Create mode state
  const [fullName, setFullName] = useState<string>('');
  const [customHandle, setCustomHandle] = useState<string>('');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [mnemonic, setMnemonic] = useState<string[]>(() => generate12WordMnemonic());
  const [copiedSeed, setCopiedSeed] = useState<boolean>(false);
  const [confirmedBackup, setConfirmedBackup] = useState<boolean>(false);

  // Recover mode state
  const [recoverPhrase, setRecoverPhrase] = useState<string>('');
  const [recoverName, setRecoverName] = useState<string>('');

  // Status
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const autoHandle = useMemo(() => {
    if (customHandle.trim()) {
      const clean = customHandle.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      return clean.includes('.') || clean.includes('@') ? clean : `${clean}@bitfriend.me`;
    }
    const slug = fullName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 18);
    return slug ? `${slug}@bitfriend.me` : '';
  }, [fullName, customHandle]);

  const derivedCreateIdentity = useMemo(() => {
    return deriveWalletIdentityFromMnemonic(mnemonic);
  }, [mnemonic]);

  const parsedRecoverWords = useMemo(() => {
    return recoverPhrase
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }, [recoverPhrase]);

  const derivedRecoverIdentity = useMemo(() => {
    if (parsedRecoverWords.length === 12) {
      return deriveWalletIdentityFromMnemonic(parsedRecoverWords);
    }
    return null;
  }, [parsedRecoverWords]);

  const handleRegenerateSeed = () => {
    soundController.playClick();
    setMnemonic(generate12WordMnemonic());
    setConfirmedBackup(false);
    setCopiedSeed(false);
  };

  const handleCopySeed = () => {
    navigator.clipboard.writeText(mnemonic.join(' '));
    soundController.playClick();
    setCopiedSeed(true);
    setConfirmedBackup(true);
    setTimeout(() => setCopiedSeed(false), 2500);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your Full Name or Merchant Business Name.');
      return;
    }

    if (!confirmedBackup) {
      setError('Please copy or confirm that you have backed up your 12-word recovery phrase.');
      return;
    }

    setBusy(true);
    try {
      await completeOnboarding({
        name: fullName.trim(),
        lightningAddress: autoHandle || 'merchant@bitfriend.me',
        currency,
        mnemonic,
        isRecovery: false,
      });
      soundController.playPaymentChime();
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize sovereign wallet.');
    } finally {
      setBusy(false);
    }
  };

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (parsedRecoverWords.length !== 12) {
      setError(`Please enter exactly 12 BIP-39 recovery words (currently ${parsedRecoverWords.length}).`);
      return;
    }

    setBusy(true);
    try {
      await completeOnboarding({
        name: recoverName.trim(),
        lightningAddress: recoverName.trim()
          ? `${recoverName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@bitfriend.me`
          : '',
        currency: 'NGN',
        mnemonic: parsedRecoverWords,
        isRecovery: true,
      });
      soundController.playPaymentChime();
    } catch (err: any) {
      setError(err?.message || 'Failed to restore sovereign wallet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 0%, rgba(247, 147, 26, 0.12), transparent 55%), #090C10',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        color: '#F3F4F6',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#11161F',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '28px 24px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #F7931A 0%, #D97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '22px',
                color: '#090C10',
                boxShadow: '0 6px 18px rgba(247, 147, 26, 0.3)',
              }}
            >
              ₿
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                BitFriend
              </div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                Sovereign Cashu Ecash & Lightning Banking
              </div>
            </div>
          </div>

          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10B981',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            secp256k1 • BIP-39
          </span>
        </div>

        {/* Mode Switcher */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            background: '#0B0E14',
            padding: '5px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: '22px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setError('');
            }}
            style={{
              padding: '10px 12px',
              borderRadius: '9px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: mode === 'create' ? '#1E2636' : 'transparent',
              color: mode === 'create' ? '#F7931A' : '#9CA3AF',
              transition: 'all 0.15s ease',
            }}
          >
            Create New Wallet
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('recover');
              setError('');
            }}
            style={{
              padding: '10px 12px',
              borderRadius: '9px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: mode === 'recover' ? '#1E2636' : 'transparent',
              color: mode === 'recover' ? '#F7931A' : '#9CA3AF',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In / Recover Seed
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreateSubmit}>
            <div className="input-group-fintech" style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB', marginBottom: '6px', display: 'block' }}>
                Your Name or Merchant Business Name *
              </label>
              <input
                type="text"
                className="fintech-input"
                placeholder="e.g. Aminu Kano Ventures"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: '10px', marginBottom: '16px' }}>
              <div className="input-group-fintech" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB', marginBottom: '6px', display: 'block' }}>
                  LUD-16 Lightning Handle
                </label>
                <input
                  type="text"
                  className="fintech-input mono-num"
                  placeholder={autoHandle || 'username@bitfriend.me'}
                  value={customHandle}
                  onChange={(e) => setCustomHandle(e.target.value)}
                  style={{ fontSize: '12px' }}
                />
              </div>

              <div className="input-group-fintech" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB', marginBottom: '6px', display: 'block' }}>
                  Local Currency
                </label>
                <select
                  className="fintech-input"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'NGN' | 'USD')}
                  style={{ fontSize: '12px' }}
                >
                  <option value="NGN">NGN (₦)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            {/* 12-Word Master Recovery Phrase Box */}
            <div
              style={{
                background: '#0B0E14',
                border: '1px solid rgba(247, 147, 26, 0.25)',
                borderRadius: '14px',
                padding: '14px',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#F7931A' }}>
                  <Key size={14} />
                  <span>12-Word BIP-39 Recovery Seed</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleRegenerateSeed}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: '#D1D5DB',
                      fontSize: '11px',
                      padding: '4px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={11} />
                    <span>New Key</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySeed}
                    style={{
                      background: copiedSeed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(247, 147, 26, 0.15)',
                      border: '1px solid rgba(247, 147, 26, 0.35)',
                      borderRadius: '6px',
                      color: copiedSeed ? '#10B981' : '#F7931A',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedSeed ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedSeed ? 'Copied' : 'Copy 12 Words'}</span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  marginBottom: '10px',
                }}
              >
                {mnemonic.map((word, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#141A24',
                      borderRadius: '6px',
                      padding: '5px 8px',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span style={{ color: '#6B7280', fontSize: '10px' }}>{idx + 1}.</span>
                    <span style={{ color: '#F9FAFB', fontWeight: 600 }}>{word}</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  fontSize: '10px',
                  color: '#9CA3AF',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                secp256k1 Pubkey: {derivedCreateIdentity.pubkeyCompressedHex}
              </div>
            </div>

            {/* Backup Confirmation Checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12px',
                color: '#D1D5DB',
                cursor: 'pointer',
                marginBottom: '16px',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={confirmedBackup}
                onChange={(e) => setConfirmedBackup(e.target.checked)}
                style={{ accentColor: '#F7931A', width: '16px', height: '16px' }}
              />
              <span>I have copied or written down my 12-word master recovery phrase.</span>
            </label>

            {error && (
              <div className="status-banner error mb-3" style={{ fontSize: '12px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={busy}
              style={{
                padding: '13px',
                fontSize: '14px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <ShieldCheck size={18} />
              <span>{busy ? 'Signing Schnorr Challenge...' : 'Create Sovereign Wallet & Sign In'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleRecoverSubmit}>
            <div className="input-group-fintech" style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB', marginBottom: '6px', display: 'block' }}>
                Enter Your 12-Word BIP-39 Recovery Seed Phrase *
              </label>
              <textarea
                className="fintech-input mono-num"
                rows={3}
                placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
                value={recoverPhrase}
                onChange={(e) => setRecoverPhrase(e.target.value)}
                style={{ fontSize: '13px', lineHeight: 1.5 }}
                required
              />
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                Words detected: <strong>{parsedRecoverWords.length} / 12</strong>
              </div>
            </div>

            <div className="input-group-fintech" style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#D1D5DB', marginBottom: '6px', display: 'block' }}>
                Display Name (Optional — synced from node if existing)
              </label>
              <input
                type="text"
                className="fintech-input"
                placeholder="e.g. Aminu Kano Ventures"
                value={recoverName}
                onChange={(e) => setRecoverName(e.target.value)}
              />
            </div>

            {derivedRecoverIdentity && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  marginBottom: '16px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: '#10B981',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                  <CheckCircle2 size={14} />
                  <span>Deterministic secp256k1 Key Derived</span>
                </div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#D1FAE5' }}>
                  {derivedRecoverIdentity.pubkeyCompressedHex}
                </div>
              </div>
            )}

            {error && (
              <div className="status-banner error mb-3" style={{ fontSize: '12px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={busy}
              style={{
                padding: '13px',
                fontSize: '14px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Lock size={17} />
              <span>{busy ? 'Verifying Schnorr Proof...' : 'Verify Schnorr Signature & Restore Wallet'}</span>
            </button>
          </form>
        )}

        {/* Footer Security Note */}
        <div
          style={{
            marginTop: '18px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#6B7280',
          }}
        >
          <span>PBKDF2-HMAC-SHA512 • NUT-13</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#9CA3AF' }}>
            <Sparkles size={12} color="#F7931A" /> Zero Custodial Lock-in
          </span>
        </div>
      </div>
    </div>
  );
};
