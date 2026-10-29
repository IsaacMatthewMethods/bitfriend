import React from 'react';
import { NavLink } from 'react-router-dom';
import { Wallet, TrendingUp, Store, MessageSquare, Building2 } from 'lucide-react';
import { soundController } from '../utils/audioVoice';

export const MobileBottomNav: React.FC = () => {
  return (
    <nav className="mobile-bottom-dock">
      <NavLink
        to="/"
        end
        className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
        onClick={() => soundController.playClick()}
      >
        <div className="dock-icon">
          <Wallet size={20} />
        </div>
        <span>Portfolio</span>
      </NavLink>

      <NavLink
        to="/markets"
        className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
        onClick={() => soundController.playClick()}
      >
        <div className="dock-icon">
          <TrendingUp size={20} />
        </div>
        <span>Markets</span>
      </NavLink>

      <NavLink
        to="/pos"
        className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
        onClick={() => soundController.playClick()}
      >
        <div className="dock-icon">
          <Store size={20} />
        </div>
        <span>POS Pay</span>
      </NavLink>

      <NavLink
        to="/chat"
        className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
        onClick={() => soundController.playClick()}
      >
        <div className="dock-icon">
          <MessageSquare size={20} />
        </div>
        <span>BitChat</span>
      </NavLink>

      <NavLink
        to="/cashout"
        className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
        onClick={() => soundController.playClick()}
      >
        <div className="dock-icon">
          <Building2 size={20} />
        </div>
        <span>Cash Out</span>
      </NavLink>
    </nav>
  );
};
