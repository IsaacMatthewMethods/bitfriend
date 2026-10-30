import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  Zap,
  Mic,
  Check,
  CheckCheck,
  Clock,
  Play,
  Square,
  Phone,
  MoreVertical
} from 'lucide-react';
import type { ChatContact, ChatMessage, CashuProof, InlinePaymentPayload, Language } from '../../types';
import { PaymentBubbleCard } from './PaymentBubbleCard';
import { InChatSendSatsModal } from './InChatSendSatsModal';
import { soundController } from '../../utils/audioVoice';
import {
  getSecureMessages,
  saveSecureMessage
} from '../../utils/secureStorage';
import { sendNip44ChatMessage } from '../../utils/nostrClient';
import { ApiClient } from '../../services/apiClient';

interface ChatConversationProps {
  contact: ChatContact;
  onBack: () => void;
  lang: Language;
  vaultProofs: CashuProof[];
  onVaultProofsChanged: (proofs: CashuProof[]) => void;
  isOffline: boolean;
  onPaymentClaimedNotify?: (amountSats: number) => void;
}

export const ChatConversation: React.FC<ChatConversationProps> = ({
  contact,
  onBack,
  lang,
  vaultProofs,
  onVaultProofsChanged,
  isOffline,
  onPaymentClaimedNotify,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [showSendSatsModal, setShowSendSatsModal] = useState<boolean>(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;
    let ws: WebSocket | null = null;

    (async () => {
      try {
        const remoteMsgs = await ApiClient.getChatMessages(contact.id);
        if (mounted && Array.isArray(remoteMsgs) && remoteMsgs.length > 0) {
          setMessages(remoteMsgs);
          return;
        }
      } catch {
        // Offline fallback
      }
      const localMsgs = await getSecureMessages(contact.id);
      if (mounted) {
        setMessages(localMsgs);
      }
    })();

    // Connect to live WebSocket relay for real-time P2P chat & voucher updates
    try {
      ws = new WebSocket(ApiClient.getWebSocketUrl());
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'subscribe', channel: 'chat:messages' }));
      };
      ws.onmessage = (event) => {
        if (!mounted) return;
        try {
          const packet = JSON.parse(event.data);
          if (packet.event === 'chat_message' && packet.data) {
            const d = packet.data;
            const peerKey = (contact.nostrNpub || contact.id).toLowerCase();
            if (
              d.senderPubkey?.toLowerCase() === peerKey ||
              d.recipientPubkey?.toLowerCase() === peerKey
            ) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === d.id)) return prev;
                const incoming: ChatMessage = {
                  id: d.id,
                  conversationId: contact.id,
                  senderId: d.senderPubkey?.toLowerCase() === peerKey ? contact.id : 'me',
                  senderName: d.senderPubkey?.toLowerCase() === peerKey ? contact.name : 'You',
                  text: d.text,
                  timestamp: d.createdAt || Date.now(),
                  status: 'delivered',
                  payment: d.cashuToken
                    ? {
                        tokenString: d.cashuToken,
                        amountSats: d.cashuAmountSats || 0,
                        amountNgn: Math.round((d.cashuAmountSats || 0) * 1.585),
                        memo: d.text,
                        status: d.isClaimed ? 'claimed' : 'pending',
                        mintUrl: 'https://mint.bitfriend.me',
                      }
                    : undefined,
                };
                return [...prev, incoming];
              });
            }
          } else if (packet.event === 'voucher_claimed' && packet.data?.messageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === packet.data.messageId && m.payment
                  ? { ...m, payment: { ...m.payment, status: 'claimed' } }
                  : m
              )
            );
          }
        } catch {
          // ignore malformed WS frames
        }
      };
    } catch {
      // Offline mode
    }

    return () => {
      mounted = false;
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };
  }, [contact.id, contact.nostrNpub, contact.name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    soundController.playClick();
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId: contact.id,
      senderId: 'me',
      senderName: 'You',
      text,
      timestamp: Date.now(),
      status: isOffline ? 'offline_queued' : 'delivered',
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    await saveSecureMessage(newMsg);

    // Persist to SQLite backend & broadcast over WebSocket + Nostr P2P relays if online
    if (!isOffline) {
      const recipientPubkey = contact.nostrNpub || contact.id;
      ApiClient.sendChatMessage({
        id: newMsg.id,
        recipientPubkey,
        text,
      }).catch(() => {});
      sendNip44ChatMessage(recipientPubkey, newMsg).catch(console.warn);
    }

    // If online, simulate automated response from merchant after 1.5s
    if (!isOffline && contact.isOnline) {
      setTimeout(async () => {
        soundController.playClick();
        const replyMsg: ChatMessage = {
          id: `reply-${Date.now()}`,
          conversationId: contact.id,
          senderId: contact.id,
          senderName: contact.name,
          text: lang === 'ha'
            ? 'Na gani! Zan tuntuɓe ka yanzu game da batun.'
            : 'Received your message! I will confirm the order details with you shortly.',
          timestamp: Date.now(),
          status: 'delivered',
        };
        setMessages(prev => [...prev, replyMsg]);
        await saveSecureMessage(replyMsg);
      }, 1600);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handlePaymentCreated = async (payload: InlinePaymentPayload, remainingProofs: CashuProof[]) => {
    onVaultProofsChanged(remainingProofs);

    const paymentMsg: ChatMessage = {
      id: `pay-${Date.now()}`,
      conversationId: contact.id,
      senderId: 'me',
      senderName: 'You',
      text: payload.memo || `Sent ${payload.amountSats} satoshis via Cashu Ecash`,
      timestamp: Date.now(),
      status: isOffline ? 'offline_queued' : 'delivered',
      payment: payload,
    };

    setMessages(prev => [...prev, paymentMsg]);
    await saveSecureMessage(paymentMsg);

    // Persist payment voucher to SQLite & broadcast over WebSocket + Nostr relays
    if (!isOffline) {
      const recipientPubkey = contact.nostrNpub || contact.id;
      ApiClient.sendChatMessage({
        id: paymentMsg.id,
        recipientPubkey,
        text: paymentMsg.text || `Sent ${payload.amountSats} sats via Cashu Ecash`,
        cashuToken: payload.tokenString,
        cashuAmountSats: payload.amountSats,
      }).catch(() => {});
      sendNip44ChatMessage(recipientPubkey, paymentMsg).catch(console.warn);
    }
  };

  // Push-to-Talk Voice Note Simulation
  const handleToggleVoiceRecording = () => {
    if (isRecordingVoice) {
      // Finish recording
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      setIsRecordingVoice(false);
      soundController.playClick();

      const voiceMsg: ChatMessage = {
        id: `voice-${Date.now()}`,
        conversationId: contact.id,
        senderId: 'me',
        senderName: 'You',
        timestamp: Date.now(),
        status: isOffline ? 'offline_queued' : 'delivered',
        audioNoteUrl: 'simulated_audio_url',
        audioDurationSec: Math.max(1, recordingSeconds),
      };

      setRecordingSeconds(0);
      setMessages(prev => [...prev, voiceMsg]);
      saveSecureMessage(voiceMsg);
    } else {
      // Start recording
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      soundController.playClick();
      voiceTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    }
  };

  const togglePlayAudio = (msgId: string) => {
    soundController.playClick();
    if (playingAudioId === msgId) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(msgId);
      setTimeout(() => {
        setPlayingAudioId(null);
      }, 2500);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '650px',
        maxHeight: '80vh',
        background: '#0d1117',
        borderRadius: '20px',
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'linear-gradient(90deg, #161b22 0%, #1f2937 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
          >
            <ArrowLeft size={20} />
          </button>

          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--btc-orange) 0%, #d97706 100%)',
              color: '#000',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
            }}
          >
            {contact.avatar}
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{contact.name}</span>
              {contact.isOnline && (
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 6px #10b981',
                  }}
                />
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {contact.role || contact.phoneOrHandle}
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowSendSatsModal(true)}
            style={{
              background: 'rgba(247, 147, 26, 0.15)',
              border: '1px solid rgba(247, 147, 26, 0.4)',
              borderRadius: '10px',
              padding: '6px 12px',
              color: 'var(--btc-orange)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Zap size={14} fill="var(--btc-orange)" />
            <span>Send Sats</span>
          </button>

          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
            }}
            title="Encrypted voice & video channel"
          >
            <Phone size={18} />
          </button>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* Chat Messages Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {/* End-to-end encryption badge */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span
            style={{
              fontSize: '10.5px',
              color: '#94a3b8',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '4px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            🔒 Messages & Ecash tokens are encrypted end-to-end on this device
          </span>
        </div>

        {messages.map(msg => {
          const isMe = msg.senderId === 'me';
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  padding: msg.payment ? '4px' : '10px 14px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMe
                    ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
                    : 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                  border: isMe
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  wordBreak: 'break-word',
                }}
              >
                {/* Voice Note Simulation */}
                {msg.audioNoteUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px', padding: '6px' }}>
                    <button
                      type="button"
                      onClick={() => togglePlayAudio(msg.id)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'var(--btc-orange)',
                        color: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      {playingAudioId === msg.id ? <Square size={13} fill="#000" /> : <Play size={14} fill="#000" />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          height: '6px',
                          background: 'rgba(255, 255, 255, 0.2)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: playingAudioId === msg.id ? '100%' : '35%',
                            background: '#10b981',
                            transition: playingAudioId === msg.id ? 'width 2.5s linear' : 'none',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
                        Voice Note ({msg.audioDurationSec || 2}s)
                      </div>
                    </div>
                  </div>
                ) : (
                  msg.text && (
                    <div style={{ padding: msg.payment ? '8px 12px 2px 12px' : '0' }}>
                      {msg.text}
                    </div>
                  )
                )}

                {/* Inline Payment Bearer Voucher Bubble */}
                {msg.payment && (
                  <PaymentBubbleCard
                    messageId={msg.id}
                    payment={msg.payment}
                    isSender={isMe}
                    onPaymentClaimed={amt => {
                      ApiClient.markChatVoucherClaimed(msg.id).catch(() => {});
                      if (onPaymentClaimedNotify) {
                        onPaymentClaimedNotify(amt);
                      }
                    }}
                  />
                )}
              </div>

              {/* Timestamp & Status indicators */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10.5px',
                  color: '#64748b',
                  marginTop: '3px',
                  padding: '0 4px',
                }}
              >
                <span>{formatTime(msg.timestamp)}</span>
                {isMe && (
                  <>
                    {msg.status === 'offline_queued' ? (
                      <span title="Queued offline: will transmit when network restores" style={{ display: 'inline-flex' }}>
                        <Clock size={12} color="#f59e0b" />
                      </span>
                    ) : msg.status === 'delivered' ? (
                      <CheckCheck size={13} color="#94a3b8" />
                    ) : msg.status === 'read' ? (
                      <CheckCheck size={13} color="#38bdf8" />
                    ) : (
                      <Check size={13} color="#94a3b8" />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Action Bar */}
      <div
        style={{
          padding: '10px 14px',
          background: '#161b22',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* ₿ Action Button */}
        <button
          type="button"
          onClick={() => setShowSendSatsModal(true)}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: '1px solid rgba(247, 147, 26, 0.4)',
            background: 'rgba(247, 147, 26, 0.15)',
            color: 'var(--btc-orange)',
            fontSize: '18px',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          title="Send Satoshis inline in chat"
        >
          ₿
        </button>

        {/* Input box / Recording indicator */}
        {isRecordingVoice ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '24px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ef4444',
                animation: 'pulse 1s infinite',
              }}
            />
            <span>Recording Push-to-Talk Note: {recordingSeconds}s</span>
          </div>
        ) : (
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={lang === 'ha' ? 'Rubuta saƙo ko danna ₿ don aika kudi...' : 'Type a message or tap ₿ to send sats...'}
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              padding: '10px 16px',
              color: '#f8fafc',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        )}

        {/* Mic push to talk button */}
        <button
          type="button"
          onClick={handleToggleVoiceRecording}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: 'none',
            background: isRecordingVoice ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
            color: isRecordingVoice ? '#fff' : '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          title={isRecordingVoice ? 'Stop recording & send' : 'Record voice note'}
        >
          <Mic size={18} />
        </button>

        {/* Send message button */}
        <button
          type="button"
          onClick={handleSendMessage}
          disabled={!inputText.trim() && !isRecordingVoice}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: 'none',
            background: inputText.trim() ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
            color: inputText.trim() ? '#fff' : '#64748b',
            cursor: inputText.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </div>

      {/* In-Chat Send Sats Modal */}
      <InChatSendSatsModal
        isOpen={showSendSatsModal}
        onClose={() => setShowSendSatsModal(false)}
        contactName={contact.name}
        vaultProofs={vaultProofs}
        onPaymentCreated={handlePaymentCreated}
        lang={lang}
      />
    </div>
  );
};
