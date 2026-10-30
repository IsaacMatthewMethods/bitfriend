import React, { useState } from 'react';
import {
  Key,
  Lock,
  Download,
  Upload,
  Server,
  Save,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { VaultBackupModal } from '../components/VaultBackupModal';
import { PinLockModal } from '../components/PinLockModal';
import { MintSettingsModal } from '../components/MintSettingsModal';
import { MultiMintMonitor } from '../components/MultiMintMonitor';
import { exportVaultBackupFile, parseVaultBackupFile } from '../utils/vaultBackup';
import { setCustomMint } from '../utils/cashuEngine';
import { ApiClient } from '../services/apiClient';

export const SettingsPage: React.FC = () => {
  const {
    userProfile,
    updateUserProfile,
    proofs,
    updateProofs,
    transactions,
    circles,
    lang,
    setLang,
    soundEnabled,
    setSoundEnabled,
    signOutWallet,
  } = useWallet();

  // Form states
  const [name, setName] = useState<string>(userProfile.name);
  const [lightningAddress, setLightningAddress] = useState<string>(userProfile.lightningAddress);
  const [serverUrl, setServerUrl] = useState<string>(() => ApiClient.getBaseUrl());
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Modals
  const [showSeedModal, setShowSeedModal] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [showMintModal, setShowMintModal] = useState<boolean>(false);
  const [showMultiMintModal, setShowMultiMintModal] = useState<boolean>(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    ApiClient.setBaseUrl(serverUrl);
    updateUserProfile({
      name: name.trim() || userProfile.name,
      lightningAddress: lightningAddress.trim() || userProfile.lightningAddress,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleExportBackup = () => {
    exportVaultBackupFile(proofs, transactions, circles);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const backup = parseVaultBackupFile(text);
        if (backup && backup.success && backup.data?.proofs && backup.data.proofs.length > 0) {
          updateProofs(backup.data.proofs);
          alert(`Successfully restored ${backup.data.proofs.length} token notes from backup file!`);
        } else {
          alert(backup.error || 'Invalid backup file format.');
        }
      } catch (err: any) {
        alert(`Restore failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="page-container settings-page">
      <div className="fintech-grid-2col">
        {/* LEFT COLUMN: MERCHANT PROFILE & PREFERENCES */}
        <div className="grid-col-primary">
          {/* Profile Card */}
          <div className="card">
            <h3 className="section-heading-clean">Merchant Identity</h3>

            <form onSubmit={handleSaveProfile} className="mt-3">
              <div className="input-group-fintech">
                <label>Merchant / Display Name</label>
                <input
                  type="text"
                  className="fintech-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bello Ibrahim"
                />
              </div>

              <div className="input-group-fintech">
                <label>Lightning Address Handle</label>
                <input
                  type="text"
                  className="fintech-input"
                  value={lightningAddress}
                  onChange={(e) => setLightningAddress(e.target.value)}
                  placeholder="bello.bitfriend.me"
                />
              </div>

              <div className="input-group-fintech">
                <label>secp256k1 Sovereign Public Key</label>
                <input
                  type="text"
                  className="fintech-input mono-num text-xs text-muted"
                  value={userProfile.pubkey}
                  disabled
                />
              </div>

              <div className="input-group-fintech">
                <label>Backend Node API Endpoint</label>
                <input
                  type="text"
                  className="fintech-input mono-num text-xs"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="/api/v1 or https://node.bitfriend.me/api/v1"
                />
              </div>

              {savedSuccess && (
                <div className="status-banner success mb-2">Profile updated successfully!</div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  <Save size={16} />
                  <span>Save Profile Updates</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: 'rgba(239, 68, 68, 0.35)',
                    color: '#EF4444',
                  }}
                  onClick={() => signOutWallet()}
                >
                  <LogOut size={15} />
                  <span>Switch / Sign Out</span>
                </button>
              </div>
            </form>
          </div>

          {/* Preferences Card */}
          <div className="card">
            <h3>App & Regional Preferences</h3>

            <div className="preference-row mt-3">
              <div>
                <strong>Primary Language</strong>
                <div className="text-muted text-xs">Switch between English and Hausa interface.</div>
              </div>
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => setLang(lang === 'en' ? 'ha' : 'en')}
              >
                {lang === 'en' ? 'Hausa (Harshen Hausa)' : 'English'}
              </button>
            </div>

            <div className="preference-row mt-3">
              <div>
                <strong>Voice Receipt Audio Alerts</strong>
                <div className="text-muted text-xs">Spoken payment announcements in English & Hausa.</div>
              </div>
              <button
                type="button"
                className={`pill-badge ${soundEnabled ? 'green' : 'red'}`}
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? 'Enabled' : 'Muted'}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SECURITY, SEED PHRASE & MINTS */}
        <div className="grid-col-secondary">
          {/* Key Management */}
          <div className="card mb-4">
            <div className="card-header-between">
              <h3>Cryptographic Key Security</h3>
              <span className="pill-badge green">Self-Sovereign</span>
            </div>
            <p className="card-subtitle">Bearer satoshis are stored directly on this device using WebCrypto AES-GCM.</p>

            <div className="security-actions-list mt-3">
              <button
                type="button"
                className="security-item-btn"
                onClick={() => setShowSeedModal(true)}
              >
                <div className="sec-icon"><Key size={18} /></div>
                <div className="sec-details">
                  <div className="sec-title">Backup 12-Word Mnemonic Seed</div>
                  <div className="sec-desc">Export or view your master recovery seed phrase.</div>
                </div>
                <span className="sec-arrow">→</span>
              </button>

              <button
                type="button"
                className="security-item-btn"
                onClick={() => setShowPinModal(true)}
              >
                <div className="sec-icon"><Lock size={18} /></div>
                <div className="sec-details">
                  <div className="sec-title">Configure 6-Digit Master PIN</div>
                  <div className="sec-desc">Encrypt database at rest with PBKDF2 + AES-GCM.</div>
                </div>
                <span className="sec-arrow">→</span>
              </button>

              <button
                type="button"
                className="security-item-btn"
                onClick={handleExportBackup}
              >
                <div className="sec-icon"><Download size={18} /></div>
                <div className="sec-details">
                  <div className="sec-title">Export Vault Backup (.json)</div>
                  <div className="sec-desc">Download an encrypted snapshot of all active token notes.</div>
                </div>
                <span className="sec-arrow">→</span>
              </button>

              <button
                type="button"
                className="security-item-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="sec-icon"><Upload size={18} /></div>
                <div className="sec-details">
                  <div className="sec-title">Restore Vault from Backup File</div>
                  <div className="sec-desc">Import a previously saved BitFriend JSON backup.</div>
                </div>
                <span className="sec-arrow">→</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileSelected}
              />
            </div>
          </div>

          {/* Node & Mint Infrastructure */}
          <div className="card">
            <div className="card-header-between">
              <h3>Protocol Nodes & Mints</h3>
              <span className="pill-badge orange">NUT-03/07</span>
            </div>

            <div className="security-actions-list mt-3">
              <button
                type="button"
                className="security-item-btn"
                onClick={() => setShowMultiMintModal(true)}
              >
                <div className="sec-icon"><Server size={18} /></div>
                <div className="sec-details">
                  <div className="sec-title">Multi-Mint Latency Monitor</div>
                  <div className="sec-desc">Check response times and failover routing across 4 mints.</div>
                </div>
                <span className="sec-arrow">→</span>
              </button>

              <button
                type="button"
                className="security-item-btn"
                onClick={() => setShowMintModal(true)}
              >
                <div className="sec-icon"><RefreshCw size={18} /></div>
                <div className="sec-details">
                  <div className="sec-title">Connected Cashu Mint Settings</div>
                  <div className="sec-desc">Configure custom private mint endpoint URLs.</div>
                </div>
                <span className="sec-arrow">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <VaultBackupModal
        isOpen={showSeedModal}
        onClose={() => setShowSeedModal(false)}
        onRestoreSuccess={() => {}}
      />

      <PinLockModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => setShowPinModal(false)}
        lang={lang}
        allowDismiss={true}
        initialMode="setup"
      />

      <MintSettingsModal
        isOpen={showMintModal}
        onClose={() => setShowMintModal(false)}
        onMintChanged={() => {}}
      />

      <MultiMintMonitor
        isOpen={showMultiMintModal}
        onClose={() => setShowMultiMintModal(false)}
        onMintSelected={(url) => setCustomMint(url)}
      />
    </div>
  );
};
