import crypto from 'node:crypto';
import { schnorr } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes } from '@noble/hashes/utils.js';
import { db } from '../db/database.js';
import { generateToken, hashSessionToken, AuthenticatedUser } from '../middleware/authMiddleware.js';

export class AuthService {
  /**
   * Generates and persists a 32-byte cryptographic challenge nonce in SQLite
   * for non-custodial secp256k1 Schnorr authentication.
   */
  static createChallenge(pubkey: string): { nonce: string; expiresAt: number } {
    const normalizedPubkey = pubkey.trim().toLowerCase();
    if (!/^[0-9a-f]{64,66}$/.test(normalizedPubkey)) {
      throw new Error('Invalid secp256k1 public key hex (expected 64-char x-only or 66-char compressed hex).');
    }

    const now = Date.now();
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = now + 5 * 60 * 1000; // 5 minute TTL

    // Purge expired challenges and upsert challenge in SQLite
    db.prepare('DELETE FROM auth_challenges WHERE expires_at < ?').run(now);
    db.prepare(`
      INSERT OR REPLACE INTO auth_challenges (pubkey, nonce, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(normalizedPubkey, nonce, expiresAt, now);

    return { nonce, expiresAt };
  }

  /**
   * Verifies a BIP-340 Schnorr signature over SHA-256(nonce) using @noble/curves/secp256k1.
   */
  static authenticateWithPubkey(
    pubkey: string,
    signatureHex: string,
    deviceInfo = 'BitFriend Client'
  ): { user: AuthenticatedUser; token: string } {
    const normalizedPubkey = pubkey.trim().toLowerCase();
    const record = db
      .prepare('SELECT pubkey, nonce, expires_at FROM auth_challenges WHERE pubkey = ?')
      .get(normalizedPubkey) as { pubkey: string; nonce: string; expires_at: number } | undefined;

    if (!record) {
      throw new Error('No active authentication challenge found for this public key. Request a new challenge.');
    }

    // Consume challenge immediately (single-use nonce)
    db.prepare('DELETE FROM auth_challenges WHERE pubkey = ?').run(normalizedPubkey);

    if (Date.now() > record.expires_at) {
      throw new Error('Authentication challenge has expired. Please retry.');
    }

    const cleanSig = signatureHex.trim().toLowerCase();
    if (!/^[0-9a-f]{128}$/.test(cleanSig)) {
      this.logAudit('AUTH_SIGNATURE_INVALID', normalizedPubkey, { reason: 'Malformed signature length' });
      throw new Error('Invalid Schnorr signature format (expected 64-byte / 128-hex-char BIP-340 signature).');
    }

    // Extract 32-byte x-only public key (strip 02/03 prefix if 33-byte compressed pubkey is provided)
    const xOnlyPubkeyHex = normalizedPubkey.length === 66 ? normalizedPubkey.slice(2) : normalizedPubkey;
    const msgHash = sha256(new TextEncoder().encode(record.nonce));

    let isValid = false;
    try {
      isValid = schnorr.verify(hexToBytes(cleanSig), msgHash, hexToBytes(xOnlyPubkeyHex));
    } catch {
      isValid = false;
    }

    if (!isValid) {
      this.logAudit('AUTH_SIGNATURE_INVALID', normalizedPubkey, { nonce: record.nonce });
      throw new Error('Cryptographic Schnorr signature verification failed.');
    }

    const user = this.ensureUserAndWallet(normalizedPubkey);
    const token = this.createSession(user, deviceInfo);
    this.logAudit('AUTH_SCHNORR_SUCCESS', normalizedPubkey, { deviceInfo });

    return { user, token };
  }

  /**
   * Authenticate or register with a 6-digit Master PIN (PBKDF2-HMAC-SHA256, 100,000 iterations).
   */
  static authenticateWithPin(
    pubkey: string,
    pin: string,
    deviceInfo = 'BitFriend PIN Client'
  ): { user: AuthenticatedUser; token: string } {
    if (!/^\d{6}$/.test(pin)) {
      throw new Error('Master PIN must be exactly 6 digits.');
    }

    const normalizedPubkey = pubkey.trim().toLowerCase();
    const now = Date.now();
    const existing = db.prepare('SELECT * FROM users WHERE pubkey = ?').get(normalizedPubkey) as any;

    if (!existing) {
      const id = 'usr_' + crypto.randomBytes(8).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const pinHash = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256').toString('hex');
      const defaultUsername = 'Vendor_' + normalizedPubkey.slice(0, 6);
      const defaultLnAddress = `${defaultUsername.toLowerCase()}@bitfriend.me`;

      db.prepare(`
        INSERT INTO users (id, pubkey, username, lightning_address, currency, role, pin_hash, pin_salt, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'NGN', 'vendor', ?, ?, ?, ?)
      `).run(id, normalizedPubkey, defaultUsername, defaultLnAddress, pinHash, salt, now, now);

      const walletId = 'wlt_' + crypto.randomBytes(8).toString('hex');
      db.prepare(`
        INSERT INTO wallets (id, user_pubkey, default_currency, active_mint_url, balance_sats, ecash_balance_sats, created_at, updated_at)
        VALUES (?, ?, 'NGN', 'https://mint.minibits.cash/Bitcoin', 0, 0, ?, ?)
      `).run(walletId, normalizedPubkey, now, now);
    } else if (!existing.pin_hash || !existing.pin_salt) {
      // User was registered via Schnorr pubkey first; bind their initial 6-digit PIN now
      const salt = crypto.randomBytes(16).toString('hex');
      const pinHash = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256').toString('hex');
      db.prepare('UPDATE users SET pin_hash = ?, pin_salt = ?, updated_at = ? WHERE pubkey = ?')
        .run(pinHash, salt, now, normalizedPubkey);
    } else {
      const computedHash = crypto.pbkdf2Sync(pin, existing.pin_salt, 100000, 32, 'sha256').toString('hex');
      if (computedHash !== existing.pin_hash) {
        this.logAudit('AUTH_PIN_FAILED', normalizedPubkey, {});
        throw new Error('Incorrect Master PIN entered. Access denied.');
      }
    }

    const updatedUser = db.prepare('SELECT * FROM users WHERE pubkey = ?').get(normalizedPubkey) as any;
    const user: AuthenticatedUser = {
      pubkey: normalizedPubkey,
      role: updatedUser?.role || 'vendor',
      username: updatedUser?.username || 'Vendor_' + normalizedPubkey.slice(0, 6),
    };

    const token = this.createSession(user, deviceInfo);
    this.logAudit('AUTH_PIN_SUCCESS', normalizedPubkey, { deviceInfo });
    return { user, token };
  }

  /**
   * Revokes an active JWT session in SQLite.
   */
  static logoutSession(rawToken?: string, pubkey?: string): { revoked: boolean } {
    if (rawToken) {
      const tokenHash = hashSessionToken(rawToken);
      db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(tokenHash);
    }
    if (pubkey) {
      this.logAudit('AUTH_LOGOUT', pubkey, {});
    }
    return { revoked: true };
  }

  /**
   * Updates user profile fields in SQLite and returns the updated profile.
   */
  static updateProfile(
    pubkey: string,
    updates: { username?: string; lightningAddress?: string; currency?: string }
  ): any {
    const normalizedPubkey = pubkey.trim().toLowerCase();
    this.ensureUserAndWallet(normalizedPubkey);

    const now = Date.now();
    const existing = db.prepare('SELECT * FROM users WHERE pubkey = ?').get(normalizedPubkey) as any;

    const nextUsername = updates.username?.trim() || existing.username;
    const nextLnAddress = updates.lightningAddress?.trim() || existing.lightning_address || `${nextUsername.toLowerCase().replace(/\s+/g, '')}@bitfriend.me`;
    const nextCurrency = updates.currency?.trim() || existing.currency || 'NGN';

    db.prepare(`
      UPDATE users
      SET username = ?, lightning_address = ?, currency = ?, updated_at = ?
      WHERE pubkey = ?
    `).run(nextUsername, nextLnAddress, nextCurrency, now, normalizedPubkey);

    db.prepare(`
      UPDATE wallets
      SET default_currency = ?, updated_at = ?
      WHERE user_pubkey = ?
    `).run(nextCurrency, now, normalizedPubkey);

    this.logAudit('PROFILE_UPDATED', normalizedPubkey, {
      username: nextUsername,
      lightningAddress: nextLnAddress,
      currency: nextCurrency,
    });

    return this.getProfile(normalizedPubkey);
  }

  /**
   * Retrieves profile details and wallet state from SQLite.
   */
  static getProfile(pubkey: string): any {
    const normalizedPubkey = pubkey.trim().toLowerCase();
    const user = db
      .prepare('SELECT id, pubkey, username, lightning_address, currency, role, created_at, updated_at FROM users WHERE pubkey = ?')
      .get(normalizedPubkey);
    const wallet = db
      .prepare('SELECT id, default_currency, active_mint_url, balance_sats, ecash_balance_sats FROM wallets WHERE user_pubkey = ?')
      .get(normalizedPubkey);

    return {
      user: user || { pubkey: normalizedPubkey, role: 'vendor', currency: 'NGN' },
      wallet: wallet || { balance_sats: 0, ecash_balance_sats: 0, active_mint_url: 'https://mint.minibits.cash/Bitcoin' }
    };
  }

  private static ensureUserAndWallet(pubkey: string): AuthenticatedUser {
    const now = Date.now();
    let existing = db.prepare('SELECT * FROM users WHERE pubkey = ?').get(pubkey) as any;

    if (!existing) {
      const id = 'usr_' + crypto.randomBytes(8).toString('hex');
      const username = 'Vendor_' + pubkey.slice(0, 6);
      const lnAddress = `${username.toLowerCase()}@bitfriend.me`;

      db.prepare(`
        INSERT INTO users (id, pubkey, username, lightning_address, currency, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'NGN', 'vendor', ?, ?)
      `).run(id, pubkey, username, lnAddress, now, now);

      const walletId = 'wlt_' + crypto.randomBytes(8).toString('hex');
      db.prepare(`
        INSERT INTO wallets (id, user_pubkey, default_currency, active_mint_url, balance_sats, ecash_balance_sats, created_at, updated_at)
        VALUES (?, ?, 'NGN', 'https://mint.minibits.cash/Bitcoin', 0, 0, ?, ?)
      `).run(walletId, pubkey, now, now);

      existing = db.prepare('SELECT * FROM users WHERE pubkey = ?').get(pubkey) as any;
    }

    return {
      pubkey,
      role: existing?.role || 'vendor',
      username: existing?.username || 'Vendor_' + pubkey.slice(0, 6),
    };
  }

  private static createSession(user: AuthenticatedUser, deviceInfo: string): string {
    const token = generateToken(user);
    const tokenHash = hashSessionToken(token);
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    db.prepare(`
      INSERT INTO user_sessions (id, pubkey, token_hash, device_info, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('ses_' + crypto.randomBytes(8).toString('hex'), user.pubkey, tokenHash, deviceInfo, expiresAt, now);

    return token;
  }

  private static logAudit(eventType: string, actorPubkey: string, payload: Record<string, unknown>): void {
    try {
      db.prepare(`
        INSERT INTO audit_logs (id, event_type, actor_pubkey, payload, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'aud_' + crypto.randomBytes(8).toString('hex'),
        eventType,
        actorPubkey,
        JSON.stringify(payload),
        Date.now()
      );
    } catch {
      // Non-fatal audit logging
    }
  }
}
