'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@techfusion/ui';
import {
  Send, Bot, User, BookOpen, ChevronDown, Zap, Shield, AlertTriangle, FileText, X, RefreshCw,
} from 'lucide-react';
import { useAiChat, ChatMessage } from '@/hooks/useAiChat';

const suggestedPrompts = [
  { icon: Zap, label: 'Check my CPU issue', color: 'text-yellow-400' },
  { icon: AlertTriangle, label: 'Explain this error', color: 'text-red-400' },
  { icon: Shield, label: 'Run security scan', color: 'text-cyan-400' },
  { icon: FileText, label: 'Generate health report', color: 'text-green-400' },
];

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

function TypewriterText({ content }: { content: string }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');
    if (!content) return;
    const interval = setInterval(() => {
      if (indexRef.current < content.length) {
        setDisplayed(content.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [content]);

  return <span>{displayed}</span>;
}

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
        isUser ? 'bg-primary-600/20 border border-primary-500/30' : 'bg-purple-600/20 border border-purple-500/30'
      }`}>
        {isUser ? <User className="h-4 w-4 text-primary-400" /> : <Bot className="h-4 w-4 text-purple-400" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary-600/20 border border-primary-500/20 text-white/90'
            : 'bg-white/[0.04] border border-white/[0.06] text-white/80'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="whitespace-pre-wrap">
              {message.content ? (
                streaming ? <TypewriterText content={message.content} /> : message.content
              ) : streaming ? (
                <span className="text-white/40 italic">Thinking<AnimatedDots /></span>
              ) : (
                <span className="text-white/40 italic">No response</span>
              )}
            </div>
          )}
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-white/30 uppercase tracking-wider">
              <BookOpen className="h-3 w-3" />
              Sources
            </div>
            {message.citations.map((cite, i) => (
              <div key={i} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/50 font-medium truncate">{cite.articleTitle}</span>
                  <span className="text-white/20 text-[10px] ml-2">{(cite.similarity * 100).toFixed(0)}% match</span>
                </div>
                <p className="text-white/30 mt-0.5 text-[10px] line-clamp-2">{cite.chunkText}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AiChatPage() {
  const {
    messages, input, setInput, streaming, sendMessage, cancelStream, clearChat,
    selectedDeviceId, setSelectedDeviceId, devices,
  } = useAiChat();
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !streaming) sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">AI Troubleshoot</h1>
          <p className="text-sm text-white/40 mt-1">Conversational AI for IT operations.</p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <button onClick={clearChat} className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all">
              <RefreshCw className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="relative mb-3 shrink-0">
        <button
          onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-white/[0.06] bg-white/[0.03] text-white/50 hover:text-white/70 transition-all"
        >
          <span>{selectedDeviceId ? devices.find(d => d.id === selectedDeviceId)?.name || selectedDeviceId.slice(0, 12) : 'No device selected'}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        {showDeviceDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowDeviceDropdown(false)} />
            <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-xl border border-white/[0.06] bg-surface-950/95 backdrop-blur-2xl shadow-dialog max-h-48 overflow-y-auto">
              <button
                onClick={() => { setSelectedDeviceId(undefined); setShowDeviceDropdown(false); }}
                className="w-full text-left px-3 py-2 text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              >
                No device (general query)
              </button>
              {devices.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setSelectedDeviceId(d.id); setShowDeviceDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-white/60 hover:text-white/80 hover:bg-white/[0.04]"
                >
                  {d.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} streaming={streaming && msg.id === messages[messages.length - 1]?.id && msg.role === 'assistant'} />
          ))}
        </AnimatePresence>

        {messages.length === 1 && !streaming && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-2 mt-4">
            {suggestedPrompts.map((prompt) => {
              const Icon = prompt.icon;
              return (
                <button
                  key={prompt.label}
                  onClick={() => sendMessage(prompt.label)}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.10] transition-all text-left group"
                >
                  <Icon className={`h-4 w-4 ${prompt.color} shrink-0`} />
                  <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">{prompt.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4 shrink-0">
        <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-2 focus-within:border-primary-500/40 focus-within:bg-white/[0.05] transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none resize-none max-h-32 scrollbar-thin"
          />
          {streaming ? (
            <button
              onClick={cancelStream}
              className="h-9 w-9 rounded-xl flex items-center justify-center bg-red-600/20 hover:bg-red-600/30 text-red-400 transition-all shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-30 transition-all shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-white/20 text-center mt-2">
          AI responses are generated based on device data and knowledge base articles. Verify critical actions.
        </p>
      </div>
    </div>
  );
}
