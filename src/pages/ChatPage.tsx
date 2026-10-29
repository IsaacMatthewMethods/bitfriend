import React from 'react';
import { useWallet } from '../context/WalletContext';
import { BitChatView } from '../components/chat/BitChatView';

export const ChatPage: React.FC = () => {
  const { lang, proofs, updateProofs, isOffline } = useWallet();

  return (
    <div className="page-container chat-page-container">
      <div className="chat-full-wrapper">
        <BitChatView
          lang={lang}
          vaultProofs={proofs}
          onVaultProofsChanged={updateProofs}
          isOffline={isOffline}
        />
      </div>
    </div>
  );
};
