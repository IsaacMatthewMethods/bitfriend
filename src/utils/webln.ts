// WebLN Standard Protocol Interface & Provider Detection

export interface WebLNProvider {
  enable: () => Promise<void>;
  getInfo?: () => Promise<{ node: { alias: string; pubkey: string } }>;
  sendPayment: (paymentRequest: string) => Promise<{ preimage: string }>;
  makeInvoice?: (args: { amount: number; defaultMemo?: string }) => Promise<{ paymentRequest: string }>;
}

declare global {
  interface Window {
    webln?: WebLNProvider;
  }
}

export function isWebLNAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.webln);
}

export async function requestWebLNPayment(bolt11Invoice: string): Promise<{ success: boolean; preimage?: string; error?: string }> {
  if (!isWebLNAvailable() || !window.webln) {
    return { success: false, error: 'No WebLN wallet provider (e.g. Alby, Blink) detected in this browser.' };
  }

  try {
    await window.webln.enable();
    const result = await window.webln.sendPayment(bolt11Invoice);
    return { success: true, preimage: result.preimage };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'WebLN payment rejected or failed';
    return { success: false, error: message };
  }
}
