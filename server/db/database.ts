import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'bitfriend.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log(`[BitFriend DB] Initializing SQLite database at: ${DB_PATH}`);
export const db = new DatabaseSync(DB_PATH);

// Run initial schema migration
export function initializeDatabase(): void {
  try {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);

    // Ensure safe schema column migrations for existing databases
    const userCols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const userColNames = new Set(userCols.map(c => c.name));
    if (!userColNames.has('lightning_address')) {
      db.exec('ALTER TABLE users ADD COLUMN lightning_address TEXT');
    }
    if (!userColNames.has('currency')) {
      db.exec("ALTER TABLE users ADD COLUMN currency TEXT DEFAULT 'NGN'");
    }

    console.log('[BitFriend DB] Schema tables & indexes verified successfully.');

    // Seed production baseline records if table is empty
    seedInitialData();
  } catch (err) {
    console.error('[BitFriend DB] Fatal error initializing database schema:', err);
    throw err;
  }
}

function seedInitialData(): void {
  // Check if merchant_items has records
  const itemCheck = db.prepare('SELECT COUNT(*) as count FROM merchant_items').get() as { count: number };
  if (itemCheck.count === 0) {
    console.log('[BitFriend DB] Seeding initial merchant POS catalog...');
    const insertItem = db.prepare(`
      INSERT INTO merchant_items (id, merchant_pubkey, name_en, name_ha, price_ngn, price_sats, category, stock_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaultMerchantPubkey = '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58';
    const now = Date.now();
    const btcNgnRate = 145000000; // ₦145M per BTC (~69 sat/₦)

    const items = [
      { id: 'item_1', nameEn: 'Bag of Rice (50kg)', nameHa: 'Buhun Shinkafa (50kg)', priceNgn: 75000, cat: 'Food & Grains', stock: 45 },
      { id: 'item_2', nameEn: 'Gallon of Vegetable Oil (25L)', nameHa: 'Man Girki (25L)', priceNgn: 48000, cat: 'Provisions', stock: 28 },
      { id: 'item_3', nameEn: 'Carton of Indomie Noodles', nameHa: 'Katan din Indomie', priceNgn: 12500, cat: 'Food & Grains', stock: 120 },
      { id: 'item_4', nameEn: 'Bag of Cement (Dangote)', nameHa: 'Siminti Dangote', priceNgn: 9500, cat: 'Hardware', stock: 350 },
      { id: 'item_5', nameEn: 'Solar Lamp (Rechargeable)', nameHa: 'Fitilar Rana', priceNgn: 18000, cat: 'Electronics', stock: 60 },
      { id: 'item_6', nameEn: 'Carton of Milk (Peak/Cowbell)', nameHa: 'Madara Katan', priceNgn: 32000, cat: 'Provisions', stock: 35 },
      { id: 'item_7', nameEn: 'Basket of Fresh Tomatoes', nameHa: 'Kwandon Tumatir', priceNgn: 25000, cat: 'Perishables', stock: 15 },
      { id: 'item_8', nameEn: 'Brocade Fabric (10 Yards)', nameHa: 'Yadin Shadda (Yadi 10)', priceNgn: 45000, cat: 'Textiles', stock: 80 }
    ];

    for (const item of items) {
      const sats = Math.round((item.priceNgn / btcNgnRate) * 100000000);
      insertItem.run(item.id, defaultMerchantPubkey, item.nameEn, item.nameHa, item.priceNgn, sats, item.cat, item.stock, now);
    }
  }

  // Check if adashi_circles has records
  const adashiCheck = db.prepare('SELECT COUNT(*) as count FROM adashi_circles').get() as { count: number };
  if (adashiCheck.count === 0) {
    console.log('[BitFriend DB] Seeding initial Adashi community savings circle...');
    const now = Date.now();
    const circleId = 'circle_danbatta_grains_01';
    db.prepare(`
      INSERT INTO adashi_circles (id, title, description, creator_pubkey, cycle_type, contribution_sats, contribution_ngn, total_pot_sats, current_round, max_rounds, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      circleId,
      'Danbatta Grain Merchants Cooperative',
      'Weekly rotating Bitcoin Adashi savings pool for northern grain wholesalers',
      '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58',
      'WEEKLY',
      25000,
      36250,
      125000,
      2,
      5,
      'ACTIVE',
      now - 86400000 * 7,
      now
    );

    const insertMember = db.prepare(`
      INSERT INTO adashi_members (id, circle_id, user_pubkey, member_alias, position_order, round_payout_index, total_contributed_sats, has_received_payout, status, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const members = [
      { id: 'm_1', pubkey: '02a1633cafcc01ebfb6d78e39f687a1f099016ea6365fec27c0fa555df67048a58', alias: 'Alhaji Musa (You)', order: 1, payoutRound: 2, contributed: 50000, paid: 0 },
      { id: 'm_2', pubkey: '034f59c8bcda9132204c3f58a364bbbf03046f8aa1805b225f693ff683058869c9', alias: 'Malam Garba', order: 2, payoutRound: 1, contributed: 50000, paid: 1 },
      { id: 'm_3', pubkey: '028913b45fead48f72a44bb4a5f829ec34c44249a2a30bb0683041c2c310c85c27', alias: 'Hajiya Amina', order: 3, payoutRound: 3, contributed: 25000, paid: 0 },
      { id: 'm_4', pubkey: '02c0b58e23f815ea7e20b33418579cfc4623315a6b0743b17926b01b6782553b6a', alias: 'Ibrahim POS Kano', order: 4, payoutRound: 4, contributed: 25000, paid: 0 },
      { id: 'm_5', pubkey: '036db78174f837d97b10292fc0b4e07bf2f6460faeecdc9255a024c08129a0a4c9', alias: 'Bashir Tailor', order: 5, payoutRound: 5, contributed: 25000, paid: 0 }
    ];

    for (const m of members) {
      insertMember.run(m.id, circleId, m.pubkey, m.alias, m.order, m.payoutRound, m.contributed, m.paid, 'ACTIVE', now - 86400000 * 7);
    }
  }
}
