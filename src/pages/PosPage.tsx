import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Plus,
  Copy,
  Check,
  Radio,
  QrCode,
  Delete,
  CheckCircle2,
  Grid,
  Calculator,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useMarket } from '../context/MarketContext';
import { soundController } from '../utils/audioVoice';
import { generateProof, encodeCashuToken } from '../utils/cashuEngine';
import { ReceiptModal } from '../components/ReceiptModal';
import { NfcTapModal } from '../components/NfcTapModal';
import { QrScannerModal } from '../components/QrScannerModal';
import { ApiClient } from '../services/apiClient';
import type { PaymentTransaction } from '../types';

interface PosProduct {
  id: string;
  name: string;
  nameHa: string;
  priceNgn: number;
  category: string;
  stockCount?: number;
}

const INITIAL_CATALOG: PosProduct[] = [
  { id: 'p1', name: 'Ankara Fabric (6 Yds)', nameHa: 'Atamfa (Yadi 6)', priceNgn: 5000, category: 'Apparel', stockCount: 80 },
  { id: 'p2', name: 'Grain & Rice Bag (5kg)', nameHa: 'Buhun Shinkafa (5kg)', priceNgn: 4500, category: 'Food', stockCount: 45 },
  { id: 'p3', name: 'Fresh Market Tomatoes', nameHa: 'Tumatir na Kasuwa', priceNgn: 1500, category: 'Food', stockCount: 15 },
  { id: 'p4', name: 'Pure Shea Butter Balm', nameHa: 'Man Kadanya', priceNgn: 1000, category: 'Cosmetics', stockCount: 60 },
  { id: 'p5', name: 'Spiced Tea & Masa Snack', nameHa: 'Shayi da Masa', priceNgn: 600, category: 'Snacks', stockCount: 120 },
  { id: 'p6', name: 'Keke Tricycle Commute', nameHa: 'Kudin Keke Napep', priceNgn: 400, category: 'Transport', stockCount: 999 },
];

export const PosPage: React.FC = () => {
  const { proofs, updateProofs, addTransaction, isOffline, lang } = useWallet();
  const { ngnToSats } = useMarket();

  const [mobileTab, setMobileTab] = useState<'keypad' | 'catalog'>('keypad');
  const [chargeNgn, setChargeNgn] = useState<number>(1500);
  const [customerMemo, setCustomerMemo] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
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

  useEffect(() => {
    ApiClient.getPosCatalog()
      .then((items) => {
        if (items && items.length > 0) {
          const mapped: PosProduct[] = items.map((i: any) => ({
            id: i.id,
            name: i.name_en,
            nameHa: i.name_ha || i.name_en,
            priceNgn: i.price_ngn,
            category: i.category || 'General',
            stockCount: typeof i.stock_count === 'number' ? i.stock_count : 50,
          }));
          setCatalog(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const chargeSats = ngnToSats(chargeNgn);
  const categories = ['All', ...Array.from(new Set(catalog.map((c) => c.category)))];
  const filteredCatalog =
    selectedCategory === 'All'
      ? catalog
      : catalog.filter((c) => c.category === selectedCategory);

  const generateInvoice = (amountNgn: number, memo?: string) => {
    const sats = ngnToSats(amountNgn);
    const mockProof = generateProof(sats);
    const token = encodeCashuToken([mockProof]);
    setActiveToken(token);
    if (memo !== undefined) setCustomerMemo(memo);
  };

  const handleDigitPress = (digit: string) => {
    soundController.playClick();
    if (digit === 'C') {
      setChargeNgn(0);
      setCustomerMemo('');
      return;
    }
    if (digit === 'BACK') {
      const next = Math.floor(chargeNgn / 10);
      setChargeNgn(next);
      return;
    }
    const currentStr = chargeNgn === 0 ? '' : chargeNgn.toString();
    if (currentStr.length >= 7) return;
    const nextVal = parseInt(currentStr + digit, 10) || 0;
    setChargeNgn(nextVal);
    generateInvoice(nextVal);
  };

  const handlePaymentReceived = () => {
    if (chargeSats <= 0) return;
    const newProof = generateProof(chargeSats);
    updateProofs([...proofs, newProof]);

    // Deduct stock count locally if a catalog item was selected
    if (selectedProductId) {
      setCatalog((prev) =>
        prev.map((p) =>
          p.id === selectedProductId
            ? { ...p, stockCount: Math.max(0, (p.stockCount ?? 50) - 1) }
            : p
        )
      );
    }

    const tx: PaymentTransaction = {
      id: `pos_${Date.now()}`,
      timestamp: Date.now(),
      amountSats: chargeSats,
      amountNgn: chargeNgn,
      type: 'incoming',
      memo: customerMemo || `POS Terminal Sale (₦${chargeNgn.toLocaleString()})`,
      status: 'settled',
      method: 'cashu',
      offline: isOffline,
    };
    addTransaction(tx);

    // Create & settle order on SQLite backend (deducting inventory in merchant_items)
    ApiClient.createPosOrder({
      items: [
        {
          id: selectedProductId || 'custom_keypad',
          name: customerMemo || 'POS Terminal Charge',
          priceNgn: chargeNgn,
          quantity: 1,
        },
      ],
      totalNgn: chargeNgn,
      totalSats: chargeSats,
      paymentMethod: 'CASHU',
    })
      .then((order) => {
        if (order?.orderId) {
          return ApiClient.settlePosOrder(order.orderId);
        }
      })
      .catch(() => {});

    soundController.playPaymentChime();
    soundController.speakReceipt(chargeSats, lang);
    confetti({ particleCount: 55, spread: 70, origin: { y: 0.6 } });

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

    ApiClient.addPosItem({
      nameEn: newProd.name,
      nameHa: newProd.nameHa,
      priceNgn: newProd.priceNgn,
      category: newProd.category,
    }).catch(() => {});
  };

  const copyQrToken = () => {
    navigator.clipboard.writeText(activeToken || `cashuA_${chargeSats}_sats`);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="page-container pos-page">
      {/* Mobile Segmented Switcher: Keypad vs Catalog */}
      <div className="pos-mobile-tabs">
        <button
          type="button"
          className={`pos-seg-btn ${mobileTab === 'keypad' ? 'active' : ''}`}
          onClick={() => setMobileTab('keypad')}
        >
          <Calculator size={15} />
          <span>{lang === 'ha' ? 'Madannin Kudi' : 'Charge Keypad'}</span>
        </button>
        <button
          type="button"
          className={`pos-seg-btn ${mobileTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setMobileTab('catalog')}
        >
          <Grid size={15} />
          <span>{lang === 'ha' ? 'Kayan Kasuwa' : `Catalog (${catalog.length})`}</span>
        </button>
      </div>

      <div className="fintech-grid-2col">
        {/* LEFT COLUMN (Desktop) / TAB 2 (Mobile): INVENTORY CATALOG */}
        <div className={`grid-col-primary ${mobileTab === 'keypad' ? 'hide-on-mobile' : ''}`}>
          <div className="card">
            <div className="card-header-between">
              <h3 className="section-heading-clean">
                {lang === 'ha' ? 'Jerin Kaya' : 'Product Catalog'}
              </h3>

              <button
                type="button"
                className="btn-primary-sm"
                onClick={() => setShowAddItemModal(true)}
              >
                <Plus size={14} />
                <span>New Item</span>
              </button>
            </div>

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

            <div className="pos-products-grid">
              {filteredCatalog.map((prod) => (
                <div
                  key={prod.id}
                  className={`pos-product-item ${chargeNgn === prod.priceNgn && customerMemo === prod.name ? 'selected' : ''}`}
                  onClick={() => {
                    soundController.playClick();
                    setSelectedProductId(prod.id);
                    setChargeNgn(prod.priceNgn);
                    setCustomerMemo(prod.name);
                    generateInvoice(prod.priceNgn, prod.name);
                    setMobileTab('keypad');
                  }}
                >
                  <div className="prod-top-row">
                    <span className="prod-category-tag">{prod.category}</span>
                    <span className="prod-price-sats mono-num">
                      {prod.stockCount !== undefined ? `${prod.stockCount} left • ` : ''}
                      {ngnToSats(prod.priceNgn).toLocaleString()} sats
                    </span>
                  </div>
                  <div className="prod-name">{lang === 'ha' ? prod.nameHa : prod.name}</div>
                  <div className="prod-price-ngn mono-num">₦{prod.priceNgn.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Desktop) / TAB 1 (Mobile): TACTILE POS CHARGE TERMINAL */}
        <div className={`grid-col-secondary ${mobileTab === 'catalog' ? 'hide-on-mobile' : ''}`}>
          <div className="card pos-terminal-card">
            <div className="card-header-between">
              <h3 className="section-heading-clean">POS Checkout</h3>
              <span className="badge-offline">
                {isOffline ? 'Offline Bearer Mode' : 'Cashu & Lightning'}
              </span>
            </div>

            {/* Amount Display Screen */}
            <div className="charge-display-box">
              <div className="display-label">
                {customerMemo ? customerMemo : 'Amount Due (NGN)'}
              </div>
              <div className="display-amount mono-num">₦{chargeNgn.toLocaleString()}</div>
              <div className="display-sats mono-num">{chargeSats.toLocaleString()} sats</div>
            </div>

            {/* Quick Presets */}
            <div className="quick-presets-grid mb-2">
              {[500, 1000, 2000, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="preset-btn mono-num"
                  onClick={() => {
                    soundController.playClick();
                    setChargeNgn(amt);
                    setCustomerMemo('');
                    generateInvoice(amt, '');
                  }}
                >
                  ₦{amt.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Tactile POS Numpad */}
            <div className="pos-numpad-grid">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BACK'].map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`pos-numpad-key mono-num ${key === 'C' ? 'key-clear' : ''}`}
                  onClick={() => handleDigitPress(key)}
                >
                  {key === 'BACK' ? <Delete size={16} /> : key}
                </button>
              ))}
            </div>

            {/* QR Invoice & Hardware Actions */}
            <div className="qr-container-box">
              <div className="qr-frame-white">
                <QRCodeSVG
                  value={activeToken || `cashuA_${chargeSats}_sats`}
                  size={156}
                  bgColor="#FFFFFF"
                  fgColor="#0B0E14"
                  level="M"
                />
              </div>

              <div className="qr-actions-row">
                <button type="button" className="btn-outline-sm" onClick={copyQrToken}>
                  {copiedToken ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => setShowNfcModal(true)}
                >
                  <Radio size={13} />
                  <span>NFC Tap</span>
                </button>

                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => setShowScanner(true)}
                >
                  <QrCode size={13} />
                  <span>Scan Note</span>
                </button>
              </div>
            </div>

            <div className="terminal-actions mt-3">
              <button
                type="button"
                className="btn-primary w-full"
                disabled={chargeSats <= 0}
                onClick={handlePaymentReceived}
              >
                <CheckCircle2 size={17} />
                <span>Confirm Payment ({chargeSats.toLocaleString()} sats)</span>
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
              <h3>Add Catalog Item</h3>
              <button type="button" className="close-btn" onClick={() => setShowAddItemModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group-fintech">
                <label>Item Name</label>
                <input
                  type="text"
                  className="fintech-input"
                  placeholder="e.g. Groundnut Oil (1L)"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
              </div>

              <div className="input-group-fintech">
                <label>Price (NGN)</label>
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
                  Save Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <NfcTapModal
        isOpen={showNfcModal}
        onClose={() => setShowNfcModal(false)}
        amountSats={chargeSats}
        onComplete={handlePaymentReceived}
      />

      <QrScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={() => {
          setShowScanner(false);
          handlePaymentReceived();
        }}
        title="Scan Customer Cashu Voucher"
      />

      <ReceiptModal
        isOpen={Boolean(receiptTx)}
        onClose={() => setReceiptTx(null)}
        tx={receiptTx}
      />
    </div>
  );
};
