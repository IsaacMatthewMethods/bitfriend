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
