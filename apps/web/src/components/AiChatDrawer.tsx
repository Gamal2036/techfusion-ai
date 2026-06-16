'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles } from 'lucide-react';
import { cn } from '@techfusion/ui';
import { Input, Button } from '@techfusion/ui';
import { GlassPanel } from '@techfusion/ui';

interface AiChatDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

export function AiChatDrawer({ open, onClose }: AiChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm TechFusion AI assistant. I can help you with device diagnostics, security recommendations, and system insights. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  function handleSend() {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: "I'm standing by to process your request. AI integration will be wired in Phase 3. For now, feel free to explore the dashboard!",
    };
    setTimeout(() => setMessages((prev) => [...prev, aiMsg]), 600);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex">
      <div className="w-[400px] border-l border-white/[0.06] bg-background/90 backdrop-blur-2xl flex flex-col shadow-glassLg">
        <div className="flex items-center justify-between h-14 px-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary-400" />
            </div>
            <span className="text-sm font-medium text-white">AI Assistant</span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
            >
              {msg.role === 'assistant' && (
                <div className="h-8 w-8 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-primary-400" />
                </div>
              )}
              <GlassPanel
                intensity={msg.role === 'user' ? 'heavy' : 'light'}
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3',
                  msg.role === 'user' && 'bg-primary-600/20 border-primary-500/30',
                )}
              >
                <p className="text-sm text-white/80 leading-relaxed">{msg.content}</p>
              </GlassPanel>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-white/[0.06]">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your fleet..."
              className="flex-1"
            />
            <Button type="submit" size="icon" variant="glass" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-[10px] text-white/20 text-center">
            AI responses are simulated. Integration coming in Phase 3.
          </p>
        </div>
      </div>
    </div>
  );
}
