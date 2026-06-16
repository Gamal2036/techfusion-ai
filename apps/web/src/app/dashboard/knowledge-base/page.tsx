'use client';

import { GlassPanel } from '@techfusion/ui';
import { BookOpen } from 'lucide-react';

export default function KnowledgeBasePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Knowledge Base</h1>
        <p className="text-sm text-white/40 mt-1">Documentation and knowledge management.</p>
      </div>
      <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
        <BookOpen className="h-12 w-12 text-white/20 mb-4" />
        <h3 className="text-lg font-medium text-white/50">Knowledge Base Module</h3>
        <p className="text-sm text-white/30 mt-1 max-w-md">
          IT documentation, runbooks, FAQs, and searchable knowledge repository.
        </p>
      </GlassPanel>
    </div>
  );
}
