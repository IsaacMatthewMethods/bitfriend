import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { SocketServer } from '../ws/socketServer.js';

export interface ChatContactRow {
  id: string;
  owner_pubkey: string;
  peer_pubkey: string;
  peer_name: string;
  peer_role: string;
  lightning_address: string;
  created_at: number;
}

export interface ChatMessageRow {
  id: string;
  sender_pubkey: string;
  recipient_pubkey: string;
  text: string;
  cashu_token: string | null;
  cashu_amount_sats: number;
  status: string;
  is_claimed: number;
  created_at: number;
}

const DEFAULT_MERCHANT_PEERS = [
  {
    id: 'contact_garba_kano',
    peerPubkey: '034f59c8bcda9132204c3f58a364bbbf03046f8aa1805b225f693ff683058869c9',
    peerName: 'Malam Garba (Kano Grains)',
    peerRole: 'Grain Wholesaler • Dawanau Market',
    lightningAddress: 'garba@bitfriend.me',
    welcomeText: 'Sannu! Have the 50kg bags of rice arrived? Send the Cashu voucher here when ready.',
  },
  {
    id: 'contact_amina_textiles',
    peerPubkey: '028913b45fead48f72a44bb4a5f829ec34c44249a2a30bb0683041c2c310c85c27',
    peerName: 'Hajiya Amina Textiles',
    peerRole: 'Shadda & Brocade Supplier • Kantin Kwari',
    lightningAddress: 'amina@bitfriend.me',
    welcomeText: 'Barkanku! Your 10-yard brocade order is packed and ready for dispatch.',
  },
  {
    id: 'contact_ibrahim_pos',
    peerPubkey: '02c0b58e23f815ea7e20b33418579cfc4623315a6b0743b17926b01b6782553b6a',
    peerName: 'Ibrahim POS & Cash Point',
    peerRole: 'Liquidity Agent • Sabon Gari',
    lightningAddress: 'ibrahim@bitfriend.me',
    welcomeText: 'Liquidity desk online — instant NGN bank settlement available for your sats.',
  },
];

export class ChatService {
  /**
   * Ensures initial contacts & welcome messages exist in SQLite for this user, then returns all contacts.
   */
  static getContacts(ownerPubkey: string) {
    const cleanOwner = ownerPubkey.trim().toLowerCase();
    const countRow = db
      .prepare('SELECT COUNT(*) as count FROM chat_contacts WHERE owner_pubkey = ?')
      .get(cleanOwner) as { count: number };

    const now = Date.now();
    if (countRow.count === 0) {
      const insertContact = db.prepare(`
        INSERT OR IGNORE INTO chat_contacts (id, owner_pubkey, peer_pubkey, peer_name, peer_role, lightning_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const insertMsg = db.prepare(`
        INSERT OR IGNORE INTO chat_messages (id, sender_pubkey, recipient_pubkey, text, cashu_token, cashu_amount_sats, status, is_claimed, created_at)
        VALUES (?, ?, ?, ?, NULL, 0, 'DELIVERED', 0, ?)
      `);

      for (const peer of DEFAULT_MERCHANT_PEERS) {
        const cid = `${peer.id}_${cleanOwner.slice(0, 8)}`;
        insertContact.run(
          cid,
          cleanOwner,
          peer.peerPubkey,
          peer.peerName,
          peer.peerRole,
          peer.lightningAddress,
          now - 3600_000
        );
        insertMsg.run(
          `msg_seed_${peer.id}_${cleanOwner.slice(0, 8)}`,
          peer.peerPubkey,
          cleanOwner,
          peer.welcomeText,
          now - 1800_000
        );
      }
    }

    const rows = db
      .prepare('SELECT * FROM chat_contacts WHERE owner_pubkey = ? ORDER BY created_at DESC')
      .all(cleanOwner) as ChatContactRow[];

    return rows.map((r) => {
      const lastMsg = db
        .prepare(
          `SELECT text, created_at FROM chat_messages
           WHERE (sender_pubkey = ? AND recipient_pubkey = ?)
              OR (sender_pubkey = ? AND recipient_pubkey = ?)
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(cleanOwner, r.peer_pubkey, r.peer_pubkey, cleanOwner) as
        | { text: string; created_at: number }
        | undefined;

      const initials =
        r.peer_name
          .split(' ')
          .map((p) => p[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'BF';

      return {
        id: r.id,
        name: r.peer_name,
        phoneOrHandle: r.lightning_address || r.peer_pubkey.slice(0, 16),
        nostrNpub: r.peer_pubkey,
        avatar: initials,
        role: r.peer_role,
        lastSeen: 'Online',
        isOnline: true,
        lightningAddress: r.lightning_address,
        unreadCount: 0,
        lastMessage: lastMsg
          ? { text: lastMsg.text, timestamp: lastMsg.created_at }
          : { text: 'BitChat P2P Channel Active', timestamp: r.created_at },
      };
    });
  }

  /**
   * Adds a new contact to SQLite `chat_contacts`.
   */
  static addContact(
    ownerPubkey: string,
    payload: {
      name: string;
      handle?: string;
      role?: string;
      peerPubkey?: string;
    }
  ) {
    const cleanOwner = ownerPubkey.trim().toLowerCase();
    const now = Date.now();
    const peerPubkey =
      payload.peerPubkey?.trim().toLowerCase() ||
      '02' + crypto.createHash('sha256').update(payload.name + (payload.handle || '')).digest('hex');
    const lnAddress =
      payload.handle && payload.handle.includes('@')
        ? payload.handle.trim()
        : `${payload.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@bitfriend.me`;
    const id = 'cnt_' + crypto.randomBytes(8).toString('hex');

    db.prepare(`
      INSERT OR REPLACE INTO chat_contacts (id, owner_pubkey, peer_pubkey, peer_name, peer_role, lightning_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      cleanOwner,
      peerPubkey,
      payload.name.trim(),
      payload.role?.trim() || 'Merchant Associate',
      lnAddress,
      now
    );

    const initials =
      payload.name
        .trim()
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'BF';

    return {
      id,
      name: payload.name.trim(),
      phoneOrHandle: payload.handle?.trim() || lnAddress,
      nostrNpub: peerPubkey,
      avatar: initials,
      role: payload.role?.trim() || 'Merchant Associate',
      lastSeen: 'Just now',
      isOnline: true,
      lightningAddress: lnAddress,
      unreadCount: 0,
      lastMessage: {
        text: 'Contact added to BitChat.',
        timestamp: now,
      },
    };
  }

  /**
   * Retrieves the conversation message history between `ownerPubkey` and `peerPubkey` from SQLite.
   */
  static getMessages(ownerPubkey: string, peerPubkeyOrContactId: string) {
    const cleanOwner = ownerPubkey.trim().toLowerCase();
    let peerPubkey = peerPubkeyOrContactId.trim().toLowerCase();

    // If contact.id was passed instead of raw pubkey, resolve it from chat_contacts
    const contactRow = db
      .prepare('SELECT peer_pubkey, peer_name FROM chat_contacts WHERE id = ? OR peer_pubkey = ? LIMIT 1')
      .get(peerPubkeyOrContactId, peerPubkey) as { peer_pubkey: string; peer_name: string } | undefined;

    if (contactRow) {
      peerPubkey = contactRow.peer_pubkey;
    }

    const rows = db
      .prepare(
        `SELECT * FROM chat_messages
         WHERE (sender_pubkey = ? AND recipient_pubkey = ?)
            OR (sender_pubkey = ? AND recipient_pubkey = ?)
         ORDER BY created_at ASC`
      )
      .all(cleanOwner, peerPubkey, peerPubkey, cleanOwner) as ChatMessageRow[];

    return rows.map((m) => {
      const isMe = m.sender_pubkey === cleanOwner;
      return {
        id: m.id,
        conversationId: peerPubkeyOrContactId,
        senderId: isMe ? 'me' : peerPubkey,
        senderName: isMe ? 'You' : contactRow?.peer_name || 'Merchant Peer',
        text: m.text,
        timestamp: m.created_at,
        status: 'delivered' as const,
        payment: m.cashu_token
          ? {
              tokenString: m.cashu_token,
              amountSats: m.cashu_amount_sats,
              amountNgn: Math.round(m.cashu_amount_sats * 1.585),
              memo: m.text,
              status: m.is_claimed ? ('claimed' as const) : ('pending' as const),
              mintUrl: 'https://mint.bitfriend.me',
            }
          : undefined,
      };
    });
  }

  /**
   * Persists a P2P chat message (or inline Cashu bearer voucher) in SQLite
   * and broadcasts it immediately over WebSocket (`chat:message` channel).
   */
  static sendMessage(payload: {
    id?: string;
    senderPubkey: string;
    recipientPubkey: string;
    text: string;
    cashuToken?: string;
    cashuAmountSats?: number;
  }) {
    const cleanSender = payload.senderPubkey.trim().toLowerCase();
    let cleanRecipient = payload.recipientPubkey.trim().toLowerCase();

    // Resolve contact ID to peer_pubkey if needed
    const contactRow = db
      .prepare('SELECT peer_pubkey FROM chat_contacts WHERE id = ? LIMIT 1')
      .get(payload.recipientPubkey) as { peer_pubkey: string } | undefined;
    if (contactRow) {
      cleanRecipient = contactRow.peer_pubkey;
    }

    const id = payload.id || 'msg_' + crypto.randomBytes(8).toString('hex');
    const now = Date.now();
    const cashuToken = payload.cashuToken || null;
    const cashuAmountSats = Number(payload.cashuAmountSats || 0);

    db.prepare(`
      INSERT OR REPLACE INTO chat_messages (id, sender_pubkey, recipient_pubkey, text, cashu_token, cashu_amount_sats, status, is_claimed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'DELIVERED', 0, ?)
    `).run(id, cleanSender, cleanRecipient, payload.text, cashuToken, cashuAmountSats, now);

    const record = {
      id,
      senderPubkey: cleanSender,
      recipientPubkey: cleanRecipient,
      text: payload.text,
      cashuToken,
      cashuAmountSats,
      status: 'DELIVERED',
      isClaimed: false,
      createdAt: now,
    };

    // Real-time WebSocket relay broadcast
    SocketServer.broadcastToChannel('chat:messages', {
      event: 'chat_message',
      channel: 'chat:messages',
      data: record,
    });

    return record;
  }

  /**
   * Marks an inline Cashu chat voucher as claimed in SQLite and broadcasts update over WebSocket.
   */
  static markVoucherClaimed(messageId: string, claimerPubkey?: string) {
    db.prepare('UPDATE chat_messages SET is_claimed = 1, status = ? WHERE id = ?').run(
      'CLAIMED',
      messageId
    );

    SocketServer.broadcastToChannel('chat:messages', {
      event: 'voucher_claimed',
      channel: 'chat:messages',
      data: { messageId, claimerPubkey, claimedAt: Date.now() },
    });

    return { messageId, claimed: true };
  }
}
