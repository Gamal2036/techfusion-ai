'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  fetchAccountSummary,
  fetchMfaStatus,
  type AccountSummary,
  type MfaStatus,
} from '@/lib/account-client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ProfileSection } from '@/components/account/ProfileSection';
import { SecuritySection } from '@/components/account/SecuritySection';
import { OrganizationSection } from '@/components/account/OrganizationSection';
import { DangerZone } from '@/components/account/DangerZone';

export default function AccountSettingsPage() {
  const reducedMotion = useReducedMotion();
  const { org, loading: orgLoading, error: orgError, refresh: refreshOrg } = useCurrentOrganization();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setSummaryError('');
    setMfaError('');
    const [summaryResult, mfaResult] = await Promise.allSettled([
      fetchAccountSummary(),
      fetchMfaStatus(),
    ]);
    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value);
    } else {
      setSummary(null);
      setSummaryError(
        summaryResult.reason instanceof Error
          ? summaryResult.reason.message
          : 'Failed to load profile',
      );
    }
    if (mfaResult.status === 'fulfilled') {
      setMfa(mfaResult.value);
    } else {
      setMfa(null);
      setMfaError(
        mfaResult.reason instanceof Error
          ? mfaResult.reason.message
          : 'Failed to load security status',
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Account</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage your personal account and session lifecycle.
        </p>
      </motion.div>

      <ProfileSection
        summary={summary}
        loading={loading}
        error={summaryError || null}
        onRetry={load}
        onUpdated={(updated) => setSummary(updated)}
      />

      <SecuritySection mfa={mfa} loading={loading} error={mfaError} onRetry={load} />

      <OrganizationSection
        org={org}
        loading={orgLoading}
        error={orgError}
        onRetry={refreshOrg}
      />

      <DangerZone />
    </div>
  );
}
