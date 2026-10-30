import React from 'react';
import { Zap, Landmark, Smartphone } from 'lucide-react';
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

        {/* RIGHT COLUMN: SETTLEMENT RAILS */}
        <div className="grid-col-secondary">
          <div className="card gateway-info-card">
            <div className="card-header-between">
              <h3 className="section-heading-clean">Settlement Rails</h3>
              <span className="pill-badge green">NIBSS Direct</span>
            </div>

            <div className="supported-rails-list">
              <div className="rail-item">
                <div className="rail-icon"><Zap size={18} /></div>
                <div className="rail-details">
                  <div className="rail-name">OPay & PalmPay Instant Credit</div>
                  <div className="rail-sub">Direct NIBSS settlement in under 3 seconds.</div>
                </div>
              </div>

              <div className="rail-item">
                <div className="rail-icon"><Landmark size={18} /></div>
                <div className="rail-details">
                  <div className="rail-name">Moniepoint, Kuda & Commercial Banks</div>
                  <div className="rail-sub">GTBank, Access, Zenith & First Bank NUBAN lookup.</div>
                </div>
              </div>

              <div className="rail-item">
                <div className="rail-icon"><Smartphone size={18} /></div>
                <div className="rail-details">
                  <div className="rail-name">Pan-African Mobile Money</div>
                  <div className="rail-sub">M-Pesa and MTN MoMo wallet settlement.</div>
                </div>
              </div>
            </div>

            <div className="gateway-stats-box mt-4">
              <div className="g-stat">
                <span className="g-label">Avg Speed</span>
                <span className="g-val mono-num">2.8s</span>
              </div>
              <div className="g-stat">
                <span className="g-label">Verification</span>
                <span className="g-val mono-num">NIBSS NUBAN</span>
              </div>
              <div className="g-stat">
                <span className="g-label">Status</span>
                <span className="g-val green mono-num">● Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
