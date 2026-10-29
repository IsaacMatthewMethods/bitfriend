-- BitFriend Production SQLite Schema
-- High-Performance Zero-Custody African Commerce & Ecash Ledger

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- 1. Users & Cryptographic Identities
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  pubkey TEXT UNIQUE NOT NULL,
  username TEXT,
  role TEXT DEFAULT 'vendor',
  pin_hash TEXT,
  pin_salt TEXT,
  biometric_credential_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_pubkey ON users(pubkey);

-- 2. Wallets & Mint Bindings
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_pubkey TEXT NOT NULL REFERENCES users(pubkey) ON DELETE CASCADE,
  default_currency TEXT DEFAULT 'NGN',
  active_mint_url TEXT NOT NULL,
  balance_sats INTEGER DEFAULT 0,
  ecash_balance_sats INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallets_user_pubkey ON wallets(user_pubkey);

-- 3. Ecash Proofs & Double-Spend Registry
CREATE TABLE IF NOT EXISTS ecash_proofs (
  id TEXT PRIMARY KEY,
  wallet_id TEXT REFERENCES wallets(id) ON DELETE CASCADE,
  mint_url TEXT NOT NULL,
  keyset_id TEXT NOT NULL,
  amount_sats INTEGER NOT NULL,
  secret TEXT UNIQUE NOT NULL,
  c_hex TEXT NOT NULL,
  status TEXT DEFAULT 'UNSPENT', -- UNSPENT, PENDING_SPEND, SPENT, DESTROYED
  spent_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecash_proofs_secret ON ecash_proofs(secret);
CREATE INDEX IF NOT EXISTS idx_ecash_proofs_status ON ecash_proofs(status);

-- 4. Transactions Ledger & Audit Records
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_pubkey TEXT NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  direction TEXT NOT NULL, -- INCOMING, OUTGOING
  type TEXT NOT NULL, -- CASHU_ECASH, LIGHTNING_INVOICE, FIAT_OFFRAMP, ADASHI_PAYOUT, POS_SALE
  amount_sats INTEGER NOT NULL,
  amount_ngn REAL NOT NULL,
  fee_sats INTEGER DEFAULT 0,
  status TEXT NOT NULL, -- PENDING, SETTLED, FAILED
  memo TEXT,
  counterparty TEXT,
  payment_hash TEXT,
  preimage TEXT,
  proof_count INTEGER DEFAULT 0,
  metadata TEXT, -- JSON blob for flexible payload storage
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_user_pubkey ON transactions(user_pubkey);
CREATE INDEX IF NOT EXISTS idx_tx_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);

-- 5. Adashi Rotating Savings Circles
CREATE TABLE IF NOT EXISTS adashi_circles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  creator_pubkey TEXT NOT NULL,
  cycle_type TEXT NOT NULL, -- DAILY, WEEKLY, MONTHLY
  contribution_sats INTEGER NOT NULL,
  contribution_ngn REAL NOT NULL,
  total_pot_sats INTEGER NOT NULL,
  current_round INTEGER DEFAULT 1,
  max_rounds INTEGER NOT NULL,
  status TEXT DEFAULT 'ACTIVE', -- FORMING, ACTIVE, COMPLETED, DISBANDED
  payout_rule TEXT DEFAULT 'ROTATING_SEQUENTIAL',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 6. Adashi Circle Members & Rotation Orders
CREATE TABLE IF NOT EXISTS adashi_members (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES adashi_circles(id) ON DELETE CASCADE,
  user_pubkey TEXT NOT NULL,
  member_alias TEXT NOT NULL,
  position_order INTEGER NOT NULL,
  round_payout_index INTEGER NOT NULL,
  total_contributed_sats INTEGER DEFAULT 0,
  has_received_payout INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  joined_at INTEGER NOT NULL,
  UNIQUE(circle_id, user_pubkey)
);
CREATE INDEX IF NOT EXISTS idx_adashi_members_circle ON adashi_members(circle_id);

-- 7. Adashi Round Contribution Slips
CREATE TABLE IF NOT EXISTS adashi_contributions (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES adashi_circles(id) ON DELETE CASCADE,
  member_pubkey TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  amount_sats INTEGER NOT NULL,
  proof_secret TEXT,
  status TEXT DEFAULT 'SETTLED',
  created_at INTEGER NOT NULL
);

-- 8. Merchant POS Inventory Catalog
CREATE TABLE IF NOT EXISTS merchant_items (
  id TEXT PRIMARY KEY,
  merchant_pubkey TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ha TEXT,
  price_ngn REAL NOT NULL,
  price_sats INTEGER NOT NULL,
  category TEXT DEFAULT 'General',
  barcode TEXT,
  stock_count INTEGER DEFAULT 100,
  image_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_merchant_items_pubkey ON merchant_items(merchant_pubkey);

-- 9. POS Sales Orders & Receipts
CREATE TABLE IF NOT EXISTS pos_orders (
  id TEXT PRIMARY KEY,
  merchant_pubkey TEXT NOT NULL,
  total_sats INTEGER NOT NULL,
  total_ngn REAL NOT NULL,
  item_count INTEGER NOT NULL,
  status TEXT NOT NULL, -- UNPAID, PAID, EXPIRED, REFUNDED
  payment_method TEXT DEFAULT 'CASHU',
  invoice_hash TEXT,
  items_snapshot TEXT NOT NULL, -- JSON array of items
  created_at INTEGER NOT NULL,
  settled_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pos_orders_merchant ON pos_orders(merchant_pubkey);

-- 10. Verified African Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  user_pubkey TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  currency TEXT DEFAULT 'NGN',
  is_verified INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(user_pubkey, bank_code, account_number)
);

-- 11. Fiat Off-Ramp Quotes & Settlement Records
CREATE TABLE IF NOT EXISTS offramp_quotes (
  id TEXT PRIMARY KEY,
  user_pubkey TEXT NOT NULL,
  sats_amount INTEGER NOT NULL,
  ngn_amount REAL NOT NULL,
  effective_rate REAL NOT NULL,
  bank_account_id TEXT REFERENCES bank_accounts(id),
  status TEXT DEFAULT 'AWAITING_PAYMENT', -- AWAITING_PAYMENT, PROCESSING, SETTLED, FAILED
  provider_tx_ref TEXT,
  error_reason TEXT,
  created_at INTEGER NOT NULL,
  settled_at INTEGER
);

-- 12. Enterprise Audit Logs & Security Traces
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_pubkey TEXT,
  ip_address TEXT,
  user_agent TEXT,
  payload TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
