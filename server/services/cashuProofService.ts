import crypto from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { db } from '../db/database.js';
import {
  getOrInitActiveMintKeyset,
  signBlindedMessage,
  verifyBdhkeProof,
  createSignedMintProof,
} from './cashuMintCrypto.js';

export interface ProofRecord {
  id: string;
  wallet_id?: string;
  mint_url: string;
  keyset_id: string;
  amount_sats: number;
  secret: string;
  c_hex: string;
  status: 'UNSPENT' | 'PENDING_SPEND' | 'SPENT' | 'DESTROYED';
  spent_at?: number;
  created_at: number;
}

export interface BlindedMessageInput {
  amount: number;
  id?: string;
  B_: string;
}

export interface BlindSignatureOutput {
  id: string;
  amount: number;
  C_: string;
}

export class CashuProofService {
  /**
   * NUT-01 / NUT-02: Returns active Mint keyset public keys.
   */
  static getMintKeysetPublic() {
    const keyset = getOrInitActiveMintKeyset();
    return {
      keysets: [
        {
          id: keyset.id,
          unit: keyset.unit,
          active: Boolean(keyset.active),
          keys: keyset.pubkeys,
        },
      ],
    };
  }

  /**
   * NUT-04: Signs blinded outputs (or mints new signed proofs) for a verified deposit.
   */
  static issueBlindSignatures(outputs: BlindedMessageInput[]): BlindSignatureOutput[] {
    const keyset = getOrInitActiveMintKeyset();
    return outputs.map((out) => {
      const kPriv = keyset.privkeys[out.amount];
      if (!kPriv) {
        throw new Error(`Unsupported Cashu denomination: ${out.amount} sats.`);
      }
      const C_ = signBlindedMessage(out.B_, kPriv);
      return {
        id: keyset.id,
        amount: out.amount,
        C_,
      };
    });
  }

  /**
   * Registers a batch of unspent proofs into the SQLite ledger.
   * Rejects any proof whose secret is already marked SPENT.
   */
  static registerProofs(
    userPubkey: string,
    mintUrl: string,
    proofs: Array<{ id: string; amount: number; secret: string; C: string }>
  ): { registered: number; totalSats: number; keysetId: string } {
    const keyset = getOrInitActiveMintKeyset();
    const now = Date.now();

    let wallet = db.prepare('SELECT id FROM wallets WHERE user_pubkey = ?').get(userPubkey) as any;
    if (!wallet) {
      db.prepare(`
        INSERT OR IGNORE INTO users (id, pubkey, username, role, created_at, updated_at)
        VALUES (?, ?, ?, 'vendor', ?, ?)
      `).run('usr_' + crypto.randomBytes(8).toString('hex'), userPubkey, 'Vendor_' + userPubkey.slice(0, 6), now, now);

      const walletId = 'wlt_' + crypto.randomBytes(8).toString('hex');
      db.prepare(`
        INSERT INTO wallets (id, user_pubkey, default_currency, active_mint_url, balance_sats, ecash_balance_sats, created_at, updated_at)
        VALUES (?, ?, 'NGN', ?, 0, 0, ?, ?)
      `).run(walletId, userPubkey, mintUrl, now, now);
      wallet = { id: walletId };
    }
    const walletId = wallet.id;

    const checkStmt = db.prepare('SELECT secret, status FROM ecash_proofs WHERE secret = ?');
    const insertStmt = db.prepare(`
      INSERT INTO ecash_proofs (id, wallet_id, mint_url, keyset_id, amount_sats, secret, c_hex, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'UNSPENT', ?)
    `);

    let newlyRegistered = 0;
    for (const p of proofs) {
      // Validate curve point C on secp256k1
      this.assertValidCurvePoint(p.C, p.secret, p.id, p.amount);

      const existing = checkStmt.get(p.secret) as { secret: string; status: string } | undefined;
      if (existing) {
        if (existing.status === 'SPENT') {
          throw new Error(
            `Double-spend detected! Proof secret ${p.secret.slice(0, 14)}... has already been spent.`
          );
        }
        continue;
      }

      const proofId = 'prf_' + crypto.randomBytes(8).toString('hex');
      insertStmt.run(proofId, walletId, mintUrl, p.id || keyset.id, p.amount, p.secret, p.C, now);
      newlyRegistered++;
    }

    const unspentTotal = this.getUnspentBalance(userPubkey);
    db.prepare(`
      UPDATE wallets
      SET ecash_balance_sats = ?,
          balance_sats = ?,
          updated_at = ?
      WHERE id = ?
    `).run(unspentTotal, unspentTotal, now, walletId);

    return {
      registered: newlyRegistered,
      totalSats: unspentTotal,
      keysetId: keyset.id,
    };
  }

  /**
   * NUT-03 Atomic Split / Swap:
   * Consumes `inputs` (verifying BDHKE signature + UNSPENT status in SQLite, marking them SPENT)
   * and returns blind signatures `C_ = k * B_` on `outputs`.
   */
  static swapProofs(
    inputs: Array<{ id: string; amount: number; secret: string; C: string }>,
    outputs: BlindedMessageInput[],
    userPubkey?: string
  ): { signatures: BlindSignatureOutput[]; burnedCount: number; totalSats: number } {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new Error('Swap requires at least one input proof.');
    }
    if (!Array.isArray(outputs) || outputs.length === 0) {
      throw new Error('Swap requires at least one blinded output message.');
    }

    const inputSum = inputs.reduce((s, p) => s + Number(p.amount), 0);
    const outputSum = outputs.reduce((s, o) => s + Number(o.amount), 0);
    if (inputSum !== outputSum) {
      throw new Error(
        `NUT-03 amount mismatch: input sum (${inputSum} sats) != output sum (${outputSum} sats).`
      );
    }

    // Check for duplicate secrets inside the same input batch
    const seenSecrets = new Set<string>();
    for (const inp of inputs) {
      if (seenSecrets.has(inp.secret)) {
        throw new Error(`Duplicate input secret in swap request: ${inp.secret.slice(0, 14)}...`);
      }
      seenSecrets.add(inp.secret);
      this.assertValidCurvePoint(inp.C, inp.secret, inp.id, inp.amount);
    }

    const keyset = getOrInitActiveMintKeyset();
    const now = Date.now();
    const checkStmt = db.prepare('SELECT id, status FROM ecash_proofs WHERE secret = ?');
    const markSpentStmt = db.prepare(
      "UPDATE ecash_proofs SET status = 'SPENT', spent_at = ? WHERE secret = ?"
    );
    const insertSpentStmt = db.prepare(`
      INSERT INTO ecash_proofs (id, wallet_id, mint_url, keyset_id, amount_sats, secret, c_hex, status, spent_at, created_at)
      VALUES (?, NULL, 'https://mint.bitfriend.me', ?, ?, ?, ?, 'SPENT', ?, ?)
    `);

    db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      for (const inp of inputs) {
        const existing = checkStmt.get(inp.secret) as { id: string; status: string } | undefined;
        if (existing && existing.status === 'SPENT') {
          throw new Error(
            `Double-spend detected! Proof secret ${inp.secret.slice(0, 14)}... has already been spent.`
          );
        }

        if (existing) {
          markSpentStmt.run(now, inp.secret);
        } else {
          insertSpentStmt.run(
            'prf_' + crypto.randomBytes(8).toString('hex'),
            inp.id || keyset.id,
            inp.amount,
            inp.secret,
            inp.C,
            now,
            now
          );
        }
      }

      const signatures = outputs.map((out) => {
        const kPriv = keyset.privkeys[out.amount];
        if (!kPriv) {
          throw new Error(`Unsupported output denomination: ${out.amount} sats.`);
        }
        const C_ = signBlindedMessage(out.B_, kPriv);
        return {
          id: keyset.id,
          amount: out.amount,
          C_,
        };
      });

      if (userPubkey) {
        const unspentTotal = this.getUnspentBalance(userPubkey);
        db.prepare('UPDATE wallets SET ecash_balance_sats = ?, balance_sats = ?, updated_at = ? WHERE user_pubkey = ?')
          .run(unspentTotal, unspentTotal, now, userPubkey);
      }

      db.exec('COMMIT');
      return {
        signatures,
        burnedCount: inputs.length,
        totalSats: inputSum,
      };
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  /**
   * Claims an incoming batch of Cashu proofs by atomically burning them as SPENT
   * and issuing fresh BDHKE-signed UNSPENT proofs for the recipient.
   */
  static claimProofsAtomic(
    userPubkey: string,
    incomingProofs: Array<{ id: string; amount: number; secret: string; C: string }>,
    mintUrl = 'https://mint.bitfriend.me'
  ): { amountSats: number; freshProofs: Array<{ id: string; amount: number; secret: string; C: string }> } {
    if (!Array.isArray(incomingProofs) || incomingProofs.length === 0) {
      throw new Error('No proofs provided to claim.');
    }

    const totalSats = incomingProofs.reduce((s, p) => s + Number(p.amount), 0);
    const keyset = getOrInitActiveMintKeyset();
    const now = Date.now();

    // Ensure recipient wallet exists
    let wallet = db.prepare('SELECT id FROM wallets WHERE user_pubkey = ?').get(userPubkey) as any;
    if (!wallet) {
      db.prepare(`
        INSERT OR IGNORE INTO users (id, pubkey, username, role, created_at, updated_at)
        VALUES (?, ?, ?, 'vendor', ?, ?)
      `).run('usr_' + crypto.randomBytes(8).toString('hex'), userPubkey, 'Vendor_' + userPubkey.slice(0, 6), now, now);

      const walletId = 'wlt_' + crypto.randomBytes(8).toString('hex');
      db.prepare(`
        INSERT INTO wallets (id, user_pubkey, default_currency, active_mint_url, balance_sats, ecash_balance_sats, created_at, updated_at)
        VALUES (?, ?, 'NGN', ?, 0, 0, ?, ?)
      `).run(walletId, userPubkey, mintUrl, now, now);
      wallet = { id: walletId };
    }

    const checkStmt = db.prepare('SELECT id, status FROM ecash_proofs WHERE secret = ?');
    const markSpentStmt = db.prepare(
      "UPDATE ecash_proofs SET status = 'SPENT', spent_at = ? WHERE secret = ?"
    );
    const insertStmt = db.prepare(`
      INSERT INTO ecash_proofs (id, wallet_id, mint_url, keyset_id, amount_sats, secret, c_hex, status, spent_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Split totalSats into power-of-2 denominations
    const denominations: number[] = [];
    let rem = totalSats;
    let cur = 1;
    while (rem > 0) {
      if (rem & cur) {
        denominations.push(cur);
        rem -= cur;
      }
      cur <<= 1;
    }

    db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      for (const inp of incomingProofs) {
        this.assertValidCurvePoint(inp.C, inp.secret, inp.id, inp.amount);
        const existing = checkStmt.get(inp.secret) as { id: string; status: string } | undefined;
        if (existing && existing.status === 'SPENT') {
          throw new Error(
            `Double-spend detected! Voucher proof ${inp.secret.slice(0, 14)}... has already been claimed.`
          );
        }
        if (existing) {
          markSpentStmt.run(now, inp.secret);
        } else {
          insertStmt.run(
            'prf_' + crypto.randomBytes(8).toString('hex'),
            wallet.id,
            mintUrl,
            inp.id || keyset.id,
            inp.amount,
            inp.secret,
            inp.C,
            'SPENT',
            now,
            now
          );
        }
      }

      const freshProofs = denominations.map((amt) => {
        const signed = createSignedMintProof(amt);
        insertStmt.run(
          'prf_' + crypto.randomBytes(8).toString('hex'),
          wallet.id,
          mintUrl,
          signed.id,
          signed.amount,
          signed.secret,
          signed.C,
          'UNSPENT',
          null,
          now
        );
        return signed;
      });

      const unspentTotal = this.getUnspentBalance(userPubkey);
      db.prepare('UPDATE wallets SET ecash_balance_sats = ?, balance_sats = ?, updated_at = ? WHERE id = ?')
        .run(unspentTotal, unspentTotal, now, wallet.id);

      db.exec('COMMIT');
      return { amountSats: totalSats, freshProofs };
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  /**
   * NUT-07 state check: checks status of proof secrets in SQLite.
   */
  static checkProofStates(
    secrets: string[]
  ): Array<{ secret: string; state: 'UNSPENT' | 'PENDING' | 'SPENT' }> {
    const checkStmt = db.prepare('SELECT secret, status FROM ecash_proofs WHERE secret = ?');
    return secrets.map((secret) => {
      const row = checkStmt.get(secret) as { status: string } | undefined;
      if (!row) {
        return { secret, state: 'UNSPENT' };
      }
      return {
        secret,
        state: row.status === 'SPENT' ? 'SPENT' : row.status === 'PENDING_SPEND' ? 'PENDING' : 'UNSPENT',
      };
    });
  }

  /**
   * Marks a list of proof secrets as SPENT (throws if any secret is already SPENT).
   */
  static markSpent(secrets: string[]): void {
    const now = Date.now();
    const checkStmt = db.prepare('SELECT status FROM ecash_proofs WHERE secret = ?');
    const updateStmt = db.prepare("UPDATE ecash_proofs SET status = 'SPENT', spent_at = ? WHERE secret = ?");
    const keyset = getOrInitActiveMintKeyset();
    const insertSpentStmt = db.prepare(`
      INSERT INTO ecash_proofs (id, wallet_id, mint_url, keyset_id, amount_sats, secret, c_hex, status, spent_at, created_at)
      VALUES (?, NULL, 'https://mint.bitfriend.me', ?, 0, ?, ?, 'SPENT', ?, ?)
    `);

    for (const secret of secrets) {
      const existing = checkStmt.get(secret) as { status: string } | undefined;
      if (existing && existing.status === 'SPENT') {
        throw new Error(`Double-spend detected! Proof ${secret.slice(0, 14)}... is already spent.`);
      }
      if (existing) {
        updateStmt.run(now, secret);
      } else {
        insertSpentStmt.run(
          'prf_' + crypto.randomBytes(8).toString('hex'),
          keyset.id,
          secret,
          '02' + '0'.repeat(64),
          now,
          now
        );
      }
    }
  }

  /**
   * Gets total unspent balance in sats for a user's wallet.
   */
  static getUnspentBalance(userPubkey: string): number {
    const wallet = db.prepare('SELECT id FROM wallets WHERE user_pubkey = ?').get(userPubkey) as any;
    if (!wallet) return 0;

    const res = db.prepare(`
      SELECT SUM(amount_sats) as total 
      FROM ecash_proofs 
      WHERE wallet_id = ? AND status = 'UNSPENT'
    `).get(wallet.id) as { total: number | null };

    return res.total || 0;
  }

  /**
   * Verifies that C is a valid compressed secp256k1 point, and if the proof belongs
   * to our active Mint keyset, verifies the full BDHKE equation C == k * hash_to_curve(secret).
   */
  private static assertValidCurvePoint(
    cHex: string,
    secret: string,
    keysetId?: string,
    amount?: number
  ): void {
    if (!cHex || typeof cHex !== 'string') {
      throw new Error('Missing Cashu signature point C.');
    }
    try {
      const pt = secp256k1.Point.fromHex(cHex.trim());
      pt.assertValidity();
    } catch {
      throw new Error(`Invalid secp256k1 curve point C (${cHex.slice(0, 16)}...).`);
    }

    const activeKeyset = getOrInitActiveMintKeyset();
    if (keysetId === activeKeyset.id && amount && activeKeyset.privkeys[amount]) {
      const validBdhke = verifyBdhkeProof(secret, cHex, activeKeyset.privkeys[amount]);
      if (!validBdhke) {
        throw new Error(
          `Forged Cashu BDHKE signature rejected for keyset ${keysetId} (${amount} sats).`
        );
      }
    }
  }
}
