import React, { useState } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Download,
  Upload,
  FileCheck2,
  Lock
} from 'lucide-react';
import {
  getStoredMnemonic,
  saveMnemonic,
  isVaultBackedUp,
  markVaultBackedUp,
} from '../utils/bip39Vault';
import {
  exportDatabaseBackup,
  importDatabaseBackup,
} from '../utils/secureStorage';
import { soundController } from '../utils/audioVoice';

interface VaultBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: () => void;
  onOpenPinSetup?: () => void;
}

export const VaultBackupModal: React.FC<VaultBackupModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
  onOpenPinSetup,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'file'>('backup');
  const [mnemonic, setMnemonic] = useState<string[]>(() => getStoredMnemonic());
  const [copied, setCopied] = useState<boolean>(false);
  const [backedUp, setBackedUp] = useState<boolean>(() => isVaultBackedUp());
  
  // Restore State
  const [restoreInput, setRestoreInput] = useState<string>('');
  const [restoreError, setRestoreError] = useState<string>('');
  const [restoreSuccess, setRestoreSuccess] = useState<string>('');

  // File Backup & Checksum State
  const [fileExportSuccess, setFileExportSuccess] = useState<boolean>(false);
  const [fileImportError, setFileImportError] = useState<string>('');
  const [fileImportSuccess, setFileImportSuccess] = useState<string>('');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(mnemonic.join(' '));
    setCopied(true);
    markVaultBackedUp();
    setBackedUp(true);
    soundController.playClick();
    setTimeout(() => setCopied(false), 2500);
  };

  const handleConfirmBackup = () => {
    markVaultBackedUp();
    setBackedUp(true);
    soundController.playPaymentChime();
    alert('Vault marked as backed up! Keep your recovery words in a safe place away from moisture and prying eyes.');
  };

  const handleRestore = () => {
    setRestoreError('');
    setRestoreSuccess('');

    const words = restoreInput.trim().toLowerCase().split(/\s+/);
    if (words.length !== 12) {
      setRestoreError('A valid recovery phrase must contain exactly 12 words.');
      return;
    }

    saveMnemonic(words);
    setMnemonic(words);
    markVaultBackedUp();
    setBackedUp(true);
    soundController.playPaymentChime();
    setRestoreSuccess('Vault seed restored successfully! Proofs re-indexed.');
    onRestoreSuccess();

    setTimeout(() => {
      onClose();
    }, 1800);
  };

  const handleExportDatabase = async () => {
    try {
      const backupJson = await exportDatabaseBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bitfriend-encrypted-vault-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setFileExportSuccess(true);
      soundController.playPaymentChime();
      setTimeout(() => setFileExportSuccess(false), 3000);
    } catch (err: unknown) {
      alert('Failed to export vault database: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleImportDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileImportError('');
    setFileImportSuccess('');

    try {
      const text = await file.text();
      const res = await importDatabaseBackup(text);
      if (res.success) {
        soundController.playPaymentChime();
        setFileImportSuccess('Database backup verified with SHA-256 checksum and restored successfully!');
        onRestoreSuccess();
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        soundController.playClick();
        setFileImportError(res.error || 'Failed to restore backup');
      }
    } catch (err: unknown) {
      setFileImportError('Error parsing backup file: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '540px', width: '92%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={20} color="var(--btc-orange)" />
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Vault Disaster Recovery & Security</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          <button
            className={`btn-secondary ${activeTab === 'backup' ? 'active' : ''}`}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '12px',
              borderColor: activeTab === 'backup' ? 'var(--btc-orange)' : 'var(--border-subtle)',
              color: activeTab === 'backup' ? 'var(--btc-orange)' : 'var(--text-secondary)',
            }}
            onClick={() => setActiveTab('backup')}
          >
            <ShieldCheck size={13} style={{ display: 'inline', marginRight: '4px' }} />
            12-Word Phrase
          </button>
          <button
            className={`btn-secondary ${activeTab === 'restore' ? 'active' : ''}`}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '12px',
              borderColor: activeTab === 'restore' ? 'var(--btc-orange)' : 'var(--border-subtle)',
              color: activeTab === 'restore' ? 'var(--btc-orange)' : 'var(--text-secondary)',
            }}
            onClick={() => setActiveTab('restore')}
          >
            <RefreshCw size={13} style={{ display: 'inline', marginRight: '4px' }} />
            Restore Phrase
          </button>
          <button
            className={`btn-secondary ${activeTab === 'file' ? 'active' : ''}`}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '12px',
              borderColor: activeTab === 'file' ? 'var(--btc-orange)' : 'var(--border-subtle)',
              color: activeTab === 'file' ? 'var(--btc-orange)' : 'var(--text-secondary)',
            }}
            onClick={() => setActiveTab('file')}
          >
            <FileCheck2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
            IndexedDB File
          </button>
        </div>

        {activeTab === 'backup' && (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              These 12 words represent your cryptographic master key. If your phone falls in water or is lost at the market, you can restore your offline satoshis on any new device.
            </p>

            {/* 12-Word Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginBottom: '16px',
                background: 'var(--bg-primary)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {mnemonic.map((word, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    padding: '6px 8px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '18px' }}>
                    {idx + 1}.
                  </span>
                  <span style={{ fontWeight: 600, color: 'white' }}>{word}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <button
                className="btn-secondary"
                style={{ flex: 1, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={handleCopy}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Phrase Copied!' : 'Copy 12 Words'}
              </button>

              <button
                className="btn-primary"
                style={{ flex: 1, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={handleConfirmBackup}
              >
                <ShieldCheck size={15} />
                {backedUp ? '✓ Verified Backed Up' : 'I Wrote These Down'}
              </button>
            </div>

            {onOpenPinSetup && (
              <div style={{ marginBottom: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderColor: 'rgba(247, 147, 26, 0.4)',
                  }}
                  onClick={() => {
                    onClose();
                    onOpenPinSetup();
                  }}
                >
                  <Lock size={15} color="var(--btc-orange)" />
                  <span>Configure 6-Digit Encryption PIN Lock</span>
                </button>
              </div>
            )}

            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                background: 'rgba(247, 147, 26, 0.08)',
                border: '1px solid rgba(247, 147, 26, 0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} color="var(--btc-orange)" style={{ flexShrink: 0 }} />
              <span>
                Never share these 12 words with anyone. BitFriend staff will never ask for your recovery phrase.
              </span>
            </div>
          </div>
        )}

        {activeTab === 'restore' && (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Paste your 12-word recovery phrase separated by spaces to restore your offline bearer vault.
            </p>

            <textarea
              rows={4}
              value={restoreInput}
              onChange={e => setRestoreInput(e.target.value)}
              placeholder="e.g., abandon ability able about above absent absorb abstract absurd abuse access accident"
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                color: 'white',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                marginBottom: '12px',
                resize: 'none',
              }}
            />

            {restoreError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '12px', marginBottom: '10px' }}>
                {restoreError}
              </div>
            )}

            {restoreSuccess && (
              <div style={{ color: 'var(--color-success)', fontSize: '12px', marginBottom: '10px', fontWeight: 600 }}>
                {restoreSuccess}
              </div>
            )}

            <button
              className="btn-primary"
              style={{ width: '100%', fontSize: '14px', padding: '12px' }}
              onClick={handleRestore}
            >
              <RefreshCw size={16} /> Restore Ecash Vault
            </button>
          </div>
        )}

        {activeTab === 'file' && (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Export an encrypted, tamper-evident database file containing all your offline proofs, Adashi circles, and transaction ledger protected by a cryptographic SHA-256 checksum.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={handleExportDatabase}
              >
                <Download size={16} />
                <span>{fileExportSuccess ? '✓ Database Downloaded!' : 'Export Encrypted Database (.json)'}</span>
              </button>

              <label
                className="btn-secondary"
                style={{
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <Upload size={16} />
                <span>Import & Validate Database Checksum</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={handleImportDatabase}
                />
              </label>
            </div>

            {fileImportError && (
              <div
                style={{
                  color: '#ef4444',
                  fontSize: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  marginBottom: '10px',
                }}
              >
                {fileImportError}
              </div>
            )}

            {fileImportSuccess && (
              <div
                style={{
                  color: '#10b981',
                  fontSize: '12px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  marginBottom: '10px',
                  fontWeight: 600,
                }}
              >
                {fileImportSuccess}
              </div>
            )}

            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
              }}
            >
              🔒 <strong>Integrity Guaranteed:</strong> Every export computes a SHA-256 hash. If even a single byte is altered in transit, the checksum verification rejects the restore.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
