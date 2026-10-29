import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Zap,
  ShieldCheck,
  Store,
  Users,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  QrCode,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Award,
  Camera,
  Server,
  Download,
  Printer,
  Plus,
  Radio,
  Key,
  AtSign,
  Activity,
  Smartphone,
  Sliders,
  MessageSquare,
  Upload,
  Lock,
  KeyRound,
  Building2
} from 'lucide-react';
import type { Language, CashuProof, PaymentTransaction, AdashiCircle } from './types';
import { getTranslation } from './utils/translations';
import {
  satsToNgn,
  ngnToSats,
  getStoredProofs,
  saveStoredProofs,
  encodeCashuToken,
  decodeCashuToken,
  spendProofs,
  generateProof,
  getCustomMint,
  BTC_TO_NGN_RATE,
  requestMintQuote,
  autoSwapOfflineProofs
} from './utils/cashuEngine';
import { soundController } from './utils/audioVoice';
import { isWebLNAvailable, requestWebLNPayment } from './utils/webln';
import { isVaultBackedUp } from './utils/bip39Vault';
import { exportVaultBackupFile, parseVaultBackupFile } from './utils/vaultBackup';
import {
  isPinConfigured,
  lockVault,
  subscribeLockState,
  migrateFromLocalStorage,
  getSecureProofs,
  getSecureTransactions,
  getSecureCircles,
  saveSecureProofs,
  saveSecureTransactions,
  saveSecureCircles
} from './utils/secureStorage';
import { QrScannerModal } from './components/QrScannerModal';
import { CreateAdashiModal } from './components/CreateAdashiModal';
import { ReceiptModal, exportTransactionsToCsv } from './components/ReceiptModal';
import { NfcTapModal } from './components/NfcTapModal';
import { MintSettingsModal } from './components/MintSettingsModal';
import { VaultBackupModal } from './components/VaultBackupModal';
import { LightningAddressModal } from './components/LightningAddressModal';
import { MultiMintMonitor } from './components/MultiMintMonitor';
import { InteractivePitchDeck } from './components/InteractivePitchDeck';
import { MarketSimulationLab } from './components/MarketSimulationLab';
import { SmsBeamModal } from './components/SmsBeamModal';
import { PinLockModal } from './components/PinLockModal';
import { BitChatView } from './components/chat/BitChatView';
import { WithdrawToBankModal } from './components/WithdrawToBankModal';
import {
  testRelayConnections,
  subscribeRelayStatus,
  broadcastAdashiEvent,
  subscribeToAdashiCircleEvents
} from './utils/nostrClient';
import './App.css';

// Initial Adashi Circles for Grassroots Merchants
const INITIAL_CIRCLES: AdashiCircle[] = [
  {
    id: 'circle-1',
    name: 'Central Market Fabric Traders Pot',
    category: 'Market Traders Cooperative',
    frequency: 'weekly',
    contributionSats: 2500,
    currentRound: 3,
    totalRounds: 5,
    nextPayoutDate: 'Next Monday, 9:00 AM',
    members: [
      { id: 'm1', name: 'Fatima Sani', location: 'North Market', avatar: 'FS', hasContributed: true, turnOrder: 1, isCurrentRecipient: false },
      { id: 'm2', name: 'Ibrahim Bello', location: 'West Terminal', avatar: 'IB', hasContributed: true, turnOrder: 2, isCurrentRecipient: false },
      { id: 'm3', name: 'Amina Garba (You)', location: 'Central Hub', avatar: 'AG', hasContributed: true, turnOrder: 3, isCurrentRecipient: true },
      { id: 'm4', name: 'Yusuf Danjuma', location: 'South District', avatar: 'YD', hasContributed: false, turnOrder: 4, isCurrentRecipient: false },
      { id: 'm5', name: 'Usman Aliyu', location: 'Old City Market', avatar: 'UA', hasContributed: false, turnOrder: 5, isCurrentRecipient: false },
    ],
  },
  {
    id: 'circle-2',
    name: 'Metro Tricycle Riders Daily Pool',
    category: 'Transport Union',
    frequency: 'daily',
    contributionSats: 1000,
    currentRound: 2,
    totalRounds: 4,
    nextPayoutDate: 'Tomorrow, 6:00 PM',
    members: [
      { id: 'k1', name: 'Musa Abdullahi', location: 'Station Hub', avatar: 'MA', hasContributed: true, turnOrder: 1, isCurrentRecipient: false },
      { id: 'k2', name: 'Shehu Garba', location: 'East District', avatar: 'SG', hasContributed: false, turnOrder: 2, isCurrentRecipient: true },
      { id: 'k3', name: 'Aliyu Umar', location: 'Industrial Zone', avatar: 'AU', hasContributed: true, turnOrder: 3, isCurrentRecipient: false },
      { id: 'k4', name: 'Balarabe Dikko', location: 'Transit Park', avatar: 'BD', hasContributed: false, turnOrder: 4, isCurrentRecipient: false },
    ],
  },
];

const INITIAL_TRANSACTIONS: PaymentTransaction[] = [
  {
    id: 'tx-001',
    timestamp: Date.now() - 3600000 * 2,
    type: 'incoming',
    amountSats: 1200,
    amountNgn: satsToNgn(1200),
    memo: '2x Yards Guinea Brocade',
    status: 'settled',
    method: 'cashu',
    offline: true,
  },
  {
    id: 'tx-002',
    timestamp: Date.now() - 3600000 * 5,
    type: 'outgoing',
    amountSats: 2500,
    amountNgn: satsToNgn(2500),
    memo: 'Adashi Round 2 Share',
    status: 'settled',
    method: 'cashu',
    offline: true,
  },
  {
    id: 'tx-003',
    timestamp: Date.now() - 3600000 * 18,
    type: 'incoming',
    amountSats: 5000,
    amountNgn: satsToNgn(5000),
    memo: 'Lightning Topup via Blink',
    status: 'settled',
    method: 'lightning',
    offline: false,
  },
];

export const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('ha');
  const [isOffline, setIsOffline] = useState<boolean>(() => !navigator.onLine);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'pos' | 'bitchat' | 'vault' | 'adashi' | 'history'>('pos');
  
  // Modals
  const [showPitchModal, setShowPitchModal] = useState<boolean>(false);
  const [showQrScanner, setShowQrScanner] = useState<boolean>(false);
  const [scannerTarget, setScannerTarget] = useState<'pos' | 'vault'>('pos');
  const [showCreateAdashi, setShowCreateAdashi] = useState<boolean>(false);
  const [receiptTx, setReceiptTx] = useState<PaymentTransaction | null>(null);
  const [showNfcModal, setShowNfcModal] = useState<boolean>(false);
  const [showMintModal, setShowMintModal] = useState<boolean>(false);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const [showLnAddressModal, setShowLnAddressModal] = useState<boolean>(false);
  const [showMultiMintModal, setShowMultiMintModal] = useState<boolean>(false);
  const [showSimulationLab, setShowSimulationLab] = useState<boolean>(false);
  const [showSmsBeam, setShowSmsBeam] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinModalMode, setPinModalMode] = useState<'unlock' | 'setup'>('unlock');
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [hasConfiguredPin, setHasConfiguredPin] = useState<boolean>(false);
  const [isVaultLockedState, setIsVaultLockedState] = useState<boolean>(false);
  const [connectedRelays, setConnectedRelays] = useState<number>(3);
  
  const [activeMintUrl, setActiveMintUrl] = useState<string>(getCustomMint());
  const [vaultBackedUp, setVaultBackedUp] = useState<boolean>(() => isVaultBackedUp());
  const [hasWebLN, setHasWebLN] = useState<boolean>(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const vaultFileRef = React.useRef<HTMLInputElement | null>(null);

  // Balances & Proofs
  const [proofs, setProofs] = useState<CashuProof[]>([]);
  const [lightningSats, setLightningSats] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('bitfriend_lightning_sats');
      return saved ? parseInt(saved, 10) : 15400;
    } catch {
      return 15400;
    }
  });

  // Persistent Transactions
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('bitfriend_tx_history');
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  // Persistent Adashi Circles
  const [circles, setCircles] = useState<AdashiCircle[]>(() => {
    try {
      const saved = localStorage.getItem('bitfriend_adashi_circles');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (JSON.stringify(parsed).includes('Kaduna') || JSON.stringify(parsed).includes('Barci')) {
          localStorage.setItem('bitfriend_adashi_circles', JSON.stringify(INITIAL_CIRCLES));
          return INITIAL_CIRCLES;
        }
        return parsed;
      }
      return INITIAL_CIRCLES;
    } catch {
      return INITIAL_CIRCLES;
    }
  });

  // POS State
  const [chargeNgn, setChargeNgn] = useState<string>('1500');
  const [customerNote, setCustomerNote] = useState<string>('Central Market Store Sale');
  const [posSuccessData, setPosSuccessData] = useState<{ amountSats: number; amountNgn: number; txId: string } | null>(null);

  // Vault State
  const [voucherAmount, setVoucherAmount] = useState<string>('500');
  const [createdVoucher, setCreatedVoucher] = useState<string>('');
  const [redeemInput, setRedeemInput] = useState<string>('');
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState<string>('');
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Adashi State
  const [adashiNotice, setAdashiNotice] = useState<string>('');

  const t = getTranslation(lang);

  // Listen for native online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // NUT-03: Auto-swap received offline proofs with mint to prevent double-spending
      autoSwapOfflineProofs(proofs).then(res => {
        if (res.swapped) {
          setProofs(res.updatedProofs);
          saveStoredProofs(res.updatedProofs);
          soundController.playPaymentChime();
        }
      }).catch(console.warn);
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check WebLN
    setHasWebLN(isWebLNAvailable());

    // Listen for PWA beforeinstallprompt
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  // Load stored proofs and migrate to encrypted IndexedDB on mount
  useEffect(() => {
    let mounted = true;

    // Migrate from localStorage to encrypted IndexedDB with zero data loss
    migrateFromLocalStorage().then(async () => {
      try {
        const [secProofs, secTxs, secCircles, pinSet] = await Promise.all([
          getSecureProofs(),
          getSecureTransactions(),
          getSecureCircles(),
          isPinConfigured(),
        ]);
        if (mounted) {
          if (secProofs && secProofs.length > 0) setProofs(secProofs);
          else setProofs(getStoredProofs());
          if (secTxs && secTxs.length > 0) setTransactions(secTxs);
          if (secCircles && secCircles.length > 0) setCircles(secCircles);
          setHasConfiguredPin(pinSet);
        }
      } catch (err) {
        console.warn('Secure storage initial load notice:', err);
        if (mounted) setProofs(getStoredProofs());
      }
    });

    // Subscribe to PIN auto-lock events (e.g. 5 minutes inactivity)
    const unsubscribe = subscribeLockState((locked) => {
      if (mounted) {
        setIsVaultLockedState(locked);
        if (locked) {
          isPinConfigured().then(configured => {
            if (configured && mounted) {
              setPinModalMode('unlock');
              setShowPinModal(true);
            }
          });
        }
      }
    });

    // Nostr Relay Status & Multi-Device Adashi Sync
    const unsubRelay = subscribeRelayStatus((count) => {
      if (mounted) setConnectedRelays(count);
    });
    testRelayConnections().catch(console.warn);

    const unsubAdashi = subscribeToAdashiCircleEvents('circle-1', (payload) => {
      if (!mounted) return;
      if (payload.action === 'contribute' && payload.memberId !== 'm3') {
        soundController.playPaymentChime();
        setCircles(prev =>
          prev.map(c => {
            if (c.id !== payload.circleId) return c;
            const updatedMembers = c.members.map(m =>
              m.id === payload.memberId ? { ...m, hasContributed: true } : m
            );
            return { ...c, members: updatedMembers };
          })
        );
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      unsubRelay();
      unsubAdashi();
    };
  }, []);

  // Update sound controller
  useEffect(() => {
    soundController.enabled = soundEnabled;
  }, [soundEnabled]);

  // Save proofs to secure storage & localStorage
  useEffect(() => {
    if (proofs.length > 0) {
      saveSecureProofs(proofs).catch(err => console.warn('Secure save proofs error:', err));
    }
  }, [proofs]);

  // Save transactions to secure storage & localStorage
  useEffect(() => {
    try {
      localStorage.setItem('bitfriend_tx_history', JSON.stringify(transactions));
      saveSecureTransactions(transactions).catch(err => console.warn('Secure save txs error:', err));
    } catch (err) {
      console.warn('Failed to save transactions', err);
    }
  }, [transactions]);

  // Save circles to secure storage & localStorage
  useEffect(() => {
    try {
      localStorage.setItem('bitfriend_adashi_circles', JSON.stringify(circles));
      saveSecureCircles(circles).catch(err => console.warn('Secure save circles error:', err));
    } catch (err) {
      console.warn('Failed to save circles', err);
    }
  }, [circles]);

  // Save lightning sats
  useEffect(() => {
    try {
      localStorage.setItem('bitfriend_lightning_sats', lightningSats.toString());
    } catch (err) {
      console.warn('Failed to save lightning sats', err);
    }
  }, [lightningSats]);

  const vaultSats = proofs.reduce((sum, p) => sum + p.amount, 0);
  const totalSats = vaultSats + lightningSats;
  const totalNgn = satsToNgn(totalSats);

  // POS sat calculation
  const posSats = ngnToSats(parseFloat(chargeNgn) || 0);

  // POS Payment Simulation
  const handleSimulatePayment = (amountSatsOverride?: number, noteOverride?: string) => {
    const finalSats = amountSatsOverride ?? posSats;
    if (finalSats <= 0) return;

    const finalNgn = amountSatsOverride ? satsToNgn(amountSatsOverride) : (parseFloat(chargeNgn) || 0);
    const finalNote = noteOverride || customerNote || 'Market Terminal Sale';

    soundController.playPaymentChime();

    // Trigger confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#F7931A', '#10B981', '#FFB300', '#8B5CF6']
    });

    // Voice announcement
    soundController.speakReceipt(finalSats, lang);

    // Create new incoming proofs stored directly in offline vault
    const newProofs = [generateProof(finalSats, activeMintUrl)];
    const updatedProofs = [...proofs, ...newProofs];
    setProofs(updatedProofs);
    saveStoredProofs(updatedProofs);

    // Record transaction
    const txId = `pos-${Date.now()}`;
    const newTx: PaymentTransaction = {
      id: txId,
      timestamp: Date.now(),
      type: 'incoming',
      amountSats: finalSats,
      amountNgn: finalNgn,
      memo: finalNote,
      status: 'settled',
      method: 'cashu',
      offline: isOffline,
    };
    setTransactions(prev => [newTx, ...prev]);

    setPosSuccessData({
      amountSats: finalSats,
      amountNgn: finalNgn,
      txId,
    });
  };

  // WebLN 1-Click Payment Handler
  const handleWebLNPay = async () => {
    if (posSats <= 0) return;
    try {
      const quote = await requestMintQuote(posSats, activeMintUrl);
      const res = await requestWebLNPayment(quote.request);
      if (res.success) {
        handleSimulatePayment(posSats, `WebLN Lightning Payment (Preimage: ${res.preimage?.slice(0, 8)}...)`);
      } else {
        alert(res.error || 'WebLN payment failed or cancelled.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'WebLN payment failed';
      alert(msg);
    }
  };

  // Handle scanned QR from camera or upload
  const handleScanSuccess = (scannedText: string) => {
    soundController.playPaymentChime();

    if (scannerTarget === 'pos') {
      const decoded = decodeCashuToken(scannedText);
      if (decoded && decoded.proofs.length > 0) {
        const amt = decoded.proofs.reduce((sum, p) => sum + p.amount, 0);
        handleSimulatePayment(amt, decoded.memo || 'Scanned Cashu Ecash Voucher');
      } else {
        handleSimulatePayment(posSats || 1000, `Scanned QR Token: ${scannedText.slice(0, 16)}...`);
      }
    } else {
      setRedeemInput(scannedText);
      const decoded = decodeCashuToken(scannedText);
      if (decoded && decoded.proofs.length > 0) {
        const claimedAmt = decoded.proofs.reduce((sum, p) => sum + p.amount, 0);
        const updatedProofs = [...proofs, ...decoded.proofs];
        setProofs(updatedProofs);
        saveStoredProofs(updatedProofs);

        confetti({ particleCount: 60, spread: 60 });
        setRedeemSuccessMsg(`Successfully claimed ${claimedAmt} satoshis from scanned QR voucher!`);
        setRedeemInput('');

        const newTx: PaymentTransaction = {
          id: `scan-claim-${Date.now()}`,
          timestamp: Date.now(),
          type: 'incoming',
          amountSats: claimedAmt,
          amountNgn: satsToNgn(claimedAmt),
          memo: decoded.memo || 'Scanned Cashu Voucher',
          status: 'settled',
          method: 'cashu',
          offline: isOffline,
        };
        setTransactions(prev => [newTx, ...prev]);
        setTimeout(() => setRedeemSuccessMsg(''), 4500);
      }
    }
  };

  // Generate Offline Cash Voucher
  const handleCreateVoucher = () => {
    const amt = parseInt(voucherAmount, 10) || 0;
    if (amt <= 0 || amt > vaultSats) {
      alert('Insufficient vault balance for this voucher amount.');
      return;
    }

    const result = spendProofs(amt, proofs);
    if (!result) {
      alert('Unable to assemble token coins for this amount.');
      return;
    }

    setProofs(result.remaining);
    saveStoredProofs(result.remaining);

    const tokenStr = encodeCashuToken(result.spent, activeMintUrl, 'BitFriend Offline Voucher');
    setCreatedVoucher(tokenStr);
    soundController.playClick();

    // Record transaction
    const newTx: PaymentTransaction = {
      id: `vch-${Date.now()}`,
      timestamp: Date.now(),
      type: 'outgoing',
      amountSats: amt,
      amountNgn: satsToNgn(amt),
      memo: 'Generated Offline Cashu Voucher',
      status: 'settled',
      method: 'cashu',
      offline: true,
      tokenString: tokenStr,
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  // Claim / Redeem Token
  const handleRedeemToken = () => {
    if (!redeemInput.trim()) return;

    const decoded = decodeCashuToken(redeemInput.trim());
    if (!decoded || decoded.proofs.length === 0) {
      alert('Invalid Cashu token string format. Please verify the code.');
      return;
    }

    const claimedAmt = decoded.proofs.reduce((sum, p) => sum + p.amount, 0);
    const updatedProofs = [...proofs, ...decoded.proofs];
    setProofs(updatedProofs);
    saveStoredProofs(updatedProofs);

    soundController.playPaymentChime();
    confetti({ particleCount: 50, spread: 60 });
    setRedeemSuccessMsg(`Successfully claimed ${claimedAmt} satoshis into vault!`);
    setRedeemInput('');

    const newTx: PaymentTransaction = {
      id: `claim-${Date.now()}`,
      timestamp: Date.now(),
      type: 'incoming',
      amountSats: claimedAmt,
      amountNgn: satsToNgn(claimedAmt),
      memo: decoded.memo || 'Redeemed Cashu Voucher',
      status: 'settled',
      method: 'cashu',
      offline: isOffline,
    };
    setTransactions(prev => [newTx, ...prev]);

    setTimeout(() => setRedeemSuccessMsg(''), 4500);
  };

  // Sweep / Melt Offline Ecash to Lightning
  const handleSweepToLightning = () => {
    if (isOffline) {
      alert('Cannot sweep to Lightning while offline. Connect to network first.');
      return;
    }
    if (vaultSats === 0) {
      alert('No offline tokens to sweep.');
      return;
    }

    const swept = vaultSats;
    setProofs([]);
    saveStoredProofs([]);
    setLightningSats(prev => prev + swept);

    soundController.playPaymentChime();
    alert(`Melted ${swept} offline satoshis into your Lightning wallet!`);

    const newTx: PaymentTransaction = {
      id: `melt-${Date.now()}`,
      timestamp: Date.now(),
      type: 'incoming',
      amountSats: swept,
      amountNgn: satsToNgn(swept),
      memo: 'Swept Offline Ecash to Lightning Wallet',
      status: 'settled',
      method: 'lightning',
      offline: false,
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  // Adashi Contribute Share
  const handleContributeAdashi = (circleId: string) => {
    const circle = circles.find(c => c.id === circleId);
    if (!circle) return;

    if (vaultSats < circle.contributionSats) {
      alert('Insufficient satoshis in offline vault to pay Adashi share.');
      return;
    }

    const result = spendProofs(circle.contributionSats, proofs);
    if (!result) return;

    setProofs(result.remaining);
    saveStoredProofs(result.remaining);

    setCircles(prev =>
      prev.map(c => {
        if (c.id !== circleId) return c;
        const updatedMembers = c.members.map(m => (m.id === 'm3' ? { ...m, hasContributed: true } : m));
        return { ...c, members: updatedMembers };
      })
    );

    soundController.playPaymentChime();
    setAdashiNotice(`Contributed ${circle.contributionSats} sats to ${circle.name}!`);
    setTimeout(() => setAdashiNotice(''), 4000);

    // Broadcast contribution over Nostr relays for real multi-device sync
    broadcastAdashiEvent({
      action: 'contribute',
      circleId: circle.id,
      circleName: circle.name,
      round: circle.currentRound,
      memberId: 'm3',
      memberName: 'Amina Garba (You)',
      amountSats: circle.contributionSats,
      timestamp: Date.now(),
    }).catch(console.warn);

    const newTx: PaymentTransaction = {
      id: `adashi-pay-${Date.now()}`,
      timestamp: Date.now(),
      type: 'outgoing',
      amountSats: circle.contributionSats,
      amountNgn: satsToNgn(circle.contributionSats),
      memo: `Adashi Contribution: ${circle.name}`,
      status: 'settled',
      method: 'cashu',
      offline: isOffline,
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  // Adashi Trigger Payout
  const handleTriggerAdashiPayout = (circleId: string) => {
    const circle = circles.find(c => c.id === circleId);
    if (!circle) return;

    const potAmount = circle.contributionSats * circle.members.length;
    const currentRecipient = circle.members.find(m => m.isCurrentRecipient) || circle.members[0];

    if (currentRecipient.id === 'm3') {
      const payoutProofs = [generateProof(potAmount, activeMintUrl)];
      const updated = [...proofs, ...payoutProofs];
      setProofs(updated);
      saveStoredProofs(updated);
    }

    // Broadcast Adashi round payout notification over Nostr
    broadcastAdashiEvent({
      action: 'turn_payout',
      circleId: circle.id,
      circleName: circle.name,
      round: circle.currentRound,
      memberId: currentRecipient.id,
      memberName: currentRecipient.name,
      amountSats: potAmount,
      timestamp: Date.now(),
    }).catch(console.warn);

    setCircles(prev =>
      prev.map(c => {
        if (c.id !== circleId) return c;
        const nextRound = c.currentRound >= c.totalRounds ? 1 : c.currentRound + 1;
        const nextMembers = c.members.map(m => ({
          ...m,
          hasContributed: false,
          isCurrentRecipient: m.turnOrder === nextRound,
        }));
        return {
          ...c,
          currentRound: nextRound,
          members: nextMembers,
        };
      })
    );

    soundController.playPaymentChime();
    confetti({ particleCount: 120, spread: 90 });
    soundController.speakReceipt(potAmount, lang);
    setAdashiNotice(`Round payout of ${potAmount} sats successfully distributed to ${currentRecipient.name}!`);
    setTimeout(() => setAdashiNotice(''), 5000);
  };

  // Add new custom circle
  const handleCircleCreated = (newCircle: AdashiCircle) => {
    setCircles(prev => [newCircle, ...prev]);
    soundController.playPaymentChime();
    confetti({ particleCount: 60, spread: 70 });
    setAdashiNotice(`Launched new circle: ${newCircle.name}!`);
    setTimeout(() => setAdashiNotice(''), 5000);
  };

  // Trigger PWA install
  const handleInstallApp = () => {
    if (!installPrompt) return;
    const promptEvent = installPrompt as unknown as { prompt: () => void; userChoice: Promise<{ outcome: string }> };
    promptEvent.prompt();
    promptEvent.userChoice.then(() => {
      setInstallPrompt(null);
    });
  };

  // Restore vault from JSON backup file
  const handleRestoreBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const res = parseVaultBackupFile(content);
      if (res.success && res.data) {
        setProofs(res.data.proofs);
        saveStoredProofs(res.data.proofs);
        if (res.data.transactions.length > 0) setTransactions(res.data.transactions);
        if (res.data.circles.length > 0) setCircles(res.data.circles);

        soundController.playPaymentChime();
        confetti({ particleCount: 70, spread: 70 });
        alert(`Successfully restored ${res.data.proofs.length} token proofs from backup file!`);
      } else {
        alert(res.error || 'Failed to restore backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Group proofs by denomination
  const denominationSummary: { [denom: number]: number } = {};
  proofs.forEach(p => {
    denominationSummary[p.amount] = (denominationSummary[p.amount] || 0) + 1;
  });

  return (
    <div className="app-container">
      {/* Header & Brand */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">₿</div>
          <div className="brand-info">
            <h1>{t.appTitle}</h1>
            <span className="badge-pill">Bitcoin & Web3 Hackathon 2026</span>
          </div>
        </div>

        <div className="header-controls">
          {/* PWA Install Button */}
          {installPrompt && (
            <button
              className="ctrl-btn"
              style={{ background: 'var(--btc-orange)', color: 'black', fontWeight: 700 }}
              onClick={handleInstallApp}
              title="Install BitFriend PWA on Phone"
            >
              <Smartphone size={15} />
              Install
            </button>
          )}

          {/* Online/Offline Toggle */}
          <button
            className={`network-pill ${isOffline ? 'offline' : 'online'}`}
            onClick={() => {
              setIsOffline(!isOffline);
              soundController.playClick();
            }}
            title={t.toggleNetwork}
          >
            <span className="status-dot"></span>
            {isOffline ? <WifiOff size={14} /> : <Wifi size={14} />}
            {isOffline ? t.offline : t.online}
          </button>

          {/* Sound Toggle */}
          <button
            className="ctrl-btn"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              soundController.playClick();
            }}
            title={soundEnabled ? t.soundOn : t.soundOff}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Language Toggle */}
          <button
            className="ctrl-btn"
            onClick={() => {
              setLang(lang === 'en' ? 'ha' : 'en');
              soundController.playClick();
            }}
          >
            {lang === 'en' ? '🇳🇬 Hausa' : '🇬🇧 English'}
          </button>

          {/* Lightning Address / LNURL button */}
          <button
            className="ctrl-btn"
            onClick={() => {
              setShowLnAddressModal(true);
              soundController.playClick();
            }}
            title="Merchant Lightning Address"
          >
            <AtSign size={15} />
          </button>

          {/* Multi-Mint Latency Monitor */}
          <button
            className="ctrl-btn"
            onClick={() => {
              setShowMultiMintModal(true);
              soundController.playClick();
            }}
            title="Global Mint Latency Monitor"
          >
            <Activity size={15} />
          </button>

          {/* Market Simulation Lab */}
          <button
            className="ctrl-btn"
            onClick={() => {
              setShowSimulationLab(true);
              soundController.playClick();
            }}
            title="Market Simulation Lab & Stress Test"
          >
            <Sliders size={15} />
          </button>

          {/* Security & PIN Lock Button */}
          <button
            className="ctrl-btn"
            style={{
              borderColor: hasConfiguredPin ? 'rgba(16, 185, 129, 0.5)' : 'rgba(247, 147, 26, 0.5)',
              color: hasConfiguredPin ? '#10b981' : 'var(--btc-orange)',
              gap: '4px',
            }}
            onClick={() => {
              if (hasConfiguredPin) {
                lockVault();
                setPinModalMode('unlock');
                setShowPinModal(true);
              } else {
                setPinModalMode('setup');
                setShowPinModal(true);
              }
              soundController.playClick();
            }}
            title={hasConfiguredPin ? 'Lock Ecash Vault (AES-GCM)' : 'Set 6-Digit Encryption PIN'}
          >
            {hasConfiguredPin ? <Lock size={15} /> : <KeyRound size={15} />}
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{hasConfiguredPin ? 'Lock' : 'Set PIN'}</span>
          </button>

          {/* Nostr P2P Relay Indicator */}
          <button
            className="ctrl-btn"
            style={{
              borderColor: connectedRelays > 0 ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.1)',
              color: connectedRelays > 0 ? '#c084fc' : '#94a3b8',
              gap: '4px',
            }}
            onClick={() => {
              testRelayConnections();
              soundController.playClick();
            }}
            title={`Nostr P2P Relays: ${connectedRelays} Connected (damus.io, nos.lol, primal.net)`}
          >
            <Radio size={14} color={connectedRelays > 0 ? '#c084fc' : '#94a3b8'} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>
              {connectedRelays > 0 ? `${connectedRelays} Relays` : 'Relays Off'}
            </span>
          </button>

          {/* Judge Pitch Deck Button */}
          <button
            className="ctrl-btn"
            style={{ borderColor: 'var(--btc-orange)', color: 'var(--btc-orange)' }}
            onClick={() => {
              setShowPitchModal(true);
              soundController.playClick();
            }}
          >
            <Award size={15} />
            Pitch & Arch
          </button>
        </div>
      </header>

      {/* Network Alert Banner */}
      <div className={`network-banner ${isOffline ? 'offline-alert' : 'online-alert'}`}>
        <div>
          <strong>{isOffline ? '⚡ Network Interrupted: ' : '🟢 Network Active: '}</strong>
          {isOffline
            ? 'Cashu Ecash enables zero-data offline payments! You can still receive & pay satoshis locally.'
            : 'Lightning Network and Mint connected. Real-time swap and settlement active.'}
        </div>
        <button onClick={() => setIsOffline(!isOffline)}>
          {isOffline ? 'Restore Network' : 'Simulate Offline Outage'}
        </button>
      </div>

      {/* Total Balance Card */}
      <div className="balance-card">
        <div>
          <div className="balance-label">Total Balance (Sats & Naira)</div>
          <div className="balance-sats mono-num">
            {totalSats.toLocaleString()}
            <span className="unit">sats</span>
          </div>
          <div className="balance-fiat mono-num">
            ≈ ₦{totalNgn.toLocaleString()} NGN
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              (1 BTC = ₦{(BTC_TO_NGN_RATE / 1000000).toFixed(1)}M)
            </span>
          </div>
        </div>

        <div className="balance-sub-badges">
          <div className="sub-badge" style={{ borderColor: 'rgba(139, 92, 246, 0.4)' }}>
            <span className="lbl" style={{ color: '#C4B5FD' }}>
              <ShieldCheck size={12} style={{ display: 'inline', marginRight: '4px' }} />
              {t.totalVaultBalance} (Offline)
            </span>
            <span className="val mono-num" style={{ color: '#DDD6FE' }}>
              {vaultSats.toLocaleString()} sats (₦{satsToNgn(vaultSats).toLocaleString()})
            </span>
          </div>

          <div className="sub-badge" style={{ borderColor: 'rgba(247, 147, 26, 0.4)' }}>
            <span className="lbl" style={{ color: 'var(--btc-orange)' }}>
              <Zap size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Lightning Balance (Online)
            </span>
            <span className="val mono-num" style={{ color: '#FDE68A' }}>
              {lightningSats.toLocaleString()} sats (₦{satsToNgn(lightningSats).toLocaleString()})
            </span>
          </div>
        </div>

        {/* Quick Action: Cash Out to Bank / Mobile Money */}
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              width: 'auto'
            }}
            onClick={() => {
              setShowWithdrawModal(true);
              soundController.playClick();
            }}
          >
            <Building2 size={15} />
            Cash Out to Bank (OPay / PalmPay / M-Pesa)
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'pos' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('pos');
            soundController.playClick();
          }}
        >
          <Store size={18} />
          {t.posTab}
        </button>

        <button
          className={`tab-btn ${activeTab === 'bitchat' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('bitchat');
            soundController.playClick();
          }}
        >
          <MessageSquare size={18} />
          {t.chatTab || 'BitChat'}
        </button>

        <button
          className={`tab-btn ${activeTab === 'vault' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('vault');
            soundController.playClick();
          }}
        >
          <ShieldCheck size={18} />
          {t.vaultTab} ({proofs.length} notes)
        </button>

        <button
          className={`tab-btn ${activeTab === 'adashi' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('adashi');
            soundController.playClick();
          }}
        >
          <Users size={18} />
          {t.adashiTab} ({circles.length})
        </button>

        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('history');
            soundController.playClick();
          }}
        >
          <Clock size={18} />
          {t.historyTab} ({transactions.length})
        </button>
      </nav>

      {/* TAB 1: MERCHANT POS */}
      {activeTab === 'pos' && (
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2>{t.posHeader}</h2>
              <p>{t.posDesc}</p>
            </div>
            <div className="voice-notice">
              <Sparkles size={14} />
              {t.voicePromptActive}
            </div>
          </div>

          <div className="pos-grid">
            {/* Input Side */}
            <div className="pos-input-section">
              <div className="input-group">
                <label>{t.nairaInputLabel}</label>
                <div className="currency-input-wrap">
                  <span className="currency-prefix">₦</span>
                  <input
                    type="number"
                    value={chargeNgn}
                    onChange={e => {
                      setChargeNgn(e.target.value);
                      setPosSuccessData(null);
                    }}
                    placeholder="1000"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  {t.quickPresets}
                </label>
                <div className="presets-row">
                  {['500', '1000', '2000', '5000', '10000'].map(val => (
                    <button
                      key={val}
                      className="preset-chip"
                      onClick={() => {
                        setChargeNgn(val);
                        setPosSuccessData(null);
                        soundController.playClick();
                      }}
                    >
                      ₦{parseInt(val, 10).toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sats preview */}
              <div className="sats-preview-box">
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.satsEquivalent}</div>
                  <div className="amt mono-num">{posSats.toLocaleString()} sats</div>
                </div>
                <div style={{ fontSize: '11px', textAlign: 'right', color: 'var(--text-muted)' }}>
                  Formula: ₦ / BTC price<br />
                  Zero gateway fees
                </div>
              </div>

              {/* Note input */}
              <div className="input-group">
                <label>{t.customerName}</label>
                <input
                  type="text"
                  value={customerNote}
                  onChange={e => setCustomerNote(e.target.value)}
                  placeholder={t.customerPlaceholder}
                  style={{
                    width: '100%',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    color: 'white',
                  }}
                />
              </div>

              {/* Action Buttons: Tap, Scan, WebLN, Simulate */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button className="btn-primary" onClick={() => handleSimulatePayment()}>
                  <Zap size={18} />
                  {t.simulateCustomerPay}
                </button>

                {hasWebLN && !isOffline && (
                  <button
                    className="btn-secondary"
                    style={{ borderColor: 'var(--btc-orange)', color: 'var(--btc-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={handleWebLNPay}
                  >
                    <Zap size={16} /> 1-Click Pay via WebLN (Alby/Blink)
                  </button>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => {
                      setScannerTarget('pos');
                      setShowQrScanner(true);
                    }}
                  >
                    <Camera size={16} />
                    {t.scanQrBtn}
                  </button>

                  <button
                    className="btn-secondary"
                    style={{ fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setShowNfcModal(true)}
                  >
                    <Radio size={16} />
                    {t.nfcTapBtn}
                  </button>

                  <button
                    className="btn-secondary"
                    style={{ fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setShowSmsBeam(true)}
                  >
                    <MessageSquare size={16} />
                    Feature Phone / SMS
                  </button>
                </div>
              </div>
            </div>

            {/* QR / Receipt Side */}
            <div className="pos-qr-box">
              {posSuccessData ? (
                <div className="payment-success-card" style={{ width: '100%' }}>
                  <div className="success-check-circle">
                    <Check size={36} strokeWidth={3} />
                  </div>
                  <h3 style={{ color: 'var(--color-success)', fontSize: '20px', fontWeight: 800 }}>
                    {t.paymentSuccess}
                  </h3>
                  <div className="mono-num" style={{ fontSize: '28px', fontWeight: 800, color: 'white' }}>
                    +{posSuccessData.amountSats.toLocaleString()} sats
                  </div>
                  <div style={{ fontSize: '15px', color: 'var(--text-amber)' }}>
                    ₦{posSuccessData.amountNgn.toLocaleString()} NGN
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {customerNote || 'Direct Cashu Ecash Voucher Claimed'}
                  </div>

                  <div className="voice-notice" style={{ marginTop: '10px' }}>
                    <Volume2 size={14} />
                    {lang === 'ha'
                      ? `An yi magana da murya: "An karɓi satoshi ${posSuccessData.amountSats} cikin nasara!"`
                      : `Voice announced: "Received ${posSuccessData.amountSats} satoshis successfully!"`}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px', width: '100%' }}>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => {
                        const tx = transactions.find(t => t.id === posSuccessData.txId);
                        if (tx) setReceiptTx(tx);
                      }}
                    >
                      <Printer size={15} />
                      {t.printReceipt}
                    </button>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, fontSize: '13px' }}
                      onClick={() => {
                        setPosSuccessData(null);
                        soundController.playClick();
                      }}
                    >
                      {t.newCharge}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t.scanToPayPrompt}
                  </div>
                  <div className="qr-canvas-holder">
                    <QRCodeSVG
                      value={`cashu:${encodeCashuToken(
                        [generateProof(posSats || 100, activeMintUrl)],
                        activeMintUrl,
                        customerNote
                      )}`}
                      size={200}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Compatible with Cashu Minibits, eNuts, Nutstash & Lightning wallets
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: BITCHAT SOCIAL BITCOIN MESSENGER */}
      {activeTab === 'bitchat' && (
        <BitChatView
          lang={lang}
          vaultProofs={proofs}
          onVaultProofsChanged={updated => {
            setProofs(updated);
            saveStoredProofs(updated);
          }}
          isOffline={isOffline}
        />
      )}

      {/* TAB 2: OFFLINE ECASH VAULT */}
      {activeTab === 'vault' && (
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2>{t.vaultHeader}</h2>
              <p>{t.vaultDesc}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn-secondary"
                style={{ width: 'auto', padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setShowBackupModal(true)}
              >
                <Key size={14} color={vaultBackedUp ? 'var(--color-success)' : 'var(--btc-orange)'} />
                {vaultBackedUp ? 'BIP-39 Backed Up' : 'Backup Seed (12 Words)'}
              </button>

              <button
                className="btn-secondary"
                style={{ width: 'auto', padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => exportVaultBackupFile(proofs, transactions, circles)}
              >
                <Download size={14} />
                Export Vault (.json)
              </button>

              <button
                className="btn-secondary"
                style={{ width: 'auto', padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => vaultFileRef.current?.click()}
              >
                <Upload size={14} />
                Restore File
              </button>

              <input
                ref={vaultFileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleRestoreBackupFile}
              />

              <button
                className="btn-secondary"
                style={{ width: 'auto', padding: '8px 12px', fontSize: '13px' }}
                onClick={() => setShowMintModal(true)}
              >
                <Server size={14} />
                {t.mintSettingsBtn}
              </button>

              <button
                className="btn-secondary"
                style={{ width: 'auto', padding: '8px 14px', fontSize: '13px' }}
                onClick={handleSweepToLightning}
              >
                <RefreshCw size={14} />
                {t.sweepToLightning}
              </button>

              <button
                className="btn-secondary"
                style={{ width: 'auto', padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(247, 147, 26, 0.4)' }}
                onClick={async () => {
                  soundController.playClick();
                  const res = await autoSwapOfflineProofs(proofs);
                  if (res.swapped) {
                    setProofs(res.updatedProofs);
                    saveStoredProofs(res.updatedProofs);
                    soundController.playPaymentChime();
                    alert(`NUT-03 Swap Succeeded! Swapped ${res.count} proofs through ${res.liveMint ? 'live production mint' : 'failover engine'}.`);
                  } else {
                    alert('All proofs already verified and unspent on mint.');
                  }
                }}
                title="NUT-03 Proof Swap & NUT-07 Double-Spend Check"
              >
                <Zap size={14} color="var(--btc-orange)" />
                NUT-03 Swap
              </button>
              <button
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px', gap: '5px', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
                onClick={() => {
                  setShowWithdrawModal(true);
                  soundController.playClick();
                }}
                title="Convert ecash proofs directly to Nigerian Bank or Pan-African Mobile Money"
              >
                <Building2 size={14} color="#10b981" />
                Cash Out to Bank
              </button>
            </div>
          </div>

          {/* Encrypted IndexedDB & PIN Security Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(247, 147, 26, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginTop: '12px',
              marginBottom: '14px',
              fontSize: '12px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#10b981" />
              <span>
                <strong>IndexedDB Encrypted at Rest:</strong> WebCrypto PBKDF2 + AES-GCM 256-bit {hasConfiguredPin ? '🔒 (Protected by 6-digit PIN)' : '⚠️ (Unencrypted — set PIN to lock)'}
              </span>
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{
                width: 'auto',
                padding: '4px 10px',
                fontSize: '11px',
                borderColor: hasConfiguredPin ? '#10b981' : 'var(--btc-orange)',
                color: hasConfiguredPin ? '#10b981' : 'var(--btc-orange)',
              }}
              onClick={() => {
                if (hasConfiguredPin) {
                  lockVault();
                  setPinModalMode('unlock');
                  setShowPinModal(true);
                } else {
                  setPinModalMode('setup');
                  setShowPinModal(true);
                }
                soundController.playClick();
              }}
            >
              {hasConfiguredPin ? 'Lock Vault Now' : 'Set 6-Digit PIN'}
            </button>
          </div>

          {/* Denominations breakdown */}
          <div style={{ marginTop: '10px' }}>
            <h4 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {t.denominationsBreakdown}
            </h4>
            <div className="proofs-grid">
              {Object.keys(denominationSummary).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', gridColumn: '1 / -1' }}>
                  {t.noProofs}
                </div>
              ) : (
                Object.entries(denominationSummary).map(([denom, count]) => (
                  <div key={denom} className="proof-denomination-chip">
                    <span className="amt mono-num">{denom}</span>
                    <span style={{ fontSize: '10px', color: 'var(--btc-orange)' }}>sats</span>
                    <span className="cnt">× {count} notes</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Two Columns: Create Voucher & Redeem Token */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '24px' }}>
            {/* Create Voucher */}
            <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>{t.createVoucher}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Hand over digital cash notes to anyone offline via QR or text code.
              </p>

              <div className="input-group" style={{ marginBottom: '12px' }}>
                <label>Amount in Satoshis</label>
                <input
                  type="number"
                  value={voucherAmount}
                  onChange={e => setVoucherAmount(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    color: 'white',
                    fontSize: '16px',
                  }}
                  placeholder="500"
                />
              </div>

              <button className="btn-primary" onClick={handleCreateVoucher}>
                <QrCode size={16} />
                {t.generateVoucherBtn}
              </button>

              {createdVoucher && (
                <div style={{ marginTop: '16px', background: 'var(--bg-primary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(247, 147, 26, 0.4)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--btc-orange)', fontWeight: 600, marginBottom: '6px' }}>
                    {t.voucherCreatedMsg}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                    <div style={{ background: 'white', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                      <QRCodeSVG value={createdVoucher} size={150} />
                    </div>
                  </div>
                  <div className="mono-num" style={{ fontSize: '11px', wordBreak: 'break-all', color: 'var(--text-muted)', maxHeight: '60px', overflowY: 'auto' }}>
                    {createdVoucher}
                  </div>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: '10px', fontSize: '12px', padding: '8px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(createdVoucher);
                      setCopiedNotification(true);
                      setTimeout(() => setCopiedNotification(false), 2500);
                    }}
                  >
                    {copiedNotification ? <Check size={14} /> : <Copy size={14} />}
                    {copiedNotification ? t.tokenCopied : t.copyToken}
                  </button>
                </div>
              )}
            </div>

            {/* Redeem Token */}
            <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{t.redeemVoucher}</h3>
                <button
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => {
                    setScannerTarget('vault');
                    setShowQrScanner(true);
                  }}
                >
                  <Camera size={13} /> Scan QR
                </button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Received an offline satoshi voucher via SMS, Bluetooth, or QR? Paste it here to add to your vault.
              </p>

              <div className="input-group" style={{ marginBottom: '12px' }}>
                <label>Cashu Token String</label>
                <textarea
                  rows={4}
                  value={redeemInput}
                  onChange={e => setRedeemInput(e.target.value)}
                  placeholder={t.voucherPlaceholder}
                  style={{
                    width: '100%',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    color: 'white',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    resize: 'none',
                  }}
                />
              </div>

              <button className="btn-primary" onClick={handleRedeemToken}>
                <ShieldCheck size={16} />
                {t.redeemBtn}
              </button>

              {redeemSuccessMsg && (
                <div style={{ marginTop: '14px', padding: '10px', background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600 }}>
                  <Check size={14} style={{ display: 'inline', marginRight: '6px' }} />
                  {redeemSuccessMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ADASHI SAVINGS */}
      {activeTab === 'adashi' && (
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2>{t.adashiHeader}</h2>
              <p>{t.adashiDesc}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ padding: '6px 12px', background: 'rgba(247, 147, 26, 0.15)', color: 'var(--btc-orange)', borderRadius: 'var(--radius-full)', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={14} />
                100% Inflation Resistant
              </div>
              <button
                className="btn-primary"
                style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setShowCreateAdashi(true)}
              >
                <Plus size={15} />
                {t.createCircle}
              </button>
            </div>
          </div>

          {adashiNotice && (
            <div style={{ padding: '12px 16px', background: 'var(--color-success-bg)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-md)', color: 'var(--color-success)', fontWeight: 600, fontSize: '13px', marginBottom: '16px' }}>
              {adashiNotice}
            </div>
          )}

          <div className="adashi-grid">
            {circles.map(circle => {
              const potTotalSats = circle.contributionSats * circle.members.length;
              const potTotalNgn = satsToNgn(potTotalSats);
              const progressPct = (circle.currentRound / circle.totalRounds) * 100;
              const currentRecipient = circle.members.find(m => m.isCurrentRecipient) || circle.members[0];
              const userMember = circle.members.find(m => m.id === 'm3' || m.name.includes('(You)'));
              const hasUserContributed = userMember?.hasContributed ?? false;

              return (
                <div key={circle.id} className="adashi-card">
                  <div className="adashi-top">
                    <div className="adashi-title">
                      <h3>{circle.name}</h3>
                      <div className="tag">{circle.category} • {circle.frequency} rotation</div>
                    </div>
                    <div className="pot-badge">
                      <div className="pot-sats mono-num">{potTotalSats.toLocaleString()} sats</div>
                      <div className="pot-fiat mono-num">≈ ₦{potTotalNgn.toLocaleString()} per round</div>
                    </div>
                  </div>

                  {/* Progress track */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>{t.roundLabel} {circle.currentRound} of {circle.totalRounds}</span>
                      <span>Next Payout: {circle.nextPayoutDate}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
                    </div>
                  </div>

                  {/* Members turn order */}
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {t.members}:
                    </div>
                    <div className="members-avatars">
                      {circle.members.map(m => (
                        <div
                          key={m.id}
                          className={`member-chip ${m.isCurrentRecipient ? 'current-recipient' : ''} ${m.hasContributed ? 'has-paid' : ''}`}
                        >
                          <div className="avatar-circle">{m.avatar}</div>
                          <span>{m.name}</span>
                          {m.isCurrentRecipient && (
                            <span style={{ fontSize: '10px', background: 'var(--btc-orange)', color: 'black', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                              Turn #{m.turnOrder}
                            </span>
                          )}
                          {m.hasContributed && <Check size={12} color="var(--color-success)" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions row */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, minWidth: '200px' }}
                      disabled={hasUserContributed}
                      onClick={() => handleContributeAdashi(circle.id)}
                    >
                      <Zap size={16} />
                      {hasUserContributed ? t.alreadyContributed : `${t.contributeShare} (${circle.contributionSats} sats)`}
                    </button>

                    <button
                      className="btn-secondary"
                      style={{ flex: 1, minWidth: '200px', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                      onClick={() => handleTriggerAdashiPayout(circle.id)}
                    >
                      <Award size={16} />
                      {t.triggerPayout} to {currentRecipient.name.split(' ')[0]}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: TRANSACTION HISTORY */}
      {activeTab === 'history' && (
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2>{t.historyTab}</h2>
              <p>Audit log of local offline Cashu transfers and Lightning settlements.</p>
            </div>
            <button
              className="btn-secondary"
              style={{ width: 'auto', padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => exportTransactionsToCsv(transactions)}
            >
              <Download size={14} />
              {t.exportCsv}
            </button>
          </div>

          <div className="tx-list">
            {transactions.map(tx => (
              <div
                key={tx.id}
                className="tx-item"
                style={{ cursor: 'pointer' }}
                onClick={() => setReceiptTx(tx)}
                title="Click to view printable receipt"
              >
                <div className="tx-left">
                  <div className={`tx-icon-circle ${tx.type}`}>
                    {tx.type === 'incoming' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                  </div>
                  <div>
                    <div className="tx-title">{tx.memo}</div>
                    <div className="tx-time">
                      {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {tx.offline ? (
                        <span style={{ color: '#C4B5FD', fontWeight: 600 }}>{t.offlineBadge}</span>
                      ) : (
                        <span style={{ color: 'var(--btc-orange)', fontWeight: 600 }}>{t.lightningBadge}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="tx-right">
                  <div className={`tx-sats mono-num ${tx.type === 'incoming' ? 'pos' : 'neg'}`}>
                    {tx.type === 'incoming' ? '+' : '-'}{tx.amountSats.toLocaleString()} sats
                  </div>
                  <div className="tx-ngn mono-num">
                    ≈ ₦{tx.amountNgn.toLocaleString()} NGN
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: QR SCANNER (CAMERA & FILE) */}
      <QrScannerModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onScanSuccess={handleScanSuccess}
        title={scannerTarget === 'pos' ? 'Scan Customer Cashu Token / QR' : 'Scan Offline Ecash Voucher'}
      />

      {/* MODAL: CREATE ADASHI CIRCLE */}
      <CreateAdashiModal
        isOpen={showCreateAdashi}
        onClose={() => setShowCreateAdashi(false)}
        onCircleCreated={handleCircleCreated}
      />

      {/* MODAL: PRINTABLE RECEIPT */}
      <ReceiptModal
        isOpen={Boolean(receiptTx)}
        onClose={() => setReceiptTx(null)}
        tx={receiptTx}
      />

      {/* MODAL: NFC TAP TO PAY */}
      <NfcTapModal
        isOpen={showNfcModal}
        onClose={() => setShowNfcModal(false)}
        amountSats={posSats || 1000}
        onComplete={() => handleSimulatePayment(posSats || 1000, 'NFC Contactless Tap Payment')}
      />

      {/* MODAL: CASHU MINT GATEWAY SETTINGS */}
      <MintSettingsModal
        isOpen={showMintModal}
        onClose={() => setShowMintModal(false)}
        onMintChanged={() => setActiveMintUrl(getCustomMint())}
      />

      {/* MODAL: BIP-39 VAULT DISASTER RECOVERY & DATABASE INTEGRITY */}
      <VaultBackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onOpenPinSetup={() => {
          setPinModalMode('setup');
          setShowPinModal(true);
        }}
        onRestoreSuccess={() => {
          getSecureProofs().then(p => {
            if (p && p.length > 0) setProofs(p);
            else setProofs(getStoredProofs());
          }).catch(() => setProofs(getStoredProofs()));
          setVaultBackedUp(isVaultBackedUp());
        }}
      />

      {/* MODAL: 6-DIGIT AES-GCM PIN LOCK */}
      <PinLockModal
        isOpen={showPinModal}
        lang={lang}
        initialMode={pinModalMode}
        allowDismiss={!hasConfiguredPin || !isVaultLockedState}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          setShowPinModal(false);
          setHasConfiguredPin(true);
          getSecureProofs().then(p => {
            if (p && p.length > 0) setProofs(p);
          }).catch(console.warn);
        }}
      />

      {/* MODAL: LIGHTNING ADDRESS & LNURL-PAY */}
      <LightningAddressModal
        isOpen={showLnAddressModal}
        onClose={() => setShowLnAddressModal(false)}
      />

      {/* MODAL: MULTI-MINT LATENCY MONITOR */}
      <MultiMintMonitor
        isOpen={showMultiMintModal}
        onClose={() => setShowMultiMintModal(false)}
        onMintSelected={url => setActiveMintUrl(url)}
      />

      {/* MODAL: INTERACTIVE FULL-SCREEN PITCH DECK & ARCHITECTURE */}
      <InteractivePitchDeck
        isOpen={showPitchModal}
        onClose={() => setShowPitchModal(false)}
      />

      {/* MODAL: MARKET STRESS LAB & SIMULATION */}
      <MarketSimulationLab
        isOpen={showSimulationLab}
        onClose={() => setShowSimulationLab(false)}
        onNetworkChange={(offline: boolean) => setIsOffline(offline)}
        isCurrentlyOffline={isOffline}
        activeProofs={proofs}
        onTriggerAdashiStep={() => {
          handleContributeAdashi('circle-1');
        }}
      />

      {/* MODAL: FEATURE-PHONE / SMS BEAM */}
      <SmsBeamModal
        isOpen={showSmsBeam}
        onClose={() => setShowSmsBeam(false)}
      />

      {/* MODAL: AFRICAN FIAT ON/OFF RAMP (OPay / PalmPay / Moniepoint / M-Pesa) */}
      <WithdrawToBankModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        vaultProofs={proofs}
        onVaultProofsChanged={updated => {
          setProofs(updated);
          saveStoredProofs(updated);
          saveSecureProofs(updated).catch(console.warn);
        }}
        onTransactionRecorded={tx => {
          setTransactions(prev => [tx, ...prev]);
          saveSecureTransactions([tx, ...transactions]).catch(console.warn);
        }}
        lang={lang}
      />
    </div>
  );
};

export default App;
