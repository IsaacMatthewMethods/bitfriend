import { Router, Request, Response } from 'express';
import { AdashiService } from '../services/adashiService.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/circles', (_req: Request, res: Response) => {
  try {
    const circles = AdashiService.listCircles();
    res.json({ success: true, data: circles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/circles/:id', (req: Request, res: Response) => {
  try {
    const details = AdashiService.getCircleDetails(req.params.id);
    res.json({ success: true, data: details });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message });
  }
});

router.post('/circles', optionalAuth, (req: Request, res: Response) => {
  try {
    const creatorPubkey = req.user?.pubkey || req.body.creatorPubkey || '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { title, description, cycleType, contributionSats, contributionNgn, maxRounds, creatorAlias } = req.body;

    if (!title || !contributionSats || !maxRounds) {
      res.status(400).json({ success: false, error: 'Missing title, contributionSats, or maxRounds.' });
      return;
    }

    const circle = AdashiService.createCircle(creatorPubkey, {
      title,
      description,
      cycleType: cycleType || 'WEEKLY',
      contributionSats,
      contributionNgn: contributionNgn || (contributionSats * 1.45),
      maxRounds,
      creatorAlias
    });

    res.json({ success: true, data: circle });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/circles/:id/join', optionalAuth, (req: Request, res: Response) => {
  try {
    const userPubkey = req.user?.pubkey || req.body.userPubkey || '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { memberAlias } = req.body;

    const updated = AdashiService.joinCircle(req.params.id, userPubkey, memberAlias || 'Community Member');
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/circles/:id/contribute', optionalAuth, (req: Request, res: Response) => {
  try {
    const memberPubkey = req.user?.pubkey || req.body.memberPubkey || '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { amountSats, proofSecret } = req.body;

    if (!amountSats) {
      res.status(400).json({ success: false, error: 'amountSats is required.' });
      return;
    }

    const updated = AdashiService.contributeRound(req.params.id, memberPubkey, amountSats, proofSecret);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/circles/:id/payout', optionalAuth, (req: Request, res: Response) => {
  try {
    const organizerPubkey = req.user?.pubkey || req.body.organizerPubkey || '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const result = AdashiService.disburseRoundPayout(req.params.id, organizerPubkey);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
