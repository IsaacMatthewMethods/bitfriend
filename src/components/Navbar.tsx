import React from 'react';
import { NavLink, Link } from 'react-router-dom';
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
  CheckCircle,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useMarket } from '../context/MarketContext';
import { soundController } from '../utils/audioVoice';

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

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundController.enabled = next;
  };

  return (
    <header className="fintech-navbar">
      <div className="navbar-container">
        {/* Left: Brand Logo & Live Binance Ticker */}
        <div className="navbar-brand-section">
          <Link to="/" className="brand-logo-wrap">
            <div className="brand-icon">₿</div>
            <div className="brand-text">
              <span className="brand-title">BitFriend</span>
              <span className="brand-badge">PRO</span>
            </div>
          </Link>

          {/* Live Binance Price Pill */}
          <div className="navbar-market-pill">
            <span className={`live-dot ${isLiveConnected ? 'pulsing' : ''}`} />
            <span className="symbol">BTC/USDT</span>
            <span className={`live-price ${priceDirection}`}>
              ${btcPriceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`change-badge ${priceChange24h >= 0 ? 'pos' : 'neg'}`}>
              {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="navbar-nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Wallet size={16} />
            <span>Portfolio</span>
          </NavLink>

          <NavLink to="/markets" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <TrendingUp size={16} />
            <span>Markets</span>
          </NavLink>

          <NavLink to="/pos" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Store size={16} />
            <span>Merchant POS</span>
          </NavLink>

          <NavLink to="/chat" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <MessageSquare size={16} />
            <span>BitChat</span>
          </NavLink>

          <NavLink to="/adashi" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Users size={16} />
            <span>Adashi Pool</span>
          </NavLink>

          <NavLink to="/cashout" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Building2 size={16} />
            <span>Cash Out</span>
          </NavLink>

          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={16} />
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Right: Actions, Network Status & Profile */}
        <div className="navbar-actions">
          {/* Network Outage Simulator / Status */}
          <button
            type="button"
            className={`status-chip ${isOffline ? 'offline' : 'online'}`}
            onClick={() => setIsOffline(!isOffline)}
            title="Click to simulate offline network outage"
          >
            {isOffline ? <WifiOff size={13} /> : <Wifi size={13} />}
            <span>{isOffline ? 'Offline' : 'Online'}</span>
          </button>

          {/* Language Toggle */}
          <button
            type="button"
            className="action-btn-pill"
            onClick={() => setLang(lang === 'en' ? 'ha' : 'en')}
            title="Toggle English / Hausa"
          >
            {lang === 'en' ? 'NG HA' : 'EN'}
          </button>

          {/* Audio Chime Toggle */}
          <button
            type="button"
            className="action-icon-btn"
            onClick={toggleSound}
            title={soundEnabled ? 'Voice receipts active' : 'Voice receipts muted'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Lock Vault */}
          <button
            type="button"
            className="action-icon-btn"
            onClick={() => setIsLocked(true)}
            title="Lock Vault with PIN"
          >
            <Lock size={16} />
          </button>

          {/* User Profile Badge */}
          <Link to="/settings" className="nav-profile-chip">
            <div className="profile-avatar">{userProfile.name.charAt(0) || 'B'}</div>
            <div className="profile-info">
              <span className="profile-name">
                {userProfile.name}
                {userProfile.isVerified && <CheckCircle size={12} className="verified-icon" />}
              </span>
              <span className="profile-sub">⚡ {userProfile.lightningAddress}</span>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
};
