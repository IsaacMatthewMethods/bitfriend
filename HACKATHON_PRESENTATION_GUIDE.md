# BitFriend (BitAboki) — Complete Step-by-Step Guide & Hackathon Pitch Playbook

> **One-Sentence Pitch:**  
> **BitFriend** is a sovereign, offline-capable Bitcoin & Cashu Ecash mobile banking, POS, cooperative savings (Adashi), and instant Nigerian bank settlement super-app built for African merchants and everyday traders.

---

## 1. The Core Problem We Solve (How to Explain It Simply)

When speaking to judges or an audience, start with the real-world reality across Nigeria and emerging markets:
1. **Bank Network Downtime & Failed Transfers:** In busy markets (like Wuse Market in Abuja or Singer Market in Kano), customers stand around for 15–30 minutes waiting for a bank transfer alert while cellular data is congested.
2. **High POS & Custodial Fees:** Traditional POS terminals charge heavy fees and freeze merchant accounts arbitrarily.
3. **Standard Bitcoin/Lightning Needs Constant Internet:** Even Lightning Network requires both parties to be online simultaneously to negotiate an invoice.

### How BitFriend Solves This:
BitFriend combines **three financial rails into one seamless mobile experience**:
1. **Cashu Chaumian Ecash (`secp256k1` Blind Signatures):** Digital bearer cash backed 1:1 by Bitcoin. You can generate a cryptographic note (`cashuA...`), hand it over via QR code, NFC tap, or chat even on poor/offline networks, and the mint cryptographically guarantees it cannot be forged or double-spent.
2. **Bitcoin Lightning Network L2 (`BOLT-11` & `LUD-16`):** Every user gets an instant human-readable Lightning Address (`yourname@bitfriend.me`) for global, sub-second Bitcoin payments.
3. **Instant Nigerian Bank Off-Ramp (`CBN NUBAN` + `NIP`):** Merchants can convert their satoshis directly into Naira (`₦`) and settle into OPay, Moniepoint, GTBank, Access, Zenith, PalmPay, or Kuda with automated 10-digit NUBAN account verification.

---

## 2. How Every Module Works (Under the Hood vs. Plain English)

| Module | Plain-English Explanation (For General Audience) | Technical Architecture (For Developer Judges) |
| :--- | :--- | :--- |
| **1. Sovereign Auth & 12-Word Vault** | No email, password, or bank KYC required to start. You type your name, get a 12-word recovery phrase, and own your money 100%. If you lose your phone, those 12 words restore your account anywhere. | **BIP-39** `PBKDF2-HMAC-SHA512` (2048 rounds) derives a deterministic `secp256k1` keypair & **NUT-13** secrets. Login uses a passwordless **BIP-340 Schnorr** challenge-response (`/api/v1/auth/challenge` → `/api/v1/auth/verify`). Vault encrypted at rest with **WebCrypto AES-256-GCM**. |
| **2. Cashu Ecash Vault** | Works like digital physical cash inside your phone. When you send `1,000 sats`, the app packages real digital notes into a `cashuA...` voucher code or QR that anyone can claim. | Full **NUT-00 / NUT-02 / NUT-03** implementation on `secp256k1` using **Blind Diffie-Hellman Key Exchange (BDHKE)**: `Y = hash_to_curve(secret)`, `B' = Y + r·G`, mint signs `C' = k·B'`, client unblinds `C = C' - r·K`. SQLite `spent_secrets` table enforces atomic anti-double-spend. |
| **3. Lightning L2 Bridge** | Lets anyone in the world send Bitcoin to `yourname@bitfriend.me` or pay a standard Lightning QR code in under 1 second. | **LUD-16** server (`GET /.well-known/lnurlp/:username`), **NUT-04** mint quotes, and **NUT-05** melt quotes with real `SHA-256(preimage) == payment_hash` verification and live WebSocket `INVOICE_SETTLED` push events. |
| **4. BitChat P2P Messenger** | A built-in WhatsApp-style encrypted trade chat where you can message suppliers and drop claimable Bitcoin Ecash envelopes right inside the conversation. | SQLite-persisted conversations & messages (`chat_conversations`, `chat_messages`) + real-time **WebSocket** relay (`ws://.../ws`). Claiming an in-chat token executes an atomic **NUT-03** swap before marking the bubble claimed. |
| **5. Merchant POS Terminal** | Turns any Android phone into a point-of-sale register with a product catalog, live inventory stock counter, Hausa/English voice receipts, and QR/NFC checkout. | SQLite `pos_products` & `pos_checkouts` tables. Every completed sale atomically decrements item inventory (`stock_count = stock_count - 1`), verifies proofs, speaks the receipt in English or Hausa (`Web Speech API`), and generates a thermal-style receipt. |
| **6. Adashi (ROSCA Thrift Circles)** | Digitizes traditional African rotating savings clubs (*Adashi / Esusu / Ajo*). Members contribute weekly into a locked pot, and when everyone has paid, the pot automatically pays out to that week's recipient. | SQLite `adashi_circles`, `adashi_members`, and `adashi_contributions` tables. Enforces contribution locking and automatic round disbursement + round advancement inside a single ACID SQLite transaction. |
| **7. Nigerian Bank Cash-Out** | Lets you withdraw your Bitcoin balance directly to any Nigerian bank account in Naira (`₦`) with instant account name lookup. | CBN Modulo-10 NUBAN checksum validation + live Paystack/Flutterwave resolution fallback cached in SQLite `verified_bank_accounts`. Atomic wallet debit (`BEGIN IMMEDIATE`) with automatic refund rollback on gateway failure. |

---

## 3. Step-by-Step Live Demo Script (5 Minutes to Win the Hackathon)

Follow this exact sequence on stage so judges see a **100% real, non-simulated, production flow**:

### Step 1: Sovereign Account Creation (45 seconds)
1. Open the app (`http://localhost:5173` or the native Android APK).
2. Point out to the judges: *"Notice there is no pre-loaded fake demo account. Every user starts at the Sovereign Auth Launchpad."*
3. Enter your name (e.g., **Aminu Kano Ventures**), show the auto-generated LUD-16 Lightning Handle (`aminukanoventures@bitfriend.me`), and point to the **12-Word BIP-39 Seed Phrase** and derived `secp256k1` public key.
4. Click **Copy 12 Words**, check the backup confirmation box, and click **Create Sovereign Wallet & Sign In**.
5. Explain: *"Our browser just signed a cryptographic BIP-340 Schnorr challenge with the backend SQLite node—zero passwords stored on the server."*

### Step 2: Sending & Claiming a Real Cashu Ecash Token (60 seconds)
1. On the **Wallet** screen, tap **Send Note**.
2. Enter **`500` SATS**, click **Generate Voucher**, and copy the `cashuA...` token string.
3. Point out: *"My balance immediately dropped by 500 sats. This string is a real Chaumian blind-signed bearer note."*
4. Now tap **Claim**, paste that exact `cashuA...` string, and click **Claim Ecash**.
5. Show the balance increasing by `500 SATS` as the backend mint verifies the `secp256k1` curve equation `C = k · Y` and rotates the secrets via NUT-03.
6. **Bonus Judge Wow-Moment:** Paste the *exact same* `cashuA...` token a second time in **Claim** and click **Claim Ecash** — watch the mint immediately block it with **`Double-spend detected!`**

### Step 3: Lightning L2 Invoice & Instant Settlement (45 seconds)
1. On the **Wallet** screen, click **`Invoice / Pay`** on the **Lightning L2** card.
2. Enter **`2,500` SATS** and click **Create BOLT-11**. Show the live QR code and `lnbc...` invoice.
3. Click **Settle & Reveal Preimage** — watch the cryptographic `SHA-256` preimage verify and the wallet balance jump up by `2,500 SATS` in real time.

### Step 4: Merchant POS Checkout & Inventory Deduction (45 seconds)
1. Tap **POS** in the bottom navigation bar.
2. Switch to **Catalog**, point out the live stock count on an item (e.g. `40 left`), and tap an item to load it into the terminal.
3. Tap **Confirm Payment** — the app announces the payment aloud (English/Hausa voice receipt), prints a verifiable receipt, and decrements the item's stock count in SQLite to `39 left`.

### Step 5: BitChat P2P Ecash & Adashi Savings Circle (30 seconds)
1. Tap **BitChat** → open a trade conversation → send a message or an inline Bitcoin envelope.
2. Tap **Adashi** → show the **Wuse Market Traders** cooperative pool where members lock satoshis into an automated rotating payout pot.

### Step 6: Instant Nigerian Bank NUBAN Cash-Out (45 seconds)
1. Return to **Wallet** → tap **Transfer** (or **Cash Out**).
2. Select **OPay** or **GTBank**, type a 10-digit NUBAN account number (e.g. `8012345678`), and show the instant green **`VERIFIED ACCOUNT`** badge retrieved from the backend.
3. Enter `₦5,000`, confirm the payout, and display the **NIP Settlement Receipt**.
4. Wrap up by showing **Settings → Switch / Sign Out**, proving you can sign out and recover the exact wallet anytime using the 12 words you copied in Step 1!
