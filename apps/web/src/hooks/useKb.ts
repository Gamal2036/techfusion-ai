'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/auth-client';

export interface KbArticle {
  id: string;
  orgId: string;
  title: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetrievedChunk {
  id: string;
  articleId: string;
  articleTitle: string;
  chunkIndex: number;
  chunkText: string;
  similarity: number;
}

export function useKbArticles() {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/kb/articles');
      if (res.ok) {
        const json = await res.json();
        setArticles(json.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch KB articles:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const createArticle = useCallback(async (title: string, markdown: string) => {
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/kb/articles', {
        method: 'POST',
        body: JSON.stringify({ title, markdown }),
      });
      if (res.ok) {
        const json = await res.json();
        setArticles((prev) => [json.data, ...prev]);
        return json.data as KbArticle;
      }
      if (res.status === 409) {
        throw new Error('An identical article already exists');
      }
      throw new Error('Failed to create KB article');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const updateArticle = useCallback(async (id: string, title: string, markdown: string) => {
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/kb/articles/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, markdown }),
      });
      if (res.ok) {
        const json = await res.json();
        setArticles((prev) => prev.map((a) => (a.id === id ? json.data : a)));
        return json.data as KbArticle;
      }
      throw new Error('Failed to update KB article');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const deleteArticle = useCallback(async (id: string) => {
    const res = await apiFetch(`/kb/articles/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } else {
      throw new Error('Failed to delete KB article');
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  return { articles, loading, isSubmitting, refetch: fetchArticles, createArticle, updateArticle, deleteArticle };
}

export function useKbQuery() {
  const [results, setResults] = useState<RetrievedChunk[]>([]);
  const [loading, setLoading] = useState(false);

  const query = useCallback(async (queryText: string, topK = 5) => {
    setLoading(true);
    try {
      const res = await apiFetch('/kb/query', {
        method: 'POST',
        body: JSON.stringify({ query: queryText, topK }),
      });
      if (res.ok) {
        const json = await res.json();
        setResults(json.data || []);
        return json.data as RetrievedChunk[];
      }
    } catch (e) {
      console.error('KB query failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, query };
}
