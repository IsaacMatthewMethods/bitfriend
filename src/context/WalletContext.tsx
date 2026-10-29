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
import { isVaultBackedUp } from '../utils/bip39Vault';
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
}

const DEFAULT_PROFILE: UserProfile = {
  name: 'Bello Ibrahim',
  lightningAddress: 'bello.bitfriend.me',
  pubkey: 'npub1bf99a07x87c4v29zq44e99m1234567890abcdef',
  isVerified: true,
  isOnboarded: true,
  currency: 'NGN',
};

const WalletContext = createContext<WalletContextType | null>(null);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { satsToNgn } = useMarket();

  // User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('bitfriend_user_profile');
      if (saved) return JSON.parse(saved);
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

    // Load Adashi circles
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
  };

  const updateProofs = (newProofs: CashuProof[]) => {
    setProofs(newProofs);
    saveStoredProofs(newProofs);
    saveSecureProofs(newProofs).catch(console.warn);
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

      const incomingAmount = decoded.proofs.reduce((sum, p) => sum + p.amount, 0);
      const combined = [...proofs, ...decoded.proofs];
      updateProofs(combined);

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
