import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Plus,
  Copy,
  Check,
  Radio,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useMarket } from '../context/MarketContext';
import { soundController } from '../utils/audioVoice';
import { generateProof, encodeCashuToken } from '../utils/cashuEngine';
import { ReceiptModal } from '../components/ReceiptModal';
import { NfcTapModal } from '../components/NfcTapModal';
import { QrScannerModal } from '../components/QrScannerModal';
import type { PaymentTransaction } from '../types';

interface PosProduct {
  id: string;
  name: string;
  nameHa: string;
  priceNgn: number;
  category: string;
}

const INITIAL_CATALOG: PosProduct[] = [
  { id: 'p1', name: 'Ankara Fabric (6 Yds)', nameHa: 'Atamfa (Yadi 6)', priceNgn: 5000, category: 'Apparel' },
  { id: 'p2', name: 'Grain & Rice Bag (5kg)', nameHa: 'Buhun Shinkafa (5kg)', priceNgn: 4500, category: 'Food' },
  { id: 'p3', name: 'Fresh Market Tomatoes', nameHa: 'Tumatir na Kasuwa', priceNgn: 1500, category: 'Food' },
  { id: 'p4', name: 'Pure Shea Butter Balm', nameHa: 'Man Kadanya', priceNgn: 1000, category: 'Cosmetics' },
  { id: 'p5', name: 'Spiced Tea & Masa Snack', nameHa: 'Shayi da Masa', priceNgn: 600, category: 'Snacks' },
  { id: 'p6', name: 'Keke Tricycle Commute', nameHa: 'Kudin Keke Napep', priceNgn: 400, category: 'Transport' },
];

export const PosPage: React.FC = () => {
  const { proofs, updateProofs, addTransaction, isOffline, lang } = useWallet();
  const { ngnToSats } = useMarket();

  // POS State
  const [chargeNgn, setChargeNgn] = useState<number>(1500);
  const [customerMemo, setCustomerMemo] = useState<string>('');
  const [catalog, setCatalog] = useState<PosProduct[]>(INITIAL_CATALOG);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeToken, setActiveToken] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [receiptTx, setReceiptTx] = useState<PaymentTransaction | null>(null);

  // Modals
  const [showNfcModal, setShowNfcModal] = useState<boolean>(false);
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<string>('General');

  const chargeSats = ngnToSats(chargeNgn);

  const categories = ['All', ...Array.from(new Set(catalog.map((c) => c.category)))];

  const filteredCatalog = selectedCategory === 'All'
    ? catalog
    : catalog.filter((c) => c.category === selectedCategory);

  // Generate / refresh payment QR invoice
  const generateInvoice = (amountNgn: number, memo?: string) => {
    const sats = ngnToSats(amountNgn);
    const mockProof = generateProof(sats);
    const token = encodeCashuToken([mockProof]);
    setActiveToken(token);
    if (memo) setCustomerMemo(memo);
  };

  // Simulate payment completion
  const handlePaymentReceived = () => {
    const newProof = generateProof(chargeSats);
    updateProofs([...proofs, newProof]);

    const tx: PaymentTransaction = {
      id: `pos_${Date.now()}`,
      timestamp: Date.now(),
      amountSats: chargeSats,
      amountNgn: chargeNgn,
      type: 'incoming',
      memo: customerMemo || `Merchant POS Sale (₦${chargeNgn.toLocaleString()})`,
      status: 'settled',
      method: 'cashu',
      offline: isOffline,
    };
    addTransaction(tx);

    soundController.playPaymentChime();
    soundController.speakReceipt(chargeSats, lang);
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });

    setReceiptTx(tx);
    setActiveToken('');
  };

  const handleAddProduct = () => {
    if (!newItemName.trim() || !newItemPrice) return;
    const price = parseFloat(newItemPrice);
    const newProd: PosProduct = {
      id: `item_${Date.now()}`,
      name: newItemName.trim(),
      nameHa: newItemName.trim(),
      priceNgn: price,
      category: newItemCategory || 'General',
    };
    setCatalog((prev) => [newProd, ...prev]);
    setShowAddItemModal(false);
    setNewItemName('');
    setNewItemPrice('');
  };

  const copyQrToken = () => {
    navigator.clipboard.writeText(activeToken || 'cashuA...');
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="page-container pos-page">
      <div className="fintech-grid-2col">
        {/* LEFT COLUMN: MERCHANT INVENTORY & QUICK SELECT */}
        <div className="grid-col-primary">
          <div className="card">
            <div className="card-header-between">
              <div>
                <h2>Merchant POS Inventory Catalog</h2>
                <p className="card-subtitle">Tap any item to instantly calculate live satoshis and charge customer.</p>
              </div>

              <button
                type="button"
                className="btn-primary-sm"
                onClick={() => setShowAddItemModal(true)}
              >
                <Plus size={14} />
                <span>Add Item</span>
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="category-pill-row">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product Cards Grid */}
            <div className="pos-products-grid">
              {filteredCatalog.map((prod) => (
                <div
                  key={prod.id}
                  className={`pos-product-item ${chargeNgn === prod.priceNgn ? 'selected' : ''}`}
                  onClick={() => {
                    setChargeNgn(prod.priceNgn);
                    setCustomerMemo(prod.name);
                    generateInvoice(prod.priceNgn, prod.name);
                  }}
                >
                  <div className="prod-name">{lang === 'ha' ? prod.nameHa : prod.name}</div>
                  <div className="prod-price-ngn mono-num">₦{prod.priceNgn.toLocaleString()}</div>
                  <div className="prod-price-sats mono-num">≈ {ngnToSats(prod.priceNgn).toLocaleString()} sats</div>
                  <div className="prod-category-tag">{prod.category}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CHARGE TERMINAL & QR INVOICE */}
        <div className="grid-col-secondary">
          <div className="card pos-terminal-card">
            <div className="card-header-between">
              <h3>Quick Charge Terminal</h3>
              <span className="badge-offline">Offline Ecash / Lightning</span>
            </div>

            {/* Charge Display */}
            <div className="charge-display-box">
              <div className="display-label">Charge Amount in Naira (NGN)</div>
              <div className="display-amount mono-num">₦{chargeNgn.toLocaleString()}</div>
              <div className="display-sats mono-num">≈ {chargeSats.toLocaleString()} satoshis</div>
            </div>

            {/* Numpad Presets */}
            <div className="quick-presets-grid">
              {[500, 1000, 2000, 5000, 10000, 20000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="preset-btn"
                  onClick={() => {
                    setChargeNgn(amt);
                    generateInvoice(amt);
                  }}
                >
                  ₦{amt.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Customer Note Input */}
            <div className="input-group-fintech mt-3">
              <label>Customer Reference Note (Optional)</label>
              <input
                type="text"
                className="fintech-input"
                placeholder="e.g. 2 bags of maize, passenger fare"
                value={customerMemo}
                onChange={(e) => setCustomerMemo(e.target.value)}
              />
            </div>

            {/* QR Payment Code */}
            <div className="qr-container-box">
              <QRCodeSVG
                value={activeToken || `cashuA_${chargeSats}_sats`}
                size={180}
                bgColor="#0B0E14"
                fgColor="#F7931A"
                level="M"
              />
              <div className="qr-caption">Scan with any Cashu or Lightning wallet</div>

              <div className="qr-actions-row">
                <button type="button" className="btn-outline-sm" onClick={copyQrToken}>
                  {copiedToken ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedToken ? 'Copied' : 'Copy Token'}</span>
                </button>

                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => setShowNfcModal(true)}
                >
                  <Radio size={14} />
                  <span>NFC Tap</span>
                </button>
              </div>
            </div>

            {/* Payment Receiver Actions */}
            <div className="terminal-actions mt-3">
              <button
                type="button"
                className="btn-primary w-full"
                onClick={handlePaymentReceived}
              >
                Simulate Customer Payment Received (Instant)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: ADD PRODUCT */}
      {showAddItemModal && (
        <div className="modal-overlay" onClick={() => setShowAddItemModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Inventory Product</h3>
              <button type="button" className="close-btn" onClick={() => setShowAddItemModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group-fintech">
                <label>Product Name</label>
                <input
                  type="text"
                  className="fintech-input"
                  placeholder="e.g. Groundnut Oil (1L)"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
              </div>

              <div className="input-group-fintech">
                <label>Price in Naira (NGN)</label>
                <input
                  type="number"
                  className="fintech-input mono-num"
                  placeholder="1500"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                />
              </div>

              <div className="input-group-fintech">
                <label>Category</label>
                <select
                  className="fintech-input"
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                >
                  <option value="General">General</option>
                  <option value="Food">Food</option>
                  <option value="Apparel">Apparel</option>
                  <option value="Cosmetics">Cosmetics</option>
                  <option value="Transport">Transport</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAddProduct}
                  disabled={!newItemName.trim() || !newItemPrice}
                >
                  Save Product to Catalog
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NFC TAP */}
      <NfcTapModal
        isOpen={showNfcModal}
        onClose={() => setShowNfcModal(false)}
        amountSats={chargeSats}
        onComplete={handlePaymentReceived}
      />

      {/* MODAL: QR SCANNER */}
      <QrScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={() => {
          setShowScanner(false);
          handlePaymentReceived();
        }}
        title="Scan Customer Token / QR Code"
      />

      {/* MODAL: PRINTABLE RECEIPT */}
      <ReceiptModal
        isOpen={Boolean(receiptTx)}
        onClose={() => setReceiptTx(null)}
        tx={receiptTx}
      />
    </div>
  );
};
