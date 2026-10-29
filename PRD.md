# Product Requirements Document (PRD)
## Project Name: BitFriend (BitAboki)
### Offline-First Bitcoin & Chaumian Ecash for African Grassroots Commerce
**Version:** 1.0.0 (Production / Hackathon Release)  
**Target Platform:** Mobile-First Progressive Web App (PWA)  
**Target Event:** Global Bitcoin & Web3 Hackathon 2026  
**Document Status:** Approved / Production Ready

---

## 1. Executive Summary & Vision

### 1.1 Problem Statement
Across Nigeria and Sub-Saharan Africa, grassroots informal commerce accounts for over **80% of total employment** and **60% of GDP**. In major open commerce hubs, daily retail transactions face two structural failures:
1. **Telecom & Banking Network Fragility:** High cellular traffic, power grid collapse, and bank gateway congestion cause POS card terminals and mobile USSD transfers to fail regularly. Merchants lose sales or risk handing goods over on delayed "uncredited bank alerts."
2. **Devastating Fiat Inflation:** The Nigerian Naira (NGN) devalued by over 70% in recent years, with real inflation exceeding 30%. Traditional rotating savings and credit associations (**Adashi / Esusu / Ajo**) lose substantial purchasing power before participants receive their pooled payouts.

### 1.2 The Solution
**BitFriend (BitAboki)** is an open-source, offline-first Progressive Web Application that introduces **Chaumian Ecash (Cashu protocol)** and **Lightning Network settlement** to informal market vendors:
- **Zero-Data Bearer Ecash:** Enables sub-second peer-to-peer payments over QR, NFC, audio chimes, or SMS with **zero cellular internet connection**.
- **Satoshi-Denominated Adashi (ROSCA):** Community rotating savings pools upgraded to Bitcoin, protecting collective savings from fiat devaluation.
- **Accessible Multi-Sensory UX:** Acoustic validation chimes and native **Nigerian Hausa speech synthesis** (*"An karɓi satoshi {amount} cikin nasara!"*), ensuring market traders in noisy stalls receive audible transaction verification without checking screens.

---

## 2. Target User Personas

| Persona | Role / Context | Core Pain Points | BitFriend Value Delivered |
| :--- | :--- | :--- | :--- |
| **Amina Garba** | Fabric & Brocade Vendor, Central Market | Peak market hours jam cell towers; bank transfer alerts take 20+ minutes to arrive. | Instant offline QR/tap receipt with Hausa voice confirmation; zero gateway fees. |
| **Musa Abdullahi** | Tricycle Driver, Urban Transport Union | Carries cash for change; loses 10-15% of daily revenue to Naira devaluation; risk of physical theft. | Micro-satoshi payments (1 sat ≈ ₦1.58); participates in daily Adashi pool to buy spare tires. |
| **Ibrahim Bello** | Cooperative Leader / Adashi Treasurer | Record-keeping is manual on paper ledgers; members dispute contribution orders and currency devaluation. | Automated round tracking; transparent satoshi payouts; printable thermal audit slips and CSV export. |

---

## 3. Product Principles & Architecture

### 3.1 Non-Negotiable Product Principles
1. **Offline-First Resilience:** If the cellular network drops to 0 bars, local trade must continue uninterrupted.
2. **Sub-Satoshi / Sub-Cent Viability:** No $2-$5 channel opening fees. Zero-fee micro-transactions down to 1 satoshi.
3. **Radical Simplicity & Cultural Alignment:** Respect local financial culture (*Adashi*) and speak native market language (*Hausa*).
4. **Self-Sovereign Bearer Custody:** Users hold cryptographic bearer proofs on-device with BIP-39 12-word disaster recovery.

### 3.2 Technical Architecture Overview
- **Client Layer:** React 19 UI, HTML5 Video QR Scanner (`jsQR`), Web Audio Synthesizer, Web Speech API (Hausa), IndexedDB / LocalStorage Vault.
- **Protocol Layer:** NUT-00 (Proof Serialization), NUT-03 (Powers-of-2 Coin Splitting), WebLN Standard, BIP-39 12-Word Seed.
- **Network Gateway:** Cashu Mint REST API (`/v1/info`, `/v1/mint/quote/bolt11`), Lightning Network (BOLT-11 / LNURL).

---

## 4. Functional Requirements

### 4.1 Merchant Point-of-Sale (POS) Terminal
- **FR-1.1 Real-Time Conversion:** Live conversion between Naira (NGN) and Satoshis (1 BTC = ₦158.5M).
- **FR-1.2 Quick-Charge Presets:** 1-tap presets for everyday goods: ₦500, ₦1,000, ₦2,000, ₦5,000, ₦10,000.
- **FR-1.3 Dynamic QR Code:** Standardized Cashu token / invoice QR code compatible with Minibits, eNuts, Nutstash, and Lightning wallets.
- **FR-1.4 Simulated & Hardware Payments:**
  - Simulated customer tap-to-pay for demonstration and training.
  - 1-Click payment via **WebLN** (`window.webln.sendPayment`) when online.
  - Direct hardware camera QR scanning (`jsQR`) for customer vouchers.
  - Contactless NFC / acoustic tap-to-phone simulation.
- **FR-1.5 Acoustic & Vocal Confirmation:**
  - Dual-frequency harmonic chime (F5 $\rightarrow$ A5 $\rightarrow$ C6) synthesized via Web Audio API.
  - Native Hausa voice announcement: *"An karɓi satoshi {n} cikin nasara!"* with English fallback.

### 4.2 Offline Ecash Vault & Mint Gateway
- **FR-2.1 Bearer Token Storage:** Persistent local storage of Cashu proofs.
- **FR-2.2 Powers-of-2 Denominations:** Standard binary units ($1, 2, 4, 8, 16, 32, \dots$).
- **FR-2.3 Offline Voucher Generation:** Export bearer satoshis into shareable `cashuA...` token strings and QR codes.
- **FR-2.4 Voucher Claiming & Redemption:** Scan or paste token strings with cryptographic verification.
- **FR-2.5 Lightning Sweep / Melt (NUT-05):** Sweep offline ecash into an online Lightning wallet.
- **FR-2.6 Multi-Mint Latency Monitor:** Compare Minibits, Nutstash, LNbits, and Localhost mints.
- **FR-2.7 BIP-39 Disaster Recovery:** 12-word recovery phrase generation, verification, and restoration.

### 4.3 Decentralized Adashi (Rotating Savings) Circles
- **FR-3.1 Pre-Configured Market Circles:**
  - *Kasuwan Barci Fabric Traders Pot* (Weekly, 2,500 sats/turn).
  - *Doka Keke-NAPEP Riders Daily Pool* (Daily, 1,000 sats/turn).
- **FR-3.2 Custom Circle Creator:** Custom circle creation with category selection, frequency, contribution amount, and member roster.
- **FR-3.3 Automated Round Progression:** Turn tracking, pot accumulation, and automated payout distribution.
- **FR-3.4 Inflation Resistance Gauge:** Live display of satoshi value preservation vs. Naira purchasing power decay.

### 4.4 Transaction Audit Log & Thermal Receipts
- **FR-4.1 Chronological Audit Ledger:** Incoming, outgoing, offline ecash, and Lightning settlements.
- **FR-4.2 Printable Thermal Receipt:** Slip formatted for 58mm/80mm thermal receipt printers with reference hash, date, satoshi/NGN values, and verification QR code.
- **FR-4.3 CSV Export:** One-click CSV audit log export for cooperative record-keeping.
