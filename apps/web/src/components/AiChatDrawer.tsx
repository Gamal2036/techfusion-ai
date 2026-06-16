'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles, Trash2, StopCircle, ChevronDown } from 'lucide-react';
import { cn } from '@techfusion/ui';
import { Input, Button } from '@techfusion/ui';
import { GlassPanel } from '@techfusion/ui';
import { useAiChat } from '@/hooks/useAiChat';

interface AiChatDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function AiChatDrawer({ open, onClose }: AiChatDrawerProps) {
  const {
    messages,
    input,
    setInput,
    streaming,
    sendMessage,
    cancelStream,
    clearChat,
    selectedDeviceId,
    setSelectedDeviceId,
    devices,
  } = useAiChat();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [deviceOpen, setDeviceOpen] = useState(false);

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
    if (!input.trim() || streaming) return;
    sendMessage(input);
  }

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex">
      <div className="w-[420px] border-l border-white/[0.06] bg-background/90 backdrop-blur-2xl flex flex-col shadow-glassLg">
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary-400" />
            </div>
            <span className="text-sm font-medium text-white">AI Troubleshooting</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Device Context Picker */}
        <div className="px-4 pt-3 pb-1 shrink-0">
          <div className="relative">
            <button
              onClick={() => setDeviceOpen(!deviceOpen)}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-all border',
                selectedDevice
                  ? 'bg-primary-600/10 border-primary-500/30 text-primary-300'
                  : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70 hover:bg-white/[0.06]',
              )}
            >
              <span className="truncate">
                {selectedDevice ? `Device: ${selectedDevice.name}` : 'Select device context...'}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
            {deviceOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDeviceOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-white/[0.06] bg-background/95 backdrop-blur-xl shadow-2xl max-h-48 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedDeviceId(undefined); setDeviceOpen(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs transition-colors',
                      !selectedDeviceId
                        ? 'text-primary-300 bg-primary-600/10'
                        : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]',
                    )}
                  >
                    No device context
                  </button>
                  {devices.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => { setSelectedDeviceId(d.id); setDeviceOpen(false); }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs transition-colors',
                        selectedDeviceId === d.id
                          ? 'text-primary-300 bg-primary-600/10'
                          : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]',
                      )}
                    >
                      {d.name}
                      {d.hostname && <span className="text-white/20 ml-1">({d.hostname})</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
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
                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{msg.content || (streaming && msg.id === messages[messages.length - 1]?.id ? '\u200B' : '')}</p>
                {streaming && msg.id === messages[messages.length - 1]?.id && !msg.content && (
                  <span className="inline-block w-2 h-4 bg-primary-400 animate-pulse ml-0.5" />
                )}
              </GlassPanel>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/[0.06] shrink-0">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={streaming ? 'Waiting for response...' : selectedDevice ? 'Ask about this device...' : 'Describe a symptom or paste an error...'}
              className="flex-1"
              disabled={streaming}
            />
            {streaming ? (
              <Button type="button" size="icon" variant="destructive" onClick={cancelStream}>
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" size="icon" variant="glass" disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
          <p className="mt-2 text-[10px] text-white/20 text-center">
            {streaming
              ? 'Streaming response...'
              : 'Pasted logs are treated as data, not instructions'}
          </p>
        </div>
      </div>
    </div>
  );
}
