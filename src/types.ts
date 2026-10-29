export type Language = 'en' | 'ha';

export interface CashuProof {
  id: string;
  amount: number; // satoshis (power of 2)
  secret: string;
  C: string; // blind signature
  reserved?: boolean;
}

export interface CashuTokenPayload {
  token: Array<{
    mint: string;
    proofs: CashuProof[];
  }>;
  memo?: string;
}

export interface PaymentTransaction {
  id: string;
  timestamp: number;
  type: 'incoming' | 'outgoing';
  amountSats: number;
  amountNgn: number;
  memo: string;
  status: 'settled' | 'pending';
  method: 'cashu' | 'lightning';
  offline: boolean;
  tokenString?: string;
}

export interface AdashiMember {
  id: string;
  name: string;
  location: string;
  avatar: string;
  hasContributed: boolean;
  turnOrder: number;
  isCurrentRecipient: boolean;
}

export interface AdashiCircle {
  id: string;
  name: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  contributionSats: number;
  members: AdashiMember[];
  currentRound: number;
  totalRounds: number;
  nextPayoutDate: string;
}

// BitChat Social Messenger Data Models
export interface InlinePaymentPayload {
  amountSats: number;
  amountNgn: number;
  tokenString: string;
  mintUrl: string;
  memo?: string;
  status: 'pending' | 'claimed' | 'expired';
  claimedAt?: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string; // 'me' | contactId
  senderName: string;
  text?: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'offline_queued';
  payment?: InlinePaymentPayload;
  audioNoteUrl?: string;
  audioDurationSec?: number;
}

export interface ChatContact {
  id: string;
  name: string;
  phoneOrHandle: string; // "+234 803 123 4567" or "aminu@bitfriend.me"
  avatar: string;
  role?: string;
  lastSeen?: string;
  isOnline?: boolean;
  lightningAddress?: string;
  nostrNpub?: string;
  unreadCount: number;
  lastMessage?: {
    text: string;
    timestamp: number;
    isPayment?: boolean;
    amountSats?: number;
  };
}
