import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Language, CashuProof, PaymentTransaction, AdashiCircle } from '../types';
import {
  getStoredProofs,
  saveStoredProofs,
  encodeCashuToken,
  decodeCashuToken,
  spendProofs,
} from '../utils/cashuEngine';
import {
  isPinConfigured,
  subscribeLockState,
  getSecureProofs,
  saveSecureProofs,
  getSecureTransactions,
  saveSecureTransactions,
  getSecureCircles,
  saveSecureCircles,
  migrateFromLocalStorage,
} from '../utils/secureStorage';
import {
  isVaultBackedUp,
  markVaultBackedUp,
  saveMnemonic,
  getStoredMnemonic,
  deriveWalletIdentityFromMnemonic,
  signAuthChallenge,
} from '../utils/bip39Vault';
import { ApiClient } from '../services/apiClient';
import { soundController } from '../utils/audioVoice';
import { useMarket } from './MarketContext';

export interface UserProfile {
  name: string;
  lightningAddress: string;
  pubkey: string;
  isVerified: boolean;
  isOnboarded: boolean;
  currency: 'NGN' | 'USD';
}

export interface WalletContextType {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  proofs: CashuProof[];
  ecashBalanceSats: number;
  lightningBalanceSats: number;
  totalBalanceSats: number;
  totalBalanceNgn: number;
  transactions: PaymentTransaction[];
  circles: AdashiCircle[];
  isOffline: boolean;
  setIsOffline: (v: boolean) => void;
  isLocked: boolean;
  setIsLocked: (v: boolean) => void;
  lang: Language;
  setLang: (l: Language) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  hideBalance: boolean;
  setHideBalance: (v: boolean) => void;
  vaultBackedUp: boolean;
  setVaultBackedUp: (v: boolean) => void;
  addTransaction: (tx: PaymentTransaction) => void;
  updateProofs: (proofs: CashuProof[]) => void;
  updateCircles: (circles: AdashiCircle[]) => void;
  spendFromVault: (amountSats: number) => { success: boolean; token?: string; error?: string };
  claimCashuToken: (tokenString: string) => { success: boolean; amountSats?: number; error?: string };
  depositToLightning: (amountSats: number) => void;
  withdrawFromLightning: (amountSats: number) => boolean;
  completeOnboarding: (params: {
    name: string;
    lightningAddress: string;
    currency: 'NGN' | 'USD';
    mnemonic: string[];
    isRecovery?: boolean;
  }) => Promise<void>;
  signOutWallet: () => void;
}

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  lightningAddress: '',
  pubkey: '',
  isVerified: true,
  isOnboarded: false,
  currency: 'NGN',
};

const WalletContext = createContext<WalletContextType | null>(null);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { satsToNgn } = useMarket();

  // User Profile (backed by deterministic BIP-39 secp256k1 identity)
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const isAuthedV2 = localStorage.getItem('bitfriend_sovereign_authenticated_v2') === 'true';
      if (!isAuthedV2) {
        return DEFAULT_PROFILE;
      }
      const mnemonic = getStoredMnemonic();
      const identity = deriveWalletIdentityFromMnemonic(mnemonic);
      const saved = localStorage.getItem('bitfriend_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved) as UserProfile;
        if (!parsed.pubkey || !/^[0-9a-f]{64,66}$/i.test(parsed.pubkey)) {
          parsed.pubkey = identity.pubkeyCompressedHex;
          localStorage.setItem('bitfriend_user_profile', JSON.stringify(parsed));
        }
        return { ...parsed, isOnboarded: true };
      }
      return DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      const updated = { ...prev, ...updates };
      try {
        localStorage.setItem('bitfriend_user_profile', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save profile', err);
      }
      // Sync to SQLite backend if online
      ApiClient.updateProfile({
        username: updated.name,
        lightningAddress: updated.lightningAddress,
        currency: updated.currency,
      }).catch(() => {
        // Offline fallback is already persisted in localStorage
      });
      return updated;
    });
  };

  // Proofs & Balances
  const [proofs, setProofs] = useState<CashuProof[]>([]);
  const [lightningBalanceSats, setLightningBalanceSats] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('bitfriend_lightning_sats');
      return saved ? parseInt(saved, 10) : 15400;
    } catch {
      return 15400;
    }
  });

  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [circles, setCircles] = useState<AdashiCircle[]>([]);

  // UI state
  const [isOffline, setIsOffline] = useState<boolean>(() => !navigator.onLine);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lang, setLang] = useState<Language>('en');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [hideBalance, setHideBalance] = useState<boolean>(false);
  const [vaultBackedUp, setVaultBackedUp] = useState<boolean>(() => isVaultBackedUp());

  // Calculated Balances
  const ecashBalanceSats = proofs.reduce((sum, p) => sum + p.amount, 0);
  const totalBalanceSats = ecashBalanceSats + lightningBalanceSats;
  const totalBalanceNgn = satsToNgn(totalBalanceSats);

  // Initialize data on mount
  useEffect(() => {
    let mounted = true;

    // Migrate from local storage if needed
    migrateFromLocalStorage().catch(console.warn);

    // Authenticate with backend SQLite node using real BIP-340 Schnorr signature (only if onboarded)
    (async () => {
      try {
        if (localStorage.getItem('bitfriend_sovereign_authenticated_v2') !== 'true') {
          return;
        }
        const mnemonic = getStoredMnemonic();
        const identity = deriveWalletIdentityFromMnemonic(mnemonic);
        const health = await ApiClient.checkHealth();
        if (!health.online || !mounted) return;

        let profileData: any = null;
        if (ApiClient.getAuthToken()) {
          try {
            profileData = await ApiClient.getProfile();
          } catch {
            // Token expired or revoked — re-authenticate via Schnorr challenge
            ApiClient.setAuthToken(null);
          }
        }

        if (!profileData) {
          await ApiClient.authenticateWithSchnorr(
            identity.pubkeyCompressedHex,
            (nonce) => signAuthChallenge(nonce, mnemonic).signatureHex
          );
          profileData = await ApiClient.getProfile();
        }

        if (mounted && profileData?.user) {
          setUserProfile((prev) => {
            const synced: UserProfile = {
              ...prev,
              isOnboarded: true,
              pubkey: identity.pubkeyCompressedHex,
              name:
                profileData.user.username && !profileData.user.username.startsWith('Vendor_')
                  ? profileData.user.username
                  : prev.name,
              lightningAddress: profileData.user.lightning_address || prev.lightningAddress,
              currency: (profileData.user.currency as 'NGN' | 'USD') || prev.currency,
            };
            localStorage.setItem('bitfriend_user_profile', JSON.stringify(synced));
            return synced;
          });
        }
      } catch {
        // Offline mode: local vault remains active
      }
    })();

    // Load initial proofs
    getSecureProofs()
      .then((loaded) => {
        if (!mounted) return;
        if (loaded && loaded.length > 0) {
          setProofs(loaded);
        } else {
          const fallback = getStoredProofs();
          setProofs(fallback);
          saveSecureProofs(fallback).catch(console.warn);
        }
      })
      .catch(() => {
        if (mounted) setProofs(getStoredProofs());
      });

    // Load transactions
    getSecureTransactions()
      .then((loaded) => {
        if (!mounted) return;
        if (loaded && loaded.length > 0) {
          setTransactions(loaded);
        } else {
          try {
            const saved = localStorage.getItem('bitfriend_tx_history');
            if (saved) setTransactions(JSON.parse(saved));
          } catch (e) {
            console.warn(e);
          }
        }
      })
      .catch(console.warn);

    // Load Adashi circles from SQLite backend first, fallback to IndexedDB / localStorage
    (async () => {
      try {
        const remoteCircles = await ApiClient.getAdashiCircles();
        if (mounted && Array.isArray(remoteCircles) && remoteCircles.length > 0) {
          const mapped: AdashiCircle[] = remoteCircles.map((rc: any) => ({
            id: rc.id,
            name: rc.title || rc.name,
            category: rc.description || 'Cooperative Pool',
            frequency: (rc.cycle_type || 'weekly').toLowerCase() as 'daily' | 'weekly' | 'monthly',
            contributionSats: rc.contribution_sats || 25000,
            currentRound: rc.current_round || 1,
            totalRounds: rc.max_rounds || 5,
            nextPayoutDate: 'Friday 4:00 PM',
            members: Array.isArray(rc.members)
              ? rc.members.map((m: any, idx: number) => ({
                  id: m.id || `m_${idx}`,
                  name: m.member_alias || m.name || 'Member',
                  location: 'Northern Trade Corridor',
                  avatar: (m.member_alias || 'BF')
                    .split(' ')
                    .map((w: string) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2),
                  hasContributed:
                    (m.total_contributed_sats || 0) >=
                    (rc.current_round || 1) * (rc.contribution_sats || 25000),
                  turnOrder: m.round_payout_index || idx + 1,
                  isCurrentRecipient: (m.round_payout_index || idx + 1) === (rc.current_round || 1),
                }))
              : [],
          }));
          setCircles(mapped);
          saveSecureCircles(mapped).catch(() => {});
          return;
        }
      } catch {
        // Offline fallback
      }
      getSecureCircles()
        .then((loaded) => {
          if (!mounted) return;
          if (loaded && loaded.length > 0) {
            setCircles(loaded);
          } else {
            try {
              const saved = localStorage.getItem('bitfriend_adashi_circles');
              if (saved) setCircles(JSON.parse(saved));
            } catch (e) {
              console.warn(e);
            }
          }
        })
        .catch(console.warn);
    })();

    // Online/Offline listener
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    // Pin lock listener - listen for lock changes
    let unsubscribeLock: (() => void) | null = null;
    isPinConfigured().then((configured) => {
      if (!mounted) return;
      if (configured) {
        unsubscribeLock = subscribeLockState((locked) => {
          if (mounted) setIsLocked(locked);
        });
      }
    }).catch(console.warn);

    return () => {
      mounted = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (unsubscribeLock) unsubscribeLock();
    };
  }, []);

  const addTransaction = (tx: PaymentTransaction) => {
    setTransactions((prev) => {
      const updated = [tx, ...prev];
      saveSecureTransactions(updated).catch(console.warn);
      try {
        localStorage.setItem('bitfriend_tx_history', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });

    // Persist transaction record to SQLite backend if online
    ApiClient.recordTransaction({
      pubkey: userProfile.pubkey,
      txHash: tx.id,
      direction: tx.type === 'incoming' ? 'INCOMING' : 'OUTGOING',
      type: tx.method === 'lightning' ? 'LIGHTNING_INVOICE' : 'CASHU_ECASH',
      amountSats: tx.amountSats,
      amountNgn: tx.amountNgn,
      status: tx.status.toUpperCase(),
      memo: tx.memo,
      proofCount: 1,
    }).catch(() => {});
  };

  const updateProofs = (newProofs: CashuProof[]) => {
    setProofs(newProofs);
    saveStoredProofs(newProofs);
    saveSecureProofs(newProofs).catch(console.warn);
    ApiClient.syncProofs(newProofs, undefined, userProfile.pubkey).catch(() => {});
  };

  const updateCircles = (newCircles: AdashiCircle[]) => {
    setCircles(newCircles);
    saveSecureCircles(newCircles).catch(console.warn);
    try {
      localStorage.setItem('bitfriend_adashi_circles', JSON.stringify(newCircles));
    } catch (e) {
      console.warn(e);
    }
  };

  const spendFromVault = (amountSats: number): { success: boolean; token?: string; error?: string } => {
    if (amountSats > ecashBalanceSats) {
      return { success: false, error: 'Insufficient vault balance' };
    }

    const res = spendProofs(amountSats, proofs);
    if (!res) {
      return { success: false, error: 'Failed to split proofs' };
    }

    updateProofs(res.remaining);
    const token = encodeCashuToken(res.spent);

    const tx: PaymentTransaction = {
      id: `tx_${Date.now()}`,
      timestamp: Date.now(),
      amountSats,
      amountNgn: satsToNgn(amountSats),
      type: 'outgoing',
      memo: `Ecash Voucher (${amountSats} sats)`,
      status: 'settled',
      method: 'cashu',
      offline: true,
    };
    addTransaction(tx);
    soundController.playPaymentChime();

    return { success: true, token };
  };

  const claimCashuToken = (tokenString: string): { success: boolean; amountSats?: number; error?: string } => {
    try {
      const decoded = decodeCashuToken(tokenString.trim());
      if (!decoded || !decoded.proofs || decoded.proofs.length === 0) {
        return { success: false, error: 'Invalid or empty Cashu token' };
      }

      // Check local double-spend registry
      const existingSecrets = new Set(proofs.map((p) => p.secret));
      let claimedSecrets: string[] = [];
      try {
        const rawClaimed = localStorage.getItem('bitfriend_claimed_secrets');
        if (rawClaimed) claimedSecrets = JSON.parse(rawClaimed);
      } catch {
        // ignore
      }
      const spentSet = new Set(claimedSecrets);

      for (const p of decoded.proofs) {
        if (existingSecrets.has(p.secret) || spentSet.has(p.secret)) {
          return {
            success: false,
            error: `Double-spend detected! Voucher proof ${p.secret.slice(0, 12)}... has already been redeemed.`,
          };
        }
      }

      // Record secrets as claimed locally
      try {
        const updatedClaimed = [...claimedSecrets, ...decoded.proofs.map((p) => p.secret)].slice(-500);
        localStorage.setItem('bitfriend_claimed_secrets', JSON.stringify(updatedClaimed));
      } catch {
        // ignore
      }

      const incomingAmount = decoded.proofs.reduce((sum, p) => sum + p.amount, 0);
      const combined = [...proofs, ...decoded.proofs];
      updateProofs(combined);

      // Perform atomic NUT-03 claim & swap on SQLite backend if online
      ApiClient.claimProofs(decoded.proofs, decoded.mint, userProfile.pubkey)
        .then((res) => {
          if (res && Array.isArray(res.freshProofs) && res.freshProofs.length > 0) {
            const incomingSecretSet = new Set(decoded.proofs.map((p) => p.secret));
            setProofs((curr) => {
              const swapped = curr.filter((p) => !incomingSecretSet.has(p.secret)).concat(res.freshProofs);
              saveStoredProofs(swapped);
              saveSecureProofs(swapped).catch(console.warn);
              return swapped;
            });
          }
        })
        .catch(() => {
          // Offline mode: local proofs remain stored until auto-swap on reconnect
        });

      const tx: PaymentTransaction = {
        id: `tx_${Date.now()}`,
        timestamp: Date.now(),
        amountSats: incomingAmount,
        amountNgn: satsToNgn(incomingAmount),
        type: 'incoming',
        memo: `Redeemed Cashu Voucher`,
        status: 'settled',
        method: 'cashu',
        offline: isOffline,
      };
      addTransaction(tx);
      soundController.playPaymentChime();

      return { success: true, amountSats: incomingAmount };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to claim token' };
    }
  };

  const depositToLightning = (amountSats: number) => {
    setLightningBalanceSats((prev) => {
      const updated = prev + amountSats;
      localStorage.setItem('bitfriend_lightning_sats', updated.toString());
      return updated;
    });
  };

  const withdrawFromLightning = (amountSats: number): boolean => {
    if (amountSats > lightningBalanceSats) return false;
    setLightningBalanceSats((prev) => {
      const updated = prev - amountSats;
      localStorage.setItem('bitfriend_lightning_sats', updated.toString());
      return updated;
    });
    return true;
  };

  const completeOnboarding = async (params: {
    name: string;
    lightningAddress: string;
    currency: 'NGN' | 'USD';
    mnemonic: string[];
    isRecovery?: boolean;
  }) => {
    saveMnemonic(params.mnemonic);
    markVaultBackedUp();
    setVaultBackedUp(true);

    const identity = deriveWalletIdentityFromMnemonic(params.mnemonic);

    let finalName = params.name.trim() || 'Sovereign Merchant';
    let finalHandle =
      params.lightningAddress.trim() ||
      `${finalName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'merchant'}@bitfriend.me`;
    let finalCurrency = params.currency || 'NGN';

    try {
      const health = await ApiClient.checkHealth();
      if (health.online) {
        await ApiClient.authenticateWithSchnorr(
          identity.pubkeyCompressedHex,
          (nonce) => signAuthChallenge(nonce, params.mnemonic).signatureHex
        );

        if (params.isRecovery && !params.name.trim()) {
          const existing = await ApiClient.getProfile();
          if (existing?.user) {
            if (existing.user.username && !existing.user.username.startsWith('Vendor_')) {
              finalName = existing.user.username;
            }
            if (existing.user.lightning_address) {
              finalHandle = existing.user.lightning_address;
            }
            if (existing.user.currency) {
              finalCurrency = existing.user.currency as 'NGN' | 'USD';
            }
          }
        } else {
          await ApiClient.updateProfile({
            username: finalName,
            lightningAddress: finalHandle,
            currency: finalCurrency,
          });
        }

        // Sync or restore proofs with backend SQLite mint
        if (proofs.length > 0) {
          await ApiClient.syncProofs(proofs, undefined, identity.pubkeyCompressedHex).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Backend onboarding sync warning (continuing with local sovereign vault):', err);
    }

    const onboardedProfile: UserProfile = {
      name: finalName,
      lightningAddress: finalHandle,
      pubkey: identity.pubkeyCompressedHex,
      isVerified: true,
      isOnboarded: true,
      currency: finalCurrency,
    };

    localStorage.setItem('bitfriend_user_profile', JSON.stringify(onboardedProfile));
    localStorage.setItem('bitfriend_sovereign_authenticated_v2', 'true');
    setUserProfile(onboardedProfile);
  };

  const signOutWallet = () => {
    localStorage.removeItem('bitfriend_sovereign_authenticated_v2');
    localStorage.removeItem('bitfriend_user_profile');
    ApiClient.setAuthToken(null);
    setUserProfile(DEFAULT_PROFILE);
  };

  return (
    <WalletContext.Provider
      value={{
        userProfile,
        setUserProfile,
        updateUserProfile,
        proofs,
        ecashBalanceSats,
        lightningBalanceSats,
        totalBalanceSats,
        totalBalanceNgn,
        transactions,
        circles,
        isOffline,
        setIsOffline,
        isLocked,
        setIsLocked,
        lang,
        setLang,
        soundEnabled,
        setSoundEnabled,
        hideBalance,
        setHideBalance,
        vaultBackedUp,
        setVaultBackedUp,
        addTransaction,
        updateProofs,
        updateCircles,
        spendFromVault,
        claimCashuToken,
        depositToLightning,
        withdrawFromLightning,
        completeOnboarding,
        signOutWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
};
