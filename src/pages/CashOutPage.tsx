import React from 'react';
import { useWallet } from '../context/WalletContext';
import { WithdrawToBankModal } from '../components/WithdrawToBankModal';

export const CashOutPage: React.FC = () => {
  const { proofs, updateProofs, addTransaction, lang } = useWallet();

  return (
    <div className="page-container cashout-page">
      <div className="fintech-grid-2col">
        {/* LEFT COLUMN: AFRICAN FIAT GATEWAY WIDGET */}
        <div className="grid-col-primary">
          <WithdrawToBankModal
            isInline={true}
            vaultProofs={proofs}
            onVaultProofsChanged={updateProofs}
            onTransactionRecorded={addTransaction}
            lang={lang}
          />
        </div>

        {/* RIGHT COLUMN: SETTLEMENT INFRASTRUCTURE & PARTNERS */}
        <div className="grid-col-secondary">
          <div className="card gateway-info-card">
            <div className="card-header-between">
              <h3>African Banking Liquidity Rails</h3>
              <span className="pill-badge green">Instant NIBSS</span>
            </div>

            <p className="card-subtitle">
              BitFriend bridges self-sovereign offline Cashu and Lightning satoshis directly into local bank accounts across Nigeria, Ghana, Kenya, and East Africa with zero crypto exchange KYC friction.
            </p>

            <div className="supported-rails-list">
              <div className="rail-item">
                <div className="rail-icon">⚡</div>
                <div className="rail-details">
                  <div className="rail-name">OPay & PalmPay Instant Deposits</div>
                  <div className="rail-sub">Direct credit via NIBSS payment rails in under 3 seconds.</div>
                </div>
              </div>

              <div className="rail-item">
                <div className="rail-icon">🏦</div>
                <div className="rail-details">
                  <div className="rail-name">Moniepoint, Kuda & Commercial Banks</div>
                  <div className="rail-sub">GTBank, Access, Zenith, and First Bank real-time NUBAN resolution.</div>
                </div>
              </div>

              <div className="rail-item">
                <div className="rail-icon">📱</div>
                <div className="rail-details">
                  <div className="rail-name">Pan-African Mobile Money (M-Pesa / MoMo)</div>
                  <div className="rail-sub">Direct mobile wallet credit across Kenya and West Africa.</div>
                </div>
              </div>
            </div>

            <div className="gateway-stats-box mt-4">
              <div className="g-stat">
                <span className="g-label">Settlement Speed</span>
                <span className="g-val mono-num">&lt; 3.2s Average</span>
              </div>
              <div className="g-stat">
                <span className="g-label">NIBSS Verification</span>
                <span className="g-val mono-num">100% Automated</span>
              </div>
              <div className="g-stat">
                <span className="g-label">Gateway Status</span>
                <span className="g-val green mono-num">● Operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
