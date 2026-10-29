import type { CashuProof, PaymentTransaction, AdashiCircle } from '../types';

export interface VaultBackupFile {
  version: string;
  timestamp: number;
  appName: string;
  proofs: CashuProof[];
  transactions: PaymentTransaction[];
  circles: AdashiCircle[];
  checksum: string;
}

export function exportVaultBackupFile(
  proofs: CashuProof[],
  transactions: PaymentTransaction[],
  circles: AdashiCircle[]
): void {
  const backup: VaultBackupFile = {
    version: '1.0.0',
    timestamp: Date.now(),
    appName: 'BitFriend (BitAboki)',
    proofs,
    transactions,
    circles,
    checksum: `bf_${Math.random().toString(36).substring(2, 12)}`,
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bitfriend_vault_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseVaultBackupFile(jsonContent: string): {
  success: boolean;
  data?: {
    proofs: CashuProof[];
    transactions: PaymentTransaction[];
    circles: AdashiCircle[];
  };
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonContent);
    if (!parsed.proofs || !Array.isArray(parsed.proofs)) {
      return { success: false, error: 'Invalid backup file: missing proofs array.' };
    }

    return {
      success: true,
      data: {
        proofs: parsed.proofs,
        transactions: parsed.transactions || [],
        circles: parsed.circles || [],
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid JSON file';
    return { success: false, error: msg };
  }
}
