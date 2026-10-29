import { Router, Request, Response } from 'express';
import { PosService } from '../services/posService.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/catalog', optionalAuth, (req: Request, res: Response) => {
  try {
    const merchantPubkey = req.user?.pubkey || (req.query.merchantPubkey as string) || undefined;
    const catalog = PosService.getCatalog(merchantPubkey);
    res.json({ success: true, data: catalog });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/catalog', optionalAuth, (req: Request, res: Response) => {
  try {
    const merchantPubkey = req.user?.pubkey || req.body.merchantPubkey || '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { nameEn, nameHa, priceNgn, category, stockCount } = req.body;

    if (!nameEn || !priceNgn) {
      res.status(400).json({ success: false, error: 'Both nameEn and priceNgn are required.' });
      return;
    }

    const item = PosService.addCatalogItem(merchantPubkey, {
      nameEn,
      nameHa,
      priceNgn,
      category,
      stockCount
    });

    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/order', optionalAuth, (req: Request, res: Response) => {
  try {
    const merchantPubkey = req.user?.pubkey || req.body.merchantPubkey || '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { items, totalNgn, totalSats, paymentMethod } = req.body;

    if (!Array.isArray(items) || !totalSats) {
      res.status(400).json({ success: false, error: 'Valid items array and totalSats are required.' });
      return;
    }

    const order = PosService.createOrder(merchantPubkey, {
      items,
      totalNgn: totalNgn || (totalSats * 1.45),
      totalSats,
      paymentMethod
    });

    res.json({ success: true, data: order });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/order/:id/settle', (req: Request, res: Response) => {
  try {
    const { proofSecrets } = req.body;
    const settled = PosService.settleOrder(req.params.id, proofSecrets);
    res.json({ success: true, data: settled });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
