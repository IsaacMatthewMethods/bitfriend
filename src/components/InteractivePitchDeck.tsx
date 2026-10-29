import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Zap,
  ShieldCheck,
  WifiOff,
  Volume2,
  TrendingUp,
  Award,
  Layers,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { soundController } from '../utils/audioVoice';

interface Slide {
  id: number;
  tag: string;
  title: string;
  subtitle: string;
  content: React.ReactNode;
  speakerNotes: string;
}

interface InteractivePitchDeckProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InteractivePitchDeck: React.FC<InteractivePitchDeckProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showNotes, setShowNotes] = useState<boolean>(false);

  const slides: Slide[] = [
    {
      id: 1,
      tag: 'BTRUST x GDG KADUNA DEVFEST 2026',
      title: 'BitFriend (BitAboki)',
      subtitle: 'Offline Bitcoin & Chaumian Ecash for African Grassroots Commerce',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginTop: '20px' }}>
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #F7931A 0%, #FFB300 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '46px',
              fontWeight: 900,
              color: 'white',
              boxShadow: '0 0 40px rgba(247, 147, 26, 0.4)',
            }}
          >
            ₿
          </div>

          <div style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '560px', textAlign: 'center', lineHeight: 1.6 }}>
            Enabling informal market vendors in Northern Nigeria to <strong style={{ color: 'white' }}>receive instant payments</strong> and <strong style={{ color: 'white' }}>pool collective savings</strong> with zero cellular data.
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '10px' }}>
            <span style={{ background: 'rgba(247, 147, 26, 0.15)', color: 'var(--btc-orange)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 600 }}>
              ⚡ 100% Zero-Data Offline POS
            </span>
            <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#C4B5FD', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 600 }}>
              🔒 Chaumian Ecash (Cashu NUTs)
            </span>
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 600 }}>
              🇳🇬 Native Hausa Voice Receipts
            </span>
            <span style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'white', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 600 }}>
              🤝 Bitcoin Adashi (ROSCA)
            </span>
          </div>
        </div>
      ),
      speakerNotes: 'Start by welcoming the judges and stating our mission: bringing self-sovereign Bitcoin to where it matters most—the informal markets of Northern Nigeria.',
    },
    {
      id: 2,
      tag: 'THE GROUND TRUTH IN KADUNA',
      title: 'The Dual Crisis in African Markets',
      subtitle: 'Why Millions of Daily Transactions are Broken',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginTop: '16px' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)', marginBottom: '12px' }}>
              <WifiOff size={24} />
              <h4 style={{ fontSize: '16px', fontWeight: 800 }}>1. Telecom & POS Collapse</h4>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              In crowded markets like <strong>Kasuwan Barci</strong>, cellular networks jam. Card POS terminals decline transactions, and bank transfer alerts take 20-45 minutes. Merchants lose sales or fall victim to fake SMS alert scams.
            </p>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--btc-orange)', marginBottom: '12px' }}>
              <TrendingUp size={24} />
              <h4 style={{ fontSize: '16px', fontWeight: 800 }}>2. 30%+ Naira Devaluation</h4>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Market vendors rely heavily on traditional <strong>Adashi</strong> rotating savings clubs. When pooled in rapidly devaluing Naira, communal savings lose substantial purchasing power before the turn payout arrives.
            </p>
          </div>
        </div>
      ),
      speakerNotes: 'Highlight the human element: Amina at Kasuwan Barci cannot wait 30 minutes for a bank alert while customers walk away. Meanwhile, her savings melt in Naira.',
    },
    {
      id: 3,
      tag: 'THE ARCHITECTURAL INNOVATION',
      title: 'Chaumian Ecash + Lightning Architecture',
      subtitle: 'Private, Sub-Cent Bearer Tokens Built on Cashu NUT Specifications',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'rgba(247, 147, 26, 0.15)', color: 'var(--btc-orange)', padding: '10px', borderRadius: '10px' }}>
              <Zap size={22} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>NUT-00 Cryptographic Bearer Tokens</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Blind signatures allow mints to issue digital cash without linking tokens to individual merchant identities. Zero surveillance, 100% financial privacy.
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#C4B5FD', padding: '10px', borderRadius: '10px' }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>NUT-03 Powers-of-Two Binary Splitting</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Satoshis are split into binary denominations (1, 2, 4, 8, 16...). Greedy coin assembly calculates exact change with zero round-off friction.
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', padding: '10px', borderRadius: '10px' }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>NUT-04 & 05 Lightning Mint & Melt Gateway</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Merchants fund their offline vault via Lightning when connected, and sweep offline tokens back to Lightning wallets at the end of the market day.
              </div>
            </div>
          </div>
        </div>
      ),
      speakerNotes: 'Explain why Cashu is superior to on-chain or pure Lightning for Africa: zero channel opening fees, zero routing failures, and offline bearer transfers.',
    },
    {
      id: 4,
      tag: 'ACCESSIBLE MARKET UX',
      title: 'Engineered for Real African Market Realities',
      subtitle: 'Audio-First UX, Hardware Camera Scanner & Thermal Slips',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '14px' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <Volume2 size={20} color="var(--color-success)" style={{ marginBottom: '8px' }} />
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>Hausa Speech Synthesis</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              In busy stalls, looking at phone screens is inconvenient. BitFriend announces payments aloud in native Hausa: <em>"An karɓi satoshi 1,200 cikin nasara!"</em>
            </p>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <Zap size={20} color="var(--btc-orange)" style={{ marginBottom: '8px' }} />
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>HTML5 Camera QR Scanner</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              High-speed in-browser camera scanning powered by jsQR with laser targeting reticle and haptic feedback. Zero native app download needed.
            </p>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <FileText size={20} color="#C4B5FD" style={{ marginBottom: '8px' }} />
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>Thermal Slips & CSV Audit</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Vendors can print micro-POS slips with verification QR codes or export an entire monthly transaction ledger as a CSV spreadsheet.
            </p>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <ShieldCheck size={20} color="var(--btc-gold)" style={{ marginBottom: '8px' }} />
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>BIP-39 Vault Disaster Recovery</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              12-word cryptographic recovery phrase backup ensures merchants never lose bearer satoshis if their device breaks.
            </p>
          </div>
        </div>
      ),
      speakerNotes: 'Demonstrate our attention to detail: the Hausa voice receipt is phonetic, the camera scanner works on budget Android phones, and the thermal slip works with standard mini-printers.',
    },
    {
      id: 5,
      tag: 'THE CULTURAL HOOK',
      title: 'Decentralized Bitcoin Adashi (ROSCA)',
      subtitle: 'Upgrading Traditional African Communal Savings to Hard Money',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-focus)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>
                Traditional Adashi vs. BitFriend Bitcoin Adashi
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 700 }}>
                100% Inflation Shielded
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              In traditional Adashi, the last person to receive the pot loses 30% of its value to inflation. In BitFriend, contributions and payouts are held in <strong>Satoshis</strong>. Collective community wealth appreciates over time rather than melting away.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--btc-orange)' }}>Automated</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Round Rotations & Tracking</div>
            </div>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-success)' }}>Zero Default</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Direct Vault Settlement</div>
            </div>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#C4B5FD' }}>Customizable</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Any Union, Club, or Trade</div>
            </div>
          </div>
        </div>
      ),
      speakerNotes: 'This is the killer cultural fit: we didn’t invent a new Western financial product; we took a 100-year-old West African practice and supercharged it with Bitcoin.',
    },
    {
      id: 6,
      tag: 'COMPETITIVE ADVANTAGE',
      title: 'Why BitFriend Beats Industry Solutions',
      subtitle: 'Comparison Against Machankura, Minibits, and Breez POS',
      content: (
        <div style={{ overflowX: 'auto', marginTop: '14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px' }}>Capability</th>
                <th style={{ padding: '8px', color: 'var(--btc-orange)' }}>BitFriend</th>
                <th style={{ padding: '8px' }}>Machankura</th>
                <th style={{ padding: '8px' }}>Breez POS</th>
                <th style={{ padding: '8px' }}>Minibits</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>Zero-Data Offline POS</td>
                <td style={{ padding: '8px', color: 'var(--color-success)', fontWeight: 700 }}>✓ 100% Offline</td>
                <td style={{ padding: '8px', color: 'var(--text-muted)' }}>GSM/SMS only</td>
                <td style={{ padding: '8px', color: 'var(--color-danger)' }}>✗ Needs 4G</td>
                <td style={{ padding: '8px', color: '#FCD34D' }}>Partial</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>Channel / Account Fees</td>
                <td style={{ padding: '8px', color: 'var(--color-success)', fontWeight: 700 }}>₦0 Free</td>
                <td style={{ padding: '8px', color: 'var(--color-danger)' }}>Telco SMS Fees</td>
                <td style={{ padding: '8px', color: 'var(--color-danger)' }}>$2-$5 / Channel</td>
                <td style={{ padding: '8px', color: 'var(--color-success)' }}>₦0 Free</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>Hausa Audio Voice Receipts</td>
                <td style={{ padding: '8px', color: 'var(--color-success)', fontWeight: 700 }}>✓ Built-In</td>
                <td style={{ padding: '8px', color: 'var(--color-danger)' }}>✗ None</td>
                <td style={{ padding: '8px', color: 'var(--color-danger)' }}>✗ None</td>
                <td style={{ padding: '8px', color: 'var(--color-danger)' }}>✗ None</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>Adashi (ROSCA) Engine</td>
                <td style={{ padding: '8px', color: 'var(--color-success)', fontWeight: 700 }}>✓ Native Circles</td>
                <td style={{ padding: '8px', color: 'var(--color-danger)' }}>✗ None</td>
                <td style={{ padding: '8px', color: 'var(--color-danger)' }}>✗ None</td>
                <td style={{ padding: '8px', color: 'var(--color-danger)' }}>✗ None</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', fontWeight: 600 }}>WebLN & Lightning Address</td>
                <td style={{ padding: '8px', color: 'var(--color-success)', fontWeight: 700 }}>✓ Both Built-In</td>
                <td style={{ padding: '8px', color: 'var(--text-muted)' }}>Address only</td>
                <td style={{ padding: '8px', color: '#FCD34D' }}>LN Node</td>
                <td style={{ padding: '8px', color: 'var(--text-muted)' }}>Address only</td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
      speakerNotes: 'Point out our unfair advantages: Breez is too expensive for $1 transactions. Machankura is centralized. Minibits lacks the merchant POS and Adashi cultural features.',
    },
    {
      id: 7,
      tag: 'BTRUST MISSION ALIGNMENT',
      title: 'Empowering FOSS Bitcoin in the Global South',
      subtitle: 'Grassroots Rollout & Open-Source Community Roadmap',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '16px' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--btc-orange)', marginBottom: '4px' }}>Phase 1: Kaduna Pilot</div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Deploy 50 vendor test terminals across Kasuwan Barci fabric market and Doka tricycle hubs in partnership with local cooperative executives.
            </p>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-success)', marginBottom: '4px' }}>Phase 2: Federation Mints</div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Enable market trade associations to operate community-backed Cashu mints, removing single-custodian risks and ensuring 99.9% uptime.
            </p>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#C4B5FD', marginBottom: '4px' }}>Phase 3: FOSS Ecosystem</div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Publish the open-source offline Cashu audio synthesizer and Adashi engine for other African Bitcoin builders via Btrust open-source grants.
            </p>
          </div>
        </div>
      ),
      speakerNotes: 'Connect directly to Btrust’s founding mandate: self-sovereign, open-source Bitcoin tooling created by and for the Global South.',
    },
    {
      id: 8,
      tag: 'LIVE DEMONSTRATION',
      title: 'Ready for Live Demo',
      subtitle: 'Experience BitFriend in Real Time',
      content: (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>
            Interactive Demo Flow for Judges:
          </div>
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '10px', textAlign: 'left', maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span style={{ background: 'var(--btc-orange)', color: 'black', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11px' }}>1</span>
              Simulate Network Outage & Tap-to-Pay (Listen to Hausa Voice Receipt)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span style={{ background: 'var(--btc-orange)', color: 'black', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11px' }}>2</span>
              Open Hardware Camera QR Scanner & Scan Customer Voucher
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span style={{ background: 'var(--btc-orange)', color: 'black', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11px' }}>3</span>
              Contribute Share & Trigger Round Payout in Bitcoin Adashi Circle
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span style={{ background: 'var(--btc-orange)', color: 'black', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11px' }}>4</span>
              View Printable Thermal Receipt Slip and Export CSV Audit Trail
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <button
              className="btn-primary"
              style={{ padding: '12px 28px', fontSize: '15px' }}
              onClick={onClose}
            >
              Close Pitch Deck & Launch Live Demo
            </button>
          </div>
        </div>
      ),
      speakerNotes: 'Conclude with confidence and transition directly to the live app demonstration.',
    },
  ];

  const totalSlides = slides.length;
  const current = slides[currentSlide];

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(prev => prev + 1);
      soundController.playClick();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
      soundController.playClick();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSlide]);

  if (!isOpen) return null;

  const progressPercent = ((currentSlide + 1) / totalSlides) * 100;

  return (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 99999,
        background: 'rgba(5, 8, 16, 0.95)',
        backdropFilter: 'blur(14px)',
        padding: isFullscreen ? '0' : '20px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: isFullscreen ? '100vw' : '880px',
          width: isFullscreen ? '100vw' : '94%',
          height: isFullscreen ? '100vh' : 'auto',
          maxHeight: isFullscreen ? '100vh' : '92vh',
          borderRadius: isFullscreen ? '0' : 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '28px',
          background: '#0B0F19',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, var(--btc-orange), var(--color-success))',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Top Controls Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={20} color="var(--btc-orange)" />
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: 'var(--btc-orange)' }}>
              {current.tag}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="ctrl-btn"
              onClick={() => setShowNotes(!showNotes)}
              title="Toggle Speaker Notes"
              style={{ fontSize: '11px', padding: '4px 8px', width: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: showNotes ? 'var(--btc-orange)' : 'var(--text-muted)' }}
            >
              <FileText size={13} /> {showNotes ? 'Hide Notes' : 'Speaker Notes'}
            </button>

            <button
              className="ctrl-btn"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            <button className="modal-close-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Slide Title & Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          <h2 style={{ fontSize: '26px', fontWeight: 900, color: 'white', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            {current.title}
          </h2>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            {current.subtitle}
          </div>

          {current.content}

          {/* Speaker Notes Drawer */}
          {showNotes && (
            <div
              style={{
                marginTop: '20px',
                padding: '12px 16px',
                background: 'rgba(247, 147, 26, 0.08)',
                border: '1px solid rgba(247, 147, 26, 0.3)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                color: '#FDE68A',
                lineHeight: 1.5,
              }}
            >
              <strong>🎤 Speaker Guidance:</strong> {current.speakerNotes}
            </div>
          )}
        </div>

        {/* Slide Footer Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentSlide(idx);
                  soundController.playClick();
                }}
                style={{
                  width: idx === currentSlide ? '22px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: idx === currentSlide ? 'var(--btc-orange)' : 'rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.2s ease',
                  padding: 0,
                }}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              Slide {currentSlide + 1} of {totalSlides}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
              disabled={currentSlide === 0}
              onClick={handlePrev}
            >
              <ChevronLeft size={16} /> Prev
            </button>

            <button
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
              disabled={currentSlide === totalSlides - 1}
              onClick={handleNext}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
