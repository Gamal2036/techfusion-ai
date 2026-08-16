'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchAccountSummary, type AccountSummary } from '@/lib/account-client';
import { useAccountSection } from '@/lib/account-sections';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AccountSectionNav } from '@/components/account/AccountSectionNav';
import { ProfileSection } from '@/components/account/ProfileSection';
import { SecuritySection } from '@/components/account/SecuritySection';
import { OrganizationSection } from '@/components/account/OrganizationSection';
import { DangerZone } from '@/components/account/DangerZone';

export default function AccountSettingsPage() {
  const reducedMotion = useReducedMotion();
  const { org, loading: orgLoading, error: orgError, refresh: refreshOrg } = useCurrentOrganization();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [loading, setLoading] = useState(true);
  const activeSection = useAccountSection();

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setSummaryError('');
    try {
      setSummary(await fetchAccountSummary());
    } catch (e) {
      setSummary(null);
      setSummaryError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

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

      <AccountSectionNav active={activeSection} />

      <section id="profile" className="scroll-mt-6">
        <ProfileSection
          summary={summary}
          loading={loading}
          error={summaryError || null}
          onRetry={loadSummary}
          onUpdated={setSummary}
        />
      </section>

      <section id="security" className="scroll-mt-6">
        <SecuritySection />
      </section>

      <section id="organization" className="scroll-mt-6">
        <OrganizationSection
          org={org}
          loading={orgLoading}
          error={orgError}
          onRetry={refreshOrg}
        />
      </section>

      <section id="danger" className="scroll-mt-6">
        <DangerZone />
      </section>
    </div>
  );
}
