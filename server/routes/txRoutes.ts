import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', optionalAuth, (req: Request, res: Response) => {
  try {
    const pubkey = req.user?.pubkey || (req.query.pubkey as string) || '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const txs = db.prepare(`
      SELECT * FROM transactions 
      WHERE user_pubkey = ? OR user_pubkey = 'all'
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(pubkey, limit);

    res.json({ success: true, data: txs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', optionalAuth, (req: Request, res: Response) => {
  try {
    const pubkey = req.user?.pubkey || req.body.pubkey || '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { direction, type, amountSats, amountNgn, memo, counterparty, status, paymentHash } = req.body;

    if (!amountSats || !direction || !type) {
      res.status(400).json({ success: false, error: 'Missing required transaction fields.' });
      return;
    }

    const id = 'tx_' + crypto.randomBytes(8).toString('hex');
    const txHash = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    db.prepare(`
      INSERT INTO transactions (id, user_pubkey, tx_hash, direction, type, amount_sats, amount_ngn, fee_sats, status, memo, counterparty, payment_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).run(
      id,
      pubkey,
      txHash,
      direction,
      type,
      amountSats,
      amountNgn || (amountSats * 1.45),
      status || 'SETTLED',
      memo || '',
      counterparty || '',
      paymentHash || '',
      now
    );

    const created = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    res.json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    if (!tx) {
      res.status(404).json({ success: false, error: 'Transaction record not found.' });
      return;
    }
    res.json({ success: true, data: tx });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
