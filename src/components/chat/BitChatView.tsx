import React, { useState, useEffect } from 'react';
import {
  Search,
  UserPlus,
  Zap,
  Clock,
  X
} from 'lucide-react';
import type { ChatContact, CashuProof, Language } from '../../types';
import { ChatConversation } from './ChatConversation';
import {
  getSecureContacts,
  saveSecureContacts,
  getOfflineMessageQueue
} from '../../utils/secureStorage';
import { ApiClient } from '../../services/apiClient';
import { soundController } from '../../utils/audioVoice';

interface BitChatViewProps {
  lang: Language;
  vaultProofs: CashuProof[];
  onVaultProofsChanged: (proofs: CashuProof[]) => void;
  isOffline: boolean;
}

export const BitChatView: React.FC<BitChatViewProps> = ({
  lang,
  vaultProofs,
  onVaultProofsChanged,
  isOffline,
}) => {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [offlineQueuedCount, setOfflineQueuedCount] = useState<number>(0);
  const [showAddContactModal, setShowAddContactModal] = useState<boolean>(false);
  const [isMobileView, setIsMobileView] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  // New Contact form state
  const [newName, setNewName] = useState<string>('');
  const [newHandle, setNewHandle] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const onResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', onResize);

    // Load contacts from SQLite backend first, fallback to IndexedDB
    (async () => {
      try {
        const remoteContacts = await ApiClient.getChatContacts();
        if (mounted && Array.isArray(remoteContacts) && remoteContacts.length > 0) {
          setContacts(remoteContacts);
          saveSecureContacts(remoteContacts).catch(() => {});
          if (!selectedContact && window.innerWidth >= 768) {
            setSelectedContact(remoteContacts[0]);
          }
          return;
        }
      } catch {
        // Offline fallback
      }
      const localContacts = await getSecureContacts();
      if (mounted) {
        setContacts(localContacts);
        if (localContacts.length > 0 && !selectedContact && window.innerWidth >= 768) {
          setSelectedContact(localContacts[0]);
        }
      }
    })();

    getOfflineMessageQueue().then(queue => {
      if (mounted) setOfflineQueuedCount(queue.length);
    });

    return () => {
      mounted = false;
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const handleSelectContact = (c: ChatContact) => {
    soundController.playClick();
    setSelectedContact(c);
    // Mark as read
    if (c.unreadCount > 0) {
      const updated = contacts.map(item =>
        item.id === c.id ? { ...item, unreadCount: 0 } : item
      );
      setContacts(updated);
      saveSecureContacts(updated);
    }
  };

  const handleAddContact = () => {
    if (!newName.trim()) return;

    soundController.playPaymentChime();
    const initials = newName
      .trim()
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'BF';

    const newContact: ChatContact = {
      id: `contact-${Date.now()}`,
      name: newName.trim(),
      phoneOrHandle: newHandle.trim() || '+234 800 000 0000',
      avatar: initials,
      role: newRole.trim() || 'Merchant Associate',
      lastSeen: 'Just now',
      isOnline: true,
      lightningAddress: newHandle.includes('@') ? newHandle.trim() : `${newName.toLowerCase().replace(/\s+/g, '')}@bitfriend.me`,
      unreadCount: 0,
      lastMessage: {
        text: 'Contact added to BitChat.',
        timestamp: Date.now(),
      },
    };

    const updated = [newContact, ...contacts];
    setContacts(updated);
    saveSecureContacts(updated);
    setSelectedContact(newContact);

    // Persist new contact to SQLite backend
    ApiClient.addChatContact({
      name: newName.trim(),
      handle: newHandle.trim(),
      role: newRole.trim() || 'Merchant Associate',
    })
      .then((savedRemote) => {
        if (savedRemote && savedRemote.id) {
          setContacts((prev) =>
            prev.map((item) => (item.id === newContact.id ? savedRemote : item))
          );
          setSelectedContact((curr) => (curr?.id === newContact.id ? savedRemote : curr));
        }
      })
      .catch(() => {});

    setNewName('');
    setNewHandle('');
    setNewRole('');
    setShowAddContactModal(false);
  };

  const filteredContacts = contacts.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phoneOrHandle.toLowerCase().includes(q) ||
      (c.role && c.role.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bitchat-native-shell">
      {/* Offline queue indicator (only shown when messages are queued) */}
      {offlineQueuedCount > 0 && (
        <div className="bitchat-queue-banner mb-2">
          <Clock size={14} />
          <span>{offlineQueuedCount} messages queued for relay sync</span>
        </div>
      )}

      {/* Main Grid: Roster + Chat */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: !isMobileView ? 'minmax(280px, 340px) 1fr' : '1fr',
          gap: '16px',
        }}
      >
        {/* Left Column: Contact Roster */}
        {(!selectedContact || !isMobileView) && (
          <div
            style={{
              background: '#0d1117',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              height: isMobileView ? 'calc(100vh - 260px)' : '620px',
              minHeight: '420px',
            }}
          >
            {/* Search bar & Add Button */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  gap: '6px',
                }}
              >
                <Search size={15} color="#94a3b8" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search contacts..."
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f8fafc',
                    fontSize: '13px',
                    width: '100%',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAddContactModal(true)}
                style={{
                  background: 'rgba(247, 147, 26, 0.15)',
                  border: '1px solid rgba(247, 147, 26, 0.4)',
                  borderRadius: '10px',
                  padding: '8px',
                  color: 'var(--btc-orange)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Add new contact"
              >
                <UserPlus size={16} />
              </button>
            </div>

            {/* Contacts list */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredContacts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', marginTop: '40px' }}>
                  No contacts found.
                </div>
              ) : (
                filteredContacts.map(c => {
                  const isSelected = selectedContact?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectContact(c)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: isSelected
                          ? 'rgba(247, 147, 26, 0.12)'
                          : 'rgba(255, 255, 255, 0.02)',
                        border: isSelected
                          ? '1px solid rgba(247, 147, 26, 0.3)'
                          : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--btc-orange) 0%, #b45309 100%)',
                            color: '#000',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '15px',
                          }}
                        >
                          {c.avatar}
                        </div>
                        {c.isOnline && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: '#10b981',
                              border: '2px solid #0d1117',
                            }}
                          />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.name}
                          </span>
                          {c.lastMessage && (
                            <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                              {new Date(c.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              color: c.unreadCount > 0 ? '#38bdf8' : '#94a3b8',
                              fontWeight: c.unreadCount > 0 ? 600 : 400,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '180px',
                            }}
                          >
                            {c.lastMessage ? c.lastMessage.text : c.role || c.phoneOrHandle}
                          </span>

                          {c.unreadCount > 0 && (
                            <span
                              style={{
                                background: '#10b981',
                                color: '#000',
                                fontWeight: 800,
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '10px',
                              }}
                            >
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Right Column: Active Conversation */}
        {selectedContact ? (
          <ChatConversation
            contact={selectedContact}
            onBack={() => setSelectedContact(null)}
            lang={lang}
            vaultProofs={vaultProofs}
            onVaultProofsChanged={onVaultProofsChanged}
            isOffline={isOffline}
          />
        ) : !isMobileView ? (
          <div
            style={{
              background: '#0d1117',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '620px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(247, 147, 26, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Zap size={32} color="var(--btc-orange)" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>
              Select a Contact to Start BitChat
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '360px' }}>
              Text fellow African merchants, send inline satoshis, or exchange Cashu vouchers with 0 data routing fees.
            </p>
          </div>
        ) : null}
      </div>

      {/* MODAL: ADD CONTACT */}
      {showAddContactModal && (
        <div className="modal-backdrop" onClick={() => setShowAddContactModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '400px', width: '92%' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Add New BitChat Contact</h3>
              <button className="modal-close-btn" onClick={() => setShowAddContactModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Full Name / Business Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Sani Bello"
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#fff',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Phone Number or Lightning Address
                </label>
                <input
                  type="text"
                  value={newHandle}
                  onChange={e => setNewHandle(e.target.value)}
                  placeholder="e.g. +234 802 000 1111 or sani@bitfriend.me"
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#fff',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Market Association / Role (Optional)
                </label>
                <input
                  type="text"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  placeholder="e.g. Grain Seller, Keke Operator"
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#fff',
                  }}
                />
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleAddContact}
                style={{ marginTop: '10px', padding: '12px' }}
              >
                Add Contact to Roster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
