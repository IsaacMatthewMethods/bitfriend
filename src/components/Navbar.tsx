import React from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  Store,
  MessageSquare,
  Users,
  Building2,
  Settings,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Lock,
  CheckCircle2,
  ArrowLeft,
  SlidersHorizontal,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useMarket } from '../context/MarketContext';
import { soundController } from '../utils/audioVoice';

const MOBILE_PAGE_TITLES: Record<string, { en: string; ha: string }> = {
  '/markets': { en: 'Markets & FX', ha: 'Kasuwa & Canji' },
  '/pos': { en: 'Merchant POS', ha: 'Kantin POS' },
  '/chat': { en: 'BitChat', ha: 'BitChat' },
  '/adashi': { en: 'Adashi Circles', ha: 'Adashi' },
  '/cashout': { en: 'Bank Transfer', ha: 'Cire Kudi' },
  '/settings': { en: 'Account & Security', ha: 'Tsaro & Saituna' },
};

export const Navbar: React.FC = () => {
  const {
    userProfile,
    isOffline,
    setIsOffline,
    lang,
    setLang,
    soundEnabled,
    setSoundEnabled,
    setIsLocked,
  } = useWallet();

  const { btcPriceUsd, priceChange24h, priceDirection, isLiveConnected } = useMarket();
  const location = useLocation();
  const navigate = useNavigate();

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundController.enabled = next;
  };

  const isHome = location.pathname === '/';
  const currentTitleObj = MOBILE_PAGE_TITLES[location.pathname];
  const mobileTitle = currentTitleObj
    ? lang === 'ha'
      ? currentTitleObj.ha
      : currentTitleObj.en
    : 'BitFriend';

  return (
    <>
      {/* DESKTOP TOP NAVIGATION BAR (PC / Large Screens Only) */}
      <header className="fintech-navbar desktop-only-nav">
        <div className="navbar-container">
          <div className="navbar-brand-section">
            <Link to="/" className="brand-logo-wrap">
              <div className="brand-icon">₿</div>
              <div className="brand-text">
                <span className="brand-title">BitFriend</span>
              </div>
            </Link>

            <div className="navbar-market-pill">
              <span className={`live-dot ${isLiveConnected ? 'pulsing' : ''}`} />
              <span className="symbol">BTC/USD</span>
              <span className={`live-price mono-num ${priceDirection}`}>
                ${btcPriceUsd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className={`change-badge mono-num ${priceChange24h >= 0 ? 'pos' : 'neg'}`}>
                {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
              </span>
            </div>
          </div>

          <nav className="navbar-nav-links">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Wallet size={15} />
              <span>Wallet</span>
            </NavLink>
            <NavLink to="/markets" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <TrendingUp size={15} />
              <span>Markets</span>
            </NavLink>
            <NavLink to="/pos" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Store size={15} />
              <span>POS Terminal</span>
            </NavLink>
            <NavLink to="/chat" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <MessageSquare size={15} />
              <span>BitChat</span>
            </NavLink>
            <NavLink to="/adashi" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Users size={15} />
              <span>Adashi</span>
            </NavLink>
            <NavLink to="/cashout" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Building2 size={15} />
              <span>Transfer</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Settings size={15} />
              <span>Settings</span>
            </NavLink>
          </nav>

          <div className="navbar-actions">
            <button
              type="button"
              className={`status-chip ${isOffline ? 'offline' : 'online'}`}
              onClick={() => setIsOffline(!isOffline)}
              title="Toggle Offline Mode"
            >
              {isOffline ? <WifiOff size={13} /> : <Wifi size={13} />}
              <span>{isOffline ? 'Offline' : 'Online'}</span>
            </button>

            <button
              type="button"
              className="action-btn-pill"
              onClick={() => setLang(lang === 'en' ? 'ha' : 'en')}
            >
              {lang === 'en' ? 'HA' : 'EN'}
            </button>

            <button
              type="button"
              className="action-icon-btn"
              onClick={toggleSound}
              title={soundEnabled ? 'Mute voice receipts' : 'Enable voice receipts'}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>

            <button
              type="button"
              className="action-icon-btn"
              onClick={() => setIsLocked(true)}
              title="Lock Vault"
            >
              <Lock size={15} />
            </button>

            <Link to="/settings" className="nav-profile-chip">
              <div className="profile-avatar">{userProfile.name.charAt(0) || 'B'}</div>
              <div className="profile-info">
                <span className="profile-name">
                  {userProfile.name}
                  {userProfile.isVerified && <CheckCircle2 size={12} className="verified-icon" />}
                </span>
                <span className="profile-sub">{userProfile.lightningAddress}</span>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* NATIVE MOBILE STATUS / APP BAR (Mobile & Android APK Only) */}
      <header className="mobile-native-topbar">
        {isHome ? (
          <Link to="/settings" className="mobile-user-greeting">
            <div className="mobile-avatar-ring">
              <span>{userProfile.name.charAt(0) || 'B'}</span>
              <span className={`avatar-status-dot ${isOffline ? 'offline' : 'online'}`} />
            </div>
            <div className="mobile-user-meta">
              <div className="mobile-user-name">
                <span>{userProfile.name}</span>
                {userProfile.isVerified && <CheckCircle2 size={13} className="verified-icon" />}
              </div>
              <div className="mobile-user-handle">@{userProfile.lightningAddress.split('@')[0].split('.')[0]}</div>
            </div>
          </Link>
        ) : (
          <div className="mobile-screen-title-group">
            <button
              type="button"
              className="mobile-back-btn"
              onClick={() => navigate('/')}
              aria-label="Back to Wallet"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="mobile-screen-title">{mobileTitle}</h1>
          </div>
        )}

        <div className="mobile-topbar-utilities">
          <button
            type="button"
            className={`mobile-net-pill ${isOffline ? 'offline' : 'online'}`}
            onClick={() => setIsOffline(!isOffline)}
          >
            <span className="net-dot" />
            <span>{isOffline ? 'Mesh' : 'Live'}</span>
          </button>

          <button
            type="button"
            className="mobile-util-btn"
            onClick={() => setLang(lang === 'en' ? 'ha' : 'en')}
            title="Switch Language"
          >
            <span className="lang-code">{lang.toUpperCase()}</span>
          </button>

          <button
            type="button"
            className="mobile-util-btn"
            onClick={toggleSound}
            title="Audio Chime"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            type="button"
            className="mobile-util-btn"
            onClick={() => setIsLocked(true)}
            title="Lock App"
          >
            <Lock size={16} />
          </button>

          {location.pathname !== '/settings' && (
            <Link to="/settings" className="mobile-util-btn" title="Settings">
              <SlidersHorizontal size={16} />
            </Link>
          )}
        </div>
      </header>
    </>
  );
};
