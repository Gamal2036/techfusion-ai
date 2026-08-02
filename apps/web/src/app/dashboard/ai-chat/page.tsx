'use client';

import { useState, useRef, useEffect, Component, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { GlassPanel, LoadingSpinner } from '@techfusion/ui';
import {
  Send, Bot, User, BookOpen, ChevronDown, Zap, Shield, AlertTriangle, FileText, X, RefreshCw, Loader2, AlertCircle,
} from 'lucide-react';
import { useAiChat, ChatMessage } from '@/hooks/useAiChat';
import { isDeviceOnline, classifyFreshness, MetricFreshness } from '@/lib/device-presence';

const MotionDiv = dynamic(
  () => import('framer-motion').then((m) => m.motion.div),
  { ssr: false },
);

const MotionSpan = dynamic(
  () => import('framer-motion').then((m) => m.motion.span),
  { ssr: false },
);

const AnimatePresence = dynamic(
  () => import('framer-motion').then((m) => ({ default: m.AnimatePresence })),
  { ssr: false },
);

const suggestedPrompts = [
  { icon: Zap, label: 'Check my CPU issue', color: 'text-yellow-400' },
  { icon: AlertTriangle, label: 'Explain this error', color: 'text-danger' },
  { icon: Shield, label: 'Run security scan', color: 'text-cyan-400' },
  { icon: FileText, label: 'Generate health report', color: 'text-success' },
];

class ChatErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex items-center justify-center h-[calc(100vh-7rem)]">
          <div className="text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-danger/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-secondary">Something went wrong</h3>
            <p className="text-sm text-text-muted mt-2">
              {this.state.error?.message || 'The AI Chat encountered an unexpected error.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-text-primary text-xs font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AnimatedDots() {
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  );
}

function TypewriterText({ content, streaming }: { content: string; streaming?: boolean }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const displayedRef = useRef('');

  useEffect(() => {
    if (!content) {
      setDisplayed('');
      indexRef.current = 0;
      displayedRef.current = '';
      return;
    }
    if (streaming) {
      setDisplayed(content);
      indexRef.current = content.length;
      displayedRef.current = content;
      return;
    }
    if (displayedRef.current === content) return;
    indexRef.current = 0;
    displayedRef.current = '';
    setDisplayed('');
    const interval = setInterval(() => {
      if (indexRef.current < content.length) {
        const next = content.slice(0, indexRef.current + 1);
        displayedRef.current = next;
        setDisplayed(next);
        indexRef.current++;
      } else {
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [content, streaming]);

  return (
    <div className="whitespace-pre-wrap break-words text-text-secondary leading-relaxed">{displayed || content}</div>
  );
}

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === 'user';
  const content = message.content || '';
  const citations = message.citations;
  const hasCitations = Array.isArray(citations) && citations.length > 0;

  const bubble = (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
        isUser ? 'bg-primary-600/20 border border-primary-500/30' : 'bg-purple-600/20 border border-purple-500/30'
      }`}>
        {isUser ? <User className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-purple-400" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-primary-600/20 border border-primary-500/20 text-text-primary'
            : 'bg-surface-subtle border border-border'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
          ) : (
            <div className="whitespace-pre-wrap break-words">
              {content ? (
                isStreaming ? <TypewriterText content={content} streaming /> : <TypewriterText content={content} />
              ) : isStreaming ? (
                <span className="text-text-muted italic">Thinking<AnimatedDots /></span>
              ) : (
                <span className="text-text-muted italic">No response</span>
              )}
            </div>
          )}
        </div>
        {hasCitations && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-text-disabled uppercase tracking-wider">
              <BookOpen className="h-3 w-3" />
              Sources
            </div>
            {citations.map((cite, i) => (
              <div key={i} className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary font-medium truncate">{cite.articleTitle || 'Unknown'}</span>
                  <span className="text-text-disabled text-[10px] ml-2">
                    {typeof cite.similarity === 'number' ? `${(cite.similarity * 100).toFixed(0)}% match` : ''}
                  </span>
                </div>
                <p className="text-text-disabled mt-0.5 text-[10px] line-clamp-2">{cite.chunkText || ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const AnimWrapper = MotionDiv || 'div';
  return (
    <AnimWrapper
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {bubble}
    </AnimWrapper>
  );
}

export default function AiChatPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const {
    messages, input, setInput, streaming, sendMessage, cancelStream, clearChat,
    selectedDeviceId, setSelectedDeviceId, devices, devicesLoading, devicesError,
  } = useAiChat();

  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !streaming) {
      sendMessage(input);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeDevices = Array.isArray(devices) ? devices : [];
  const lastMsgIndex = safeMessages.length - 1;
  const firstMessage = safeMessages.length <= 1;

  const selectedDevice = typeof selectedDeviceId === 'string'
    ? safeDevices.find((d) => d.id === selectedDeviceId)
    : undefined;

  const getFreshnessLabel = (freshness: MetricFreshness): string => {
    switch (freshness) {
      case 'live': return 'Live';
      case 'recent': return 'Recent';
      case 'stale': return 'Stale';
      case 'unavailable': return 'No data';
    }
  };

  const getFreshnessColor = (freshness: MetricFreshness): string => {
    switch (freshness) {
      case 'live': return 'text-success';
      case 'recent': return 'text-yellow-400';
      case 'stale': return 'text-danger';
      case 'unavailable': return 'text-text-disabled';
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-7rem)]">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <ChatErrorBoundary>
      <div className="flex flex-col h-[calc(100vh-7rem)] max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">AI Troubleshoot</h1>
            <p className="text-sm text-text-muted mt-1">Conversational AI for IT operations.</p>
          </div>
          <div className="flex items-center gap-2">
            {safeMessages.length > 1 && (
              <button onClick={clearChat} className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary hover:bg-surface-subtle transition-all">
                <RefreshCw className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="relative mb-3 shrink-0">
          <button
            onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border border-border bg-surface-subtle text-text-secondary hover:text-text-secondary hover:bg-surface-muted transition-all"
          >
            {selectedDevice ? (
              <>
                <span className={`h-2 w-2 rounded-full ${isDeviceOnline(selectedDevice.lastSeenAt) ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <span>{selectedDevice.name || selectedDevice.hostname || 'Unnamed Device'}</span>
                <span className={`text-[10px] ${getFreshnessColor(classifyFreshness(selectedDevice.lastSeenAt))}`}>
                  {getFreshnessLabel(classifyFreshness(selectedDevice.lastSeenAt))}
                </span>
              </>
            ) : devicesLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-text-disabled" />
                <span className="text-text-disabled">Loading devices...</span>
              </>
            ) : devicesError ? (
              <span className="text-danger/70">Error loading devices</span>
            ) : safeDevices.length === 0 ? (
              <span className="text-text-disabled">No devices registered</span>
            ) : (
              <span>No device selected</span>
            )}
            <ChevronDown className="h-3 w-3" />
          </button>
          {showDeviceDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDeviceDropdown(false)} />
              <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-xl border border-border-strong bg-surface-950 backdrop-blur-2xl shadow-dialog max-h-56 overflow-y-auto">
                <button
                  onClick={() => { setSelectedDeviceId(undefined); setShowDeviceDropdown(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs text-text-secondary hover:text-text-secondary hover:bg-surface-muted transition-colors"
                >
                  No device (general query)
                </button>
                {safeDevices.map((d) => {
                  const isOnline = isDeviceOnline(d.lastSeenAt);
                  const freshness = classifyFreshness(d.lastSeenAt);
                  return (
                    <button
                      key={d.id}
                      onClick={() => { setSelectedDeviceId(d.id); setShowDeviceDropdown(false); }}
                      className={`w-full text-left px-3 py-2.5 text-xs hover:bg-surface-muted flex items-center gap-2 transition-colors ${
                        selectedDeviceId === d.id ? 'text-primary-300 bg-primary-600/15' : 'text-text-secondary hover:text-text-secondary'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${isOnline ? 'bg-green-400' : 'bg-surface-muted'}`} />
                      <span className="truncate">{d.name || d.id}</span>
                      <span className={`text-[10px] ml-auto shrink-0 ${getFreshnessColor(freshness)}`}>
                        {getFreshnessLabel(freshness)}
                      </span>
                      {d.hostname && <span className="text-text-disabled shrink-0">({d.hostname})</span>}
                    </button>
                  );
                })}
                {safeDevices.length === 0 && !devicesLoading && (
                  <div className="px-3 py-4 text-center">
                    <p className="text-xs text-text-disabled">No devices registered yet</p>
                    <p className="text-[10px] text-text-disabled mt-1">Install the agent on your device to get started</p>
                  </div>
                )}
                {devicesLoading && (
                  <div className="px-3 py-3 text-center">
                    <Loader2 className="h-4 w-4 text-text-disabled animate-spin mx-auto" />
                  </div>
                )}
                {devicesError && (
                  <div className="px-3 py-3 text-center">
                    <p className="text-xs text-danger/50">{devicesError}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <AnimatePresence>
            {safeMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={streaming && msg.id === safeMessages[lastMsgIndex]?.id && msg.role === 'assistant'}
              />
            ))}
          </AnimatePresence>

          {firstMessage && !streaming && safeMessages.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {suggestedPrompts.map((prompt) => {
                const Icon = prompt.icon;
                return (
                  <button
                    key={prompt.label}
                    onClick={() => sendMessage(prompt.label)}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-surface hover:bg-surface-subtle hover:border-border-strong transition-all text-left group"
                  >
                    <Icon className={`h-4 w-4 ${prompt.color} shrink-0`} />
                    <span className="text-xs text-text-secondary group-hover:text-text-secondary transition-colors">{prompt.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="mt-4 shrink-0">
          <div className="flex items-end gap-2 rounded-2xl border border-border-strong bg-surface-subtle backdrop-blur-xl p-2 focus-within:border-primary-500/40 focus-within:bg-surface-subtle transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled outline-none resize-none max-h-32 [&:-webkit-autofill]:!bg-transparent [&:-webkit-autofill]:![box-shadow:none] [&:-webkit-autofill]:!text-text-primary [&:-webkit-autofill]:!caret-white"
            />
            {streaming ? (
              <button
                onClick={cancelStream}
                className="h-9 w-9 rounded-xl flex items-center justify-center bg-red-600/20 hover:bg-red-600/30 text-danger transition-all shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary-600 hover:bg-primary-500 text-text-primary disabled:opacity-30 transition-all shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-text-disabled text-center mt-2">
            AI responses are generated based on device data and knowledge base articles. Verify critical actions.
          </p>
        </div>
      </div>
    </ChatErrorBoundary>
  );
}
