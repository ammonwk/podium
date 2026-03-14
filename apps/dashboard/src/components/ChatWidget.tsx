import React, { useState, useRef, useEffect, useCallback } from 'react';
import { THEME, TOOL_COLORS } from '@apm/shared';
import type { ChatRole, ChatMessage } from '@apm/shared';
import { RADIUS, SHADOW, ANIMATION } from '../styles/theme';

interface ToolCallData {
  tool_name: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  is_error: boolean;
}

// Extended local message type to support tool call bubbles
interface DisplayMessage extends ChatMessage {
  toolCall?: ToolCallData;
}

function formatBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function summarizeToolResult(toolName: string, result: Record<string, unknown>, isError: boolean): string {
  if (isError) {
    return `Error: ${result.error || 'Unknown error'}`;
  }

  // Provide compact summaries for known tool types
  if (toolName === 'lookup_guest') {
    if (!result.found) return 'No bookings found';
    const bookings = result.bookings as Array<Record<string, unknown>>;
    return bookings.map((b) => `${b.guest_name} @ ${b.property_name} (${b.status})`).join(', ');
  }
  if (toolName === 'create_booking') {
    return `Booked ${result.property_name} for ${result.guest_name} (${result.nights} nights, $${result.total_estimate})`;
  }
  if (toolName === 'edit_booking') {
    return `Updated: ${result.changes}`;
  }
  if (toolName === 'get_property_status') {
    const props = result.properties as Array<Record<string, unknown>> | undefined;
    if (props) return `${props.length} propert${props.length === 1 ? 'y' : 'ies'} returned`;
    return 'Property status retrieved';
  }

  if (toolName === 'report_maintenance_issue') {
    return `${result.property_name}: ${result.severity} issue reported (${result.status})`;
  }
  if (toolName === 'escalate_to_owner') {
    return `Escalated to owner: ${result.summary_sent}`;
  }

  // Fallback: show first few keys
  const keys = Object.keys(result).slice(0, 3);
  return keys.map((k) => `${k}: ${JSON.stringify(result[k])}`).join(', ');
}

const ROLES: { key: ChatRole; label: string }[] = [
  { key: 'property_owner', label: 'Owner' },
  { key: 'current_occupant', label: 'Occupant' },
  { key: 'interested_person', label: 'Inquirer' },
];

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [role, setRole] = useState<ChatRole>(() => {
    try {
      return (localStorage.getItem('chat_role') as ChatRole) || 'interested_person';
    } catch { return 'interested_person'; }
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    try {
      return localStorage.getItem(`chat_session_${role}`) || crypto.randomUUID();
    } catch { return crypto.randomUUID(); }
  });
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamingTextRef = useRef('');

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Persist sessionId when it changes
  useEffect(() => {
    try {
      localStorage.setItem(`chat_session_${role}`, sessionId);
      localStorage.setItem('chat_role', role);
    } catch {}
  }, [sessionId, role]);

  // Load chat history when opened with an existing session
  useEffect(() => {
    if (!isOpen) return;
    fetch(`/api/chat/history?sessionId=${sessionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.messages?.length) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});
  }, [isOpen, sessionId]);

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
        if (last && last.role === 'assistant' && !last.toolCall && isStreamingMsg(last)) {
          return [...prev.slice(0, -1), { ...last, content: currentText }];
        }
        // If the last message is a tool call or doesn't exist, create a new streaming message
        return [
          ...prev,
          { id: `streaming-${crypto.randomUUID()}`, role: 'assistant', content: currentText, timestamp: new Date().toISOString() },
        ];
      });
    });

    es.addEventListener('chat_tool_call', (e) => {
      const data: ToolCallData = JSON.parse(e.data);

      // Insert tool call bubble before the current streaming assistant message
      setMessages((prev) => {
        const toolMsg: DisplayMessage = {
          id: `tool-${crypto.randomUUID()}`,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          toolCall: data,
        };

        // Finalize the pre-tool streaming message, then append tool bubble
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && !last.toolCall && isStreamingMsg(last)) {
          const finalized = { ...last, id: last.id.replace('streaming-', '') };
          if (!finalized.content.trim()) {
            return [...prev.slice(0, -1), toolMsg];
          }
          return [...prev.slice(0, -1), finalized, toolMsg];
        }
        return [...prev, toolMsg];
      });

      // Reset streaming text since the AI will produce new text after the tool call
      streamingTextRef.current = '';
    });

    es.addEventListener('chat_done', () => {
      setIsStreaming(false);
      streamingTextRef.current = '';
      setMessages((prev) => {
        // Remove empty trailing streaming messages and finalize IDs
        const result: DisplayMessage[] = [];
        for (const msg of prev) {
          if (isStreamingMsg(msg) && !msg.content.trim() && !msg.toolCall) {
            // Drop empty streaming messages
            continue;
          }
          if (msg.role === 'assistant' && isStreamingMsg(msg)) {
            result.push({ ...msg, id: msg.id.replace('streaming-', '') });
          } else {
            result.push(msg);
          }
        }
        return result;
      });
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isOpen, sessionId]);

  const isStreamingMsg = (msg: DisplayMessage) => msg.id.startsWith('streaming-');

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const userMsg: DisplayMessage = {
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

  const toggleToolExpanded = useCallback((id: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderMessage = (msg: DisplayMessage) => {
    // Tool call bubble
    if (msg.toolCall) {
      const { tool_name, input, result, is_error } = msg.toolCall;
      const color = TOOL_COLORS[tool_name] || THEME.text.secondary;
      const isExpanded = expandedTools.has(msg.id);
      return (
        <div key={msg.id} style={{ ...styles.messageBubbleRow, justifyContent: 'flex-start' }}>
          <div
            style={styles.toolBubble}
            onClick={() => toggleToolExpanded(msg.id)}
          >
            <div style={styles.toolHeader}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span style={{ ...styles.toolName, color }}>{formatToolName(tool_name)}</span>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke={THEME.text.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ marginLeft: 'auto', flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <div style={{
              ...styles.toolResult,
              color: is_error ? THEME.status.emergency : THEME.text.secondary,
            }}>
              {summarizeToolResult(tool_name, result, is_error)}
            </div>
            {isExpanded && (
              <div style={styles.toolDetails}>
                <div style={styles.toolDetailSection}>
                  <div style={styles.toolDetailLabel}>Input</div>
                  <pre style={styles.toolDetailPre}>{JSON.stringify(input, null, 2)}</pre>
                </div>
                <div style={styles.toolDetailSection}>
                  <div style={styles.toolDetailLabel}>Output</div>
                  <pre style={styles.toolDetailPre}>{JSON.stringify(result, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Regular message bubble
    return (
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
    );
  };

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
                    // Restore or create session for the new role
                    const stored = localStorage.getItem(`chat_session_${r.key}`);
                    setSessionId(stored || crypto.randomUUID());
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
            {messages.map(renderMessage)}
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
  toolBubble: {
    maxWidth: '85%',
    padding: '8px 12px',
    borderRadius: RADIUS.md,
    backgroundColor: THEME.bg.sidebar,
    border: `1px dashed ${THEME.bg.border}`,
    borderBottomLeftRadius: '4px',
    fontFamily: THEME.font.sans,
    cursor: 'pointer',
    transition: `background-color ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
  toolHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  toolName: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  toolResult: {
    fontSize: '12px',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  toolDetails: {
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: `1px solid ${THEME.bg.border}`,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  toolDetailSection: {},
  toolDetailLabel: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: THEME.text.muted,
    marginBottom: '4px',
  },
  toolDetailPre: {
    fontSize: '11px',
    lineHeight: 1.4,
    fontFamily: THEME.font.mono,
    backgroundColor: THEME.bg.primary,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.sm,
    padding: '6px 8px',
    margin: 0,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    maxHeight: '150px',
    overflowY: 'auto' as const,
    color: THEME.text.primary,
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
