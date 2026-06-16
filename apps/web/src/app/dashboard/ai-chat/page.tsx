'use client';

import { GlassPanel } from '@techfusion/ui';
import { MessageSquare } from 'lucide-react';

export default function AiChatPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">AI Chat</h1>
        <p className="text-sm text-white/40 mt-1">Conversational AI assistant for IT operations.</p>
      </div>
      <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
        <MessageSquare className="h-12 w-12 text-white/20 mb-4" />
        <h3 className="text-lg font-medium text-white/50">AI Chat Module</h3>
        <p className="text-sm text-white/30 mt-1 max-w-md">
          Full conversational interface for natural language IT operations and queries.
        </p>
      </GlassPanel>
    </div>
  );
}
