import { Router, Request, Response } from 'express';
import { MarketService } from '../services/marketService.js';

const router = Router();

router.get('/ticker', async (_req: Request, res: Response) => {
  try {
    const ticker = await MarketService.getLiveTicker();
    res.json({ success: true, data: ticker });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/orderbook', async (_req: Request, res: Response) => {
  try {
    const ticker = await MarketService.getLiveTicker();
    const orderbook = MarketService.getOrderBook(ticker.price);
    res.json({
      success: true,
      data: {
        symbol: ticker.symbol,
        indexPrice: ticker.price,
        orderbook
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
