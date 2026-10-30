import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MarketProvider } from './context/MarketContext';
import { WalletProvider, useWallet } from './context/WalletContext';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { WalletPage } from './pages/WalletPage';
import { MarketsPage } from './pages/MarketsPage';
import { PosPage } from './pages/PosPage';
import { ChatPage } from './pages/ChatPage';
import { AdashiPage } from './pages/AdashiPage';
import { CashOutPage } from './pages/CashOutPage';
import { SettingsPage } from './pages/SettingsPage';
import { PinLockModal } from './components/PinLockModal';
import { SovereignAuthScreen } from './components/SovereignAuthScreen';
import './App.css';

const AppLayout: React.FC = () => {
  const { userProfile, isLocked, setIsLocked, lang } = useWallet();

  if (!userProfile.isOnboarded) {
    return <SovereignAuthScreen />;
  }

  return (
    <div className="fintech-app-wrapper">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Page Routing View */}
      <main className="fintech-main-content">
        <Routes>
          <Route path="/" element={<WalletPage />} />
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/adashi" element={<AdashiPage />} />
          <Route path="/cashout" element={<CashOutPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Mobile Fixed Bottom Dock */}
      <MobileBottomNav />

      {/* Security Master PIN Unlock Screen (when locked) */}
      {isLocked && (
        <PinLockModal
          isOpen={isLocked}
          onSuccess={() => setIsLocked(false)}
          onClose={() => setIsLocked(false)}
          lang={lang}
          allowDismiss={true}
          initialMode="unlock"
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <MarketProvider>
      <WalletProvider>
        <Router>
          <AppLayout />
        </Router>
      </WalletProvider>
    </MarketProvider>
  );
};

export default App;
