import { Router, Request, Response } from 'express';
import { CashuProofService } from '../services/cashuProofService.js';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/database.js';

const router = Router();

// NUT-01 / NUT-02: Active Mint Keyset Public Keys
router.get('/mint/keys', (_req: Request, res: Response) => {
  try {
    const data = CashuProofService.getMintKeysetPublic();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// NUT-04: Blind signature issuance on blinded outputs
router.post('/mint/issue', optionalAuth, (req: Request, res: Response) => {
  try {
    const { outputs } = req.body;
    if (!Array.isArray(outputs) || outputs.length === 0) {
      res.status(400).json({ success: false, error: 'Outputs array of BlindedMessages is required.' });
      return;
    }

    const signatures = CashuProofService.issueBlindSignatures(outputs);
    res.json({ success: true, data: { signatures } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// NUT-03: Atomic Split / Swap (burns input proofs, signs output BlindedMessages)
router.post('/swap', optionalAuth, (req: Request, res: Response) => {
  try {
    const pubkey = req.user?.pubkey || req.body.pubkey;
    const { inputs, outputs } = req.body;

    const result = CashuProofService.swapProofs(inputs, outputs, pubkey);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Atomic Token Claim: burns incoming proofs and issues fresh BDHKE-signed proofs
router.post('/claim', optionalAuth, (req: Request, res: Response) => {
  try {
    const pubkey =
      req.user?.pubkey ||
      req.body.pubkey ||
      '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { proofs, mintUrl } = req.body;

    if (!Array.isArray(proofs) || proofs.length === 0) {
      res.status(400).json({ success: false, error: 'Incoming Cashu proofs array is required.' });
      return;
    }

    const result = CashuProofService.claimProofsAtomic(pubkey, proofs, mintUrl);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/balance', optionalAuth, (req: Request, res: Response) => {
  try {
    const pubkey =
      req.user?.pubkey ||
      (req.query.pubkey as string) ||
      '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const wallet = db.prepare('SELECT * FROM wallets WHERE user_pubkey = ?').get(pubkey) as any;
    const ecashBalance = CashuProofService.getUnspentBalance(pubkey);

    res.json({
      success: true,
      data: {
        pubkey,
        balanceSats: (wallet?.balance_sats || 0) || ecashBalance,
        ecashBalanceSats: ecashBalance,
        activeMintUrl: wallet?.active_mint_url || 'https://mint.minibits.cash/Bitcoin',
        defaultCurrency: wallet?.default_currency || 'NGN',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/proofs/sync', optionalAuth, (req: Request, res: Response) => {
  try {
    const pubkey =
      req.user?.pubkey ||
      req.body.pubkey ||
      '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { mintUrl, proofs } = req.body;

    if (!Array.isArray(proofs)) {
      res.status(400).json({ success: false, error: 'Proofs must be an array of Cashu proof objects.' });
      return;
    }

    const result = CashuProofService.registerProofs(
      pubkey,
      mintUrl || 'https://mint.minibits.cash/Bitcoin',
      proofs
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/proofs/check', (req: Request, res: Response) => {
  try {
    const { secrets } = req.body;
    if (!Array.isArray(secrets)) {
      res.status(400).json({ success: false, error: 'Secrets must be an array of proof secret strings.' });
      return;
    }

    const states = CashuProofService.checkProofStates(secrets);
    res.json({ success: true, data: states });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
