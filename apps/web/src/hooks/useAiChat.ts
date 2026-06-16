'use client';

import { useState, useRef, useCallback } from 'react';
import { useDeviceList } from './useDevices';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function parseSSEChunk(buffer: string): { events: { event: string; data: string }[]; rest: string } {
  const events: { event: string; data: string }[] = [];
  let currentEvent = '';
  let currentData = '';
  let rest = buffer;

  const lines = rest.split('\n');
  rest = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6);
    } else if (line === '') {
      if (currentEvent && currentData) {
        events.push({ event: currentEvent, data: currentData });
      }
      currentEvent = '';
      currentData = '';
    } else {
      rest += line + '\n';
    }
  }

  if (currentEvent || currentData) {
    rest = `event: ${currentEvent}\ndata: ${currentData}\n` + rest;
  }

  return { events, rest };
}

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I'm TechFusion AI assistant. I can help you troubleshoot device issues, analyze system health, and provide recommendations. Select a device from the dropdown for context-aware diagnostics, or paste an error log/symptom below.",
    },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>();
  const { devices } = useDeviceList();
  const abortRef = useRef<AbortController | null>(null);
  const assistantIdRef = useRef<string>('');

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || streaming) return;

      const userMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        role: 'user',
        content: content.trim(),
      };

      const assistantId = 'msg-' + (Date.now() + 1);
      assistantIdRef.current = assistantId;

      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`${API_URL}/ai/troubleshoot`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            query: content.trim(),
            deviceId: selectedDeviceId || undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => 'Unknown error');
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Error: Request failed (${response.status}). ${errText}` }
                : m,
            ),
          );
          setStreaming(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: 'Error: No response stream available' }
                : m,
            ),
          );
          setStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseSSEChunk(buffer);
          buffer = rest;

          for (const evt of events) {
            if (evt.event === 'token') {
              try {
                const token = JSON.parse(evt.data);
                if (typeof token === 'string') {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: m.content + token } : m,
                    ),
                  );
                }
              } catch {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + evt.data } : m,
                  ),
                );
              }
            }

            if (evt.event === 'done') {
              try {
                const info = JSON.parse(evt.data);
                if (info.content) {
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, content: info.content } : m)),
                  );
                }
              } catch {
                // ignore
              }
            }

            if (evt.event === 'error') {
              try {
                const errMsg = JSON.parse(evt.data);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content || `Error: ${errMsg}` }
                      : m,
                  ),
                );
              } catch {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content || `Error: ${evt.data}` }
                      : m,
                  ),
                );
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + '\n\n[Request cancelled]' }
                : m,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Connection error: ${err.message}` }
                : m,
            ),
          );
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [streaming, selectedDeviceId],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "Hello! I'm TechFusion AI assistant. I can help you troubleshoot device issues, analyze system health, and provide recommendations.",
      },
    ]);
  }, []);

  return {
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
  };
}
