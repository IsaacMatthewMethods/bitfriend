/**
 * BitFriend Commercial API Client
 * Seamlessly interfaces with local SQLite Enterprise Node (/api/v1)
 * with automatic fallback to offline IndexedDB when offline.
 */

const DEFAULT_API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || '/api/v1';
const STORAGE_API_BASE_KEY = 'bitfriend_api_base_url';
const STORAGE_JWT_KEY = 'bitfriend_jwt_token';

export class ApiClient {
  private static token: string | null = (() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_JWT_KEY) : null;
    } catch {
      return null;
    }
  })();
  private static isServerOnline = false;

  static getBaseUrl(): string {
    try {
      if (typeof localStorage !== 'undefined') {
        const custom = localStorage.getItem(STORAGE_API_BASE_KEY);
        if (custom && custom.trim()) {
          return custom.trim().replace(/\/+$/, '');
        }
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_API_BASE;
  }

  static setBaseUrl(url: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const cleaned = url.trim().replace(/\/+$/, '');
        if (!cleaned || cleaned === '/api/v1') {
          localStorage.removeItem(STORAGE_API_BASE_KEY);
        } else {
          localStorage.setItem(STORAGE_API_BASE_KEY, cleaned.endsWith('/api/v1') ? cleaned : `${cleaned}/api/v1`);
        }
      }
    } catch {
      // ignore
    }
  }

  static setAuthToken(token: string | null) {
    this.token = token;
    try {
      if (typeof localStorage !== 'undefined') {
        if (token) {
          localStorage.setItem(STORAGE_JWT_KEY, token);
        } else {
          localStorage.removeItem(STORAGE_JWT_KEY);
        }
      }
    } catch {
      // ignore
    }
  }

  static getAuthToken(): string | null {
    return this.token;
  }

  static getIsServerOnline(): boolean {
    return this.isServerOnline;
  }

  /**
   * Health check to detect if the local backend node is online.
   */
  static async checkHealth(): Promise<{ online: boolean; info?: any }> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/health`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const json = await res.json();
        this.isServerOnline = true;
        return { online: true, info: json };
      }
    } catch {
      this.isServerOnline = false;
    }
    return { online: false };
  }

  /**
   * Universal fetch with authorization headers and timeout.
   */
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.getBaseUrl()}${endpoint}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(6000),
    });

    const json = await res.json();
    if (!res.ok || json.success === false) {
      throw new Error(json.error || `API request failed with status ${res.status}`);
    }

    return json.data as T;
  }

  // --- Auth APIs ---
  static async getChallenge(pubkey: string): Promise<{ nonce: string; expiresAt: number }> {
    return this.request<{ nonce: string; expiresAt: number }>('/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ pubkey }),
    });
  }

  static async verifyChallenge(pubkey: string, signature: string): Promise<{ user: any; token: string }> {
    const res = await this.request<{ user: any; token: string }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ pubkey, signature }),
    });
    this.setAuthToken(res.token);
    this.isServerOnline = true;
    return res;
  }

  static async authenticateWithSchnorr(
    pubkey: string,
    signChallengeFn: (nonce: string) => string | Promise<string>
  ): Promise<{ user: any; token: string }> {
    const { nonce } = await this.getChallenge(pubkey);
    const signature = await signChallengeFn(nonce);
    return this.verifyChallenge(pubkey, signature);
  }

  static async authenticatePin(pubkey: string, pin: string): Promise<{ user: any; token: string }> {
    const res = await this.request<{ user: any; token: string }>('/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pubkey, pin }),
    });
    this.setAuthToken(res.token);
    this.isServerOnline = true;
    return res;
  }

  static async logout(): Promise<{ revoked: boolean }> {
    try {
      const res = await this.request<{ revoked: boolean }>('/auth/logout', {
        method: 'POST',
      });
      this.setAuthToken(null);
      return res;
    } catch {
      this.setAuthToken(null);
      return { revoked: true };
    }
  }

  static async updateProfile(updates: {
    username?: string;
    lightningAddress?: string;
    currency?: string;
  }): Promise<any> {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  static async getProfile(): Promise<any> {
    return this.request('/auth/me');
  }

  // --- Fiat & Banking APIs ---
  static async getFiatRates(): Promise<any> {
    return this.request('/fiat/rates');
  }

  static async getSupportedBanks(): Promise<any[]> {
    return this.request('/fiat/banks');
  }

  static async resolveNuban(bankCode: string, accountNumber: string): Promise<any> {
    return this.request('/fiat/resolve-nuban', {
      method: 'POST',
      body: JSON.stringify({ bankCode, accountNumber }),
    });
  }

  static async createOfframpQuote(satsAmount: number, bankAccountId: string, pubkey?: string): Promise<any> {
    return this.request('/fiat/quote', {
      method: 'POST',
      body: JSON.stringify({ satsAmount, bankAccountId, pubkey }),
    });
  }

  static async settleOfframpQuote(quoteId: string, proofSecrets?: string[]): Promise<any> {
    return this.request('/fiat/settle', {
      method: 'POST',
      body: JSON.stringify({ quoteId, proofSecrets }),
    });
  }

  // --- Adashi Cooperative APIs ---
  static async getAdashiCircles(): Promise<any[]> {
    return this.request('/adashi/circles');
  }

  static async getAdashiCircle(circleId: string): Promise<any> {
    return this.request(`/adashi/circles/${circleId}`);
  }

  static async createAdashiCircle(data: any): Promise<any> {
    return this.request('/adashi/circles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async contributeAdashi(circleId: string, amountSats: number, memberPubkey?: string, proofSecret?: string): Promise<any> {
    return this.request(`/adashi/circles/${circleId}/contribute`, {
      method: 'POST',
      body: JSON.stringify({ amountSats, memberPubkey, proofSecret }),
    });
  }

  static async disburseAdashiPayout(circleId: string, organizerPubkey?: string): Promise<any> {
    return this.request(`/adashi/circles/${circleId}/payout`, {
      method: 'POST',
      body: JSON.stringify({ organizerPubkey }),
    });
  }

  // --- POS Merchant APIs ---
  static async getPosCatalog(merchantPubkey?: string): Promise<any[]> {
    const query = merchantPubkey ? `?merchantPubkey=${merchantPubkey}` : '';
    return this.request(`/pos/catalog${query}`);
  }

  static async addPosItem(item: any, merchantPubkey?: string): Promise<any> {
    return this.request('/pos/catalog', {
      method: 'POST',
      body: JSON.stringify({ ...item, merchantPubkey }),
    });
  }

  static async createPosOrder(orderData: any, merchantPubkey?: string): Promise<any> {
    return this.request('/pos/order', {
      method: 'POST',
      body: JSON.stringify({ ...orderData, merchantPubkey }),
    });
  }

  static async settlePosOrder(orderId: string, proofSecrets?: string[]): Promise<any> {
    return this.request(`/pos/order/${orderId}/settle`, {
      method: 'POST',
      body: JSON.stringify({ proofSecrets }),
    });
  }

  // --- Wallet Proof Registry, Mint Keys, Swap & Claim ---
  static async getMintKeys(): Promise<any> {
    return this.request('/wallet/mint/keys');
  }

  static async swapProofs(
    inputs: any[],
    outputs: Array<{ amount: number; id?: string; B_: string }>,
    pubkey?: string
  ): Promise<{ signatures: Array<{ id: string; amount: number; C_: string }>; burnedCount: number; totalSats: number }> {
    return this.request('/wallet/swap', {
      method: 'POST',
      body: JSON.stringify({ inputs, outputs, pubkey }),
    });
  }

  static async claimProofs(
    proofs: any[],
    mintUrl?: string,
    pubkey?: string
  ): Promise<{ amountSats: number; freshProofs: any[] }> {
    return this.request('/wallet/claim', {
      method: 'POST',
      body: JSON.stringify({ proofs, mintUrl, pubkey }),
    });
  }

  static async syncProofs(proofs: any[], mintUrl?: string, pubkey?: string): Promise<any> {
    return this.request('/wallet/proofs/sync', {
      method: 'POST',
      body: JSON.stringify({ proofs, mintUrl, pubkey }),
    });
  }

  static async checkProofStates(secrets: string[]): Promise<any[]> {
    return this.request('/wallet/proofs/check', {
      method: 'POST',
      body: JSON.stringify({ secrets }),
    });
  }

  static async getTransactions(limit = 50): Promise<any[]> {
    return this.request(`/transactions?limit=${limit}`);
  }

  static async recordTransaction(tx: any): Promise<any> {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(tx),
    });
  }

  // --- Lightning L2 Bridge & LNURL APIs ---
  static async createLightningInvoice(amountSats: number, memo?: string, pubkey?: string): Promise<any> {
    return this.request('/lightning/invoice', {
      method: 'POST',
      body: JSON.stringify({ amountSats, memo, pubkey }),
    });
  }

  static async decodeLightningInvoice(bolt11: string): Promise<any> {
    return this.request('/lightning/decode', {
      method: 'POST',
      body: JSON.stringify({ bolt11 }),
    });
  }

  static async settleLightningInvoice(paymentHash: string): Promise<any> {
    return this.request(`/lightning/invoice/${paymentHash}/settle`, {
      method: 'POST',
    });
  }

  static async payLightningOutbound(
    destination: string,
    amountSats?: number,
    proofSecrets?: string[],
    pubkey?: string
  ): Promise<any> {
    return this.request('/lightning/pay', {
      method: 'POST',
      body: JSON.stringify({ destination, amountSats, proofSecrets, pubkey }),
    });
  }

  // --- BitChat P2P SQLite & Relay APIs ---
  static async getChatContacts(pubkey?: string): Promise<any[]> {
    const query = pubkey ? `?pubkey=${encodeURIComponent(pubkey)}` : '';
    return this.request(`/chat/contacts${query}`);
  }

  static async addChatContact(data: {
    name: string;
    handle?: string;
    role?: string;
    peerPubkey?: string;
    ownerPubkey?: string;
  }): Promise<any> {
    return this.request('/chat/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getChatMessages(peerId: string, pubkey?: string): Promise<any[]> {
    const query = pubkey ? `?pubkey=${encodeURIComponent(pubkey)}` : '';
    return this.request(`/chat/messages/${encodeURIComponent(peerId)}${query}`);
  }

  static async sendChatMessage(data: {
    id?: string;
    senderPubkey?: string;
    recipientPubkey: string;
    text: string;
    cashuToken?: string;
    cashuAmountSats?: number;
  }): Promise<any> {
    return this.request('/chat/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async markChatVoucherClaimed(messageId: string): Promise<any> {
    return this.request(`/chat/messages/${encodeURIComponent(messageId)}/claim`, {
      method: 'POST',
    });
  }

  static getWebSocketUrl(): string {
    const base = this.getBaseUrl();
    if (base.startsWith('http://') || base.startsWith('https://')) {
      const wsBase = base.replace(/^http/i, 'ws').replace(/\/api\/v1\/?$/, '');
      return `${wsBase}/ws`;
    }
    if (typeof window !== 'undefined') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' ? 'localhost:4000' : window.location.host;
      return `${proto}//${host}/ws`;
    }
    return 'ws://localhost:4000/ws';
  }
}
