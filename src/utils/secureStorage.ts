import { openDB, type IDBPDatabase } from 'idb';
import type { CashuProof, PaymentTransaction, AdashiCircle, ChatMessage, ChatContact } from '../types';

const DB_NAME = 'bitfriend_secure_db';
const DB_VERSION = 2;
const AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity

export interface EncryptedPayload {
  iv: string; // base64
  cipher: string; // base64
  tag?: string;
  updatedAt: number;
}

export interface DatabaseBackup {
  version: number;
  exportedAt: number;
  checksum: string;
  data: {
    proofs?: CashuProof[] | EncryptedPayload;
    mnemonic?: string[] | EncryptedPayload;
    transactions?: PaymentTransaction[];
    circles?: AdashiCircle[];
    contacts?: ChatContact[];
    messages?: ChatMessage[];
    lightningSats?: number;
    customMint?: string;
    isPinProtected: boolean;
  };
}

let dbPromise: Promise<IDBPDatabase> | null = null;
let activeSessionKey: CryptoKey | null = null;
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;
const lockListeners: Set<(isLocked: boolean) => void> = new Set();

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('secure_vault')) {
          db.createObjectStore('secure_vault');
        }
        if (!db.objectStoreNames.contains('tx_history')) {
          db.createObjectStore('tx_history', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('adashi_circles')) {
          db.createObjectStore('adashi_circles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
        if (!db.objectStoreNames.contains('chat_messages')) {
          const msgStore = db.createObjectStore('chat_messages', { keyPath: 'id' });
          msgStore.createIndex('by_conversation', 'conversationId', { unique: false });
        }
        if (!db.objectStoreNames.contains('chat_contacts')) {
          db.createObjectStore('chat_contacts', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// Convert ArrayBuffer to Base64
function bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array
function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Derive AES-GCM 256-bit key from 6-digit PIN using PBKDF2
async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Compute SHA-256 checksum for backup integrity
export async function computeChecksum(content: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(content));
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Encrypt arbitrary data using active key
export async function encryptData(data: unknown, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  return {
    iv: bufferToBase64(iv),
    cipher: bufferToBase64(cipherBuffer),
    updatedAt: Date.now(),
  };
}

// Decrypt encrypted payload
export async function decryptData<T>(payload: EncryptedPayload, key: CryptoKey): Promise<T> {
  const iv = base64ToBuffer(payload.iv);
  const cipher = base64ToBuffer(payload.cipher);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipher as BufferSource
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuffer)) as T;
}

// PIN & Lock Management
export async function isPinConfigured(): Promise<boolean> {
  const db = await getDb();
  const pinMeta = await db.get('metadata', 'pin_config');
  return !!pinMeta;
}

export function isVaultLocked(): boolean {
  return activeSessionKey === null;
}

export function subscribeLockState(listener: (isLocked: boolean) => void): () => void {
  lockListeners.add(listener);
  listener(isVaultLocked());
  return () => {
    lockListeners.delete(listener);
  };
}

function notifyLockState(): void {
  const locked = isVaultLocked();
  lockListeners.forEach(fn => fn(locked));
}

// Reset activity timer for auto-lock
export function recordActivity(): void {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
  }
  if (activeSessionKey !== null) {
    autoLockTimer = setTimeout(() => {
      lockVault();
    }, AUTO_LOCK_TIMEOUT_MS);
  }
}

// Setup activity listeners on window
if (typeof window !== 'undefined') {
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
  events.forEach(evt => {
    window.addEventListener(evt, () => recordActivity(), { passive: true });
  });
}

export function lockVault(): void {
  activeSessionKey = null;
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
  notifyLockState();
}

export async function setVaultPin(pin: string): Promise<void> {
  if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    throw new Error('PIN must be exactly 6 digits');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKeyFromPin(pin, salt);

  // Store verification token
  const verifier = await encryptData('BITFRIEND_VERIFIED_TOKEN', key);

  const db = await getDb();
  await db.put('metadata', {
    salt: bufferToBase64(salt),
    verifier,
    createdAt: Date.now(),
  }, 'pin_config');

  activeSessionKey = key;
  recordActivity();
  notifyLockState();

  // Re-encrypt stored proofs & mnemonic if currently in plaintext
  const rawProofs = await db.get('secure_vault', 'vault_proofs');
  if (rawProofs && Array.isArray(rawProofs)) {
    const encrypted = await encryptData(rawProofs, key);
    await db.put('secure_vault', encrypted, 'vault_proofs');
  }

  const rawMnemonic = await db.get('secure_vault', 'vault_mnemonic');
  if (rawMnemonic && Array.isArray(rawMnemonic)) {
    const encrypted = await encryptData(rawMnemonic, key);
    await db.put('secure_vault', encrypted, 'vault_mnemonic');
  }
}

export async function unlockVault(pin: string): Promise<boolean> {
  const db = await getDb();
  const pinMeta = await db.get('metadata', 'pin_config');
  if (!pinMeta || !pinMeta.salt || !pinMeta.verifier) {
    return false;
  }

  try {
    const salt = base64ToBuffer(pinMeta.salt);
    const key = await deriveKeyFromPin(pin, salt);
    const token = await decryptData<string>(pinMeta.verifier, key);

    if (token === 'BITFRIEND_VERIFIED_TOKEN') {
      activeSessionKey = key;
      recordActivity();
      notifyLockState();
      return true;
    }
  } catch (err) {
    console.warn('Unlock verification failed:', err);
  }

  return false;
}

// Secure Vault Accessors (Proofs & Mnemonic)
export async function getSecureProofs(): Promise<CashuProof[]> {
  const db = await getDb();
  const stored = await db.get('secure_vault', 'vault_proofs');

  if (!stored) {
    // Check localStorage fallback
    try {
      const lsRaw = localStorage.getItem('bitfriend_vault_proofs');
      if (lsRaw) {
        const parsed = JSON.parse(lsRaw);
        await saveSecureProofs(parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  }

  // Check if encrypted
  if (stored && typeof stored === 'object' && 'cipher' in stored && 'iv' in stored) {
    if (!activeSessionKey) {
      throw new Error('Vault is locked. PIN required to read proofs.');
    }
    return await decryptData<CashuProof[]>(stored as EncryptedPayload, activeSessionKey);
  }

  return Array.isArray(stored) ? stored : [];
}

export async function saveSecureProofs(proofs: CashuProof[]): Promise<void> {
  const db = await getDb();
  if (activeSessionKey) {
    const encrypted = await encryptData(proofs, activeSessionKey);
    await db.put('secure_vault', encrypted, 'vault_proofs');
  } else {
    await db.put('secure_vault', proofs, 'vault_proofs');
  }
  // Keep localStorage in sync for backwards compatibility
  try {
    localStorage.setItem('bitfriend_vault_proofs', JSON.stringify(proofs));
  } catch {
    // ignore
  }
}

export async function getSecureMnemonic(): Promise<string[] | null> {
  const db = await getDb();
  const stored = await db.get('secure_vault', 'vault_mnemonic');

  if (!stored) {
    try {
      const lsRaw = localStorage.getItem('bitfriend_vault_mnemonic');
      if (lsRaw) {
        const parsed = JSON.parse(lsRaw);
        await saveSecureMnemonic(parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  }

  if (stored && typeof stored === 'object' && 'cipher' in stored && 'iv' in stored) {
    if (!activeSessionKey) {
      throw new Error('Vault is locked. PIN required to read mnemonic.');
    }
    return await decryptData<string[]>(stored as EncryptedPayload, activeSessionKey);
  }

  return Array.isArray(stored) ? stored : null;
}

export async function saveSecureMnemonic(words: string[]): Promise<void> {
  const db = await getDb();
  if (activeSessionKey) {
    const encrypted = await encryptData(words, activeSessionKey);
    await db.put('secure_vault', encrypted, 'vault_mnemonic');
  } else {
    await db.put('secure_vault', words, 'vault_mnemonic');
  }
  try {
    localStorage.setItem('bitfriend_vault_mnemonic', JSON.stringify(words));
  } catch {
    // ignore
  }
}

// Transaction History Accessors
export async function getSecureTransactions(): Promise<PaymentTransaction[]> {
  const db = await getDb();
  const all = await db.getAll('tx_history');
  if (all && all.length > 0) {
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Fallback to localStorage
  try {
    const lsRaw = localStorage.getItem('bitfriend_tx_history');
    if (lsRaw) {
      const parsed: PaymentTransaction[] = JSON.parse(lsRaw);
      await saveSecureTransactions(parsed);
      return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export async function saveSecureTransactions(txs: PaymentTransaction[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('tx_history', 'readwrite');
  await tx.store.clear();
  for (const item of txs) {
    await tx.store.put(item);
  }
  await tx.done;

  try {
    localStorage.setItem('bitfriend_tx_history', JSON.stringify(txs));
  } catch {
    // ignore
  }
}

// Adashi Circles Accessors
export async function getSecureCircles(): Promise<AdashiCircle[]> {
  const db = await getDb();
  const all = await db.getAll('adashi_circles');
  if (all && all.length > 0) {
    return all;
  }

  // Fallback to localStorage
  try {
    const lsRaw = localStorage.getItem('bitfriend_adashi_circles');
    if (lsRaw) {
      const parsed: AdashiCircle[] = JSON.parse(lsRaw);
      await saveSecureCircles(parsed);
      return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export async function saveSecureCircles(circles: AdashiCircle[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('adashi_circles', 'readwrite');
  await tx.store.clear();
  for (const circle of circles) {
    await tx.store.put(circle);
  }
  await tx.done;

  try {
    localStorage.setItem('bitfriend_adashi_circles', JSON.stringify(circles));
  } catch {
    // ignore
  }
}

// Migration from localStorage with zero data loss
export async function migrateFromLocalStorage(): Promise<{
  proofsMigrated: number;
  txsMigrated: number;
  circlesMigrated: number;
}> {
  let proofsMigrated = 0;
  let txsMigrated = 0;
  let circlesMigrated = 0;

  try {
    const rawProofs = localStorage.getItem('bitfriend_vault_proofs');
    if (rawProofs) {
      const proofs: CashuProof[] = JSON.parse(rawProofs);
      if (Array.isArray(proofs) && proofs.length > 0) {
        await saveSecureProofs(proofs);
        proofsMigrated = proofs.length;
      }
    }

    const rawTx = localStorage.getItem('bitfriend_tx_history');
    if (rawTx) {
      const txs: PaymentTransaction[] = JSON.parse(rawTx);
      if (Array.isArray(txs) && txs.length > 0) {
        await saveSecureTransactions(txs);
        txsMigrated = txs.length;
      }
    }

    const rawCircles = localStorage.getItem('bitfriend_adashi_circles');
    if (rawCircles) {
      const circles: AdashiCircle[] = JSON.parse(rawCircles);
      if (Array.isArray(circles) && circles.length > 0) {
        await saveSecureCircles(circles);
        circlesMigrated = circles.length;
      }
    }

    const rawMnemonic = localStorage.getItem('bitfriend_vault_mnemonic');
    if (rawMnemonic) {
      const words: string[] = JSON.parse(rawMnemonic);
      if (Array.isArray(words) && words.length > 0) {
        await saveSecureMnemonic(words);
      }
    }
  } catch (err) {
    console.error('Migration from localStorage encountered error:', err);
  }

  return { proofsMigrated, txsMigrated, circlesMigrated };
}

// Export Database with integrity checksum
export async function exportDatabaseBackup(): Promise<string> {
  const db = await getDb();
  const proofs = await db.get('secure_vault', 'vault_proofs');
  const mnemonic = await db.get('secure_vault', 'vault_mnemonic');
  const transactions = await db.getAll('tx_history');
  const circles = await db.getAll('adashi_circles');
  const pinConfig = await db.get('metadata', 'pin_config');
  const customMint = localStorage.getItem('bitfriend_custom_mint') || undefined;
  const lightningSats = parseInt(localStorage.getItem('bitfriend_lightning_sats') || '0', 10);

  const payloadData = {
    proofs,
    mnemonic,
    transactions,
    circles,
    lightningSats,
    customMint,
    isPinProtected: !!pinConfig,
  };

  const dataString = JSON.stringify(payloadData);
  const checksum = await computeChecksum(dataString);

  const backup: DatabaseBackup = {
    version: DB_VERSION,
    exportedAt: Date.now(),
    checksum,
    data: payloadData,
  };

  return JSON.stringify(backup, null, 2);
}

// Import Database with integrity checksum validation
export async function importDatabaseBackup(backupJson: string): Promise<{ success: boolean; error?: string }> {
  try {
    const backup: DatabaseBackup = JSON.parse(backupJson);
    if (!backup.data || !backup.checksum) {
      return { success: false, error: 'Malformed backup file format' };
    }

    const dataString = JSON.stringify(backup.data);
    const calculatedChecksum = await computeChecksum(dataString);

    if (calculatedChecksum !== backup.checksum) {
      return { success: false, error: 'Backup checksum mismatch! File may be corrupt or tampered with.' };
    }

    const db = await getDb();

    if (backup.data.proofs) {
      await db.put('secure_vault', backup.data.proofs, 'vault_proofs');
    }
    if (backup.data.mnemonic) {
      await db.put('secure_vault', backup.data.mnemonic, 'vault_mnemonic');
    }
    if (backup.data.transactions && Array.isArray(backup.data.transactions)) {
      await saveSecureTransactions(backup.data.transactions);
    }
    if (backup.data.circles && Array.isArray(backup.data.circles)) {
      await saveSecureCircles(backup.data.circles);
    }
    if (typeof backup.data.lightningSats === 'number') {
      localStorage.setItem('bitfriend_lightning_sats', backup.data.lightningSats.toString());
    }
    if (backup.data.customMint) {
      localStorage.setItem('bitfriend_custom_mint', backup.data.customMint);
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during import';
    return { success: false, error: message };
  }
}

// Initial Demo Contacts for BitChat
export const INITIAL_CHAT_CONTACTS: ChatContact[] = [
  {
    id: 'contact-amina',
    name: 'Amina Garba',
    phoneOrHandle: '+234 802 345 6789',
    avatar: 'AG',
    role: 'Central Market Fabric Wholesaler',
    lastSeen: 'Online',
    isOnline: true,
    lightningAddress: 'amina@bitfriend.me',
    unreadCount: 1,
    lastMessage: {
      text: 'Ina son in tura miki 500 sats na kudin kaya.',
      timestamp: Date.now() - 1000 * 60 * 12,
      isPayment: true,
      amountSats: 500,
    },
  },
  {
    id: 'contact-ibrahim',
    name: 'Ibrahim Bello',
    phoneOrHandle: '+234 813 456 7890',
    avatar: 'IB',
    role: 'Metro Keke Riders Union',
    lastSeen: '15 mins ago',
    isOnline: false,
    lightningAddress: 'ibrahim@bitfriend.me',
    unreadCount: 0,
    lastMessage: {
      text: 'Na gode! Na karɓi satoshin Adashi a walat dina.',
      timestamp: Date.now() - 1000 * 60 * 85,
    },
  },
  {
    id: 'contact-fatima',
    name: 'Fatima Sani',
    phoneOrHandle: '+234 809 567 8901',
    avatar: 'FS',
    role: 'Dawanau Grain Market Stall 42',
    lastSeen: '1 hour ago',
    isOnline: true,
    lightningAddress: 'fatima@bitfriend.me',
    unreadCount: 0,
    lastMessage: {
      text: 'Buhun masara guda biyu sun shirya domin dauka.',
      timestamp: Date.now() - 1000 * 3600 * 3,
    },
  },
  {
    id: 'contact-yusuf',
    name: 'Yusuf Danjuma',
    phoneOrHandle: '+234 805 678 9012',
    avatar: 'YD',
    role: 'Market Solar Technician',
    lastSeen: 'Yesterday',
    isOnline: false,
    lightningAddress: 'yusuf@bitfriend.me',
    unreadCount: 0,
    lastMessage: {
      text: 'Zan zo gyara batirin solar din gobe da safe in sha Allah.',
      timestamp: Date.now() - 1000 * 3600 * 22,
    },
  },
];

export const INITIAL_CHAT_MESSAGES: Record<string, ChatMessage[]> = {
  'contact-amina': [
    {
      id: 'msg-am-1',
      conversationId: 'contact-amina',
      senderId: 'contact-amina',
      senderName: 'Amina Garba',
      text: 'Sannu abokina! Ina fatan ciniki yana tafiya lafiya yau.',
      timestamp: Date.now() - 1000 * 60 * 45,
      status: 'read',
    },
    {
      id: 'msg-am-2',
      conversationId: 'contact-amina',
      senderId: 'me',
      senderName: 'You',
      text: 'Alhamdulillah Hajiya Amina! Na ajiye miki yadi 5 na brocade din da kika nema.',
      timestamp: Date.now() - 1000 * 60 * 30,
      status: 'read',
    },
    {
      id: 'msg-am-3',
      conversationId: 'contact-amina',
      senderId: 'contact-amina',
      senderName: 'Amina Garba',
      text: 'Madalla! Ga cikon kudin ajiya nan da satoshi ta Cashu ecash:',
      timestamp: Date.now() - 1000 * 60 * 12,
      status: 'read',
      payment: {
        amountSats: 500,
        amountNgn: 793,
        tokenString: 'cashuAeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOi8vbWludC5taW5pYml0cy5jYXNoL0JpdGNvaW4iLCJwcm9vZnMiOlt7ImlkIjoibWludF8wMSIsImFtb3VudCI6NTEyLCJzZWNyZXQiOiJzZWNfYW1pbmFfNTEyIiwiQyI6IjAyYWFmZjc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzRhIn1dfV19',
        mintUrl: 'https://mint.minibits.cash/Bitcoin',
        memo: 'Payment for 5x Yards Brocade',
        status: 'pending',
      },
    },
  ],
  'contact-ibrahim': [
    {
      id: 'msg-ib-1',
      conversationId: 'contact-ibrahim',
      senderId: 'me',
      senderName: 'You',
      text: 'Malam Ibrahim, an sauya zagayen Adashi na mako mai zuwa.',
      timestamp: Date.now() - 1000 * 60 * 120,
      status: 'read',
    },
    {
      id: 'msg-ib-2',
      conversationId: 'contact-ibrahim',
      senderId: 'contact-ibrahim',
      senderName: 'Ibrahim Bello',
      text: 'Na gode! Na karɓi satoshin Adashi a walat dina.',
      timestamp: Date.now() - 1000 * 60 * 85,
      status: 'read',
    },
  ],
};

// Chat Contacts Storage
export async function getSecureContacts(): Promise<ChatContact[]> {
  const db = await getDb();
  const stored = await db.getAll('chat_contacts');
  if (stored && stored.length > 0) {
    return stored;
  }
  // Initialize with starter contacts
  const tx = db.transaction('chat_contacts', 'readwrite');
  for (const c of INITIAL_CHAT_CONTACTS) {
    await tx.store.put(c);
  }
  await tx.done;
  return INITIAL_CHAT_CONTACTS;
}

export async function saveSecureContacts(contacts: ChatContact[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('chat_contacts', 'readwrite');
  await tx.store.clear();
  for (const c of contacts) {
    await tx.store.put(c);
  }
  await tx.done;
}

// Chat Messages Storage
export async function getSecureMessages(conversationId: string): Promise<ChatMessage[]> {
  const db = await getDb();
  const allInConvo = await db.getAllFromIndex('chat_messages', 'by_conversation', conversationId);
  if (allInConvo && allInConvo.length > 0) {
    return allInConvo.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Seed default messages for this conversation if available
  const defaults = INITIAL_CHAT_MESSAGES[conversationId];
  if (defaults && defaults.length > 0) {
    const tx = db.transaction('chat_messages', 'readwrite');
    for (const msg of defaults) {
      await tx.store.put(msg);
    }
    await tx.done;
    return defaults.sort((a, b) => a.timestamp - b.timestamp);
  }

  return [];
}

export async function saveSecureMessage(msg: ChatMessage): Promise<void> {
  const db = await getDb();
  await db.put('chat_messages', msg);

  // Update contact's last message
  const contact = await db.get('chat_contacts', msg.conversationId);
  if (contact) {
    contact.lastMessage = {
      text: msg.payment ? `💰 ₿ ${msg.payment.amountSats} sats voucher` : (msg.text || 'Message'),
      timestamp: msg.timestamp,
      isPayment: !!msg.payment,
      amountSats: msg.payment?.amountSats,
    };
    await db.put('chat_contacts', contact);
  }
}

// Mark an inline payment claimed in a chat message
export async function markChatMessagePaymentClaimed(messageId: string): Promise<ChatMessage | null> {
  const db = await getDb();
  const msg: ChatMessage | undefined = await db.get('chat_messages', messageId);
  if (!msg || !msg.payment) return null;

  msg.payment.status = 'claimed';
  msg.payment.claimedAt = Date.now();
  await db.put('chat_messages', msg);
  return msg;
}

// Offline queue helpers
export async function getOfflineMessageQueue(): Promise<ChatMessage[]> {
  const db = await getDb();
  const all = await db.getAll('chat_messages');
  return all.filter(m => m.status === 'offline_queued');
}

