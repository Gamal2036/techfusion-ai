'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchCurrentOrganization,
  listenForOrgSwitch,
  type Organization,
} from '@/lib/org-client';
import { getCurrentUser } from '@/lib/auth-client';

/**
 * Tracks the active organization for the shell. Refetches on mount and after
 * every organization switch event (the event fires only after the token pair
 * has been replaced). The JWT orgId is used to detect the switch immediately.
 */
export function useCurrentOrganization() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const data = await fetchCurrentOrganization();
      setOrg(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organization');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    return listenForOrgSwitch(() => {
      setOrg(null);
      setLoading(true);
      refresh();
    });
  }, [refresh]);

  const activeOrgId = org?.id ?? getCurrentUser()?.orgId ?? null;

  return { org, activeOrgId, loading, error, refresh };
}

export type CurrentOrg = ReturnType<typeof useCurrentOrganization>;
