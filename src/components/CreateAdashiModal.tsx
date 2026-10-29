import React, { useState } from 'react';
import { X, Users, Plus, Trash2, Sparkles } from 'lucide-react';
import type { AdashiCircle, AdashiMember } from '../types';
import { satsToNgn } from '../utils/cashuEngine';

interface CreateAdashiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCircleCreated: (circle: AdashiCircle) => void;
}

export const CreateAdashiModal: React.FC<CreateAdashiModalProps> = ({
  isOpen,
  onClose,
  onCircleCreated,
}) => {
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('Market Traders Cooperative');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [contributionSats, setContributionSats] = useState<string>('1500');

  const [members, setMembers] = useState<Array<{ name: string; location: string }>>([
    { name: 'You (Organizer)', location: 'Central Hub' },
    { name: 'Amina Lawal', location: 'North Market' },
    { name: 'Ibrahim Danjuma', location: 'West Terminal' },
  ]);

  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberLocation, setNewMemberLocation] = useState<string>('');

  if (!isOpen) return null;

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    setMembers(prev => [
      ...prev,
      {
        name: newMemberName.trim(),
        location: newMemberLocation.trim() || 'Market Hub',
      },
    ]);
    setNewMemberName('');
    setNewMemberLocation('');
  };

  const handleRemoveMember = (idx: number) => {
    if (members.length <= 2) {
      alert('An Adashi circle requires at least 2 members.');
      return;
    }
    setMembers(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter an Adashi Circle name.');
      return;
    }
    const sats = parseInt(contributionSats, 10);
    if (isNaN(sats) || sats <= 0) {
      alert('Please enter a valid contribution amount in satoshis.');
      return;
    }

    const createdMembers: AdashiMember[] = members.map((m, idx) => {
      const parts = m.name.split(' ');
      const avatar = parts.length > 1
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : m.name.slice(0, 2).toUpperCase();

      return {
        id: `mem-${Date.now()}-${idx}`,
        name: m.name,
        location: m.location,
        avatar,
        hasContributed: false,
        turnOrder: idx + 1,
        isCurrentRecipient: idx === 0,
      };
    });

    const newCircle: AdashiCircle = {
      id: `circle-${Date.now()}`,
      name: name.trim(),
      category,
      frequency,
      contributionSats: sats,
      currentRound: 1,
      totalRounds: createdMembers.length,
      nextPayoutDate: frequency === 'daily' ? 'Tomorrow, 5:00 PM' : 'Next Monday, 10:00 AM',
      members: createdMembers,
    };

    onCircleCreated(newCircle);
    onClose();
  };

  const parsedSats = parseInt(contributionSats, 10) || 0;
  const potTotalSats = parsedSats * members.length;
  const potTotalNgn = satsToNgn(potTotalSats);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '540px', width: '92%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="var(--btc-orange)" />
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Create New Adashi Savings Circle</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Circle Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Panteka Metalworkers Savings Pool"
              required
              style={{
                width: '100%',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                color: 'white',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Cooperative Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  color: 'white',
                  fontSize: '13px',
                }}
              >
                <option value="Market Traders Cooperative">Market Traders</option>
                <option value="Transport & Logistics Union">Transport Union (Keke/Taxi)</option>
                <option value="Women Farmers Collective">Women Farmers Collective</option>
                <option value="Artisans & Craftsmen Guild">Artisans & Craftsmen</option>
                <option value="Youth & Tech Creators">Youth & Tech Guild</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Rotation Frequency
              </label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  color: 'white',
                  fontSize: '13px',
                }}
              >
                <option value="daily">Daily Rotation</option>
                <option value="weekly">Weekly Rotation</option>
                <option value="monthly">Monthly Rotation</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Contribution per Member (Satoshis)
            </label>
            <input
              type="number"
              value={contributionSats}
              onChange={e => setContributionSats(e.target.value)}
              placeholder="1500"
              required
              style={{
                width: '100%',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                color: 'white',
                fontSize: '14px',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          {/* Pot Preview Box */}
          <div style={{ background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Estimated Round Pot</div>
              <div className="mono-num" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--btc-orange)' }}>
                {potTotalSats.toLocaleString()} sats
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Naira Equivalent</div>
              <div className="mono-num" style={{ fontSize: '15px', color: 'var(--color-success)', fontWeight: 700 }}>
                ≈ ₦{potTotalNgn.toLocaleString()} NGN
              </div>
            </div>
          </div>

          {/* Members List */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Roster & Rotation Order ({members.length} members)
            </label>
            <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {members.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', background: 'var(--bg-card-hover)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px' }}>
                      #{idx + 1}
                    </span>
                    <span style={{ fontWeight: 600 }}>{m.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({m.location})</span>
                  </div>
                  {members.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      style={{ background: 'transparent', color: 'var(--color-danger)', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add member inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr auto', gap: '8px' }}>
              <input
                type="text"
                placeholder="New Member Name"
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 10px',
                  color: 'white',
                  fontSize: '12px',
                }}
              />
              <input
                type="text"
                placeholder="Location (e.g. Kawo)"
                value={newMemberLocation}
                onChange={e => setNewMemberLocation(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 10px',
                  color: 'white',
                  fontSize: '12px',
                }}
              />
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '8px 12px', fontSize: '12px' }}
                onClick={handleAddMember}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: '8px', padding: '12px', fontSize: '15px' }}
          >
            <Sparkles size={16} /> Launch Adashi Savings Circle
          </button>
        </form>
      </div>
    </div>
  );
};
