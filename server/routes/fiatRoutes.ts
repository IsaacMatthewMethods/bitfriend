import { Router, Request, Response } from 'express';
import { FiatGatewayService, SUPPORTED_BANKS } from '../services/fiatGatewayService.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/rates', (_req: Request, res: Response) => {
  try {
    const rates = FiatGatewayService.getLiveExchangeRates();
    res.json({ success: true, data: rates });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/banks', (_req: Request, res: Response) => {
  res.json({ success: true, data: SUPPORTED_BANKS });
});

router.post('/resolve-nuban', (req: Request, res: Response) => {
  try {
    const { bankCode, accountNumber } = req.body;
    if (!bankCode || !accountNumber) {
      res.status(400).json({ success: false, error: 'Both bankCode and 10-digit accountNumber are required.' });
      return;
    }

    const resolved = FiatGatewayService.resolveNubanAccount(bankCode, accountNumber);
    res.json({ success: true, data: resolved });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/link-bank', optionalAuth, (req: Request, res: Response) => {
  try {
    const pubkey = req.user?.pubkey || req.body.pubkey || '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { bankCode, accountNumber } = req.body;

    const saved = FiatGatewayService.saveBankAccount(pubkey, bankCode, accountNumber);
    res.json({ success: true, data: saved });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/quote', optionalAuth, (req: Request, res: Response) => {
  try {
    const pubkey = req.user?.pubkey || req.body.pubkey || '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { satsAmount, bankAccountId } = req.body;

    if (!satsAmount) {
      res.status(400).json({ success: false, error: 'satsAmount is required.' });
      return;
    }

    const quote = FiatGatewayService.createOfframpQuote(pubkey, satsAmount, bankAccountId);
    res.json({ success: true, data: quote });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/settle', (req: Request, res: Response) => {
  try {
    const { quoteId, proofSecrets } = req.body;
    if (!quoteId) {
      res.status(400).json({ success: false, error: 'quoteId is required.' });
      return;
    }

    const settlement = FiatGatewayService.settleOfframpQuote(quoteId, proofSecrets);
    res.json({ success: true, data: settlement });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
