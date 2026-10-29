import React, { useState } from 'react';
import { X, Printer, Copy, Check, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { PaymentTransaction } from '../types';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  tx: PaymentTransaction | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, tx }) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen || !tx) return null;

  const formattedDate = new Date(tx.timestamp).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const receiptSummaryText = `
=== BITFRIEND MARKET RECEIPT ===
Terminal: Kasuwan Barci Market POS
Tx ID: ${tx.id}
Date: ${formattedDate}
Type: ${tx.type === 'incoming' ? 'PAYMENT RECEIVED' : 'PAYMENT SENT'}
Amount: ${tx.amountSats.toLocaleString()} SATS
Fiat Value: ₦${tx.amountNgn.toLocaleString()} NGN
Status: SETTLED (${tx.offline ? 'OFFLINE ECASH' : 'LIGHTNING'})
Note: ${tx.memo}
================================
Verified by BitFriend Cashu Protocol
  `.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(receiptSummaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '400px',
          width: '92%',
          background: '#0F172A',
          border: '1px solid var(--border-subtle)',
          padding: '24px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={20} color="var(--color-success)" />
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Payment Receipt</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Thermal Slip Styled Container */}
        <div
          id="printable-receipt"
          style={{
            background: '#FFFFFF',
            color: '#0F172A',
            padding: '20px',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
            fontFamily: 'monospace',
          }}
        >
          <div style={{ textAlign: 'center', borderBottom: '1px dashed #CBD5E1', paddingBottom: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.5px' }}>BITFRIEND</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>Grassroots Bitcoin Commerce</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>Kaduna Market Terminal</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>TX REF:</span>
              <span style={{ fontWeight: 700 }}>{tx.id.slice(-10)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>DATE:</span>
              <span>{formattedDate}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>METHOD:</span>
              <span style={{ fontWeight: 700 }}>{tx.offline ? 'OFFLINE ECASH' : 'LIGHTNING'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>STATUS:</span>
              <span style={{ color: '#10B981', fontWeight: 800 }}>SETTLED ✓</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>ITEM / NOTE:</span>
              <span style={{ fontWeight: 600 }}>{tx.memo}</span>
            </div>
          </div>

          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              padding: '12px',
              textAlign: 'center',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748B' }}>TOTAL PAID</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#D97706' }}>
              {tx.amountSats.toLocaleString()} sats
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
              ≈ ₦{tx.amountNgn.toLocaleString()} NGN
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <QRCodeSVG value={`bitfriend:receipt:${tx.id}:${tx.amountSats}`} size={90} />
          </div>

          <div style={{ textAlign: 'center', fontSize: '10px', color: '#94A3B8', borderTop: '1px dashed #CBD5E1', paddingTop: '8px' }}>
            Thank you for supporting African Grassroots Bitcoin Commerce!
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            className="btn-primary"
            style={{ flex: 1, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={handlePrint}
          >
            <Printer size={15} /> Print Receipt
          </button>
          <button
            className="btn-secondary"
            style={{ flex: 1, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={handleCopy}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy Text'}
          </button>
        </div>
      </div>
    </div>
  );
};

export function exportTransactionsToCsv(transactions: PaymentTransaction[]): void {
  const headers = ['ID', 'Date', 'Type', 'Amount (Sats)', 'Amount (NGN)', 'Method', 'Offline', 'Status', 'Memo'];
  const rows = transactions.map(tx => [
    tx.id,
    new Date(tx.timestamp).toISOString(),
    tx.type,
    tx.amountSats,
    tx.amountNgn,
    tx.method,
    tx.offline ? 'TRUE' : 'FALSE',
    tx.status,
    `"${tx.memo.replace(/"/g, '""')}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `bitfriend_tx_history_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
