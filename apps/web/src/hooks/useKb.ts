'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/kb/articles`, { headers: getAuthHeaders() });
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
    const res = await fetch(`${API_URL}/kb/articles`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, markdown }),
    });
    if (res.ok) {
      const json = await res.json();
      setArticles((prev) => [json.data, ...prev]);
      return json.data as KbArticle;
    }
    throw new Error('Failed to create KB article');
  }, []);

  const updateArticle = useCallback(async (id: string, title: string, markdown: string) => {
    const res = await fetch(`${API_URL}/kb/articles/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, markdown }),
    });
    if (res.ok) {
      const json = await res.json();
      setArticles((prev) => prev.map((a) => (a.id === id ? json.data : a)));
      return json.data as KbArticle;
    }
    throw new Error('Failed to update KB article');
  }, []);

  const deleteArticle = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/kb/articles/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } else {
      throw new Error('Failed to delete KB article');
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  return { articles, loading, refetch: fetchArticles, createArticle, updateArticle, deleteArticle };
}

export function useKbQuery() {
  const [results, setResults] = useState<RetrievedChunk[]>([]);
  const [loading, setLoading] = useState(false);

  const query = useCallback(async (queryText: string, topK = 5) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/kb/query`, {
        method: 'POST',
        headers: getAuthHeaders(),
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
