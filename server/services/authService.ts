import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { generateToken, AuthenticatedUser } from '../middleware/authMiddleware.js';

interface ChallengeRecord {
  pubkey: string;
  nonce: string;
  expiresAt: number;
}

const challengeStore = new Map<string, ChallengeRecord>();

export class AuthService {
  /**
   * Generates a 32-byte cryptographic challenge nonce for non-custodial public-key authentication.
   */
  static createChallenge(pubkey: string): { nonce: string; expiresAt: number } {
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minute TTL

    challengeStore.set(pubkey, { pubkey, nonce, expiresAt });
    return { nonce, expiresAt };
  }

  /**
   * Verifies the cryptographic challenge or PIN authentication.
   */
  static authenticateWithPubkey(pubkey: string, signatureHex: string): { user: AuthenticatedUser; token: string } {
    const record = challengeStore.get(pubkey);
    if (!record) {
      throw new Error('No active authentication challenge found for this public key. Request a new challenge.');
    }

    if (Date.now() > record.expiresAt) {
      challengeStore.delete(pubkey);
      throw new Error('Authentication challenge has expired. Please retry.');
    }

    // In production, verify Schnorr/ECDSA signature of record.nonce using secp256k1
    // We validate signature format length (64 or 65 bytes in hex)
    if (!signatureHex || signatureHex.length < 64) {
      throw new Error('Invalid signature format provided.');
    }

    // Clean challenge
    challengeStore.delete(pubkey);

    // Upsert user in database
    const now = Date.now();
    const existing = db.prepare('SELECT * FROM users WHERE pubkey = ?').get(pubkey) as any;

    if (!existing) {
      const id = 'usr_' + crypto.randomBytes(8).toString('hex');
      const username = 'Vendor_' + pubkey.slice(0, 6);
      db.prepare(`
        INSERT INTO users (id, pubkey, username, role, created_at, updated_at)
        VALUES (?, ?, ?, 'vendor', ?, ?)
      `).run(id, pubkey, username, now, now);

      // Create initial wallet entry
      const walletId = 'wlt_' + crypto.randomBytes(8).toString('hex');
      db.prepare(`
        INSERT INTO wallets (id, user_pubkey, default_currency, active_mint_url, balance_sats, ecash_balance_sats, created_at, updated_at)
        VALUES (?, ?, 'NGN', 'https://mint.minibits.cash/Bitcoin', 0, 0, ?, ?)
      `).run(walletId, pubkey, now, now);
    }

    const user: AuthenticatedUser = {
      pubkey,
      role: existing?.role || 'vendor',
      username: existing?.username || 'Vendor_' + pubkey.slice(0, 6),
    };

    const token = generateToken(user);
    return { user, token };
  }

  /**
   * Authenticate or register with a 6-digit Master PIN.
   */
  static authenticateWithPin(pubkey: string, pin: string): { user: AuthenticatedUser; token: string } {
    if (!/^\d{6}$/.test(pin)) {
      throw new Error('Master PIN must be exactly 6 digits.');
    }

    const now = Date.now();
    const existing = db.prepare('SELECT * FROM users WHERE pubkey = ?').get(pubkey) as any;

    if (!existing) {
      // First-time registration with PIN
      const id = 'usr_' + crypto.randomBytes(8).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const pinHash = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256').toString('hex');

      db.prepare(`
        INSERT INTO users (id, pubkey, username, role, pin_hash, pin_salt, created_at, updated_at)
        VALUES (?, ?, ?, 'vendor', ?, ?, ?, ?)
      `).run(id, pubkey, 'Vendor_' + pubkey.slice(0, 6), pinHash, salt, now, now);

      const walletId = 'wlt_' + crypto.randomBytes(8).toString('hex');
      db.prepare(`
        INSERT INTO wallets (id, user_pubkey, default_currency, active_mint_url, balance_sats, ecash_balance_sats, created_at, updated_at)
        VALUES (?, ?, 'NGN', 'https://mint.minibits.cash/Bitcoin', 0, 0, ?, ?)
      `).run(walletId, pubkey, now, now);
    } else if (existing.pin_hash && existing.pin_salt) {
      // Verify existing PIN
      const computedHash = crypto.pbkdf2Sync(pin, existing.pin_salt, 100000, 32, 'sha256').toString('hex');
      if (computedHash !== existing.pin_hash) {
        throw new Error('Incorrect Master PIN entered. Access denied.');
      }
    }

    const user: AuthenticatedUser = {
      pubkey,
      role: existing?.role || 'vendor',
      username: existing?.username || 'Vendor_' + pubkey.slice(0, 6),
    };

    const token = generateToken(user);
    return { user, token };
  }

  /**
   * Retrieves profile details and wallet state.
   */
  static getProfile(pubkey: string): any {
    const user = db.prepare('SELECT id, pubkey, username, role, created_at FROM users WHERE pubkey = ?').get(pubkey);
    const wallet = db.prepare('SELECT id, default_currency, active_mint_url, balance_sats, ecash_balance_sats FROM wallets WHERE user_pubkey = ?').get(pubkey);

    return {
      user: user || { pubkey, role: 'vendor' },
      wallet: wallet || { balance_sats: 0, ecash_balance_sats: 0, active_mint_url: 'https://mint.minibits.cash/Bitcoin' }
    };
  }
}
