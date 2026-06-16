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

export interface PlanInfo {
  plan: string;
  label: string;
  price: number;
  limits: {
    maxDevices: number;
    maxReportsPerMonth: number;
    maxAiQueriesPerMonth: number;
    maxTeamMembers: number;
    maxAlertRules: number;
  };
  features: Record<string, boolean>;
  usage: {
    devices: number;
    reports: number;
    aiQueries: number;
  };
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

export interface UsageMetrics {
  devices: { used: number; limit: number };
  reports: { used: number; limit: number };
  aiQueries: { used: number; limit: number };
}

export interface Invoice {
  id: string;
  stripeInvoiceId: string | null;
  amount: number;
  currency: string;
  status: string;
  paid: boolean;
  invoicePdf: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

export function usePlan() {
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/billing/plan`, { headers: getAuthHeaders() });
      if (res.ok) {
        setPlan(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch plan:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  return { plan, loading, refetch: fetchPlan };
}

export function useUsage() {
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/billing/usage`, { headers: getAuthHeaders() });
      if (res.ok) {
        setUsage(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch usage:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  return { usage, loading, refetch: fetchUsage };
}

export function useBillingHistory() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/billing/history`, { headers: getAuthHeaders() });
      if (res.ok) {
        setInvoices(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch billing history:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return { invoices, loading, refetch: fetchHistory };
}

export async function createCheckoutSession(priceId: string) {
  const res = await fetch(`${API_URL}/billing/checkout`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      priceId,
      successUrl: `${window.location.origin}/dashboard/billing?checkout=success`,
      cancelUrl: `${window.location.origin}/dashboard/billing?checkout=cancel`,
    }),
  });
  if (!res.ok) throw new Error('Failed to create checkout session');
  return res.json();
}

export async function createPortalSession() {
  const res = await fetch(`${API_URL}/billing/portal`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      returnUrl: `${window.location.origin}/dashboard/billing`,
    }),
  });
  if (!res.ok) throw new Error('Failed to create portal session');
  return res.json();
}
