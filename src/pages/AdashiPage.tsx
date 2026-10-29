import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Plus,
  Zap,
  Award,
  Check,
  Sparkles,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useMarket } from '../context/MarketContext';
import { soundController } from '../utils/audioVoice';
import { broadcastAdashiEvent } from '../utils/nostrClient';
import { CreateAdashiModal } from '../components/CreateAdashiModal';
import type { AdashiCircle } from '../types';

export const AdashiPage: React.FC = () => {
  const { circles, updateCircles, spendFromVault } = useWallet();
  const { satsToNgn } = useMarket();

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [adashiNotice, setAdashiNotice] = useState<string>('');

  const handleContribute = (circleId: string) => {
    const circle = circles.find((c) => c.id === circleId);
    if (!circle) return;

    const spendRes = spendFromVault(circle.contributionSats);
    if (!spendRes.success) {
      setAdashiNotice('Insufficient vault balance to contribute.');
      setTimeout(() => setAdashiNotice(''), 4000);
      return;
    }

    const updated = circles.map((c) => {
      if (c.id !== circleId) return c;
      const updatedMembers = c.members.map((m) => {
        if (m.name.includes('(You)')) return { ...m, hasContributed: true };
        return m;
      });
      return { ...c, members: updatedMembers };
    });

    updateCircles(updated);
    soundController.playPaymentChime();
    confetti({ particleCount: 50, spread: 60 });
    setAdashiNotice(`Contributed ${circle.contributionSats.toLocaleString()} sats to "${circle.name}"!`);
    setTimeout(() => setAdashiNotice(''), 5000);

    // Broadcast over Nostr P2P
    broadcastAdashiEvent({
      action: 'contribute',
      circleId,
      circleName: circle.name,
      round: circle.currentRound,
      memberId: 'm3',
      memberName: 'Amina Garba (You)',
      amountSats: circle.contributionSats,
      timestamp: Date.now(),
    }).catch(console.warn);
  };

  const handleTriggerPayout = (circleId: string) => {
    const circle = circles.find((c) => c.id === circleId);
    if (!circle) return;

    const currentRecipient = circle.members.find((m) => m.isCurrentRecipient) || circle.members[0];
    const totalPot = circle.contributionSats * circle.members.length;

    const nextRound = circle.currentRound + 1;
    const nextTurn = (circle.currentRound % circle.members.length) + 1;

    const updated = circles.map((c) => {
      if (c.id !== circleId) return c;
      const updatedMembers = c.members.map((m) => ({
        ...m,
        hasContributed: false,
        isCurrentRecipient: m.turnOrder === nextTurn,
      }));
      return {
        ...c,
        currentRound: nextRound <= c.totalRounds ? nextRound : 1,
        members: updatedMembers,
      };
    });

    updateCircles(updated);
    soundController.playPaymentChime();
    confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 } });
    setAdashiNotice(`Payout of ${totalPot.toLocaleString()} sats released to ${currentRecipient.name}!`);
    setTimeout(() => setAdashiNotice(''), 5000);

    // Broadcast over Nostr P2P
    broadcastAdashiEvent({
      action: 'turn_payout',
      circleId,
      circleName: circle.name,
      round: circle.currentRound,
      memberId: currentRecipient.id,
      memberName: currentRecipient.name,
      amountSats: totalPot,
      timestamp: Date.now(),
    }).catch(console.warn);
  };

  const handleCircleCreated = (newCircle: AdashiCircle) => {
    updateCircles([newCircle, ...circles]);
    soundController.playPaymentChime();
    confetti({ particleCount: 60, spread: 70 });
    setAdashiNotice(`Launched new cooperative pot: "${newCircle.name}"!`);
    setTimeout(() => setAdashiNotice(''), 5000);
  };

  return (
    <div className="page-container adashi-page">
      <div className="card-header-between mb-4">
        <div>
          <h2>Bitcoin Adashi (Rotating Savings Cooperative)</h2>
          <p className="card-subtitle">
            Traditional African ROSCA microfinance upgraded to sound Bitcoin bearer money to defeat inflation.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={16} />
          <span>Start New Cooperative Pot</span>
        </button>
      </div>

      {adashiNotice && (
        <div className="status-banner success mb-4">
          <Sparkles size={16} />
          <span>{adashiNotice}</span>
        </div>
      )}

      {/* Circles Grid */}
      <div className="adashi-circles-list">
        {circles.map((circle) => {
          const totalPot = circle.contributionSats * circle.members.length;
          const potNgn = satsToNgn(totalPot);
          const currentRecipient = circle.members.find((m) => m.isCurrentRecipient) || circle.members[0];
          const hasUserPaid = circle.members.some((m) => m.name.includes('(You)') && m.hasContributed);
          const progressPct = Math.round((circle.currentRound / circle.totalRounds) * 100);

          return (
            <div key={circle.id} className="card adashi-circle-card">
              <div className="card-header-between">
                <div>
                  <h3 className="circle-title">{circle.name}</h3>
                  <div className="circle-meta">
                    <span className="category-tag">{circle.category}</span>
                    <span>•</span>
                    <span className="freq-tag">{circle.frequency} rotation</span>
                  </div>
                </div>

                <div className="pot-display text-right">
                  <div className="pot-sats mono-num">{totalPot.toLocaleString()} sats</div>
                  <div className="pot-ngn mono-num">≈ ₦{potNgn.toLocaleString()} per round</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="round-progress-box">
                <div className="progress-labels">
                  <span>Round {circle.currentRound} of {circle.totalRounds}</span>
                  <span>Next Payout: {circle.nextPayoutDate}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              {/* Members Rotation Roster */}
              <div className="members-section">
                <div className="section-label">Cooperative Members & Turn Order:</div>
                <div className="members-chips-wrap">
                  {circle.members.map((m) => (
                    <div
                      key={m.id}
                      className={`member-badge-chip ${m.isCurrentRecipient ? 'recipient' : ''} ${m.hasContributed ? 'paid' : ''}`}
                    >
                      <div className="member-avatar">{m.avatar}</div>
                      <span className="member-name">{m.name}</span>
                      {m.isCurrentRecipient && (
                        <span className="turn-tag">Turn #{m.turnOrder}</span>
                      )}
                      {m.hasContributed && <Check size={14} className="paid-icon" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Row */}
              <div className="circle-actions-row">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={hasUserPaid}
                  onClick={() => handleContribute(circle.id)}
                >
                  <Zap size={16} />
                  <span>
                    {hasUserPaid ? 'You Have Contributed for this Round' : `Contribute ${circle.contributionSats.toLocaleString()} sats`}
                  </span>
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleTriggerPayout(circle.id)}
                >
                  <Award size={16} />
                  <span>Distribute Payout to {currentRecipient.name.split(' ')[0]}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: CREATE ADASHI CIRCLE */}
      <CreateAdashiModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCircleCreated={handleCircleCreated}
      />
    </div>
  );
};
