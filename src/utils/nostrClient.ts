import {
  SimplePool,
  finalizeEvent,
  getPublicKey,
  nip19,
  nip44,
  type Event as NostrEvent,
  type Filter
} from 'nostr-tools';
import { sha256 } from '@noble/hashes/sha2.js';
import { getStoredMnemonic } from './bip39Vault';

export const DEFAULT_NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
];

export interface NostrIdentity {
  seckey: Uint8Array;
  pubkey: string; // hex
  npub: string;
  nsec: string;
}

export interface RelayStatus {
  url: string;
  connected: boolean;
  latencyMs?: number;
}

let activeIdentity: NostrIdentity | null = null;
let sharedPool: SimplePool | null = null;
const relayStatuses: Map<string, RelayStatus> = new Map();
const statusListeners: Set<(count: number, statuses: RelayStatus[]) => void> = new Set();

export function getNostrPool(): SimplePool {
  if (!sharedPool) {
    sharedPool = new SimplePool();
  }
  return sharedPool;
}

// Derive deterministic Nostr secret key & public key from BIP-39 mnemonic words
export function deriveNostrIdentityFromMnemonic(words?: string[]): NostrIdentity {
  if (activeIdentity) return activeIdentity;

  const mnemonicWords = words || getStoredMnemonic();
  const seedString = `bitfriend:nostr:bip39:${mnemonicWords.join(' ')}`;
  const enc = new TextEncoder();
  const rawHash = sha256(enc.encode(seedString));

  const seckey = new Uint8Array(rawHash);
  const pubkey = getPublicKey(seckey);
  const npub = nip19.npubEncode(pubkey);
  const nsec = nip19.nsecEncode(seckey);

  activeIdentity = {
    seckey,
    pubkey,
    npub,
    nsec,
  };

  return activeIdentity;
}

export function getCurrentNostrIdentity(): NostrIdentity {
  if (!activeIdentity) {
    return deriveNostrIdentityFromMnemonic();
  }
  return activeIdentity;
}

// Check relay connectivity
export async function testRelayConnections(
  relays: string[] = DEFAULT_NOSTR_RELAYS
): Promise<RelayStatus[]> {
  const results: RelayStatus[] = [];

  for (const url of relays) {
    const start = Date.now();
    try {
      if (typeof WebSocket === 'undefined') {
        results.push({ url, connected: false });
        continue;
      }
      const ws = new WebSocket(url);
      const isConnected = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timer);
          ws.close();
          resolve(true);
        };
        ws.onerror = () => {
          clearTimeout(timer);
          resolve(false);
        };
      });

      const latencyMs = Date.now() - start;
      const status: RelayStatus = { url, connected: isConnected, latencyMs };
      relayStatuses.set(url, status);
      results.push(status);
    } catch {
      const status: RelayStatus = { url, connected: false };
      relayStatuses.set(url, status);
      results.push(status);
    }
  }

  notifyStatusListeners();
  return results;
}

export function subscribeRelayStatus(
  callback: (connectedCount: number, list: RelayStatus[]) => void
): () => void {
  statusListeners.add(callback);
  const currentList = Array.from(relayStatuses.values());
  const connected = currentList.filter(r => r.connected).length;
  callback(connected, currentList);
  return () => {
    statusListeners.delete(callback);
  };
}

function notifyStatusListeners(): void {
  const currentList = Array.from(relayStatuses.values());
  const connected = currentList.filter(r => r.connected).length;
  statusListeners.forEach(cb => cb(connected, currentList));
}

// NIP-44 Encrypted Direct Messaging for BitChat
export async function sendNip44ChatMessage(
  recipientPubkeyHex: string,
  messagePayload: string | object,
  relays: string[] = DEFAULT_NOSTR_RELAYS
): Promise<NostrEvent> {
  const { seckey } = getCurrentNostrIdentity();
  const pool = getNostrPool();

  const conversationKey = nip44.v2.utils.getConversationKey(seckey, recipientPubkeyHex);
  const plainText = typeof messagePayload === 'string' ? messagePayload : JSON.stringify(messagePayload);
  const ciphertext = nip44.v2.encrypt(plainText, conversationKey);

  const eventTemplate = {
    kind: 4, // NIP-04 / Direct Message event envelope
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['p', recipientPubkeyHex],
      ['client', 'bitfriend-v2'],
      ['encrypted', 'nip44-v2'],
    ],
    content: ciphertext,
  };

  const signedEvent = finalizeEvent(eventTemplate, seckey);

  try {
    const pubPromises = pool.publish(relays, signedEvent);
    await Promise.race([
      Promise.allSettled(pubPromises),
      new Promise(res => setTimeout(res, 2500)),
    ]);
  } catch (err) {
    console.warn('Relay publish warning:', err);
  }

  return signedEvent;
}

export function decryptNip44ChatMessage(
  event: NostrEvent,
  senderPubkeyHex: string
): string | null {
  const { seckey } = getCurrentNostrIdentity();
  try {
    const conversationKey = nip44.v2.utils.getConversationKey(seckey, senderPubkeyHex);
    return nip44.v2.decrypt(event.content, conversationKey);
  } catch (err) {
    console.warn('Failed to decrypt NIP-44 message:', err);
    return null;
  }
}

// Subscribe to incoming direct messages from contacts over Nostr
export function subscribeToNostrDirectMessages(
  onMessageReceived: (senderPubkey: string, content: string, event: NostrEvent) => void,
  relays: string[] = DEFAULT_NOSTR_RELAYS
): () => void {
  const { pubkey } = getCurrentNostrIdentity();
  const pool = getNostrPool();

  const filter: Filter = {
    kinds: [4],
    '#p': [pubkey],
    since: Math.floor(Date.now() / 1000) - 86400, // past 24h
  };

  const sub = pool.subscribeMany(relays, filter, {
    onevent(event) {
      const decrypted = decryptNip44ChatMessage(event, event.pubkey);
      if (decrypted) {
        onMessageReceived(event.pubkey, decrypted, event);
      }
    },
  });

  return () => {
    sub.close();
  };
}

// Adashi Multi-Device Coordinator over Nostr
export interface AdashiSyncEventPayload {
  action: 'contribute' | 'turn_payout' | 'circle_update';
  circleId: string;
  circleName: string;
  round: number;
  memberId: string;
  memberName: string;
  amountSats: number;
  tokenSnippet?: string;
  timestamp: number;
}

export async function broadcastAdashiEvent(
  payload: AdashiSyncEventPayload,
  relays: string[] = DEFAULT_NOSTR_RELAYS
): Promise<NostrEvent> {
  const { seckey } = getCurrentNostrIdentity();
  const pool = getNostrPool();

  const eventTemplate = {
    kind: 30078, // NIP-78 Arbitrary custom app data
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `bitfriend:adashi:${payload.circleId}`],
      ['t', 'adashi_sync'],
      ['client', 'bitfriend-v2'],
    ],
    content: JSON.stringify(payload),
  };

  const signedEvent = finalizeEvent(eventTemplate, seckey);

  try {
    const pubPromises = pool.publish(relays, signedEvent);
    await Promise.race([
      Promise.allSettled(pubPromises),
      new Promise(res => setTimeout(res, 2500)),
    ]);
  } catch (err) {
    console.warn('Adashi broadcast relay notice:', err);
  }

  return signedEvent;
}

export function subscribeToAdashiCircleEvents(
  circleId: string,
  onSyncEvent: (payload: AdashiSyncEventPayload) => void,
  relays: string[] = DEFAULT_NOSTR_RELAYS
): () => void {
  const pool = getNostrPool();

  const filter: Filter = {
    kinds: [30078],
    '#d': [`bitfriend:adashi:${circleId}`],
    since: Math.floor(Date.now() / 1000) - 86400 * 3, // past 3 days
  };

  const sub = pool.subscribeMany(relays, filter, {
    onevent(event) {
      try {
        const payload: AdashiSyncEventPayload = JSON.parse(event.content);
        if (payload.circleId === circleId) {
          onSyncEvent(payload);
        }
      } catch (err) {
        console.warn('Malformed Adashi sync event:', err);
      }
    },
  });

  return () => {
    sub.close();
  };
}
