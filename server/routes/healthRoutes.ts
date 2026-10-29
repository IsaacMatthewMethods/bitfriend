import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

const router = Router();
const startTime = Date.now();

router.get('/', (_req: Request, res: Response) => {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number };
    const circleCount = db.prepare('SELECT COUNT(*) as count FROM adashi_circles').get() as { count: number };
    const itemCount = db.prepare('SELECT COUNT(*) as count FROM merchant_items').get() as { count: number };

    res.json({
      status: 'healthy',
      system: 'BitFriend Production Enterprise Node',
      version: '2.4.0',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      database: {
        engine: 'SQLite (node:sqlite WAL mode)',
        status: 'connected',
        metrics: {
          users: userCount.count,
          transactions: txCount.count,
          adashiCircles: circleCount.count,
          merchantCatalogItems: itemCount.count,
        }
      },
      protocols: ['Cashu NUT-00..09', 'Nostr NIP-01..44', 'Bitcoin Lightning BOLT-11', 'CBN NUBAN NIBSS Gateway'],
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      timestamp: Date.now()
    });
  }
});

export default router;
