'use client';

import { useState, useEffect } from 'react';
import { GlassPanel, Input, Button, cn } from '@techfusion/ui';
import { BookOpen, Plus, Search, FileText, Trash2, Edit3, Eye, ArrowLeft, X } from 'lucide-react';
import { useKbArticles, KbArticle } from '@/hooks/useKb';

export default function KnowledgeBasePage() {
  const { articles, loading, isSubmitting, refetch, createArticle, updateArticle, deleteArticle } = useKbArticles();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'view'>('list');
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formMarkdown, setFormMarkdown] = useState('');

  const filtered = articles.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()),
  );

  function openView(article: KbArticle) {
    setSelectedArticle(article);
    setView('view');
  }

  function openEdit(article: KbArticle) {
    setSelectedArticle(article);
    setFormTitle(article.title);
    setFormMarkdown(article.markdown);
    setView('edit');
  }

  function openCreate() {
    setSelectedArticle(null);
    setFormTitle('');
    setFormMarkdown('');
    setView('create');
  }

  function goBack() {
    setView('list');
    setSelectedArticle(null);
  }

  async function handleCreate() {
    if (!formTitle.trim()) return;
    try {
      await createArticle(formTitle.trim(), formMarkdown);
      goBack();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleUpdate() {
    if (!selectedArticle || !formTitle.trim()) return;
    try {
      await updateArticle(selectedArticle.id, formTitle.trim(), formMarkdown);
      goBack();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this article?')) return;
    try {
      await deleteArticle(id);
      if (selectedArticle?.id === id) goBack();
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div><h1 className="text-2xl font-semibold text-text-primary tracking-tight">Knowledge Base</h1><p className="text-sm text-text-muted mt-1">Documentation and knowledge management.</p></div>
        <GlassPanel intensity="light" className="p-12 flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-primary-500/30 border-t-primary-400 animate-spin" /></GlassPanel>
      </div>
    );
  }

  if (view === 'create' || view === 'edit') {
    const isEdit = view === 'edit';
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface-subtle transition-all"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">{isEdit ? 'Edit Article' : 'New Article'}</h1>
            <p className="text-sm text-text-muted mt-1">{isEdit ? 'Update this knowledge base article' : 'Create a new knowledge base article'}</p>
          </div>
        </div>

        <GlassPanel intensity="light" className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Title</label>
            <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Article title..." className="w-full" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Content (Markdown)</label>
            <textarea
              value={formMarkdown}
              onChange={(e) => setFormMarkdown(e.target.value)}
              placeholder="# Title&#10;&#10;Write your documentation here..."
              className="w-full h-80 rounded-xl border border-border bg-surface-subtle px-3 py-2.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40 resize-y font-mono"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={goBack} disabled={isSubmitting}>Cancel</Button>
            <Button variant="glass" onClick={isEdit ? handleUpdate : handleCreate} disabled={isSubmitting || !formTitle.trim()}>
              {isSubmitting ? 'Submitting…' : isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </GlassPanel>
      </div>
    );
  }

  if (view === 'view' && selectedArticle) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface-subtle transition-all"><ArrowLeft className="h-4 w-4" /></button>
            <div>
              <h1 className="text-2xl font-semibold text-text-primary tracking-tight">{selectedArticle.title}</h1>
              <p className="text-sm text-text-muted mt-1">Created {new Date(selectedArticle.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => openEdit(selectedArticle)} className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-text-muted hover:text-text-secondary hover:bg-surface-subtle transition-all text-xs"><Edit3 className="h-3.5 w-3.5" /> Edit</button>
            <button onClick={() => handleDelete(selectedArticle.id)} className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-danger/60 hover:text-danger hover:bg-red-500/10 transition-all text-xs"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          </div>
        </div>

        <GlassPanel intensity="light" className="p-6">
          <div className="prose prose-invert max-w-none text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {selectedArticle.markdown}
          </div>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-text-muted mt-1">{articles.length} article{articles.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="glass" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> New Article
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-disabled" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles..."
          className="w-full h-10 rounded-xl border border-border bg-surface-subtle pl-9 pr-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500/40"
        />
      </div>

      {filtered.length === 0 ? (
        <GlassPanel intensity="light" className="p-12 flex flex-col items-center justify-center text-center">
          <BookOpen className="h-12 w-12 text-text-disabled mb-4" />
          <h3 className="text-lg font-medium text-text-secondary">{search ? 'No matching articles' : 'No articles yet'}</h3>
          <p className="text-sm text-text-disabled mt-1 max-w-md">
            {search ? 'Try a different search term.' : 'Create your first knowledge base article to start building documentation.'}
          </p>
          {!search && <Button variant="glass" size="sm" className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Article</Button>}
        </GlassPanel>
      ) : (
        <div className="space-y-2">
          {filtered.map((article) => (
            <GlassPanel
              key={article.id}
              intensity="light"
              className="p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-muted transition-all"
              onClick={() => openView(article)}
            >
              <div className="h-10 w-10 rounded-xl bg-surface-subtle border border-border flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-text-secondary truncate">{article.title}</h3>
                <p className="text-xs text-text-disabled mt-0.5">
                  Updated {new Date(article.updatedAt).toLocaleDateString()}
                  {' '}&middot;{' '}
                  {article.markdown.length} chars
                </p>
              </div>
              <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(article)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-disabled hover:text-text-primary/60 hover:bg-surface-subtle transition-all">
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(article.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-danger/40 hover:text-danger hover:bg-red-500/10 transition-all">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </GlassPanel>
          ))}
        </div>
      )}
    </div>
  );
}
