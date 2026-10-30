import { Router, Request, Response } from 'express';
import { LightningService } from '../services/lightningService.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// LUD-16 LNURL-pay Callback: GET /api/v1/lightning/lnurlp/:username/callback?amount=<msats>
router.get('/lnurlp/:username/callback', async (req: Request, res: Response) => {
  try {
    const username = req.params.username;
    const amountMsats = Number(req.query.amount || 0);
    const comment = req.query.comment as string | undefined;

    const result = await LightningService.createLnurlCallbackInvoice(username, amountMsats, comment);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ status: 'ERROR', reason: err.message });
  }
});

// Create BOLT-11 Invoice
router.post('/invoice', optionalAuth, async (req: Request, res: Response) => {
  try {
    const pubkey =
      req.user?.pubkey ||
      req.body.pubkey ||
      '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { amountSats, memo } = req.body;

    const inv = await LightningService.createInvoice(pubkey, Number(amountSats), memo);
    res.json({ success: true, data: inv });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Decode BOLT-11 Invoice
router.post('/decode', (req: Request, res: Response) => {
  try {
    const { bolt11 } = req.body;
    if (!bolt11) {
      res.status(400).json({ success: false, error: 'bolt11 string is required.' });
      return;
    }

    const decoded = LightningService.decodeBolt11(bolt11);
    res.json({ success: true, data: decoded });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Check Invoice Status by paymentHash
router.get('/invoice/:paymentHash', (req: Request, res: Response) => {
  try {
    const status = LightningService.getInvoiceStatus(req.params.paymentHash);
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// Settle Invoice by paymentHash (Webhook / Instant Settlement)
router.post('/invoice/:paymentHash/settle', (req: Request, res: Response) => {
  try {
    const settled = LightningService.settleInvoice(req.params.paymentHash);
    res.json({ success: true, data: settled });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Pay Outbound BOLT-11 Invoice or Lightning Address (NUT-05 Melt / L2 Send)
router.post('/pay', optionalAuth, async (req: Request, res: Response) => {
  try {
    const pubkey =
      req.user?.pubkey ||
      req.body.pubkey ||
      '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { destination, amountSats, proofSecrets } = req.body;

    if (!destination) {
      res.status(400).json({
        success: false,
        error: 'destination (BOLT-11 invoice or Lightning Address) is required.',
      });
      return;
    }

    const result = await LightningService.payOutbound(
      pubkey,
      destination,
      amountSats ? Number(amountSats) : undefined,
      proofSecrets
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;

