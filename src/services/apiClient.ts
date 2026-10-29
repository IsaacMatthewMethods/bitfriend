/**
 * BitFriend Commercial API Client
 * Seamlessly interfaces with local SQLite Enterprise Node (/api/v1)
 * with automatic fallback to offline IndexedDB when offline.
 */

const API_BASE = '/api/v1';

export class ApiClient {
  private static token: string | null = null;
  private static isServerOnline = false;

  static setAuthToken(token: string) {
    this.token = token;
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
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2500) });
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

    const res = await fetch(`${API_BASE}${endpoint}`, {
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

  static async authenticatePin(pubkey: string, pin: string): Promise<{ user: any; token: string }> {
    const res = await this.request<{ user: any; token: string }>('/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pubkey, pin }),
    });
    this.token = res.token;
    return res;
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

  // --- Wallet Proof Registry & Transactions ---
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
}
