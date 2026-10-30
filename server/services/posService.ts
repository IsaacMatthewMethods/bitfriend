import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { CashuProofService } from './cashuProofService.js';
import { SocketServer } from '../ws/socketServer.js';

export interface PosItemInput {
  nameEn: string;
  nameHa?: string;
  priceNgn: number;
  category?: string;
  stockCount?: number;
}

export class PosService {
  /**
   * Retrieves merchant catalog from SQLite.
   */
  static getCatalog(merchantPubkey?: string): any[] {
    if (merchantPubkey) {
      const ownItems = db
        .prepare('SELECT * FROM merchant_items WHERE merchant_pubkey = ? AND is_active = 1 ORDER BY created_at DESC')
        .all(merchantPubkey) as any[];
      if (ownItems.length > 0) return ownItems;
    }
    return db
      .prepare('SELECT * FROM merchant_items WHERE is_active = 1 ORDER BY created_at DESC')
      .all() as any[];
  }

  /**
   * Adds an item to the merchant catalog in SQLite.
   */
  static addCatalogItem(merchantPubkey: string, item: PosItemInput, btcRate = 158500000): any {
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
      item.stockCount ?? 50,
      now
    );

    return db.prepare('SELECT * FROM merchant_items WHERE id = ?').get(id);
  }

  /**
   * Creates a new POS sales order in SQLite.
   */
  static createOrder(
    merchantPubkey: string,
    data: {
      items: Array<{ id: string; name: string; priceNgn: number; quantity: number }>;
      totalNgn: number;
      totalSats: number;
      paymentMethod?: string;
    }
  ): any {
    const orderId = 'ord_' + crypto.randomBytes(8).toString('hex');
    const invoiceHash = 'lnbc_' + crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const totalCount = data.items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

    db.prepare(`
      INSERT INTO pos_orders (id, merchant_pubkey, total_sats, total_ngn, item_count, status, payment_method, invoice_hash, items_snapshot, created_at)
      VALUES (?, ?, ?, ?, ?, 'UNPAID', ?, ?, ?, ?)
    `).run(
      orderId,
      merchantPubkey,
      data.totalSats,
      data.totalNgn,
      totalCount,
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
      createdAt: now,
    };
  }

  /**
   * Atomically settles a POS order, burns customer Cashu proofs if supplied,
   * decrements `stock_count` in `merchant_items`, records a `POS_SALE` transaction,
   * and broadcasts settlement over WebSocket.
   */
  static settleOrder(orderId: string, proofSecrets?: string[]): any {
    const order = db.prepare('SELECT * FROM pos_orders WHERE id = ?').get(orderId) as any;
    if (!order) throw new Error('POS Order not found.');
    if (order.status === 'PAID') {
      throw new Error(`Order ${orderId} has already been settled.`);
    }

    const now = Date.now();
    const items: Array<{ id: string; name: string; priceNgn: number; quantity?: number }> = (() => {
      try {
        return JSON.parse(order.items_snapshot || '[]');
      } catch {
        return [];
      }
    })();

    db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      // 1. Burn customer Cashu proofs if provided
      if (Array.isArray(proofSecrets) && proofSecrets.length > 0) {
        CashuProofService.markSpent(proofSecrets);
      }

      // 2. Deduct inventory stock_count for each catalog item sold
      const deductStockStmt = db.prepare(`
        UPDATE merchant_items
        SET stock_count = MAX(0, stock_count - ?)
        WHERE id = ?
      `);
      for (const item of items) {
        if (item.id) {
          deductStockStmt.run(Number(item.quantity) || 1, item.id);
        }
      }

      // 3. Mark order PAID
      db.prepare(`
        UPDATE pos_orders
        SET status = 'PAID', settled_at = ?
        WHERE id = ?
      `).run(now, orderId);

      // 4. Credit merchant wallet balance
      db.prepare(`
        UPDATE wallets
        SET balance_sats = balance_sats + ?, ecash_balance_sats = ecash_balance_sats + ?, updated_at = ?
        WHERE user_pubkey = ?
      `).run(order.total_sats, order.total_sats, now, order.merchant_pubkey);

      // 5. Record in transactions ledger
      const txId = 'tx_' + crypto.randomBytes(8).toString('hex');
      const txHash = crypto.randomBytes(32).toString('hex');
      const itemSummary = items.map((i) => i.name).join(', ') || `Order ${orderId.slice(-6)}`;
      db.prepare(`
        INSERT INTO transactions (id, user_pubkey, tx_hash, direction, type, amount_sats, amount_ngn, status, memo, created_at)
        VALUES (?, ?, ?, 'INCOMING', 'POS_SALE', ?, ?, 'SETTLED', ?, ?)
      `).run(
        txId,
        order.merchant_pubkey,
        txHash,
        order.total_sats,
        order.total_ngn,
        `POS Sale: ${itemSummary}`,
        now
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const receiptNumber = `RCP-${now.toString().slice(-6)}`;
    SocketServer.broadcastToChannel('pos:orders', {
      event: 'pos_order_settled',
      orderId,
      receiptNumber,
      totalSats: order.total_sats,
      totalNgn: order.total_ngn,
      settledAt: now,
    });

    return {
      orderId,
      status: 'PAID',
      settledAt: now,
      receiptNumber,
      totalSats: order.total_sats,
      totalNgn: order.total_ngn,
    };
  }
}
