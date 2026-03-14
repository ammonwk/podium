import React, { useState, useRef, useEffect, useCallback } from 'react';
import { THEME } from '@apm/shared';
import type { ChatRole, ChatMessage } from '@apm/shared';
import { RADIUS, SHADOW, ANIMATION } from '../styles/theme';

function formatBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

const ROLES: { key: ChatRole; label: string }[] = [
  { key: 'property_owner', label: 'Owner' },
  { key: 'current_occupant', label: 'Occupant' },
  { key: 'interested_person', label: 'Inquirer' },
];

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [role, setRole] = useState<ChatRole>('interested_person');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamingTextRef = useRef('');

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // SSE connection management
  useEffect(() => {
    if (!isOpen) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    const es = new EventSource(`/chat/stream?sessionId=${sessionId}`);
    eventSourceRef.current = es;

    es.addEventListener('chat_text', (e) => {
      const { text } = JSON.parse(e.data);
      streamingTextRef.current += text;
      const currentText = streamingTextRef.current;

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && isStreamingMsg(last)) {
          return [...prev.slice(0, -1), { ...last, content: currentText }];
        }
        return prev;
      });
    });

    es.addEventListener('chat_done', () => {
      setIsStreaming(false);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, id: last.id.replace('streaming-', '') }];
        }
        return prev;
      });
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isOpen, sessionId]);

  const isStreamingMsg = (msg: ChatMessage) => msg.id.startsWith('streaming-');

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: `streaming-${crypto.randomUUID()}`, role: 'assistant', content: '', timestamp: new Date().toISOString() },
    ]);
    setInputText('');
    setIsStreaming(true);
    streamingTextRef.current = '';

    try {
      await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, role, sessionId }),
      });
    } catch (err) {
      console.error('[ChatWidget] Send error:', err);
      setIsStreaming(false);
    }
  }, [inputText, isStreaming, role, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClose = useCallback(() => setIsOpen(false), []);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button style={styles.fab} onClick={() => setIsOpen(true)} title="Chat with AI">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Overlay */}
      {isOpen && <div style={styles.overlay} onClick={handleClose} />}

      {/* Chat panel */}
      {isOpen && (
        <div style={styles.panel}>
          {/* Header */}
          <div style={styles.header}>
            <span style={styles.headerTitle}>Chat with AI Agent</span>
            <button style={styles.closeBtn} onClick={handleClose}>&times;</button>
          </div>

          {/* Role selector */}
          <div style={styles.roleBar}>
            {ROLES.map((r) => (
              <button
                key={r.key}
                style={{
                  ...styles.roleTab,
                  ...(role === r.key ? styles.roleTabActive : {}),
                }}
                onClick={() => {
                  if (r.key !== role) {
                    setRole(r.key);
                    setMessages([]);
                    setSessionId(crypto.randomUUID());
                  }
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div style={styles.messageList}>
            {messages.length === 0 && (
              <div style={styles.emptyState}>
                Send a message to start chatting as <strong>{ROLES.find(r => r.key === role)?.label}</strong>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.messageBubbleRow,
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    ...styles.messageBubble,
                    ...(msg.role === 'user' ? styles.userBubble : styles.assistantBubble),
                  }}
                >
                  {msg.content ? formatBold(msg.content.replace(/^\n+/, '')) : (isStreamingMsg(msg) ? '...' : '')}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={styles.inputArea}>
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isStreaming ? 'Waiting for response...' : 'Type a message...'}
              disabled={isStreaming}
              style={styles.input}
            />
            <button
              onClick={sendMessage}
              disabled={isStreaming || !inputText.trim()}
              style={{
                ...styles.sendBtn,
                opacity: isStreaming || !inputText.trim() ? 0.5 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 9000,
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: THEME.accent.violet,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: SHADOW.lg,
    transition: `transform ${ANIMATION.fast} ${ANIMATION.easeOut}, box-shadow ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.10)',
    zIndex: 9500,
  },
  panel: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '420px',
    height: '600px',
    zIndex: 10000,
    backgroundColor: THEME.bg.primary,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.lg,
    boxShadow: SHADOW.xl,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: `1px solid ${THEME.bg.border}`,
    backgroundColor: THEME.bg.card,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: THEME.text.primary,
    fontFamily: THEME.font.sans,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    color: THEME.text.secondary,
    cursor: 'pointer',
    padding: '0 4px',
    fontFamily: THEME.font.sans,
    lineHeight: 1,
  },
  roleBar: {
    display: 'flex',
    gap: '6px',
    padding: '10px 16px',
    borderBottom: `1px solid ${THEME.bg.border}`,
    backgroundColor: THEME.bg.card,
    flexShrink: 0,
  },
  roleTab: {
    flex: 1,
    padding: '6px 0',
    borderRadius: RADIUS.sm,
    border: 'none',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: THEME.font.sans,
    backgroundColor: THEME.bg.primary,
    color: THEME.text.secondary,
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
  roleTabActive: {
    backgroundColor: THEME.accent.violet,
    color: '#ffffff',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  emptyState: {
    textAlign: 'center',
    color: THEME.text.muted,
    fontSize: '13px',
    marginTop: '40px',
    fontFamily: THEME.font.sans,
  },
  messageBubbleRow: {
    display: 'flex',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: '10px 14px',
    borderRadius: RADIUS.md,
    fontSize: '14px',
    lineHeight: 1.5,
    fontFamily: THEME.font.sans,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  userBubble: {
    backgroundColor: THEME.accent.violet,
    color: '#ffffff',
    borderBottomRightRadius: '4px',
  },
  assistantBubble: {
    backgroundColor: THEME.bg.card,
    color: THEME.text.primary,
    border: `1px solid ${THEME.bg.border}`,
    borderBottomLeftRadius: '4px',
  },
  inputArea: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderTop: `1px solid ${THEME.bg.border}`,
    backgroundColor: THEME.bg.card,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${THEME.bg.border}`,
    backgroundColor: THEME.bg.primary,
    color: THEME.text.primary,
    fontSize: '14px',
    fontFamily: THEME.font.sans,
    outline: 'none',
  },
  sendBtn: {
    width: '40px',
    height: '40px',
    borderRadius: RADIUS.sm,
    backgroundColor: THEME.accent.violet,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: `opacity ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
};
