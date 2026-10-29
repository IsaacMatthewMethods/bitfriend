import crypto from 'node:crypto';
import { db } from '../db/database.js';

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

export class CashuProofService {
  /**
   * Registers a batch of incoming proofs into the ledger.
   * If any proof secret is already in SPENT state, rejects as a double-spend attempt.
   */
  static registerProofs(
    userPubkey: string,
    mintUrl: string,
    proofs: Array<{ id: string; amount: number; secret: string; C: string }>
  ): { registered: number; totalSats: number } {
    let totalSats = 0;
    const now = Date.now();

    // Find wallet id
    const wallet = db.prepare('SELECT id FROM wallets WHERE user_pubkey = ?').get(userPubkey) as any;
    const walletId = wallet?.id || null;

    const checkStmt = db.prepare('SELECT secret, status FROM ecash_proofs WHERE secret = ?');
    const insertStmt = db.prepare(`
      INSERT INTO ecash_proofs (id, wallet_id, mint_url, keyset_id, amount_sats, secret, c_hex, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'UNSPENT', ?)
    `);

    for (const p of proofs) {
      const existing = checkStmt.get(p.secret) as { secret: string; status: string } | undefined;
      if (existing) {
        if (existing.status === 'SPENT') {
          throw new Error(`Double-spend detected! Proof secret ${p.secret.slice(0, 12)}... has already been redeemed.`);
        }
        // Already stored, skip duplicate insert
        continue;
      }

      const proofId = 'prf_' + crypto.randomBytes(8).toString('hex');
      insertStmt.run(proofId, walletId, mintUrl, p.id, p.amount, p.secret, p.C, now);
      totalSats += p.amount;
    }

    // Update wallet balance if registered
    if (walletId && totalSats > 0) {
      db.prepare(`
        UPDATE wallets 
        SET ecash_balance_sats = ecash_balance_sats + ?,
            balance_sats = balance_sats + ?,
            updated_at = ?
        WHERE id = ?
      `).run(totalSats, totalSats, now, walletId);
    }

    return { registered: proofs.length, totalSats };
  }

  /**
   * NUT-07 state check: checks status of proof secrets
   */
  static checkProofStates(secrets: string[]): Array<{ secret: string; state: 'UNSPENT' | 'PENDING' | 'SPENT' | 'UNKNOWN' }> {
    const checkStmt = db.prepare('SELECT secret, status FROM ecash_proofs WHERE secret = ?');
    return secrets.map((secret) => {
      const row = checkStmt.get(secret) as { status: string } | undefined;
      if (!row) {
        return { secret, state: 'UNKNOWN' };
      }
      return { secret, state: row.status as any };
    });
  }

  /**
   * Marks a list of proof secrets as SPENT (e.g. after swap or payment).
   */
  static markSpent(secrets: string[]): void {
    const now = Date.now();
    const updateStmt = db.prepare("UPDATE ecash_proofs SET status = 'SPENT', spent_at = ? WHERE secret = ?");
    for (const secret of secrets) {
      updateStmt.run(now, secret);
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
}
