import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/challenge', (req: Request, res: Response) => {
  try {
    const { pubkey } = req.body;
    if (!pubkey || typeof pubkey !== 'string') {
      res.status(400).json({ success: false, error: 'Public key string is required.' });
      return;
    }

    const challenge = AuthService.createChallenge(pubkey);
    res.json({ success: true, data: challenge });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/verify', (req: Request, res: Response) => {
  try {
    const { pubkey, signature } = req.body;
    if (!pubkey || !signature) {
      res.status(400).json({ success: false, error: 'Both pubkey and signature are required.' });
      return;
    }

    const deviceInfo = req.headers['user-agent'] || 'BitFriend Client';
    const result = AuthService.authenticateWithPubkey(pubkey, signature, deviceInfo);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(401).json({ success: false, error: err.message });
  }
});

router.post('/pin', (req: Request, res: Response) => {
  try {
    const { pubkey, pin } = req.body;
    if (!pubkey || !pin) {
      res.status(400).json({ success: false, error: 'Both pubkey and 6-digit pin are required.' });
      return;
    }

    const deviceInfo = req.headers['user-agent'] || 'BitFriend PIN Client';
    const result = AuthService.authenticateWithPin(pubkey, pin, deviceInfo);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(401).json({ success: false, error: err.message });
  }
});

router.post('/logout', requireAuth, (req: Request, res: Response) => {
  try {
    const result = AuthService.logoutSession(req.rawToken, req.user?.pubkey);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/profile', requireAuth, (req: Request, res: Response) => {
  try {
    const { username, lightningAddress, currency } = req.body;
    const updated = AuthService.updateProfile(req.user!.pubkey, {
      username,
      lightningAddress,
      currency,
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  try {
    const profile = AuthService.getProfile(req.user!.pubkey);
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
