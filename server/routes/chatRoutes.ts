import { Router, Request, Response } from 'express';
import { ChatService } from '../services/chatService.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Get user's BitChat contacts from SQLite
router.get('/contacts', optionalAuth, (req: Request, res: Response) => {
  try {
    const pubkey =
      req.user?.pubkey ||
      (req.query.pubkey as string) ||
      '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';

    const contacts = ChatService.getContacts(pubkey);
    res.json({ success: true, data: contacts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add a new BitChat contact
router.post('/contacts', optionalAuth, (req: Request, res: Response) => {
  try {
    const pubkey =
      req.user?.pubkey ||
      req.body.ownerPubkey ||
      '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { name, handle, role, peerPubkey } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'Contact name is required.' });
      return;
    }

    const contact = ChatService.addContact(pubkey, { name, handle, role, peerPubkey });
    res.json({ success: true, data: contact });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get messages between owner and a specific contact / peerPubkey
router.get('/messages/:peerId', optionalAuth, (req: Request, res: Response) => {
  try {
    const pubkey =
      req.user?.pubkey ||
      (req.query.pubkey as string) ||
      '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';

    const messages = ChatService.getMessages(pubkey, req.params.peerId);
    res.json({ success: true, data: messages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send a P2P chat message or embedded Cashu voucher
router.post('/messages', optionalAuth, (req: Request, res: Response) => {
  try {
    const senderPubkey =
      req.user?.pubkey ||
      req.body.senderPubkey ||
      '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const { id, recipientPubkey, text, cashuToken, cashuAmountSats } = req.body;

    if (!recipientPubkey || !text) {
      res.status(400).json({ success: false, error: 'recipientPubkey and text are required.' });
      return;
    }

    const msg = ChatService.sendMessage({
      id,
      senderPubkey,
      recipientPubkey,
      text,
      cashuToken,
      cashuAmountSats,
    });
    res.json({ success: true, data: msg });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Mark an inline Cashu chat voucher as claimed
router.post('/messages/:messageId/claim', optionalAuth, (req: Request, res: Response) => {
  try {
    const result = ChatService.markVoucherClaimed(req.params.messageId, req.user?.pubkey);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;

