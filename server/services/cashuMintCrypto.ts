import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { db } from '../db/database.js';

export const DENOMINATIONS = [
  1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072,
];

const CURVE_N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

export interface MintKeysetRecord {
  id: string;
  unit: string;
  active: number;
  privkeys: Record<number, string>;
  pubkeys: Record<number, string>;
}

/**
 * NUT-00 Deterministic Hash-to-Curve (Y = hash_to_curve(secret)) on secp256k1.
 */
export function hashToCurve(secret: string): { pointHex: string; x: string; y: string } {
  const enc = new TextEncoder();
  let counter = 0;

  while (counter < 256) {
    const input = enc.encode(`Secp256k1_HashToCurve_Cashu_${secret}_${counter}`);
    const digestHex = bytesToHex(sha256(input));

    for (const prefix of ['02', '03']) {
      try {
        const pt = secp256k1.Point.fromHex(`${prefix}${digestHex}`);
        pt.assertValidity();
        return {
          pointHex: pt.toHex(true),
          x: pt.x.toString(16),
          y: pt.y.toString(16),
        };
      } catch {
        // try next prefix or counter
      }
    }
    counter++;
  }

  const base = secp256k1.Point.BASE;
  return {
    pointHex: base.toHex(true),
    x: base.x.toString(16),
    y: base.y.toString(16),
  };
}

function hexToValidScalar(hexStr: string): bigint {
  const clean = hexStr.replace(/^0x/i, '');
  const raw = BigInt(`0x${clean}`);
  const modded = raw % (CURVE_N - 1n);
  return modded === 0n ? 1n : modded;
}

/**
 * Alice Step 1 (NUT-00): Blind secret Y with blinding factor r: B_ = Y + r * G
 */
export function blindMessage(secret: string, rHex?: string): { B_: string; rHex: string; Y: string } {
  const actualRHex = rHex || bytesToHex(secp256k1.utils.randomSecretKey());
  const rScalar = hexToValidScalar(actualRHex);
  const { pointHex: yHex } = hashToCurve(secret);
  const YPoint = secp256k1.Point.fromHex(yHex);
  const rG = secp256k1.Point.BASE.multiply(rScalar);
  const B_Point = YPoint.add(rG);

  return {
    B_: B_Point.toHex(true),
    rHex: actualRHex,
    Y: yHex,
  };
}

/**
 * Mint Step 2 (NUT-00): Sign blinded message B_ with denomination private key k: C_ = k * B_
 */
export function signBlindedMessage(B_Hex: string, kPrivHex: string): string {
  const B_Point = secp256k1.Point.fromHex(B_Hex);
  B_Point.assertValidity();
  const kScalar = hexToValidScalar(kPrivHex);
  const C_Point = B_Point.multiply(kScalar);
  return C_Point.toHex(true);
}

/**
 * Alice Step 3 (NUT-00): Unblind signature C_ using r and Mint public key K: C = C_ - r * K
 */
export function unblindSignature(C_Hex: string, rHex: string, KPubHex: string): string {
  const C_Point = secp256k1.Point.fromHex(C_Hex);
  const KPoint = secp256k1.Point.fromHex(KPubHex);
  const rScalar = hexToValidScalar(rHex);
  const rK = KPoint.multiply(rScalar);
  const CPoint = C_Point.add(rK.negate());
  return CPoint.toHex(true);
}

/**
 * Mint Step 4 (NUT-00): Verify unblinded proof (secret, C) using denomination private key k:
 * Checks C == k * hash_to_curve(secret).
 */
export function verifyBdhkeProof(secret: string, C_Hex: string, kPrivHex: string): boolean {
  try {
    const { pointHex: yHex } = hashToCurve(secret);
    const YPoint = secp256k1.Point.fromHex(yHex);
    const kScalar = hexToValidScalar(kPrivHex);
    const expectedCPoint = YPoint.multiply(kScalar);
    return expectedCPoint.toHex(true).toLowerCase() === C_Hex.trim().toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Ensures an active Cashu Mint keyset exists in SQLite `mint_keysets` and returns it.
 * Keyset keys are deterministically seeded if none exist yet so tokens remain verifiable across restarts.
 */
export function getOrInitActiveMintKeyset(): MintKeysetRecord {
  const existing = db
    .prepare('SELECT id, unit, active, privkeys_json, pubkeys_json FROM mint_keysets WHERE active = 1 LIMIT 1')
    .get() as { id: string; unit: string; active: number; privkeys_json: string; pubkeys_json: string } | undefined;

  if (existing) {
    return {
      id: existing.id,
      unit: existing.unit,
      active: existing.active,
      privkeys: JSON.parse(existing.privkeys_json),
      pubkeys: JSON.parse(existing.pubkeys_json),
    };
  }

  const masterSeed = process.env.CASHU_MINT_MASTER_KEY || 'bitfriend_production_mint_master_seed_2026_v1';
  const enc = new TextEncoder();
  const privkeys: Record<number, string> = {};
  const pubkeys: Record<number, string> = {};

  const concatPubkeys: number[] = [];
  for (const amt of DENOMINATIONS) {
    const privBytes = sha256(enc.encode(`${masterSeed}:sat:${amt}`));
    const privHex = bytesToHex(privBytes);
    const pubBytes = secp256k1.getPublicKey(hexToBytes(privHex), true);
    const pubHex = bytesToHex(pubBytes);
    privkeys[amt] = privHex;
    pubkeys[amt] = pubHex;
    concatPubkeys.push(...pubBytes);
  }

  // NUT-02 Keyset ID: 00 + first 14 hex chars of SHA-256(concatenated pubkeys)
  const keysetHashHex = bytesToHex(sha256(new Uint8Array(concatPubkeys)));
  const keysetId = `00${keysetHashHex.slice(0, 14)}`;

  db.prepare(`
    INSERT INTO mint_keysets (id, unit, active, privkeys_json, pubkeys_json, created_at)
    VALUES (?, 'sat', 1, ?, ?, ?)
  `).run(keysetId, JSON.stringify(privkeys), JSON.stringify(pubkeys), Date.now());

  return {
    id: keysetId,
    unit: 'sat',
    active: 1,
    privkeys,
    pubkeys,
  };
}

/**
 * Mints a fully valid BDHKE-signed Cashu proof for a given power-of-2 denomination.
 */
export function createSignedMintProof(amount: number, customSecret?: string): {
  id: string;
  amount: number;
  secret: string;
  C: string;
} {
  const keyset = getOrInitActiveMintKeyset();
  const kPrivHex = keyset.privkeys[amount] || keyset.privkeys[1];
  const KPubHex = keyset.pubkeys[amount] || keyset.pubkeys[1];

  const secret =
    customSecret || `bf_nut00_${amount}_${bytesToHex(secp256k1.utils.randomSecretKey()).slice(0, 32)}`;
  const { B_, rHex } = blindMessage(secret);
  const C_ = signBlindedMessage(B_, kPrivHex);
  const C = unblindSignature(C_, rHex, KPubHex);

  return {
    id: keyset.id,
    amount,
    secret,
    C,
  };
}
