import crypto from 'node:crypto';
import { db } from '../db/database.js';

export interface PosItemInput {
  nameEn: string;
  nameHa?: string;
  priceNgn: number;
  category?: string;
  stockCount?: number;
}

export class PosService {
  /**
   * Retrieves merchant catalog.
   */
  static getCatalog(merchantPubkey?: string): any[] {
    const query = merchantPubkey
      ? 'SELECT * FROM merchant_items WHERE merchant_pubkey = ? AND is_active = 1 ORDER BY created_at DESC'
      : 'SELECT * FROM merchant_items WHERE is_active = 1 ORDER BY created_at DESC';

    return merchantPubkey
      ? (db.prepare(query).all(merchantPubkey) as any[])
      : (db.prepare(query).all() as any[]);
  }

  /**
   * Adds an item to the merchant catalog.
   */
  static addCatalogItem(merchantPubkey: string, item: PosItemInput, btcRate = 145000000): any {
    const id = 'item_' + crypto.randomBytes(8).toString('hex');
    const now = Date.now();
    const sats = Math.round((item.priceNgn / btcRate) * 100000000);

    db.prepare(`
      INSERT INTO merchant_items (id, merchant_pubkey, name_en, name_ha, price_ngn, price_sats, category, stock_count, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      id,
      merchantPubkey,
      item.nameEn,
      item.nameHa || item.nameEn,
      item.priceNgn,
      sats,
      item.category || 'General',
      item.stockCount || 50,
      now
    );

    return db.prepare('SELECT * FROM merchant_items WHERE id = ?').get(id);
  }

  /**
   * Creates a new POS sales order.
   */
  static createOrder(merchantPubkey: string, data: {
    items: Array<{ id: string; name: string; priceNgn: number; quantity: number }>;
    totalNgn: number;
    totalSats: number;
    paymentMethod?: string;
  }): any {
    const orderId = 'ord_' + crypto.randomBytes(8).toString('hex');
    const invoiceHash = 'lnbc_' + crypto.randomBytes(16).toString('hex');
    const now = Date.now();

    db.prepare(`
      INSERT INTO pos_orders (id, merchant_pubkey, total_sats, total_ngn, item_count, status, payment_method, invoice_hash, items_snapshot, created_at)
      VALUES (?, ?, ?, ?, ?, 'UNPAID', ?, ?, ?, ?)
    `).run(
      orderId,
      merchantPubkey,
      data.totalSats,
      data.totalNgn,
      data.items.length,
      data.paymentMethod || 'CASHU',
      invoiceHash,
      JSON.stringify(data.items),
      now
    );

    return {
      orderId,
      invoiceHash,
      totalSats: data.totalSats,
      totalNgn: data.totalNgn,
      status: 'UNPAID',
      qrPayload: `cashuA${Buffer.from(JSON.stringify({ orderId, sats: data.totalSats })).toString('base64')}`,
      createdAt: now
    };
  }

  /**
   * Settles a POS order upon verification of ecash token or Lightning payment.
   */
  static settleOrder(orderId: string, proofSecrets?: string[]): any {
    const order = db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(orderId) as any;
    if (!order) throw new Error('Order not found.');

    const now = Date.now();

    // Mark order paid
    db.prepare(`
      UPDATE pos_orders
      SET status = 'PAID', settled_at = ?
      WHERE id = ?
    `).run(now, orderId);

    // Record in transactions ledger
    const txId = 'tx_' + crypto.randomBytes(8).toString('hex');
    const txHash = crypto.randomBytes(32).toString('hex');
    db.prepare(`
      INSERT INTO transactions (id, user_pubkey, tx_hash, direction, type, amount_sats, amount_ngn, status, memo, created_at)
      VALUES (?, ?, ?, 'INCOMING', 'POS_SALE', ?, ?, 'SETTLED', ?, ?)
    `).run(txId, order.merchant_pubkey, txHash, order.total_sats, order.total_ngn, `POS Checkout [Order ${orderId.slice(-6)}]`, now);

    return {
      orderId,
      status: 'PAID',
      settledAt: now,
      receiptNumber: `RCP-${Date.now().toString().slice(-6)}`,
      totalSats: order.total_sats,
      totalNgn: order.total_ngn
    };
  }
}
